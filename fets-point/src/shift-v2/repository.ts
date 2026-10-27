import { supabase } from "../lib/supabase";
import { effectiveShift } from "../roster-workspace/model";
import { isStaffRosterVisible } from "../utils/rosterVisibility";
import {
  minute,
  type Person,
  type Day,
  type Plan,
  type WorkEvent,
  type Checks,
} from "./model";
const db = supabase as any;
const checked = (r: any) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
export const repository = {
  async context(branch: string, day: string) {
    const [members, schedules, sessions, staff] = await Promise.all([
      db.from("centre_duty_members").select("*"),
      db
        .from("roster_schedules")
        .select(
          "*,staff_profiles(id,user_id,full_name,is_active,branch_assigned,permissions)",
        )
        .eq("date", day),
      db
        .from("calendar_sessions")
        .select("*")
        .eq("date", day)
        .order("start_time"),
      db
        .from("staff_profiles")
        .select("id,full_name,branch_assigned,is_active,permissions")
        .order("full_name"),
    ]);
    const directory = checked(members) || [];
    const rows = checked(schedules) || [];
    const people: Person[] = [];
    for (const r of rows) {
      const p = r.staff_profiles;
      if (
        !p ||
        p.is_active === false ||
        !isStaffRosterVisible(p, day.slice(0, 7)) ||
        String(r.branch_location || p.branch_assigned || "").toLowerCase() !==
          branch ||
        [
          "RD",
          "OFF",
          "WO",
          "L",
          "LEAVE",
          "LV",
          "H",
          "HOLIDAY",
          "TO",
          "TOIL",
          "TR",
          "TP",
          "T",
          "PH",
          "TRD",
        ].includes(String(r.shift_code).toUpperCase()) ||
        !r.shift_code
      )
        continue;
      const timing = effectiveShift(r);
      people.push({
        id: p.id,
        name: p.permissions?.shift_display_name || p.full_name,
        start: timing.shift_start ? minute(timing.shift_start) : NaN,
        end: timing.shift_end ? minute(timing.shift_end) : NaN,
      });
    }
    return {
      directory,
      supportPeople: (checked(staff) || [])
        .filter(
          (p: any) =>
            p.is_active !== false &&
            [branch, "global", "all"].includes(p.branch_assigned),
        )
        .map((p: any) => ({
          id: p.id,
          name: p.permissions?.shift_display_name || p.full_name,
        })),
      people: people.sort((a, b) => a.name.localeCompare(b.name)),
      sessions:
        checked(sessions)?.filter(
          (s: any) =>
            (s.branch_location || "calicut") === branch &&
            !["cancelled", "canceled"].includes(s.status),
        ) || [],
    };
  },
  async load(branch: string, day: string) {
    const record = checked(
      await db
        .from("shift_days_v2")
        .select("*")
        .eq("branch", branch)
        .eq("day", day)
        .maybeSingle(),
    ) as Day | null;
    let events: WorkEvent[] = [];
    if (record)
      events =
        checked(
          await db
            .from("shift_work_events_v2")
            .select("*")
            .eq("day_id", record.id)
            .order("created_at")
            .order("id"),
        ) || [];
    return { record, events };
  },
  async save(
    branch: string,
    day: string,
    leadId: string | null,
    plan: Plan,
    prior: Day | null,
    publish = false,
    reason = "",
  ) {
    const value = {
      branch,
      day,
      lead_id: leadId || null,
      plan,
      status: publish ? "published" : prior?.status || "draft",
      change_reason: reason,
    };
    const q = prior
      ? db
          .from("shift_days_v2")
          .update(value)
          .eq("id", prior.id)
          .eq("version", prior.version)
      : db.from("shift_days_v2").insert(value);
    const rows = checked(await q.select());
    if (!rows?.[0])
      throw Error("This plan changed on another screen. Reload before saving.");
    return rows[0] as Day;
  },
  async event(
    dayId: string,
    blockId: string | null,
    taskId: string,
    kind: WorkEvent["kind"],
    note = "",
  ) {
    return checked(
      await db
        .from("shift_work_events_v2")
        .insert({
          day_id: dayId,
          block_id: blockId,
          task_id: taskId,
          kind,
          note,
        })
        .select()
        .single(),
    );
  },
  async checks(branch: string, day: string): Promise<Checks> {
    return checked(
      await db.rpc("fets_shift_check_snapshot_v2", {
        p_branch: branch,
        p_day: day,
      }),
    );
  },
  async recordCheck(
    planId: string,
    block: number,
    kind: "walk" | "dvr",
    due: number,
    note: string,
  ) {
    return checked(
      await db.rpc("fets_shift_record_check_v2", {
        p_plan: planId,
        p_block: block,
        p_kind: kind,
        p_due: due,
        p_note: note,
      }),
    );
  },
  async close(dayId: string, version: number, report: string) {
    return checked(
      await db
        .from("shift_days_v2")
        .update({ status: "closed", report, change_reason: "Close shift" })
        .eq("id", dayId)
        .eq("version", version)
        .select()
        .single(),
    );
  },
  async prior(branch: string, day: string) {
    return checked(
      await db
        .from("shift_days_v2")
        .select("*")
        .eq("branch", branch)
        .eq("day", day)
        .maybeSingle(),
    ) as Day | null;
  },
};
export type Repository = typeof repository;
