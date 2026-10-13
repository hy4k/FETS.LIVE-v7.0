import { describe, it, expect } from "vitest";
import {
  capacityEstimate,
  duePassed,
  institutionProgress,
  latestResult,
  latestSelections,
  matchesWork,
  readiness,
  selectedIds,
  workFlags,
  workOrder,
  type WorkItem,
  type WorkResult,
  type Stage,
  type Selection,
} from "./actionables-model";
import source from "../test/actionables-reference.json";
const now = new Date("2026-10-13T04:30:00Z");
const task: WorkItem = {
  id: "work",
  title: "Contact the principal",
  institution_id: "college",
  status: "open",
  owner_id: "owner",
  due_date: "2026-10-13",
};
const result: WorkResult = {
  id: "result",
  work_item_id: "work",
  content: "Meeting agreed",
  status: "done",
  reported: false,
  report_to_id: "manager-user",
  created_at: "2026-10-12T10:00:00Z",
  follow_up_date: "2026-10-13",
};
describe("clear Actionables priorities and evidence", () => {
  it("keeps the actual 25-row catalogue and exact district counts", () => {
    expect(source.institutions).toHaveLength(25);
    expect(new Set(source.institutions.map((i) => i.id)).size).toBe(25);
    expect(
      ["cochin", "thrissur", "calicut", "kannur", "kottayam"].map(
        (d) => source.institutions.filter((i) => i.district === d).length,
      ),
    ).toEqual([5, 6, 6, 4, 4]);
    expect(source.tasks.map((t) => t.status)).toEqual([
      "todo",
      "inprogress",
      "done",
      "todo",
      "inprogress",
    ]);
  });
  it("does not invent a deadline at midnight for date-only work", () => {
    expect(duePassed("2026-10-13", null, now)).toBe(false);
    expect(duePassed("2026-10-12", null, now)).toBe(true);
    expect(duePassed("2026-10-13", "2026-10-13T04:00:00Z", now)).toBe(true);
    expect(duePassed("2026-10-13", "2026-10-13T05:00:00Z", now)).toBe(false);
  });
  it("uses India calendar dates across UTC midnight", () => {
    expect(
      duePassed("2026-10-13", null, new Date("2026-10-13T20:00:00Z")),
    ).toBe(true);
  });
  it("keeps completed work visible when a follow-up or reporting action remains", () => {
    const done = { ...task, status: "done" as const };
    expect(workFlags(done, [result], now)).toEqual({
      overdue: false,
      blocked: false,
      followup: true,
      report: true,
      unassigned: false,
    });
    expect(matchesWork(done, [result], "active", now)).toBe(true);
  });
  it("does not mark a later timed follow-up as due early", () => {
    expect(
      workFlags(
        task,
        [{ ...result, follow_up_at: "2026-10-13T08:00:00Z" }],
        now,
      ).followup,
    ).toBe(false);
  });
  it("uses the latest outcome even when results arrive unordered", () => {
    const later = {
      ...result,
      id: "later",
      created_at: "2026-10-13T01:00:00Z",
      follow_up_date: null,
      reported: true,
    };
    expect(latestResult(task, [later, result])).toEqual(later);
    expect(workFlags(task, [result, later], now).report).toBe(false);
  });
  it("resolves equal result timestamps consistently by id", () => {
    expect(
      latestResult(task, [
        { ...result, id: "b" },
        { ...result, id: "a" },
      ])?.id,
    ).toBe("b");
  });
  it("prioritises work missing an owner ahead of routine scheduled work", () => {
    expect(
      workOrder(
        [task, { ...task, id: "unowned", owner_id: null }],
        [],
        now,
      ).map((t) => t.id),
    ).toEqual(["unowned", "work"]);
  });
  it("retains removals as decisions and counts only the latest shortlist selection", () => {
    const rows: Selection[] = [
      {
        id: "a",
        institution_id: "college",
        selected: true,
        selected_by: "manager",
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        id: "b",
        institution_id: "college",
        selected: false,
        selected_by: "manager",
        created_at: "2026-10-13T00:00:00Z",
      },
    ];
    expect(selectedIds(rows).size).toBe(0);
    expect(latestSelections(rows).get("college")?.id).toBe("b");
    expect(rows).toHaveLength(2);
  });
  it("requires handover, earlier stages and completed work for delivery", () => {
    const stages: Stage[] = ["approval", "handover"].map((key, n) => ({
      id: key,
      institution_id: "college",
      stage_key: key,
      position: n + 1,
      title: key,
      instructions: "",
      contact_script: "",
      completion_note: "Evidence recorded",
      completed_at: "2026-10-12",
    }));
    expect(institutionProgress("college", stages, [task]).delivered).toBe(
      false,
    );
    expect(
      institutionProgress("college", stages, [{ ...task, status: "done" }])
        .delivered,
    ).toBe(true);
    expect(
      institutionProgress(
        "college",
        [{ ...stages[0], completed_at: null }, stages[1]],
        [{ ...task, status: "done" }],
      ).delivered,
    ).toBe(false);
  });
  it("does not create check observations from a supplied readiness percentage", () => {
    const r = readiness("college", []);
    expect(r.reviewed).toBe(0);
    expect(r.unknown).toBe(10);
    expect(r.label).not.toContain("Approved");
  });
  it("uses recorded capacities without assuming a missing seat count", () => {
    const institutions = [
      { id: "a", name: "One", district: "Calicut", lab_seat_capacity: 100 },
      { id: "b", name: "Two", district: "Kannur", lab_seat_capacity: null },
    ];
    expect(
      capacityEstimate(institutions, new Set(["a", "b"]), 200, 35, 1),
    ).toMatchObject({ seats: 100, complete: false, estimate: null });
    expect(
      capacityEstimate(institutions, new Set(["a"]), 200, 35, 1).estimate,
    ).toBe(7000);
    expect(
      capacityEstimate(institutions, new Set(), 200, 35, 1).estimate,
    ).toBeNull();
  });
  it("treats a recorded zero as data and rejects invalid utilisation assumptions", () => {
    expect(
      capacityEstimate(
        [{ id: "a", name: "One", district: "Calicut", lab_seat_capacity: 0 }],
        new Set(["a"]),
        200,
        35,
        1,
      ),
    ).toMatchObject({ complete: true, estimate: 0 });
    expect(
      capacityEstimate(
        [{ id: "a", name: "One", district: "Calicut", lab_seat_capacity: 100 }],
        new Set(["a"]),
        200,
        120,
        1,
      ).estimate,
    ).toBeNull();
  });
});
