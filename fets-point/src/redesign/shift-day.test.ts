import { describe, expect, it } from "vitest";
import { createDayPlan, checkpoints, type CoverageChange } from "./shift-plan";
import { personalSchedule } from "./shift-day";

const team = ["a", "b", "c", "cover"].map((id) => ({
  id,
  userId: id,
  name: id,
  code: "D",
}));
function plan() {
  const p = createDayPlan(team);
  p.breaks.forEach((b) => {
    b.cover = "cover";
  });
  return p;
}
describe("published personal post timings", () => {
  it("ends the current post at the break, rather than the rotation boundary", () => {
    const slots = personalSchedule(plan(), [], "a");
    expect(slots.find((s) => s.start <= 599 && s.end > 599)).toMatchObject({
      kind: "post",
      end: 600,
      lanes: ["control"],
    });
    expect(slots.find((s) => s.start === 600)).toMatchObject({
      kind: "break",
      end: 630,
      cover: ["cover"],
    });
    expect(slots.find((s) => s.start === 630)).toMatchObject({
      kind: "post",
      end: 660,
      lanes: ["control"],
    });
  });
  it("shows both responsibilities during named break cover", () => {
    const p = plan();
    p.breaks.find((b) => b.staff === "a" && b.start === 600)!.cover = "b";
    expect(
      personalSchedule(p, [], "b").find((s) => s.start === 600),
    ).toMatchObject({ end: 630, lanes: ["front", "control"] });
    expect(
      checkpoints(p).find((c) => c.kind === "dvr" && c.due === 606)?.owner,
    ).toBe("b");
  });
  it("uses effective amendments for both the cover name and its exact duration", () => {
    const change: CoverageChange = {
      id: "change",
      plan_id: "plan",
      kind: "coverage",
      block: 1,
      lane: "control",
      staff_id: "c",
      starts: 615,
      ends: 620,
      shift_start: 480,
      shift_end: 1020,
      reason: "Approved cover",
      actor_id: "lead",
      created_at: "",
    };
    const p = plan();
    expect(
      personalSchedule(p, [change], "a")
        .filter((s) => s.kind === "break" && s.start < 630)
        .map((s) => [s.start, s.end, s.cover]),
    ).toEqual([
      [600, 615, ["cover"]],
      [615, 620, ["c"]],
      [620, 630, ["cover"]],
    ]);
    expect(
      personalSchedule(p, [change], "c").find((s) => s.start === 615),
    ).toMatchObject({ end: 620, lanes: ["floor", "control"] });
  });
  it("does not invent a post for someone without published coverage", () => {
    expect(personalSchedule(plan(), [], "not-rostered")).toEqual([]);
    expect(personalSchedule({ ...plan(), blocks: [] }, [], "a")).toEqual([]);
  });
  it("keeps every timed check and the original 90-minute rotations", () => {
    const p = plan();
    personalSchedule(p, [], "a");
    expect(p.blocks.map((b) => b.end - b.start)).toEqual([
      90, 90, 90, 90, 90, 90,
    ]);
    expect(checkpoints(p)).toHaveLength(144);
    expect(
      checkpoints(p)
        .filter((c) => c.kind === "walk")
        .map((c) => c.due % 10),
    ).toEqual(Array(54).fill(0));
    expect(
      checkpoints(p)
        .filter((c) => c.kind === "dvr")
        .every((c) => (c.due - p.blocks[c.block].start) % 6 === 0),
    ).toBe(true);
  });
});
