import { describe, it, expect } from "vitest";
import { timeInsights, type TimeData } from "./time-model";
import type { Schedule, Attendance } from "../roster-workspace/model";
const now = new Date("2026-10-28T14:00:00Z");
const shift = (date: string, values: Partial<Schedule> = {}): Schedule => ({
  id: date,
  profile_id: "me",
  date,
  branch_location: "calicut",
  shift_code: "D",
  shift_label: "Early",
  shift_start: "06:00",
  shift_end: "15:00",
  grace_minutes: 0,
  version: 1,
  overtime_hours: 0,
  ...values,
});
const record = (
  date: string,
  values: Partial<Attendance> = {},
): Attendance => ({
  id: date,
  staff_id: "me",
  date,
  branch_location: "calicut",
  check_in: "06:00",
  check_out: "15:00",
  status: "present",
  notes: null,
  ...values,
});
const analyze = (
  s: Schedule[],
  a: Attendance[],
  from = "2026-10-01",
  to = "2026-10-31",
) => timeInsights({ schedules: s, attendance: a }, "me", from, to, now);
describe("My Time calculations", () => {
  it("uses custom and half-day hours, deducts recorded breaks, and separates outside time from approved OT", () => {
    const r = analyze(
      [
        shift("2026-10-20", { overtime_hours: 1 }),
        shift("2026-10-21", {
          shift_code: "HD",
          shift_start: "11:30",
          shift_end: "16:00",
        }),
      ],
      [
        record("2026-10-20", {
          check_in: "05:30",
          check_out: "16:00",
          notes: JSON.stringify({
            breakMins: 30,
            steps: [{ out: "12:00", in: "12:30" }],
          }),
        }),
        record("2026-10-21", { check_in: "11:30", check_out: "16:00" }),
      ],
    );
    expect(r.worked).toBe(870);
    expect(r.assigned).toBe(810);
    expect(r.outside).toBe(90);
    expect(r.completeDays).toBe(2);
    expect(r.days.find((d) => d.date === "2026-10-20")!.s!.overtime_hours).toBe(
      1,
    );
  });
  it("does not call unknown days days off or incomplete/invalid records completed work", () => {
    const r = analyze(
      [
        shift("2026-10-20"),
        shift("2026-10-21"),
        shift("2026-10-22", {
          shift_code: "RD",
          shift_start: null,
          shift_end: null,
        }),
      ],
      [
        record("2026-10-20", { check_out: null }),
        record("2026-10-21", { check_out: "05:00" }),
      ],
    );
    expect(r.worked).toBeNull();
    expect(r.completeDays).toBe(0);
    expect(r.review).toBe(2);
    expect(r.offDays).toBe(1);
    expect(r.unassigned).toBeGreaterThan(0);
  });
  it("excludes ongoing and future work from completed totals and uses India day at midnight", () => {
    const r = analyze(
      [shift("2026-10-28"), shift("2026-10-29")],
      [record("2026-10-28", { check_out: null }), record("2026-10-29")],
    );
    expect(r.active).toBe(1);
    expect(r.worked).toBeNull();
    expect(r.review).toBe(0);
    const d = timeInsights(
      { schedules: [shift("2026-10-29")], attendance: [] },
      "me",
      "2026-10-28",
      "2026-10-29",
      new Date("2026-10-28T20:00:00Z"),
    );
    expect(d.today).toBe("2026-10-29");
    expect(d.days[1].future).toBe(false);
  });
  it("keeps ambiguous break allocation and unknown legacy shift hours unassessed", () => {
    const r = analyze(
      [
        shift("2026-10-20"),
        shift("2026-10-21", {
          shift_code: "E",
          shift_start: null,
          shift_end: null,
        }),
      ],
      [
        record("2026-10-20", { check_out: "16:00", notes: '{"breakMins":30}' }),
        record("2026-10-21"),
      ],
    );
    expect(r.outside).toBeNull();
    expect(r.outsideUnknown).toBe(2);
    expect(r.untimed).toBe(1);
    expect(
      analyze(
        [shift("2026-10-22", { shift_start: null, shift_end: null })],
        [record("2026-10-22", { check_in: "08:00", check_out: "17:00" })],
      ).outside,
    ).toBe(0);
  });
  it("isolates a person and flags duplicate records rather than double-counting", () => {
    const r = analyze(
      [shift("2026-10-20"), shift("2026-10-21", { profile_id: "other" })],
      [
        record("2026-10-20"),
        record("2026-10-20", { id: "duplicate" }),
        record("2026-10-21", { staff_id: "other" }),
      ],
    );
    expect(r.review).toBe(1);
    expect(r.completeDays).toBe(0);
    expect(r.worked).toBeNull();
  });
  it("does not infer recovery across missing or unfinished days", () => {
    const rows = [record("2026-10-20"), record("2026-10-22")];
    expect(
      analyze([shift("2026-10-20"), shift("2026-10-22")], rows).shortestGap,
    ).toBeNull();
    const r = analyze(
      [
        shift("2026-10-20"),
        shift("2026-10-21", {
          shift_code: "RD",
          shift_start: null,
          shift_end: null,
        }),
        shift("2026-10-22"),
      ],
      rows,
    );
    expect(r.shortestGap).toBe(39 * 60);
    expect(r.longestStreak).toBe(1);
    expect(r.medianEnd).toBe(15 * 60);
  });
  it("flags impossible break totals and does not display them as zero work", () => {
    const r = analyze(
      [shift("2026-10-20")],
      [record("2026-10-20", { notes: '{"breakMins":600}' })],
    );
    expect(r.worked).toBeNull();
    expect(r.review).toBe(1);
  });
});
