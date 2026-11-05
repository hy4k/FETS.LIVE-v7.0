// @ts-nocheck
/* eslint-disable */
/*
  Attendance — persisted to public.staff_attendance (NOT localStorage), keyed by
  (staff_id, date) so check-in / step-out / check-out survive refresh and device
  changes. Breaks/step-outs are tracked inside the `notes` JSON. This replaces
  the old localStorage worklog that was being clobbered by the live-data load.
*/
import { supabase } from "../lib/supabase";
import { clockParts, attendanceMetrics } from "../roster-workspace/model";

const F = () => window.FETS;
const pad = (n) => String(n).padStart(2, "0");
export const attDateStr = (d = new Date()) => clockParts(d).day;
const hhmm = () => clockParts().time;
const hm = (t) => { if (!t) return 0; const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };

const sid = () => {
  const f = F();
  if (!f) return null;
  if (f._meId) return f._meId;
  if (f._meUserId && f._userIdToProfileId && f._userIdToProfileId[f._meUserId]) {
    return f._userIdToProfileId[f._meUserId];
  }
  return null;
};

async function ensureSid() {
  let id = sid();
  if (id) return id;
  try {
    const { data: au } = await supabase.auth.getUser();
    const uid = au?.user?.id;
    if (uid) {
      const { data: prof } = await supabase.from("staff_profiles").select("id").eq("user_id", uid).maybeSingle();
      if (prof && prof.id) {
        if (window.FETS) {
          window.FETS._meId = prof.id;
          window.FETS._meUserId = uid;
          if (window.FETS._userIdToProfileId) {
            window.FETS._userIdToProfileId = window.FETS._userIdToProfileId || {};
            window.FETS._userIdToProfileId[uid] = prof.id;
          }
        }
        return prof.id;
      }
    }
  } catch (e) {
    console.error("Error resolving profile ID:", e);
  }
  return null;
}

const parseNotes = (n) => { try { return JSON.parse(n || "{}"); } catch (e) { return {}; } };

export function attWorked(row) {
  return row ? attendanceMetrics(row, undefined, row.date).worked ?? 0 : 0;
}
export function attOnBreak(row) {
  const steps = (parseNotes(row && row.notes).steps) || [];
  const last = steps[steps.length - 1];
  return !!(last && last.out && !last.in);
}
export function attBreakMins(row) { return (parseNotes(row && row.notes).breakMins) || 0; }

export async function attToday() {
  const id = await ensureSid(); if (!id) return null;
  try { const { data } = await supabase.from("staff_attendance").select("*").eq("staff_id", id).eq("date", attDateStr()).maybeSingle(); return data || null; }
  catch (e) { return null; }
}

async function recordAction(action, staffId = null, dateStr = attDateStr()) {
  if (dateStr !== attDateStr()) return { error: "Check-in and check-out actions are for today only." };
  try {
    const { error } = await supabase.rpc("roster_attendance_action", { p_action: action, p_staff: staffId });
    if (error) throw error;
    return { ok: true };
  } catch (e) { return { error: e.message || "Attendance was not saved. Please refresh." }; }
}
export async function attCheckIn(_branch) { return recordAction("in"); }
export async function attStepOut() { return recordAction("break"); }
export async function attBack() { return recordAction("back"); }
export async function attCheckOut() { return recordAction("out"); }

/* this staff member's recent shift history */
export async function attHistory(days = 45) {
  const id = await ensureSid(); if (!id) return [];
  const from = new Date(); from.setDate(from.getDate() - days);
  try {
    const { data } = await supabase.from("staff_attendance").select("*").eq("staff_id", id).gte("date", attDateStr(from)).order("date", { ascending: false });
    return (data || []).map((r) => ({ date: r.date, check_in: r.check_in, check_out: r.check_out, status: r.status, breakMins: attBreakMins(r), worked: attWorked(r) }));
  } catch (e) { return []; }
}

/* admin: everyone's attendance for a given day (mithun-only page) */
export async function attAllForDate(dateStr) {
  try {
    const { data, error } = await supabase.from("staff_attendance")
      .select("*, staff:staff_profiles!staff_attendance_staff_id_fkey(full_name, branch_assigned)")
      .eq("date", dateStr).order("check_in", { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => ({
      name: (r.staff && r.staff.full_name) || r.staff_name || "Staff",
      branch: (r.staff && r.staff.branch_assigned) || r.branch_location || "",
      check_in: r.check_in, check_out: r.check_out, status: r.status,
      breakMins: attBreakMins(r), worked: attWorked(r),
    }));
  } catch (e) {
    try {
      const { data } = await supabase.from("staff_attendance").select("*").eq("date", dateStr).order("check_in", { ascending: true });
      return (data || []).map((r) => ({ name: r.staff_name || "Staff", branch: r.branch_location || "", check_in: r.check_in, check_out: r.check_out, status: r.status, breakMins: attBreakMins(r), worked: attWorked(r) }));
    } catch (e2) { return []; }
  }
}

export const attFmtMins = (m) => `${Math.floor(m / 60)}h ${pad(m % 60)}m`;

export async function attCheckInStaff(staffId, _branch, dateStr = attDateStr()) { return recordAction("in", staffId, dateStr); }
export async function attCheckOutStaff(staffId, dateStr = attDateStr()) { return recordAction("out", staffId, dateStr); }

export async function attUpdateStatusStaff(staffId, status, dateStr = attDateStr()) {
  const row = { staff_id: staffId, date: dateStr, status, notes: JSON.stringify({ breakMins: 0, steps: [] }), updated_at: new Date().toISOString(), created_at: new Date().toISOString() };
  try { const { error } = await supabase.from("staff_attendance").upsert([row], { onConflict: "staff_id,date" }); if (error) throw error; return { ok: true }; }
  catch (e) { return { error: e.message }; }
}

