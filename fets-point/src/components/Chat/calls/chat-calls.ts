import { supabase } from '../../../lib/supabase';

/**
 * Team calls. A call is a row in chat_calls that everyone in the conversation
 * sees in real time: ringing → active → ended / missed / declined. That row is
 * what makes the other side ring. The audio and video go through LiveKit, one
 * room per conversation.
 */
export type CallKind = 'audio' | 'video';
export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
export type ChatCall = {
  id: string; conversation_id: string; kind: CallKind; status: CallStatus; started_by: string;
  participants: string[]; declined: string[]; created_at: string; answered_at: string | null; ended_at: string | null;
};
export type CallPeer = { conversationName: string; isGroup: boolean; callerName: string };

/** How long an unanswered call rings, in ms. */
export const RING_FOR = 60_000;

const db = supabase as any;
const one = (r: any): ChatCall => { if (r.error) throw new Error(r.error.message); return Array.isArray(r.data) ? r.data[0] : r.data; };

export const callApi = {
  start: async (conversationId: string, kind: CallKind) => one(await db.rpc('chat_call_start', { p_conversation: conversationId, p_kind: kind })),
  join: async (id: string) => one(await db.rpc('chat_call_join', { p_call: id })),
  decline: async (id: string) => one(await db.rpc('chat_call_decline', { p_call: id })),
  leave: async (id: string) => one(await db.rpc('chat_call_leave', { p_call: id })),
  settle: async (id: string) => one(await db.rpc('chat_call_settle', { p_call: id })),
  /** Calls still ringing or running in my conversations. */
  live: async (): Promise<ChatCall[]> => {
    const r = await db.from('chat_calls').select('*').in('status', ['ringing', 'active']).order('created_at', { ascending: false });
    if (r.error) throw new Error(r.error.message);
    return r.data || [];
  },
  peer: async (call: ChatCall, me: string): Promise<CallPeer> => {
    const [conv, caller] = await Promise.all([
      db.from('conversations').select('id,name,is_group,members:conversation_members(user_id,user:staff_profiles(full_name))').eq('id', call.conversation_id).maybeSingle(),
      db.from('staff_profiles').select('full_name').eq('id', call.started_by).maybeSingle(),
    ]);
    const c = conv.data;
    const other = c?.members?.find((m: any) => m.user_id !== me)?.user?.full_name;
    return { conversationName: c?.is_group ? c.name || 'Group' : other || caller.data?.full_name || 'Teammate', isGroup: Boolean(c?.is_group), callerName: caller.data?.full_name || 'A teammate' };
  },
  /** One-to-one conversation with this person, created if needed. */
  directWith: async (me: string, other: string): Promise<string> => {
    const r = await db.rpc('get_or_create_conversation', { user_id_1: me, user_id_2: other });
    if (r.error) throw new Error(r.error.message);
    return typeof r.data === 'string' ? r.data : r.data?.id;
  },
};

/** Should this call ring for me right now? */
export function ringsFor(call: ChatCall, me: string, isGroup: boolean, now = Date.now()) {
  if (call.started_by === me || call.participants.includes(me) || call.declined.includes(me)) return false;
  if (now - new Date(call.created_at).getTime() > RING_FOR) return false;
  // A group keeps ringing the others after the first person answers.
  return call.status === 'ringing' || (isGroup && call.status === 'active');
}

/** Am I in this call? */
export const inCall = (call: ChatCall, me: string) => (call.status === 'ringing' || call.status === 'active') && call.participants.includes(me);

/** A soft two-tone ring, made in the browser so there is no file to load. */
export function ringer(kind: 'incoming' | 'outgoing') {
  let ctx: AudioContext | null = null;
  let timer: number | undefined;
  const beep = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    const tones = kind === 'incoming' ? [[880, 0], [660, 0.18], [880, 0.5], [660, 0.68]] : [[440, 0], [480, 0]];
    for (const [freq, at] of tones) {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = freq; osc.type = 'sine';
      const len = kind === 'incoming' ? 0.16 : 1.2;
      gain.gain.setValueAtTime(0, t + at); gain.gain.linearRampToValueAtTime(kind === 'incoming' ? 0.18 : 0.06, t + at + 0.02);
      gain.gain.linearRampToValueAtTime(0, t + at + len);
      osc.connect(gain).connect(ctx.destination); osc.start(t + at); osc.stop(t + at + len + 0.05);
    }
  };
  return {
    start() {
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new Ctor(); void ctx.resume().catch(() => undefined);
        beep(); timer = window.setInterval(beep, kind === 'incoming' ? 2000 : 4000);
      } catch { /* Sound is a nicety; the screen still shows the call. */ }
    },
    stop() { if (timer) window.clearInterval(timer); timer = undefined; void ctx?.close().catch(() => undefined); ctx = null; },
  };
}

/** A short two-note chime for a new message. */
export function chime() {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctor();
    const t = ctx.currentTime;
    [[784, 0], [1047, 0.12]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0, t + at); gain.gain.linearRampToValueAtTime(0.14, t + at + 0.02); gain.gain.linearRampToValueAtTime(0, t + at + 0.28);
      osc.connect(gain).connect(ctx.destination); osc.start(t + at); osc.stop(t + at + 0.32);
    });
    window.setTimeout(() => void ctx.close().catch(() => undefined), 800);
  } catch { /* Sound is a nicety. */ }
}

/** A system notification for a message, shown when the tab is hidden or minimised. */
export function notifyMessage(from: string, text: string, onClick: () => void) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.visibilityState === 'visible') return null;
    const n = new Notification(from, { body: text, tag: `fets-msg-${from}` } as NotificationOptions);
    n.onclick = () => { window.focus(); onClick(); n.close(); };
    return n;
  } catch { return null; }
}

/** A system notification when the tab is in the background. */
export function notifyCall(title: string, body: string, onClick: () => void) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.visibilityState === 'visible') return null;
    const n = new Notification(title, { body, tag: 'fets-call', requireInteraction: true } as NotificationOptions);
    n.onclick = () => { window.focus(); onClick(); n.close(); };
    return n;
  } catch { return null; }
}

export const callAlertsState = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
export async function enableCallAlerts() {
  if (typeof Notification === 'undefined') return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}
