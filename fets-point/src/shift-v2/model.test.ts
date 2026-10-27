import { describe, it, expect } from "vitest";
import { validate, ownerAt, slots, copyPlan, slotState } from "./model";
import { fixturePlan, fixtureChecks, ids } from "../test/shift-v2-fixture";
describe("Staff-day shift model", () => {
  it("supports the combined day with no fixed ninety-minute rotations", () => {
    expect(validate(fixturePlan)).toEqual([]);
    expect(fixturePlan.blocks.some((b) => b.end - b.start === 15)).toBe(true);
    expect(fixturePlan.people.find((p) => p.id === ids.c)?.end).toBe(1230);
  });
  it("keeps one monitor at changeovers, including temporary break cover", () => {
    expect(ownerAt(fixturePlan, 1049)).toBe(ids.c);
    expect(ownerAt(fixturePlan, 1050)).toBe(ids.support);
    expect(ownerAt(fixturePlan, 1080)).toBe(ids.c);
    const checks = slots(fixturePlan);
    expect(
      checks.find((c) => c.kind === "walk" && c.due === 1050)?.owner_id,
    ).toBe(ids.c);
    expect(
      checks.find((c) => c.kind === "dvr" && c.due === 1056)?.owner_id,
    ).toBe(ids.support);
  });
  it("does not restart the 10/6-minute clock for rotations or breaks", () => {
    const all = slots(fixturePlan);
    expect(all.filter((c) => c.kind === "walk").length).toBe(78);
    expect(all.filter((c) => c.kind === "dvr").length).toBe(130);
    expect(
      all
        .filter((c) => c.kind === "dvr")
        .every((c, i) => c.due === 456 + i * 6),
    ).toBe(true);
  });
  it("rejects both missing cover and double duty ownership", () => {
    const p = structuredClone(fixturePlan);
    p.blocks = p.blocks.filter((b) => b.staff !== ids.support);
    expect(validate(p).some((s) => s.includes("uncovered gap"))).toBe(true);
    const p2 = structuredClone(fixturePlan);
    p2.blocks.push({
      ...p2.blocks.find((b) => b.duties.includes("monitor"))!,
      id: crypto.randomUUID(),
    });
    expect(validate(p2).some((s) => s.includes("one monitoring owner"))).toBe(
      true,
    );
  });
  it("copies layout only, using actual new-day roster and dropping temporary cover", () => {
    const p = copyPlan(
      fixturePlan,
      fixturePlan.people.filter((p) => !p.support),
    );
    expect(p.people.some((p) => p.support)).toBe(false);
    expect(p.blocks.some((b) => b.staff === ids.support)).toBe(false);
    expect(p.blocks[0].id).not.toBe(fixturePlan.blocks[0].id);
    expect(validate(p).length).toBeGreaterThan(0);
  });
  it("distinguishes activation from missed checks and blocks early or late credit", () => {
    const c = fixtureChecks.checks[0];
    const due =
      Date.parse(fixtureChecks.plan.day + "T00:00:00+05:30") + c.due * 60000;
    expect(
      slotState(
        {
          ...fixtureChecks,
          plan: {
            ...fixtureChecks.plan,
            tracking_from: new Date(due + 1000).toISOString(),
          },
        },
        c,
        due + 60000,
      ),
    ).toBe("not-tracked");
    expect(slotState(fixtureChecks, c, due - 1000)).toBe("upcoming");
    expect(slotState(fixtureChecks, c, due)).toBe("due");
    expect(
      slotState(fixtureChecks, c, due + (c.kind === "walk" ? 10 : 6) * 60000),
    ).toBe("missed");
  });
});
