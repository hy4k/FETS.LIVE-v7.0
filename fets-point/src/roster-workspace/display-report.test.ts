import { describe, expect, it } from "vitest";
import { rosterLegend, rosterLead } from "./display";
import { attendanceReport } from "./report";
import {
  attendanceMetrics,
  plainShift,
  type Schedule,
  type Snapshot,
  type Attendance,
} from "./model";
const now = new Date("2026-10-20T12:00:00+05:30");
const schedule = (v: Partial<Schedule> = {}): Schedule => ({
  ...plainShift(),
  id: "s",
  profile_id: "p",
  date: "2026-10-19",
  branch_location: "calicut",
  version: 1,
  overtime_hours: 0,
  ...v,
});
const attendance = (v: Partial<Attendance> = {}): Attendance => ({
  id: "a",
  staff_id: "p",
  date: "2026-10-19",
  check_in: "06:00",
  check_out: "15:00",
  status: "present",
  notes: null,
  branch_location: "calicut",
  ...v,
});
const data = (): Snapshot => ({
  people: [{ id: "p", full_name: "Sample Staff", branch_assigned: "calicut" }],
  types: [],
  schedules: [],
  attendance: [],
});
describe("compact roster", () => {
  it("keeps standard codes and gives different custom timing variants stable short codes", () => {
    const early = schedule({ shift_start: "06:00:00", shift_end: "15:00:00" }),
      late = schedule({ shift_start: "11:30", shift_end: "20:30" });
    const a = rosterLegend([early, plainShift(), late, plainShift("RD")]);
    const b = rosterLegend([late, early, plainShift("RD"), plainShift()]);
    expect(a.code(plainShift())).toBe("D");
    expect(a.code(early)).toBe("D1");
    expect(a.code(late)).toBe("D2");
    expect(a.legend).toEqual(b.legend);
    expect(a.code(plainShift("RD"))).toBe("RD");
  });
  it("does not multiply codes for cosmetic shift labels, but distinguishes grace", () => {
    const a = schedule(),
      b = schedule({ shift_label: "Normal" }),
      c = schedule({ grace_minutes: 5 });
    const l = rosterLegend([a, b, c]);
    expect(l.legend).toHaveLength(2);
    expect(l.code(a)).toBe(l.code(b));
    expect(l.code(c)).not.toBe(l.code(a));
  });
  it("uses a week beginning in the previous month and keeps centres separate", () => {
    const d = data();
    d.leadWeeks = [
      { branch: "calicut", week_start: "2026-09-28", lead_id: "p" },
      { branch: "cochin", week_start: "2026-09-28", lead_id: "other" },
    ];
    expect(rosterLead(d, "calicut", "2026-10-01", now)).toBe("p");
    expect(rosterLead(d, "cochin", "2026-10-01", now)).toBe("other");
  });
  it("matches The Shift priority and the current acting-lead changeover", () => {
    const d = data();
    d.leadWeeks = [
      { branch: "calicut", week_start: "2026-10-19", lead_id: "weekly" },
    ];
    d.leadPlans = [
      {
        id: "plan",
        day: "2026-10-20",
        branch: "calicut",
        lead_id: "planlead",
        plan: { actingLead: "acting" },
        status: "published",
        version: 1,
      } as any,
    ];
    d.leadChanges = [
      {
        id: "c",
        plan_id: "plan",
        kind: "lead",
        staff_id: "replacement",
        starts: 750,
      } as any,
    ];
    expect(rosterLead(d, "calicut", "2026-10-20", now)).toBe("acting");
    expect(
      rosterLead(
        d,
        "calicut",
        "2026-10-20",
        new Date("2026-10-20T12:30:00+05:30"),
      ),
    ).toBe("replacement");
    expect(
      rosterLead(
        d,
        "calicut",
        "2026-10-20",
        new Date("2026-10-21T09:00:00+05:30"),
      ),
    ).toBe("replacement");
    d.leadPlans[0].plan.actingLead = undefined;
    expect(rosterLead(d, "calicut", "2026-10-20", now)).toBe("planlead");
  });
});
it("uses the new published day lead and respects an explicitly unassigned lead", () => {
  const d = data();
  d.leadWeeks = [
    { branch: "calicut", week_start: "2026-10-26", lead_id: "oldlead" },
  ];
  d.staffDayLeads = [{ branch: "calicut", day: "2026-10-27", lead_id: null }];
  expect(rosterLead(d, "calicut", "2026-10-27", now)).toBe("");
  d.staffDayLeads[0].lead_id = "newlead";
  expect(rosterLead(d, "calicut", "2026-10-27", now)).toBe("newlead");
  expect(rosterLead(d, "calicut", "2026-10-28", now)).toBe("oldlead");
});
describe("attendance report accuracy", () => {
  it("scores against assigned 6-3 and 11:30-20:30 hours and excludes future dates", () => {
    const d = data();
    d.schedules = [
      schedule({ shift_start: "06:00", shift_end: "15:00" }),
      schedule({
        id: "s2",
        date: "2026-10-18",
        shift_start: "11:30",
        shift_end: "20:30",
      }),
      schedule({ date: "2026-10-25" }),
    ];
    d.attendance = [
      attendance(),
      attendance({
        id: "a2",
        date: "2026-10-18",
        check_in: "11:40",
        check_out: "20:00",
      }),
    ];
    const r = attendanceReport(d, "p", "2026-10", "calicut", now);
    expect(r.count).toBe(2);
    expect(r.summary).toContain("On time: 1 of 2");
    expect(r.summary).toContain("Late arrivals: 1 (10 minutes");
    expect(r.summary).toContain("Early departures: 1 (30 minutes)");
    expect(r.evidence).toContain("6:00 AM");
    expect(r.evidence).not.toContain("2026-10-25");
  });
  it("does not score missing times or count incomplete hours and does not award automatic OT", () => {
    const d = data();
    d.schedules = [
      schedule({ shift_code: "E", shift_start: null, shift_end: null }),
    ];
    d.attendance = [attendance({ check_out: null })];
    const r = attendanceReport(d, "p", "2026-10", "calicut", now);
    expect(r.summary).toContain("On time: 0 of 0");
    expect(r.summary).toContain("across 0 completed");
    expect(r.summary).toContain("correction/review: 1");
    expect(r.summary).toContain("Approved overtime on roster: 0 hours");
  });
  it("honours saved grace and filters centre transfers", () => {
    const d = data();
    d.schedules = [schedule({ grace_minutes: 5 })];
    d.attendance = [attendance({ check_in: "08:04", check_out: "17:00" })];
    expect(
      attendanceReport(d, "p", "2026-10", "calicut", now).summary,
    ).toContain("On time: 1 of 1");
    expect(attendanceReport(d, "p", "2026-10", "cochin", now).count).toBe(0);
  });
  it("rejects future clock values today and a checkout without a check-in", () => {
    for (const a of [
      attendance({ check_in: "14:00", check_out: null }),
      attendance({ check_in: null, check_out: "11:00" }),
    ]) {
      const m = attendanceMetrics(a, schedule(), "2026-10-20", now);
      expect(m.invalid).toBe(true);
      expect(m.comparable).toBe(false);
      expect(m.worked).toBeNull();
      expect(m.status).toBe("Check times");
    }
  });
});
