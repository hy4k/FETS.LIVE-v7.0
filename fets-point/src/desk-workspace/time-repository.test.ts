import { beforeEach, expect, it, vi } from "vitest";
import { timeRepository } from "./time-repository";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
  fail: false,
  profile: true,
}));
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fail = false;
  mocks.profile = true;
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "auth-me" } },
    error: null,
  });
  mocks.from.mockImplementation((table) => {
    const q: any = {
      select: () => q,
      eq: (...args: any[]) => {
        mocks.eq(table, ...args);
        return q;
      },
      gte: () => q,
      lte: () => q,
      order: () => q,
      maybeSingle: async () => ({
        data: mocks.profile ? { id: "me" } : null,
        error: null,
      }),
      range: async () => ({
        data: [],
        error: mocks.fail ? { message: "unavailable" } : null,
      }),
    };
    return q;
  });
});
it("verifies the signed-in profile and filters both tables by that exact person", async () => {
  await expect(
    timeRepository.load("me", "2026-10-01", "2026-10-31"),
  ).resolves.toEqual({ schedules: [], attendance: [] });
  expect(mocks.eq).toHaveBeenCalledWith("staff_profiles", "user_id", "auth-me");
  expect(mocks.eq).toHaveBeenCalledWith("staff_profiles", "id", "me");
  expect(mocks.eq).toHaveBeenCalledWith("roster_schedules", "profile_id", "me");
  expect(mocks.eq).toHaveBeenCalledWith("staff_attendance", "staff_id", "me");
});
it("does not read attendance for a mismatched profile", async () => {
  mocks.profile = false;
  await expect(
    timeRepository.load("other", "2026-10-01", "2026-10-31"),
  ).rejects.toThrow("staff record");
  expect(mocks.from).not.toHaveBeenCalledWith("staff_attendance");
});
it("treats a connection failure as failure rather than empty attendance", async () => {
  mocks.fail = true;
  await expect(
    timeRepository.load("me", "2026-10-01", "2026-10-31"),
  ).rejects.toThrow("could not be loaded");
});
