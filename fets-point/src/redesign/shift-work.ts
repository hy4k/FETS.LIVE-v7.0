import type { DayTask, ListItem } from "./shift-blueprint";
import { isVerified } from "./shift-board";

export const SUPPORT_REASONS = [
  ["clarity", "I need clearer instructions"],
  ["training", "I need help learning this"],
  ["workload", "I cannot fit this around my other duties"],
  ["equipment", "Equipment or access is missing"],
  ["dependency", "I am waiting for someone else"],
  ["other", "Something else"],
] as const;
export type WorkAction =
  | "start"
  | "complete"
  | "help"
  | "resume"
  | "return"
  | "verify"
  | "reopen"
  | "skip";
export type WorkState =
  | "unassigned"
  | "todo"
  | "working"
  | "help"
  | "review"
  | "verified"
  | "carried"
  | "skipped";
export const WORK_LABELS: Record<WorkState, string> = {
  unassigned: "Needs an owner",
  todo: "To do",
  working: "In progress",
  help: "Needs help",
  review: "Ready for review",
  verified: "Verified",
  carried: "Moved to another day",
  skipped: "Not needed today",
};
export function workState(i: ListItem): WorkState {
  if (i.status === "carried" || i.status === "skipped") return i.status;
  if (isVerified(i)) return "verified";
  if (i.status === "done") return "review";
  if (!i.assignee) return "unassigned";
  if (i.status === "blocked") return "help";
  return i.task?.started_at ? "working" : "todo";
}
export function contract(i: ListItem) {
  return {
    // Blank legacy agreements stay blank: current templates are not historical evidence.
    result:
      i.task?.expected_result !== undefined
        ? i.task.expected_result
        : i.responsibility?.expected_result || i.responsibility?.details || "",
    instructions: i.task?.instructions ?? i.responsibility?.details ?? "",
    // A saved assignment keeps its agreed deadline even if the regular duty later changes.
    due:
      i.task && i.task.due_minute !== undefined
        ? i.task.due_minute
        : (i.responsibility?.due_minute ?? null),
    priority: i.task?.priority ?? i.responsibility?.priority ?? "normal",
  };
}
export function overdue(
  i: ListItem,
  day: string,
  today: string,
  minute: number,
) {
  if (["review", "verified", "carried", "skipped"].includes(workState(i)))
    return false;
  const due = contract(i).due;
  return day < today || (day === today && due !== null && due < minute);
}
export function orderedWork(items: ListItem[]) {
  const rank: Record<WorkState, number> = {
    help: 0,
    unassigned: 1,
    working: 2,
    todo: 3,
    review: 4,
    verified: 5,
    carried: 6,
    skipped: 7,
  };
  return [...items].sort(
    (a, b) =>
      rank[workState(a)] - rank[workState(b)] ||
      Number(contract(b).priority === "important") -
        Number(contract(a).priority === "important") ||
      (contract(a).due ?? 1440) - (contract(b).due ?? 1440) ||
      a.title.localeCompare(b.title),
  );
}
/** Facts about saved assignments only. No inference about effort, ability, or disciplinary action. */
export function workEvidence(tasks: DayTask[], person: string) {
  const assigned = tasks.filter((t) => t.assigned_to === person);
  const included = assigned.filter(
    (t) => !["skipped", "carried"].includes(t.status),
  );
  return {
    assigned: included.length,
    verified: included.filter(
      (t) => t.status === "done" && t.verified_at && t.verified_by,
    ).length,
    awaiting: included.filter((t) => t.status === "done" && !t.verified_at)
      .length,
    support: included.filter((t) => t.status === "blocked").length,
    reworks: assigned.reduce((n, t) => n + (t.rework_count || 0), 0),
    withoutEvidence: included.filter(
      (t) => t.status === "done" && !t.completion_note?.trim(),
    ).length,
    onTime: included.filter(
      (t) =>
        t.status === "done" &&
        t.done_at &&
        t.due_minute != null &&
        new Date(t.done_at).getTime() <=
          new Date(`${t.day}T00:00:00+05:30`).getTime() + t.due_minute * 60000,
    ).length,
    timedCompleted: included.filter(
      (t) => t.status === "done" && t.done_at && t.due_minute != null,
    ).length,
  };
}

export type DevelopmentNote = {
  id: string;
  branch: string;
  profile_id: string;
  kind: "recognition" | "support" | "training" | "warning";
  evidence: string;
  context: string;
  action: string;
  review_on: string;
  status: "open" | "closed";
  followup_result?: string;
  closed_by?: string | null;
  staff_response: string;
  created_at: string;
  created_by: string;
  evidence_snapshot: DayTask[];
};
export const DEVELOPMENT_LABELS = {
  recognition: "Recognition",
  support: "Support",
  training: "Training",
  warning: "Warning",
} as const;
