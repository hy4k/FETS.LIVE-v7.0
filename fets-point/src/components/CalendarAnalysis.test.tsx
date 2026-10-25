import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  rows: [] as any[],
  error: null as any,
  ranges: [] as number[],
}));
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "fixture" } }),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: () => {
      const query: any = {};
      for (const key of ["select", "gte", "lte", "order", "eq", "or"])
        query[key] = () => query;
      query.range = async (from: number, to: number) => {
        fixture.ranges.push(from);
        return { data: fixture.rows.slice(from, to + 1), error: fixture.error };
      };
      query.then = (yes: any) =>
        Promise.resolve({ data: fixture.rows, error: fixture.error }).then(yes);
      return query;
    },
  },
}));
import { CalendarAnalysis } from "./CalendarAnalysis";
import {
  calendarTimeMinutes,
  hasUsableSessionTiming,
} from "./calendar-analysis-time";
afterEach(() => {
  cleanup();
  fixture.rows = [];
  fixture.error = null;
  fixture.ranges = [];
});
const session = (id: number, start: any, end: any, count = 10) => ({
  id,
  date: "2026-10-02",
  start_time: start,
  end_time: end,
  client_name: "PROMETRIC",
  candidate_count: count,
  exam_name: "CMA US",
  branch_location: "calicut",
});
describe("Calendar Analysis reliability", () => {
  it("opens with a legacy session lacking both times, preserving totals", async () => {
    fixture.rows = [session(1, null, null, 9)];
    render(<CalendarAnalysis onClose={() => {}} activeBranch="calicut" />);
    await screen.findByText(/timing.*incomplete|incomplete.*timing/i);
    expect(
      screen.queryByText("Analyzing Session Data..."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Overlap Analysis/ }));
    await screen.findByText(/Overlap check incomplete/);
  });
  it("loads sessions past the first database page", async () => {
    fixture.rows = Array.from({ length: 1001 }, (_, i) =>
      session(i + 1, i === 1000 ? null : "08:00", i === 1000 ? null : "09:00"),
    );
    render(<CalendarAnalysis onClose={() => {}} activeBranch="calicut" />);
    await screen.findByText("1 session with incomplete timing");
    expect(fixture.ranges).toEqual([0, 1000]);
  });
  it("recognises zero as midnight but rejects unknown or invalid timing", () => {
    expect(calendarTimeMinutes("00:00:00")).toBe(0);
    for (const v of [null, undefined, "", "25:00", "08:65", "bad"])
      expect(calendarTimeMinutes(v)).toBeNull();
    expect(
      hasUsableSessionTiming({ start_time: "09:00", end_time: "09:00" }),
    ).toBe(false);
  });
  it("shows fetch failure with retry instead of an all-clear analysis", async () => {
    fixture.error = { message: "offline" };
    render(<CalendarAnalysis onClose={() => {}} activeBranch="global" />);
    await screen.findByRole("alert");
    expect(screen.queryByText("No Overlap Conflicts")).not.toBeInTheDocument();
    fixture.error = null;
    fireEvent.click(screen.getByRole("button", { name: "Retry analysis" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
  it("still detects over-capacity windows among valid timed sessions", async () => {
    fixture.rows = [
      session(1, null, null),
      session(2, "08:00", "10:00", 30),
      session(3, "09:00", "11:00", 25),
    ];
    render(<CalendarAnalysis onClose={() => {}} activeBranch="calicut" />);
    await screen.findByText(/timing.*incomplete|incomplete.*timing/i);
    fireEvent.click(screen.getByRole("button", { name: /Overlap Analysis/ }));
    await screen.findByText("Seat Capacity Conflicts Detected");
  });
});
