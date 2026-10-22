import type { PrivateReport, NewReport, ReportEdits } from "./private-reports";
import { monday } from "../redesign/shift-plan";
import { supabase } from "../lib/supabase";
import type {
  Snapshot,
  Schedule,
  ShiftType,
  Change,
  Attendance,
} from "./model";
import { monthDays } from "./model";
const db = supabase as any;
const checked = (r: any) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
// Paginate instead of silently truncating a busy month's attendance at API limits.
async function allRows(make: () => any) {
  const rows: any[] = [];
  for (let start = 0; ; start += 500) {
    const batch = checked(await make().range(start, start + 499)) || [];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
function syncCache(changes: Change[]) {
  const f = (window as any).FETS;
  if (!f) return;
  for (const c of changes) {
    const name = Object.keys(f._staffIdByName || {}).find(
      (n) => f._staffIdByName[n] === c.profile_id,
    );
    if (!name) continue;
    const d = new Date(c.date + "T00:00:00"),
      off = f.offsetOf(d),
      key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    f._dbRoster ||= {};
    f._dbRoster[name] ||= {};
    if (c.value)
      f._dbRoster[name][off] = {
        ...c.value,
        code: c.value.shift_code,
        ot: c.value.overtime_hours,
      };
    else delete f._dbRoster[name][off];
    f._liveRoster ||= {};
    f._liveRoster[key] ||= { calicut: [], cochin: [] };
    for (const centre of ["calicut", "cochin"])
      f._liveRoster[key][centre] = (f._liveRoster[key][centre] || []).filter(
        (n: string) => n !== name,
      );
    if (c.value && ["D", "E", "HD", "OT"].includes(c.value.shift_code))
      f._liveRoster[key][c.branch_location].push(name);
    (window as any).__fetsLoadedMonths?.delete(
      `${d.getFullYear()}-${d.getMonth()}`,
    );
  }
}
export const rosterRepository = {
  async reports(): Promise<PrivateReport[]> {
    return allRows(() =>
      db
        .from("roster_attendance_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id"),
    );
  },
  async createReport(value: NewReport): Promise<PrivateReport> {
    return checked(
      await db
        .from("roster_attendance_reports")
        .insert(value)
        .select()
        .single(),
    );
  },
  async updateReport(
    id: string,
    version: number,
    edits: ReportEdits,
    share = false,
  ): Promise<PrivateReport> {
    const rows = checked(
      await db
        .from("roster_attendance_reports")
        .update({ ...edits, status: share ? "shared" : "draft" })
        .eq("id", id)
        .eq("version", version)
        .eq("status", "draft")
        .select(),
    );
    if (!rows?.length)
      throw Error(
        "This report changed elsewhere or is already shared. Reopen it from Reports before continuing.",
      );
    return rows[0];
  },
  async load(month: string): Promise<Snapshot> {
    const days = monthDays(month);
    const [people, schedules, attendance, types] = await Promise.all([
      allRows(() =>
        db
          .from("staff_profiles")
          .select("id,user_id,full_name,branch_assigned,is_active,permissions")
          .order("id"),
      ),
      allRows(() =>
        db
          .from("roster_schedules")
          .select("*")
          .gte("date", days[0])
          .lte("date", days[days.length - 1])
          .order("id"),
      ),
      allRows(() =>
        db
          .from("staff_attendance")
          .select("*")
          .gte("date", days[0])
          .lte("date", days[days.length - 1])
          .order("id"),
      ),
      allRows(() =>
        db
          .from("roster_shift_types")
          .select("*")
          .eq("archived", false)
          .order("id"),
      ),
    ]);
    // Lead availability must not prevent staff from seeing the roster.
    try {
      const [leadWeeks, leadPlans] = await Promise.all([
        allRows(() =>
          db
            .from("centre_lead_weeks")
            .select("*")
            .gte("week_start", monday(days[0]))
            .lte("week_start", days[days.length - 1])
            .order("branch")
            .order("week_start"),
        ),
        allRows(() =>
          db
            .from("centre_day_plans")
            .select("*")
            .gte("day", days[0])
            .lte("day", days[days.length - 1])
            .order("id"),
        ),
      ]);
      const leadChanges = leadPlans.length
        ? await allRows(() =>
            db
              .from("centre_duty_changes")
              .select("*")
              .in(
                "plan_id",
                leadPlans.map((p) => p.id),
              )
              .eq("kind", "lead")
              .order("created_at")
              .order("id"),
          )
        : [];
      return {
        people,
        schedules,
        attendance,
        types,
        leadWeeks,
        leadPlans,
        leadChanges,
      };
    } catch {
      return {
        people,
        schedules,
        attendance,
        types,
        leadError:
          "Lead assignments could not be loaded. Refresh to try again.",
      };
    }
  },
  async range(
    profileId: string,
    from: string,
    to: string,
  ): Promise<Schedule[]> {
    return allRows(() =>
      db
        .from("roster_schedules")
        .select("*")
        .eq("profile_id", profileId)
        .gte("date", from)
        .lte("date", to)
        .order("id"),
    );
  },
  async save(changes: Change[]) {
    const count = checked(
      await db.rpc("roster_save_batch", { p_changes: changes }),
    ) as number;
    syncCache(changes);
    return count;
  },
  async createType(
    value: Omit<ShiftType, "id" | "archived">,
  ): Promise<ShiftType> {
    return checked(
      await db.from("roster_shift_types").insert(value).select().single(),
    );
  },
  async archiveType(id: string) {
    const rows = checked(
      await db
        .from("roster_shift_types")
        .update({ archived: true })
        .eq("id", id)
        .select("id"),
    );
    if (!rows?.length) throw Error("The shift type could not be archived.");
  },
  async attendance(
    action: "in" | "out" | "break" | "back",
  ): Promise<Attendance> {
    return checked(
      await db.rpc("roster_attendance_action", { p_action: action }),
    );
  },
};
export type RosterRepository = typeof rosterRepository;
