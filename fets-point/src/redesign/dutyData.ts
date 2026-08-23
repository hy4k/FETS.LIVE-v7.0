/* ═══════════════════════════════════════════════════════════════════════════
   Duty data layer — 6-day consecutive rotation engine, dynamic roster connection,
   characteristic inputs, lead verification, and security audit logs.
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

export type CharacteristicType =
  | "rma_time"
  | "temperature"
  | "dvr_check"
  | "workstation_count"
  | "admin_system"
  | "server_check"
  | "network_conn"
  | "ticket_refs"
  | "supplies"
  | "general";

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
  characteristic_type?: CharacteristicType;
  characteristic_label?: string;
  characteristic_placeholder?: string;
}

export interface DutyAssignment {
  id: string;
  week_start: string;
  branch: string;
  duty_id: string;
  category_id?: DutyCategoryId;
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
  status: "pending" | "submitted" | "in_progress" | "done" | "missed" | "attention" | "off" | "na";
  steps_state: boolean[];
  recorded_time?: string | null;
  recorded_val?: string | null;
  note?: string | null;
  submitted_by?: string | null;
  submitted_at?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  lead_comments?: string | null;
}

export interface SecurityAuditEntry {
  id: string;
  timestamp: string;
  actor_name: string;
  action: string;
  branch: string;
  duty_title?: string;
  session_id: string;
  user_agent: string;
  device_type: string;
  ip_address?: string;
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
    characteristic_type: "general",
    characteristic_label: "Total Candidates & Morning Slots",
    characteristic_placeholder: "e.g. 24 candidates across 4 sessions",
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
    characteristic_type: "general",
    characteristic_label: "Roster Check & Shifts Verified",
    characteristic_placeholder: "e.g. All 3 proctors checked in, morning batch on time",
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
    characteristic_type: "general",
    characteristic_label: "Admin Notices / Updates",
    characteristic_placeholder: "e.g. Pearson advisory notice #104 acknowledged",
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
    characteristic_type: "general",
    characteristic_label: "Sync Completion Time & Records Count",
    characteristic_placeholder: "e.g. 24 candidate records synced, 1 no-show",
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
    characteristic_type: "rma_time",
    characteristic_label: "RMA Run Timestamp & Test Engine Status",
    characteristic_placeholder: "e.g. 08:45 AM · All test packages updated successfully",
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
    characteristic_type: "dvr_check",
    characteristic_label: "CCTV Feeds Status & Storage Retention",
    characteristic_placeholder: "e.g. All 8 cameras active, 45 days retention space OK",
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
    characteristic_type: "general",
    characteristic_label: "Lockdown Browser & Security Status",
    characteristic_placeholder: "e.g. Secure browser v7.4 verified on all stations",
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
    characteristic_type: "ticket_refs",
    characteristic_label: "CPR Reference Numbers & Candidate IDs",
    characteristic_placeholder: "e.g. CPR-9921 (Cand #1084 - Display flicker resolved)",
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
    characteristic_type: "ticket_refs",
    characteristic_label: "Service Direct Ticket Numbers",
    characteristic_placeholder: "e.g. SD-884102 (Headset port replaced on Station 4)",
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
    characteristic_type: "ticket_refs",
    characteristic_label: "Upload Batch IDs & Summary Sheet",
    characteristic_placeholder: "e.g. Batch CEL-0824 audio files uploaded and verified",
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
    characteristic_type: "general",
    characteristic_label: "Sign-in Registers & Vault Filing",
    characteristic_placeholder: "e.g. 24 ID forms filed and locked in center vault",
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
    characteristic_type: "workstation_count",
    characteristic_label: "Tested Terminals & Headset Count",
    characteristic_placeholder: "e.g. All 18 terminals & headsets tested OK",
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
    characteristic_type: "admin_system",
    characteristic_label: "Biometric Scanners & Camera Test",
    characteristic_placeholder: "e.g. Signature pad, biometric scanner & camera OK",
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
    characteristic_type: "server_check",
    characteristic_label: "Server Health & Free Disk Space",
    characteristic_placeholder: "e.g. Primary server active, 84 GB free space",
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
    characteristic_type: "network_conn",
    characteristic_label: "Fiber Latency (ms) & Secondary Failover",
    characteristic_placeholder: "e.g. 14ms latency, secondary failover active",
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
    characteristic_type: "temperature",
    characteristic_label: "Room Temperature (°C) & UPS Backup",
    characteristic_placeholder: "e.g. 21.8°C room temp, UPS 100% charged, DG ready",
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
    characteristic_type: "supplies",
    characteristic_label: "Scratch Booklets & Marker Inventory",
    characteristic_placeholder: "e.g. 30 scratch booklets sanitized, 25 markers working",
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
    characteristic_type: "general",
    characteristic_label: "Metal Detector & Locker Keys Status",
    characteristic_placeholder: "e.g. Wand battery 100%, 20 locker keys accounted for",
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
    characteristic_type: "general",
    characteristic_label: "Lobby & Testing Hall Sanitization",
    characteristic_placeholder: "e.g. Testing hall sanitized, silence signs verified",
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
    characteristic_type: "general",
    characteristic_label: "Special Accommodations / Candidate Notes",
    characteristic_placeholder: "e.g. 1 candidate with extended time (Station 12)",
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
    characteristic_type: "general",
    characteristic_label: "Follow-up Resolution Notes",
    characteristic_placeholder: "e.g. Station 4 keyboard swapped and re-tested OK",
  },
];

/* ── Duties CRUD (Create & Edit by everyone, Delete only by Super Admin) ─ */
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
            characteristic_type: d.characteristic_type || "general",
          };
        });
      }
    }
  } catch (e) {
    console.warn("loadDuties fallback to DEFAULT_DUTIES", e);
  }

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
      characteristic_type: duty.characteristic_type || "general",
    };
    const { error } = await supabase.from("duty_master").insert(payload as any);
    if (error) throw error;
  }
}

export async function deleteDuty(id: string) {
  const { error } = await supabase.from("duty_master").delete().eq("id", id);
  if (error) throw error;
}

/* ── Staff pools (Always includes Naima MM, NIMMY M, Shimna in Cochin) ─── */
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
      
      if (bLower.includes("cochin")) {
        ["Naima MM", "NIMMY M", "Shimna"].forEach((n) => {
          if (!names.includes(n)) names.push(n);
        });
      }
      if (bLower.includes("calicut")) {
        ["Aysha", "Lazeem", "Nilufer", "Anshitha K"].forEach((n) => {
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

/** Staff actually working a given date at a branch (roster-based, excluding rest codes) */
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

/* ── 6-Day Consecutive Rotation Engine (Tied to Roster Rest Days) ────────── */
/**
 * Maps categories & duties to staff for a 6-day consecutive working stretch.
 * Main categories: ADMIN & CALENDAR, DATA & SYSTEMS, CASES & DOCUMENTATION,
 * IT & INFRASTRUCTURE, OFFICE & FACILITIES, OTHER / FOLLOW-UP.
 * Multiple categories are assigned to staff if staff count < category count.
 */
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

  const weekOffset = weeksSinceEpoch(weekStart);
  const categories = DUTY_CATEGORIES.map((c) => c.id);

  // Determine category-to-staff mapping for this 6-day block
  const catStaffMap: Record<DutyCategoryId, string> = {} as any;
  categories.forEach((catId, idx) => {
    const staffIdx = (((idx + weekOffset) % staff.length) + staff.length) % staff.length;
    catStaffMap[catId] = staff[staffIdx];
  });

  const missing = duties.filter((d) => !existing.some((a) => a.duty_id === d.id));

  if (missing.length) {
    const rows = missing.map((d) => {
      const assignedPerson = catStaffMap[d.category] || staff[0];
      return {
        week_start: weekStart,
        branch,
        duty_id: d.id,
        category_id: d.category,
        staff_name: assignedPerson,
        is_override: false,
        id: `${weekStart}_${d.id}`,
      };
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

/* ── 6-Day Consecutive Lead Resolver (Tied to Roster & Rest Days) ────────── */
export async function getDayLead(date: string, branch: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("handover_assignments").select("staff_names").eq("date", date).eq("branch", branch).maybeSingle();
    const names = (data?.staff_names || []) as string[];
    if (names[0]) return names[0];
  } catch {}
  return null;
}

/**
 * Ensures the 6-day stretch Lead is resolved based on the roster.
 * If the primary assigned 6-day lead is on leave / rest day today,
 * the lead role automatically falls back to the next available present staff member.
 */
export async function ensureDayLead(date: string, branch: string, presentStaff: string[]) {
  const existing = await getDayLead(date, branch);
  if (existing && presentStaff.includes(existing)) {
    return { lead: existing, auto: false };
  }

  if (!presentStaff.length) return { lead: null, auto: false };

  // Calculate 6-day anchor lead
  const allStaff = await loadBranchStaff(branch);
  const weekStart = weekStartOf(new Date(date + "T00:00:00"));
  const weekOffset = weeksSinceEpoch(weekStart);
  const primaryLead = allStaff.length ? allStaff[weekOffset % allStaff.length] : presentStaff[0];

  // If primary lead is present today, use them; otherwise fallback to next present staff
  const lead = presentStaff.includes(primaryLead) ? primaryLead : presentStaff[0];

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

/* ── Daily Log with Roster Connection & Reassignment Fallback ────────────── */
export async function ensureDailyLog(date: string, branch: string, weekStart: string): Promise<DutyLog[]> {
  const [{ duties, assignments }, presentStaff] = await Promise.all([
    ensureWeekAssignments(weekStart, branch),
    loadPresentStaff(date, branch),
  ]);

  let existing: DutyLog[] = [];
  try {
    const { data } = await supabase.from("duty_daily_log").select("*").eq("date", date).eq("branch", branch);
    existing = (data || []) as DutyLog[];
  } catch (e) {}

  const missing = duties.filter((d) => !existing.some((l) => l.duty_id === d.id));

  if (missing.length) {
    const rows = missing.map((d) => {
      const a = assignments.find((x) => x.duty_id === d.id);
      const assignedPerson = a?.staff_name || "Unassigned";
      
      // Dynamic Roster Check: If assigned staff is on leave / RD today, reassign to next available working staff
      let actualOwner = assignedPerson;
      let originalOwner: string | null = null;

      if (!presentStaff.includes(assignedPerson) && presentStaff.length > 0) {
        // Fallback round-robin from present staff
        const dutyIdx = duties.findIndex((x) => x.id === d.id);
        actualOwner = presentStaff[dutyIdx % presentStaff.length];
        originalOwner = assignedPerson;
      }

      const stepCount = Array.isArray(d.steps) ? d.steps.length : 0;
      return {
        id: `${date}_${d.id}`,
        date,
        branch,
        duty_id: d.id,
        staff_name: actualOwner,
        original_staff_name: originalOwner,
        status: "pending" as const,
        steps_state: Array(stepCount).fill(false),
        recorded_time: null,
        recorded_val: null,
        note: null,
        submitted_by: null,
        submitted_at: null,
        verified_by: null,
        verified_at: null,
        lead_comments: null,
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

/* ── Staff Task Data Submission ─────────────────────────────────────────── */
export async function submitStaffDutyData(
  logId: string,
  payload: {
    recorded_time?: string | null;
    recorded_val?: string | null;
    note?: string | null;
    steps_state?: boolean[];
  },
  actorName: string
) {
  const patch: any = {
    ...payload,
    submitted_by: actorName,
    submitted_at: new Date().toISOString(),
    status: "submitted",
    updated_at: new Date().toISOString(),
  };

  try {
    await supabase.from("duty_daily_log").update(patch).eq("id", logId);
  } catch (e) {
    console.warn("submitStaffDutyData DB sync note:", e);
  }
}

/* ── Lead Verification & Checklist Ticking ──────────────────────────────── */
export async function verifyDutyByLead(
  logId: string,
  actorName: string,
  status: "done" | "attention" | "missed" | "pending" = "done",
  leadComments?: string
) {
  const patch: any = {
    status,
    verified_by: actorName,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (leadComments !== undefined) {
    patch.lead_comments = leadComments;
  }

  try {
    await supabase.from("duty_daily_log").update(patch).eq("id", logId);
  } catch (e) {
    console.warn("verifyDutyByLead DB sync note:", e);
  }
}

export async function updateLogSteps(logId: string, stepsState: boolean[], actorName: string) {
  const allDone = stepsState.length > 0 && stepsState.every(Boolean);
  const patch: any = {
    steps_state: stepsState,
    updated_at: new Date().toISOString(),
  };
  if (allDone) {
    patch.status = "submitted";
    patch.submitted_by = actorName;
    patch.submitted_at = new Date().toISOString();
  }
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
      verified_by: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("duty_daily_log").update(patch).eq("id", logId);
  } catch (e) {
    console.warn("reassignLog DB sync note:", e);
  }
}

/* ── Security Audit Trail (Detect Lead Account Sharing / Misuse) ─────────── */
const AUDIT_STORAGE_KEY = "fets_duty_security_audits";

function getBrowserFingerprint(): string {
  const screen = `${window.screen.width}x${window.screen.height}`;
  const lang = navigator.language || "en";
  const platform = navigator.platform || "unknown";
  return `${platform}_${screen}_${lang}`;
}

export async function logSecurityAudit(
  action: string,
  branch: string,
  actorName: string,
  dutyTitle?: string
): Promise<SecurityAuditEntry> {
  const entry: SecurityAuditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actor_name: actorName,
    action,
    branch,
    duty_title: dutyTitle,
    session_id: sessionStorage.getItem("fets_session_id") || (sessionStorage.setItem("fets_session_id", Math.random().toString(36).slice(2)), sessionStorage.getItem("fets_session_id")!),
    user_agent: navigator.userAgent.slice(0, 120),
    device_type: getBrowserFingerprint(),
  };

  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    const list: SecurityAuditEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {}

  return entry;
}

export function getSecurityAuditLogs(branch?: string): SecurityAuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    const list: SecurityAuditEntry[] = raw ? JSON.parse(raw) : [];
    if (branch && branch !== "global") {
      return list.filter((e) => e.branch === branch);
    }
    return list;
  } catch {
    return [];
  }
}

/* ── Cross-Center Report Data ────────────────────────────────────────────── */
export async function loadLogRange(start: string, end: string, branch: string): Promise<DutyLog[]> {
  try {
    let query = supabase
      .from("duty_daily_log").select("*")
      .gte("date", start).lte("date", end)
      .order("date").order("duty_id");
    if (branch && branch !== "global") {
      query = query.eq("branch", branch);
    }
    const { data, error } = await query;
    if (!error && data) return data as DutyLog[];
  } catch {}
  return [];
}
