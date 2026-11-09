import { describe, expect, it } from "vitest";
import type { SeatContext, SeatDetail, SeatSession } from "../seats/types";
import {
  buildCalendarInsights,
  calendarMonthRange,
  exportCalendarCsv,
  indiaToday,
  volumeForSessions,
} from "./model";

const session = (
  id: number,
  fields: Partial<SeatSession> = {}
): SeatSession => ({
  id,
  date: "2026-11-09",
  branch_location: "cochin",
  client_name: "Pearson VUE",
  exam_name: "Exam",
  start_time: "09:00",
  end_time: "10:00",
  candidate_count: 10,
  status: "scheduled",
  ...fields,
});
const context = (fields: Partial<SeatContext> = {}): SeatContext => ({
  rules: [],
  details: [],
  adjacent_sessions: [],
  capacity_adjustments: [],
  can_edit_rules: false,
  ...fields,
});
const detail = (fields: Partial<SeatDetail> = {}): SeatDetail => ({
  session_id: 1,
  branch_location: "cochin",
  provider: "PEARSON VUE",
  date: "2026-11-09",
  start_time: "09:00",
  end_time: "10:00",
  exam_code: "A",
  exam_title: "Exam A",
  count: 10,
  status: "registered",
  ...fields,
});
const range = {
  startMonth: "2026-11",
  endMonth: "2026-11",
  from: "2026-11-01",
  through: "2026-11-30",
  previousFrom: "2026-10-01",
  previousThrough: "2026-10-31",
  label: "November 2026",
  previousLabel: "October 2026",
};
const build = (
  sessions: SeatSession[],
  fields: Partial<Parameters<typeof buildCalendarInsights>[0]> = {}
) =>
  buildCalendarInsights({
    sessions,
    previousSessions: [],
    context: context(),
    range,
    branch: "cochin",
    today: "2026-11-09",
    ...fields,
  });

describe("India civil dates and bounded calendar ranges", () => {
  it.each([
    ["2026-12-31T18:29:59Z", "2026-12-31"],
    ["2026-12-31T18:30:00Z", "2027-01-01"],
    ["2026-10-31T18:30:00Z", "2026-11-01"],
  ])("uses India midnight at %s", (instant, wanted) => {
    expect(indiaToday(new Date(instant))).toBe(wanted);
  });

  it("compares an equal number of whole months across leap years", () => {
    expect(calendarMonthRange("2024-01", "2024-02")).toMatchObject({
      from: "2024-01-01",
      through: "2024-02-29",
      previousFrom: "2023-11-01",
      previousThrough: "2023-12-31",
    });
    expect(calendarMonthRange("2026-01", "2026-12")).toMatchObject({
      previousFrom: "2025-01-01",
      previousThrough: "2025-12-31",
    });
    expect(calendarMonthRange("2026-11").label).toContain("2026");
  });

  it.each([
    ["2026-00", undefined],
    ["2026-13", undefined],
    ["2026-1", undefined],
    ["not a month", undefined],
    ["2026-11", "2026-10"],
    ["2026-01", "2027-01"],
  ])("rejects malformed, reversed and overlong periods %s–%s", (start, end) => {
    expect(() => calendarMonthRange(start, end)).toThrow();
  });
});

describe("Calendar booking volume", () => {
  it("deduplicates known records, excludes cancellation aliases and keeps zero sessions", () => {
    const first = session(1);
    const result = volumeForSessions(
      [
        first,
        { ...first, updated_at: "later metadata" },
        session(2, { status: " CANCELED " }),
        session(3, { status: "Cancelled" }),
        session(4, { candidate_count: 0 }),
        session(5, { date: "2026-10-31" }),
      ],
      range.from,
      range.through,
      "2026-11-10"
    );
    expect(result).toMatchObject({
      candidates: 10,
      sessionCount: 2,
      bookedDays: 1,
      upcomingCandidates: 0,
      cancelledSessions: 2,
      complete: true,
    });
  });

  it("excludes invalid counts from sums and reports malformed dates and unassigned centres", () => {
    const result = volumeForSessions(
      [
        session(1, { candidate_count: -1 }),
        session(2, { candidate_count: 1.5 }),
        session(3, { candidate_count: null }),
        session(4, { candidate_count: Number.MAX_SAFE_INTEGER + 1 }),
        session(5, { date: "2026-11-31" }),
        session(6, { date: "2026-2-01" }),
        session(7, { branch_location: "Trivandrum", candidate_count: 7 }),
        session(8, { branch_location: null, candidate_count: 3 }),
      ],
      range.from,
      range.through,
      "2026-11-09"
    );
    expect(result).toMatchObject({
      candidates: 10,
      upcomingCandidates: 10,
      sessionCount: 6,
      invalidCounts: 4,
      invalidDates: 2,
      unassignedCentres: 2,
      complete: false,
    });
  });

  it("does not arbitrarily select the volume of a conflicting ID", () => {
    const result = volumeForSessions(
      [session(1), session(1, { candidate_count: 31 }), session(2)],
      range.from,
      range.through,
      "2026-11-09"
    );
    expect(result).toMatchObject({
      candidates: 10,
      sessionCount: 1,
      conflictingIds: [1],
      complete: false,
    });
  });
});

describe("Operational insights", () => {
  it("keeps 62 sequential bookings distinct from concurrent 31/31 seats", () => {
    const model = build([
      session(1, { candidate_count: 31 }),
      session(2, {
        candidate_count: 31,
        start_time: "10:00",
        end_time: "11:00",
      }),
    ]);
    expect(model.volume.candidates).toBe(62);
    expect(model.centres[0]).toMatchObject({
      candidates: 62,
      sessionCount: 2,
      fullDays: 1,
      overbookedDays: 0,
      seatHours: 62,
      critical: { date: "2026-11-09", booked: 31, capacity: 31 },
    });
    expect(model.attention.every((item) => item.kind === "full")).toBe(true);
    expect(model.days).toHaveLength(30);
    expect(model.days[0]).toMatchObject({
      date: "2026-11-01",
      candidates: 0,
      status: "no_bookings",
    });
  });

  it("groups only explicit provider aliases and compares a zero baseline without infinity", () => {
    const model = build([
      session(1, { client_name: "VUE" }),
      session(2, { client_name: "Pearson" }),
      session(3, { client_name: "CMA US" }),
      session(4, { client_name: "PRO" }),
      session(5, { client_name: "ITTS", exam_name: "Pearson VUE Exam" }),
      session(6, { client_name: "Something else" }),
      session(7, { client_name: null }),
    ]);
    expect(model.providers.map((p) => p.name).sort()).toEqual([
      "ITTS",
      "PEARSON VUE",
      "PROMETRIC",
      "SOMETHING ELSE",
      "Unspecified provider",
    ]);
    expect(model.providers.find((p) => p.name === "PEARSON VUE")).toMatchObject(
      {
        candidates: 20,
        sessionCount: 2,
        previousCandidates: 0,
        change: 20,
      }
    );
    expect(model.volume.providerCount).toBe(5);
    expect(model.providers.every((p) => Number.isFinite(p.share))).toBe(true);
  });

  it("never merges the two centre pools and leaves unknown centres unassigned", () => {
    const model = build(
      [
        session(1, { candidate_count: 32 }),
        session(2, { branch_location: "Calicut", candidate_count: 20 }),
        session(3, { branch_location: "Unknown", candidate_count: 4 }),
      ],
      { branch: "global" }
    );
    expect(model.centres.find((c) => c.branch === "cochin")).toMatchObject({
      candidates: 32,
      critical: { booked: 32, capacity: 31 },
      overbookedDays: 1,
    });
    expect(model.centres.find((c) => c.branch === "calicut")).toMatchObject({
      candidates: 20,
      critical: { booked: 20, capacity: 40 },
    });
    expect(model.volume.unassignedCentres).toBe(1);
    expect(model.attention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          branch: "cochin",
          date: "2026-11-09",
          kind: "overbooked",
        }),
        expect.objectContaining({
          branch: "calicut",
          date: "2026-11-09",
          kind: "incomplete",
        }),
      ])
    );
  });

  it("does not allocate conflicting cross-centre IDs to either centre volume", () => {
    const model = build(
      [session(1), session(1, { branch_location: "calicut" })],
      { branch: "global" }
    );
    expect(model.volume.candidates).toBe(0);
    expect(
      model.centres.every(
        (centre) => centre.candidates === 0 && centre.sessionCount === 0
      )
    ).toBe(true);
    expect(model.centres.every((centre) => centre.incompleteDays > 0)).toBe(
      true
    );
  });

  it("includes carry-in from the previous day without adding it to current booking volume", () => {
    const overnight = session(1, {
      date: "2026-10-31",
      candidate_count: 31,
      start_time: "23:00",
      end_time: "01:00",
    });
    const model = build([], {
      context: context({ adjacent_sessions: [overnight] }),
    });
    expect(model.volume.candidates).toBe(0);
    expect(model.days[0]).toMatchObject({
      date: "2026-11-01",
      candidates: 0,
      status: "full",
    });
    expect(model.attention[0]).toMatchObject({
      date: "2026-11-01",
      booked: 31,
      capacity: 31,
      start: Date.parse("2026-11-01T00:00:00Z") / 1000,
      end: Date.parse("2026-11-01T01:00:00Z") / 1000,
    });
  });

  it("uses exact confirmed capacity windows and releases capacity at the end", () => {
    const model = build(
      [session(1, { candidate_count: 32, end_time: "11:00" })],
      {
        context: context({
          capacity_adjustments: [
            {
              branch_location: "cochin",
              date: "2026-11-09",
              extra_systems: 1,
              start_time: "09:00",
              end_time: "10:00",
              updated_at: "v1",
              note: "Confirmed",
            },
          ],
        }),
      }
    );
    expect(model.centres[0].critical).toMatchObject({
      booked: 32,
      capacity: 31,
      start: Date.parse("2026-11-09T10:00:00Z") / 1000,
    });
    expect(model.attention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "full",
          booked: 32,
          capacity: 32,
          end: Date.parse("2026-11-09T10:00:00Z") / 1000,
        }),
        expect.objectContaining({
          kind: "overbooked",
          booked: 32,
          capacity: 31,
          excess: 1,
          start: Date.parse("2026-11-09T10:00:00Z") / 1000,
        }),
      ])
    );
  });

  it("deduplicates repeated source groups, capacity snapshots and adjacent reservations", () => {
    const row = session(1, { candidate_count: 32 });
    const source = detail({ count: 32 });
    const extra = {
      branch_location: "cochin" as const,
      date: "2026-11-09",
      extra_systems: 1,
      start_time: "09:00",
      end_time: "10:00",
      updated_at: "v1",
      note: "",
    };
    const model = build([row], {
      context: context({
        details: [source, { ...source }],
        adjacent_sessions: [row, { ...row }],
        capacity_adjustments: [extra, { ...extra }],
      }),
    });
    expect(model.centres[0]).toMatchObject({
      candidates: 32,
      incompleteDays: 0,
      critical: { booked: 32, capacity: 32 },
    });
    expect(model.attention.map((item) => item.kind)).toEqual(["full"]);
  });

  it("reports conflicting source group snapshots even if their accidental sum matches Calendar", () => {
    const model = build([session(1, { candidate_count: 30 })], {
      context: context({
        details: [detail({ count: 10 }), detail({ count: 20 })],
      }),
    });
    expect(model.centres[0].incompleteDays).toBeGreaterThan(0);
    expect(model.attention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "incomplete", date: "2026-11-09" }),
      ])
    );
    expect(model.qualityNotes.join(" ")).toMatch(/conflict/i);
  });

  it("keeps a conflicting source snapshot unverified during overnight carry-in", () => {
    const overnight = session(1, {
      date: "2026-10-31",
      start_time: "23:00",
      end_time: "01:00",
      candidate_count: 30,
    });
    const source = detail({
      date: "2026-10-31",
      start_time: "23:00",
      end_time: "01:00",
    });
    const model = build([], {
      context: context({
        adjacent_sessions: [overnight],
        details: [source, { ...source, count: 20 }],
      }),
    });
    expect(model.days[0]).toMatchObject({
      date: "2026-11-01",
      candidates: 0,
      status: "incomplete",
    });
    expect(model.centres[0]).toMatchObject({
      incompleteDays: 1,
      seatHours: null,
    });
    expect(model.attention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "incomplete", date: "2026-11-01" }),
      ])
    );
  });

  it("does not turn conflicting capacity snapshots into a verified full or safe day", () => {
    const extra = {
      branch_location: "cochin" as const,
      date: "2026-11-09",
      extra_systems: 1,
      start_time: "09:00",
      end_time: "10:00",
      updated_at: "v1",
      note: "",
    };
    const model = build([session(1, { candidate_count: 32 })], {
      context: context({
        capacity_adjustments: [
          extra,
          { ...extra, extra_systems: 3, updated_at: "v2" },
        ],
      }),
    });
    expect(model.days.find((d) => d.date === "2026-11-09")?.status).toBe(
      "incomplete"
    );
    expect(model.centres[0].incompleteDays).toBe(1);
    expect(
      model.attention.some((a) => a.kind === "full" || a.kind === "overbooked")
    ).toBe(false);
  });

  it("compares capacity values independently of object field order and note/version metadata", () => {
    const model = build([session(1, { candidate_count: 32 })], {
      context: context({
        capacity_adjustments: [
          {
            branch_location: "cochin",
            date: "2026-11-09",
            extra_systems: 1,
            start_time: "09:00",
            end_time: "10:00",
            note: "First note",
            updated_at: "v1",
          },
          {
            note: "Updated note",
            updated_at: "v2",
            end_time: "10:00",
            start_time: "09:00",
            date: "2026-11-09",
            extra_systems: 1,
            branch_location: "cochin",
          },
        ],
      }),
    });
    expect(model.centres[0]).toMatchObject({
      fullDays: 1,
      incompleteDays: 0,
      critical: { booked: 32, capacity: 32 },
    });
  });

  it("keeps known overbooking visible beside invalid reservations and nulls unverifiable seat hours", () => {
    const model = build([
      session(1, { candidate_count: 32 }),
      session(2, { start_time: null }),
    ]);
    expect(model.days.find((d) => d.date === "2026-11-09")?.status).toBe(
      "overbooked"
    );
    expect(model.centres[0]).toMatchObject({
      overbookedDays: 1,
      seatHours: null,
    });
    expect(model.attention).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "overbooked" }),
        expect.objectContaining({ kind: "incomplete" }),
      ])
    );
  });

  it("retains valid volume when seat context and prior volume are unavailable", () => {
    const model = build([session(1)], {
      context: null,
      previousSessions: null,
    });
    expect(model.volume).toMatchObject({ candidates: 10, complete: true });
    expect(model.previous).toBeNull();
    expect(model.providers[0]).toMatchObject({
      previousCandidates: null,
      change: null,
    });
    expect(model.capacityAvailable).toBe(false);
    expect(model.days.every((d) => d.status === "unavailable")).toBe(true);
    expect(model.centres[0]).toMatchObject({
      critical: null,
      seatHours: null,
      incompleteDays: 30,
    });
    expect(model.attention).toEqual([]);
  });

  it("does not compare provider totals when either current or prior volume is incomplete", () => {
    const model = build([session(1)], {
      previousSessions: [
        session(2, {
          date: "2026-10-09",
          candidate_count: -1,
        }),
      ],
    });
    expect(model.previous?.complete).toBe(false);
    expect(model.providers[0]).toMatchObject({
      previousCandidates: null,
      change: null,
    });
  });

  it("does not let zero-count reservations with absent timing create seat pressure", () => {
    const model = build([
      session(1, { candidate_count: 0, start_time: null, end_time: null }),
    ]);
    expect(model.volume.sessionCount).toBe(1);
    expect(model.attention).toEqual([]);
    expect(model.centres[0]).toMatchObject({ seatHours: 0, incompleteDays: 0 });
  });
});

describe("CSV of actual Calendar booking rows", () => {
  it("quotes embedded separators/newlines and neutralises spreadsheet formulas without inventing fields", () => {
    const csv = exportCalendarCsv(
      [
        session(1, {
          client_name: '=HYPERLINK("bad")',
          exam_name: 'A,"B"\nC',
          branch_location: null,
        }),
        session(2, {
          candidate_count: -1,
          exam_name: "  +formula",
          start_time: null,
        }),
        session(3, { status: "canceled" }),
        session(4, { date: "2026-10-31" }),
      ],
      range
    );
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"A,""B""\nC"');
    expect(csv).toContain('"\'  +formula"');
    expect(csv).toMatch(/invalid count/i);
    expect(csv).toContain('"Unassigned"');
    expect(csv).not.toContain("canceled");
    expect(csv).not.toContain("2026-10-31");
    expect(csv).not.toMatch(/invoice|revenue|attendance/i);
  });

  it("exports unique actual rows and retains conflicting variants explicitly", () => {
    const csv = exportCalendarCsv(
      [session(1), session(1), session(1, { candidate_count: 20 })],
      range
    );
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).toMatch(/conflict/i);
  });
});
