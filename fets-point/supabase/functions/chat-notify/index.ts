// chat-notify — relays FETS alerts into the Google Chat space.
// The webhook URL is stored in public.app_config (key = 'google_chat_webhook'),
// so it never lives in the repo. Requires an authenticated caller (verify_jwt).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const cap = (b: string) => (b ? b.charAt(0).toUpperCase() + b.slice(1) : b);

function format(a: any): string {
  switch (a?.kind) {
    case "briefing": {
      const lines = (a.lines || []).map((l: string) => `• ${l}`).join("\n");
      return (
        `*FETS HANDOVER — ${cap(a.branch)} · ${a.dateLabel}*\n` +
        `👑 Lead today: *${a.lead || "not assigned"}*\n\n` +
        `*Today's duties:*\n${lines || "• none"}`
      );
    }
    case "missed":
      return (
        `⚠️ *Missed duty — ${cap(a.branch)}*\n` +
        `*${a.duty}* (owner: ${a.owner}) was marked missed by ${a.by}.`
      );
    case "reassigned":
      return (
        `🔁 *Duty reassigned — ${cap(a.branch)}*\n` +
        `*${a.duty}*: ${a.from} → *${a.to}* (by ${a.by}).`
      );
    case "summary":
      return `*FETS Weekly Duty Report — ${cap(a.branch)} (${a.weekLabel})*\n${a.text}`;
    default:
      return "FETS notification";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: any) =>
    new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const alert = await req.json();
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supa
      .from("app_config")
      .select("value")
      .eq("key", "google_chat_webhook")
      .maybeSingle();
    if (error || !data?.value) return json({ ok: false, reason: "webhook not configured" });

    const r = await fetch(data.value, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: format(alert) }),
    });
    return json({ ok: r.ok });
  } catch (e) {
    return json({ ok: false, error: String(e) });
  }
});
