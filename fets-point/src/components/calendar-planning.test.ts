import { describe, it, expect } from "vitest";
import {
  analyseCalendar,
  csvCell,
  type PlanningSession,
} from "./calendar-planning";
const row = (
  id: number,
  start: string | null,
  end: string | null,
  count = 25,
  centre = "calicut",
): PlanningSession => ({
  id,
  date: "2026-10-02",
  client_name: "PARAGON",
  exam_name: "CELPIP",
  candidate_count: count,
  start_time: start,
  end_time: end,
  branch_location: centre,
});
describe("Planning workload", () => {
  it("frees seats at changeovers and keeps centres independent", () => {
    const a = analyseCalendar([
      row(1, "08:00", "10:00"),
      row(2, "10:00", "12:00"),
      row(3, "08:00", "10:00", 25, "cochin"),
    ]);
    expect(a.candidates).toBe(75);
    expect(a.days.map((d) => d.peak)).toEqual([25, 25]);
    expect(a.days.every((d) => !d.overCapacity)).toBe(true);
  });
  it("flags incomplete timing and real overcapacity without guessing", () => {
    const a = analyseCalendar([
      row(1, null, null, 9),
      row(2, "08:00", "10:00", 30),
      row(3, "09:00", "11:00", 25),
    ]);
    expect(a.candidates).toBe(64);
    expect(a.days[0].peak).toBe(55);
    expect(a.days[0].overCapacity).toBe(true);
    expect(a.missing.length).toBe(1);
  });
  it("excludes cancelled sessions and does not invent mobile capacity", () => {
    const a = analyseCalendar([
      { ...row(1, "08:00", "10:00"), status: "cancelled" },
      row(2, "09:00", "10:00", 8, "mobile"),
    ]);
    expect(a.candidates).toBe(8);
    expect(a.cancelled).toBe(1);
    expect(a.days[0].capacity).toBeNull();
    expect(a.mix[0].client).toBe("PARAGON");
  });
  it("escapes CSV quotes and spreadsheet formulas", () => {
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});
