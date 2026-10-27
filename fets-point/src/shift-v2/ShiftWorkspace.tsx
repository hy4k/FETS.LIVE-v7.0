import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { centreDate } from "../redesign/operations-data";
import { repository as liveRepository, type Repository } from "./repository";
import {
  DUTIES,
  clock,
  minute,
  uid,
  emptyPlan,
  newBlock,
  cmaOpening,
  personName,
  validate,
  copyPlan,
  slotState,
  type Duty,
  type Plan,
  type Day,
  type Block,
  type Person,
  type WorkEvent,
  type Checks,
  type Task,
} from "./model";
import "./shift.css";
const err = (e: unknown) =>
  e instanceof Error ? e.message : "Could not load or save. Please retry.";
const stamp = (v: string) =>
  new Date(v).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
const moveDate = (day: string, n: number) => {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
function DutyTags({ duties }: { duties: Duty[] }) {
  return (
    <div className="sv-duty-tags">
      {duties.map((code) => (
        <span
          key={code}
          style={
            { "--duty": DUTIES[code]?.color || "#667" } as React.CSSProperties
          }
        >
          {DUTIES[code]?.label || code}
        </span>
      ))}
    </div>
  );
}
function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="time"
        value={Number.isFinite(value) ? clock(value) : ""}
        onChange={(e) => onChange(minute(e.target.value))}
      />
    </label>
  );
}
export default function ShiftWorkspace({
  branch,
  navigate,
  repository = liveRepository,
}: {
  branch: string;
  navigate: (v: string) => void;
  repository?: Repository;
  legacy?: React.ReactNode;
}) {
  const { profile } = useAuth();
  const me = profile?.id || "";
  const [day, setDay] = useState(centreDate),
    [tab, setTab] = useState("team"),
    [person, setPerson] = useState(me),
    [ctx, setCtx] = useState<Awaited<ReturnType<Repository["context"]>> | null>(
      null,
    ),
    [record, setRecord] = useState<Day | null>(null),
    [events, setEvents] = useState<WorkEvent[]>([]),
    [checks, setChecks] = useState<Checks | null>(null),
    [error, setError] = useState(""),
    [checkError, setCheckError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now),
    [editor, setEditor] = useState<{
      plan: Plan;
      base: Day | null;
      lead: string;
    } | null>(null),
    [actionNote, setActionNote] = useState<Record<string, string>>({}),
    [report, setReport] = useState("");
  const initialView = useRef(false);
  const offset = useRef(0),
    sequence = useRef(0),
    saving = useRef(false);
  const chosen = branch === "calicut" || branch === "cochin";
  const load = useCallback(async () => {
    if (!chosen) return;
    const s = ++sequence.current;
    try {
      const [context, data] = await Promise.all([
        repository.context(branch, day),
        repository.load(branch, day),
      ]);
      if (s !== sequence.current) return;
      setCtx(context);
      if (!initialView.current) {
        const manager =
          context.directory.some(
            (m: any) =>
              m.profile_id === me &&
              ((m.role === "super_admin" && m.branch === "*") ||
                (m.role === "planner" && m.branch === branch)),
          ) || data.record?.lead_id === me;
        setTab(manager ? "team" : "mine");
        initialView.current = true;
      }
      setRecord(data.record);
      setEvents(data.events);
      setError("");
      try {
        const snapshot = await repository.checks(branch, day);
        if (s !== sequence.current) return;
        setChecks(snapshot);
        offset.current = Date.parse(snapshot.server_now) - Date.now();
        setNow(Date.now() + offset.current);
        setCheckError("");
      } catch (e) {
        if (s === sequence.current) setCheckError(err(e));
      }
    } catch (e) {
      if (s === sequence.current) {
        setError(err(e));
        setCheckError(
          "Shift connection is stale. Refresh before recording checks.",
        );
      }
    } finally {
      if (s === sequence.current) setLoading(false);
    }
  }, [branch, day, chosen, repository, me]);
  useEffect(() => {
    initialView.current = false;
    setLoading(true);
    setCtx(null);
    setRecord(null);
    setEvents([]);
    setChecks(null);
    setEditor(null);
    setError("");
    setPerson(me);
    void load();
    const id = setInterval(() => {
      if (!saving.current) void load();
    }, 15000);
    const focus = () => {
      if (!saving.current) void load();
    };
    window.addEventListener("focus", focus);
    return () => {
      sequence.current++;
      clearInterval(id);
      window.removeEventListener("focus", focus);
    };
  }, [load, me]);
  useEffect(() => {
    const id = setInterval(
      () => setNow(Date.now() + offset.current),
      tab === "checks" ? 1000 : 30000,
    );
    return () => clearInterval(id);
  }, [tab]);
  const planner = !!ctx?.directory.some(
    (m: any) =>
      m.profile_id === me &&
      ((m.role === "super_admin" && m.branch === "*") ||
        (m.role === "planner" && m.branch === branch)),
  );
  const canManage = planner || (!!record && record.lead_id === me);
  const plan = record?.plan;
  const current =
    plan?.people.find((p) => p.id === person) ||
    plan?.people.find((p) => p.id === me) ||
    plan?.people[0];
  const run = async (f: () => Promise<unknown>) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    sequence.current++;
    try {
      await f();
      await load();
    } catch (e) {
      setError(err(e));
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
    return true;
  };
  const startEdit = () => {
    setEditor({
      plan: structuredClone(plan || emptyPlan(ctx?.people || [])),
      base: record,
      lead: record?.lead_id || "",
    });
    setTab("edit");
  };
  const save = async (publish: boolean, reason: string) => {
    if (!editor) return;
    await run(async () => {
      await repository.save(
        branch,
        day,
        editor.lead || null,
        editor.plan,
        editor.base,
        publish,
        reason,
      );
      setEditor(null);
      setTab("team");
    });
  };
  const taskEvents = (block: string | null, id: string) =>
    events.filter(
      (e) =>
        e.block_id === block &&
        e.task_id === id &&
        ["done", "verify", "return"].includes(e.kind),
    );
  const taskRow = (task: Task, owner: string, block: string | null) => {
    const latest = taskEvents(block, task.id).slice(-1)[0];
    const completed = latest?.kind === "done" || latest?.kind === "verify";
    const mine = owner === me;
    const active =
      record?.status === "published" && day === centreDate(new Date(now));
    return (
      <div className="sv-task" key={task.id}>
        <div>
          <span
            className={`sv-task-state ${completed ? "is-done" : ""}`}
            aria-hidden="true"
          >
            {completed ? <Check size={13} /> : null}
          </span>
          <span>
            <strong>{task.label}</strong>
            <small>
              {plan ? personName(plan, owner) : ""}
              {latest
                ? ` · ${latest.kind === "verify" ? "Reviewed" : latest.kind === "return" ? "Needs correction" : "Submitted"} ${stamp(latest.created_at)} IST`
                : ""}
            </small>
            {latest?.kind === "return" && <p>{latest.note}</p>}
          </span>
        </div>
        <div className="sv-task-actions">
          {mine && (
            <button
              disabled={busy || !active || completed}
              onClick={() =>
                void run(() =>
                  repository.event(record!.id, block, task.id, "done"),
                )
              }
            >
              {completed ? "Submitted" : "Mark done"}
            </button>
          )}
          {canManage && !mine && latest?.kind === "done" && (
            <>
              <button
                disabled={busy || !active}
                onClick={() =>
                  void run(() =>
                    repository.event(record!.id, block, task.id, "verify"),
                  )
                }
              >
                Verify
              </button>
              <button
                disabled={busy || !active}
                onClick={() => {
                  const note = window.prompt("What needs to be corrected?");
                  if (note?.trim())
                    void run(() =>
                      repository.event(
                        record!.id,
                        block,
                        task.id,
                        "return",
                        note,
                      ),
                    );
                }}
              >
                Return
              </button>
            </>
          )}
        </div>
      </div>
    );
  };
  if (!chosen)
    return (
      <div className="shift-v2 sv-empty">
        <h1>The Shift</h1>
        <p>
          Choose Calicut or Cochin from the centre menu to open its staff
          timetable.
        </p>
      </div>
    );
  const todayMinute = minute(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now),
  );
  return (
    <div className="shift-v2">
      <header className="sv-header">
        <div>
          <span className="sv-eyebrow">
            {branch.toUpperCase()} · STAFF DUTY PLAN
          </span>
          <h1>The Shift</h1>
          <p>
            {plan?.programme || "Plan the work. Follow your own duty sheet."}
          </p>
        </div>
        <div className="sv-day-picker">
          <button
            aria-label="Previous day"
            onClick={() => setDay(moveDate(day, -1))}
          >
            <ChevronLeft size={16} />
          </button>
          <input
            aria-label="Shift date"
            type="date"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
          <button
            aria-label="Next day"
            onClick={() => setDay(moveDate(day, 1))}
          >
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setDay(centreDate())}>Today</button>
          <button
            aria-label="Refresh Shift"
            disabled={busy}
            onClick={() => void load()}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>
      <div className="sv-toolbar">
        <div className="sv-tabs" role="group" aria-label="Shift views">
          {[
            ["team", "Team timetable"],
            ["mine", "My duty sheet"],
            ["checks", "Walk & DVR log"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className={`sv-status sv-${record?.status || "unplanned"}`}>
          {record?.status || "Not planned"}
        </span>
        {canManage && record && record.status !== "closed" && (
          <button className="sv-primary" disabled={busy} onClick={startEdit}>
            {record ? "Edit day plan" : "Plan this day"}
          </button>
        )}
        {!record && planner && (
          <button className="sv-primary" onClick={startEdit}>
            Plan this day
          </button>
        )}
      </div>
      {error && (
        <div className="sv-error" role="alert">
          {error}
          <button onClick={() => void load()}>Retry</button>
          <button onClick={() => setError("")} aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}
      {loading ? (
        <p className="sv-empty" role="status">
          Loading staff and duty plan…
        </p>
      ) : tab === "edit" && editor ? (
        <PlanEditor
          editor={editor}
          setEditor={setEditor}
          context={ctx!}
          planner={planner}
          busy={busy}
          onSave={save}
          onCancel={() => {
            setEditor(null);
            setTab("team");
          }}
          repository={repository}
          branch={branch}
          day={day}
        />
      ) : !record || !plan ? (
        <section className="sv-empty">
          <CalendarDays size={30} />
          <h2>No duty plan for this day</h2>
          <p>
            {planner
              ? "Start with the actual roster and exam schedule, assign the work, then publish it for staff."
              : "The day planner has not published a staff timetable yet."}
          </p>
          {planner && (
            <button className="sv-primary" onClick={startEdit}>
              Create day plan
            </button>
          )}
          <button onClick={() => navigate("roster")}>Open roster</button>
        </section>
      ) : (
        <>
          {record.status === "draft" && (
            <div className="sv-notice">
              Draft — staff will see their assigned duties after publication.
              Walk/DVR recording follows the published plan only.
            </div>
          )}
          <div className="sv-plan-context">
            <span>
              <Users size={14} />
              {plan.people.length} staff
            </span>
            {record.lead_id && (
              <span>
                <ShieldCheck size={14} />
                Day lead: {personName(plan, record.lead_id)}
              </span>
            )}
            <span>
              <Clock size={14} />
              {plan.monitoring
                .map((w) => `${clock(w.start)}–${clock(w.end)}`)
                .join(" · ") || "Monitoring times not set"}{" "}
              IST
            </span>
            {ctx?.sessions.length ? (
              <span>
                {ctx.sessions.reduce(
                  (n: any, s: any) => n + (Number(s.candidate_count) || 0),
                  0,
                )}{" "}
                scheduled candidates · {ctx.sessions.length} calendar sessions
              </span>
            ) : null}
          </div>
          {tab === "team" && (
            <>
              <TeamTable
                plan={plan}
                onPerson={(id) => {
                  setPerson(id);
                  setTab("mine");
                }}
                currentMinute={
                  day === centreDate(new Date(now)) ? todayMinute : -1
                }
              />
              <section className="sv-panel">
                <header>
                  <h2>Shared opening checklist</h2>
                  <span>
                    One owner for each item
                    {Number.isFinite(plan.openingBy)
                      ? ` · Ready by ${clock(plan.openingBy!)} IST`
                      : ""}
                  </span>
                </header>
                {plan.opening.length ? (
                  plan.opening.map((t) => taskRow(t, t.owner, null))
                ) : (
                  <p className="sv-empty">
                    No shared opening items on this plan.
                  </p>
                )}
              </section>
              <div className="sv-duty-key">
                {(Object.keys(DUTIES) as Duty[])
                  .filter((c) => plan.blocks.some((b) => b.duties.includes(c)))
                  .map((c) => (
                    <DutyTags key={c} duties={[c]} />
                  ))}
              </div>
            </>
          )}
          {tab === "mine" && (
            <>
              <nav className="sv-people" aria-label="Staff duty sheets">
                {plan.people.map((p) => (
                  <button
                    key={p.id}
                    aria-pressed={current?.id === p.id}
                    onClick={() => setPerson(p.id)}
                  >
                    <strong>{p.name}</strong>
                    <small>
                      {clock(p.start)}–{clock(p.end)}
                      {p.support ? " · Temporary cover" : ""}
                    </small>
                  </button>
                ))}
              </nav>
              {current && (
                <>
                  <div className="sv-sheet-heading">
                    <div>
                      <h2>{current.name}</h2>
                      <p>
                        {day} · {clock(current.start)}–{clock(current.end)} IST
                        {current.support ? " · Planned temporary cover" : ""}
                      </p>
                    </div>
                    <button onClick={() => window.print()}>
                      Print duty sheet
                    </button>
                  </div>
                  {plan.opening.some((t) => t.owner === current.id) && (
                    <section className="sv-panel">
                      <header>
                        <h3>Your opening tasks</h3>
                      </header>
                      {plan.opening
                        .filter((t) => t.owner === current.id)
                        .map((t) => taskRow(t, t.owner, null))}
                    </section>
                  )}
                  <div className="sv-person-timeline">
                    {plan.blocks
                      .filter((b) => b.staff === current.id)
                      .sort((a, b) => a.start - b.start)
                      .map((b) => (
                        <article
                          key={b.id}
                          className={`sv-block ${day === centreDate(new Date(now)) && b.start <= todayMinute && todayMinute < b.end ? "sv-current" : ""}`}
                          style={
                            {
                              "--block-colour":
                                DUTIES[b.duties[0]]?.color || "#888",
                            } as React.CSSProperties
                          }
                        >
                          <aside>
                            <strong>{clock(b.start)}</strong>
                            <span>{clock(b.end)}</span>
                          </aside>
                          <section>
                            <DutyTags duties={b.duties} />
                            {b.note && (
                              <p className="sv-block-note">{b.note}</p>
                            )}
                            {b.duties.includes("break") && (
                              <p className="sv-cover">
                                Hall cover:{" "}
                                <strong>{personName(plan, b.cover)}</strong>
                              </p>
                            )}
                            {b.duties.includes("monitor") && (
                              <div className="sv-monitor-instructions">
                                <p>
                                  Walk the exam room every{" "}
                                  <strong>10 minutes</strong>. Check the DVR
                                  every <strong>6 minutes</strong>. Record only
                                  checks actually completed.
                                </p>
                                <button onClick={() => setTab("checks")}>
                                  Open shared check log <ArrowRight size={14} />
                                </button>
                                <a
                                  href="https://fets.online/floor"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  FETS Online · Lab <ExternalLink size={13} />
                                </a>
                              </div>
                            )}
                            {b.tasks.map((t) => taskRow(t, b.staff, b.id))}
                            {current.id === me &&
                              record.status === "published" && (
                                <details className="sv-notes">
                                  <summary>Help / handover note</summary>
                                  <textarea
                                    aria-label={`Note for ${clock(b.start)}`}
                                    value={actionNote[b.id] || ""}
                                    onChange={(e) =>
                                      setActionNote({
                                        ...actionNote,
                                        [b.id]: e.target.value,
                                      })
                                    }
                                    maxLength={2000}
                                    placeholder="What is pending, or where do you need help?"
                                  />
                                  <div>
                                    <button
                                      disabled={
                                        busy || !actionNote[b.id]?.trim()
                                      }
                                      onClick={() =>
                                        void run(async () => {
                                          await repository.event(
                                            record.id,
                                            b.id,
                                            "block",
                                            "help",
                                            actionNote[b.id],
                                          );
                                          setActionNote((n) => ({
                                            ...n,
                                            [b.id]: "",
                                          }));
                                        })
                                      }
                                    >
                                      Request help
                                    </button>
                                    <button
                                      disabled={
                                        busy || !actionNote[b.id]?.trim()
                                      }
                                      onClick={() =>
                                        void run(async () => {
                                          await repository.event(
                                            record.id,
                                            b.id,
                                            "block",
                                            "handover",
                                            actionNote[b.id],
                                          );
                                          setActionNote((n) => ({
                                            ...n,
                                            [b.id]: "",
                                          }));
                                        })
                                      }
                                    >
                                      Record handover
                                    </button>
                                  </div>
                                </details>
                              )}
                            {events
                              .filter(
                                (e) =>
                                  e.block_id === b.id &&
                                  ["help", "handover"].includes(e.kind),
                              )
                              .map((e) => (
                                <p className="sv-work-note" key={e.id}>
                                  {e.kind === "help"
                                    ? "Help requested"
                                    : "Handover"}{" "}
                                  · {stamp(e.created_at)} · {e.note}
                                </p>
                              ))}
                          </section>
                        </article>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
          {tab === "checks" && (
            <CheckLog
              snapshot={checks}
              error={checkError}
              now={now}
              me={me}
              busy={busy}
              reload={() => void load()}
              record={(c, note) =>
                run(() =>
                  repository.recordCheck(
                    record.id,
                    c.block,
                    c.kind,
                    c.due,
                    note,
                  ),
                )
              }
            />
          )}
          {plan.notes && (
            <section className="sv-plan-notes">
              <h3>Day notes</h3>
              <p>{plan.notes}</p>
            </section>
          )}
          {canManage && (
            <section className="sv-panel sv-close">
              <header>
                <h2>Closing handover</h2>
                <span>Record outstanding work and the next owner</span>
              </header>
              {record.status === "closed" ? (
                <p>{record.report}</p>
              ) : (
                <>
                  <textarea
                    aria-label="Closing handover"
                    value={report}
                    onChange={(e) => setReport(e.target.value)}
                    placeholder="Remaining candidates, outstanding filing, incidents, and who receives the handover."
                    maxLength={5000}
                  />
                  <button
                    disabled={
                      busy || record.status !== "published" || !report.trim()
                    }
                    onClick={() =>
                      void run(() =>
                        repository.close(record.id, record.version, report),
                      )
                    }
                  >
                    Close shift & save handover
                  </button>
                </>
              )}
            </section>
          )}
        </>
      )}
      <footer className="sv-footer">
        All times IST · Duty colours stay the same for every staff member ·
        Checks are recorded once and shared with FETS Online.
      </footer>
    </div>
  );
}
function TeamTable({
  plan,
  onPerson,
  currentMinute,
}: {
  plan: Plan;
  onPerson: (id: string) => void;
  currentMinute: number;
}) {
  const times = [...new Set(plan.blocks.flatMap((b) => [b.start, b.end]))].sort(
    (a, b) => a - b,
  );
  return (
    <section className="sv-timetable" aria-label="Team duty timetable">
      <div className="sv-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Time · IST</th>
              {plan.people.map((p) => (
                <th key={p.id}>
                  <button onClick={() => onPerson(p.id)}>
                    <strong>{p.name}</strong>
                    <small>
                      {clock(p.start)}–{clock(p.end)}
                      {p.support ? " · Cover" : ""}
                    </small>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.slice(0, -1).map((t, i) => (
              <tr
                key={t}
                className={
                  t <= currentMinute && currentMinute < times[i + 1]
                    ? "sv-now-row"
                    : ""
                }
              >
                <th>
                  {clock(t)}
                  <small>{clock(times[i + 1])}</small>
                </th>
                {plan.people.map((p) => {
                  const b = plan.blocks.find(
                    (b) => b.staff === p.id && b.start <= t && t < b.end,
                  );
                  return (
                    <td key={p.id}>
                      {b ? (
                        <div
                          className="sv-table-duty"
                          style={
                            {
                              "--block-colour":
                                DUTIES[b.duties[0]]?.color || "#888",
                            } as React.CSSProperties
                          }
                        >
                          <DutyTags duties={b.duties} />
                          {b.duties.includes("break") && (
                            <small>Cover: {personName(plan, b.cover)}</small>
                          )}
                          {b.note && <small>{b.note}</small>}
                        </div>
                      ) : (
                        <span className="sv-off-duty">
                          {t < p.start || t >= p.end
                            ? "Off duty"
                            : "Not assigned"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!plan.blocks.length && (
        <p className="sv-empty">Add duty blocks to build the timetable.</p>
      )}
    </section>
  );
}
function CheckLog({
  snapshot,
  error,
  now,
  me,
  busy,
  reload,
  record,
}: {
  snapshot: Checks | null;
  error: string;
  now: number;
  me: string;
  busy: boolean;
  reload: () => void;
  record: (c: Checks["checks"][number], note: string) => Promise<unknown>;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const slots = snapshot?.checks || [];
  const key = (c: (typeof slots)[number]) => `${c.kind}:${c.due}`;
  return (
    <section className="sv-panel sv-check-log">
      <header>
        <div>
          <h2>Walk & DVR log</h2>
          <p>
            The same due times, owners and completed records appear in FETS
            Online’s Lab.
          </p>
        </div>
        <a href="https://fets.online/floor" target="_blank" rel="noreferrer">
          Open Lab <ExternalLink size={14} />
        </a>
      </header>
      {error && (
        <div role="alert" className="sv-error">
          {error}
          <button onClick={reload}>Refresh connection</button>
        </div>
      )}
      {!snapshot?.plan ? (
        <p className="sv-empty">
          {snapshot?.reason || "Publish the day plan to start tracking checks."}
        </p>
      ) : (
        <>
          <p className="sv-check-explanation">
            No automatic ticks or backfilling. Slots before this plan was
            activated are marked “not tracked”. At a changeover, the outgoing
            monitor owns the final check of that period.
          </p>
          <div className="sv-due-cards">
            {(["walk", "dvr"] as const).map((kind) => {
              const c = slots.find(
                (c) =>
                  c.kind === kind &&
                  !c.event &&
                  ["due", "upcoming"].includes(slotState(snapshot, c, now)),
              );
              if (!c)
                return (
                  <div key={kind}>
                    <h3>{kind === "walk" ? "Lab walk" : "DVR check"}</h3>
                    <p>No further checks due.</p>
                  </div>
                );
              const state = slotState(snapshot, c, now);
              const mine = c.owner_id === me;
              return (
                <div key={kind}>
                  <span className="sv-eyebrow">
                    EVERY {kind === "walk" ? 10 : 6} MINUTES
                  </span>
                  <h3>
                    {kind === "walk" ? "Walk the exam room" : "Check the DVR"}
                  </h3>
                  <strong>{clock(c.due)} IST</strong>
                  <p>
                    {c.owner_name || "Owner not assigned"} · {state}
                  </p>
                  {mine && (
                    <>
                      <input
                        aria-label={`${kind} check note`}
                        value={notes[key(c)] || ""}
                        onChange={(e) =>
                          setNotes({ ...notes, [key(c)]: e.target.value })
                        }
                        maxLength={2000}
                        placeholder="Optional finding / note"
                      />
                      <button
                        className="sv-primary"
                        disabled={
                          busy ||
                          !!error ||
                          state !== "due" ||
                          !snapshot.viewer_rostered
                        }
                        onClick={() =>
                          void record(c, notes[key(c)] || "").then((ok) => {
                            if (ok) setNotes((n) => ({ ...n, [key(c)]: "" }));
                          })
                        }
                      >
                        Record completed{" "}
                        {kind === "walk" ? "walk" : "DVR check"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <details className="sv-all-checks">
            <summary>
              All scheduled checks · {slots.filter((c) => c.event).length}{" "}
              recorded / {slots.length} slots
            </summary>
            <div className="sv-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Due</th>
                    <th>Check</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((c) => (
                    <tr key={key(c)}>
                      <td>{clock(c.due)}</td>
                      <td>{c.kind === "walk" ? "Room walk" : "DVR"}</td>
                      <td>{c.owner_name}</td>
                      <td>{slotState(snapshot, c, now).replace("-", " ")}</td>
                      <td>
                        {c.event
                          ? `${stamp(c.event.created_at)} · ${c.event.actor_name}`
                          : "—"}
                        {c.event?.note && <small>{c.event.note}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
function PlanEditor({
  editor,
  setEditor,
  context,
  planner,
  busy,
  onSave,
  onCancel,
  repository,
  branch,
  day,
}: {
  editor: { plan: Plan; base: Day | null; lead: string };
  setEditor: React.Dispatch<
    React.SetStateAction<{ plan: Plan; base: Day | null; lead: string } | null>
  >;
  context: Awaited<ReturnType<Repository["context"]>>;
  planner: boolean;
  busy: boolean;
  onSave: (publish: boolean, reason: string) => Promise<void>;
  onCancel: () => void;
  repository: Repository;
  branch: string;
  day: string;
}) {
  const p = editor.plan;
  const [reason, setReason] = useState(""),
    [prior, setPrior] = useState(moveDate(day, -1)),
    [support, setSupport] = useState(""),
    [localError, setLocalError] = useState("");
  const update = (patch: Partial<Plan>) =>
    setEditor((e) => (e ? { ...e, plan: { ...e.plan, ...patch } } : null));
  const replaceBlock = (b: Block) =>
    update({ blocks: p.blocks.map((x) => (x.id === b.id ? b : x)) });
  const issues = validate(p);
  const rosterIssues = p.people
    .filter((x) => !x.support)
    .flatMap((x) => {
      const actual = context.people.find((a) => a.id === x.id);
      return !actual
        ? [`${x.name} is not on this day’s active roster.`]
        : x.start < actual.start || x.end > actual.end
          ? [
              `${x.name}: roster is ${clock(actual.start)}–${clock(actual.end)}. Update plan availability from the roster.`,
            ]
          : [];
    });
  const allIssues = [...issues, ...rosterIssues];
  const published = editor.base?.status === "published";
  const copy = async () => {
    try {
      const d = await repository.prior(branch, prior);
      if (!d) throw Error("No plan exists on that date.");
      update(copyPlan(d.plan, context.people));
      setLocalError("");
    } catch (e) {
      setLocalError(err(e));
    }
  };
  return (
    <section className="sv-editor">
      <header className="sv-editor-heading">
        <div>
          <h2>{published ? "Amend the day plan" : "Plan the day"}</h2>
          <p>
            Use the actual roster and exam times. Split duties into clear time
            blocks for each person.
          </p>
        </div>
        <button onClick={onCancel}>Cancel editing</button>
      </header>
      {localError && (
        <p className="sv-error" role="alert">
          {localError}
        </p>
      )}
      {editor.base && (
        <p className="sv-notice">
          Editing version {editor.base.version}.
          {published
            ? " To change a running duty, split it at the current time. Past assignments and recorded checks stay intact."
            : ""}
        </p>
      )}
      <div className="sv-editor-meta">
        <label>
          Client / programme context
          <input
            maxLength={200}
            value={p.programme}
            onChange={(e) => update({ programme: e.target.value })}
            placeholder="Use this day’s actual exam programme"
          />
        </label>
        <label>
          Checklist starter
          <select
            value={p.template}
            onChange={(e) =>
              update({ template: e.target.value as Plan["template"] })
            }
          >
            <option value="custom">Custom — enter the correct steps</option>
            <option value="cma-us">CMA US — steps from supplied plan</option>
          </select>
        </label>
        <label>
          Day lead (optional)
          <select
            disabled={!planner}
            value={editor.lead}
            onChange={(e) =>
              setEditor((x) => (x ? { ...x, lead: e.target.value } : null))
            }
          >
            <option value="">No named day lead</option>
            {p.people
              .filter((x) => !x.support)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <section className="sv-panel">
        <header>
          <h3>Staff & availability</h3>
          <button
            onClick={() =>
              update({
                people: [
                  ...context.people.map((x) => ({
                    ...x,
                    name: p.people.find((a) => a.id === x.id)?.name || x.name,
                  })),
                  ...p.people.filter((x) => x.support),
                ],
              })
            }
          >
            Use current roster
          </button>
        </header>
        <p className="sv-editor-help">
          Normal shift hours come from Roster; this page does not rewrite
          attendance or overtime. Temporary cover records planned availability
          separately.
        </p>
        <div className="sv-availability">
          {p.people.map((x) => (
            <article key={x.id}>
              <label>
                Staff name on duty sheet
                <input
                  value={x.name}
                  maxLength={80}
                  onChange={(e) =>
                    update({
                      people: p.people.map((a) =>
                        a.id === x.id ? { ...a, name: e.target.value } : a,
                      ),
                    })
                  }
                />
              </label>
              {x.support ? (
                <>
                  <span className="sv-status">Temporary cover</span>
                  <TimeInput
                    label="Available from"
                    value={x.start}
                    onChange={(v) =>
                      update({
                        people: p.people.map((a) =>
                          a.id === x.id ? { ...a, start: v } : a,
                        ),
                      })
                    }
                  />
                  <TimeInput
                    label="Available until"
                    value={x.end}
                    onChange={(v) =>
                      update({
                        people: p.people.map((a) =>
                          a.id === x.id ? { ...a, end: v } : a,
                        ),
                      })
                    }
                  />
                  <label>
                    Management reason
                    <input
                      disabled={!planner}
                      maxLength={500}
                      value={x.supportReason || ""}
                      onChange={(e) =>
                        update({
                          people: p.people.map((a) =>
                            a.id === x.id
                              ? { ...a, supportReason: e.target.value }
                              : a,
                          ),
                        })
                      }
                    />
                  </label>
                </>
              ) : (
                <p>
                  {clock(x.start)}–{clock(x.end)} IST · Saved roster
                </p>
              )}
            </article>
          ))}
        </div>
        {planner && (
          <div className="sv-inline-form">
            <label>
              Add named temporary cover
              <select
                value={support}
                onChange={(e) => setSupport(e.target.value)}
              >
                <option value="">Choose active staff</option>
                {context.supportPeople
                  .filter((s: any) => !p.people.some((a) => a.id === s.id))
                  .map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              disabled={!support}
              onClick={() => {
                const x = context.supportPeople.find(
                  (x: any) => x.id === support,
                );
                if (x) {
                  update({
                    people: [
                      ...p.people,
                      {
                        ...x,
                        start: NaN,
                        end: NaN,
                        support: true,
                        supportReason: "",
                      },
                    ],
                  });
                  setSupport("");
                }
              }}
            >
              Add cover availability
            </button>
          </div>
        )}
      </section>
      <section className="sv-panel">
        <header>
          <h3>When must the hall be monitored?</h3>
          <button
            onClick={() => {
              const valid = context.sessions.filter(
                (s: any) =>
                  s.start_time &&
                  s.end_time &&
                  !["cancelled", "canceled"].includes(s.status),
              );
              if (
                !valid.length ||
                valid.length !==
                  context.sessions.filter(
                    (s: any) => !["cancelled", "canceled"].includes(s.status),
                  ).length
              ) {
                setLocalError(
                  "Calendar session times are incomplete. Set the real monitoring period below.",
                );
                return;
              }
              update({
                monitoring: [
                  {
                    start: Math.min(
                      ...valid.map((s: any) => minute(s.start_time)),
                    ),
                    end: Math.max(...valid.map((s: any) => minute(s.end_time))),
                  },
                ],
              });
            }}
          >
            Use calendar exam times
          </button>
        </header>
        <p className="sv-editor-help">
          Set actual testing periods. Walks stay 10 minutes apart and DVR checks
          6 minutes apart across staff changes and breaks.
        </p>
        {p.monitoring.map((w, i) => (
          <div className="sv-inline-form" key={i}>
            <TimeInput
              label="Monitoring starts"
              value={w.start}
              onChange={(v) =>
                update({
                  monitoring: p.monitoring.map((x, n) =>
                    n === i ? { ...x, start: v } : x,
                  ),
                })
              }
            />
            <TimeInput
              label="Monitoring ends"
              value={w.end}
              onChange={(v) =>
                update({
                  monitoring: p.monitoring.map((x, n) =>
                    n === i ? { ...x, end: v } : x,
                  ),
                })
              }
            />
            <button
              onClick={() =>
                update({ monitoring: p.monitoring.filter((_, n) => n !== i) })
              }
            >
              Remove period
            </button>
          </div>
        ))}
        <button
          className="sv-add"
          onClick={() =>
            update({ monitoring: [...p.monitoring, { start: NaN, end: NaN }] })
          }
        >
          + Add monitoring period
        </button>
      </section>
      <section className="sv-panel">
        <header>
          <h3>Shared opening checklist</h3>
          {p.template === "cma-us" && (
            <button
              onClick={() =>
                update({
                  opening: [
                    ...p.opening,
                    ...cmaOpening
                      .filter(
                        (label) => !p.opening.some((t) => t.label === label),
                      )
                      .map((label) => ({ id: uid(), label, owner: "" })),
                  ],
                })
              }
            >
              Add CMA US opening steps
            </button>
          )}
        </header>
        <div className="sv-inline-form">
          <TimeInput
            label="Opening ready by"
            value={p.openingBy ?? NaN}
            onChange={(v) => update({ openingBy: v })}
          />
        </div>
        {p.opening.map((t) => (
          <div className="sv-opening-editor" key={t.id}>
            <input
              aria-label="Opening task"
              maxLength={500}
              value={t.label}
              onChange={(e) =>
                update({
                  opening: p.opening.map((x) =>
                    x.id === t.id ? { ...x, label: e.target.value } : x,
                  ),
                })
              }
            />
            <select
              aria-label={`Owner for ${t.label}`}
              value={t.owner}
              onChange={(e) =>
                update({
                  opening: p.opening.map((x) =>
                    x.id === t.id ? { ...x, owner: e.target.value } : x,
                  ),
                })
              }
            >
              <option value="">Choose one owner</option>
              {p.people.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <button
              aria-label={`Remove ${t.label}`}
              onClick={() =>
                update({ opening: p.opening.filter((x) => x.id !== t.id) })
              }
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          className="sv-add"
          onClick={() =>
            update({
              opening: [...p.opening, { id: uid(), label: "", owner: "" }],
            })
          }
        >
          + Add opening task
        </button>
      </section>
      <section className="sv-editor-blocks">
        <div className="sv-section-label">
          <h3>Each person’s day</h3>
          <span>Same duty · same name · same colour</span>
        </div>
        {p.people.map((person) => (
          <section className="sv-editor-person" key={person.id}>
            <header>
              <div>
                <h3>{person.name}</h3>
                <span>
                  {clock(person.start)}–{clock(person.end)} IST
                </span>
              </div>
              <button
                onClick={() => {
                  const blocks = p.blocks.filter((b) => b.staff === person.id);
                  const start = blocks.length
                    ? Math.max(...blocks.map((b) => b.end))
                    : person.start;
                  const b = newBlock(person, "other");
                  b.start = start < person.end ? start : person.start;
                  b.end = Math.min(b.start + 60, person.end);
                  update({ blocks: [...p.blocks, b] });
                }}
              >
                + Add duty block
              </button>
            </header>
            {p.blocks
              .filter((b) => b.staff === person.id)
              .sort((a, b) => a.start - b.start)
              .map((b) => (
                <details
                  className="sv-block-editor"
                  key={b.id}
                  open={
                    !editor.base ||
                    !editor.base.plan.blocks.some((x) => x.id === b.id)
                  }
                >
                  <summary>
                    <strong>
                      {clock(b.start)}–{clock(b.end)}
                    </strong>
                    <span>
                      {b.duties.map((d) => DUTIES[d]?.label).join(" · ") ||
                        "Choose duties"}
                    </span>
                  </summary>
                  <div className="sv-block-editor-body">
                    <div className="sv-block-editor-top">
                      <TimeInput
                        label="From"
                        value={b.start}
                        onChange={(v) => replaceBlock({ ...b, start: v })}
                      />
                      <TimeInput
                        label="Until"
                        value={b.end}
                        onChange={(v) => replaceBlock({ ...b, end: v })}
                      />
                      <label>
                        Assigned staff
                        <select
                          value={b.staff}
                          onChange={(e) =>
                            replaceBlock({ ...b, staff: e.target.value })
                          }
                        >
                          {p.people.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        aria-label={`Remove ${person.name} ${clock(b.start)} duty`}
                        onClick={() =>
                          update({
                            blocks: p.blocks.filter((x) => x.id !== b.id),
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <DutyTags duties={b.duties} />
                    <details className="sv-duty-chooser">
                      <summary>
                        Choose duties / combined responsibilities
                      </summary>
                      <div>
                        {(Object.keys(DUTIES) as Duty[]).map((code) => (
                          <label key={code}>
                            <input
                              type="checkbox"
                              checked={b.duties.includes(code)}
                              onChange={() =>
                                replaceBlock({
                                  ...b,
                                  duties: b.duties.includes(code)
                                    ? b.duties.filter((d) => d !== code)
                                    : [...b.duties, code],
                                })
                              }
                            />
                            {DUTIES[code].label}
                          </label>
                        ))}
                      </div>
                    </details>
                    {b.duties.includes("break") && (
                      <label>
                        Who holds the hall during this break?
                        <select
                          value={b.cover || ""}
                          onChange={(e) =>
                            replaceBlock({ ...b, cover: e.target.value })
                          }
                        >
                          <option value="">Name the actual cover</option>
                          {p.people
                            .filter((s) => s.id !== b.staff)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Instructions / handover / pending work
                      <textarea
                        maxLength={2000}
                        value={b.note}
                        onChange={(e) =>
                          replaceBlock({ ...b, note: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Checklist — one task per line
                      <textarea
                        value={b.tasks.map((t) => t.label).join("\n")}
                        onChange={(e) =>
                          replaceBlock({
                            ...b,
                            tasks: e.target.value
                              .split("\n")
                              .map((label, i) => ({
                                id:
                                  b.tasks[i]?.label === label
                                    ? b.tasks[i].id
                                    : uid(),
                                label,
                              })),
                          })
                        }
                      />
                    </label>
                    {p.template === "cma-us" && (
                      <button
                        onClick={() =>
                          replaceBlock({
                            ...b,
                            tasks: [
                              ...b.tasks,
                              ...b.duties
                                .flatMap((d) => [...DUTIES[d].steps])
                                .filter(
                                  (label) =>
                                    !b.tasks.some((t) => t.label === label),
                                )
                                .map((label) => ({ id: uid(), label })),
                            ],
                          })
                        }
                      >
                        Add steps from CMA US starter
                      </button>
                    )}
                    {published &&
                      day === centreDate() &&
                      b.start <
                        minute(
                          new Intl.DateTimeFormat("en-GB", {
                            timeZone: "Asia/Kolkata",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }).format(new Date()),
                        ) &&
                      b.end >
                        minute(
                          new Intl.DateTimeFormat("en-GB", {
                            timeZone: "Asia/Kolkata",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }).format(new Date()),
                        ) && (
                        <button
                          onClick={() => {
                            const now = minute(
                              new Intl.DateTimeFormat("en-GB", {
                                timeZone: "Asia/Kolkata",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              }).format(new Date()),
                            );
                            update({
                              blocks: [
                                ...p.blocks.map((x) =>
                                  x.id === b.id ? { ...x, end: now } : x,
                                ),
                                {
                                  ...b,
                                  id: uid(),
                                  start: now,
                                  tasks: b.tasks.map((t) => ({
                                    ...t,
                                    id: uid(),
                                  })),
                                },
                              ],
                            });
                          }}
                        >
                          Split running block at current time
                        </button>
                      )}
                  </div>
                </details>
              ))}
          </section>
        ))}
      </section>
      <section className="sv-panel sv-editor-notes">
        <label>
          Day notes
          <textarea
            maxLength={5000}
            value={p.notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </label>
      </section>
      <section className="sv-plan-review">
        <h3>
          {allIssues.length
            ? `${allIssues.length} planning items to resolve`
            : "Coverage and assignment checks passed"}
        </h3>
        {allIssues.length > 0 && (
          <ul>
            {allIssues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        )}
        <p>
          Publication checks the real roster, monitoring coverage, named break
          cover and task ownership again on the server.
        </p>
      </section>
      {published && (
        <label>
          Reason for this change
          <input
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain the future duty / cover change"
          />
        </label>
      )}
      <div className="sv-editor-save">
        <button
          disabled={busy || (published && !!allIssues.length)}
          onClick={() => void onSave(false, reason)}
        >
          {published ? "Save changes" : "Save draft"}
        </button>
        <button
          className="sv-primary"
          disabled={busy || !!allIssues.length || (published && !reason.trim())}
          onClick={() => void onSave(true, reason)}
        >
          {published ? "Publish changes" : "Publish staff timetable"}
        </button>
      </div>
      {!published && (
        <div className="sv-copy-day">
          <label>
            Copy another day as a starting point
            <input
              type="date"
              value={prior}
              onChange={(e) => setPrior(e.target.value)}
            />
          </label>
          <button onClick={() => void copy()}>Load that day’s layout</button>
          <small>
            Uses this day’s roster. Temporary cover and all completion records
            are not copied.
          </small>
        </div>
      )}
    </section>
  );
}
