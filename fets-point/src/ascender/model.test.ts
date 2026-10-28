import { describe, it, expect } from "vitest";
import {
  capacity,
  istDay,
  monday,
  renewalState,
  safeLink,
  validateRecord,
} from "./model";
import { fields, payload } from "./forms";
describe("centre administration", () => {
  it("uses India date at midnight and Monday across month boundaries", () => {
    expect(istDay(new Date("2026-10-24T20:00:00Z"))).toBe("2026-10-25");
    expect(monday("2026-11-01")).toBe("2026-10-26");
  });
  it("does not claim missing capacity is zero or count archived rooms", () => {
    expect(capacity([])).toBeNull();
    expect(
      capacity([
        { total_seats: 20, unavailable_seats: 3 },
        { total_seats: 50, unavailable_seats: 0, archived: true },
      ]),
    ).toEqual({ total: 20, usable: 17 });
  });
  it("distinguishes overdue, due today, reminder window and future", () => {
    const state = (d: string) =>
      renewalState({ next_due: d, lead_days: 7 }, "2026-10-25");
    expect(state("2026-10-24").label).toBe("Overdue");
    expect(state("2026-10-25").label).toBe("Due today");
    expect(state("2026-11-01").attention).toBe(true);
    expect(state("2026-11-02").attention).toBe(false);
  });
  it("rejects executable, insecure and credential-bearing links", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://example.test",
      "https://name:secret@example.test",
      "broken",
    ])
      expect(safeLink(url)).toBeNull();
    expect(safeLink("https://example.test/file")).toBe(
      "https://example.test/file",
    );
  });
  it("preserves unknown seat capacity as null and allows explicit zero", () => {
    const defs = fields("ascender_programmes", [], [], []);
    expect(
      payload(defs, { approved_capacity: "" }).approved_capacity,
    ).toBeNull();
    expect(payload(defs, { approved_capacity: "0" }).approved_capacity).toBe(0);
  });
  it("allows optional answers but still rejects contradictory dates and quantities", () => {
    expect(() =>
      validateRecord("ascender_programmes", {
        approval: "approved",
        approved_capacity: null,
      }),
    ).not.toThrow();
    expect(() =>
      validateRecord("ascender_deployments", { readiness: "confirmed" }),
    ).not.toThrow();
    expect(() =>
      validateRecord("ascender_deployments", { status: "closed" }),
    ).not.toThrow();
    expect(() =>
      validateRecord("ascender_deployments", {
        start_date: "2026-11-01",
        end_date: "2026-10-31",
      }),
    ).toThrow();
    expect(() =>
      validateRecord("ascender_inventory", { quantity: -1 }),
    ).toThrow();
    expect(() =>
      validateRecord("ascender_inventory", { quantity: 1.5 }),
    ).toThrow();
    expect(() =>
      validateRecord("ascender_inventory", { quantity: null }),
    ).not.toThrow();
    expect(renewalState({ next_due: null }, "2026-10-25")).toMatchObject({
      attention: false,
      label: "Date not recorded",
    });
    expect(capacity([{ total_seats: null, unavailable_seats: null }])).toEqual({
      total: null,
      usable: null,
    });
  });
  it("does not put shifts, attendance, tasks or credentials in centre forms", () => {
    const keys = [
      "ascender_centres",
      "ascender_rooms",
      "ascender_programmes",
      "ascender_documents",
      "compliance_items",
      "ascender_deployments",
    ].flatMap((t) => fields(t, [], [], []).map((f) => f.key));
    for (const key of [
      "password",
      "check_in",
      "check_out",
      "shift_start",
      "shift_end",
      "task_status",
      "assigned_staff",
    ])
      expect(keys).not.toContain(key);
  });
});
