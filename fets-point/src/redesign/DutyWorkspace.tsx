import WorkDetail from "./ShiftDuty";
import DevelopmentReview from "./ShiftDevelopment";
import { LiveResponsibility, ShiftTimetable } from "./ShiftCoverage";
import type { DayData } from "./shift-work-types";
import React, { useEffect, useState } from "react";
import {ArrowUpRight, CheckCheck, ChevronRight, Plus, RefreshCw, ShieldCheck, Users} from 'lucide-react';
import { useAuth } from "../hooks/useAuth";
import { centreDate } from "./operations-data";
import {clock, minutes, type TeamMember} from './shift-plan';
import {shortDutyTitle} from './shift-board';
import {dayList, actionablesDue, type DayTask, type ListItem, type ActionableDuty} from './shift-blueprint';
import { shiftRepository, type ShiftRepository } from "./shift-repository";
import {
  blueprintRepository,
  type BlueprintRepository,
} from "./shift-blueprint-repository";
import { workRepository, type WorkRepository } from "./shift-work-repository";
import {
  contract,
  orderedWork,
  overdue,
  workState,
  WORK_LABELS,
  type WorkAction,
} from "./shift-work";
import { Blueprint, DayReport, dayLead, type ShiftIdentity } from "./TheShift";
import { DayWorkspace, MonthPlanner, Reports } from "./DutyPlanning";
import { useWorkspaceCapabilities } from "./useWorkspaceCapabilities";
import "./duty-workspace.css";
import "./shift-workspace.css";

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
    "contracts",
  );
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const [selected, setSelected] = useState("");
  const [person, setPerson] = useState("all");
  const [filter, setFilter] = useState("active");
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
    setSelected("");
    setPerson("all");
    setError("");
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
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(errorText(e));
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
          : "Duty updated.",
    );
  const myItems = items.filter((i) => i.assignee === identity.profileId);
  const base =
    view === "mine"
      ? myItems
      : items.filter(
          (i) =>
            person === "all" ||
            i.assignee === person ||
            (person === "none" && !i.assignee),
        );
  const list = orderedWork(base).filter(
    (i) =>
      filter === "all" ||
      (filter === "active"
        ? !["verified", "carried", "skipped"].includes(workState(i))
        : filter === "overdue"
          ? overdue(i, day, today, time)
          : workState(i) === filter),
  );
  const chosen = list.find((i) => i.key === selected) || list[0];
  const sharedProps = { branch, day, identity, repository, blueprint };
  const showView = (next: typeof view) => {
    setView(next);
    setFilter("active");
    setSelected("");
    setNotice("");
  };
  return (
    <main className="shift-workplace">
      <header className="sw-header">
        <div>
          <span className="sw-eyebrow">FETS / DAILY WORK</span>
          <h1>
            The Shift<span>.</span>
          </h1>
          <p>Know your part. Do it well. Get the support you need.</p>
        </div>
        <label className="sw-date">
          Working day
          <input
            type="date"
            aria-label="Working day"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
          <small>
            India time · {branch === "global" ? "Choose a centre" : branch}
          </small>
        </label>
      </header>
      {branch === "global" ? (
        <section className="sw-empty">
          <Users />
          <h2>Start with one centre.</h2>
          <p>
            Select Calicut or Cochin from the top menu. Each has its own people,
            responsibilities and work records.
          </p>
        </section>
      ) : (
        <>
          <nav className="sw-nav" aria-label="Shift workspace">
            <button
              aria-current={view === "mine" ? "page" : undefined}
              onClick={() => showView("mine")}
            >
              My day
            </button>
            <button
              aria-current={view === "team" ? "page" : undefined}
              onClick={() => showView("team")}
            >
              Team day
            </button>
            {canLead && (
              <button
                aria-current={view === "planning" ? "page" : undefined}
                onClick={() => showView("planning")}
              >
                Plan & responsibilities
              </button>
            )}
            <button
              aria-current={view === "development" ? "page" : undefined}
              onClick={() => showView("development")}
            >
              {manager ? "Review & development" : "My feedback"}
            </button>
            {canLead && (
              <button
                aria-current={view === "report" ? "page" : undefined}
                onClick={() => showView("report")}
              >
                Day report
              </button>
            )}
          </nav>
          {!cloud && (
            <section className="sw-empty">
              <h2>Your shared duties could not be opened.</h2>
              <p>Check your connection and centre access, then try again.</p>
              <button onClick={refreshSetup}>Try again</button>
            </section>
          )}
          {cloud && !workflowReady && (
            <div className="sw-notice" role="status">
              Your existing duties are shown below. The new work and feedback
              actions are awaiting activation.
              <button onClick={refreshSetup}>Check again</button>
            </div>
          )}
          {error && (
            <div role="alert" className="sw-error">
              {error}
              <button onClick={() => setReload((n) => n + 1)}>
                Refresh records
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="sw-notice">
              {notice}
            </div>
          )}
          {loading && !data && (
            <div className="sw-empty">Loading the centre’s agreed work…</div>
          )}
          {data && (
            <>
              {(view === "mine" || view === "team") && (
                <>
                  <div className="sw-day-heading">
                    <div>
                      <span className="sw-eyebrow">
                        {dateLabel(day)} ·{" "}
                        {view === "mine" ? identity.name : "THE CENTRE TEAM"}
                      </span>
                      <h2>
                        {view === "mine"
                          ? "Your work, clearly laid out."
                          : "Make the day work for everyone."}
                      </h2>
                      <p>
                        Lead:{" "}
                        <strong>
                          {leadId ? names(leadId) : "Not assigned yet"}
                        </strong>
                        {leadId === identity.profileId
                          ? " · You also own your regular duties."
                          : " · Your first contact for priorities and support."}
                      </p>
                    </div>
                    <button
                      className="sw-icon"
                      aria-label="Refresh duties"
                      onClick={() => setReload((n) => n + 1)}
                      disabled={busy}
                    >
                      <RefreshCw size={18} />
                    </button>
                  </div>
                  {data.closed && (
                    <div className="sw-notice">
                      This day is closed. Its work and evidence are kept for
                      reference.
                    </div>
                  )}
                  {view === "mine" && (
                    <LiveResponsibility
                      data={data}
                      day={day}
                      today={today}
                      time={time}
                      identity={identity}
                      names={names}
                      busy={busy}
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
                              (d) =>
                                d && { ...d, events: [...d.events, saved] },
                            );
                          }
                        }, "Check recorded at the current time.")
                      }
                    />
                  )}
                  {view === "team" && (
                    <div className="sw-metrics" aria-label="Team work status">
                      {(
                        [
                          ["unassigned", "Need an owner"],
                          ["help", "Need support"],
                          ["review", "Ready for review"],
                          ["verified", "Verified"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          aria-pressed={filter === key}
                          onClick={() => {
                            setFilter(key);
                            setPerson("all");
                          }}
                        >
                          <strong>
                            {items.filter((i) => workState(i) === key).length}
                          </strong>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="sw-list-toolbar">
                    <div className="sw-filters" aria-label="Filter duties">
                      {[
                        ["active", "Active work"],
                        ["review", "Review"],
                        ["verified", "Verified"],
                        ["overdue", "Past target"],
                        ["all", "All"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          aria-pressed={filter === id}
                          onClick={() => setFilter(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {view === "team" && (
                      <label className="sw-person-filter">
                        <span>Owner</span>
                        <select
                          aria-label="Filter by owner"
                          value={person}
                          onChange={(e) => setPerson(e.target.value)}
                        >
                          <option value="all">Everyone</option>
                          <option value="none">Not assigned</option>
                          {[
                            ...new Map(
                              [...data.team, ...data.people].map((p) => [
                                p.id,
                                p,
                              ]),
                            ).values(),
                          ].map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="sw-work-grid">
                    <section
                      className="sw-work-list"
                      aria-label={view === "mine" ? "My duties" : "Team duties"}
                    >
                      <header>
                        <h3>
                          {view === "mine" ? "My duties" : "Daily assignments"}
                        </h3>
                        <span>{list.length}</span>
                      </header>
                      {list.length ? (
                        list.map((item) => (
                          <button
                            className={`sw-work-item ${chosen?.key === item.key ? "is-selected" : ""}`}
                            key={item.key}
                            aria-pressed={chosen?.key === item.key}
                            onClick={() => {
                              setSelected(item.key);
                              if (
                                window.matchMedia?.("(max-width: 800px)")
                                  ?.matches
                              )
                                requestAnimationFrame(() =>
                                  document
                                    .querySelector(".sw-detail")
                                    ?.scrollIntoView?.({
                                      behavior: "smooth",
                                      block: "start",
                                    }),
                                );
                            }}
                          >
                            <span
                              className={`sw-state-dot is-${workState(item)}`}
                            />
                            <span>
                              <strong>{shortDutyTitle(item.title)}</strong>
                              <small>
                                {view === "team"
                                  ? `${names(item.assignee)} · `
                                  : ""}
                                {contract(item).due !== null
                                  ? `By ${clock(contract(item).due!)}`
                                  : "Today · time not set"}
                                {overdue(item, day, today, time)
                                  ? " · Past target"
                                  : ""}
                              </small>
                              <span
                                className={`sw-state is-${workState(item)}`}
                              >
                                {WORK_LABELS[workState(item)]}
                              </span>
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        ))
                      ) : (
                        <div className="sw-empty">
                          <CheckCheck size={26} />
                          <h3>
                            {base.length
                              ? "Nothing in this view."
                              : "No duties assigned yet."}
                          </h3>
                          <p>
                            {base.length
                              ? "Use All to see the complete list."
                              : "The lead assigns the work for this day. This does not mean the centre has no work."}
                          </p>
                        </div>
                      )}
                      {canLead && (
                        <button
                          className="sw-add"
                          disabled={!workflowReady || data.closed}
                          onClick={() => setAdding(true)}
                        >
                          <Plus size={16} /> Assign a duty
                        </button>
                      )}
                    </section>
                    {chosen ? (
                      <WorkDetail
                        key={`${chosen.key}:${day}`}
                        item={chosen}
                        names={names}
                        team={data.team}
                        me={identity.profileId}
                        canLead={canLead}
                        closed={data.closed}
                        ready={workflowReady}
                        busy={busy}
                        work={work}
                        transition={transition}
                        assign={(owner, due, priority, result, instructions) =>
                          void act(async () => {
                            const task = await work.ensure(chosen, branch, day);
                            replace(
                              await work.assign(
                                task,
                                owner,
                                due,
                                priority,
                                result,
                                instructions,
                              ),
                            );
                          }, "Assignment agreed.")
                        }
                      />
                    ) : (
                      <section className="sw-detail sw-detail-empty">
                        <ShieldCheck size={30} />
                        <h3>One owner. One clear result.</h3>
                        <p>
                          Select a duty to see its agreement, result and review
                          in one place.
                        </p>
                      </section>
                    )}
                  </div>
                  {data.actionablesFailed ? (
                    <div className="sw-notice">
                      Actionables could not be loaded.{" "}
                      <button onClick={() => navigate("actionables")}>
                        Open Actionables
                      </button>
                    </div>
                  ) : (
                    actionablesDue(data.actionables, day).filter(
                      (a) =>
                        view === "team" || a.owner_id === identity.profileId,
                    ).length > 0 && (
                      <div className="sw-linked-work">
                        <div>
                          <strong>Outreach work stays in Actionables</strong>
                          <p>
                            {
                              actionablesDue(data.actionables, day).filter(
                                (a) =>
                                  view === "team" ||
                                  a.owner_id === identity.profileId,
                              ).length
                            }{" "}
                            open items are due. Record their results there so
                            work is not counted twice.
                          </p>
                        </div>
                        <button onClick={() => navigate("actionables")}>
                          Open Actionables <ArrowUpRight size={15} />
                        </button>
                      </div>
                    )
                  )}
                  <div className="sw-schedule-toggle">
                    <button
                      onClick={() => setShowSchedule((v) => !v)}
                      aria-expanded={showSchedule}
                    >
                      {showSchedule ? "Hide" : "View"}{" "}
                      {view === "mine"
                        ? "my timetable & handover"
                        : "team coverage & handovers"}
                    </button>
                    <a
                      href="https://fets.online"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Candidate calling <ArrowUpRight size={14} />
                    </a>
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
                </>
              )}
              {view === "planning" &&
                (canLead ? (
                  <>
                    <div className="sw-section-intro">
                      <h2>Agree the work before the day starts.</h2>
                      <p>
                        Set one owner, a backup, a clear result and a target
                        time. Recurring duties appear when due; the roster
                        decides whether the owner or backup is working.
                      </p>
                    </div>
                    <div className="sw-filters">
                      {[
                        ["contracts", "Responsibilities"],
                        ["rota", "Daily coverage"],
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
                        branch={branch}
                        identity={identity}
                        repository={repository}
                        blueprint={blueprint}
                        workflowReady={workflowReady}
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
                        identity={identity}
                        repository={repository}
                        cloud={cloud}
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
                    The lead manages work agreements. Open My day to see your
                    responsibilities.
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
                  <DayReport {...sharedProps} canPlan={manager} />
                  <Reports
                    branch={branch}
                    month={day.slice(0, 7)}
                    identity={identity}
                    repository={repository}
                    cloud={cloud}
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
              setFilter("all");
            }, "Duty assigned with a clear result.")
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
            <span className="sw-eyebrow">AGREE THE OUTCOME</span>
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
          {busy ? "Saving…" : "Agree & assign duty"}
        </button>
      </form>
    </div>
  );
}
