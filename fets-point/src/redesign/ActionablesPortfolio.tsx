import { useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Copy,
  Flag,
  GraduationCap,
  HelpCircle,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  DISTRICTS,
  dueLabel,
  PEARSON_REQUIREMENTS_URL,
} from "./institution-workflow";
import {
  ACTIONABLES_REFERENCE,
  capacityEstimate,
  FILTER_LABELS,
  institutionProgress,
  latestResult,
  matchesWork,
  readiness,
  selectedIds,
  WORK_STATUS,
  workFlags,
  workOrder,
  type ActionablesData,
  type ActionablesIdentity,
  type Institution,
  type WorkFilter,
  type WorkItem,
} from "./actionables-model";
export type PortfolioView =
  | "overview"
  | "mine"
  | "institutions"
  | "rollout"
  | "followup"
  | "resources";
export const PORTFOLIO_TABS = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "mine", label: "My work", icon: ClipboardList },
  { id: "institutions", label: "Institutions", icon: GraduationCap },
  { id: "rollout", label: "Seven-centre plan", icon: Target },
  { id: "followup", label: "Team follow-up", icon: Users },
  { id: "resources", label: "Guides & planning", icon: ShieldCheck },
] as const;
const CONTACT_SCRIPT =
  "Hello, I’m [name] from FETS. We are coordinating a seven-centre Pearson VUE project across Kerala, covering multi-exam programmes including IT, cloud, accounting and professional examinations. We would like to evaluate your campus computer-lab facilities and discuss the partnership with your principal or IT lead. Could we arrange a 15-minute introductory visit in [district] on [day]? Please let us know the appropriate contact and email address.";
export function WorkCard({
  task,
  data,
  onResult,
  onOpen,
}: {
  task: WorkItem;
  data: ActionablesData;
  onResult: (t: WorkItem) => void;
  onOpen: (t: WorkItem) => void;
}) {
  const latest = latestResult(task, data.updates),
    flags = workFlags(task, data.updates);
  const inst = data.institutions.find((i) => i.id === task.institution_id);
  const recipient = data.staff.find(
    (p) => p.user_id === (latest?.report_to_id || task.report_to_id),
  );
  return (
    <article
      className={`aw-work-card ${flags.overdue ? "is-late" : flags.blocked ? "is-blocked" : ""}`}
    >
      <div className="aw-work-top">
        <span className="aw-small-label">
          {inst?.name || "General project work"}
        </span>
        <span className={`aw-state is-${task.status}`}>
          {WORK_STATUS[task.status]}
        </span>
      </div>
      <h3>{task.title}</h3>
      <div className="aw-work-meta">
        <span>
          <Users size={14} />
          {task.owner?.full_name ||
            data.staff.find((p) => p.id === task.owner_id)?.full_name ||
            "Owner needed"}
        </span>
        <span>
          <Clock3 size={14} />
          {dueLabel(task.due_date, task.due_at)}
        </span>
      </div>
      <div className="aw-signals">
        {flags.overdue && <span className="aw-signal late">Past due</span>}
        {flags.blocked && (
          <span className="aw-signal blocked">Needs support</span>
        )}
        {flags.unassigned && (
          <span className="aw-signal late">Needs an owner</span>
        )}
        {flags.followup && (
          <span className="aw-signal followup">Follow-up due</span>
        )}
        {flags.report && (
          <span className="aw-signal followup">
            To report to {recipient?.full_name || "the reporting person"}
          </span>
        )}
      </div>
      {latest ? (
        <div className="aw-work-outcome">
          <span>LATEST RESULT</span>
          <p>{latest.content}</p>
          {latest.follow_up_date && (
            <small>
              Follow up {dueLabel(latest.follow_up_date, latest.follow_up_at)}
            </small>
          )}
        </div>
      ) : (
        <p className="aw-work-instructions">
          {task.instructions ||
            task.impact ||
            "Open the institution to agree the expected result."}
        </p>
      )}
      <footer>
        <button className="aw-button small" onClick={() => onResult(task)}>
          Update result <ArrowUpRight size={15} />
        </button>
        {inst && (
          <button className="aw-text-button" onClick={() => onOpen(task)}>
            Open institution <ChevronRight size={15} />
          </button>
        )}
      </footer>
    </article>
  );
}
export function InstitutionCard({
  institution: i,
  data,
  onOpen,
}: {
  institution: Institution;
  data: ActionablesData;
  onOpen: (i: Institution) => void;
}) {
  const p = institutionProgress(i.id, data.stages, data.tasks),
    r = readiness(i.id, data.observations),
    chosen = selectedIds(data.selections).has(i.id);
  const todo = data.tasks.filter(
    (t) => t.institution_id === i.id && t.status !== "done",
  );
  const attention = data.tasks.filter(
    (t) =>
      t.institution_id === i.id && matchesWork(t, data.updates, "attention"),
  );
  const nextByMilestone: Record<string, string> = {
    Scouted: "Contact and approach",
    "Pitch Sent": "Follow up on the proposal",
    Inspected: "Agree responsibilities",
    "MoU Signed": "Follow up on provider approval",
    Certified: "Confirm handover arrangements",
  };
  return (
    <article className={`aw-institution ${p.delivered ? "is-delivered" : ""}`}>
      <div className="aw-institution-top">
        <span
          className={`aw-district district-${DISTRICTS.indexOf(i.district as any)}`}
        >
          <MapPin size={12} />
          {i.district}
        </span>
        {p.delivered ? (
          <span className="aw-state is-done">
            <Check size={12} /> Delivered
          </span>
        ) : i.actionables_reference ? (
          <span
            className={`aw-source-status status-${i.actionables_reference.status.toLowerCase().split(" ").join("-")}`}
          >
            {i.actionables_reference.status}
          </span>
        ) : (
          <span className="aw-muted">Exploring</span>
        )}
      </div>
      <button className="aw-institution-title" onClick={() => onOpen(i)}>
        <h3>{i.name}</h3>
        <ArrowUpRight size={20} />
      </button>
      <p className="aw-contact-line">
        {i.primary_contact_name || "Contact point needed"}
        {i.primary_contact_role ? ` · ${i.primary_contact_role}` : ""}
      </p>
      <div className="aw-directory-contact">
        {i.primary_contact_phone && (
          <a href={`tel:${i.primary_contact_phone.replace(/[^+\d]/g, "")}`}>
            {i.primary_contact_phone}
          </a>
        )}
        {i.address && <p title={i.address}>{i.address}</p>}
      </div>
      {i.actionables_reference && (
        <div className="aw-reference-metrics">
          <span>
            {i.lab_seat_capacity != null
              ? `${i.lab_seat_capacity} seats`
              : "Capacity to confirm"}
          </span>
          <span>Readiness record {i.actionables_reference.score}%</span>
          {chosen && (
            <span>
              <Flag size={10} /> Shortlisted
            </span>
          )}
        </div>
      )}
      <div className="aw-next-step">
        <span>NEXT STEP</span>
        <strong>
          {p.delivered
            ? "Handover recorded"
            : i.actionables_reference && p.done === 0
              ? nextByMilestone[i.actionables_reference.status]
              : p.next?.title || "Agree the next step"}
        </strong>
      </div>
      <div className="aw-progress">
        <span style={{ width: `${p.percent}%` }} />
      </div>
      <div className="aw-progress-caption">
        <span>
          {p.done} of {p.total} stage results recorded
        </span>
        <span>{todo.length} open duties</span>
      </div>
      <footer>
        <span className={attention.length ? "aw-attention-note" : "aw-muted"}>
          {attention.length
            ? `${attention.length} ${attention.length === 1 ? "duty needs" : "duties need"} attention`
            : "No flagged duties"}
          {data.extensionsReady && r.gaps ? ` · ${r.gaps} readiness gaps` : ""}
        </span>
        <button className="aw-text-button" onClick={() => onOpen(i)}>
          View work <ArrowRight size={15} />
        </button>
      </footer>
    </article>
  );
}
type Props = {
  data: ActionablesData;
  identity: ActionablesIdentity;
  view: PortfolioView;
  district: string | null;
  search: string;
  filter: WorkFilter;
  person: string;
  busy: boolean;
  setSearch: (v: string) => void;
  setDistrict: (v: string | null) => void;
  setPerson: (v: string) => void;
  setFilter: (v: WorkFilter) => void;
  go: (v: PortfolioView, f?: WorkFilter) => void;
  onOpen: (i: Institution) => void;
  onWork: (t: WorkItem) => void;
  onResult: (t: WorkItem) => void;
  onAdd: () => void;
  onSelect: (i: Institution, value: boolean) => void;
};
export default function ActionablesPortfolio(p: Props) {
  const {
    data,
    identity,
    view,
    district,
    search,
    filter,
    person,
    go,
    onOpen,
    onWork,
    onResult,
    onAdd,
    onSelect,
  } = p;
  const [days, setDays] = useState(200),
    [use, setUse] = useState(35),
    [sessions, setSessions] = useState(1);
  const chosen = selectedIds(data.selections);
  const targets = data.institutions.filter((i) => chosen.has(i.id));
  const catalogue = data.institutions.filter((i) => i.actionables_reference);
  const certified = catalogue.filter(
    (i) => i.actionables_reference?.status === "Certified",
  ).length;
  const delivered = data.institutions.filter(
    (i) => institutionProgress(i.id, data.stages, data.tasks).delivered,
  ).length;
  const counts = {
    overdue: data.tasks.filter((t) => matchesWork(t, data.updates, "overdue"))
      .length,
    blocked: data.tasks.filter((t) => matchesWork(t, data.updates, "blocked"))
      .length,
    followup: data.tasks.filter((t) => matchesWork(t, data.updates, "followup"))
      .length,
    report: data.tasks.filter((t) => matchesWork(t, data.updates, "report"))
      .length,
    unassigned: data.tasks.filter((t) =>
      matchesWork(t, data.updates, "unassigned"),
    ).length,
  };
  const projectInstitutions = catalogue.length ? catalogue : data.institutions;
  const query = search.trim().toLocaleLowerCase();
  const matchInstitution = (i: Institution) =>
    (!district || i.district === district) &&
    (!query ||
      [
        i.name,
        i.address,
        i.primary_contact_name,
        i.district,
        i.actionables_reference?.pincode,
        i.actionables_reference?.status,
      ].some((v) => v?.toLocaleLowerCase().includes(query)));
  const insts = projectInstitutions.filter(matchInstitution);
  const legacy = catalogue.length
    ? data.institutions.filter(
        (i) => !i.actionables_reference && matchInstitution(i),
      )
    : [];
  const queue = workOrder(
    data.tasks.filter(
      (t) =>
        (view !== "mine" || t.owner_id === identity.id) &&
        (person === "all" || t.owner_id === person) &&
        (!district ||
          t.district === district ||
          data.institutions.some(
            (i) => i.id === t.institution_id && i.district === district,
          )) &&
        matchesWork(t, data.updates, filter) &&
        (!query ||
          [
            t.title,
            t.owner?.full_name,
            data.institutions.find((i) => i.id === t.institution_id)?.name,
          ].some((v) => v?.toLocaleLowerCase().includes(query))),
    ),
    data.updates,
  );
  const attention = workOrder(
    data.tasks.filter((t) => matchesWork(t, data.updates, "attention")),
    data.updates,
  );
  const estimate = capacityEstimate(
    data.institutions,
    chosen,
    days,
    use,
    sessions,
  );
  const copy = async (text: string) => {
    try {
      if (!navigator.clipboard) throw new Error();
      await navigator.clipboard.writeText(text);
      toast.success("Script copied");
    } catch {
      toast.error("Could not copy. Select and copy the script shown here.");
    }
  };
  const finder = (
    <div className="aw-finder">
      <label className="aw-search">
        <Search size={17} />
        <input
          aria-label="Search work and institutions"
          placeholder={
            view === "institutions"
              ? "Find an institution, contact or town…"
              : "Find a duty, colleague or institution…"
          }
          value={search}
          onChange={(e) => p.setSearch(e.target.value)}
        />
      </label>
      <label className="aw-select-label">
        District
        <select
          aria-label="Filter district"
          value={district || "all"}
          onChange={(e) =>
            p.setDistrict(e.target.value === "all" ? null : e.target.value)
          }
        >
          <option value="all">All districts</option>
          {DISTRICTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
    </div>
  );
  return (
    <>
      {view === "overview" && (
        <>
          <section className="aw-hero">
            <div className="aw-hero-copy">
              <span className="aw-eyebrow">ONE TEAM. A CLEAR WAY FORWARD.</span>
              <h2>
                Big goals.
                <br />
                <em>Clear next steps.</em>
              </h2>
              <p>
                Bring seven centres from first conversation to a signed-off
                handover. See what moved, what needs help and who takes the next
                step.
              </p>
              <div className="aw-reference-metrics aw-hero-records">
                <span>
                  {catalogue.length || data.institutions.length} institutions
                </span>
                <span>5 districts</span>
                <span>{certified} certified in the brief</span>
              </div>
              <div className="aw-hero-actions">
                <button
                  className="aw-button"
                  onClick={() => go("mine", "active")}
                >
                  See my work <ArrowRight size={17} />
                </button>
                <button
                  className="aw-button secondary"
                  onClick={() => go("institutions")}
                >
                  Explore institutions
                </button>
              </div>
            </div>
            <div className="aw-goal">
              <div
                className="aw-goal-ring"
                style={
                  {
                    "--goal-progress": `${Math.min(100, (chosen.size / 7) * 100)}%`,
                  } as any
                }
              >
                <div>
                  <strong>
                    {chosen.size}
                    <small>/ 7</small>
                  </strong>
                  <span>institutions shortlisted</span>
                </div>
                {Array.from({ length: 7 }, (_, i) => (
                  <i
                    key={i}
                    className={i < chosen.size ? "done" : ""}
                    style={{ "--dot": i } as any}
                  />
                ))}
              </div>
              <div className="aw-goal-foot">
                <span>
                  <i className="aw-dot lavender" />
                  {certified} certified in the brief
                </span>
                <span>
                  <i className="aw-dot mint" />
                  {delivered} handovers recorded
                </span>
              </div>
            </div>
          </section>
          {catalogue.length > 0 && (
            <section
              className="aw-milestone-strip"
              aria-label="Recorded institution milestones"
            >
              <span>
                PROJECT BRIEF
                <br />
                <strong>Where things stand</strong>
              </span>
              {[
                "Scouted",
                "Pitch Sent",
                "Inspected",
                "MoU Signed",
                "Certified",
              ].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    go("institutions");
                    p.setSearch(status);
                  }}
                >
                  <strong>
                    {
                      catalogue.filter(
                        (i) => i.actionables_reference?.status === status,
                      ).length
                    }
                  </strong>
                  <span>{status}</span>
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </section>
          )}
          <section className="aw-pulse" aria-label="What needs attention">
            {(
              [
                {
                  key: "overdue",
                  label: "Past due",
                  note: "Agree the next action",
                  icon: Clock3,
                  color: "peach",
                },
                {
                  key: "blocked",
                  label: "Needs support",
                  note: "Help the work move",
                  icon: HelpCircle,
                  color: "lavender",
                },
                {
                  key: "followup",
                  label: "Follow-ups due",
                  note: "Close the conversation loop",
                  icon: ArrowDownRight,
                  color: "mint",
                },
                {
                  key: "report",
                  label: "To report",
                  note: "Confirm the recipient is informed",
                  icon: Flag,
                  color: "blue",
                },
              ] as const
            ).map((c) => (
              <button
                className={`aw-pulse-card ${c.color}`}
                key={c.key}
                onClick={() => go("followup", c.key)}
              >
                <div>
                  <c.icon size={19} />
                  <ArrowUpRight size={16} />
                </div>
                <strong>{counts[c.key]}</strong>
                <h3>{c.label}</h3>
                <p>{c.note}</p>
              </button>
            ))}
          </section>
          <div className="aw-two-col">
            <section className="aw-panel">
              <div className="aw-section-heading">
                <div>
                  <span className="aw-eyebrow">KEEP WORK MOVING</span>
                  <h2>Worth a follow-up</h2>
                </div>
                <button
                  className="aw-text-button"
                  onClick={() => go("followup", "attention")}
                >
                  See all <ArrowRight size={15} />
                </button>
              </div>
              {attention.length ? (
                attention
                  .slice(0, 3)
                  .map((t) => (
                    <WorkCard
                      key={t.id}
                      task={t}
                      data={data}
                      onResult={onResult}
                      onOpen={onWork}
                    />
                  ))
              ) : data.referenceTasks.some((t) => t.status !== "done") ? (
                <>
                  <p className="aw-brief-intro">
                    The team brief has work underway. Agree a named owner and
                    the next follow-up for each task.
                  </p>
                  <div className="aw-brief-items">
                    {data.referenceTasks
                      .filter((t) => t.status !== "done")
                      .slice(0, 3)
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => go("followup", "all")}
                        >
                          <div>
                            <span>{t.assignee}</span>
                            <strong>{t.title}</strong>
                            <small>
                              {t.status === "todo"
                                ? "Ready to act"
                                : "In progress"}
                            </small>
                          </div>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <div className="aw-empty">
                  <CheckCircle2 size={30} />
                  <h3>No flagged duties</h3>
                  <p>
                    Open your work to see upcoming assignments and record the
                    next result.
                  </p>
                </div>
              )}
              {counts.unassigned > 0 && (
                <button
                  className="aw-owner-alert"
                  onClick={() => go("followup", "unassigned")}
                >
                  <Users size={17} />
                  {counts.unassigned}{" "}
                  {counts.unassigned === 1 ? "duty needs" : "duties need"} an
                  owner <ArrowRight size={15} />
                </button>
              )}
            </section>
            <section className="aw-panel">
              <div className="aw-section-heading">
                <div>
                  <span className="aw-eyebrow">
                    FIVE DISTRICTS. ONE SHARED PLAN.
                  </span>
                  <h2>The wider picture</h2>
                </div>
              </div>
              <div className="aw-district-list">
                {DISTRICTS.map((d, i) => {
                  const list = projectInstitutions.filter(
                    (x) => x.district === d,
                  );
                  const done = list.filter(
                    (x) =>
                      institutionProgress(x.id, data.stages, data.tasks)
                        .delivered,
                  ).length;
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        p.setDistrict(d);
                        go("institutions");
                      }}
                    >
                      <span className={`aw-district-dot district-${i}`} />
                      <div>
                        <strong>{d}</strong>
                        <small>
                          {list.length} institutions ·{" "}
                          {
                            list.filter(
                              (x) =>
                                x.actionables_reference?.status === "Certified",
                            ).length
                          }{" "}
                          certified · {done} handovers
                        </small>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                  );
                })}
              </div>
              <div className="aw-context-card">
                <Target size={21} />
                <div>
                  <strong>
                    Shortlisted is a decision.
                    <br />
                    Delivered is an outcome.
                  </strong>
                  <p>
                    Keep the seven-centre plan separate from evidence of
                    approval, setup and handover.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
      {(view === "mine" || view === "followup") && (
        <section>
          <div className="aw-section-heading">
            <div>
              <span className="aw-eyebrow">
                {view === "mine"
                  ? "YOUR PART IN THE PLAN"
                  : "SUPPORT, FOLLOW-UP & REPORTING"}
              </span>
              <h2>
                {view === "mine"
                  ? "Your next steps"
                  : "Help the team move forward"}
              </h2>
              <p>
                {view === "mine"
                  ? "See what you own, when it is due and where to record the result."
                  : "Follow the actual result and the next commitment across every institution."}
              </p>
            </div>
            <span className="aw-count-pill">
              {queue.length} {queue.length === 1 ? "duty" : "duties"}
            </span>
          </div>
          {finder}
          <div className="aw-work-controls">
            <label>
              Show
              <select
                aria-label="Filter work"
                value={filter}
                onChange={(e) => p.setFilter(e.target.value as WorkFilter)}
              >
                {Object.entries(FILTER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {view === "followup" && (
              <label>
                Owner
                <select
                  aria-label="Filter owner"
                  value={person}
                  onChange={(e) => p.setPerson(e.target.value)}
                >
                  <option value="all">All colleagues</option>
                  {data.staff.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.full_name}
                      {s.is_active === false ? " (inactive)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span>Results and follow-ups stay with the original duty.</span>
          </div>
          <div className="aw-work-grid">
            {queue.map((t) => (
              <WorkCard
                key={t.id}
                task={t}
                data={data}
                onResult={onResult}
                onOpen={onWork}
              />
            ))}
          </div>
          {!queue.length && (
            <div className="aw-empty">
              <ClipboardList size={32} />
              <h3>No duties in this view</h3>
              <p>
                {view === "mine"
                  ? "You have no matching assignments. Ask the lead to agree your next contribution."
                  : "Try another filter, district or colleague."}
              </p>
              <button
                className="aw-button secondary"
                onClick={() => {
                  p.setFilter("all");
                  p.setSearch("");
                  p.setDistrict(null);
                  p.setPerson("all");
                }}
              >
                Show all {view === "mine" ? "my work" : "work"}
              </button>
            </div>
          )}
        </section>
      )}
      {view === "institutions" && (
        <section>
          <div className="aw-section-heading">
            <div>
              <span className="aw-eyebrow">FROM FIRST CONTACT TO HANDOVER</span>
              <h2>Every institution. A clear next step.</h2>
              <p>
                Use your real contacts and observations to decide where to
                focus.
              </p>
            </div>
            <button className="aw-button" onClick={onAdd}>
              <Plus size={16} /> Add institution
            </button>
          </div>
          {finder}
          <div className="aw-district-chips">
            <button
              aria-pressed={!district}
              onClick={() => p.setDistrict(null)}
            >
              All districts <span>{projectInstitutions.length}</span>
            </button>
            {DISTRICTS.map((d) => (
              <button
                aria-pressed={district === d}
                key={d}
                onClick={() => p.setDistrict(d)}
              >
                {d}{" "}
                <span>
                  {projectInstitutions.filter((i) => i.district === d).length}
                </span>
              </button>
            ))}
          </div>
          <div className="aw-institution-grid">
            {insts.map((i) => (
              <InstitutionCard
                key={i.id}
                institution={i}
                data={data}
                onOpen={onOpen}
              />
            ))}
          </div>
          {legacy.length > 0 && (
            <details className="aw-legacy-records">
              <summary>
                Other saved institutions ({legacy.length}) · existing work
                preserved
              </summary>
              <div className="aw-institution-grid">
                {legacy.map((i) => (
                  <InstitutionCard
                    key={i.id}
                    institution={i}
                    data={data}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </details>
          )}
          {!insts.length && (
            <div className="aw-empty">
              <GraduationCap size={32} />
              <h3>
                {search
                  ? "No matching institutions"
                  : "Start with a real contact"}
              </h3>
              <p>
                {search
                  ? "Try another name, town or district."
                  : "Add an institution and record the office or person you will approach."}
              </p>
              <button className="aw-button" onClick={onAdd}>
                <Plus size={16} /> Add institution
              </button>
            </div>
          )}
        </section>
      )}
      {view === "rollout" && (
        <section>
          <div className="aw-section-heading">
            <div>
              <span className="aw-eyebrow">FOCUS THE SHARED EFFORT</span>
              <h2>Seven places to build something good.</h2>
              <p>
                Management chooses the shortlist. Work, readiness and handover
                remain visible to everyone.
              </p>
            </div>
            <span className="aw-count-pill">{chosen.size} / 7 shortlisted</span>
          </div>
          {!data.extensionsReady ? (
            <div className="aw-empty">
              <Target size={32} />
              <h3>Shared shortlist is being prepared</h3>
              <p>
                You can keep working with existing institutions and duties while
                this feature is activated.
              </p>
            </div>
          ) : (
            <>
              <div className="aw-target-grid">
                {Array.from({ length: 7 }, (_, n) => {
                  const i = targets[n];
                  return (
                    <article
                      className={`aw-target ${i ? "filled" : ""}`}
                      key={n}
                    >
                      <span className="aw-target-number">
                        {String(n + 1).padStart(2, "0")}
                      </span>
                      {i ? (
                        <>
                          <span className="aw-small-label">{i.district}</span>
                          <h3>{i.name}</h3>
                          <p>
                            {institutionProgress(i.id, data.stages, data.tasks)
                              .next?.title || "Review handover evidence"}
                          </p>
                          <div className="aw-target-foot">
                            <button
                              className="aw-text-button"
                              onClick={() => onOpen(i)}
                            >
                              Open work <ArrowRight size={15} />
                            </button>
                            {data.canManage && (
                              <button
                                className="aw-text-button subtle"
                                disabled={p.busy}
                                onClick={() => onSelect(i, false)}
                                aria-label={`Remove ${i.name} from shortlist`}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <h3>Room for the next institution</h3>
                          <p>
                            Review the contact, readiness evidence and
                            commitments before choosing.
                          </p>
                          <button
                            className="aw-text-button"
                            onClick={() => go("institutions")}
                          >
                            Explore institutions <ArrowRight size={15} />
                          </button>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="aw-context-card">
                <ShieldCheck size={21} />
                <div>
                  <strong>Selection does not certify a centre.</strong>
                  <p>
                    Record provider approval and the final handover in the
                    institution’s work stages.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>
      )}
      {view === "resources" && (
        <section>
          <div className="aw-section-heading">
            <div>
              <span className="aw-eyebrow">START A GOOD CONVERSATION</span>
              <h2>Useful words. Clear assumptions.</h2>
              <p>
                Use these working guides, then record what was actually agreed.
              </p>
            </div>
          </div>
          <div className="aw-portfolio-groups">
            {ACTIONABLES_REFERENCE.programmeGroups.map((group) => (
              <article key={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.programmes.map((programme) => (
                    <li key={programme}>{programme}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="aw-two-col">
            <section className="aw-panel aw-resource">
              <span className="aw-resource-icon lavender">
                <Copy size={24} />
              </span>
              <h3>A first-contact script</h3>
              <p className="aw-script-copy">{CONTACT_SCRIPT}</p>
              <button
                className="aw-button secondary"
                onClick={() => void copy(CONTACT_SCRIPT)}
              >
                Copy script <Copy size={15} />
              </button>
              <small>
                Adapt the name, district and proposed meeting. Agree costs,
                scope and responsibilities through the project owner.
              </small>
            </section>
            <section className="aw-panel aw-resource">
              <span className="aw-resource-icon mint">
                <ShieldCheck size={24} />
              </span>
              <h3>Current provider requirements</h3>
              <p>
                Review the official facility, equipment, application and
                programme guidance before making technical decisions.
              </p>
              <a
                className="aw-button secondary"
                href={PEARSON_REQUIREMENTS_URL}
                target="_blank"
                rel="noreferrer"
              >
                Open Pearson VUE guidance <ArrowUpRight size={15} />
              </a>
              <div className="aw-context-card">
                <Flag size={20} />
                <div>
                  <strong>Confirm exam scope during approval.</strong>
                  <p>
                    Record the authorised programmes and evidence in the
                    approval stage. Keep commitments tied to those records.
                  </p>
                </div>
              </div>
            </section>
          </div>
          <section className="aw-panel aw-calculator">
            <div>
              <span className="aw-eyebrow">PLANNING ESTIMATE</span>
              <h3>What might the recorded capacity support?</h3>
              <p>
                An adjustable scenario using shortlisted institutions’ recorded
                seats. It is not certified capacity or a booking forecast.
              </p>
            </div>
            <div className="aw-scenario-fields">
              <label>
                Testing days / year
                <input
                  type="number"
                  min="0"
                  max="366"
                  value={days}
                  onChange={(e) =>
                    setDays(Math.max(0, Math.min(366, Number(e.target.value))))
                  }
                />
              </label>
              <label>
                Utilisation (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={use}
                  onChange={(e) =>
                    setUse(Math.max(0, Math.min(100, Number(e.target.value))))
                  }
                />
              </label>
              <label>
                Sessions / seat / day
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={sessions}
                  onChange={(e) =>
                    setSessions(
                      Math.max(0, Math.min(12, Number(e.target.value))),
                    )
                  }
                />
              </label>
            </div>
            <div className="aw-estimate">
              <div>
                <span>SEATS RECORDED</span>
                <strong>{estimate.seats}</strong>
                <small>
                  {estimate.known} of {estimate.targets} shortlisted
                  institutions have a capacity
                </small>
              </div>
              <div>
                <span>POTENTIAL SESSIONS / YEAR</span>
                <strong>
                  {estimate.estimate == null
                    ? "—"
                    : estimate.estimate.toLocaleString("en-IN")}
                </strong>
                <small>
                  {estimate.complete
                    ? "Seats × days × utilisation × sessions"
                    : "Add missing seat capacities to calculate a complete scenario."}
                </small>
              </div>
            </div>
          </section>
        </section>
      )}
    </>
  );
}
