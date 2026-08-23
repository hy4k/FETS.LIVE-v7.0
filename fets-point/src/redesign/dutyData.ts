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

export type DutyCategoryId =
  | "admin_calendar"
  | "data_systems"
  | "cases_documentation"
  | "it_infrastructure"
  | "office_facilities"
  | "other_followup";

export interface DutyCategory {
  id: DutyCategoryId;
  name: string;
  description: string;
  iconName: string;
}

export const DUTY_CATEGORIES: DutyCategory[] = [
  { id: "admin_calendar", name: "ADMIN & CALENDAR", description: "Calendar management, daily schedules & admin follow-ups", iconName: "Calendar" },
  { id: "data_systems", name: "DATA & SYSTEMS", description: "Database updating, RMA running, DVR & system checks", iconName: "Database" },
  { id: "cases_documentation", name: "CASES & DOCUMENTATION", description: "CPR filing, Service Direct, CELPIP & case updates", iconName: "FileText" },
  { id: "it_infrastructure", name: "IT & INFRASTRUCTURE", description: "Workstations, admin system, server & network connectivity", iconName: "Server" },
  { id: "office_facilities", name: "OFFICE & FACILITIES", description: "Office supplies, equipment & general facility checks", iconName: "Building2" },
  { id: "other_followup", name: "OTHER / FOLLOW-UP", description: "Special instructions, pending issues & handover follow-ups", iconName: "AlertCircle" },
];

export interface Duty {
  id: string;
  category: DutyCategoryId;
  title: string;
  description: string | null;
  branch: string;
  scheduled_time: string | null;
  steps: { title: string }[];
  sort_order: number;
  is_active: boolean;
  priority?: "normal" | "attention";
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
  status: "pending" | "in_progress" | "done" | "missed" | "attention" | "off" | "na";
  steps_state: boolean[];
  verified_by: string | null;
  verified_at: string | null;
  note: string | null;
}

export const DEFAULT_DUTIES: Duty[] = [
  // 1. ADMIN & CALENDAR
  {
    id: "d_cal_mgmt",
    category: "admin_calendar",
    title: "Calendar Management",
    description: "Verify session schedules, client slots, start times and candidate headcount across vendors.",
    branch: "both",
    scheduled_time: "08:30",
    steps: [{ title: "Check Pearson VUE / Prometric schedule" }, { title: "Confirm appointment slots & room assignments" }, { title: "Cross-check special candidate requirements" }],
    sort_order: 10,
    is_active: true,
  },
  {
    id: "d_sched_check",
    category: "admin_calendar",
    title: "Daily Schedule & Appointment Checks",
    description: "Review today's test sessions, proctor shifts and candidate rosters.",
    branch: "both",
    scheduled_time: "09:00",
    steps: [{ title: "Verify roster attendance & check-ins" }, { title: "Review scheduled morning & afternoon batches" }],
    sort_order: 11,
    is_active: true,
  },
  {
    id: "d_admin_reminders",
    category: "admin_calendar",
    title: "Important Reminders & Administrative Follow-ups",
    description: "Track key administrative notices, deadline alerts and daily vendor announcements.",
    branch: "both",
    scheduled_time: "09:30",
    steps: [{ title: "Check center notice board & emails" }, { title: "Log vendor communication or announcements" }],
    sort_order: 12,
    is_active: true,
  },

  // 2. DATA & SYSTEMS
  {
    id: "d_db_update",
    category: "data_systems",
    title: "Database Updating",
    description: "Sync candidate attendance, test results, and check-in times to central FETS database.",
    branch: "both",
    scheduled_time: "17:00",
    steps: [{ title: "Update candidate check-in and completion records" }, { title: "Record no-shows and cancellations" }],
    sort_order: 20,
    is_active: true,
  },
  {
    id: "d_rma_running",
    category: "data_systems",
    title: "RMA Running",
    description: "Execute Remote Management Agent (RMA) procedures and vendor test engine diagnostics.",
    branch: "both",
    scheduled_time: "08:45",
    steps: [{ title: "Run RMA diagnostic tool on all proctor machines" }, { title: "Verify test delivery package status" }],
    sort_order: 21,
    is_active: true,
  },
  {
    id: "d_dvr_check",
    category: "data_systems",
    title: "DVR Check",
    description: "Inspect CCTV recording status, camera feeds in testing rooms, and DVR storage capacity.",
    branch: "both",
    scheduled_time: "08:15",
    steps: [{ title: "Verify all test room camera live feeds" }, { title: "Confirm DVR recording indicator is active" }, { title: "Ensure retention storage is within required window" }],
    sort_order: 22,
    is_active: true,
    priority: "attention",
  },
  {
    id: "d_sys_verify",
    category: "data_systems",
    title: "System-Related Verification",
    description: "Check testing software updates, browser lockdown applications, and authentication services.",
    branch: "both",
    scheduled_time: "08:30",
    steps: [{ title: "Confirm exam browser integrity" }, { title: "Verify secure socket connection to test servers" }],
    sort_order: 23,
    is_active: true,
  },

  // 3. CASES & DOCUMENTATION
  {
    id: "d_cpr_filing",
    category: "cases_documentation",
    title: "CPR Filing",
    description: "Complete and submit Candidate Problem Reports (CPR) for any technical or policy exceptions.",
    branch: "both",
    scheduled_time: "17:15",
    steps: [{ title: "Document technical disruptions with candidate IDs" }, { title: "Submit CPR via vendor portal and attach ticket ref" }],
    sort_order: 30,
    is_active: true,
  },
  {
    id: "d_serv_direct",
    category: "cases_documentation",
    title: "Service Direct Case Filing",
    description: "Log Service Direct support cases with Pearson / Prometric for workstation or facility tickets.",
    branch: "both",
    scheduled_time: "17:30",
    steps: [{ title: "Log open hardware/network tickets" }, { title: "Track pending case resolution numbers" }],
    sort_order: 31,
    is_active: true,
  },
  {
    id: "d_celpip_filing",
    category: "cases_documentation",
    title: "CELIP / Vendor Case Filing",
    description: "Upload CELPIP score sheets, candidate identification logs, and incident escalation forms.",
    branch: "both",
    scheduled_time: "17:45",
    steps: [{ title: "Verify and upload CELPIP test room audio files" }, { title: "Submit daily exam summary sheets" }],
    sort_order: 32,
    is_active: true,
  },
  {
    id: "d_doc_updates",
    category: "cases_documentation",
    title: "Document & Registry Updates",
    description: "Review physical sign-in registers, ID verification logs, and CPR audit documentation.",
    branch: "both",
    scheduled_time: "18:00",
    steps: [{ title: "File physical sign-in sheets" }, { title: "Archive day logs in center vault" }],
    sort_order: 33,
    is_active: true,
  },

  // 4. IT & INFRASTRUCTURE
  {
    id: "d_workstation_check",
    category: "it_infrastructure",
    title: "Workstation Check",
    description: "Test all candidate client terminals, monitors, keyboards, mice, and noise-cancelling headsets.",
    branch: "both",
    scheduled_time: "08:00",
    steps: [{ title: "Reboot candidate machines" }, { title: "Sanitize and test headsets & volume controls" }, { title: "Check display resolution and keyboard responsiveness" }],
    sort_order: 40,
    is_active: true,
  },
  {
    id: "d_admin_system",
    category: "it_infrastructure",
    title: "Admin System Check",
    description: "Ensure TA/Proctor admin computers, biometric scanners, and signature pads are functioning.",
    branch: "both",
    scheduled_time: "08:10",
    steps: [{ title: "Test digital camera and signature capture pad" }, { title: "Verify proctor administrative credentials" }],
    sort_order: 41,
    is_active: true,
  },
  {
    id: "d_server_check",
    category: "it_infrastructure",
    title: "Server Check",
    description: "Verify local exam server health, caching services, sync status, and storage disk space.",
    branch: "both",
    scheduled_time: "08:15",
    steps: [{ title: "Check local server sync service" }, { title: "Verify disk free space is > 50 GB" }],
    sort_order: 42,
    is_active: true,
  },
  {
    id: "d_network_conn",
    category: "it_infrastructure",
    title: "Network & Connectivity Check",
    description: "Perform speed and latency tests on primary ISP and confirm automatic secondary failover.",
    branch: "both",
    scheduled_time: "08:20",
    steps: [{ title: "Check primary fiber line latency (< 40ms)" }, { title: "Verify secondary broadband failover readiness" }],
    sort_order: 43,
    is_active: true,
  },
  {
    id: "d_infra_check",
    category: "it_infrastructure",
    title: "Infrastructure Check",
    description: "Check UPS power battery runtime, DG diesel generator levels, and air conditioning temperature.",
    branch: "both",
    scheduled_time: "08:00",
    steps: [{ title: "Check UPS battery voltage and load indicator" }, { title: "Confirm testing room temperature is 21-23°C" }],
    sort_order: 44,
    is_active: true,
    priority: "attention",
  },

  // 5. OFFICE & FACILITIES
  {
    id: "d_office_supplies",
    category: "office_facilities",
    title: "Office Supplies Check",
    description: "Stock laminated scratch paper, non-permanent markers, erasers, and tissues.",
    branch: "both",
    scheduled_time: "08:30",
    steps: [{ title: "Wipe and restock scratch booklets" }, { title: "Test erasable marker pens" }],
    sort_order: 50,
    is_active: true,
  },
  {
    id: "d_office_equip",
    category: "office_facilities",
    title: "Office Equipment & Security Check",
    description: "Check handheld metal detector wand, locker keys, and registration desk printer paper.",
    branch: "both",
    scheduled_time: "08:35",
    steps: [{ title: "Test metal detector battery" }, { title: "Check locker key count and tags" }, { title: "Confirm printer has sufficient paper and toner" }],
    sort_order: 51,
    is_active: true,
  },
  {
    id: "d_gen_facility",
    category: "office_facilities",
    title: "General Office Condition",
    description: "Ensure testing hall silence, waiting lobby cleanliness, and sanitization standards.",
    branch: "both",
    scheduled_time: "08:40",
    steps: [{ title: "Inspect candidate waiting lounge" }, { title: "Ensure test center silence signs are posted" }],
    sort_order: 52,
    is_active: true,
  },

  // 6. OTHER / FOLLOW-UP
  {
    id: "d_special_instr",
    category: "other_followup",
    title: "Special Instructions & Candidate Accommodations",
    description: "Review candidates with accommodations (extended time, separate room, reader/recorder).",
    branch: "both",
    scheduled_time: "08:50",
    steps: [{ title: "Review accommodation approvals" }, { title: "Brief assigned proctor on accommodation terms" }],
    sort_order: 60,
    is_active: true,
  },
  {
    id: "d_handover_followup",
    category: "other_followup",
    title: "Pending Issues & Handover Follow-up",
    description: "Review outstanding tasks or equipment issues passed from the previous shift.",
    branch: "both",
    scheduled_time: "09:00",
    steps: [{ title: "Inspect items flagged by closing shift" }, { title: "Confirm resolution or assign next owner" }],
    sort_order: 61,
    is_active: true,
  },
];

/* ── Duties ─────────────────────────────────────────────────────────────── */
export async function loadDuties(branch: string): Promise<Duty[]> {
  try {
    const { data, error } = await supabase
      .from("duty_master")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (!error && data && data.length > 0) {
      const filtered = ((data || []) as Duty[]).filter((d) => d.branch === "both" || d.branch === branch);
      if (filtered.length > 0) {
        // Ensure every duty has a recognized category
        return filtered.map((d, i) => {
          let cat = d.category;
          if (!cat) {
            const titleLower = (d.title || "").toLowerCase();
            if (titleLower.includes("calendar") || titleLower.includes("schedule")) cat = "admin_calendar";
            else if (titleLower.includes("database") || titleLower.includes("rma") || titleLower.includes("dvr") || titleLower.includes("system")) cat = "data_systems";
            else if (titleLower.includes("cpr") || titleLower.includes("case") || titleLower.includes("celip") || titleLower.includes("filing") || titleLower.includes("doc")) cat = "cases_documentation";
            else if (titleLower.includes("workstation") || titleLower.includes("admin") || titleLower.includes("server") || titleLower.includes("network") || titleLower.includes("infra")) cat = "it_infrastructure";
            else if (titleLower.includes("supplies") || titleLower.includes("equip") || titleLower.includes("office") || titleLower.includes("facility")) cat = "office_facilities";
            else cat = "other_followup";
          }
          return {
            ...d,
            category: cat,
            sort_order: d.sort_order || i + 1,
            steps: Array.isArray(d.steps) ? d.steps : [],
          };
        });
      }
    }
  } catch (e) {
    console.warn("loadDuties fallback to DEFAULT_DUTIES", e);
  }

  // Fallback to rich built-in default duties
  return DEFAULT_DUTIES.filter((d) => d.branch === "both" || d.branch === branch);
}

export async function saveDuty(duty: Partial<Duty> & { title: string }) {
  if (duty.id && !duty.id.startsWith("d_")) {
    const { id, ...rest } = duty as any;
    const { error } = await supabase.from("duty_master").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  } else {
    const payload = {
      ...duty,
      is_active: duty.is_active !== false,
      branch: duty.branch || "both",
      sort_order: duty.sort_order || 99,
      steps: duty.steps || [],
    };
    const { error } = await supabase.from("duty_master").insert(payload as any);
    if (error) throw error;
  }
}

export async function deleteDuty(id: string) {
  const { error } = await supabase.from("duty_master").delete().eq("id", id);
  if (error) throw error;
}

/* ── Staff pools (Always include Naima MM, NIMMY M, Shimna in Cochin) ──── */
export async function loadBranchStaff(branch: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("staff_profiles")
      .select("full_name, branch_assigned, is_active, permissions")
      .eq("is_active", true)
      .order("full_name");
    if (!error && data && data.length > 0) {
      const bLower = branch.toLowerCase();
      const names = data
        .filter((p: any) => p.full_name && isStaffRosterVisible(p) && String(p.branch_assigned || "").toLowerCase().includes(bLower))
        .map((p: any) => p.full_name as string);
      
      // Explicitly ensure Cochin default staff are present
      if (bLower.includes("cochin")) {
        ["Naima MM", "NIMMY M", "Shimna"].forEach(n => {
          if (!names.includes(n)) names.push(n);
        });
      }
      if (bLower.includes("calicut")) {
        ["Aysha", "Lazeem", "Nilufer", "Anshitha K"].forEach(n => {
          if (!names.includes(n)) names.push(n);
        });
      }

      if (names.length) return (Array.from(new Set(names)) as string[]).sort((a: string, b: string) => a.localeCompare(b));
    }
  } catch (e) {
    console.warn("loadBranchStaff query error:", e);
  }

  return branch.toLowerCase().includes("cochin")
    ? ["Naima MM", "NIMMY M", "Shimna"]
    : ["Anshitha K", "Aysha", "Bindu Rajan", "Lazeem", "Nilufer"];
}

/** Staff actually working a given date at a branch (roster-based, falls back to full pool) */
export async function loadPresentStaff(date: string, branch: string): Promise<string[]> {
  try {
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
  } catch (e) {
    console.warn("loadPresentStaff query error:", e);
  }

  return loadBranchStaff(branch);
}

/* ── Weekly rotation ────────────────────────────────────────────────────── */
export async function ensureWeekAssignments(weekStart: string, branch: string) {
  const [duties, staff] = await Promise.all([
    loadDuties(branch),
    loadBranchStaff(branch),
  ]);

  let existing: DutyAssignment[] = [];
  try {
    const existingRes = await supabase.from("duty_assignments").select("*").eq("week_start", weekStart).eq("branch", branch);
    existing = (existingRes.data || []) as DutyAssignment[];
  } catch (e) {}

  if (!staff.length || !duties.length) return { duties, staff, assignments: existing };

  const offset = weeksSinceEpoch(weekStart);
  const missing = duties.filter((d) => !existing.some((a) => a.duty_id === d.id));
  
  if (missing.length) {
    const rows = missing.map((d) => {
      const dutyIdx = duties.findIndex((x) => x.id === d.id);
      const idx = (((dutyIdx + offset) % staff.length) + staff.length) % staff.length;
      return { week_start: weekStart, branch, duty_id: d.id, staff_name: staff[idx], is_override: false, id: `${weekStart}_${d.id}` };
    });
    
    try {
      const { data } = await supabase.from("duty_assignments").insert(rows.map(({ id, ...r }) => r)).select();
      if (data) {
        return { duties, staff, assignments: [...existing, ...((data || []) as DutyAssignment[])] };
      }
    } catch (e) {}

    return { duties, staff, assignments: [...existing, ...(rows as any as DutyAssignment[])] };
  }
  
  return { duties, staff, assignments: existing };
}

export async function setAssignment(weekStart: string, branch: string, dutyId: string, staffName: string) {
  try {
    const { data: row } = await supabase
      .from("duty_assignments").select("id")
      .eq("week_start", weekStart).eq("branch", branch).eq("duty_id", dutyId).maybeSingle();
    if (row) {
      await supabase.from("duty_assignments")
        .update({ staff_name: staffName, is_override: true, updated_at: new Date().toISOString() }).eq("id", row.id);
    } else {
      await supabase.from("duty_assignments")
        .insert({ week_start: weekStart, branch, duty_id: dutyId, staff_name: staffName, is_override: true });
    }
  } catch (e) {
    console.warn("setAssignment DB update error (handled gracefully)", e);
  }
}

/* ── Daily lead (reuses handover_assignments → roster gold border stays in sync) ── */
export async function getDayLead(date: string, branch: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("handover_assignments").select("staff_names").eq("date", date).eq("branch", branch).maybeSingle();
    const names = (data?.staff_names || []) as string[];
    return names[0] || null;
  } catch {
    return null;
  }
}

export async function ensureDayLead(date: string, branch: string, presentStaff: string[]) {
  const existing = await getDayLead(date, branch);
  if (existing) return { lead: existing, auto: false };
  if (!presentStaff.length) return { lead: null as string | null, auto: false };
  const dayIdx = Math.floor(new Date(date + "T00:00:00").getTime() / 86400000);
  const lead = presentStaff[dayIdx % presentStaff.length];
  try {
    const { data: row } = await supabase
      .from("handover_assignments").select("id").eq("date", date).eq("branch", branch).maybeSingle();
    if (row) {
      await supabase.from("handover_assignments").update({ staff_names: [lead] }).eq("id", row.id);
    } else {
      await supabase.from("handover_assignments").insert({ date, branch, staff_names: [lead] });
    }
  } catch {}
  return { lead, auto: true };
}

export async function setDayLead(date: string, branch: string, staffName: string) {
  try {
    const { data: row } = await supabase
      .from("handover_assignments").select("id").eq("date", date).eq("branch", branch).maybeSingle();
    if (row) {
      await supabase.from("handover_assignments").update({ staff_names: [staffName] }).eq("id", row.id);
    } else {
      await supabase.from("handover_assignments").insert({ date, branch, staff_names: [staffName] });
    }
  } catch (e) {
    console.warn("setDayLead error:", e);
  }
}

/* ── Daily log ──────────────────────────────────────────────────────────── */
export async function ensureDailyLog(date: string, branch: string, weekStart: string): Promise<DutyLog[]> {
  const { duties, assignments } = await ensureWeekAssignments(weekStart, branch);
  let existing: DutyLog[] = [];
  try {
    const { data } = await supabase.from("duty_daily_log").select("*").eq("date", date).eq("branch", branch);
    existing = (data || []) as DutyLog[];
  } catch (e) {}

  const missing = duties.filter((d) => !existing.some((l) => l.duty_id === d.id));
  if (missing.length) {
    const rows = missing.map((d) => {
      const a = assignments.find((x) => x.duty_id === d.id);
      const stepCount = Array.isArray(d.steps) ? d.steps.length : 0;
      return {
        id: `${date}_${d.id}`,
        date, branch, duty_id: d.id,
        staff_name: a?.staff_name || "Unassigned",
        original_staff_name: null,
        status: "pending" as const,
        steps_state: Array(stepCount).fill(false),
        verified_by: null,
        verified_at: null,
        note: null,
      };
    });
    try {
      const { data } = await supabase.from("duty_daily_log").insert(rows.map(({ id, ...r }) => r)).select();
      if (data) {
        return [...existing, ...((data || []) as DutyLog[])];
      }
    } catch {}
    return [...existing, ...(rows as any as DutyLog[])];
  }
  return existing;
}

export async function updateLogSteps(logId: string, stepsState: boolean[], actorName: string) {
  const allDone = stepsState.length > 0 && stepsState.every(Boolean);
  const patch: any = {
    steps_state: stepsState,
    updated_at: new Date().toISOString(),
    status: allDone ? "done" : "in_progress",
  };
  if (allDone) { patch.verified_by = actorName; patch.verified_at = new Date().toISOString(); }
  try {
    await supabase.from("duty_daily_log").update(patch).eq("id", logId);
  } catch (e) {
    console.warn("updateLogSteps DB sync note:", e);
  }
}

export async function setLogStatus(logId: string, status: DutyLog["status"], actorName: string, note?: string) {
  const patch: any = { status, updated_at: new Date().toISOString() };
  if (status === "done") { patch.verified_by = actorName; patch.verified_at = new Date().toISOString(); }
  if (note !== undefined) patch.note = note;
  try {
    await supabase.from("duty_daily_log").update(patch).eq("id", logId);
  } catch (e) {
    console.warn("setLogStatus DB sync note:", e);
  }
}

export async function reassignLog(logId: string, newStaff: string, actorName: string) {
  try {
    const { data: log } = await supabase.from("duty_daily_log").select("staff_name, original_staff_name").eq("id", logId).single();
    const patch: any = {
      staff_name: newStaff,
      original_staff_name: log?.original_staff_name || log?.staff_name || null,
      status: "pending",
      steps_state: [],
      verified_by: actorName,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("duty_daily_log").update(patch).eq("id", logId);
  } catch (e) {
    console.warn("reassignLog DB sync note:", e);
  }
}

/* ── Report data ────────────────────────────────────────────────────────── */
export async function loadLogRange(start: string, end: string, branch: string): Promise<DutyLog[]> {
  try {
    const { data, error } = await supabase
      .from("duty_daily_log").select("*")
      .eq("branch", branch).gte("date", start).lte("date", end)
      .order("date").order("duty_id");
    if (!error && data) return data as DutyLog[];
  } catch {}
  return [];
}
