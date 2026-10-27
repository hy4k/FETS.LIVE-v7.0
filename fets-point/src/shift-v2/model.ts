export const DUTIES = {
  opening: { label: "Centre Opening", color: "#d8a742", steps: [] },
  front: {
    label: "Front Office — ID Verify",
    color: "#4a9992",
    steps: [
      "Collect and verify candidate ID",
      "Give the candidate briefing",
      "Issue a locker key",
      "Check in the candidate on FETS Online",
    ],
  },
  calling: {
    label: "Candidate Calling",
    color: "#7c80bb",
    steps: ["Call checked-in candidates from FETS Online"],
  },
  security: {
    label: "Security Scan",
    color: "#c68671",
    steps: ["Complete the candidate security scan"],
  },
  proadmin: {
    label: "Pro Admin Check-in",
    color: "#748bc4",
    steps: [
      "Verify the candidate phone number",
      "Complete Pro Admin check-in",
      "Brief with workstation details",
      "Escort the candidate to the seat",
    ],
  },
  monitor: { label: "Hall Monitor & DVR", color: "#598a63", steps: [] },
  admin: {
    label: "Admin & Filing",
    color: "#a78aaf",
    steps: [
      "Complete CPR filing",
      "Complete Service Direct filing",
      "Update the database",
      "Update the calendar",
    ],
  },
  training: {
    label: "Training",
    color: "#719bba",
    steps: ["Complete the scheduled training"],
  },
  break: { label: "Break", color: "#aa9c84", steps: [] },
  checkout: {
    label: "Check-out & Sign-out",
    color: "#b38c55",
    steps: [
      "Complete workstation checkout",
      "Collect the locker key and return ID",
      "Record sign-out on FETS Online",
    ],
  },
  handover: {
    label: "Handover",
    color: "#9b7d65",
    steps: [
      "Hand over the monitoring log",
      "Confirm remaining candidates and pending work",
    ],
  },
  other: { label: "Other assigned work", color: "#8a939c", steps: [] },
  closing: {
    label: "Centre Close",
    color: "#6c8587",
    steps: [
      "Confirm the hall is empty and candidates are signed out",
      "Hand over the log and pending filing",
    ],
  },
} as const;
export type Duty = keyof typeof DUTIES;
export type Person = {
  id: string;
  name: string;
  start: number;
  end: number;
  support?: boolean;
  supportReason?: string;
};
export type Task = { id: string; label: string };
export type Block = {
  id: string;
  staff: string;
  start: number;
  end: number;
  duties: Duty[];
  tasks: Task[];
  cover?: string;
  note: string;
};
export type Plan = {
  schema: 2;
  programme: string;
  template: "custom" | "cma-us";
  people: Person[];
  monitoring: { start: number; end: number }[];
  opening: (Task & { owner: string })[];
  openingBy?: number;
  blocks: Block[];
  notes: string;
};
export type Day = {
  id: string;
  branch: string;
  day: string;
  lead_id: string | null;
  status: "draft" | "published" | "closed";
  version: number;
  plan: Plan;
  updated_at: string;
  report?: string;
};
export type WorkEvent = {
  id: string;
  day_id: string;
  block_id: string | null;
  task_id: string;
  kind: "done" | "verify" | "return" | "help" | "handover";
  actor_id: string;
  note: string;
  created_at: string;
};
export type Slot = {
  block: number;
  kind: "walk" | "dvr";
  due: number;
  owner_id: string | null;
  owner_name: string | null;
  event: null | {
    id: string;
    actor_id: string;
    actor_name: string;
    created_at: string;
    note: string;
  };
};
export type Checks = {
  connected: true;
  server_now: string;
  viewer_id?: string;
  viewer_rostered?: boolean;
  plan: null | {
    id: string;
    day: string;
    branch: string;
    version: number;
    closed: boolean;
    format?: number;
    tracking_from?: string;
  };
  checks: Slot[];
  reason?: string;
};
export const clock = (v: number) =>
  !Number.isFinite(v)
    ? "—"
    : `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
export const minute = (v: string) => {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
export const uid = () => crypto.randomUUID();
export const emptyPlan = (people: Person[] = []): Plan => ({
  schema: 2,
  programme: "",
  template: "custom",
  people,
  monitoring: [],
  opening: [],
  blocks: [],
  notes: "",
});
export const newBlock = (person: Person, duty: Duty = "monitor"): Block => ({
  id: uid(),
  staff: person.id,
  start: person.start,
  end: person.end,
  duties: [duty],
  tasks: [],
  note: "",
});
export const cmaOpening = [
  "Switch on AC in all rooms",
  "Place room fresheners",
  "Check DVR recording and cameras",
  "Arrange the front office",
  "Prepare the TV display",
  "Switch on candidate workstations",
  "Switch on server and admin systems",
  "Confirm RMA is running",
  "Print roster and sign-in sheet",
  "Upload roster and sign-in sheet to FETS Live",
  "Open FETS Online on admin systems",
  "Open FETS Online on the hall TV",
];
export const personName = (p: Plan, id: string | null | undefined) =>
  p.people.find((x) => x.id === id)?.name || "Unassigned";
export function ownerAt(plan: Plan, t: number) {
  const matches = plan.blocks.filter(
    (b) => b.duties.includes("monitor") && b.start <= t && t < b.end,
  );
  return matches.length === 1 ? matches[0].staff : null;
}
export function slots(plan: Plan) {
  return plan.monitoring
    .flatMap((w, block) =>
      [...(["walk", "dvr"] as const)].flatMap((kind) => {
        const step = kind === "walk" ? 10 : 6;
        const out: Slot[] = [];
        for (let due = w.start + step; due <= w.end; due += step) {
          const owner = ownerAt(plan, due - 1);
          out.push({
            block,
            kind,
            due,
            owner_id: owner,
            owner_name: personName(plan, owner),
            event: null,
          });
        }
        return out;
      }),
    )
    .sort((a, b) => a.due - b.due || a.kind.localeCompare(b.kind));
}
export function validate(plan: Plan): string[] {
  const issues: string[] = [];
  const range = (s: number, e: number) =>
    Number.isInteger(s) && Number.isInteger(e) && s >= 0 && s < e && e <= 1440;
  if (!plan.people.length) issues.push("Add the staff working this day.");
  if (!plan.monitoring.length)
    issues.push("Set the monitoring period from the actual exam schedule.");
  for (const p of plan.people)
    if (!range(p.start, p.end)) issues.push(`${p.name}: confirm shift hours.`);
  const windows = [...plan.monitoring].sort((a, b) => a.start - b.start);
  for (let n = 0; n < windows.length; n++) {
    const w = windows[n];
    if (!range(w.start, w.end))
      issues.push("Monitoring periods need valid start and end times.");
    if (n && windows[n - 1].end > w.start)
      issues.push("Monitoring periods overlap.");
  }
  const ids = new Set<string>();
  for (const b of plan.blocks) {
    if (ids.has(b.id)) issues.push("A duty block is duplicated.");
    ids.add(b.id);
    const p = plan.people.find((x) => x.id === b.staff);
    if (
      !p ||
      !range(b.start, b.end) ||
      b.start < (p?.start ?? 0) ||
      b.end > (p?.end ?? 0)
    )
      issues.push(
        `${p?.name || "Unknown staff"}: duty outside saved shift hours.`,
      );
    if (!b.duties.length) issues.push("Choose a duty for every block.");
    if (
      (b.duties.includes("break") || b.duties.includes("training")) &&
      b.duties.length > 1
    )
      issues.push(
        `${p?.name}: break/training must be separate from working duties.`,
      );
    if (
      b.duties.includes("monitor") &&
      b.duties.some((d) =>
        ["front", "calling", "security", "proadmin", "opening"].includes(d),
      )
    )
      issues.push(`${p?.name}: monitoring cannot share an admission duty.`);
    if (b.duties.includes("other") && !b.note.trim() && !b.tasks.length)
      issues.push(
        "Describe other assigned work with instructions or checklist items.",
      );
    for (const t of b.tasks)
      if (!t.label.trim()) issues.push("Checklist items need a description.");
  }
  for (const p of plan.people) {
    const b = plan.blocks
      .filter((x) => x.staff === p.id)
      .sort((a, b) => a.start - b.start);
    if (
      !b.length ||
      b[0].start !== p.start ||
      b[b.length - 1].end !== p.end ||
      b.some((x, i) => i > 0 && b[i - 1].end < x.start)
    )
      issues.push(`${p.name}: assign the whole saved shift, including breaks.`);
    for (let n = 1; n < b.length; n++)
      if (b[n - 1].end > b[n].start)
        issues.push(`${p.name}: overlapping duty blocks.`);
  }
  for (const w of windows) {
    if (!range(w.start, w.end)) continue;
    let gap = false,
      duplicate = false;
    for (let t = w.start; t < w.end; t++) {
      const owners = plan.blocks.filter(
        (b) => b.start <= t && t < b.end && b.duties.includes("monitor"),
      );
      if (!owners.length) gap = true;
      if (owners.length > 1) duplicate = true;
    }
    if (gap)
      issues.push(
        `${clock(w.start)}–${clock(w.end)}: monitoring has an uncovered gap.`,
      );
    if (duplicate)
      issues.push(
        `${clock(w.start)}–${clock(w.end)}: choose one monitoring owner at a time.`,
      );
  }
  for (const b of plan.blocks.filter((x) => x.duties.includes("break"))) {
    for (const w of windows) {
      for (
        let t = Math.max(b.start, w.start);
        t < Math.min(b.end, w.end);
        t++
      ) {
        if (!b.cover || b.cover === b.staff || ownerAt(plan, t) !== b.cover) {
          issues.push(
            `${personName(plan, b.staff)}: name the person actually monitoring during the break.`,
          );
          break;
        }
      }
    }
  }
  if (plan.opening.length && !Number.isInteger(plan.openingBy))
    issues.push("Set the opening checklist deadline.");
  for (const t of plan.opening)
    if (!t.label.trim() || !plan.people.some((p) => p.id === t.owner))
      issues.push("Assign every opening checklist item to one staff member.");
  return [...new Set(issues)];
}
export function copyPlan(plan: Plan, people: Person[]) {
  return {
    ...plan,
    people,
    blocks: plan.blocks
      .filter((b) => people.some((p) => p.id === b.staff))
      .map((b) => ({
        ...b,
        id: uid(),
        tasks: b.tasks.map((t) => ({ ...t, id: uid() })),
      })),
    opening: plan.opening.map((t) => ({
      ...t,
      id: uid(),
      owner: people.some((p) => p.id === t.owner) ? t.owner : "",
    })),
  };
}
export const slotState = (snapshot: Checks, c: Slot, now: number) => {
  if (c.event) return "recorded";
  if (!snapshot.plan) return "unavailable";
  const due = Date.parse(snapshot.plan.day + "T00:00:00+05:30") + c.due * 60000;
  if (
    snapshot.plan.tracking_from &&
    due < Date.parse(snapshot.plan.tracking_from)
  )
    return "not-tracked";
  if (now < due) return "upcoming";
  if (now >= due + (c.kind === "walk" ? 10 : 6) * 60000) return "missed";
  return snapshot.plan.closed ? "closed" : "due";
};
