// providers.ts — model back-ends behind one interface.
// Claude runs the full agentic tool-use loop (read + autonomous write).
// Gemini runs a function-calling loop too, so both providers are switchable
// and both can act. Each returns the final text plus the list of tools invoked.

import { TOOL_DEFS, executeTool, type ToolContext } from "./tools.ts";

export interface RunResult {
  text: string;
  toolsUsed: Array<{ name: string; input: unknown; ok: boolean }>;
  tokens: number;
}

// ---------------------------------------------------------------------------
// Claude (Anthropic Messages API with tool use)
// ---------------------------------------------------------------------------
export async function runClaude(opts: {
  apiKey: string;
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: unknown }>;
  toolCtx: ToolContext;
  maxIterations: number;
}): Promise<RunResult> {
  const tools = TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
  const messages = [...opts.messages];
  const toolsUsed: RunResult["toolsUsed"] = [];
  let tokens = 0;

  for (let i = 0; i < opts.maxIterations; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: opts.model, max_tokens: 3072, system: opts.system, tools, messages }),
    });
    if (!res.ok) throw new Error((await res.json())?.error?.message || `Claude API ${res.status}`);
    const data = await res.json();
    tokens += (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    const toolUses = (data.content ?? []).filter((b: any) => b.type === "tool_use");
    if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
      return { text, toolsUsed, tokens };
    }

    messages.push({ role: "assistant", content: data.content });
    const toolResults: any[] = [];
    for (const tu of toolUses) {
      const outcome = await executeTool(opts.toolCtx, tu.name, tu.input);
      toolsUsed.push({ name: tu.name, input: tu.input, ok: outcome.ok });
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(outcome.ok ? outcome.result : { error: outcome.error }).slice(0, 12000),
        is_error: !outcome.ok,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }
  return { text: "I reached the maximum number of reasoning steps. Please narrow the request.", toolsUsed, tokens };
}

// ---------------------------------------------------------------------------
// Gemini (generateContent with function calling)
// ---------------------------------------------------------------------------
function toGeminiSchema(s: any): any {
  // Gemini rejects some JSON-Schema keywords; keep the supported subset.
  if (!s || typeof s !== "object") return s;
  const out: any = {};
  for (const [k, v] of Object.entries(s)) {
    if (["default", "minimum", "maximum"].includes(k)) continue;
    if (k === "type" && typeof v === "string") out.type = (v as string).toUpperCase();
    else if (k === "properties") { out.properties = {}; for (const [pk, pv] of Object.entries(v as object)) out.properties[pk] = toGeminiSchema(pv); }
    else if (k === "items") out.items = toGeminiSchema(v);
    else out[k] = v;
  }
  return out;
}

export async function runGemini(opts: {
  apiKey: string;
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  toolCtx: ToolContext;
  maxIterations: number;
}): Promise<RunResult> {
  const functionDeclarations = TOOL_DEFS.map((t) => ({
    name: t.name, description: t.description, parameters: toGeminiSchema(t.input_schema),
  }));
  const contents: any[] = opts.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const toolsUsed: RunResult["toolsUsed"] = [];
  let tokens = 0;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`;

  for (let i = 0; i < opts.maxIterations; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents,
        tools: [{ functionDeclarations }],
      }),
    });
    if (!res.ok) throw new Error((await res.json())?.error?.message || `Gemini API ${res.status}`);
    const data = await res.json();
    tokens += data.usageMetadata?.totalTokenCount ?? 0;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p: any) => p.functionCall);

    if (calls.length === 0) {
      const text = parts.filter((p: any) => p.text).map((p: any) => p.text).join("\n");
      return { text, toolsUsed, tokens };
    }

    contents.push({ role: "model", parts });
    const responseParts: any[] = [];
    for (const c of calls) {
      const outcome = await executeTool(opts.toolCtx, c.functionCall.name, c.functionCall.args ?? {});
      toolsUsed.push({ name: c.functionCall.name, input: c.functionCall.args, ok: outcome.ok });
      responseParts.push({
        functionResponse: {
          name: c.functionCall.name,
          response: { result: outcome.ok ? outcome.result : { error: outcome.error } },
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }
  return { text: "I reached the maximum number of reasoning steps. Please narrow the request.", toolsUsed, tokens };
}
