/* ═══════════════════════════════════════════════════════════════════════════
   Duty data layer — weekly rotation engine, daily log, lead resolution
   Powers the FETS HANDOVER page (HandoverHub).
   ═══════════════════════════════════════════════════════════════════════════ */
import { supabase } from "../lib/supabase";
import { isStaffRosterVisible } from "../utils/rosterVisibility";

export const REST_CODES = new Set(["rd", "off", "wo", "l", "leave", "lv", "h", "holiday", "to", "toil", "tr", "tp"]);

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Monday (IST-local) of the week containing d */
export function weekStartOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return ymd(x);
}

const EPOCH_WEEK = "2026-01-05"; // a Monday — rotation anchor
export function weeksSinceEpoch(weekStart: string): number {
  const ms = new Date(weekStart + "T00:00:00").getTime() - new Date(EPOCH_WEEK + "T00:00:00").getTime();
  return Math.round(ms / (7 * 86400000));
}

export interface Duty {
  id: string;
  title: string;
  description: string | null;
  branch: string;
  scheduled_time: string | null;
  steps: { title: string }[];
  sort_order: number;
  is_active: boolean;
}

export interface DutyAssignment {
  id: string;
  week_start: string;
  branch: string;
  duty_id: string;
  staff_name: string;
  is_override: boolean;
}

export interface DutyLog {
  id: string;
  date: string;
  branch: string;
  duty_id: string;
  staff_name: string;
  original_staff_name: string | null;
  status: "pending" | "in_progress" | "done" | "missed" | "off";
  steps_state: boolean[];
  verified_by: string | null;
  verified_at: string | null;
  note: string | null;
}

/* ── Duties ─────────────────────────────────────────────────────────────── */
export async function loadDuties(branch: string): Promise<Duty[]> {
  const { data, error } = await supabase
    .from("duty_master").select("*").eq("is_active", true).order("sort_order");
  if (error) throw error;
  return ((data || []) as Duty[]).filter((d) => d.branch === "both" || d.branch === branch);
}

export async function saveDuty(duty: Partial<Duty> & { title: string }) {
  if (duty.id) {
    const { id, ...rest } = duty as any;
    const { error } = await supabase.from("duty_master").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("duty_master").insert(duty as any);
    if (error) throw error;
  }
}

export async function deleteDuty(id: string) {
  const { error } = await supabase.from("duty_master").delete().eq("id", id);
  if (error) throw error;
}

/* ── Staff pools ────────────────────────────────────────────────────────── */
export async function loadBranchStaff(branch: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("full_name, branch_assigned, is_active, permissions")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return (data || [])
    .filter((p: any) => p.full_name && isStaffRosterVisible(p) && String(p.branch_assigned || "").toLowerCase() === branch)
    .map((p: any) => p.full_name as string);
}

/** Staff actually working a given date at a branch (roster-based, falls back to full pool) */
export async function loadPresentStaff(date: string, branch: string): Promise<string[]> {
  const { data } = await supabase
    .from("roster_schedules")
    .select("shift_code, branch_location, staff_profiles(full_name, branch_assigned, permissions)")
    .eq("date", date);
  const names = (data || [])
    .filter((row: any) => {
      const code = String(row.shift_code || "").toLowerCase();
      const br = String(row.branch_location || row.staff_profiles?.branch_assigned || "").toLowerCase();
      return code && !REST_CODES.has(code) && br.includes(branch) && isStaffRosterVisible(row.staff_profiles);
    })
    .map((row: any) => row.staff_profiles?.full_name)
    .filter(Boolean);
  const unique = Array.from(new Set(names)) as string[];
  if (unique.length) return unique.sort((a, b) => a.localeCompare(b));
  return loadBranchStaff(branch);
}

/* ── Weekly rotation ────────────────────────────────────────────────────── */
export async function ensureWeekAssignments(weekStart: string, branch: string) {
  const [duties, staff, existingRes] = await Promise.all([
    loadDuties(branch),
    loadBranchStaff(branch),
    supabase.from("duty_assignments").select("*").eq("week_start", weekStart).eq("branch", branch),
  ]);
  const existing = (existingRes.data || []) as DutyAssignment[];
  if (!staff.length || !duties.length) return { duties, staff, assignments: existing };

  const offset = weeksSinceEpoch(weekStart);
  const missing = duties.filter((d) => !existing.some((a) => a.duty_id === d.id));
  if (missing.length) {
    const rows = missing.map((d) => {
      const dutyIdx = duties.findIndex((x) => x.id === d.id);
      const idx = (((dutyIdx + offset) % staff.length) + staff.length) % staff.length;
      return { week_start: weekStart, branch, duty_id: d.id, staff_name: staff[idx], is_override: false };
    });
    const { data, error } = await supabase.from("duty_assignments").insert(rows).select();
    if (error) throw error;
    return { duties, staff, assignments: [...existing, ...((data || []) as DutyAssignment[])] };
  }
  return { duties, staff, assignments: existing };
}

export async function setAssignment(weekStart: string, branch: string, dutyId: string, staffName: string) {
  const { data: row } = await supabase
    .from("duty_assignments").select("id")
    .eq("week_start", weekStart).eq("branch", branch).eq("duty_id", dutyId).maybeSingle();
  if (row) {
    const { error } = await supabase.from("duty_assignments")
      .update({ staff_name: staffName, is_override: true, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("duty_assignments")
      .insert({ week_start: weekStart, branch, duty_id: dutyId, staff_name: staffName, is_override: true });
    if (error) throw error;
  }
}

/* ── Daily lead (reuses handover_assignments → roster gold border stays in sync) ── */
export async function getDayLead(date: string, branch: string): Promise<string | null> {
  const { data } = await supabase
    .from("handover_assignments").select("staff_names").eq("date", date).eq("branch", branch).maybeSingle();
  const names = (data?.staff_names || []) as string[];
  return names[0] || null;
}

export async function ensureDayLead(date: string, branch: string, presentStaff: string[]) {
  const existing = await getDayLead(date, branch);
  if (existing) return { lead: existing, auto: false };
  if (!presentStaff.length) return { lead: null as string | null, auto: false };
  const dayIdx = Math.floor(new Date(date + "T00:00:00").getTime() / 86400000);
  const lead = presentStaff[dayIdx % presentStaff.length];
  const { data: row } = await supabase
    .from("handover_assignments").select("id").eq("date", date).eq("branch", branch).maybeSingle();
  if (row) {
    await supabase.from("handover_assignments").update({ staff_names: [lead] }).eq("id", row.id);
  } else {
    await supabase.from("handover_assignments").insert({ date, branch, staff_names: [lead] });
  }
  return { lead, auto: true };
}

export async function setDayLead(date: string, branch: string, staffName: string) {
  const { data: row } = await supabase
    .from("handover_assignments").select("id").eq("date", date).eq("branch", branch).maybeSingle();
  if (row) {
    const { error } = await supabase.from("handover_assignments").update({ staff_names: [staffName] }).eq("id", row.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("handover_assignments").insert({ date, branch, staff_names: [staffName] });
    if (error) throw error;
  }
}

/* ── Daily log ──────────────────────────────────────────────────────────── */
export async function ensureDailyLog(date: string, branch: string, weekStart: string): Promise<DutyLog[]> {
  const { duties, assignments } = await ensureWeekAssignments(weekStart, branch);
  const { data: existing } = await supabase.from("duty_daily_log").select("*").eq("date", date).eq("branch", branch);
  const logs = (existing || []) as DutyLog[];
  const missing = duties.filter((d) => !logs.some((l) => l.duty_id === d.id));
  if (missing.length) {
    const rows = missing.map((d) => {
      const a = assignments.find((x) => x.duty_id === d.id);
      const stepCount = Array.isArray(d.steps) ? d.steps.length : 0;
      return {
        date, branch, duty_id: d.id,
        staff_name: a?.staff_name || "Unassigned",
        status: "pending",
        steps_state: Array(stepCount).fill(false),
      };
    });
    const { data, error } = await supabase.from("duty_daily_log").insert(rows).select();
    if (error) throw error;
    return [...logs, ...((data || []) as DutyLog[])];
  }
  return logs;
}

export async function updateLogSteps(logId: string, stepsState: boolean[], actorName: string) {
  const allDone = stepsState.length > 0 && stepsState.every(Boolean);
  const patch: any = {
    steps_state: stepsState,
    updated_at: new Date().toISOString(),
    status: allDone ? "done" : "in_progress",
  };
  if (allDone) { patch.verified_by = actorName; patch.verified_at = new Date().toISOString(); }
  const { error } = await supabase.from("duty_daily_log").update(patch).eq("id", logId);
  if (error) throw error;
}

export async function setLogStatus(logId: string, status: DutyLog["status"], actorName: string, note?: string) {
  const patch: any = { status, updated_at: new Date().toISOString() };
  if (status === "done") { patch.verified_by = actorName; patch.verified_at = new Date().toISOString(); }
  if (note !== undefined) patch.note = note;
  const { error } = await supabase.from("duty_daily_log").update(patch).eq("id", logId);
  if (error) throw error;
}

export async function reassignLog(logId: string, newStaff: string, actorName: string) {
  const { data: log } = await supabase.from("duty_daily_log").select("staff_name, original_staff_name").eq("id", logId).single();
  const patch: any = {
    staff_name: newStaff,
    original_staff_name: log?.original_staff_name || log?.staff_name || null,
    status: "pending",
    steps_state: [],
    verified_by: actorName,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("duty_daily_log").update(patch).eq("id", logId);
  if (error) throw error;
}

/* ── Report data ────────────────────────────────────────────────────────── */
export async function loadLogRange(start: string, end: string, branch: string): Promise<DutyLog[]> {
  const { data, error } = await supabase
    .from("duty_daily_log").select("*")
    .eq("branch", branch).gte("date", start).lte("date", end)
    .order("date").order("duty_id");
  if (error) throw error;
  return (data || []) as DutyLog[];
}
