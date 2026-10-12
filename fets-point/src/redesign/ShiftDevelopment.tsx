import React, { useEffect, useState } from "react";
import { centreDate } from "./operations-data";
import type { Person } from "./shift-blueprint-repository";
import type { DayTask } from "./shift-blueprint";
import type { WorkRepository } from "./shift-work-repository";
import { clock } from "./shift-plan";
import {
  workEvidence,
  DEVELOPMENT_LABELS,
  type DevelopmentNote,
} from "./shift-work";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Could not save. Please try again.";
export default function DevelopmentReview({
  branch,
  me,
  people,
  manager,
  ready,
  work,
}: {
  branch: string;
  me: string;
  people: Person[];
  manager: boolean;
  ready: boolean;
  work: WorkRepository;
}) {
  const [from, setFrom] = useState(() =>
    centreDate(new Date(Date.now() - 27 * 86400000)),
  );
  const [to, setTo] = useState(centreDate());
  const [person, setPerson] = useState(manager ? people[0]?.id || me : me);
  const [tasks, setTasks] = useState<DayTask[]>([]);
  const [notes, setNotes] = useState<DevelopmentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [kind, setKind] = useState<DevelopmentNote["kind"]>("recognition");
  const [evidence, setEvidence] = useState("");
  const [context, setContext] = useState("");
  const [action, setAction] = useState("");
  const [review, setReview] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [writing, setWriting] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    setLoading(true);
    setError("");
    Promise.all([
      manager ? work.history(branch, from, to) : Promise.resolve([]),
      work.notes(branch),
    ])
      .then(([t, n]) => {
        if (live) {
          setTasks(t);
          setNotes(n);
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
  }, [branch, from, to, manager, ready, work, reload]);
  useEffect(() => {
    setLinks([]);
    setWriting(false);
    setEvidence("");
    setContext("");
    setAction("");
    setReviewed(false);
  }, [person]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (!ready)
    return (
      <div className="sw-empty">
        Work reviews will be available when the new workflow is activated.
      </div>
    );
  const facts = workEvidence(tasks, person);
  const recorded = tasks.filter((t) => t.assigned_to === person);
  const name = people.find((p) => p.id === person)?.name || "Colleague";
  return (
    <section className="sw-development">
      <div className="sw-section-intro">
        <span className="sw-eyebrow">QUALITY, SUPPORT & GROWTH</span>
        <h2>
          {manager
            ? "Recognise good work. Help people improve."
            : "Your feedback & next steps."}
        </h2>
        <p>
          {manager
            ? "Review the actual results, ask about the circumstances, then agree a useful next step."
            : "Feedback is shared with you and management. Add your perspective and agree what happens next."}
        </p>
      </div>
      {manager && (
        <div className="sw-review-controls">
          <label>
            Colleague
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Work from
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                if (e.target.value) setFrom(e.target.value);
              }}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => {
                if (e.target.value) setTo(e.target.value);
              }}
            />
          </label>
        </div>
      )}
      {error && (
        <div role="alert" className="sw-error">
          {error}
          <button onClick={() => setReload((n) => n + 1)}>Try again</button>
        </div>
      )}
      {loading ? (
        <div className="sw-empty">Loading recorded work and feedback…</div>
      ) : (
        !error && (
          <>
            {manager && (
              <>
                <h3>{name} · recorded work</h3>
                <div className="sw-evidence">
                  <div>
                    <strong>
                      {facts.verified}
                      <small> / {facts.assigned}</small>
                    </strong>
                    <span>assignments verified</span>
                  </div>
                  <div>
                    <strong>{facts.awaiting}</strong>
                    <span>await independent review</span>
                  </div>
                  <div>
                    <strong>{facts.support}</strong>
                    <span>currently need help</span>
                  </div>
                  <div>
                    <strong>{facts.reworks}</strong>
                    <span>recorded returns</span>
                  </div>
                  <div>
                    <strong>
                      {facts.onTime}
                      <small> / {facts.timedCompleted}</small>
                    </strong>
                    <span>timed completions on target</span>
                  </div>
                </div>
                <p className="sw-muted">
                  Only saved assignments in this period are included. Counts do
                  not measure effort or explain delays. Review workload,
                  equipment, instructions and the person’s account before
                  deciding.
                  {facts.withoutEvidence > 0
                    ? ` ${facts.withoutEvidence} older completion(s) have no result note.`
                    : ""}
                </p>
                <details className="sw-recorded">
                  <summary>
                    Inspect results & choose supporting records (
                    {recorded.length})
                  </summary>
                  {!recorded.length ? (
                    <p>No saved assignments in this period.</p>
                  ) : (
                    recorded.map((t) => (
                      <label key={t.id} className="sw-evidence-row">
                        <input
                          type="checkbox"
                          checked={links.includes(t.id)}
                          disabled={
                            busy ||
                            (links.length >= 50 && !links.includes(t.id))
                          }
                          onChange={(e) =>
                            setLinks((old) =>
                              e.target.checked
                                ? [...old, t.id]
                                : old.filter((id) => id !== t.id),
                            )
                          }
                        />
                        <span>
                          <strong>{t.title}</strong>
                          <small>
                            {t.day} ·{" "}
                            {t.verified_at
                              ? "Verified"
                              : t.status === "done"
                                ? "Awaiting review"
                                : t.status}{" "}
                            ·{" "}
                            {t.due_minute == null
                              ? "No target recorded"
                              : `Target ${clock(t.due_minute)}`}
                          </small>
                          <p>
                            {t.completion_note ||
                              t.note ||
                              "No result recorded yet."}
                          </p>
                          {t.review_note && <p>Review: {t.review_note}</p>}
                        </span>
                      </label>
                    ))
                  )}
                </details>
                <button
                  className="sw-primary"
                  onClick={() => setWriting((v) => !v)}
                >
                  {writing
                    ? "Close feedback form"
                    : "Agree feedback & a next step"}
                </button>
                {writing && (
                  <form
                    className="sw-decision"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(async () => {
                        const saved = await work.saveNote({
                          branch,
                          profile_id: person,
                          kind,
                          evidence: evidence.trim(),
                          context: context.trim(),
                          action: action.trim(),
                          review_on: review,
                          task_ids: links,
                          context_reviewed: reviewed,
                        });
                        setNotes((n) => [saved, ...n]);
                        setWriting(false);
                        setEvidence("");
                        setContext("");
                        setAction("");
                        setReviewed(false);
                        setLinks([]);
                      });
                    }}
                  >
                    <h3>Feedback for {name}</h3>
                    <label>
                      Next step
                      <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value as typeof kind)}
                      >
                        {Object.entries(DEVELOPMENT_LABELS).map(
                          ([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      Observed work & evidence
                      <textarea
                        required
                        minLength={10}
                        maxLength={3000}
                        value={evidence}
                        onChange={(e) => setEvidence(e.target.value)}
                        placeholder="Describe the specific work, its result and impact."
                      />
                    </label>
                    <label>
                      Circumstances & the colleague’s perspective
                      <textarea
                        required={kind === "warning"}
                        minLength={kind === "warning" ? 10 : undefined}
                        maxLength={3000}
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                      />
                    </label>
                    <label>
                      Agreed action, support or recognition
                      <textarea
                        required
                        minLength={5}
                        maxLength={2000}
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                      />
                    </label>
                    <label>
                      Follow up on
                      <input
                        required
                        type="date"
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                      />
                    </label>
                    {kind === "warning" && (
                      <label className="sw-checkbox">
                        <input
                          type="checkbox"
                          required
                          checked={reviewed}
                          onChange={(e) => setReviewed(e.target.checked)}
                        />
                        I have reviewed the circumstances and the colleague’s
                        account.
                      </label>
                    )}
                    <p className="sw-muted">
                      {links.length} supporting work record(s) will be preserved
                      with this decision. Visible to this colleague and
                      management.
                    </p>
                    <button
                      className="sw-primary"
                      disabled={
                        busy ||
                        evidence.trim().length < 10 ||
                        action.trim().length < 5 ||
                        !review ||
                        (kind === "warning" &&
                          (!reviewed || context.trim().length < 10))
                      }
                    >
                      Save feedback & follow-up
                    </button>
                  </form>
                )}
              </>
            )}
            <div className="sw-feedback-list">
              <h3>{manager ? "Feedback & follow-up" : "My feedback"}</h3>
              {notes.filter((n) => n.profile_id === person).length ? (
                notes
                  .filter((n) => n.profile_id === person)
                  .map((n) => (
                    <FeedbackNote
                      key={n.id}
                      note={n}
                      me={me}
                      manager={manager}
                      busy={busy}
                      update={(fn) =>
                        void act(async () => {
                          const saved = await fn();
                          setNotes((old) =>
                            old.map((x) => (x.id === saved.id ? saved : x)),
                          );
                        })
                      }
                      work={work}
                    />
                  ))
              ) : (
                <div className="sw-empty">
                  No feedback has been recorded here yet.
                </div>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
}
function FeedbackNote({
  note: n,
  me,
  manager,
  busy,
  update,
  work,
}: {
  note: DevelopmentNote;
  me: string;
  manager: boolean;
  busy: boolean;
  update: (fn: () => Promise<DevelopmentNote>) => void;
  work: WorkRepository;
}) {
  const [response, setResponse] = useState(n.staff_response || "");
  const [closing, setClosing] = useState(false);
  const [outcome, setOutcome] = useState("");
  return (
    <article className="sw-feedback-record">
      <header>
        <span className="sw-state">{DEVELOPMENT_LABELS[n.kind]}</span>
        <small>
          {n.status === "closed"
            ? "Follow-up closed"
            : `Follow up ${n.review_on}`}
        </small>
      </header>
      <h4>Observed work</h4>
      <p>{n.evidence}</p>
      {n.context && (
        <>
          <h4>Context</h4>
          <p>{n.context}</p>
        </>
      )}
      <h4>Next step</h4>
      <p>{n.action}</p>
      {n.evidence_snapshot?.length > 0 && (
        <details>
          <summary>
            Supporting work at the time ({n.evidence_snapshot.length})
          </summary>
          {n.evidence_snapshot.map((t) => (
            <p key={t.id}>
              <strong>
                {t.title} · {t.day}
              </strong>
              <br />
              {t.completion_note || t.note || t.status}
            </p>
          ))}
        </details>
      )}
      {n.profile_id === me ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update(() => work.respond(n.id, response.trim()));
          }}
        >
          <label>
            Your perspective
            <textarea
              maxLength={3000}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
            />
          </label>
          <button disabled={busy || response.trim() === n.staff_response}>
            Save my response
          </button>
        </form>
      ) : (
        n.staff_response && (
          <>
            <h4>Colleague’s response</h4>
            <p>{n.staff_response}</p>
          </>
        )
      )}
      {n.followup_result && (
        <>
          <h4>Follow-up outcome</h4>
          <p>{n.followup_result}</p>
        </>
      )}
      {manager &&
        n.status === "open" &&
        (closing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update(() => work.closeNote(n.id, outcome.trim()));
            }}
          >
            <label>
              Follow-up outcome
              <textarea
                required
                minLength={5}
                maxLength={2000}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What changed after the action, support or training?"
              />
            </label>
            <button disabled={busy || outcome.trim().length < 5}>
              Record outcome & close follow-up
            </button>
            <button type="button" onClick={() => setClosing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button disabled={busy} onClick={() => setClosing(true)}>
            Record follow-up outcome
          </button>
        ))}
    </article>
  );
}
