/* ═══════════════════════════════════════════════════════════════════════════
   Google Chat alerts — relayed through the "chat-notify" Supabase Edge Function.
   The webhook URL lives in the app_config table (key: google_chat_webhook),
   never in the repo. All sends fail silently — chat is best-effort.
   ═══════════════════════════════════════════════════════════════════════════ */
import { supabase } from "../lib/supabase";

export type ChatAlert =
  | { kind: "briefing"; branch: string; dateLabel: string; lead: string | null; lines: string[] }
  | { kind: "missed"; branch: string; duty: string; owner: string; by: string }
  | { kind: "reassigned"; branch: string; duty: string; from: string; to: string; by: string }
  | { kind: "summary"; branch: string; weekLabel: string; text: string };

export async function sendChatAlert(alert: ChatAlert): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("chat-notify", { body: alert });
    if (error) return false;
    return (data as any)?.ok !== false;
  } catch {
    return false;
  }
}
