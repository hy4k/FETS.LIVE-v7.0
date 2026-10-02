import { supabase } from '../../lib/supabase';

/** Team chat data. Everything goes through the chat_* database functions. */
export type InboxMember = { user_id: string; full_name: string; avatar_url: string | null; is_admin: boolean; last_read_at: string | null };
export type InboxRow = {
  id: string; name: string | null; is_group: boolean; created_by: string | null; last_message_at: string | null;
  last_message_preview: string | null; unread: number; my_last_read: string | null; members: InboxMember[];
};
export type ChatMessage = {
  id: string; conversation_id: string; sender_id: string; content: string; type: string; file_path: string | null;
  created_at: string; edited_at: string | null; is_deleted: boolean; reply_to: string | null;
  sender?: { id: string; full_name: string; avatar_url: string | null } | null;
  /** Local only: still on its way, or failed. */
  pending?: 'sending' | 'failed';
};

const db = supabase as any;
const ok = <T,>(r: any): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };
const row = <T,>(r: any): T => { const d = ok<any>(r); return (Array.isArray(d) ? d[0] : d) as T; };

export const chatApi = {
  inbox: async (): Promise<InboxRow[]> => ok<InboxRow[]>(await db.rpc('chat_inbox')) || [],
  messages: async (conversationId: string): Promise<ChatMessage[]> => {
    const data = ok<ChatMessage[]>(await db.from('messages')
      .select('id,conversation_id,sender_id,content,type,file_path,created_at,edited_at,is_deleted,reply_to,sender:staff_profiles(id,full_name,avatar_url)')
      .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(400));
    return (data || []).reverse();
  },
  send: async (input: { conversationId: string; content: string; type?: string; filePath?: string | null; replyTo?: string | null }) =>
    row<ChatMessage>(await db.rpc('chat_send', { p_conversation: input.conversationId, p_content: input.content, p_type: input.type || 'text', p_file_path: input.filePath || null, p_reply_to: input.replyTo || null })),
  edit: async (id: string, content: string) => row<ChatMessage>(await db.rpc('chat_edit', { p_message: id, p_content: content })),
  remove: async (id: string) => { ok(await db.rpc('chat_delete', { p_message: id })); },
  markRead: async (conversationId: string) => { ok(await db.rpc('chat_mark_read', { p_conversation: conversationId })); },
  direct: async (me: string, other: string): Promise<string> => { const d = ok<any>(await db.rpc('get_or_create_conversation', { user_id_1: me, user_id_2: other })); return typeof d === 'string' ? d : d?.id; },
  createGroup: async (name: string, members: string[]): Promise<string> => ok<string>(await db.rpc('create_group_conversation', { p_name: name, p_member_ids: members })),
  addMembers: async (conversationId: string, members: string[]) => { ok(await db.rpc('chat_add_members', { p_conversation: conversationId, p_member_ids: members })); },
  removeMember: async (conversationId: string, member: string) => { ok(await db.rpc('chat_remove_member', { p_conversation: conversationId, p_member: member })); },
  rename: async (conversationId: string, name: string) => { ok(await db.rpc('chat_rename', { p_conversation: conversationId, p_name: name })); },
  leave: async (conversationId: string) => { ok(await db.rpc('chat_leave', { p_conversation: conversationId })); },
  upload: async (conversationId: string, userId: string, file: File) => {
    const path = `${conversationId}/${userId}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    ok(await supabase.storage.from('chat-files').upload(path, file));
    return { path, filePath: `chat-files:${path}` };
  },
  discard: async (path: string) => { await supabase.storage.from('chat-files').remove([path]); },
  fileUrl: async (filePath: string, download = false) => {
    if (/^https:\/\//.test(filePath)) return filePath;
    if (!filePath.startsWith('chat-files:')) return '';
    const r = await supabase.storage.from('chat-files').createSignedUrl(filePath.slice(11), 3600, download ? { download: true } : undefined);
    return r.data?.signedUrl || '';
  },
};

export const isImage = (m: Pick<ChatMessage, 'type' | 'content' | 'file_path'>) =>
  m.type === 'image' || /\.(png|jpe?g|gif|webp|heic)$/i.test(m.content || '') || /\.(png|jpe?g|gif|webp|heic)$/i.test(m.file_path || '');

/** "Today", "Yesterday" or a date, in India time. */
export function dayLabel(iso: string, now = new Date()) {
  const fmt = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const day = fmt(new Date(iso)), today = fmt(now), yesterday = fmt(new Date(now.getTime() - 86400000));
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}
export const clockOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
/** The conversation list's time: a clock today, otherwise the day. */
export const listTime = (iso: string | null, now = new Date()) => !iso ? '' : dayLabel(iso, now) === 'Today' ? clockOf(iso) : dayLabel(iso, now);

/** Messages with date separators and runs from the same sender folded together. */
export function thread(messages: ChatMessage[]) {
  const out: ({ kind: 'day'; label: string; key: string } | { kind: 'message'; m: ChatMessage; first: boolean; last: boolean })[] = [];
  let day = '';
  messages.forEach((m, i) => {
    const label = dayLabel(m.created_at);
    if (label !== day) { day = label; out.push({ kind: 'day', label, key: `day:${m.created_at}` }); }
    const prev = messages[i - 1], next = messages[i + 1];
    const near = (a?: ChatMessage, b?: ChatMessage) => Boolean(a && b && a.sender_id === b.sender_id && a.type !== 'call_log' && b.type !== 'call_log'
      && dayLabel(a.created_at) === dayLabel(b.created_at) && Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 5 * 60000);
    out.push({ kind: 'message', m, first: !near(prev, m), last: !near(m, next) });
  });
  return out;
}

/** Read ticks for my message: sent, or read by everyone else. */
export function seenBy(m: ChatMessage, members: InboxMember[], me: string) {
  const others = members.filter(x => x.user_id !== me);
  const read = others.filter(x => x.last_read_at && x.last_read_at >= m.created_at);
  return { read: read.length, of: others.length, all: others.length > 0 && read.length === others.length, names: read.map(x => x.full_name) };
}
