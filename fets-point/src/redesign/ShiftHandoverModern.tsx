// @ts-nocheck
import React from "react";
import {
  AlertTriangle, ArrowLeft, CalendarDays, Check, CheckCircle2,
  ChevronRight, ClipboardCheck, Clock3, History, Laptop, Loader2,
  Plus, RefreshCcw, Trash2, UserCheck, Users, XCircle,
  Settings, Bell, BarChart3
} from "lucide-react";
import * as DB from "./write-data";
import { supabase } from "../lib/supabase";
import "./shift-handover-modern.css";

const EMPTY_SUMMARY = {
  total_sessions: 0,
  scheduled: 0,
  attended: 0,
  no_shows: 0,
  sessions_completed: "yes",
  timing_exception: "no",
  incident_status: "none",
  client_report_status: "completed",
  notes: "",
};

const nowDate = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const titleBranch = (branch: string) => branch === "global" ? "All centres" : `${branch.charAt(0).toUpperCase()}${branch.slice(1)}`;
const initials = (name = "Staff") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
const displayDate = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function tomorrowOf(value: string) {
  const date = new Date(`${value || nowDate()}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date;
}

function sessionSnapshot(date: Date, branch: string) {
  try {
    return (window.FETS?.sessionsOn?.(date, branch) || []).map((session: any, index: number) => ({
      id: session.id || `${date.toISOString()}-${index}`,
      client: session.vendor || session.client || "Exam client",
      exam: session.exam || session.name || "Scheduled examination",
      start: session.start || "—",
      candidates: Number(session.count || session.candidate_count || 0),
    }));
  } catch {
    return [];
  }
}

function Field({ label, children, wide = false }: any) {
  return <label className={`sh-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
}

function Section({ number, eyebrow, title, description, children, action }: any) {
  return (
    <section className="sh-card">
      <div className="sh-section-head">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
          <div><span className="sh-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
          {action}
        </div>
        <span className="sh-section-number">{String(number).padStart(2, "0")}</span>
      </div>
      {children}
    </section>
  );
}

function StatusChoice({ value, onChange }: any) {
  return (
    <div className="sh-status-choice">
      {[
        ["ready", "Ready"], ["issue", "Issue found"], ["unchecked", "Not checked"],
      ].map(([id, label]) => (
        <button type="button" key={id} onClick={() => onChange(id)} className={`${id} ${value === id ? "active" : ""}`}>
          <i />{label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ value, onChange, yes = "Yes", no = "No" }: any) {
  return (
    <div className="sh-toggle">
      <button type="button" className={value === "yes" ? "active" : ""} onClick={() => onChange("yes")}>{yes}</button>
      <button type="button" className={value === "no" ? "active" : ""} onClick={() => onChange("no")}>{no}</button>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: any) {
  return <div className="sh-empty"><Icon size={28} /><strong>{title}</strong><p>{text}</p></div>;
}

function QuestionManagerModal({ open, onClose, onRefresh }: any) {
  const [questions, setQuestions] = React.useState<any[]>([]);
  const [newQuestion, setNewQuestion] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingLabel, setEditingLabel] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    const list = await DB.dbFetchHandoverQuestions();
    setQuestions(list);
  }, []);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function handleAdd() {
    if (!newQuestion.trim()) return;
    setLoading(true);
    await DB.dbMutateHandoverQuestion("add", newQuestion.trim());
    setNewQuestion("");
    await load();
    onRefresh();
    setLoading(false);
  }

  async function handleSave(id: string) {
    if (!editingLabel.trim()) return;
    setLoading(true);
    await DB.dbMutateHandoverQuestion("edit", editingLabel.trim(), id);
    setEditingId(null);
    await load();
    onRefresh();
    setLoading(false);
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`Are you sure you want to delete "${label}"?`)) return;
    setLoading(true);
    await DB.dbMutateHandoverQuestion("delete", "", id);
    await load();
    onRefresh();
    setLoading(false);
  }

  if (!open) return null;

  return (
    <div className="sh-modal-backdrop" onClick={onClose}>
      <div className="sh-modal-content" onClick={e => e.stopPropagation()}>
        <div className="sh-modal-header">
          <h3>Manage Checklist Questions</h3>
          <button type="button" onClick={onClose} className="sh-modal-close">&times;</button>
        </div>
        <div className="sh-modal-body">
          <div className="sh-add-question">
            <input
              type="text"
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              placeholder="Enter new question..."
            />
            <button type="button" onClick={handleAdd} disabled={loading || !newQuestion.trim()}>
              Add
            </button>
          </div>
          <div className="sh-question-list scroll-soft">
            {questions.map((q: any) => (
              <div key={q.id || q.label} className="sh-question-item">
                {editingId === q.id ? (
                  <div className="sh-question-edit">
                    <input
                      type="text"
                      value={editingLabel}
                      onChange={e => setEditingLabel(e.target.value)}
                    />
                    <button type="button" className="save-btn" onClick={() => handleSave(q.id)} disabled={loading}>Save</button>
                    <button type="button" className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <span>{q.label}</span>
                    {q.id && (
                      <div className="sh-actions">
                        <button type="button" className="edit-btn" onClick={() => { setEditingId(q.id); setEditingLabel(q.label); }}>✏️</button>
                        <button type="button" className="delete-btn" onClick={() => handleDelete(q.id, q.label)}>🗑️</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShiftEnd({ branch, onSubmitted, refreshQTrigger, onManageQuestions }: any) {
  const me = window.FETS?._meName || window.FETS?.user?.name || "Staff";
  const isAdmin = !!window.FETS?.isAdmin;
  const people = React.useMemo(() => {
    const centre = branch === "global" ? (window.FETS?._meBranch || "calicut") : branch;
    return Array.from(new Set(window.FETS?.STAFF?.[centre] || window.FETS?.PEOPLE || [])).filter(Boolean).sort();
  }, [branch]);
  const draftKey = `fets_handover_v2_draft_${branch}`;
  const [date, setDate] = React.useState(nowDate());
  const [time, setTime] = React.useState(nowTime());
  const [incoming, setIncoming] = React.useState<string[]>([]);
  const [overall, setOverall] = React.useState("ready");
  const [summary, setSummary] = React.useState({ ...EMPTY_SUMMARY });
  const [questions, setQuestions] = React.useState<any[]>([]);
  const [readiness, setReadiness] = React.useState<any>({});
  const [tasks, setTasks] = React.useState<any[]>([]);
  const [confirmed, setConfirmed] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const tomorrow = React.useMemo(() => tomorrowOf(date), [date]);
  const sessions = React.useMemo(() => sessionSnapshot(tomorrow, branch), [date, branch]);

  // Load active questions from database
  React.useEffect(() => {
    async function loadQ() {
      const list = await DB.dbFetchHandoverQuestions();
      setQuestions(list);
      setReadiness(prev => {
        const next = { ...prev };
        list.forEach((q: any) => {
          const id = q.id || q.label;
          if (!next[id]) {
            next[id] = { status: "ready", note: "" };
          }
        });
        return next;
      });
    }
    loadQ();
  }, [refreshQTrigger]);

  // Load draft
  React.useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (!stored) return;
      if (stored.date) setDate(stored.date);
      if (stored.time) setTime(stored.time);
      if (stored.incoming) setIncoming(stored.incoming);
      if (stored.overall) setOverall(stored.overall);
      if (stored.summary) setSummary({ ...EMPTY_SUMMARY, ...stored.summary });
      if (stored.readiness) setReadiness(stored.readiness);
      if (stored.tasks) setTasks(stored.tasks);
    } catch {}
  }, [draftKey]);

  // Save draft
  React.useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify({ date, time, incoming, overall, summary, readiness, tasks }));
  }, [date, time, incoming, overall, summary, readiness, tasks, draftKey]);

  // Sync incoming staff from assignments (primary) or roster fallback
  React.useEffect(() => {
    let alive = true;
    async function syncIncoming() {
      try {
        const day = tomorrow.toISOString().slice(0, 10);
        const br = branch === "global" ? (window.FETS?._meBranch || "calicut") : branch;
        
        // Try fetching handover assignment first
        const { data: assignData } = await supabase
          .from("handover_assignments")
          .select("staff_names")
          .eq("date", day)
          .eq("branch", br)
          .maybeSingle();
        
        if (!alive) return;

        if (assignData && assignData.staff_names && assignData.staff_names.length > 0) {
          setIncoming(assignData.staff_names);
          return;
        }

        // Fallback to roster schedules
        const { data } = await supabase
          .from("roster_schedules")
          .select("shift_code, branch_location, staff_profiles(full_name, branch_assigned)")
          .eq("date", day);
        if (!alive || !data) return;
        const rest = new Set(["rd", "off", "wo", "l", "leave", "lv", "h", "holiday", "to", "toil", "tr", "tp"]);
        const names = data.filter((row: any) => {
          const code = String(row.shift_code || "").toLowerCase();
          const rowBranch = String(row.branch_location || row.staff_profiles?.branch_assigned || "").toLowerCase();
          return code && !rest.has(code) && rowBranch.includes(br);
        }).map((row: any) => row.staff_profiles?.full_name).filter(Boolean);
        if (names.length) setIncoming(Array.from(new Set(names)) as string[]);
      } catch {}
    }
    syncIncoming();
    return () => { alive = false; };
  }, [date, branch, tomorrow]);

  // Autofill session and candidate attendance metrics from FETS.live context
  React.useEffect(() => {
    let alive = true;
    async function autofillData() {
      try {
        const br = branch === "global" ? (window.FETS?._meBranch || "calicut") : branch;
        // 1. Sessions
        const dt = new Date(`${date}T00:00:00`);
        const todaySessions = (window.FETS?.sessionsOn?.(dt, br) || []);
        const totalSessions = todaySessions.length;
        const totalScheduled = todaySessions.reduce((acc: number, s: any) => acc + Number(s.count || s.candidate_count || 0), 0);

        // 2. Candidates
        const { data: candidates, error } = await supabase
          .from('candidates')
          .select('status')
          .gte('exam_date', date)
          .lte('exam_date', `${date}T23:59:59.999Z`)
          .eq('branch_location', br);

        if (!alive) return;

        let attended = 0;
        let noShows = 0;
        if (!error && candidates) {
          attended = candidates.filter((c: any) => c.status === 'checked_in' || c.status === 'in_progress' || c.status === 'completed').length;
          noShows = candidates.filter((c: any) => c.status === 'no_show' || c.status === 'absent').length;
        }

        // Apply pre-population
        setSummary(prev => {
          const next = { ...prev };
          if (!next.total_sessions) next.total_sessions = totalSessions;
          if (!next.scheduled) next.scheduled = totalScheduled;
          if (!next.attended) next.attended = attended;
          if (!next.no_shows) next.no_shows = noShows || Math.max(0, totalScheduled - attended);
          return next;
        });
      } catch (err) {
        console.error("autofillData error:", err);
      }
    }
    autofillData();
    return () => { alive = false; };
  }, [date, branch]);

  const toggleIncoming = (name: string) => setIncoming((list) => list.includes(name) ? list.filter((x) => x !== name) : [...list, name]);
  const updateSummary = (key: string, value: any) => setSummary((state) => ({ ...state, [key]: value }));
  const updateReadiness = (id: string, patch: any) => setReadiness((state) => ({ ...state, [id]: { ...state[id], ...patch } }));
  const addTask = () => setTasks((list) => [...list, { id: crypto.randomUUID(), title: "", priority: "before_first_session", owner: incoming[0] || "", deadline: `${tomorrow.toISOString().slice(0, 10)}T08:00`, notes: "" }]);
  const updateTask = (id: string, patch: any) => setTasks((list) => list.map((task) => task.id === id ? { ...task, ...patch } : task));
  const removeTask = (id: string) => setTasks((list) => list.filter((task) => task.id !== id));

  const readinessRows = questions.map((q: any) => {
    const id = q.id || q.label;
    return {
      id,
      label: q.label,
      description: q.description || "",
      status: readiness[id]?.status || "ready",
      note: readiness[id]?.note || ""
    };
  });

  const issueCount = readinessRows.filter((item) => item.status === "issue").length;
  const uncheckedCount = readinessRows.filter((item) => item.status === "unchecked").length;
  const invalidTask = tasks.some((task) => !task.title.trim() || !task.owner || !task.deadline);
  const canSubmit = incoming.length > 0 && confirmed && uncheckedCount === 0 && !invalidTask;

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const outgoingUserId = window.FETS?._meUserId;
    const incomingIds = incoming.map((name) => window.FETS?._staffUserIdByName?.[name]).filter(Boolean);
    const sig = { name: me, user_id: outgoingUserId || null, time: new Date().toISOString() };
    const result = await DB.dbCreateHandover({
      branch: branch === "global" ? (window.FETS?._meBranch || "calicut") : branch,
      date,
      handover_time: time,
      outgoing_staff: [me],
      incoming_staff: incoming,
      outgoing_user_ids: outgoingUserId ? [outgoingUserId] : [],
      incoming_user_ids: incomingIds,
      currently_testing: Number(summary.attended) || 0,
      no_shows: Number(summary.no_shows) || 0,
      candidate_notes: summary.notes,
      checklist: readinessRows,
      pending_items: tasks,
      instructions: `Overall status: ${overall}`,
      sig_out: sig,
      overall_status: overall,
      total_sessions: Number(summary.total_sessions) || 0,
      scheduled_candidates: Number(summary.scheduled) || 0,
      attended_candidates: Number(summary.attended) || 0,
      sessions_completed: summary.sessions_completed === "yes",
      timing_exception: summary.timing_exception === "yes",
      incident_status: summary.incident_status,
      client_report_status: summary.client_report_status,
      next_day_sessions: sessions,
    });
    setSubmitting(false);
    if (result) {
      localStorage.removeItem(draftKey);
      onSubmitted?.();
    }
  }

  return (
    <div className="sh-stack">
      <div className="sh-page-intro">
        <div><span className="sh-page-kicker">SHIFT END · {titleBranch(branch).toUpperCase()}</span><h1>Close today. Prepare tomorrow.</h1><p>Record the day’s status and anything the opening team needs to know.</p></div>
        <span className="sh-saved"><CheckCircle2 size={14} /> Draft saved</span>
      </div>

      <Section number={1} eyebrow="Step 1" title="Handover details" description="Staff and timing for this handover.">
        <div className="sh-form-grid">
          <Field label="Centre"><input value={titleBranch(branch)} disabled /></Field>
          <Field label="Handover date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Closing staff"><input value={me} disabled /></Field>
          <Field label="Closing time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <div className="sh-sub-label">Next opening staff</div>
        <div className="sh-people">
          {people.filter((name: string) => name !== me).map((name: string) => <button type="button" key={name} className={incoming.includes(name) ? "active" : ""} onClick={() => toggleIncoming(name)}><span>{initials(name)}</span>{name}{incoming.includes(name) && <Check size={13} />}</button>)}
        </div>
        {!incoming.length && <p className="sh-inline-error">Select at least one opening staff member.</p>}
        <div className="sh-sub-label">Overall centre status</div>
        <div className="sh-overall">
          {[
            ["ready", "Ready for next day", "Everything is ready"],
            ["minor", "Ready with minor issues", "Operations can continue"],
            ["attention", "Attention required", "Action needed before opening"],
            ["not_ready", "Not ready", "Manager action required"],
          ].map(([id, label, detail]) => <button type="button" key={id} className={overall === id ? "active" : ""} onClick={() => setOverall(id)}><i className={id} /><span><strong>{label}</strong><small>{detail}</small></span>{overall === id && <Check size={14} />}</button>)}
        </div>
      </Section>

      <Section number={2} eyebrow="Step 2" title="Today’s closing summary" description="Completed sessions, candidate counts and exceptions.">
        <div className="sh-metrics">
          {[["total_sessions", "Total sessions"], ["scheduled", "Scheduled"], ["attended", "Attended"], ["no_shows", "No-shows"]].map(([key, label]) => <Field key={key} label={label}><input type="number" min="0" value={summary[key]} onChange={(e) => updateSummary(key, e.target.value)} /></Field>)}
        </div>
        <div className="sh-questions">
          <div><span><strong>All sessions completed?</strong><small>Confirm every scheduled session has ended.</small></span><Toggle value={summary.sessions_completed} onChange={(value: string) => updateSummary("sessions_completed", value)} /></div>
          <div><span><strong>Any late start or late finish?</strong><small>Record any timing exception.</small></span><Toggle value={summary.timing_exception} onChange={(value: string) => updateSummary("timing_exception", value)} /></div>
          <div><span><strong>Incidents today</strong><small>Detailed cases should remain in Incident Logger.</small></span><select value={summary.incident_status} onChange={(e) => updateSummary("incident_status", e.target.value)}><option value="none">No incident</option><option value="linked">Incident linked</option><option value="pending">Reporting pending</option></select></div>
          <div><span><strong>Required client reports / CPR</strong><small>Select the correct completion status.</small></span><select value={summary.client_report_status} onChange={(e) => updateSummary("client_report_status", e.target.value)}><option value="completed">Completed</option><option value="not_applicable">Not applicable</option><option value="pending">Pending</option></select></div>
        </div>
        <Field label="Important notes from today" wide><textarea rows={3} value={summary.notes} onChange={(e) => updateSummary("notes", e.target.value)} placeholder="Add only information the next team needs to know…" /></Field>
      </Section>

      <Section number={3} eyebrow="Step 3" title="Next-day exam schedule" description={`${displayDate(tomorrow.toISOString().slice(0, 10))} · automatically loaded from Calendar.`}>
        {sessions.length ? <div className="sh-sessions">{sessions.map((session: any) => <div key={session.id}><span className="sh-session-time">{session.start}</span><span className="sh-session-logo">{String(session.client).slice(0, 1).toUpperCase()}</span><span><strong>{session.client} · {session.exam}</strong><small>Scheduled examination</small></span><span className="sh-session-count"><strong>{session.candidates}</strong><small>candidates</small></span></div>)}</div> : <EmptyState icon={CalendarDays} title="No sessions found" text="Add tomorrow’s sessions in FETS Calendar if this is not correct." />}
      </Section>

      <Section
        number={4}
        eyebrow="Step 4"
        title="Centre readiness"
        description="Use Not checked when a closing verification was not performed."
        action={isAdmin && (
          <button type="button" className="sh-manage-q-btn" onClick={onManageQuestions}>
            <Settings size={14} /> Manage Questions
          </button>
        )}
      >
        <div className="sh-readiness">
          {readinessRows.map((item: any) => {
            return <div className={`sh-ready-row ${item.status === "issue" ? "has-issue" : ""}`} key={item.id}>
              <span className="sh-ready-icon"><Laptop size={16} /></span><span className="sh-ready-name"><strong>{item.label}</strong><small>{item.description}</small></span>
              <StatusChoice value={item.status} onChange={(value: string) => updateReadiness(item.id, { status: value })} />
              {item.status === "issue" && <label className="sh-issue-note"><span>Issue details required</span><input value={item.note} onChange={(e) => updateReadiness(item.id, { note: e.target.value })} placeholder="What is wrong, what was done, and what remains?" /></label>}
            </div>;
          })}
        </div>
        {(issueCount > 0 || uncheckedCount > 0) && <div className="sh-warning"><AlertTriangle size={18} /><p><strong>{issueCount} issue{issueCount === 1 ? "" : "s"}, {uncheckedCount} not checked.</strong> Unchecked items must be reviewed before submission.</p></div>}
      </Section>

      <Section number={5} eyebrow="Step 5" title="Pending tasks" description="Every pending action needs an owner and deadline.">
        <div className="sh-task-list">
          {tasks.map((task) => <div className="sh-task" key={task.id}>
            <div className="sh-task-top"><select value={task.priority} onChange={(e) => updateTask(task.id, { priority: e.target.value })}><option value="critical">Critical</option><option value="before_first_session">Before first session</option><option value="today">Today</option><option value="routine">Routine</option></select><button type="button" onClick={() => removeTask(task.id)} title="Remove task"><Trash2 size={16} /></button></div>
            <input className="sh-task-title" value={task.title} onChange={(e) => updateTask(task.id, { title: e.target.value })} placeholder="What needs to be done?" />
            <div className="sh-task-grid"><Field label="Assigned to"><select value={task.owner} onChange={(e) => updateTask(task.id, { owner: e.target.value })}><option value="">Select owner</option>{people.map((name: string) => <option key={name}>{name}</option>)}</select></Field><Field label="Deadline"><input type="datetime-local" value={task.deadline} onChange={(e) => updateTask(task.id, { deadline: e.target.value })} /></Field></div>
            <textarea rows={2} value={task.notes} onChange={(e) => updateTask(task.id, { notes: e.target.value })} placeholder="Supporting note or reference (optional)" />
          </div>)}
        </div>
        {!tasks.length && <p className="sh-no-tasks">No pending tasks added.</p>}
        <button type="button" className="sh-add" onClick={addTask}><Plus size={15} /> Add pending task</button>
      </Section>

      <Section number={6} eyebrow="Final step" title="Confirm and send handover" description="The opening staff will receive this record for review and acceptance.">
        <label className="sh-declaration"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span><strong>I confirm that this handover is accurate.</strong><small>All known incidents, technical issues and pending actions have been recorded or linked.</small></span></label>
        <div className="sh-signature"><span>{initials(me)}</span><span><strong>{me}</strong><small>Closing staff · {titleBranch(branch)}</small></span><small>Digitally signed on submission</small></div>
        <button type="button" className="sh-primary" disabled={!canSubmit || submitting} onClick={submit}>{submitting ? <><Loader2 className="spin" size={16} /> Submitting…</> : <>Submit shift handover <ChevronRight size={17} /></>}</button>
        {!canSubmit && <p className="sh-submit-help">Select incoming staff, complete all readiness checks, fix incomplete tasks and confirm the declaration.</p>}
      </Section>
    </div>
  );
}

function ShiftBeginning({ branch, refreshKey, onAccepted }: any) {
  const me = window.FETS?._meName || window.FETS?.user?.name || "Staff";
  const [items, setItems] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [checks, setChecks] = React.useState([true, false, false, false]);
  const [status, setStatus] = React.useState("ready");
  const [comment, setComment] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [signing, setSigning] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const rows = await DB.dbFetchPendingHandovers(me, window.FETS?._meUserId);
    const relevant = (rows || []).filter((row: any) => branch === "global" || row.branch === branch || row.branch === "all");
    setItems(relevant);
    setSelected((current: any) => relevant.find((row: any) => row.id === current?.id) || relevant[0] || null);
    setLoading(false);
  }, [me, branch]);

  React.useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <div className="sh-loading"><Loader2 className="spin" /> Loading handover…</div>;
  if (!selected) return <EmptyState icon={ClipboardCheck} title="No handover awaiting you" text="New handovers assigned to you will appear here before your next shift." />;

  const summary = {
    total: selected.total_sessions ?? "—",
    attended: selected.attended_candidates ?? selected.currently_testing ?? 0,
    noShow: selected.no_shows ?? 0,
    incidents: selected.incident_status === "none" ? 0 : selected.incident_status ? 1 : "—",
  };
  const sessions = selected.next_day_sessions || [];
  const tasks = selected.pending_items || [];
  const completeCount = checks.filter(Boolean).length;
  const acceptEnabled = completeCount === 4 && confirmed && (status === "ready" || comment.trim());

  async function accept() {
    if (!acceptEnabled || signing) return;
    setSigning(true);
    const sig = { name: me, user_id: window.FETS?._meUserId || null, time: new Date().toISOString(), acceptance_status: status };
    const result = await DB.dbCompleteHandover(selected.id, sig, comment);
    setSigning(false);
    if (result) {
      setChecks([true, false, false, false]); setConfirmed(false); setComment(""); setStatus("ready");
      await load(); onAccepted?.();
    }
  }

  return (
    <div className="sh-stack">
      <div className="sh-page-intro">
        <div><span className="sh-page-kicker">SHIFT BEGINNING · {titleBranch(branch).toUpperCase()}</span><h1>Good morning, {me.split(" ")[0]}.</h1><p>Review the previous handover, verify the centre and take charge of today’s shift.</p></div>
        <div className="sh-from"><span>{initials(selected.sig_out?.name || selected.outgoing_staff?.[0])}</span><span><small>Handover from</small><strong>{selected.sig_out?.name || selected.outgoing_staff?.join(", ")}</strong><small>{displayDate(selected.date)} · {selected.handover_time}</small></span></div>
      </div>

      {(selected.overall_status === "attention" || selected.overall_status === "not_ready" || tasks.length > 0) && <div className="sh-opening-alert"><AlertTriangle size={20} /><span><strong>{tasks.length || 1} item{tasks.length === 1 ? "" : "s"} needs attention</strong><small>Review the pending action before beginning operations.</small></span></div>}

      <Section number={1} eyebrow="Previous shift" title="Handover summary" description={`Submitted by ${(selected.outgoing_staff || []).join(", ")} on ${displayDate(selected.date)}.`}>
        <div className={`sh-summary-status ${selected.overall_status || "ready"}`}><i /><span><strong>{selected.overall_status === "minor" ? "Ready with minor issues" : selected.overall_status === "attention" ? "Attention required" : selected.overall_status === "not_ready" ? "Not ready" : "Ready for the day"}</strong><small>Read the notes and actions before accepting responsibility.</small></span><em><Check size={13} /> Submitted</em></div>
        <div className="sh-summary-metrics"><div><strong>{summary.total}</strong><span>Sessions</span></div><div><strong>{summary.attended}</strong><span>Attended</span></div><div><strong>{summary.noShow}</strong><span>No-show</span></div><div><strong>{summary.incidents}</strong><span>Incidents</span></div></div>
        <div className="sh-closing-note"><span>Closing note</span><p>{selected.candidate_notes || "No additional closing note."}</p></div>
      </Section>

      <Section number={2} eyebrow="Today" title="Today’s exam schedule" description="Sessions passed to the opening shift.">
        {sessions.length ? <div className="sh-sessions">{sessions.map((session: any, index: number) => <div key={session.id || index}><span className="sh-session-time">{session.start}</span><span className="sh-session-logo">{String(session.client || "E").slice(0, 1).toUpperCase()}</span><span><strong>{session.client} · {session.exam}</strong><small>Scheduled examination</small></span><span className="sh-session-count"><strong>{session.candidates}</strong><small>candidates</small></span></div>)}</div> : <EmptyState icon={CalendarDays} title="No schedule stored in this handover" text="Check FETS Calendar for today’s live schedule." />}
      </Section>

      <Section number={3} eyebrow="Opening check" title="Verify before operations" description="Complete these checks after reaching the centre.">
        <div className="sh-opening-checks">{[
          "I reviewed the previous handover",
          "I reviewed today’s sessions",
          "I verified centre readiness",
          "I checked all pending actions",
        ].map((label, index) => <label className={checks[index] ? "checked" : ""} key={label}><input type="checkbox" checked={checks[index]} onChange={() => setChecks((state) => state.map((value, i) => i === index ? !value : value))} /><span><Check size={14} /></span>{label}</label>)}</div>
        <div className="sh-progress"><span><i style={{ width: `${completeCount * 25}%` }} /></span><strong>{completeCount} of 4 completed</strong></div>
      </Section>

      <Section number={4} eyebrow="Pending actions" title="Items passed to your shift" description="Review what remains and take ownership.">
        {tasks.length ? <div className="sh-incoming-tasks">{tasks.map((task: any, index: number) => <div key={task.id || index}><span className="sh-priority">{String(task.priority || "routine").replaceAll("_", " ")}</span><h3>{task.title}</h3>{task.notes && <p>{task.notes}</p>}<div><span>Assigned to <strong>{task.owner || "Opening staff"}</strong></span><span>Due <strong>{task.deadline ? new Date(task.deadline).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Not set"}</strong></span></div></div>)}</div> : <EmptyState icon={CheckCircle2} title="No pending actions" text="The closing staff did not pass any unfinished tasks to this shift." />}
      </Section>

      <Section number={5} eyebrow="Final step" title="Accept the handover" description="Choose the status matching what you verified at the centre.">
        <div className="sh-accept-options">{[
          ["ready", "Accepted — centre ready", "I can begin today’s operations", CheckCircle2],
          ["exceptions", "Accepted with exceptions", "I found an issue and recorded it", AlertTriangle],
          ["blocked", "Cannot accept", "Manager action is required", XCircle],
        ].map(([id, label, detail, Icon]: any) => <button type="button" key={id} className={status === id ? "active" : ""} onClick={() => setStatus(id)}><Icon size={18} /><span><strong>{label}</strong><small>{detail}</small></span>{status === id && <Check size={14} />}</button>)}</div>
        {status !== "ready" && <Field label="Describe the exception or new issue" wide><textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="State what you found, the immediate action taken, and who was informed…" /></Field>}
        <label className="sh-declaration"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span><strong>I have reviewed and accept responsibility for this shift.</strong><small>Any difference or new issue has been recorded above.</small></span></label>
        <div className="sh-signature"><span>{initials(me)}</span><span><strong>{me}</strong><small>Opening staff · {titleBranch(branch)}</small></span><small>Digitally signed on acceptance</small></div>
        <button type="button" className="sh-primary" disabled={!acceptEnabled || signing} onClick={accept}>{signing ? <><Loader2 className="spin" size={16} /> Signing…</> : <>Accept & begin shift <ChevronRight size={17} /></>}</button>
        {!acceptEnabled && <p className="sh-submit-help">Complete all four opening checks, record any exception and confirm acceptance.</p>}
      </Section>
    </div>
  );
}

function HandoverHistory({ branch }: any) {
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => { DB.dbFetchHandovers(branch).then((data) => setRows(data || [])).finally(() => setLoading(false)); }, [branch]);
  return <div className="sh-stack"><div className="sh-page-intro"><div><span className="sh-page-kicker">AUDIT TRAIL · {titleBranch(branch).toUpperCase()}</span><h1>Handover history</h1><p>Submitted, accepted and pending records for this centre.</p></div></div><section className="sh-card">{loading ? <div className="sh-loading"><Loader2 className="spin" /> Loading history…</div> : rows.length ? <div className="sh-history-list">{rows.map((row) => <div key={row.id}><span className={`sh-history-state ${row.status}`}>{row.status}</span><span><strong>{displayDate(row.date)} · {row.handover_time}</strong><small>{(row.outgoing_staff || []).join(", ")} → {(row.incoming_staff || []).join(", ")}</small></span><span><strong>{row.total_sessions ?? "—"}</strong><small>sessions</small></span></div>)}</div> : <EmptyState icon={History} title="No handovers found" text="Submitted handovers will appear here." />}</section></div>;
}

function HandoverAssignments({ branch }: any) {
  const [assignments, setAssignments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const dates = React.useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() + idx);
      return d;
    });
  }, []);

  const startDate = dates[0].toISOString().slice(0, 10);
  const endDate = dates[6].toISOString().slice(0, 10);

  const load = React.useCallback(async () => {
    setLoading(true);
    const br = branch === "global" ? (window.FETS?._meBranch || "calicut") : branch;
    const data = await DB.dbFetchHandoverAssignments(br, startDate, endDate);
    setAssignments(data || []);
    setLoading(false);
  }, [branch, startDate, endDate]);

  React.useEffect(() => { load(); }, [load]);

  async function handleToggle(dateStr: string, name: string, currentlyAssigned: string[]) {
    const br = branch === "global" ? (window.FETS?._meBranch || "calicut") : branch;
    const nextAssigned = currentlyAssigned.includes(name)
      ? currentlyAssigned.filter((x: string) => x !== name)
      : [...currentlyAssigned, name];
    
    const res = await DB.dbSaveHandoverAssignment(dateStr, br, nextAssigned);
    if (res) {
      setAssignments(prev => {
        const other = prev.filter(x => x.date !== dateStr);
        return [...other, { date: dateStr, branch: br, staff_names: nextAssigned }];
      });
    }
  }

  if (loading) return <div className="sh-loading"><Loader2 className="spin" /> Loading assignments…</div>;

  return (
    <div className="sh-stack">
      <div className="sh-page-intro">
        <div>
          <span className="sh-page-kicker">SCHEDULING · {titleBranch(branch).toUpperCase()}</span>
          <h1>Handover Assignments</h1>
          <p>Assign who needs to take handover for the next 7 days.</p>
        </div>
      </div>

      <div className="sh-assignments-list">
        {dates.map((d) => {
          const dateStr = d.toISOString().slice(0, 10);
          const br = branch === "global" ? (window.FETS?._meBranch || "calicut") : branch;
          const rostered = window.FETS?.rosterOn?.(d, br) || [];
          const assign = assignments.find(x => x.date === dateStr);
          const assignedNames = assign ? assign.staff_names : [];

          return (
            <div key={dateStr} className="sh-assignment-card sh-card">
              <div className="sh-assign-info">
                <h3>{displayDate(dateStr)}</h3>
                <p>{rostered.length} staff rostered</p>
              </div>
              <div className="sh-assign-selectors">
                {rostered.length ? (
                  rostered.map((name: string) => {
                    const isAssigned = assignedNames.includes(name);
                    return (
                      <button
                        type="button"
                        key={name}
                        className={`sh-assign-btn ${isAssigned ? "active" : ""}`}
                        onClick={() => handleToggle(dateStr, name, assignedNames)}
                      >
                        <span>{initials(name)}</span>
                        {name}
                        {isAssigned && <Check size={13} />}
                      </button>
                    );
                  })
                ) : (
                  <span className="sh-no-staff">No staff rostered.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleNotes({ branch }: any) {
  const me = window.FETS?._meName || window.FETS?.user?.name || "Staff";
  const myBranch = branch === "global" ? (window.FETS?._meBranch || "calicut") : branch;
  const isMithun = me.toLowerCase().includes("mithun");
  const isNiyas = me.toLowerCase().includes("niyas");
  const isAdmin = !!window.FETS?.isAdmin;

  const people = React.useMemo(() => {
    const centre = branch === "global" ? (window.FETS?._meBranch || "calicut") : branch;
    return Array.from(new Set(window.FETS?.STAFF?.[centre] || window.FETS?.PEOPLE || [])).filter(Boolean).sort();
  }, [branch]);

  const [assignments, setAssignments] = React.useState<any[]>([]);
  const [notes, setNotes] = React.useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = React.useState(true);
  const [loadingNotes, setLoadingNotes] = React.useState(true);

  // Note posting states for Mithun
  const [mithunContent, setMithunContent] = React.useState("");
  const [mithunTagged, setMithunTagged] = React.useState<string[]>([]);
  const [mithunCalicut, setMithunCalicut] = React.useState(true);
  const [mithunCochin, setMithunCochin] = React.useState(false);
  const [mithunPosting, setMithunPosting] = React.useState(false);

  // Note posting states for Niyas
  const [niyasContent, setNiyasContent] = React.useState("");
  const [niyasTagged, setNiyasTagged] = React.useState<string[]>([]);
  const [niyasCalicut, setNiyasCalicut] = React.useState(true);
  const [niyasCochin, setNiyasCochin] = React.useState(false);
  const [niyasPosting, setNiyasPosting] = React.useState(false);

  const dates = React.useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() + idx);
      return d;
    });
  }, []);

  const startDate = dates[0].toISOString().slice(0, 10);
  const endDate = dates[6].toISOString().slice(0, 10);

  const load = React.useCallback(async () => {
    setLoadingSchedule(true);
    const data = await DB.dbFetchHandoverAssignments(myBranch, startDate, endDate);
    setAssignments(data || []);
    setLoadingSchedule(false);
  }, [myBranch, startDate, endDate]);

  const loadNotes = React.useCallback(async () => {
    setLoadingNotes(true);
    const data = await DB.dbFetchHandoverNotes();
    setNotes(data || []);
    setLoadingNotes(false);
  }, []);

  React.useEffect(() => {
    load();
    loadNotes();
  }, [load, loadNotes]);

  async function postNote(author: string, content: string, tagged: string[], calicut: boolean, cochin: boolean, setContent: any, setTagged: any, setPosting: any) {
    if (!content.trim()) return;
    setPosting(true);
    const targetCenters: string[] = [];
    if (calicut) targetCenters.push("calicut");
    if (cochin) targetCenters.push("cochin");

    const res = await DB.dbSaveHandoverNote(author, content.trim(), tagged, targetCenters);
    setPosting(false);
    if (res) {
      setContent("");
      setTagged([]);
      loadNotes();
    }
  }

  async function deleteNote(id: string) {
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    const ok = await DB.dbDeleteHandoverNote(id);
    if (ok) {
      loadNotes();
    }
  }

  const visibleNotes = React.useMemo(() => {
    const userBranch = window.FETS?._meBranch || "calicut";
    const nameLower = me.toLowerCase().trim();

    return notes.filter((note: any) => {
      if (note.author.toLowerCase() === "mithun" && isMithun) return true;
      if (note.author.toLowerCase() === "niyas" && isNiyas) return true;
      if (isAdmin) return true;
      const isTagged = (note.tagged_staff || []).some((n: string) => n.toLowerCase().trim() === nameLower);
      if (isTagged) return true;
      const centerMatch = (note.centers || []).includes(userBranch);
      if (centerMatch) return true;
      return false;
    });
  }, [notes, me, isMithun, isNiyas, isAdmin]);

  const mithunNotesList = visibleNotes.filter(n => n.author.toLowerCase() === "mithun");
  const niyasNotesList = visibleNotes.filter(n => n.author.toLowerCase() === "niyas");

  return (
    <div className="sh-stack">
      <div className="sh-page-intro">
        <div>
          <span className="sh-page-kicker">SCHEDULE & NOTES · {titleBranch(branch).toUpperCase()}</span>
          <h1>Upcoming Handovers & Notes</h1>
          <p>View upcoming handover schedules and direct notes from Mithun and Niyas.</p>
        </div>
      </div>

      <section className="sh-card">
        <div className="sh-section-head" style={{ marginBottom: 15, paddingBottom: 15 }}>
          <div>
            <h2>Who is going to take the shift handover?</h2>
            <p>Assigned staff for the coming days.</p>
          </div>
        </div>
        {loadingSchedule ? (
          <div className="sh-loading"><Loader2 className="spin" /> Loading schedule…</div>
        ) : (
          <div className="sh-horizontal-schedule scroll-soft" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10 }}>
            {dates.map((d) => {
              const dateStr = d.toISOString().slice(0, 10);
              const assign = assignments.find(x => x.date === dateStr);
              const assignedNames = assign ? assign.staff_names : [];
              return (
                <div key={dateStr} style={{ minWidth: 150, background: "var(--sh-canvas)", border: "1px solid var(--sh-line)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--sh-muted)" }}>{displayDate(dateStr)}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {assignedNames.length ? (
                      assignedNames.map((name: string) => (
                        <span key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                          <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--sh-yellow)", fontSize: 8, display: "grid", placeItems: "center", fontWeight: 850 }}>{initials(name)}</span>
                          {name}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 11, fontStyle: "italic", color: "var(--sh-muted)" }}>Not assigned</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="sh-notes-columns" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Mithun Column */}
        <section className="sh-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="sh-section-head" style={{ marginBottom: 15, paddingBottom: 15 }}>
            <p style={{ margin: 0, fontSize: 11, color: "var(--sh-muted)" }}>Direct updates and notes from Mithun.</p>
          </div>

          {isMithun && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20, padding: 12, background: "rgba(0,0,0,0.02)", borderRadius: 10, border: "1px dashed var(--sh-line)" }}>
              <textarea
                rows={2}
                value={mithunContent}
                onChange={e => setMithunContent(e.target.value)}
                placeholder="Write a note..."
                style={{ background: "#fff" }}
              />
              <div style={{ fontSize: 11, fontWeight: 750, color: "var(--sh-muted)" }}>Tag Staff:</div>
              <div className="scroll-soft" style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 60, overflowY: "auto" }}>
                {people.map(name => (
                  <button
                    type="button"
                    key={name}
                    className={`sh-tag-btn ${mithunTagged.includes(name) ? "active" : ""}`}
                    onClick={() => setMithunTagged(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}>
                    <input type="checkbox" checked={mithunCalicut} onChange={e => setMithunCalicut(e.target.checked)} /> Calicut
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}>
                    <input type="checkbox" checked={mithunCochin} onChange={e => setMithunCochin(e.target.checked)} /> Cochin
                  </label>
                </div>
                <button
                  type="button"
                  className="sh-primary"
                  style={{ width: "auto", height: 32, padding: "0 14px", borderRadius: 8 }}
                  disabled={mithunPosting || !mithunContent.trim()}
                  onClick={() => postNote("Mithun", mithunContent, mithunTagged, mithunCalicut, mithunCochin, setMithunContent, setMithunTagged, setMithunPosting)}
                >
                  {mithunPosting ? "Posting..." : "Post Note"}
                </button>
              </div>
            </div>
          )}

          {loadingNotes ? (
            <div className="sh-loading"><Loader2 className="spin" /> Loading notes…</div>
          ) : (
            <div className="sh-notes-list scroll-soft" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 400 }}>
              {mithunNotesList.length ? (
                mithunNotesList.map((n: any) => (
                  <div key={n.id} className="sh-note-card" style={{ border: "1px solid var(--sh-line)", borderRadius: 10, padding: 12, background: "var(--sh-canvas)", position: "relative" }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "var(--sh-ink)", whiteSpace: "pre-wrap" }}>{n.content}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 6, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 8, fontSize: 10, color: "var(--sh-muted)" }}>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {n.centers?.length ? <span>Branch: {n.centers.join(", ")}</span> : null}
                        {n.tagged_staff?.length ? <span>Tags: {n.tagged_staff.join(", ")}</span> : null}
                      </div>
                    </div>
                    {isMithun && (
                      <button type="button" style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--sh-red)", padding: 4 }} onClick={() => deleteNote(n.id)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <span className="sh-no-staff" style={{ textAlign: "center", margin: "20px 0" }}>No notes from Mithun.</span>
              )}
            </div>
          )}
        </section>

        {/* Niyas Column */}
        <section className="sh-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="sh-section-head" style={{ marginBottom: 15, paddingBottom: 15 }}>
            <p style={{ margin: 0, fontSize: 11, color: "var(--sh-muted)" }}>Direct updates and notes from Niyas.</p>
          </div>

          {isNiyas && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20, padding: 12, background: "rgba(0,0,0,0.02)", borderRadius: 10, border: "1px dashed var(--sh-line)" }}>
              <textarea
                rows={2}
                value={niyasContent}
                onChange={e => setNiyasContent(e.target.value)}
                placeholder="Write a note..."
                style={{ background: "#fff" }}
              />
              <div style={{ fontSize: 11, fontWeight: 750, color: "var(--sh-muted)" }}>Tag Staff:</div>
              <div className="scroll-soft" style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 60, overflowY: "auto" }}>
                {people.map(name => (
                  <button
                    type="button"
                    key={name}
                    className={`sh-tag-btn ${niyasTagged.includes(name) ? "active" : ""}`}
                    onClick={() => setNiyasTagged(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}>
                    <input type="checkbox" checked={niyasCalicut} onChange={e => setNiyasCalicut(e.target.checked)} /> Calicut
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}>
                    <input type="checkbox" checked={niyasCochin} onChange={e => setNiyasCochin(e.target.checked)} /> Cochin
                  </label>
                </div>
                <button
                  type="button"
                  className="sh-primary"
                  style={{ width: "auto", height: 32, padding: "0 14px", borderRadius: 8 }}
                  disabled={niyasPosting || !niyasContent.trim()}
                  onClick={() => postNote("Niyas", niyasContent, niyasTagged, niyasCalicut, niyasCochin, setNiyasContent, setNiyasTagged, setNiyasPosting)}
                >
                  {niyasPosting ? "Posting..." : "Post Note"}
                </button>
              </div>
            </div>
          )}

          {loadingNotes ? (
            <div className="sh-loading"><Loader2 className="spin" /> Loading notes…</div>
          ) : (
            <div className="sh-notes-list scroll-soft" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 400 }}>
              {niyasNotesList.length ? (
                niyasNotesList.map((n: any) => (
                  <div key={n.id} className="sh-note-card" style={{ border: "1px solid var(--sh-line)", borderRadius: 10, padding: 12, background: "var(--sh-canvas)", position: "relative" }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "var(--sh-ink)", whiteSpace: "pre-wrap" }}>{n.content}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 6, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 8, fontSize: 10, color: "var(--sh-muted)" }}>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {n.centers?.length ? <span>Branch: {n.centers.join(", ")}</span> : null}
                        {n.tagged_staff?.length ? <span>Tags: {n.tagged_staff.join(", ")}</span> : null}
                      </div>
                    </div>
                    {isNiyas && (
                      <button type="button" style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--sh-red)", padding: 4 }} onClick={() => deleteNote(n.id)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <span className="sh-no-staff" style={{ textAlign: "center", margin: "20px 0" }}>No notes from Niyas.</span>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function HandoverAnalysis({ branch }: any) {
  const [history, setHistory] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    DB.dbFetchHandovers(branch)
      .then(data => setHistory(data || []))
      .finally(() => setLoading(false));
  }, [branch]);

  if (loading) return <div className="sh-loading"><Loader2 className="spin" /> Loading analysis…</div>;

  const totalReports = history.length;
  const completedReports = history.filter(h => h.status === "completed").length;

  const totalSessions = history.reduce((acc, h) => acc + (Number(h.total_sessions) || 0), 0);
  const totalScheduled = history.reduce((acc, h) => acc + (Number(h.scheduled_candidates) || 0), 0);
  const totalAttended = history.reduce((acc, h) => acc + (Number(h.attended_candidates) || 0), 0);
  const totalNoShows = history.reduce((acc, h) => acc + (Number(h.no_shows) || 0), 0);

  const readyCount = history.filter(h => h.overall_status === "ready").length;
  const minorCount = history.filter(h => h.overall_status === "minor").length;
  const attentionCount = history.filter(h => h.overall_status === "attention").length;
  const notReadyCount = history.filter(h => h.overall_status === "not_ready").length;

  const criticalTasks: any[] = [];
  history.slice(0, 10).forEach(h => {
    if (h.pending_items && Array.isArray(h.pending_items)) {
      h.pending_items.forEach((task: any) => {
        if (task.priority === "critical" || task.priority === "before_first_session") {
          criticalTasks.push({
            ...task,
            handoverDate: h.date,
            submittedBy: h.outgoing_staff?.join(", ")
          });
        }
      });
    }
  });

  return (
    <div className="sh-stack">
      <div className="sh-page-intro">
        <div>
          <span className="sh-page-kicker">ANALYTICS · {titleBranch(branch).toUpperCase()}</span>
          <h1>Performance & Readiness Analysis</h1>
          <p>Key insights and metrics derived from shift handover reports.</p>
        </div>
      </div>

      <div className="sh-analysis-grid">
        <div className="sh-card sh-analysis-card">
          <span className="sh-eyebrow">COMPLETED SHIFTS</span>
          <h3>{completedReports} / {totalReports}</h3>
          <p>Accepted handovers</p>
        </div>
        <div className="sh-card sh-analysis-card">
          <span className="sh-eyebrow">ATTENDANCE RATE</span>
          <h3>{totalScheduled ? Math.round((totalAttended / totalScheduled) * 100) : 0}%</h3>
          <p>{totalAttended} of {totalScheduled}</p>
        </div>
        <div className="sh-card sh-analysis-card">
          <span className="sh-eyebrow">NO SHOW RATE</span>
          <h3>{totalScheduled ? Math.round((totalNoShows / totalScheduled) * 100) : 0}%</h3>
          <p>{totalNoShows} absentees</p>
        </div>
        <div className="sh-card sh-analysis-card">
          <span className="sh-eyebrow">AVG SESSIONS / DAY</span>
          <h3>{totalReports ? (totalSessions / totalReports).toFixed(1) : 0}</h3>
          <p>Exams per shift</p>
        </div>
      </div>

      <div className="sh-analysis-sections">
        <section className="sh-card">
          <div className="sh-section-head">
            <div>
              <h2>Centre Readiness Distribution</h2>
              <p>Overall operational status distribution on closing.</p>
            </div>
          </div>
          <div className="sh-readiness-chart" style={{ marginTop: 16 }}>
            {[
              ["Ready", readyCount, "#2ecc71"],
              ["Ready (Minor Issues)", minorCount, "#f1c40f"],
              ["Attention Required", attentionCount, "#e67e22"],
              ["Not Ready", notReadyCount, "#e74c3c"]
            ].map(([label, val, color]: any) => {
              const pct = totalReports ? Math.round((val / totalReports) * 100) : 0;
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 12 }}>
                  <span style={{ width: 160, fontSize: 13, color: "var(--ho-text)" }}>{label}</span>
                  <div style={{ flex: 1, height: 16, background: "rgba(0,0,0,0.05)", borderRadius: 8, overflow: "hidden", display: "flex" }}>
                    <div style={{ width: `${pct}%`, background: color, height: "100%" }} />
                  </div>
                  <span style={{ width: 60, fontSize: 13, fontWeight: 700, textAlign: "right", color: "var(--ho-text)" }}>{val} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="sh-card">
          <div className="sh-section-head">
            <div>
              <h2>Recent Critical Operations Tasks</h2>
              <p>Unresolved tasks passed during recent handovers.</p>
            </div>
          </div>
          <div className="sh-analysis-tasks" style={{ marginTop: 16 }}>
            {criticalTasks.length ? (
              <div className="sh-incoming-tasks">
                {criticalTasks.slice(0, 5).map((task, idx) => (
                  <div key={idx} className="sh-task-item-anal" style={{ border: "1px solid var(--ho-border)", padding: 12, borderRadius: 10, marginBottom: 8, background: "var(--ho-card-bg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span className="sh-priority" style={{ background: "rgba(231,76,60,0.1)", color: "#e74c3c" }}>{task.priority?.toUpperCase()}</span>
                      <small style={{ color: "var(--ho-text-muted)" }}>{displayDate(task.handoverDate)}</small>
                    </div>
                    <strong style={{ fontSize: 14, color: "var(--ho-text)" }}>{task.title}</strong>
                    {task.notes && <p style={{ fontSize: 13, color: "var(--ho-text-muted)", margin: "4px 0 0" }}>{task.notes}</p>}
                    <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ho-text-muted)" }}>
                      <span>Owner: <strong>{task.owner}</strong></span>
                      <span>Handover by: <strong>{task.submittedBy}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontStyle: "italic", color: "var(--ho-text-muted)" }}>No recent critical tasks recorded.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ShiftHandoverModern({ branch, setActive }: any) {
  const [view, setView] = React.useState("end");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [refreshQTrigger, setRefreshQTrigger] = React.useState(0);
  const [isManagingQ, setIsManagingQ] = React.useState(false);
  const isAdmin = !!window.FETS?.isAdmin;

  return (
    <div className="sh-modern-root">
      <header className="sh-modern-header">
        <div className="sh-title" style={{ cursor: "pointer" }} onClick={() => setActive("live")} title="Back to Live Page">
          <span style={{ background: "var(--sh-yellow)", color: "var(--sh-ink)" }}><ArrowLeft size={18} /></span>
          <div><strong>Shift Handover</strong><small>{titleBranch(branch)} centre</small></div>
        </div>
        <nav aria-label="Handover pages">
          <button className={view === "end" ? "active" : ""} onClick={() => setView("end")}>Closing</button>
          <button className={view === "begin" ? "active" : ""} onClick={() => setView("begin")}>Opening</button>
          {isAdmin && (
            <button className={view === "assignments" ? "active" : ""} onClick={() => setView("assignments")}>Assignments</button>
          )}
          <button className={view === "schedule_notes" ? "active" : ""} onClick={() => setView("schedule_notes")}>Pulse</button>
          <button className={view === "analysis" ? "active" : ""} onClick={() => setView("analysis")}>Analysis</button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>History</button>
        </nav>
        <button type="button" className="sh-refresh" onClick={() => { setRefreshKey((x) => x + 1); setRefreshQTrigger((x) => x + 1); }} title="Refresh"><RefreshCcw size={16} /></button>
      </header>
      <div className="sh-modern-body">
        {view === "end" && (
          <ShiftEnd
            branch={branch}
            onSubmitted={() => { setRefreshKey((x) => x + 1); setView("begin"); }}
            refreshQTrigger={refreshQTrigger}
            onManageQuestions={() => setIsManagingQ(true)}
          />
        )}
        {view === "begin" && <ShiftBeginning branch={branch} refreshKey={refreshKey} onAccepted={() => setRefreshKey((x) => x + 1)} />}
        {view === "assignments" && <HandoverAssignments branch={branch} />}
        {view === "schedule_notes" && <ScheduleNotes branch={branch} />}
        {view === "history" && <HandoverHistory branch={branch} />}
        {view === "analysis" && <HandoverAnalysis branch={branch} />}
      </div>

      <QuestionManagerModal
        open={isManagingQ}
        onClose={() => setIsManagingQ(false)}
        onRefresh={() => setRefreshQTrigger((x) => x + 1)}
      />
    </div>
  );
}
