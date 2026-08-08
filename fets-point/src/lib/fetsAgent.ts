import { supabase } from './supabase';

/**
 * FETS AI agent client.
 * Talks to the `fets-ai` Supabase Edge Function, which holds the model API
 * keys, enforces role/kill-switch guardrails, runs the tool-use loop (read +
 * autonomous write) and persists conversation memory server-side.
 *
 * The user's Supabase session token is forwarded automatically by
 * supabase.functions.invoke, so the backend can resolve who is asking.
 */

export interface AgentAction {
  name: string;
  input: unknown;
  ok: boolean;
}

export interface AgentResponse {
  conversationId: string | null;
  response: string;
  actions: AgentAction[];
  provider: 'claude' | 'gemini';
  killSwitch: boolean;
  tokens: number;
}

export async function askFetsAgent(
  message: string,
  opts: { conversationId?: string | null; provider?: 'claude' | 'gemini' } = {},
): Promise<AgentResponse> {
  const { data, error } = await supabase.functions.invoke('fets-ai', {
    body: {
      message,
      conversationId: opts.conversationId ?? null,
      provider: opts.provider,
    },
  });

  if (error) {
    // Surface the backend's error body when available (invoke wraps non-2xx).
    let detail = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.body) {
        const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
        if (parsed?.error) detail = parsed.error;
      }
    } catch { /* ignore parse issues */ }
    throw new Error(detail || 'FETS AI request failed');
  }

  if (data?.error) throw new Error(data.error);
  return data as AgentResponse;
}
