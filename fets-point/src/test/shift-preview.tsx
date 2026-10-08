// Local design fixtures only. This entry is not included in the production build.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ShiftWorkplace } from "../redesign/DutyWorkspace";
import { createDayPlan } from "../redesign/shift-plan";
import { centreDate } from "../redesign/operations-data";
const team = ["Maya Joseph", "Arun Menon", "Sara Thomas", "Neha Nair"].map(
  (name, i) => ({ id: `p${i}`, userId: `p${i}`, name, code: "D" }),
);
const day = centreDate();
const plan = createDayPlan(team);
plan.availability.forEach((a) => (a.confirmed = true));
const jobs = [
  {
    id: "r1",
    title: "Prepare the exam lab",
    details:
      "Use the station checklist. Replace faulty equipment and report anything unresolved before candidates enter.",
    expected_result:
      "Every active station passes the readiness check. Faults have a named follow-up and the lead knows which stations are ready.",
    due_minute: 540,
    priority: "important",
    owner_id: "p1",
    backup_id: "p2",
    area: "exam",
  },
  {
    id: "r2",
    title: "Call tomorrow’s candidates",
    details:
      "Confirm time, ID requirements and travel directions. Record the call outcome in Actionables.",
    expected_result:
      "Tomorrow’s candidates have clear joining instructions, with unreachable candidates marked for follow-up.",
    due_minute: 900,
    priority: "normal",
    owner_id: "p1",
    backup_id: "p3",
    area: "exam",
  },
  {
    id: "r3",
    title: "Check printing & supplies",
    details: "Check the reorder levels with the stock sheet.",
    expected_result:
      "The stock sheet is up to date and the lead has the list of supplies to order.",
    due_minute: 840,
    priority: "normal",
    owner_id: "p1",
    backup_id: "p2",
    area: "office",
  },
  {
    id: "r4",
    title: "File the centre problem report",
    details: "Use the provider format and keep the case reference.",
    expected_result:
      "Today’s unresolved incident has been reported with a traceable case reference and the next follow-up is agreed.",
    due_minute: 960,
    priority: "important",
    owner_id: "p2",
    backup_id: "p0",
    area: "exam",
  },
  {
    id: "r5",
    title: "Check the backup internet line",
    details: "Test the failover and restore the main connection.",
    expected_result: "Failover is checked and the outcome recorded.",
    due_minute: 570,
    priority: "normal",
    owner_id: null,
    backup_id: null,
    area: "tech",
  },
].map((r, i) => ({
  ...r,
  branch: "cochin",
  frequency: "daily",
  weekday: null,
  monthday: null,
  position: i,
  active: true,
}));
let tasks: any[] = [
  {
    ...jobs[2],
    id: "t3",
    day,
    responsibility_id: "r3",
    assigned_to: "p1",
    status: "blocked",
    note: "The stock sheet is locked. I need access from the office lead.",
    support_category: "equipment",
    completion_note: "",
    done_by: null,
    done_at: null,
    version: 1,
  },
  {
    ...jobs[3],
    id: "t4",
    day,
    responsibility_id: "r4",
    assigned_to: "p2",
    status: "done",
    note: "",
    completion_note:
      "Case CPR-EXAMPLE is filed. The provider confirmed receipt; next follow-up tomorrow morning.",
    done_by: "p2",
    done_at: new Date().toISOString(),
    version: 1,
  },
];
const repository: any = {
  roster: async () => team,
  load: async () => ({
    record: {
      id: "preview",
      branch: "cochin",
      day,
      lead_id: "p0",
      plan,
      status: "published",
      version: 1,
    },
    lead: { lead_id: "p0" },
    events: [],
    changes: [],
    closed: false,
  }),
  reports: async () => [],
  monthRoster: async () => ({ [day]: team }),
  leads: async () => [],
};
const blueprint: any = {
  staff: async () => team,
  responsibilities: async () => jobs,
  tasks: async () => tasks,
  actionables: async () => [],
};
const note: any = {
  id: "n1",
  branch: "cochin",
  profile_id: "p1",
  kind: "training",
  evidence: "Two readiness checks needed help locating the spare equipment.",
  context:
    "Arun is new to the storage layout. The lab checks were completed with support.",
  action:
    "Maya will walk through the equipment store with Arun before the next shift.",
  review_on: day,
  status: "open",
  staff_response: "A quick walkthrough would help me find the right spares.",
  created_at: new Date().toISOString(),
  created_by: "p0",
  evidence_snapshot: [],
};
function Preview() {
  const [role, setRole] = useState("staff");
  const me = role === "staff" ? "p1" : "p0";
  const work: any = {
    access: async () => ({
      lead: role !== "staff",
      manager: role === "manager",
    }),
    ensure: async (i: any) =>
      i.task || {
        ...i.responsibility,
        id: `t-${i.key}`,
        day,
        assigned_to: i.assignee,
        responsibility_id: i.responsibility.id,
        status: "open",
        version: 1,
      },
    action: async (t: any, a: string, n: string, c: string) => {
      const next = {
        ...t,
        version: t.version + 1,
        status: a === "complete" ? "done" : a === "help" ? "blocked" : "open",
        completion_note: a === "complete" ? n : t.completion_note,
        done_by: a === "complete" ? me : t.done_by,
        done_at: a === "complete" ? new Date().toISOString() : t.done_at,
        support_category: c,
        note: n,
        started_at: new Date().toISOString(),
        verified_by: a === "verify" ? me : null,
        verified_at: a === "verify" ? new Date().toISOString() : null,
      };
      if (a === "verify") next.status = "done";
      tasks = [...tasks.filter((x) => x.id !== t.id), next];
      return next;
    },
    activity: async () => [],
    history: async () => tasks,
    notes: async () => [note],
    saveNote: async (i: any) => ({
      ...i,
      id: "local-note",
      created_by: me,
      evidence_snapshot: [],
      status: "open",
      staff_response: "",
    }),
  };
  return (
    <>
      <div className="preview-banner">
        <span>LOCAL DESIGN PREVIEW · Fictional staff and records</span>
        <select
          aria-label="Preview role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="staff">Staff view</option>
          <option value="lead">Lead view</option>
          <option value="manager">Management view</option>
        </select>
      </div>
      <div className="preview-nav">
        <strong>fets.live</strong>
        <div>
          <span>Calendar</span>
          <span>Roster</span>
          <span>My Desk</span>
          <span>Actionables</span>
          <span className="active">The Shift</span>
        </div>
      </div>
      <ShiftWorkplace
        key={role}
        branch="cochin"
        navigate={() => {}}
        identity={{
          id: me,
          profileId: me,
          name: team.find((p) => p.id === me)!.name,
          admin: role === "manager",
        }}
        repository={repository}
        blueprint={blueprint}
        work={work}
        workflowReady
      />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
