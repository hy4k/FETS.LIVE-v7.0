import { localIST } from "./institution-workflow";
import reference from "./actionables-guidance.json";
export { reference as ACTIONABLES_REFERENCE };
export const ROLLOUT_GOAL = 7;
export const READINESS_ITEMS = reference.auditCriteria.map((item) => ({
  key: item.id,
  title: item.text.split(":")[0],
  detail: item.text.slice(item.text.indexOf(":") + 1).trim(),
}));
export type Criterion = string;
export type TaskStatus = "open" | "in_progress" | "blocked" | "done";
export const WORK_STATUS: Record<TaskStatus, string> = {
  open: "To do",
  in_progress: "In progress",
  blocked: "Needs support",
  done: "Result recorded",
};
export interface Person {
  id: string;
  user_id?: string;
  full_name: string;
  is_active?: boolean;
  role?: string;
}
export interface ReferenceInstitution {
  id: string;
  district: string;
  districtName: string;
  type: string;
  name: string;
  address: string;
  pincode: string;
  phone: string;
  nodal: string;
  capacity: string;
  status: string;
  score: number;
}
export interface ReferenceTeamTask {
  id: number;
  title: string;
  assignee: string;
  status: string;
  priority: string;
}
export interface Institution {
  id: string;
  name: string;
  district: string;
  address?: string;
  primary_contact_name?: string;
  primary_contact_role?: string;
  primary_contact_phone?: string;
  primary_contact_email?: string;
  website?: string;
  notes?: string;
  lab_seat_capacity?: number | null;
  stage?: string;
  actionables_reference?: ReferenceInstitution | null;
}
export interface Stage {
  id: string;
  institution_id: string;
  stage_key?: string | null;
  position: number;
  title: string;
  instructions: string;
  contact_script: string;
  completion_note: string;
  completed_at?: string | null;
  completed_by?: string | null;
}
export interface WorkItem {
  id: string;
  institution_id?: string | null;
  institution_stage_id?: string | null;
  district?: string;
  title: string;
  instructions?: string;
  impact?: string;
  owner_id?: string | null;
  owner?: { full_name: string };
  due_date?: string | null;
  due_at?: string | null;
  status: TaskStatus;
  report_to_id?: string | null;
  report_instructions?: string;
  blocker?: string | null;
  reference_task_key?: number | null;
  source_team?: string | null;
}
export interface WorkResult {
  id: string;
  work_item_id: string;
  content: string;
  status: TaskStatus;
  follow_up_date?: string | null;
  follow_up_at?: string | null;
  reported: boolean;
  report_to_id?: string | null;
  report_method?: string;
  created_at: string;
  author_id?: string;
  edited_by?: string;
  author?: { full_name: string };
  editor?: { full_name: string };
}
export interface Selection {
  id: string;
  institution_id: string;
  selected: boolean;
  previous_id?: string | null;
  selected_by: string;
  created_at: string;
}
export interface Observation {
  id: string;
  institution_id: string;
  criterion: Criterion;
  state: "ready" | "gap" | "not_applicable";
  evidence: string;
  source_url: string;
  previous_id?: string | null;
  observed_by: string;
  observed_name?: string;
  created_at: string;
}
export interface ActionablesData {
  institutions: Institution[];
  stages: Stage[];
  tasks: WorkItem[];
  updates: WorkResult[];
  staff: Person[];
  selections: Selection[];
  observations: Observation[];
  extensionsReady: boolean;
  canManage: boolean;
  actor?: ActionablesIdentity;
  referenceTasks: ReferenceTeamTask[];
}
export interface ActionablesIdentity {
  id: string;
  user_id: string;
  full_name: string;
}
export type WorkFilter =
  | "all"
  | "active"
  | "attention"
  | "overdue"
  | "blocked"
  | "followup"
  | "report"
  | "unassigned"
  | "done";
export const FILTER_LABELS: Record<WorkFilter, string> = {
  all: "All work",
  active: "Current work",
  attention: "Needs attention",
  overdue: "Past due",
  blocked: "Needs support",
  followup: "Follow-ups due",
  report: "To report",
  unassigned: "Needs an owner",
  done: "Results recorded",
};
export function newest<T extends { id: string; created_at: string }>(
  rows: T[],
): T | undefined {
  return [...rows].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  )[0];
}
export function latestResult(task: WorkItem, updates: WorkResult[]) {
  return newest(updates.filter((u) => u.work_item_id === task.id));
}
export function latestSelections(rows: Selection[]) {
  const latest = new Map<string, Selection>();
  for (const r of [...rows].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  ))
    if (!latest.has(r.institution_id)) latest.set(r.institution_id, r);
  return latest;
}
export function selectedIds(rows: Selection[]) {
  return new Set(
    [...latestSelections(rows).values()]
      .filter((s) => s.selected)
      .map((s) => s.institution_id),
  );
}
export function duePassed(
  date?: string | null,
  at?: string | null,
  now = new Date(),
  includeToday = false,
) {
  if (at) {
    const t = Date.parse(at);
    return Number.isFinite(t) && t <= now.getTime();
  }
  return Boolean(
    date &&
      (includeToday
        ? date <= localIST(now.toISOString()).date
        : date < localIST(now.toISOString()).date),
  );
}
export function workFlags(
  task: WorkItem,
  updates: WorkResult[],
  now = new Date(),
) {
  const latest = latestResult(task, updates);
  return {
    overdue:
      task.status !== "done" && duePassed(task.due_date, task.due_at, now),
    blocked: task.status === "blocked",
    followup: Boolean(
      latest &&
        duePassed(latest.follow_up_date, latest.follow_up_at, now, true),
    ),
    report: Boolean(latest?.report_to_id && !latest.reported),
    unassigned: !task.owner_id && task.status !== "done",
  };
}
export function matchesWork(
  task: WorkItem,
  updates: WorkResult[],
  filter: WorkFilter,
  now = new Date(),
) {
  const flags = workFlags(task, updates, now);
  return filter === "all"
    ? true
    : filter === "active"
      ? task.status !== "done" || Object.values(flags).some(Boolean)
      : filter === "done"
        ? task.status === "done"
        : filter === "attention"
          ? Object.values(flags).some(Boolean)
          : flags[filter];
}
export function workOrder(
  tasks: WorkItem[],
  updates: WorkResult[],
  now = new Date(),
) {
  const rank = (t: WorkItem) => {
    const f = workFlags(t, updates, now);
    return f.unassigned
      ? 0
      : f.blocked
        ? 1
        : f.overdue
          ? 2
          : f.followup
            ? 3
            : f.report
              ? 4
              : t.status === "done"
                ? 6
                : 5;
  };
  return [...tasks].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.due_at || a.due_date || "9999").localeCompare(
        b.due_at || b.due_date || "9999",
      ) ||
      a.title.localeCompare(b.title),
  );
}
export function institutionProgress(
  institutionId: string,
  stages: Stage[],
  tasks: WorkItem[],
) {
  const own = stages
    .filter((s) => s.institution_id === institutionId)
    .sort((a, b) => a.position - b.position);
  const done = own.filter((s) => s.completed_at).length;
  const next = own.find((s) => !s.completed_at);
  const delivered = Boolean(
    own.some((s) => s.stage_key === "handover" && s.completed_at) &&
      done === own.length &&
      tasks
        .filter((t) => t.institution_id === institutionId)
        .every((t) => t.status === "done"),
  );
  return {
    stages: own,
    done,
    total: own.length,
    next,
    delivered,
    percent: own.length ? Math.round((done / own.length) * 100) : 0,
  };
}
export function readiness(institutionId: string, observations: Observation[]) {
  const entries = READINESS_ITEMS.map((item) => ({
    item,
    latest: newest(
      observations.filter(
        (o) => o.institution_id === institutionId && o.criterion === item.key,
      ),
    ),
  }));
  const reviewed = entries.filter((e) => e.latest).length,
    gaps = entries.filter((e) => e.latest?.state === "gap").length;
  return {
    entries,
    reviewed,
    gaps,
    unknown: entries.length - reviewed,
    label: gaps
      ? "Gaps to resolve"
      : reviewed === entries.length
        ? "Checks recorded"
        : "Review in progress",
  };
}
export function capacityEstimate(
  institutions: Institution[],
  ids: Set<string>,
  days: number,
  utilisation: number,
  sessions: number,
) {
  const targets = institutions.filter((i) => ids.has(i.id));
  const known = targets.filter(
    (i) => i.lab_seat_capacity != null && i.lab_seat_capacity >= 0,
  );
  const seats = known.reduce((n, i) => n + (i.lab_seat_capacity || 0), 0);
  const complete = targets.length > 0 && known.length === targets.length;
  return {
    seats,
    known: known.length,
    targets: targets.length,
    complete,
    estimate:
      complete &&
      days >= 0 &&
      utilisation >= 0 &&
      utilisation <= 100 &&
      sessions >= 0
        ? Math.floor(seats * days * (utilisation / 100) * sessions)
        : null,
  };
}
