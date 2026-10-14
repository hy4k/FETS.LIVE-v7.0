import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  Clock3,
  Copy,
  Flag,
  GraduationCap,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { toast } from "react-hot-toast";
import ActionablesReadiness from "./ActionablesReadiness";
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
  type Criterion,
  type Observation,
} from "./actionables-model";
export type PortfolioView =
  | "institutions"
  | "rollout"
  | "programmes"
  | "audit"
  | "followup"
  | "resources";
export const PORTFOLIO_TABS = [
  { id: "institutions", label: "Institutions", icon: GraduationCap },
  { id: "rollout", label: "Selected centres", icon: Target },
  { id: "programmes", label: "Exam programmes", icon: ClipboardList },
  { id: "audit", label: "Audit", icon: ShieldCheck },
  { id: "followup", label: "Tasks", icon: Users },
  { id: "resources", label: "Resources", icon: Copy },
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
  onAudit,
  onSelect,
  busy,
}: {
  institution: Institution;
  data: ActionablesData;
  onOpen: (i: Institution) => void;
  onAudit: (i: Institution) => void;
  onSelect: (i: Institution, value: boolean) => void;
  busy: boolean;
}) {
  const source = i.actionables_reference,
    chosen = selectedIds(data.selections).has(i.id);
  return (
    <article className={`aw-institution ${chosen ? "is-selected" : ""}`}>
      <div className="aw-institution-top">
        <span className="aw-district">
          {source?.districtName || i.district}
        </span>
        <span
          className={`aw-source-status status-${(source?.status || "Saved").toLowerCase().replace(/ /g, "-")}`}
        >
          {source?.status || "Saved"}
        </span>
      </div>
      <button className="aw-institution-title" onClick={() => onOpen(i)}>
        <h3>{i.name}</h3>
      </button>
      {source && <p className="aw-institution-type">{source.type}</p>}
      <dl className="aw-contact-details">
        <div>
          <dt>Address</dt>
          <dd>{i.address || source?.address || "Not recorded"}</dd>
        </div>
        {source && (
          <div>
            <dt>PIN</dt>
            <dd>{source.pincode}</dd>
          </div>
        )}
        <div>
          <dt>Phone</dt>
          <dd>
            {i.primary_contact_phone ? (
              <a href={`tel:${i.primary_contact_phone.replace(/[^+\d]/g, "")}`}>
                {i.primary_contact_phone}
              </a>
            ) : (
              "Not recorded"
            )}
          </dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>{i.primary_contact_name || source?.nodal || "Not recorded"}</dd>
        </div>
      </dl>
      <div className="aw-card-facts">
        <span>
          <strong>{i.lab_seat_capacity ?? "—"}</strong> seats
        </span>
        {source && (
          <span>
            Recorded readiness <strong>{source.score}%</strong>
          </span>
        )}
      </div>
      <footer className="aw-card-actions">
        <button className="aw-button small secondary" onClick={() => onOpen(i)}>
          Details
        </button>
        <button
          className="aw-button small secondary"
          onClick={() => onAudit(i)}
        >
          Audit
        </button>
        <button
          className={`aw-button small ${chosen ? "secondary" : ""}`}
          disabled={
            busy ||
            !data.extensionsReady ||
            !data.canManage ||
            (!chosen && selectedIds(data.selections).size >= 7)
          }
          onClick={() => onSelect(i, !chosen)}
        >
          {chosen ? "Selected · remove" : "Select centre"}
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
  onAudit: (i: Institution) => void;
  onObservation: (
    i: Institution,
    criterion: Criterion,
    latest?: Observation,
  ) => void;
  onGap: (i: Institution, observation: Observation, title: string) => void;
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
    onAudit,
  } = p;
  const [auditId, setAuditId] = useState("");
  const [days, setDays] = useState(200),
    [use, setUse] = useState(35),
    [sessions, setSessions] = useState(1);
  const chosen = selectedIds(data.selections);
  const targets = data.institutions.filter((i) => chosen.has(i.id));
  const catalogue = data.institutions.filter((i) => i.actionables_reference);
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
              ? "Search college, town or PIN"
              : "Search tasks"
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
      {view === "institutions" && (
        <section>
          {finder}
          <div className="aw-district-chips">
            <button
              aria-pressed={!district}
              onClick={() => p.setDistrict(null)}
            >
              All <span>{projectInstitutions.length}</span>
            </button>
            {DISTRICTS.map((d) => (
              <button
                aria-pressed={district === d}
                key={d}
                onClick={() => p.setDistrict(d)}
              >
                {d === "Ernakulam" ? "Cochin" : d}{" "}
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
                onAudit={onAudit}
                onSelect={onSelect}
                busy={p.busy}
              />
            ))}
          </div>
          {legacy.length > 0 && (
            <details className="aw-legacy-records">
              <summary>Other saved institutions ({legacy.length})</summary>
              <div className="aw-institution-grid">
                {legacy.map((i) => (
                  <InstitutionCard
                    key={i.id}
                    institution={i}
                    data={data}
                    onOpen={onOpen}
                    onAudit={onAudit}
                    onSelect={onSelect}
                    busy={p.busy}
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
                  : "No institutions recorded"}
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
              <h2>Selected centres</h2>
              <p>
                Choose up to seven institutions. Selection is separate from
                provider approval.
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
                          <h3>Not selected</h3>
                          <p>Select an institution from the directory.</p>
                          <button
                            className="aw-text-button"
                            onClick={() => go("institutions")}
                          >
                            Choose institution <ArrowRight size={15} />
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
          <section className="aw-panel aw-calculator">
            <div>
              <h3>Capacity estimate</h3>
              <p>
                Based on recorded seats and the assumptions below. This is a
                planning estimate.
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
      {view === "programmes" && (
        <section>
          <div className="aw-section-heading">
            <h2>Exam programmes</h2>
          </div>{" "}
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
        </section>
      )}
      {view === "audit" && (
        <section>
          <div className="aw-audit-picker">
            <label>
              Institution
              <select
                aria-label="Audit institution"
                value={auditId || projectInstitutions[0]?.id || ""}
                onChange={(e) => setAuditId(e.target.value)}
              >
                {projectInstitutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(() => {
            const i =
              projectInstitutions.find((i) => i.id === auditId) ||
              projectInstitutions[0];
            return i ? (
              <ActionablesReadiness
                institution={i}
                data={data}
                onRecord={(c, o) => p.onObservation(i, c, o)}
                onFollowup={(o, t) => p.onGap(i, o, t)}
              />
            ) : (
              <p>No institutions recorded.</p>
            );
          })()}
        </section>
      )}
      {view === "resources" && (
        <section>
          <div className="aw-section-heading">
            <h2>Contact resources</h2>
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
        </section>
      )}
    </>
  );
}
