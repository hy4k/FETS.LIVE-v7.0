import React, { useEffect, useState } from "react";
import { Flag, HelpCircle, Play, ShieldCheck } from "lucide-react";
import { clock, minutes, type TeamMember } from "./shift-plan";
import { shortDutyTitle } from "./shift-board";
import { frequencyLabel, type ListItem } from "./shift-blueprint";
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
}: {
  item: ListItem;
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
    <section className="sw-detail" aria-label="Duty agreement">
      <header>
        <span className={`sw-state is-${state}`}>{WORK_LABELS[state]}</span>
        {agreement.priority === "important" && (
          <span className="sw-priority">
            <Flag size={12} /> Important
          </span>
        )}
      </header>
      <h2>{shortDutyTitle(item.title)}</h2>
      <div className="sw-contract">
        <div>
          <small>ACCOUNTABLE OWNER</small>
          <strong>{names(item.assignee)}</strong>
          <span>
            {item.reason === "backup"
              ? "Covering the regular owner"
              : item.responsibility?.backup_id
                ? `Backup: ${names(item.responsibility.backup_id)}`
                : "Contact the lead for cover"}
          </span>
        </div>
        <div>
          <small>AGREED TARGET</small>
          <strong>
            {agreement.due == null
              ? "Today · time not agreed"
              : clock(agreement.due)}
          </strong>
          <span>
            {item.responsibility
              ? frequencyLabel(item.responsibility)
              : "Assigned for this day"}
          </span>
        </div>
      </div>
      <div className="sw-result">
        <h3>Done means</h3>
        <p>
          {agreement.result ||
            "The lead needs to define a clear result for this duty. Ask before starting if the expectation is unclear."}
        </p>
      </div>
      {agreement.instructions &&
        agreement.instructions !== agreement.result && (
          <div className="sw-instructions">
            <h3>How to do it</h3>
            <p>{agreement.instructions}</p>
          </div>
        )}
      {item.task?.review_note && (
        <div className="sw-feedback">
          <strong>Reviewer feedback</strong>
          <p>{item.task.review_note}</p>
          <small>
            {item.task.rework_count || 1} recorded return(s) · read the context
            before judging the outcome
          </small>
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
            <small>
              The lead should resolve the blocker or agree different work.
            </small>
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
                  disabled={!canAct}
                  onClick={() => void transition(item, "start")}
                >
                  <Play size={15} /> Start duty
                </button>
              )}
              {state === "help" && (
                <button
                  className="sw-primary"
                  disabled={!canAct}
                  onClick={() => void transition(item, "resume")}
                >
                  Resume work
                </button>
              )}
              <button
                className={state === "working" ? "sw-primary" : "sw-secondary"}
                disabled={!canAct}
                onClick={() => edit("complete")}
              >
                Submit result
              </button>
              <button
                className="sw-text"
                disabled={!canAct}
                onClick={() => edit("help")}
              >
                I need help
              </button>
            </>
          )}
          {canReview && (
            <>
              <button
                className="sw-primary"
                disabled={!canAct}
                onClick={() => void transition(item, "verify")}
              >
                <ShieldCheck size={15} /> Verify result
              </button>
              <button
                className="sw-secondary"
                disabled={!canAct}
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
                  ? "Submitted. Someone else must verify your work."
                  : "Your result has been independently checked."}
              </p>
              <button
                className="sw-text"
                disabled={!canAct}
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
              Edit work agreement
            </button>
          )}
          {canLead &&
            ["todo", "working", "help", "unassigned"].includes(state) && (
              <button
                className="sw-text"
                disabled={!canAct}
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
              ? "What result did you achieve?"
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
                  ? "State what you checked or delivered. Include a safe reference if useful; no candidate ID documents."
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
                !canAct || !note.trim() || (mode === "help" && !category)
              }
            >
              {mode === "complete"
                ? "Send for independent review"
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
          <p>
            Changing a completed duty’s agreement reopens it for the owner to
            complete again.
          </p>
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
          <summary>Work history & evidence</summary>
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
    </section>
  );
}
