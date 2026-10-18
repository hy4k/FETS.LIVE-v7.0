// Local design fixtures only. This entry is not included in the production build.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ShiftWorkplace } from "../redesign/DutyWorkspace";
import { createDayPlan, monday } from "../redesign/shift-plan";
import { centreDate } from "../redesign/operations-data";
const ActualDate = Date;
let previewTime = "09:37";
// A fixed local sample day keeps the preview useful outside centre working hours.
const sampleNow = () => ActualDate.parse(`2026-10-19T${previewTime}:00+05:30`);
class PreviewDate extends ActualDate {
  constructor(...args: any[]) {
    super(...((args.length ? args : [sampleNow()]) as [number]));
  }
  static now() {
    return sampleNow();
  }
}
globalThis.Date = PreviewDate as DateConstructor;
const team = ["Maya Joseph", "Arun Menon", "Sara Thomas", "Neha Nair"].map(
  (name, i) => ({ id: `p${i}`, userId: `p${i}`, name, code: "D" }),
);
const day = centreDate();
const plan = createDayPlan(team);
plan.availability.forEach((a) => (a.confirmed = true));
plan.breaks.forEach((b) => {
  b.cover = "p3";
  b.note = "The floating cover handles this post and its checks.";
});
let jobs = [
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
let events: any[] = [];
let changes: any[] = [];
let reports: any[] = [];
let leads: any[] = [
  { branch: "cochin", week_start: monday(day), lead_id: "p0", version: 1 },
];
let sampleRecord: any = {
  id: "preview",
  branch: "cochin",
  day,
  lead_id: "p0",
  plan,
  status: "published",
  version: 1,
};
let sampleActor = "p1";
let closed = false;
const repository: any = {
  roster: async (_branch: string, date: string) => (date === day ? team : []),
  load: async (_branch: string, date: string) => ({
    record: date === day ? structuredClone(sampleRecord) : null,
    lead: leads.find((l) => l.week_start === monday(date)) || null,
    events: date === day ? events : [],
    changes: date === day ? changes : [],
    closed: date === day && closed,
  }),
  reports: async () => reports,
  report: async (
    record: any,
    summary: string,
    followups: string,
    recognition: string,
  ) => {
    const saved = {
      id: `preview-report-${reports.length}`,
      branch: record.branch,
      day: record.day,
      plan_id: record.id,
      summary,
      followups,
      recognition,
      created_at: new Date().toISOString(),
      acknowledged_at: null,
      snapshot: structuredClone({ plan: record.plan, events, changes, tasks }),
    };
    reports.push(saved);
    closed = true;
    return saved;
  },
  acknowledge: async (id: string) => {
    reports = reports.map((r) =>
      r.id === id ? { ...r, acknowledged_at: new Date().toISOString() } : r,
    );
  },
  monthRoster: async () => ({ [day]: team }),
  leads: async () => leads,
  saveLead: async (branch: string, week_start: string, lead_id: string) => {
    const saved = {
      branch,
      week_start,
      lead_id,
      version:
        (leads.find((l) => l.week_start === week_start)?.version || 0) + 1,
    };
    leads = [...leads.filter((l) => l.week_start !== week_start), saved];
    return saved;
  },
  savePlan: async (
    branch: string,
    date: string,
    lead_id: string,
    value: any,
    _previous: any,
    publish = false,
  ) => {
    sampleRecord = {
      ...sampleRecord,
      branch,
      day: date,
      lead_id,
      plan: structuredClone(value),
      status: publish ? "published" : "draft",
      version: sampleRecord.version + 1,
    };
    return sampleRecord;
  },
  change: async (input: any) => {
    const saved = {
      ...input,
      id: `preview-change-${changes.length}`,
      actor_id: sampleActor,
      created_at: new Date().toISOString(),
    };
    changes.push(saved);
    return saved;
  },
};
const blueprint: any = {
  staff: async () => team,
  responsibilities: async () => jobs,
  tasks: async (_branch: string, date: string) =>
    tasks.filter((t) => t.day === date),
  actionables: async () => [],
  saveResponsibility: async (input: any) => {
    const saved = {
      ...input,
      id: input.id || `preview-job-${jobs.length}`,
      active: true,
    };
    jobs = [...jobs.filter((j) => j.id !== saved.id), saved];
    return saved;
  },
  removeResponsibility: async (id: string) => {
    jobs = jobs.filter((j) => j.id !== id);
  },
  seed: async (input: any[]) => {
    jobs = input.map((j, i) => ({ ...j, id: `preview-seed-${i}` }));
    return jobs;
  },
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
let feedback: any[] = [note];
function Preview() {
  const [role, setRole] = useState("staff");
  const [time, setTime] = useState(previewTime);
  const me = role === "cover" ? "p3" : role === "staff" ? "p1" : "p0";
  sampleActor = me;
  const work: any = {
    access: async () => ({
      lead: ["lead", "manager"].includes(role),
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
      if (a === "return")
        Object.assign(next, {
          review_note: n,
          rework_count: (t.rework_count || 0) + 1,
          done_by: null,
          done_at: null,
        });
      if (a === "skip") next.status = "skipped";
      if (a === "reopen") Object.assign(next, { done_by: null, done_at: null });
      tasks = [...tasks.filter((x) => x.id !== t.id), next];
      return next;
    },
    assign: async (
      t: any,
      owner: string,
      due: number,
      priority: string,
      result: string,
      instructions: string,
    ) => {
      const saved = {
        ...t,
        assigned_to: owner,
        due_minute: due,
        priority,
        expected_result: result,
        instructions,
        version: t.version + 1,
      };
      if (t.status === "done")
        Object.assign(saved, {
          status: "open",
          done_by: null,
          done_at: null,
          completion_note: "",
          verified_at: null,
          verified_by: null,
        });
      tasks = [...tasks.filter((x) => x.id !== t.id), saved];
      return saved;
    },
    add: async (i: any) => {
      const saved = {
        ...i,
        id: `local-task-${tasks.length}`,
        responsibility_id: null,
        status: "open",
        note: "",
        version: 1,
      };
      tasks.push(saved);
      return saved;
    },
    closeNote: async (id: string, result: string) => {
      const saved = {
        ...feedback.find((n) => n.id === id),
        status: "closed",
        followup_result: result,
        closed_by: me,
      };
      feedback = feedback.map((n) => (n.id === id ? saved : n));
      return saved;
    },
    respond: async (id: string, response: string) => {
      const saved = {
        ...feedback.find((n) => n.id === id),
        staff_response: response,
      };
      feedback = feedback.map((n) => (n.id === id ? saved : n));
      return saved;
    },
    activity: async () => [],
    history: async () => tasks,
    notes: async () =>
      feedback.filter((n) => role === "manager" || n.profile_id === me),
    saveNote: async (i: any) => {
      const saved = {
        ...i,
        id: `local-note-${feedback.length}`,
        created_by: me,
        created_at: new Date().toISOString(),
        evidence_snapshot: tasks.filter((t) => i.task_ids.includes(t.id)),
        status: "open",
        staff_response: "",
      };
      feedback = [saved, ...feedback];
      return saved;
    },
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
          <option value="cover">Break cover view</option>
        </select>
        <select
          aria-label="Preview time"
          value={time}
          onChange={(e) => {
            previewTime = e.target.value;
            setTime(e.target.value);
          }}
        >
          <option value="08:17">08:17 · Lab walk</option>
          <option value="09:37">09:37 · Morning</option>
          <option value="10:07">10:07 · Break cover</option>
          <option value="10:37">10:37 · Staff break</option>
          <option value="11:07">11:07 · DVR check</option>
          <option value="17:10">17:10 · Day report</option>
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
        key={`${role}:${time}`}
        branch="cochin"
        navigate={() => {}}
        identity={{
          id: me,
          profileId: me,
          name: team.find((p) => p.id === me)!.name,
          admin: role === "manager",
        }}
        repository={{
          ...repository,
          event: async (i: any) => {
            const event = {
              ...i,
              id: `local-event-${events.length}`,
              actor_id: me,
              created_at: new Date().toISOString(),
            };
            events.push(event);
            return event;
          },
        }}
        blueprint={blueprint}
        work={work}
        workflowReady
      />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
