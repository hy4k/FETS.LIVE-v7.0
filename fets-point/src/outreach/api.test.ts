import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  fetchOutreachContext,
  fetchOutreachDetail,
  saveInstitute,
  recordCall,
  saveBatch,
  updateFollowup,
} from "./api";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../lib/supabase", () => ({ supabase: { rpc } }));
beforeEach(() => rpc.mockReset());
describe("outreach API boundaries", () => {
  it("loads only the checked context and rejects incomplete snapshots", async () => {
    const ctx = {
      viewer: { user_id: "u", can_manage: false },
      staff: [],
      institutes: [],
      followups: [],
      batches: [],
    };
    rpc.mockResolvedValueOnce({ data: ctx, error: null });
    expect(await fetchOutreachContext()).toEqual(ctx);
    expect(rpc).toHaveBeenCalledWith("outreach_context");
    rpc.mockResolvedValueOnce({
      data: { viewer: ctx.viewer, institutes: [] },
      error: null,
    });
    await expect(fetchOutreachContext()).rejects.toThrow(/incomplete/i);
  });
  it("passes both cursor boundaries so equal call timestamps cannot lose history", async () => {
    const detail = {
      institute: { id: "i" },
      calls: [],
      followups: [],
      batches: [],
      has_more: false,
      next_cursor: null,
    };
    rpc.mockResolvedValue({ data: detail, error: null });
    await fetchOutreachDetail("i", { at: "2026-11-07T08:00:00Z", id: "c" });
    expect(rpc).toHaveBeenCalledWith("outreach_detail", {
      p_institute_id: "i",
      p_before: "2026-11-07T08:00:00Z",
      p_before_id: "c",
    });
  });
  it("keeps denied or stale mutations as errors rather than claiming success", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Institute changed; reload" },
    });
    await expect(
      saveInstitute({ id: "i", expected_updated_at: "v" } as any)
    ).rejects.toThrow("Institute changed");
    await expect(
      updateFollowup({ id: "f", expected_updated_at: "v" } as any)
    ).rejects.toThrow("Institute changed");
  });
  it("sends one structured idempotent call payload and exact batch version", async () => {
    const call = {
      institute_id: "i",
      request_id: "request",
      expected_updated_at: "v",
      summary: "Business contact not reached",
      next_step: {
        kind: "retry_contact",
        title: "Try office",
        due_at: "2026-11-08T08:00:00Z",
      },
    };
    rpc.mockResolvedValueOnce({
      data: { call_id: "c", institute: { id: "i" } },
      error: null,
    });
    await recordCall(call as any);
    expect(rpc).toHaveBeenCalledWith("outreach_record_call", {
      p_payload: call,
    });
    const batch = {
      id: "b",
      expected_updated_at: "v",
      institute_id: "i",
      name: "November cohort",
      delivery: "fets_centre",
      centre: "cochin",
      status: "confirmed",
      estimated: 12,
      confirmed: 10,
      attended: 0,
    };
    rpc.mockResolvedValueOnce({
      data: { ...batch, updated_at: "v2" },
      error: null,
    });
    await saveBatch(batch as any);
    expect(rpc).toHaveBeenCalledWith("outreach_save_batch", {
      p_payload: batch,
    });
  });
});
