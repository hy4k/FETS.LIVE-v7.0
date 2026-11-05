import { describe, it, expect } from "vitest";
import {
  plainShift,
  halfShift,
  effectiveShift,
  overtimeMinutes,
  patternDates,
  attendanceMetrics,
  clockParts,
  datesBetween,
  csvCell,
  type Schedule,
  type Attendance,
} from "./model";
const day = "2026-10-20",
  now = new Date(day + "T12:00:00+05:30");
const shift = (v: Partial<Schedule> = {}): Schedule => ({
  id: "r",
  profile_id: "p",
  date: day,
  branch_location: "calicut",
  version: 1,
  overtime_hours: 0,
  ...plainShift(),
  ...v,
});
const attendance = (v: Partial<Attendance> = {}): Attendance => ({
  id: "a",
  staff_id: "p",
  date: day,
  check_in: "08:00",
  check_out: "17:00",
  status: "late",
  notes: "{}",
  branch_location: "calicut",
  ...v,
});
describe("roster hours and patterns", () => {
  it("normal duty is 8–5; a missing legacy evening time is not invented", () => {
    expect(
      effectiveShift(shift({ shift_start: null, shift_end: null })).shift_start,
    ).toBe("08:00");
    expect(
      effectiveShift(
        shift({ shift_code: "E", shift_start: null, shift_end: null }),
      ).shift_start,
    ).toBeNull();
  });
  it("half day is half of the selected full shift, for either half", () => {
    expect(halfShift(plainShift(), "first")).toMatchObject({
      shift_start: "08:00",
      shift_end: "12:30",
    });
    expect(halfShift(plainShift(), "second")).toMatchObject({
      shift_start: "12:30",
      shift_end: "17:00",
    });
    const early = shift({ shift_start: "06:00", shift_end: "15:00" });
    expect(halfShift(early, "second")).toMatchObject({
      shift_start: "10:30",
      shift_end: "15:00",
    });
    expect(
      halfShift(shift({ shift_start: "11:30", shift_end: "20:30" }), "first")
        .shift_end,
    ).toBe("16:00");
  });
  it("adds 15 continuous leave days including weekends across a month boundary", () => {
    const rows = patternDates(
      "2026-10-25",
      "2026-11-08",
      "continuous",
      plainShift("L"),
      [],
      [],
    );
    expect(rows).toHaveLength(15);
    expect(rows.every((x) => x.shift.shift_code === "L")).toBe(true);
  });
  it("allows an arbitrary repeating sequence of custom shifts, rest and leave", () => {
    const segments = [
      { days: 2, shift: shift({ shift_start: "06:00", shift_end: "15:00" }) },
      { days: 1, shift: plainShift("RD") },
      { days: 3, shift: plainShift("L") },
    ];
    const rows = patternDates(
      day,
      "2026-10-27",
      "cycle",
      plainShift(),
      segments,
      [],
    );
    expect(rows.map((x) => x.shift.shift_code)).toEqual([
      "D",
      "D",
      "RD",
      "L",
      "L",
      "L",
      "D",
      "D",
    ]);
    expect(rows[6].shift.shift_start).toBe("06:00");
  });
  it("selected weekdays leave the others untouched", () => {
    const rows = patternDates(
      "2026-10-19",
      "2026-10-25",
      "weekdays",
      plainShift(),
      [],
      [1, 3, 5],
    );
    expect(rows.map((x) => x.date)).toEqual([
      "2026-10-19",
      "2026-10-21",
      "2026-10-23",
    ]);
  });
  it("rejects invalid, reversed and excessively long ranges", () => {
    for (const a of [
      ["2026-02-30", "2026-03-02"],
      ["2026-10-20", "2026-10-19"],
      ["2026-01-01", "2027-02-01"],
    ])
      expect(() => datesBetween(a[0], a[1])).toThrow();
  });
  it("uses India time even when the browser is elsewhere", () => {
    expect(clockParts(new Date("2026-10-19T19:00:00Z"))).toEqual({
      day,
      time: "00:30",
    });
  });
});
describe("accurate attendance comparisons", () => {
  const endOfDay = new Date(day + "T23:00:00+05:30");
  it("compares the same arrival against the actual assigned hours, ignoring the old late flag", () => {
    const row = attendance({ check_in: "08:00" });
    expect(attendanceMetrics(row, shift(), day, endOfDay).late).toBe(0);
    expect(
      attendanceMetrics(
        row,
        shift({ shift_start: "06:00", shift_end: "15:00" }),
        day,
        endOfDay,
      ).late,
    ).toBe(120);
    expect(
      attendanceMetrics(
        attendance({ check_in: "11:30" }),
        shift({ shift_start: "11:30", shift_end: "20:30" }),
        day,
        endOfDay,
      ).late,
    ).toBe(0);
  });
  it("grace and exact check-in/out boundaries are explicit", () => {
    expect(
      attendanceMetrics(
        attendance({ check_in: "08:05", check_out: "16:55" }),
        shift({ grace_minutes: 5 }),
        day,
        endOfDay,
      ),
    ).toMatchObject({ late: 0, early: 5 });
    expect(
      attendanceMetrics(
        attendance({ check_in: "08:06" }),
        shift({ grace_minutes: 5 }),
        day,
        endOfDay,
      ).late,
    ).toBe(1);
  });
  it("missing historic checkout has unknown worked time, not todays clock", () => {
    expect(
      attendanceMetrics(
        attendance({ check_out: null, date: "2026-10-19" }),
        shift(),
        "2026-10-19",
        endOfDay,
      ),
    ).toMatchObject({ worked: null, missingOut: true, complete: false });
  });
  it("deducts completed and still-open breaks from an active estimate", () => {
    const row = attendance({
      check_out: null,
      notes: JSON.stringify({
        breakMins: 20,
        steps: [{ out: "09:00", in: "09:20" }, { out: "11:30" }],
      }),
    });
    expect(attendanceMetrics(row, shift(), day, now)).toMatchObject({
      worked: 190,
      breaks: 50,
      active: true,
    });
  });
  it("includes half-day attendance without counting it as absent", () => {
    expect(
      attendanceMetrics(
        attendance({ status: "half_day", check_out: "12:30" }),
        shift({ ...halfShift(plainShift(), "first") }),
        day,
        endOfDay,
      ),
    ).toMatchObject({ present: true, worked: 270, early: 0 });
  });
  it("does not call a future shift absent or a missing timing on time", () => {
    expect(
      attendanceMetrics(undefined, shift(), "2026-10-21", now),
    ).toMatchObject({ missingIn: false, status: "Upcoming" });
    expect(
      attendanceMetrics(attendance(), undefined, day, endOfDay),
    ).toMatchObject({
      late: null,
      comparable: false,
    });
  });
  it("flags an ended roster without check-in for review, not confirmed absence", () => {
    expect(attendanceMetrics(undefined, shift(), day, endOfDay)).toMatchObject({
      status: "No check-in",
      missingIn: true,
    });
  });
  it("invalid clock-out before clock-in is not counted as completed hours", () => {
    expect(
      attendanceMetrics(
        attendance({ check_out: "07:00" }),
        shift(),
        day,
        endOfDay,
      ),
    ).toMatchObject({ invalid: true, complete: false, worked: null });
  });
  it("excludes outside-hours breaks and never converts that time to approved OT", () => {
    const row = attendance({
      check_in: "07:00",
      check_out: "18:00",
      notes: JSON.stringify({
        breakMins: 30,
        steps: [{ out: "17:00", in: "17:30" }],
      }),
    });
    expect(attendanceMetrics(row, shift(), day, endOfDay).outside).toBe(90);
    expect(shift().overtime_hours).toBe(0);
  });
  it("does not invent an outside-hours total when old aggregate breaks cannot be allocated", () => {
    expect(
      attendanceMetrics(
        attendance({ check_out: "18:00", notes: '{"breakMins":30}' }),
        shift(),
        day,
        endOfDay,
      ).outside,
    ).toBeNull();
  });
  it("OT counts only requested time outside each roster, early or late", () => {
    expect(overtimeMinutes("06:00", "08:00", plainShift())).toBe(120);
    expect(
      overtimeMinutes(
        "17:00",
        "19:00",
        shift({ shift_start: "11:30", shift_end: "20:30" }),
      ),
    ).toBe(0);
    expect(
      overtimeMinutes(
        "14:00",
        "16:00",
        shift({ shift_start: "06:00", shift_end: "15:00" }),
      ),
    ).toBe(60);
    expect(
      overtimeMinutes(
        "20:30",
        "21:00",
        shift({ shift_start: "11:30", shift_end: "20:30" }),
      ),
    ).toBe(30);
  });
  it("escapes spreadsheet formulas and quotes in exports", () => {
    expect(csvCell("=2+2")).toBe('"\'=2+2"');
    expect(csvCell('A"B')).toBe('"A""B"');
  });
});
