import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Phone,
  Plus,
  Search,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useOutreachContext, useOutreachDetail } from "./hooks";
import {
  CONCERNS,
  FOLLOWUP_KINDS,
  INTERESTS,
  OUTCOMES,
  STAGES,
  followupBucket,
  matchingInstitutes,
  summarise,
} from "./model";
import { CALL_BRANCHES, CALL_GUIDE, GUIDE_NOTE } from "./call-guide";
import { dueLabel } from "../redesign/institution-workflow";
import {
  BatchEditor,
  CallEditor,
  CENTRES,
  FollowupEditor,
  InstituteEditor,
  OutreachDialog,
} from "./PrometricForms";
import type {
  MockBatch,
  OutreachCall,
  OutreachContext,
  OutreachDetail,
  OutreachInstitute,
} from "./types";
import "./prometric-outreach.css";

const QUEUES = {
  all: "All institutes",
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  needs_next_step: "Needs next step",
};
const TABS = {
  next: "Next step",
  call: "Log conversation",
  batches: "Mock batches",
  history: "History",
  profile: "Profile",
};
type Tab = keyof typeof TABS;
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Workspace could not be loaded. Refresh and try again.";
// PostgreSQL versions can differ within one millisecond; retain all six fractional digits.
function versionTime(value: string) {
  const fraction = value.match(/\.(\d+)/)?.[1] ?? "";
  return Date.parse(value) * 1000 + Number(fraction.padEnd(6, "0").slice(3, 6));
}
function Stage({ institute }: { institute: OutreachInstitute }) {
  return (
    <span className={`po-stage po-stage-${institute.stage}`}>
      {STAGES[institute.stage]}
    </span>
  );
}
function Guide() {
  const groups = [
    {
      title: "Opening",
      items: CALL_GUIDE.filter((item) => item.id === "opening"),
    },
    {
      title: "Core conversation · 3–4 minutes",
      items: CALL_GUIDE.filter(
        (item) => !["opening", "recap", "advisory"].includes(item.id)
      ),
    },
    {
      title: "Recap and follow-up",
      items: CALL_GUIDE.filter((item) =>
        ["recap", "advisory"].includes(item.id)
      ),
    },
  ];
  return (
    <div className="po-guide">
      <p className="po-guide-note">{GUIDE_NOTE}</p>
      {groups.map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          {group.items.map((item) => (
            <details key={item.id} open={item.id === "opening"}>
              <summary>{item.title}</summary>
              <blockquote>{item.say}</blockquote>
              {item.prompt && <p className="po-help">{item.prompt}</p>}
            </details>
          ))}
        </section>
      ))}
      <section>
        <h3>When the conversation changes</h3>
        {CALL_BRANCHES.map((item) => (
          <details key={item.id}>
            <summary>{item.title}</summary>
            <blockquote>{item.say}</blockquote>
          </details>
        ))}
      </section>
    </div>
  );
}
function Pipeline({ context }: { context: OutreachContext }) {
  const totals = summarise(context);
  return (
    <section className="po-pipeline" aria-label="Candidate pipeline">
      <div className="po-incoming">
        <div className="po-ledger-heading">
          <div>
            <h2>Incoming to FETS</h2>
            <p>Institute batches at our centres</p>
          </div>
          <Building2 size={23} aria-hidden="true" />
        </div>
        <dl className="po-counts">
          {(["estimated", "confirmed", "attended"] as const).map((key) => (
            <div key={key}>
              <dt>
                {key === "estimated"
                  ? "Potential estimate"
                  : key === "confirmed"
                  ? "Confirmed ahead"
                  : "Attended"}
              </dt>
              <dd aria-label={`Incoming ${key} candidates`}>
                {totals.incoming[key]}
              </dd>
            </div>
          ))}
        </dl>
        <div className="po-ledger-foot">
          <span>{totals.incoming.batches} recorded cohorts</span>
          <a href="/calendar">
            Review Calendar capacity <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
      <div className="po-platform">
        <h2>Institute platform</h2>
        <p>Alternative support at their premises</p>
        <dl className="po-counts">
          {(["estimated", "confirmed", "attended"] as const).map((key) => (
            <div key={key}>
              <dt>
                {key === "estimated"
                  ? "Potential estimate"
                  : key === "confirmed"
                  ? "Confirmed ahead"
                  : "Attended"}
              </dt>
              <dd aria-label={`Platform ${key} candidates`}>
                {totals.platform[key]}
              </dd>
            </div>
          ))}
        </dl>
        <p className="po-help">
          Planning counts from distinct cohorts. These are not candidate
          registrations.
        </p>
      </div>
    </section>
  );
}
function HistoryCall({ call }: { call: OutreachCall }) {
  const answers = Object.entries(call.answers).filter(
    ([, value]) => value !== null && value !== ""
  );
  return (
    <article className="po-history-call">
      <div className="po-history-meta">
        <strong>{OUTCOMES[call.outcome]}</strong>
        <span>{dueLabel(null, call.occurred_at)}</span>
      </div>
      <p className="po-help">
        {call.actor_name} · {call.channel}
        {call.contact_name ? ` · ${call.contact_name}` : ""}
      </p>
      <p className="po-history-summary">{call.summary}</p>
      {call.close_reason && (
        <p className="po-notice">Closed next step: {call.close_reason}</p>
      )}
      <div className="po-history-tags">
        <span>{INTERESTS[call.interest]}</span>
        <span>
          {call.follow_up_permission === "do_not_contact"
            ? "Do not contact"
            : call.follow_up_permission === "allowed"
            ? "Follow-up allowed"
            : "Permission not yet asked"}
        </span>
        {call.concerns.map((concern) => (
          <span key={concern}>{CONCERNS[concern] ?? concern}</span>
        ))}
      </div>
      {(answers.length > 0 || call.advisory_interest !== "not_asked") && (
        <details>
          <summary>Recorded research answers</summary>
          <dl className="po-answer-list">
            {answers.map(([key, value]) => (
              <div key={key}>
                <dt>{key.replace(/_/g, " ")}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
            <div>
              <dt>Advisory group</dt>
              <dd>
                {call.advisory_interest === "yes"
                  ? "Interested"
                  : call.advisory_interest === "no"
                  ? "Not interested"
                  : "Not asked"}
              </dd>
            </div>
          </dl>
        </details>
      )}
    </article>
  );
}
function InstituteDetail({
  institute,
  context,
  detail,
  onBack,
  onRefresh,
  loadMore,
  hasMore,
  loadingMore,
  historyError,
}: {
  institute: OutreachInstitute;
  context: OutreachContext;
  detail: OutreachDetail[];
  onBack: () => void;
  onRefresh: () => void;
  loadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  historyError?: unknown;
}) {
  const [tab, setTab] = useState<Tab>("next"),
    [notice, setNotice] = useState(""),
    [script, setScript] = useState(true),
    [editingBatch, setEditingBatch] = useState<MockBatch | "new" | null>(null),
    [editorEpoch, setEditorEpoch] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [institute.id]);
  const latest = detail[0],
    openStep = latest.followups.find((item) => item.status === "open");
  const canEdit =
    context.viewer.can_manage ||
    context.viewer.user_id === institute.owner_user_id;
  const stopped = institute.contact_permission === "do_not_contact";
  const calls = detail
    .flatMap((page) => page.calls)
    .filter(
      (call, index, all) =>
        all.findIndex((item) => item.id === call.id) === index
    );
  const reloadDraft = () => {
    setEditorEpoch((value) => value + 1);
    onRefresh();
  };
  const saved = (label: string, next: Tab = "next") => {
    setNotice(label);
    setTab(next);
    setEditingBatch(null);
  };
  function changeTab(next: Tab) {
    setTab(next);
    setNotice("");
  }
  return (
    <section className="po-detail" aria-label="Institute workspace">
      <button className="po-link po-mobile-back" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to institutes
      </button>
      <div className="po-profile-heading">
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {institute.name}
          </h2>
          <p>
            {institute.city}
            {institute.state ? `, ${institute.state}` : ""} ·{" "}
            {CENTRES[institute.preferred_centre]}
          </p>
        </div>
        <Stage institute={institute} />
      </div>
      <div className="po-contact-strip">
        <span>
          {institute.contact_name || "Business contact to confirm"}
          {institute.contact_role ? ` · ${institute.contact_role}` : ""}
        </span>
        {institute.phone && (
          <span>
            <Phone size={13} />
            {institute.phone}
          </span>
        )}
        {institute.email && <span>{institute.email}</span>}
        <span>
          Owner:{" "}
          {context.staff.find(
            (person) => person.user_id === institute.owner_user_id
          )?.full_name ?? "Assigned staff"}
        </span>
      </div>
      {stopped && (
        <div className="po-stop">
          <strong>Do not contact</strong>
          <span>
            Outbound work is closed. History remains available. Record any new
            permission through an inbound conversation.
          </span>
        </div>
      )}
      {!canEdit && (
        <p className="po-notice">
          This institute is assigned to another staff member. Refresh to check
          your current access.
        </p>
      )}
      <div className="po-tabs" role="tablist" aria-label="Institute actions">
        {Object.entries(TABS).map(([key, label], index, all) => (
          <button
            type="button"
            key={key}
            role="tab"
            id={`outreach-tab-${key}`}
            aria-controls={`outreach-panel-${key}`}
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => changeTab(key as Tab)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                    ? all.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        all.length) %
                      all.length;
                changeTab(all[next][0] as Tab);
                document
                  .getElementById(`outreach-tab-${all[next][0]}`)
                  ?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p className="po-success" role="status">
          {notice}
        </p>
      )}
      <div
        className="po-tab-panel"
        role="tabpanel"
        id={`outreach-panel-${tab}`}
        aria-labelledby={`outreach-tab-${tab}`}
      >
        {tab === "next" && (
          <>
            <div className="po-section-heading">
              <h3>The next agreed action</h3>
              <p>One open next step per institute. Times are shown in IST.</p>
            </div>
            {openStep ? (
              <div className="po-next-step">
                <span className={`po-due po-due-${followupBucket(openStep)}`}>
                  <Clock3 size={14} />
                  {dueLabel(null, openStep.due_at)}
                </span>
                <h4>{openStep.title}</h4>
                <p className="po-help">{FOLLOWUP_KINDS[openStep.kind]}</p>
                {canEdit && (
                  <FollowupEditor
                    key={`${openStep.id}-${editorEpoch}`}
                    followup={openStep}
                    onReload={reloadDraft}
                    stopped={stopped}
                    onSaved={() => saved("Follow-up updated.")}
                  />
                )}
              </div>
            ) : (
              <div className="po-empty-step">
                <CalendarDays size={26} />
                <h4>
                  {stopped || ["paused", "closed"].includes(institute.stage)
                    ? "Outbound work is closed"
                    : "Needs a next step"}
                </h4>
                <p>
                  {stopped || ["paused", "closed"].includes(institute.stage)
                    ? "Review previous conversations for the closure context."
                    : "Log the conversation and agree a dated action, or record why the relationship is closing."}
                </p>
                {canEdit && !stopped && (
                  <button
                    className="po-primary"
                    onClick={() => changeTab("call")}
                  >
                    Log conversation
                  </button>
                )}
              </div>
            )}
            <div className="po-section-heading po-followup-history">
              <h3>Previous next steps</h3>
            </div>
            {latest.followups.filter((item) => item.status !== "open")
              .length === 0 ? (
              <p className="po-help">No previous next steps yet.</p>
            ) : (
              <ul className="po-steps-list">
                {latest.followups
                  .filter((item) => item.status !== "open")
                  .map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{dueLabel(null, item.due_at)}</span>
                        {item.completion_note && <p>{item.completion_note}</p>}
                      </div>
                      <span className="po-stage">
                        {item.status === "done"
                          ? "Completed"
                          : "Cancelled / superseded"}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
        {tab === "call" && canEdit && (
          <>
            <div className="po-section-heading po-inline-heading">
              <div>
                <h3>Listen, record, agree</h3>
                <p>
                  Start with a short conversation. Expand only when invited.
                </p>
              </div>
              <button
                className="po-secondary"
                aria-expanded={script}
                onClick={() => setScript(!script)}
              >
                {script ? "Hide script" : "Show script"}
              </button>
            </div>
            <div className={script ? "po-call-layout" : ""}>
              <CallEditor
                key={`call-${editorEpoch}`}
                institute={institute}
                onReload={reloadDraft}
                onSaved={() =>
                  saved("Conversation saved to history.", "history")
                }
              />
              {script && (
                <aside
                  className="po-inline-guide"
                  aria-label="Conversation script"
                >
                  <Guide />
                </aside>
              )}
            </div>
          </>
        )}
        {tab === "batches" && (
          <>
            <div className="po-section-heading po-inline-heading">
              <div>
                <h3>Distinct mock batches</h3>
                <p>
                  Track estimates, commitments and attendance for each cohort.
                </p>
              </div>
              {canEdit && (
                <button
                  className="po-secondary"
                  onClick={() => setEditingBatch("new")}
                >
                  <Plus size={15} />
                  Add batch
                </button>
              )}
            </div>
            {editingBatch && canEdit && (
              <div className="po-batch-editor">
                <div className="po-inline-heading">
                  <h4>
                    {editingBatch === "new"
                      ? "New mock batch"
                      : `Update ${editingBatch.name}`}
                  </h4>
                  <button
                    className="po-link"
                    onClick={() => setEditingBatch(null)}
                  >
                    Cancel
                  </button>
                </div>
                <BatchEditor
                  key={`${
                    editingBatch === "new" ? "new" : editingBatch.id
                  }-${editorEpoch}`}
                  institute={institute}
                  batch={
                    editingBatch === "new"
                      ? undefined
                      : latest.batches.find(
                          (item) => item.id === editingBatch.id
                        ) ?? editingBatch
                  }
                  onReload={reloadDraft}
                  onSaved={() => saved("Mock batch saved.", "batches")}
                />
              </div>
            )}
            {latest.batches.length === 0 && !editingBatch && (
              <p className="po-empty-inline">
                No mock batches recorded. Start with a potential cohort when
                there is a real discussion.
              </p>
            )}
            {(["fets_centre", "institute_platform"] as const).map(
              (delivery) => (
                <section
                  className={`po-batch-group po-batch-${delivery}`}
                  key={delivery}
                >
                  <h4>
                    {delivery === "fets_centre"
                      ? "Incoming to FETS centres"
                      : "Institute-hosted platform"}
                  </h4>
                  {latest.batches
                    .filter((batch) => batch.delivery === delivery)
                    .map((batch) => (
                      <article className="po-batch-row" key={batch.id}>
                        <div className="po-inline-heading">
                          <strong>{batch.name}</strong>
                          <span className="po-stage">{batch.status}</span>
                        </div>
                        <p className="po-help">
                          {batch.centre ? `${CENTRES[batch.centre]} · ` : ""}
                          {batch.planned_date
                            ? dueLabel(batch.planned_date)
                            : "Date to be agreed"}
                        </p>
                        <dl className="po-batch-counts">
                          <div>
                            <dt>Estimated</dt>
                            <dd>{batch.estimated}</dd>
                          </div>
                          <div>
                            <dt>Confirmed</dt>
                            <dd>{batch.confirmed}</dd>
                          </div>
                          <div>
                            <dt>Attended</dt>
                            <dd>{batch.attended}</dd>
                          </div>
                        </dl>
                        {batch.notes && (
                          <p className="po-help">{batch.notes}</p>
                        )}
                        {canEdit && (
                          <button
                            className="po-link"
                            onClick={() => setEditingBatch(batch)}
                          >
                            Update batch <ChevronRight size={13} />
                          </button>
                        )}
                      </article>
                    ))}
                </section>
              )
            )}
            <a className="po-link" href="/calendar">
              Review Calendar capacity <ArrowUpRight size={14} />
            </a>
          </>
        )}
        {tab === "history" && (
          <>
            <div className="po-section-heading">
              <h3>Conversation history</h3>
              <p>
                Read-only records. Log a new note to add a correction or update.
              </p>
            </div>
            {calls.length === 0 ? (
              <p className="po-empty-inline">No conversations logged yet.</p>
            ) : (
              calls.map((call) => <HistoryCall key={call.id} call={call} />)
            )}
            {historyError && (
              <p className="po-error" role="alert">
                {message(historyError)}
              </p>
            )}
            {hasMore && (
              <button
                className="po-secondary"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? "Loading older conversations…"
                  : "Load older conversations"}
              </button>
            )}
          </>
        )}
        {tab === "profile" && (
          <>
            <div className="po-section-heading po-inline-heading">
              <div>
                <h3>Institute profile</h3>
                <p>Keep ownership and business contact details current.</p>
              </div>
              <button className="po-link" onClick={onRefresh}>
                Refresh institute
              </button>
            </div>
            {canEdit ? (
              <InstituteEditor
                key={`profile-${editorEpoch}`}
                context={context}
                institute={institute}
                onReload={reloadDraft}
                onSaved={() => saved("Institute saved.")}
              />
            ) : (
              <p>{institute.notes || "No relationship notes recorded."}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default function PrometricWorkspace({ onBack }: { onBack: () => void }) {
  const { user } = useAuth(),
    query = useOutreachContext();
  const [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState<"guide" | "institute" | null>(null);
  const [search, setSearch] = useState(""),
    [owner, setOwner] = useState("all"),
    [centre, setCentre] = useState("all"),
    [stage, setStage] = useState("all"),
    [queue, setQueue] = useState("all");
  const context =
    query.data?.viewer.user_id === user?.id ? query.data : undefined;
  const scopedInstitute = context?.institutes.find(
    (item) => item.id === selected
  );
  const detail = useOutreachDetail(scopedInstitute?.id ?? null);
  useEffect(() => {
    setSelected(null);
    setModal(null);
    setSearch("");
    setOwner("all");
    setCentre("all");
    setStage("all");
    setQueue("all");
  }, [user?.id]);
  useEffect(() => {
    if (context && selected && !scopedInstitute) setSelected(null);
  }, [context, selected, scopedInstitute]);
  const filters = {
    search,
    owner: context?.viewer.can_manage ? owner : context?.viewer.user_id,
    centre,
    stage,
    queue,
  };
  const institutes = context ? matchingInstitutes(context, filters) : [];
  const totals = context ? summarise(context) : null;
  const detailInstitute = detail.data?.pages[0]?.institute;
  const currentInstitute =
    scopedInstitute && detailInstitute?.id === scopedInstitute.id
      ? versionTime(scopedInstitute.updated_at) >
        versionTime(detailInstitute.updated_at)
        ? scopedInstitute
        : detailInstitute
      : undefined;
  const clear = () => {
    setSearch("");
    setOwner("all");
    setCentre("all");
    setStage("all");
    setQueue("all");
  };
  return (
    <div
      className={`po-workspace${scopedInstitute ? " po-detail-active" : ""}`}
    >
      <header className="po-header">
        <div>
          <button
            className="po-link"
            onClick={onBack}
            aria-label="Back to Actionables"
          >
            <ArrowLeft size={15} />
            Actionables
          </button>
          <h1>Prometric</h1>
          <p>CMA institute relationships & mock readiness</p>
        </div>
        <div className="po-header-actions">
          <button className="po-secondary" onClick={() => setModal("guide")}>
            <BookOpen size={16} />
            Call guide
          </button>
          {context && !query.isError && (
            <button
              className="po-primary"
              onClick={() => setModal("institute")}
            >
              <Plus size={16} />
              Add institute
            </button>
          )}
        </div>
      </header>
      {query.isError ? (
        <div className="po-load-state">
          <h2>Workspace unavailable</h2>
          <p className="po-error" role="alert">
            {message(query.error)}
          </p>
          <button className="po-secondary" onClick={() => query.refetch()}>
            Retry workspace
          </button>
        </div>
      ) : !context ? (
        <div className="po-load-state" role="status">
          Loading your institute workspace…
        </div>
      ) : (
        <>
          <Pipeline context={context} />
          <nav className="po-queues" aria-label="Follow-up queues">
            {Object.entries(QUEUES).map(([key, label]) => (
              <button
                key={key}
                className={`${queue === key ? "po-queue-active " : ""}${
                  key === "overdue" ? "po-overdue-queue" : ""
                }`}
                aria-pressed={queue === key}
                onClick={() => setQueue(key)}
              >
                {label}
                <span>{key === "all" ? totals!.institutes : totals![key]}</span>
              </button>
            ))}
          </nav>
          <div className="po-workbench">
            <section className="po-directory" aria-label="Institute directory">
              <div className="po-directory-heading">
                <h2>
                  Institutes <span>{institutes.length}</span>
                </h2>
                <span>
                  {context.viewer.can_manage
                    ? "Across both centres"
                    : "Your relationships"}
                </span>
              </div>
              <div className="po-filters">
                <label className="po-search">
                  <Search size={16} />
                  <input
                    type="search"
                    aria-label="Search institutes"
                    placeholder="Search institute, city or contact"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <div className="po-filter-grid">
                  {context.viewer.can_manage && (
                    <label>
                      <span>Owner</span>
                      <select
                        aria-label="Filter by owner"
                        value={owner}
                        onChange={(event) => setOwner(event.target.value)}
                      >
                        <option value="all">All owners</option>
                        {context.staff.map((person) => (
                          <option key={person.user_id} value={person.user_id}>
                            {person.full_name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    <span>Centre</span>
                    <select
                      aria-label="Filter by centre"
                      value={centre}
                      onChange={(event) => setCentre(event.target.value)}
                    >
                      <option value="all">Both centres</option>
                      {Object.entries(CENTRES).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Stage</span>
                    <select
                      aria-label="Filter by stage"
                      value={stage}
                      onChange={(event) => setStage(event.target.value)}
                    >
                      <option value="all">All stages</option>
                      {Object.entries(STAGES).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {(search ||
                  owner !== "all" ||
                  centre !== "all" ||
                  stage !== "all" ||
                  queue !== "all") && (
                  <button className="po-link po-clear" onClick={clear}>
                    Clear filters
                  </button>
                )}
              </div>
              {context.institutes.length === 0 ? (
                <div className="po-empty-directory">
                  <Building2 size={34} />
                  <h3>Add your first institute</h3>
                  <p>
                    Build a business contact profile, listen to their needs, and
                    agree the next step.
                  </p>
                  <button
                    className="po-link"
                    onClick={() => setModal("institute")}
                  >
                    Create an institute profile <ChevronRight size={14} />
                  </button>
                </div>
              ) : institutes.length === 0 ? (
                <p className="po-empty-inline">
                  No institutes match these filters.
                </p>
              ) : (
                <ul className="po-institute-list">
                  {institutes.map((institute) => {
                    const next = context.followups.find(
                      (item) =>
                        item.institute_id === institute.id &&
                        item.status === "open"
                    );
                    const needsNext =
                      !next &&
                      !["closed", "paused"].includes(institute.stage) &&
                      institute.contact_permission !== "do_not_contact";
                    return (
                      <li key={institute.id}>
                        <button
                          className={`po-institute${
                            selected === institute.id
                              ? " po-institute-selected"
                              : ""
                          }`}
                          aria-label={`Open ${institute.name}`}
                          aria-pressed={selected === institute.id}
                          onClick={() => setSelected(institute.id)}
                        >
                          <div className="po-institute-heading">
                            <strong>{institute.name}</strong>
                            <ChevronRight size={16} />
                          </div>
                          <p>
                            {institute.city} ·{" "}
                            {CENTRES[institute.preferred_centre]}
                          </p>
                          <Stage institute={institute} />
                          {institute.contact_permission === "do_not_contact" ? (
                            <span className="po-institute-next po-due-overdue">
                              Do not contact
                            </span>
                          ) : next ? (
                            <span
                              className={`po-institute-next po-due-${followupBucket(
                                next
                              )}`}
                            >
                              <Clock3 size={12} />
                              {next.title}
                              <small>{dueLabel(null, next.due_at)}</small>
                            </span>
                          ) : needsNext ? (
                            <span className="po-institute-next po-needs-next">
                              Needs next step
                            </span>
                          ) : (
                            <span className="po-institute-next">
                              Outbound work closed
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <div className="po-detail-container">
              {!scopedInstitute ? (
                <div className="po-pick-institute">
                  <div className="po-pick-mark">
                    <Building2 size={34} />
                  </div>
                  <h2>Every relationship has a next step.</h2>
                  <p>
                    Choose an institute to review its business contact, prepare
                    a conversation or plan a mock batch.
                  </p>
                  <button
                    className="po-secondary"
                    onClick={() => setModal("guide")}
                  >
                    <BookOpen size={15} />
                    Read the call guide
                  </button>
                </div>
              ) : detail.isError && !detail.data ? (
                <div className="po-load-state">
                  <p className="po-error" role="alert">
                    {message(detail.error)}
                  </p>
                  <button
                    className="po-secondary"
                    onClick={() => detail.refetch()}
                  >
                    Retry institute
                  </button>
                  <button className="po-link" onClick={() => setSelected(null)}>
                    Back to institutes
                  </button>
                </div>
              ) : !currentInstitute || !detail.data ? (
                <div className="po-load-state" role="status">
                  Loading institute history…
                </div>
              ) : detail.isError && !detail.isFetchNextPageError ? (
                <div className="po-load-state">
                  <p className="po-error" role="alert">
                    {message(detail.error)}
                  </p>
                  <button
                    className="po-secondary"
                    onClick={() => detail.refetch()}
                  >
                    Retry institute
                  </button>
                </div>
              ) : (
                <InstituteDetail
                  key={`${user?.id}-${currentInstitute.id}`}
                  institute={currentInstitute}
                  context={context}
                  detail={detail.data.pages}
                  onBack={() => setSelected(null)}
                  onRefresh={() => {
                    void query.refetch();
                    void detail.refetch();
                  }}
                  loadMore={() => {
                    void detail.fetchNextPage();
                  }}
                  hasMore={Boolean(detail.hasNextPage)}
                  loadingMore={detail.isFetchingNextPage}
                  historyError={
                    detail.isFetchNextPageError ? detail.error : undefined
                  }
                />
              )}
            </div>
          </div>
        </>
      )}
      {modal === "guide" && (
        <OutreachDialog title="Call guide" onClose={() => setModal(null)}>
          <Guide />
        </OutreachDialog>
      )}
      {modal === "institute" && context && !query.isError && (
        <OutreachDialog
          key={user?.id}
          title="Add institute"
          onClose={() => setModal(null)}
        >
          <InstituteEditor context={context} onSaved={() => setModal(null)} />
        </OutreachDialog>
      )}
    </div>
  );
}
