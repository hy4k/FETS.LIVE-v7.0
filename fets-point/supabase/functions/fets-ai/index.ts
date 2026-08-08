// fets-ai — the FETS AI agent brain.
// Holds the model API keys, enforces role/kill-switch guardrails, builds context
// from live data + long-term memory + external knowledge, runs a tool-use loop
// (Claude or Gemini), and persists conversation history for durable memory.
//
// Auth: requires a logged-in caller (verify_jwt=true). The caller's identity
// determines their role and therefore which tools they may invoke.
//
// Secrets (set via `supabase secrets set` or the app_config table):
//   ANTHROPIC_API_KEY, GEMINI_API_KEY
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildContext, renderSystemPrompt } from "./context.ts";
import { runClaude, runGemini } from "./providers.ts";
import type { ToolContext } from "./tools.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function secret(supa: any, envName: string, configKey: string): Promise<string | null> {
  const fromEnv = Deno.env.get(envName);
  if (fromEnv) return fromEnv;
  const { data } = await supa.from("app_config").select("value").eq("key", configKey).maybeSingle();
  return data?.value ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { message, conversationId = null, provider: providerOverride } = await req.json();
    if (!message || typeof message !== "string") return json({ error: "message is required" }, 400);

    // Service-role client (bypasses RLS for reads/writes + audit).
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- Identify the caller from their JWT ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supa.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    // Profiles are linked to auth users by user_id on some rows and by id on
    // others (the app itself tries both), so resolve robustly.
    let profile: { full_name?: string; role?: string; branch_assigned?: string } | null = null;
    {
      const byUserId = await supa
        .from("staff_profiles")
        .select("full_name, role, branch_assigned")
        .eq("user_id", user.id)
        .maybeSingle();
      profile = byUserId.data;
      if (!profile) {
        const byId = await supa
          .from("staff_profiles")
          .select("full_name, role, branch_assigned")
          .eq("id", user.id)
          .maybeSingle();
        profile = byId.data;
      }
    }
    const role = (profile?.role ?? "staff").toLowerCase();
    const userName = profile?.full_name ?? user.email ?? "Operator";
    const branch = profile?.branch_assigned ?? null;

    // --- Load agent settings (provider, model, kill-switch, allowlist) ---
    const { data: settings } = await supa.from("ai_settings").select("*").eq("id", 1).maybeSingle();
    const provider = (providerOverride ?? settings?.provider ?? "claude") as "claude" | "gemini";
    const killSwitch = !!settings?.kill_switch || settings?.autonomous_enabled === false;
    const maxIterations = settings?.max_tool_iterations ?? 8;
    const allowMap = settings?.allowed_tools ?? {};
    const allowedTools: string[] = allowMap[role] ?? allowMap["staff"] ?? ["read_table", "aggregate", "search_memory"];

    // --- Ensure a conversation exists (durable memory) ---
    let convId: string | null = conversationId;
    if (!convId) {
      const { data: conv } = await supa.from("ai_conversations")
        .insert({ user_id: user.id, title: message.slice(0, 60), status: "active" })
        .select("id").single();
      convId = conv?.id ?? null;
    }

    // --- Recent history for this conversation ---
    const { data: priorMsgs } = await supa
      .from("ai_conversation_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(20);

    // --- Build context + system prompt ---
    const ctx = await buildContext(supa, { branch });
    const system = renderSystemPrompt(ctx, { name: userName, role }, killSwitch);

    const toolCtx: ToolContext = {
      supa, userId: user.id, role, conversationId: convId, killSwitch, allowedTools,
    };

    // --- Persist the user's message ---
    await supa.from("ai_conversation_messages").insert({ conversation_id: convId, role: "user", content: message });

    const started = Date.now();
    let result;
    if (provider === "gemini") {
      const key = await secret(supa, "GEMINI_API_KEY", "gemini_api_key");
      if (!key) return json({ error: "Gemini API key not configured" }, 500);
      const history = (priorMsgs ?? []).map((m: any) => ({ role: m.role, content: m.content }));
      result = await runGemini({
        apiKey: key, model: settings?.gemini_model ?? "gemini-1.5-flash",
        system, messages: [...history, { role: "user", content: message }], toolCtx, maxIterations,
      });
    } else {
      const key = await secret(supa, "ANTHROPIC_API_KEY", "anthropic_api_key");
      if (!key) return json({ error: "Anthropic API key not configured" }, 500);
      const history = (priorMsgs ?? []).map((m: any) => ({ role: m.role, content: m.content }));
      result = await runClaude({
        apiKey: key, model: settings?.claude_model ?? "claude-sonnet-4-6",
        system, messages: [...history, { role: "user", content: message }], toolCtx, maxIterations,
      });
    }

    const elapsed = Date.now() - started;

    // --- Persist assistant reply + analytics ---
    await supa.from("ai_conversation_messages").insert({
      conversation_id: convId, role: "assistant", content: result.text,
      data_references: result.toolsUsed, tokens_used: result.tokens,
    });
    await supa.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    await supa.from("ai_query_log").insert({
      user_id: user.id, conversation_id: convId, query_text: message,
      response_summary: result.text.slice(0, 300),
      data_sources: result.toolsUsed.map((t) => t.name),
      execution_time_ms: elapsed, tokens_used: result.tokens,
    });

    return json({
      conversationId: convId,
      response: result.text,
      actions: result.toolsUsed,
      provider,
      killSwitch,
      tokens: result.tokens,
    });
  } catch (e) {
    console.error("[fets-ai] error:", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
