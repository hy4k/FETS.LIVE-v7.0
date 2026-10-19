import WorkDetail from "./ShiftDuty";
import DevelopmentReview from "./ShiftDevelopment";
import { ShiftTimetable } from "./ShiftCoverage";
import ShiftDayTimeline from "./ShiftDayTimeline";
import type { DayData } from "./shift-work-types";
import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCheck,
  Plus,
  RefreshCw,
  Users,
  ChevronDown,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { centreDate } from "./operations-data";
import { clock, minutes, type TeamMember } from "./shift-plan";
import {
  dayList,
  actionablesDue,
  type DayTask,
  type ListItem,
  type ActionableDuty,
} from "./shift-blueprint";
import { shiftRepository, type ShiftRepository } from "./shift-repository";
import {
  blueprintRepository,
  type BlueprintRepository,
} from "./shift-blueprint-repository";
import { workRepository, type WorkRepository } from "./shift-work-repository";
import { contract, overdue, type WorkAction } from "./shift-work";
import { Blueprint, DayReport, dayLead, type ShiftIdentity } from "./TheShift";
import { DayWorkspace, MonthPlanner, Reports } from "./DutyPlanning";
import { useWorkspaceCapabilities } from "./useWorkspaceCapabilities";
import "./duty-workspace.css";
import "./shift-workspace.css";
import "./shift-timetable.css";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Could not save. Please try again.";
const localMinute = (d: Date) =>
  minutes(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d),
  );
const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
type Props = {
  branch: string;
  navigate: (page: string) => void;
  legacy?: React.ReactNode;
  repository?: ShiftRepository;
  blueprint?: BlueprintRepository;
  work?: WorkRepository;
  cloud?: boolean;
  blueprintReady?: boolean;
  workflowReady?: boolean;
};
export default function DutyWorkspace(props: Props) {
  const { user, profile } = useAuth();
  const caps = useWorkspaceCapabilities(props.cloud === undefined);
  const identity = {
    id: user?.id || "",
    profileId: profile?.id || "",
    name: profile?.full_name || "Colleague",
    admin: ["super_admin", "Super Admin"].includes(profile?.role),
  };
  return (
    <ShiftWorkplace
      key={`${props.branch}:${identity.id}`}
      {...props}
      identity={identity}
      cloud={props.cloud ?? caps.duties}
      workflowReady={props.workflowReady ?? caps.dutyWorkflow}
      refreshSetup={caps.refresh}
    />
  );
}

/** One destination for work. Planning and personnel decisions never sit underneath staff's task list. */
export function ShiftWorkplace({
  branch,
  navigate,
  identity,
  legacy,
  repository = shiftRepository,
  blueprint = blueprintRepository,
  work = workRepository,
  cloud = true,
  workflowReady = false,
  refreshSetup = () => {},
}: Props & { identity: ShiftIdentity; refreshSetup?: () => void }) {
  const [day, setDay] = useState(centreDate());
  const [view, setView] = useState<
    "mine" | "team" | "planning" | "development" | "report"
  >(identity.admin ? "team" : "mine");
  const [planning, setPlanning] = useState<"contracts" | "rota" | "leads">(
    "rota",
  );
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const [adding, setAdding] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  useEffect(() => {
    const tick = () => {
      setNow(new Date());
      if (!busy && document.visibilityState === "visible")
        setReload((n) => n + 1);
    };
    const timer = window.setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [busy]);
  useEffect(() => {
    setData(null);
    setLoading(true);
    setError("");
    setLoadError("");
  }, [branch, day]);
  useEffect(() => {
    if (branch === "global" || !cloud || busy) {
      if (!cloud || branch === "global") setLoading(false);
      return;
    }
    let live = true;
    Promise.all([
      repository.roster(branch, day),
      blueprint.staff(branch),
      repository.load(branch, day),
      blueprint.responsibilities(branch),
      blueprint.tasks(branch, day),
      workflowReady
        ? work.access(branch, day)
        : Promise.resolve({ lead: identity.admin, manager: identity.admin }),
    ])
      .then(async ([team, people, shared, jobs, tasks, access]) => {
        let actionables: ActionableDuty[] = [];
        let actionablesFailed = false;
        try {
          actionables = await blueprint.actionables([
            ...new Set([...people, ...team].map((p) => p.id)),
          ]);
        } catch {
          actionablesFailed = true;
        }
        if (live) {
          setData({
            team,
            people,
            ...shared,
            weekLead: shared.lead?.lead_id ?? null,
            changes: shared.changes || [],
            closed: Boolean(shared.closed),
            jobs,
            tasks,
            actionables,
            actionablesFailed,
            lead: access.lead,
            manager: access.manager,
          });
          setLoadError("");
        }
      })
      .catch((e) => {
        if (live) setLoadError(errorText(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [
    branch,
    day,
    cloud,
    repository,
    blueprint,
    work,
    workflowReady,
    reload,
    busy,
    identity.admin,
  ]);
  useEffect(() => {
    const onTab = (event: Event) => {
      const tab = (event as CustomEvent<string>).detail;
      if (tab === "report") setView("report");
      else if (tab === "planning") {
        setView("planning");
        setPlanning("leads");
      } else if (tab === "blueprint") {
        setView("planning");
        setPlanning("contracts");
      }
    };
    const draft = (event: Event) => {
      const detail = (event as CustomEvent<{ branch: string; day: string }>)
        .detail;
      if (detail?.branch === branch) {
        setDay(detail.day);
        setView("report");
      }
    };
    document.addEventListener("the-shift-tab", onTab);
    window.addEventListener("fets-handover-draft", draft);
    return () => {
      document.removeEventListener("the-shift-tab", onTab);
      window.removeEventListener("fets-handover-draft", draft);
    };
  }, [branch]);
  const today = centreDate(now);
  const time = localMinute(now);
  const items = data
    ? dayList(data.jobs, data.tasks, day, new Set(data.team.map((p) => p.id)))
    : [];
  const leadId = data
    ? dayLead(data.record, data.weekLead, data.changes, now)
    : "";
  const canLead = Boolean(
    data && (data.lead || leadId === identity.profileId || identity.admin),
  );
  const manager = Boolean(data?.manager || identity.admin);
  const names = (id: string | null) =>
    [...(data?.people || []), ...(data?.team || [])].find((p) => p.id === id)
      ?.name || (id ? "Assigned colleague" : "Not assigned");
  const act = async (fn: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (success) setNotice(success);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const replace = (saved: DayTask) =>
    setData(
      (d) =>
        d && {
          ...d,
          tasks: [...d.tasks.filter((t) => t.id !== saved.id), saved],
        },
    );
  const transition = (
    item: ListItem,
    action: WorkAction,
    note = "",
    category = "",
  ) =>
    act(
      async () => {
        const task = await work.ensure(item, branch, day);
        replace(await work.action(task, action, note, category));
      },
      action === "complete"
        ? "Result submitted. An independent reviewer will check it."
        : action === "verify"
          ? "Work verified."
          : action === "start"
            ? "Duty started. Finish it here when the work is complete."
            : action === "help"
              ? "Help requested. Your lead can see what you need."
              : "Duty updated.",
    );
  const sharedProps = { branch, day, identity, repository, blueprint };
  const showView = (next: typeof view) => {
    setView(next);
    setNotice("");
  };
  const renderDuty = (item: ListItem) => (
    <WorkDetail
      key={item.key}
      item={item}
      names={names}
      team={data!.team}
      pastTarget={overdue(item, day, today, time)}
      future={day > today}
      me={identity.profileId}
      canLead={canLead}
      closed={data!.closed}
      ready={workflowReady}
      busy={busy}
      work={work}
      transition={transition}
      assign={(owner, due, priority, result, instructions) =>
        void act(async () => {
          const task = await work.ensure(item, branch, day);
          replace(
            await work.assign(task, owner, due, priority, result, instructions),
          );
        }, "Assignment saved.")
      }
    />
  );
  const linked = data
    ? actionablesDue(data.actionables, day).filter(
        (a) => view === "team" || a.owner_id === identity.profileId,
      )
    : [];
  return (
    <main className="shift-workplace">
      <header className="sw-header">
        <div className="sw-title">
          <h1>The Shift</h1>
          <span className="sw-centre">
            {branch === "global" ? "Choose a centre" : branch}
          </span>
        </div>
        <div className="sw-header-tools">
          <label className="sw-date">
            <CalendarDays size={16} />
            <span className="sw-sr">Working day</span>
            <input
              type="date"
              aria-label="Working day"
              value={day}
              onChange={(e) => {
                if (e.target.value) setDay(e.target.value);
              }}
            />
          </label>
          {day !== today && (
            <button className="sw-text" onClick={() => setDay(today)}>
              Today
            </button>
          )}
          <button
            className="sw-icon"
            aria-label="Refresh duties"
            onClick={() => setReload((n) => n + 1)}
            disabled={busy}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
      {branch === "global" ? (
        <section className="sw-empty">
          <Users />
          <h2>Choose a centre</h2>
          <p>
            Select Calicut or Cochin from the top menu to see that centre’s
            shift.
          </p>
        </section>
      ) : (
        <>
          <nav className="sw-nav" aria-label="Shift workspace">
            <button
              aria-current={view === "mine" ? "page" : undefined}
              onClick={() => showView("mine")}
            >
              My shift
            </button>
            <button
              aria-current={view === "team" ? "page" : undefined}
              onClick={() => showView("team")}
            >
              Team
            </button>
            {canLead && (
              <button
                aria-current={view === "planning" ? "page" : undefined}
                onClick={() => showView("planning")}
              >
                Plan
              </button>
            )}
            {canLead && (
              <button
                aria-current={view === "report" ? "page" : undefined}
                onClick={() => showView("report")}
              >
                Report
              </button>
            )}
            <button
              aria-current={view === "development" ? "page" : undefined}
              onClick={() => showView("development")}
            >
              {manager ? "People" : "My feedback"}
            </button>
          </nav>
          {!cloud && (
            <section className="sw-empty">
              <h2>Could not open the shift</h2>
              <p>Check your connection and centre access.</p>
              <button onClick={refreshSetup}>Try again</button>
            </section>
          )}
          {cloud && !workflowReady && (
            <div className="sw-notice" role="status">
              Duties are available to read. Work updates are awaiting
              activation.<button onClick={refreshSetup}>Check again</button>
            </div>
          )}
          {(error || loadError) && (
            <div role="alert" className="sw-error">
              {error || loadError}
              <button
                onClick={() => {
                  setError("");
                  setReload((n) => n + 1);
                }}
              >
                Refresh records
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="sw-notice">
              <CheckCheck size={17} />
              {notice}
            </div>
          )}
          {loading && !data && (
            <div className="sw-empty" role="status">
              Loading your shift…
            </div>
          )}
          {data && (
            <>
              {(view === "mine" || view === "team") && (
                <>
                  <div className="st-day-context">
                    <span>{dateLabel(day)} · India time</span>
                    <span>
                      Shift lead{" "}
                      <strong>{leadId ? names(leadId) : "Not assigned"}</strong>
                    </span>
                  </div>
                  {day !== today && (
                    <div className="sw-notice">
                      You are viewing {day > today ? "a future" : "an earlier"}{" "}
                      shift. Live check buttons are available only for today.
                    </div>
                  )}
                  {data.closed && (
                    <div className="sw-notice">
                      Report sent. This day is closed; its records are available
                      to read.
                    </div>
                  )}
                  <ShiftDayTimeline
                    key={`${view}:${day}:${branch}`}
                    data={data}
                    items={items}
                    day={day}
                    today={today}
                    time={time}
                    identity={identity}
                    teamView={view === "team"}
                    canLead={canLead}
                    busy={busy}
                    ready={workflowReady}
                    names={names}
                    renderDuty={renderDuty}
                    onAdd={() => setAdding(true)}
                    onCheck={(point) =>
                      void act(async () => {
                        if (data.record) {
                          const saved = await repository.event({
                            plan_id: data.record.id,
                            block: point.block,
                            lane: point.lane,
                            kind: point.kind,
                            due: point.due,
                            note: "",
                          });
                          setData(
                            (d) => d && { ...d, events: [...d.events, saved] },
                          );
                        }
                      }, "Check recorded at the current time.")
                    }
                  />
                  {(data.actionablesFailed || linked.length > 0) && (
                    <div className="sw-linked-work">
                      <div>
                        <strong>Actionables</strong>
                        <p>
                          {data.actionablesFailed
                            ? "Could not load your linked work."
                            : `${linked.length} open items due. Update them in Actionables.`}
                        </p>
                      </div>
                      <button onClick={() => navigate("actionables")}>
                        Open Actionables <ArrowUpRight size={14} />
                      </button>
                    </div>
                  )}
                  <section className="sw-schedule-section">
                    <div className="sw-section-heading">
                      <div>
                        <h2>
                          {view === "mine"
                            ? "Handover records"
                            : "Handover records"}
                        </h2>
                        <p>Record and review the result of each post.</p>
                      </div>
                      <button
                        className="sw-secondary"
                        aria-expanded={showSchedule}
                        onClick={() => setShowSchedule((v) => !v)}
                      >
                        {showSchedule ? "Hide handovers" : "Open handovers"}
                        <ChevronDown size={15} />
                      </button>
                    </div>
                    {showSchedule && (
                      <ShiftTimetable
                        data={data}
                        identity={identity}
                        names={names}
                        day={day}
                        today={today}
                        time={time}
                        teamView={view === "team"}
                        canLead={canLead}
                        busy={busy}
                        log={(block, lane, kind, note) =>
                          act(async () => {
                            if (data.record) {
                              const saved = await repository.event({
                                plan_id: data.record.id,
                                block,
                                lane,
                                kind,
                                due:
                                  kind === "submit"
                                    ? data.record.plan.blocks[block].end
                                    : 0,
                                note,
                              });
                              setData(
                                (d) =>
                                  d && { ...d, events: [...d.events, saved] },
                              );
                            }
                          }, "Handover recorded.")
                        }
                      />
                    )}
                  </section>
                  <a
                    className="sw-calling"
                    href="https://fets.online"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Candidate calling <ArrowUpRight size={13} />
                  </a>
                </>
              )}
              {view === "planning" &&
                (canLead ? (
                  <>
                    <div className="sw-section-intro">
                      <h2>Plan the shift</h2>
                      <p>
                        Publish daily posts and break cover. Keep regular duties
                        and the weekly lead up to date.
                      </p>
                    </div>
                    <div className="sw-filters sw-planning-tabs">
                      {[
                        ["rota", "Daily coverage"],
                        ["contracts", "Regular duties"],
                        ["leads", "Weekly leads"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          aria-pressed={planning === id}
                          onClick={() => setPlanning(id as typeof planning)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {planning === "contracts" && (
                      <Blueprint
                        {...{
                          branch,
                          identity,
                          repository,
                          blueprint,
                          workflowReady,
                        }}
                        canPlan={canLead}
                      />
                    )}
                    {planning === "rota" && (
                      <DayWorkspace
                        key={`${branch}:${day}`}
                        {...{ branch, day, identity, repository, cloud }}
                        embedded
                        canPlan={manager}
                      />
                    )}
                    {planning === "leads" && (
                      <MonthPlanner
                        branch={branch}
                        month={day.slice(0, 7)}
                        {...{ identity, repository, cloud }}
                        canPlan={manager}
                        openDay={(d) => {
                          setDay(d);
                          setPlanning("rota");
                        }}
                      />
                    )}
                  </>
                ) : (
                  <div className="sw-empty">
                    Your lead manages the plan. Open My shift to see your
                    duties.
                  </div>
                ))}
              {view === "development" && (
                <DevelopmentReview
                  key={`${branch}:${manager}:${workflowReady}`}
                  branch={branch}
                  me={identity.profileId}
                  people={data.people}
                  manager={manager}
                  ready={workflowReady}
                  work={work}
                />
              )}
              {view === "report" && canLead && (
                <>
                  <DayReport
                    {...sharedProps}
                    canPlan={manager}
                    onSubmitted={() => {
                      setData((d) => d && { ...d, closed: true });
                      setReload((n) => n + 1);
                    }}
                  />
                  <Reports
                    key={String(data.closed)}
                    branch={branch}
                    month={day.slice(0, 7)}
                    {...{ identity, repository, cloud }}
                  />
                  {legacy && (
                    <details className="sw-legacy">
                      <summary>Earlier handover records</summary>
                      {legacy}
                    </details>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {adding && data && (
        <AddDuty
          team={data.team}
          close={() => setAdding(false)}
          busy={busy}
          error={error}
          save={(input) =>
            void act(async () => {
              replace(await work.add({ ...input, branch, day }));
              setAdding(false);
            }, "Duty assigned.")
          }
        />
      )}
    </main>
  );
}

function AddDuty({
  team,
  busy,
  close,
  save,
  error,
}: {
  team: TeamMember[];
  busy: boolean;
  close: () => void;
  error: string;
  save: (input: {
    title: string;
    assigned_to: string;
    expected_result: string;
    instructions: string;
    due_minute: number;
    priority: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [result, setResult] = useState("");
  const [instructions, setInstructions] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("normal");
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector("input")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      className="sw-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Assign a duty"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) close();
        if (e.key === "Tab") {
          const nodes = ref.current?.querySelectorAll<HTMLElement>(
            "input,textarea,select,button:not(:disabled)",
          );
          if (!nodes?.length) return;
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <form
        className="sw-modal"
        onSubmit={(e) => {
          e.preventDefault();
          save({
            title: title.trim(),
            assigned_to: owner,
            expected_result: result.trim(),
            instructions: instructions.trim(),
            due_minute: minutes(due),
            priority,
          });
        }}
      >
        <header>
          <div>
            <h2>Assign a duty</h2>
          </div>
          <button
            type="button"
            aria-label="Close assignment"
            disabled={busy}
            onClick={close}
          >
            ×
          </button>
        </header>
        {error && (
          <p className="sw-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Duty
          <input
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Owner
          <select
            required
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            <option value="">Choose someone on today’s roster</option>
            {team.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Done means
          <textarea
            required
            maxLength={2000}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="What result should the reviewer be able to confirm?"
          />
        </label>
        <label>
          Instructions
          <textarea
            maxLength={2000}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>
        <div className="sw-form-row">
          <label>
            Target time
            <input
              required
              type="time"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="normal">Normal</option>
              <option value="important">Important</option>
            </select>
          </label>
        </div>
        <button
          className="sw-primary"
          disabled={busy || !title.trim() || !owner || !result.trim() || !due}
        >
          {busy ? "Saving…" : "Assign duty"}
        </button>
      </form>
    </div>
  );
}
