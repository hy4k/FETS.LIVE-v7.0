import React, { useEffect, useState } from "react";
import { Flag, HelpCircle, Play, ShieldCheck, Check } from "lucide-react";
import { clock, minutes, type TeamMember } from "./shift-plan";
import { shortDutyTitle } from "./shift-board";
import { type ListItem } from "./shift-blueprint";
import type { WorkRepository } from "./shift-work-repository";
import {
  contract,
  workState,
  WORK_LABELS,
  SUPPORT_REASONS,
  type WorkAction,
} from "./shift-work";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Could not save. Please try again.";
export default function WorkDetail({
  item,
  names,
  team,
  me,
  canLead,
  closed,
  ready,
  busy,
  work,
  transition,
  assign,
  pastTarget = false,
  future = false,
}: {
  item: ListItem;
  pastTarget?: boolean;
  future?: boolean;
  names: (id: string | null) => string;
  team: TeamMember[];
  me: string;
  canLead: boolean;
  closed: boolean;
  ready: boolean;
  busy: boolean;
  work: WorkRepository;
  transition: (
    item: ListItem,
    action: WorkAction,
    note?: string,
    category?: string,
  ) => Promise<void>;
  assign: (
    owner: string | null,
    due: number | null,
    priority: "normal" | "important",
    result: string,
    instructions: string,
  ) => void;
}) {
  const [mode, setMode] = useState<
    "none" | "complete" | "help" | "return" | "assign" | "skip"
  >("none");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const agreement = contract(item);
  const state = workState(item);
  const mine = me === item.assignee;
  const [owner, setOwner] = useState(item.assignee || "");
  const [due, setDue] = useState(
    agreement.due == null ? "" : clock(agreement.due),
  );
  const [priority, setPriority] = useState(agreement.priority);
  const [result, setResult] = useState(agreement.result);
  const [instructions, setInstructions] = useState(agreement.instructions);
  const [trail, setTrail] = useState<Awaited<
    ReturnType<WorkRepository["activity"]>
  > | null>(null);
  const [trailError, setTrailError] = useState("");
  const canReview =
    canLead &&
    item.assignee !== me &&
    item.task?.done_by !== me &&
    state === "review";
  const canAct = ready && !closed && !busy;
  const canDoWork = canAct && !future;
  useEffect(() => {
    setMode("none");
    setNote("");
    setTrail(null);
  }, [item.task?.version]);
  const edit = (m: typeof mode) => {
    setMode(m);
    setNote("");
    setCategory("");
    if (m === "assign") {
      setOwner(item.assignee || "");
      setDue(agreement.due == null ? "" : clock(agreement.due));
      setPriority(agreement.priority);
      setResult(agreement.result);
      setInstructions(agreement.instructions);
    }
  };
  return (
    <article
      className={`sw-detail sw-duty-card is-${state}`}
      aria-label={shortDutyTitle(item.title)}
    >
      <header className="sw-duty-header">
        <div>
          <div className="sw-duty-meta">
            <span className={`sw-state is-${state}`}>{WORK_LABELS[state]}</span>
            {agreement.priority === "important" && (
              <span className="sw-priority">
                <Flag size={12} />
                Important
              </span>
            )}
          </div>
          <h3>{shortDutyTitle(item.title)}</h3>
        </div>
        <span className={`sw-duty-time ${pastTarget ? "is-late" : ""}`}>
          {agreement.due == null
            ? "Time not set"
            : `By ${clock(agreement.due)}`}
        </span>
      </header>
      <p className="sw-duty-owner">
        {mine ? "You" : names(item.assignee)}
        {item.reason === "backup"
          ? ` · Covering for ${names(item.responsibility?.owner_id || null)}`
          : item.responsibility?.backup_id
            ? ` · Backup: ${names(item.responsibility.backup_id)}`
            : ""}
      </p>
      <div className="sw-result">
        <h4>Done means</h4>
        <p>
          {agreement.result ||
            "The expected result is not set. Ask the lead what needs to be completed."}
        </p>
      </div>
      {agreement.instructions &&
        agreement.instructions !== agreement.result && (
          <details className="sw-instructions">
            <summary>Instructions</summary>
            <p>{agreement.instructions}</p>
          </details>
        )}
      {item.task?.review_note && (
        <div className="sw-feedback">
          <strong>Reviewer feedback</strong>
          <p>{item.task.review_note}</p>
          <small>Update the work, then send the result for review again.</small>
        </div>
      )}
      {item.status === "blocked" && (
        <div className="sw-help">
          <HelpCircle size={18} />
          <div>
            <strong>
              {SUPPORT_REASONS.find(
                ([id]) => id === item.task?.support_category,
              )?.[1] || "Help requested"}
            </strong>
            <p>{item.note}</p>
            <small>The lead can arrange support or reassign this duty.</small>
          </div>
        </div>
      )}
      {item.status === "done" && item.task?.completion_note && (
        <div className="sw-proof">
          <h3>Recorded result</h3>
          <p>{item.task.completion_note}</p>
          <small>
            Recorded by {names(item.task.done_by)}
            {item.task.done_at &&
              ` · ${new Date(item.task.done_at).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} IST`}
          </small>
        </div>
      )}
      {item.status === "done" && !item.task?.completion_note && (
        <p className="sw-muted">
          This older completion has no result note. Review the work before
          verifying it.
        </p>
      )}
      {state === "verified" && (
        <div className="sw-verified">
          <ShieldCheck size={18} /> Verified by {names(item.task!.verified_by!)}{" "}
          ·{" "}
          {new Date(item.task!.verified_at!).toLocaleString("en-GB", {
            timeZone: "Asia/Kolkata",
          })}{" "}
          IST
        </div>
      )}
      {["skipped", "carried"].includes(item.status) && item.note && (
        <p className="sw-muted">Reason: {item.note}</p>
      )}
      {mode === "none" && (
        <div className="sw-work-actions">
          {mine && ["todo", "working", "help"].includes(state) && (
            <>
              {state === "todo" && (
                <button
                  className="sw-primary"
                  disabled={!canDoWork}
                  onClick={() => void transition(item, "start")}
                >
                  <Play size={15} /> Start duty
                </button>
              )}
              {state === "help" && (
                <button
                  className="sw-primary"
                  disabled={!canDoWork}
                  onClick={() => void transition(item, "resume")}
                >
                  Resume work
                </button>
              )}
              {state === "working" && (
                <button
                  className="sw-primary"
                  disabled={!canDoWork}
                  onClick={() => edit("complete")}
                >
                  <Check size={15} />
                  Finish duty
                </button>
              )}
              <button
                className="sw-text"
                disabled={!canDoWork}
                onClick={() => edit("help")}
              >
                Need help
              </button>
            </>
          )}
          {canReview && (
            <>
              <button
                className="sw-primary"
                disabled={!canDoWork}
                onClick={() => void transition(item, "verify")}
              >
                <ShieldCheck size={15} /> Verify result
              </button>
              <button
                className="sw-secondary"
                disabled={!canDoWork}
                onClick={() => edit("return")}
              >
                Return with feedback
              </button>
            </>
          )}
          {mine && ["review", "verified"].includes(state) && (
            <>
              <p className="sw-muted">
                {state === "review"
                  ? "Sent for review. Another lead will check your result."
                  : "Your result has been checked."}
              </p>
              <button
                className="sw-text"
                disabled={!canDoWork}
                onClick={() => void transition(item, "reopen")}
              >
                Reopen my work
              </button>
            </>
          )}
          {canLead && !closed && (
            <button
              className="sw-text"
              disabled={!canAct}
              onClick={() => edit("assign")}
            >
              Edit assignment
            </button>
          )}
          {canLead &&
            ["todo", "working", "help", "unassigned"].includes(state) && (
              <button
                className="sw-text"
                disabled={!canDoWork}
                onClick={() => edit("skip")}
              >
                Not needed today
              </button>
            )}
        </div>
      )}
      {mode !== "none" && mode !== "assign" && (
        <form
          className="sw-action-form"
          onSubmit={(e) => {
            e.preventDefault();
            void transition(item, mode, note.trim(), category);
          }}
        >
          <label>
            {mode === "complete"
              ? "What did you complete?"
              : mode === "help"
                ? "What is stopping you, and what would help?"
                : mode === "return"
                  ? "What needs to change to meet the agreed result?"
                  : "Why is this duty not needed today?"}
            <textarea
              autoFocus
              required
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "complete"
                  ? "Write what you completed and any follow-up needed."
                  : "Be specific so the next action is clear."
              }
            />
          </label>
          {mode === "help" && (
            <label>
              Help needed
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Choose a reason</option>
                {SUPPORT_REASONS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div>
            <button
              className="sw-primary"
              disabled={
                !canDoWork || !note.trim() || (mode === "help" && !category)
              }
            >
              {mode === "complete"
                ? "Send for review"
                : mode === "help"
                  ? "Ask the lead for help"
                  : "Save decision"}
            </button>
            <button
              type="button"
              className="sw-text"
              onClick={() => setMode("none")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {mode === "assign" && (
        <form
          className="sw-action-form"
          onSubmit={(e) => {
            e.preventDefault();
            assign(
              owner || null,
              due ? minutes(due) : null,
              priority,
              result.trim(),
              instructions.trim(),
            );
          }}
        >
          {item.status === "done" && (
            <p>Changing this completed assignment reopens it for the owner.</p>
          )}
          <label>
            Owner
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Not assigned</option>
              {owner && !team.some((p) => p.id === owner) && (
                <option value={owner}>{names(owner)} · not rostered</option>
              )}
              {team.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target time
            <input
              type="time"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
            >
              <option value="normal">Normal</option>
              <option value="important">Important</option>
            </select>
          </label>
          <label>
            Done means
            <textarea
              required
              maxLength={2000}
              value={result}
              onChange={(e) => setResult(e.target.value)}
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
          <div>
            <button className="sw-primary" disabled={!canAct || !result.trim()}>
              Save agreement
            </button>
            <button
              type="button"
              className="sw-text"
              onClick={() => setMode("none")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {future && mine && (
        <p className="sw-muted sw-future-note">
          Work updates are available on the day.
        </p>
      )}
      {closed && (
        <p className="sw-muted">The day report has closed this assignment.</p>
      )}
      {item.task && ready && (
        <details
          className="sw-trail"
          onToggle={(e) => {
            if (e.currentTarget.open && trail === null)
              work
                .activity(item.task!.id)
                .then(setTrail)
                .catch((e) => setTrailError(errorText(e)));
          }}
        >
          <summary>Activity history</summary>
          {trailError ? (
            <p role="alert">{trailError}</p>
          ) : trail === null ? (
            <p>Loading recorded activity…</p>
          ) : !trail.length ? (
            <p>No detailed activity was recorded before this update.</p>
          ) : (
            <ol>
              {trail.map((a) => (
                <li key={a.id}>
                  <strong>
                    {a.kind.replace(/_/g, " ")} · {names(a.actor_id)}
                  </strong>
                  <small>
                    {new Date(a.created_at).toLocaleString("en-GB", {
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    IST
                  </small>
                  <p>
                    {a.kind === "support_requested"
                      ? a.after_state?.note
                      : a.kind === "returned"
                        ? a.after_state?.review_note
                        : a.kind === "completed"
                          ? a.after_state?.completion_note
                          : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </details>
      )}
    </article>
  );
}
