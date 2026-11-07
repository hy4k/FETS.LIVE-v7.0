import type {
  OutreachContext,
  OutreachFollowup,
  OutreachInstitute,
} from "./types";
export const STAGES: Record<string, string> = {
  new: "New institute",
  contacted: "Contact made",
  understanding_needs: "Understanding needs",
  interested: "Interested",
  planning: "Planning a mock",
  active_partner: "Active partner",
  paused: "Paused",
  closed: "Closed",
};
export const OUTCOMES: Record<string, string> = {
  not_reached: "Not reached",
  wrong_contact: "Wrong contact",
  callback_requested: "Callback requested",
  feedback_received: "Feedback received",
  interested: "Interested in support",
  not_interested: "Not interested",
  do_not_contact: "Do not contact",
  permission_update: "Contact permission update",
};
export const FOLLOWUP_KINDS: Record<string, string> = {
  retry_contact: "Try the business contact again",
  requested_callback: "Agreed callback",
  send_information: "Send requested information",
  arrange_mock: "Discuss a centre mock",
  platform_discussion: "Discuss the institute platform",
  internal_review: "Internal review",
  confirm_attendance: "Confirm mock attendance",
};
export const CONCERNS: Record<string, string> = {
  availability: "Test-centre availability",
  travel: "Travel / parking",
  check_in: "Check-in",
  requirements: "Exam-day requirements",
  waiting: "Waiting time",
  communication: "Staff communication",
  comfort: "Seating comfort",
  noise: "Noise",
  environment: "Air-conditioning / lighting",
  computers: "Computer experience",
  lockers: "Personal belongings / lockers",
  cleanliness: "Cleanliness / washrooms",
  anxiety: "Candidate anxiety",
  other: "Other",
};
export const INTERESTS: Record<string, string> = {
  not_discussed: "Not discussed",
  centre_mock: "Mock at FETS",
  platform: "Institute-hosted platform",
  both: "Both options",
  none: "No current interest",
};
export function followupBucket(
  task: OutreachFollowup,
  now = new Date()
): "overdue" | "today" | "upcoming" | "closed" | "unscheduled" {
  if (task.status !== "open") return "closed";
  const due = new Date(task.due_at);
  if (!Number.isFinite(due.getTime())) return "unscheduled";
  if (due.getTime() < now.getTime()) return "overdue";
  const day = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  return day(due) === day(now) ? "today" : "upcoming";
}
const active = (i: OutreachInstitute) =>
  !["paused", "closed"].includes(i.stage) &&
  i.contact_permission !== "do_not_contact";
export type OutreachFilters = {
  search?: string;
  owner?: string;
  centre?: string;
  stage?: string;
  queue?: string;
};
export function matchingInstitutes(
  context: OutreachContext,
  filters: OutreachFilters = {},
  now = new Date()
) {
  const query = (filters.search || "").trim().toLocaleLowerCase();
  const tasks = context.followups.filter((t) => t.status === "open");
  return context.institutes
    .filter((i) => {
      if (
        query &&
        !`${i.name} ${i.city} ${i.state} ${i.contact_name} ${i.contact_role} ${i.phone} ${i.email}`
          .toLocaleLowerCase()
          .includes(query)
      )
        return false;
      if (
        filters.owner &&
        filters.owner !== "all" &&
        i.owner_user_id !== filters.owner
      )
        return false;
      if (
        filters.centre &&
        filters.centre !== "all" &&
        i.preferred_centre !== filters.centre
      )
        return false;
      if (filters.stage && filters.stage !== "all" && i.stage !== filters.stage)
        return false;
      const own = tasks.filter((t) => t.institute_id === i.id),
        queue = filters.queue || "all";
      if (queue === "needs_next_step") return active(i) && !own.length;
      if (["overdue", "today", "upcoming"].includes(queue))
        return own.some((t) => followupBucket(t, now) === queue);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function summarise(context: OutreachContext, now = new Date()) {
  const count = (queue: string) =>
    context.followups.filter((t) => followupBucket(t, now) === queue).length;
  const activeIds = new Set(context.institutes.filter(active).map((i) => i.id));
  const totals = (delivery: string) => {
    const batches = context.batches.filter(
      (b) => b.delivery === delivery && b.status !== "cancelled"
    );
    return {
      estimated: batches
        .filter(
          (b) => b.status === "potential" && activeIds.has(b.institute_id)
        )
        .reduce((n, b) => n + b.estimated, 0),
      confirmed: batches
        .filter((b) => b.status === "confirmed")
        .reduce((n, b) => n + b.confirmed, 0),
      attended: batches
        .filter((b) => b.status === "completed")
        .reduce((n, b) => n + b.attended, 0),
      batches: batches.length,
    };
  };
  return {
    institutes: context.institutes.length,
    contacted: context.institutes.filter((i) => i.last_contact_at).length,
    overdue: count("overdue"),
    today: count("today"),
    upcoming: count("upcoming"),
    needs_next_step: matchingInstitutes(
      context,
      { queue: "needs_next_step" },
      now
    ).length,
    incoming: totals("fets_centre"),
    platform: totals("institute_platform"),
  };
}
