import { describe, it, expect } from "vitest";
import { summarise, matchingInstitutes, followupBucket } from "./model";
import type {
  OutreachContext,
  OutreachInstitute,
  MockBatch,
  OutreachFollowup,
} from "./types";
const now = new Date("2026-11-07T08:00:00Z");
const institute = (
  id: string,
  patch: Partial<OutreachInstitute> = {}
): OutreachInstitute => ({
  id,
  name: `Institute ${id}`,
  city: "Kochi",
  state: "Kerala",
  contact_name: "Office",
  contact_role: "Coordinator",
  phone: "0000",
  email: "",
  website: "",
  preferred_centre: "cochin",
  owner_user_id: "staff1",
  stage: "interested",
  contact_permission: "allowed",
  interest: "centre_mock",
  notes: "",
  last_contact_at: null,
  created_at: "v",
  updated_at: "v",
  ...patch,
});
const batch = (
  id: string,
  institute_id: string,
  patch: Partial<MockBatch> = {}
): MockBatch => ({
  id,
  institute_id,
  name: id,
  delivery: "fets_centre",
  centre: "cochin",
  planned_date: null,
  status: "potential",
  estimated: 20,
  confirmed: 0,
  attended: 0,
  notes: "",
  created_at: "v",
  updated_at: "v",
  ...patch,
});
const follow = (
  id: string,
  due_at: string,
  patch: Partial<OutreachFollowup> = {}
): OutreachFollowup => ({
  id,
  institute_id: "a",
  call_id: null,
  kind: "requested_callback",
  title: "Call coordinator",
  due_at,
  status: "open",
  completion_note: "",
  created_at: "v",
  updated_at: "v",
  ...patch,
});
const ctx = (): OutreachContext => ({
  viewer: { user_id: "staff1", can_manage: true },
  staff: [],
  institutes: [
    institute("a"),
    institute("b", { owner_user_id: "staff2" }),
    institute("c", { stage: "closed" }),
  ],
  followups: [],
  batches: [],
});
describe("outreach follow-up and candidate accounting", () => {
  it("uses the actual IST due time for overdue/today/upcoming buckets", () => {
    expect(followupBucket(follow("1", "2026-11-07T07:59:00Z"), now)).toBe(
      "overdue"
    );
    expect(followupBucket(follow("2", "2026-11-07T15:00:00Z"), now)).toBe(
      "today"
    );
    expect(followupBucket(follow("3", "2026-11-07T19:00:00Z"), now)).toBe(
      "upcoming"
    );
    expect(
      followupBucket(
        follow("4", "2026-11-01T08:00:00Z", { status: "done" }),
        now
      )
    ).toBe("closed");
  });
  it("keeps potential incoming, confirmed upcoming and attended cohorts distinct from platform use", () => {
    const c = ctx();
    c.batches = [
      batch("potential", "a"),
      batch("agreed", "a", {
        status: "confirmed",
        estimated: 10,
        confirmed: 12,
      }),
      batch("delivered", "c", {
        status: "completed",
        confirmed: 15,
        attended: 13,
      }),
      batch("cancelled", "a", { status: "cancelled", estimated: 100 }),
      batch("platform", "b", {
        delivery: "institute_platform",
        centre: null,
        estimated: 40,
      }),
    ];
    const summary = summarise(c, now);
    expect(summary.incoming.estimated).toBe(20);
    expect(summary.incoming.confirmed).toBe(12);
    expect(summary.incoming.attended).toBe(13);
    expect(summary.platform.estimated).toBe(40);
    expect(summary.platform.confirmed).toBe(0);
  });
  it("flags an active account without a next action without chasing closed or do-not-contact accounts", () => {
    const c = ctx();
    c.institutes.push(institute("d", { contact_permission: "do_not_contact" }));
    c.followups = [follow("next", "2026-11-08T06:00:00Z")];
    expect(summarise(c, now).needs_next_step).toBe(1);
    expect(
      matchingInstitutes(c, { queue: "needs_next_step" }, now).map((i) => i.id)
    ).toEqual(["b"]);
  });
  it("combines staff, centre, stage, queue and business-contact search without hiding another owner in manager totals", () => {
    const c = ctx();
    c.institutes[1].contact_name = "CMA Coordinator";
    c.followups = [
      follow("due", "2026-11-07T07:00:00Z", { institute_id: "b" }),
    ];
    expect(
      matchingInstitutes(
        c,
        {
          search: "coordinator",
          owner: "staff2",
          centre: "cochin",
          stage: "interested",
          queue: "overdue",
        },
        now
      ).map((i) => i.id)
    ).toEqual(["b"]);
    expect(summarise(c, now).institutes).toBe(3);
  });
});
