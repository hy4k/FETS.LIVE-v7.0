import { supabase } from '../lib/supabase';

export type DeskJournal = { note: string; mood: string };
export type DeskPreferences = { cover: string };
export type Versioned<T> = { value: T; version: number };
export type FocusRecord = { id: string; duration_minutes: number; completed_at: string };
export interface DeskRepository {
  loadJournal: (userId: string, day: string) => Promise<Versioned<DeskJournal> | null>;
  saveJournal: (userId: string, day: string, value: DeskJournal, version: number | null) => Promise<Versioned<DeskJournal>>;
  loadPreferences: (userId: string) => Promise<Versioned<DeskPreferences> | null>;
  savePreferences: (userId: string, value: DeskPreferences, version: number | null) => Promise<Versioned<DeskPreferences>>;
  saveFocus: (userId: string, record: FocusRecord) => Promise<void>;
  recentFocus: (userId: string) => Promise<FocusRecord[]>;
}
async function verifyOwner(userId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== userId) throw new Error('Sign in again to sync your personal desk.');
}
function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}
export const deskRepository: DeskRepository = {
  async loadJournal(userId, day) {
    await verifyOwner(userId);
    const row: any = unwrap(await supabase.from('desk_journal_entries').select('note,mood,version').eq('user_id', userId).eq('entry_date', day).maybeSingle());
    return row ? { value: { note: row.note, mood: row.mood }, version: row.version } : null;
  },
  async saveJournal(userId, day, value, version) {
    await verifyOwner(userId);
    const row: any = unwrap(await supabase.rpc('desk_save_journal', { p_date: day, p_note: value.note, p_mood: value.mood, p_version: version }));
    if (!row) throw new Error('The journal was not saved. Please try again.');
    return { value: { note: row.note, mood: row.mood }, version: row.version };
  },
  async loadPreferences(userId) {
    await verifyOwner(userId);
    const row: any = unwrap(await supabase.from('desk_preferences').select('cover,version').eq('user_id', userId).maybeSingle());
    return row ? { value: { cover: row.cover }, version: row.version } : null;
  },
  async savePreferences(userId, value, version) {
    await verifyOwner(userId);
    const row: any = unwrap(await supabase.rpc('desk_save_preferences', { p_cover: value.cover, p_version: version }));
    if (!row) throw new Error('The cover was not saved. Please try again.');
    return { value: { cover: row.cover }, version: row.version };
  },
  async saveFocus(userId, record) {
    await verifyOwner(userId);
    unwrap(await supabase.from('desk_focus_sessions').upsert({ ...record, user_id: userId }, { onConflict: 'user_id,id', ignoreDuplicates: true }));
  },
  async recentFocus(userId) {
    await verifyOwner(userId);
    return unwrap(await supabase.from('desk_focus_sessions').select('id,duration_minutes,completed_at').eq('user_id', userId).order('completed_at', { ascending: false }).limit(30)) || [];
  },
};
