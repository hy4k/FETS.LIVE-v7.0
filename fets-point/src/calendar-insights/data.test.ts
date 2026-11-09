import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SeatSession } from "../seats/types";
import { fetchInsightData } from "./data";
import { useCalendarInsights } from "./hooks";
import { buildCalendarInsights, calendarMonthRange } from "./model";

const transport = vi.hoisted(() => ({
  calendar: vi.fn(),
  rpc: vi.fn(),
  scopes: [] as unknown[],
  user: { id: "user-a" } as { id: string } | null,
}));
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: transport.user }),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const scope: Record<string, unknown> = { table };
      const query = {
        select: () => query,
        gte: (field: string, value: string) => {
          scope.from = value;
          return query;
        },
        lte: (field: string, value: string) => {
          scope.through = value;
          return query;
        },
        order: () => query,
        eq: (field: string, value: string) => {
          scope.branch = value;
          return query;
        },
        or: (value: string) => {
          scope.legacy = value;
          return query;
        },
        range: (offset: number, through: number) =>
          transport.calendar({ ...scope, offset, pageThrough: through }),
      };
      return query;
    },
    rpc: (name: string, args: unknown) => transport.rpc(name, args),
  },
}));

const row = (id = 1, fields: Partial<SeatSession> = {}): SeatSession => ({
  id,
  date: "2026-11-09",
  branch_location: "cochin",
  client_name: "Pearson VUE",
  exam_name: "Exam",
  candidate_count: 10,
  start_time: "09:00",
  end_time: "10:00",
  status: "scheduled",
  ...fields,
});
const snapshot = (fields = {}) => ({
  rules: [],
  details: [],
  adjacent_sessions: [],
  capacity_adjustments: [],
  can_edit_rules: false,
  ...fields,
});
const range = calendarMonthRange("2026-11");
const clients: QueryClient[] = [];
function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  return {
    client,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  transport.user = { id: "user-a" };
  transport.scopes.length = 0;
  transport.calendar
    .mockReset()
    .mockImplementation(async (scope) => ({
      data: scope.from === range.from ? [row()] : [],
      error: null,
    }));
  transport.rpc
    .mockReset()
    .mockResolvedValue({ data: snapshot(), error: null });
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

describe("complete Analytics reads with independent failure states", () => {
  it("reads the current and equal preceding periods, including yesterday for seat carry-in", async () => {
    transport.calendar.mockImplementation(async (scope) => ({
      data: [
        row(scope.from === range.from ? 1 : 2, {
          date: scope.from === range.from ? "2026-11-09" : "2026-10-09",
          candidate_count: scope.from === range.from ? 10 : 20,
        }),
      ],
      error: null,
    }));
    const data = await fetchInsightData(range, "cochin");
    const model = buildCalendarInsights({
      ...data,
      range,
      branch: "cochin",
      today: "2026-11-09",
    });
    expect(model.volume.candidates).toBe(10);
    expect(model.previous?.candidates).toBe(20);
    expect(transport.rpc).toHaveBeenCalledWith(
      "calendar_seat_planning_context",
      {
        p_branch: "cochin",
        p_from: "2026-10-31",
        p_through: "2026-11-30",
      }
    );
    expect(data.previousError).toBeNull();
    expect(data.seatError).toBeNull();
  });

  it("keeps valid current volume when the prior-period transport fails", async () => {
    transport.calendar.mockImplementation(async (scope) =>
      scope.from === range.previousFrom
        ? { data: null, error: { message: "Prior bookings unavailable" } }
        : { data: [row()], error: null }
    );
    const data = await fetchInsightData(range, "cochin");
    expect(data.sessions).toHaveLength(1);
    expect(data.previousSessions).toBeNull();
    expect(data.previousError).toContain("Prior bookings unavailable");
    expect(data.context).not.toBeNull();
    expect(
      buildCalendarInsights({
        ...data,
        range,
        branch: "cochin",
        today: "2026-11-09",
      }).volume.candidates
    ).toBe(10);
  });

  it("keeps both volume periods when protected seat context fails", async () => {
    transport.rpc.mockResolvedValue({
      data: null,
      error: { message: "Seat service unavailable" },
    });
    const data = await fetchInsightData(range, "cochin");
    expect(data.sessions).toHaveLength(1);
    expect(data.previousSessions).toEqual([]);
    expect(data.context).toBeNull();
    expect(data.seatError).toContain("Seat service unavailable");
  });

  it("fails the report when current bookings fail rather than returning an empty report", async () => {
    transport.calendar.mockImplementation(async (scope) =>
      scope.from === range.from
        ? { data: null, error: { message: "Current bookings unavailable" } }
        : { data: [], error: null }
    );
    await expect(fetchInsightData(range, "cochin")).rejects.toThrow(
      "Current bookings unavailable"
    );
  });

  it("starts all reads together so a slow prior read cannot block valid current/seat reads", async () => {
    const pending = deferred<{ data: SeatSession[]; error: null }>();
    transport.calendar.mockImplementation((scope) =>
      scope.from === range.previousFrom
        ? pending.promise
        : Promise.resolve({ data: [row()], error: null })
    );
    const result = fetchInsightData(range, "cochin");
    await waitFor(() => expect(transport.rpc).toHaveBeenCalled());
    pending.resolve({ data: [], error: null });
    expect((await result).sessions).toHaveLength(1);
  });

  it("handles duplicate cross-chunk source groups without multiplying counts or capacity", async () => {
    const longRange = calendarMonthRange("2026-01", "2026-04");
    const booking = row(1, { date: "2026-01-10", candidate_count: 32 });
    transport.calendar.mockImplementation(async (scope) => ({
      data: scope.from === longRange.from ? [booking] : [],
      error: null,
    }));
    transport.rpc.mockResolvedValue({
      data: snapshot({
        adjacent_sessions: [booking],
        details: [
          {
            session_id: 1,
            branch_location: "cochin",
            provider: "PEARSON VUE",
            date: booking.date,
            start_time: "09:00",
            end_time: "10:00",
            exam_code: "A",
            exam_title: "Exam A",
            count: 32,
            status: "registered",
          },
        ],
        capacity_adjustments: [
          {
            branch_location: "cochin",
            date: booking.date,
            extra_systems: 1,
            start_time: "09:00",
            end_time: "10:00",
            updated_at: "v1",
            note: "",
          },
        ],
      }),
      error: null,
    });
    const data = await fetchInsightData(longRange, "cochin");
    const model = buildCalendarInsights({
      ...data,
      range: longRange,
      branch: "cochin",
      today: "2026-01-01",
    });
    expect(model.centres[0]).toMatchObject({
      candidates: 32,
      incompleteDays: 0,
      critical: { booked: 32, capacity: 32 },
    });
    expect(model.attention).toHaveLength(1);
    expect(transport.rpc).toHaveBeenCalledTimes(2);
    expect(transport.rpc).toHaveBeenCalledWith(
      "calendar_seat_planning_context",
      {
        p_branch: "cochin",
        p_from: "2025-12-31",
        p_through: "2026-03-02",
      }
    );
  });

  it("rejects an invalid branch before making any private data requests", async () => {
    await expect(fetchInsightData(range, "unknown")).rejects.toThrow();
    expect(transport.calendar).not.toHaveBeenCalled();
    expect(transport.rpc).not.toHaveBeenCalled();
  });

  it("uses the complete paginated Calendar read rather than a first-page volume", async () => {
    transport.calendar.mockImplementation(async (scope) => ({
      data:
        scope.from !== range.from
          ? []
          : scope.offset === 0
          ? Array.from({ length: 1000 }, (_, index) =>
              row(index + 1, { candidate_count: 1 })
            )
          : [row(1001, { candidate_count: 7 })],
      error: null,
    }));
    const data = await fetchInsightData(range, "cochin");
    expect(data.sessions).toHaveLength(1001);
    expect(
      buildCalendarInsights({
        ...data,
        range,
        branch: "cochin",
        today: "2026-11-09",
      }).volume.candidates
    ).toBe(1007);
  });
});

describe("identity-scoped Analytics queries", () => {
  it("does not load data without authentication", async () => {
    transport.user = null;
    const { result } = renderHook(
      () => useCalendarInsights(range, "cochin"),
      wrapper()
    );
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe("idle");
    expect(transport.calendar).not.toHaveBeenCalled();
    expect(transport.rpc).not.toHaveBeenCalled();
  });

  it("clears old identity data immediately and ignores a late response from the old scope", async () => {
    const pending = deferred<{ data: SeatSession[]; error: null }>();
    transport.calendar.mockImplementation((scope) => {
      if (scope.from === range.previousFrom)
        return Promise.resolve({ data: [], error: null });
      return scope.branch === "cochin"
        ? pending.promise
        : Promise.resolve({
            data: [
              row(2, {
                branch_location: "calicut",
                candidate_count: 20,
              }),
            ],
            error: null,
          });
    });
    const { result, rerender } = renderHook(
      ({ branch }) => useCalendarInsights(range, branch),
      {
        ...wrapper(),
        initialProps: { branch: "cochin" },
      }
    );
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    transport.user = { id: "user-b" };
    rerender({ branch: "calicut" });
    expect(result.current.data).toBeUndefined();
    await waitFor(() =>
      expect(result.current.data?.sessions[0]?.candidate_count).toBe(20)
    );
    await act(async () => {
      pending.resolve({ data: [row()], error: null });
    });
    expect(result.current.data?.sessions[0]?.candidate_count).toBe(20);
  });

  it("clears loaded data on branch and range changes while new requests are pending", async () => {
    const setup = wrapper();
    const { result, rerender } = renderHook(
      ({ selectedRange, branch }) => useCalendarInsights(selectedRange, branch),
      {
        ...setup,
        initialProps: { selectedRange: range, branch: "cochin" },
      }
    );
    await waitFor(() => expect(result.current.data?.sessions).toHaveLength(1));
    const pending = deferred<{ data: SeatSession[]; error: null }>();
    transport.calendar.mockImplementation(() => pending.promise);
    rerender({ selectedRange: range, branch: "calicut" });
    expect(result.current.data).toBeUndefined();
    rerender({
      selectedRange: calendarMonthRange("2026-12"),
      branch: "cochin",
    });
    expect(result.current.data).toBeUndefined();
    await act(async () => {
      pending.resolve({ data: [], error: null });
    });
  });

  it("preserves same-scope working data with an explicit fetching state during refresh", async () => {
    const { client, ...provider } = wrapper();
    const { result } = renderHook(
      () => useCalendarInsights(range, "cochin"),
      provider
    );
    await waitFor(() =>
      expect(result.current.data?.sessions[0]?.candidate_count).toBe(10)
    );
    expect(result.current.isFetching).toBe(false);
    const pending = deferred<{ data: SeatSession[]; error: null }>();
    transport.calendar.mockImplementation((scope) =>
      scope.from === range.from
        ? pending.promise
        : Promise.resolve({ data: [], error: null })
    );
    act(() => {
      void client.invalidateQueries({ queryKey: ["calendar-insights"] });
    });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.data?.sessions[0]?.candidate_count).toBe(10);
    await act(async () => {
      pending.resolve({ data: [row(1, { candidate_count: 15 })], error: null });
    });
    await waitFor(() =>
      expect(result.current.data?.sessions[0]?.candidate_count).toBe(15)
    );
  });

  it("refreshes Analytics and Calendar/seat context after an import notification", async () => {
    const { client, ...provider } = wrapper();
    client.setQueryData(["sessions", "calendar", "old"], [row()]);
    client.setQueryData(["seat-context", "old"], snapshot());
    const { result } = renderHook(
      () => useCalendarInsights(range, "cochin"),
      provider
    );
    await waitFor(() =>
      expect(result.current.data?.sessions[0]?.candidate_count).toBe(10)
    );
    transport.calendar.mockImplementation(async (scope) => ({
      data: scope.from === range.from ? [row(1, { candidate_count: 17 })] : [],
      error: null,
    }));
    act(() => window.dispatchEvent(new Event("fets-data-loaded")));
    await waitFor(() =>
      expect(result.current.data?.sessions[0]?.candidate_count).toBe(17)
    );
    expect(
      client.getQueryState(["sessions", "calendar", "old"])?.isInvalidated
    ).toBe(true);
    expect(client.getQueryState(["seat-context", "old"])?.isInvalidated).toBe(
      true
    );
  });

  it("reads fresh bookings when reopening a recently cached report", async () => {
    const { client, ...provider } = wrapper();
    client.setQueryDefaults(["calendar-insights"], { gcTime: Infinity });
    const first = renderHook(
      () => useCalendarInsights(range, "cochin"),
      provider
    );
    await waitFor(() =>
      expect(first.result.current.data?.sessions[0]?.candidate_count).toBe(10)
    );
    first.unmount();
    transport.calendar.mockImplementation(async (scope) => ({
      data: scope.from === range.from ? [row(1, { candidate_count: 19 })] : [],
      error: null,
    }));
    const second = renderHook(
      () => useCalendarInsights(range, "cochin"),
      provider
    );
    expect(second.result.current.isFetching).toBe(true);
    await waitFor(() =>
      expect(second.result.current.data?.sessions[0]?.candidate_count).toBe(19)
    );
  });

  it("clears loaded private data on logout and removes the previous identity cache", async () => {
    const { client, ...provider } = wrapper();
    const { result, rerender } = renderHook(
      () => useCalendarInsights(range, "cochin"),
      provider
    );
    await waitFor(() =>
      expect(result.current.data?.sessions[0]?.candidate_count).toBe(10)
    );
    transport.user = null;
    rerender();
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe("idle");
    expect(
      client.getQueriesData({ queryKey: ["calendar-insights", "user-a"] })
    ).toEqual([]);
  });

  it("does not save an unmounted query after its late private-data response arrives", async () => {
    const { client, ...provider } = wrapper();
    const pending = deferred<{ data: SeatSession[]; error: null }>();
    transport.calendar.mockImplementation((scope) =>
      scope.from === range.from
        ? pending.promise
        : Promise.resolve({ data: [], error: null })
    );
    const { result, unmount } = renderHook(
      () => useCalendarInsights(range, "cochin"),
      provider
    );
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    unmount();
    await act(async () => {
      pending.resolve({ data: [row()], error: null });
    });
    expect(
      client
        .getQueriesData({ queryKey: ["calendar-insights", "user-a"] })
        .every(([, value]) => value === undefined)
    ).toBe(true);
  });
});
