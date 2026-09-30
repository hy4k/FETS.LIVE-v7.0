import { supabase } from '../lib/supabase';
export type OperationsSnapshot = {
  sessions: any[] | null; roster: any[] | null; attendance: any[] | null; handovers: any[] | null;
  failures: string[]; updatedAt: string;
};
export const centreDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const belongs = (row: any, branch: string) => ['global', 'all'].includes(branch) || String(row.branch_location || row.branch || row.staff_profiles?.branch_assigned || '').toLowerCase().includes(branch);
export async function loadOperationsSnapshot(branch: string, day = centreDate()): Promise<OperationsSnapshot> {
  const results = await Promise.allSettled([
    supabase.from('calendar_sessions').select('*').eq('date', day).order('start_time'),
    supabase.from('roster_schedules').select('profile_id,shift_code,branch_location,staff_profiles(full_name,branch_assigned)').eq('date', day),
    supabase.from('staff_attendance').select('staff_id,check_in,check_out,status,branch_location,staff_profiles(full_name,branch_assigned)').eq('date', day),
    supabase.from('shift_handovers').select('id,branch,date,handover_time,outgoing_staff,incoming_staff,sig_in').eq('date', day),
  ]);
  const failures: string[] = [];
  const sources = ['Calendar', 'Roster', 'Attendance', 'Handovers'];
  const rows = results.map((result, index) => {
    if (result.status === 'rejected' || result.value.error) { failures.push(sources[index]); return null; }
    return (result.value.data || []).filter((r: any) => belongs(r, branch));
  });
  return { sessions: rows[0], roster: rows[1], attendance: rows[2], handovers: rows[3], failures, updatedAt: new Date().toISOString() };
}
export function summariseOperations(snapshot: OperationsSnapshot) {
  const rest = new Set(['rd','off','wo','l','leave','lv','h','holiday','to','toil','tr','tp']);
  const sessions = snapshot.sessions?.filter(s => s.status !== 'cancelled') ?? null;
  const roster = snapshot.roster?.filter(r => r.shift_code && !rest.has(String(r.shift_code).toLowerCase())) ?? null;
  return {
    candidates: sessions?.reduce((n, s) => n + (Number(s.candidate_count) || 0), 0) ?? null,
    sessions: sessions?.length ?? null,
    rostered: roster ? new Set(roster.map(r => r.profile_id)).size : null,
    checkedIn: snapshot.attendance ? new Set(snapshot.attendance.filter(r => r.check_in && !r.check_out).map(r => r.staff_id)).size : null,
    pendingHandovers: snapshot.handovers?.filter(h => !h.sig_in).length ?? null,
    roster,
  };
}
