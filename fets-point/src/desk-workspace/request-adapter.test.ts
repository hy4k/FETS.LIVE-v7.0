import { beforeEach, expect, it, vi } from "vitest";
import {
  dbSubmitApplication,
  dbResolveApplication,
} from "../redesign/write-data";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  load: vi.fn(),
  month: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    rpc: (...args: any[]) => mocks.rpc(...args),
    from: () => ({
      select: () => ({ or: () => Promise.resolve({ data: [] }) }),
      insert: (...args: any[]) => mocks.insert(...args),
    }),
  },
}));
vi.mock("../redesign/live-data", () => ({
  loadApplications: (...args: any[]) => mocks.load(...args),
  ensureMonth: (...args: any[]) => mocks.month(...args),
  loadOtClaims: vi.fn(),
}));
const row = {
  id: "request-one",
  kind: "leave",
  applicant_id: "profile",
  request_date: "2026-11-02",
  half_day_period: "first",
  workflow_version: 1,
  version: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  (window as any).FETS = {
    _meId: "profile",
    _meUserId: "user",
    _meName: "Example Staff",
    _applications: [row],
  };
  mocks.load.mockResolvedValue(undefined);
  mocks.month.mockResolvedValue(undefined);
  mocks.insert.mockResolvedValue({ error: null });
});
it.each([false, true])(
  "normalises an approved request RPC response (array=%s) before refreshing roster dates",
  async (array) => {
    mocks.rpc.mockResolvedValue({ data: array ? [row] : row, error: null });
    expect(await dbResolveApplication(row.id, "approved", "Reviewed")).toBe(
      true,
    );
    expect(mocks.month).toHaveBeenCalledWith(new Date("2026-11-02T12:00:00"));
    expect(mocks.load).toHaveBeenCalled();
  },
);
it("submits a half-day period through the validated RPC and does not create duplicate legacy requests", async () => {
  mocks.rpc.mockResolvedValue({ data: [row], error: null });
  expect(
    await dbSubmitApplication({
      kind: "leave",
      request_date: row.request_date,
      leave_type: "Half-day",
      half_day_period: "first",
    }),
  ).toEqual(row);
  expect(mocks.rpc).toHaveBeenCalledWith(
    "desk_request_submit",
    expect.objectContaining({ p_period: "first", p_kind: "leave" }),
  );
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("does not report approval or change the local roster when the server rejects stale work", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { message: "The roster changed" },
  });
  expect(await dbResolveApplication(row.id, "approved", "")).toBe(false);
  expect(mocks.month).not.toHaveBeenCalled();
  expect(mocks.load).not.toHaveBeenCalled();
});
