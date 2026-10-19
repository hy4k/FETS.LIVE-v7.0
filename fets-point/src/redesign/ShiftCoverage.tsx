import React, { useState } from "react";
import { Clock3, Check, ChevronRight } from "lucide-react";
import {
  clock,
  checkpoints,
  laneInfo,
  resolvedOwner,
  ownedBlock,
  blockReview,
  type DutyEvent,
} from "./shift-plan";
import { personChecks } from "./shift-board";
import { personalSchedule } from "./shift-day";
import type { ShiftIdentity } from "./TheShift";
import type { DayData } from "./shift-work-types";
export function LiveResponsibility({
  data,
  day,
  today,
  time,
  identity,
  names,
  busy,
  onCheck,
}: {
  data: DayData;
  day: string;
  today: string;
  time: number;
  identity: ShiftIdentity;
  names: (id: string | null) => string;
  busy: boolean;
  onCheck: (p: ReturnType<typeof personChecks>[number]) => void;
}) {
  const plan = data.record?.status === "published" ? data.record.plan : null;
  const schedule = plan
    ? personalSchedule(plan, data.changes, identity.profileId)
    : [];
  const current =
    day === today
      ? schedule.find((s) => s.start <= time && s.end > time)
      : null;
  const currentBlock = plan?.blocks.find(
    (b) => b.start <= time && b.end > time,
  );
  const extraInstructions = current?.lanes
    .map((l) => currentBlock?.duties[l]?.trim())
    .filter(Boolean)
    .join(" · ");
  const nextPost = schedule.find((s) => day !== today || s.start > time);
  const points =
    plan && day === today
      ? personChecks(plan, data.changes, data.events, time, identity.profileId)
      : [];
  const due = points.filter((p) => p.state === "due");
  const nextCheck = points
    .filter((p) => p.state === "upcoming")
    .sort((a, b) => a.due - b.due)[0];
  const missed = points.filter((p) => p.state === "missed");
  const title = (slot: (typeof schedule)[number]) =>
    slot.kind === "break"
      ? "Break"
      : slot.lanes.map((l) => laneInfo[l].title).join(" + ");
  return (
    <section
      className="sw-shift-overview"
      aria-label="My current responsibility"
    >
      <div className="sw-now">
        <div className="sw-now-main">
          <span className="sw-eyebrow">
            <Clock3 size={14} />
            {day === today ? "Now" : "Post coverage"}
          </span>
          <h3>
            {!plan
              ? "Coverage not published"
              : day !== today
                ? "See this day’s timetable"
                : current
                  ? title(current)
                  : nextPost
                    ? "Before your next post"
                    : "No post at this time"}
          </h3>
          <p>
            {!plan
              ? "Your lead needs to publish the posts and break cover."
              : current
                ? current.kind === "break"
                  ? `${current.cover.length ? current.cover.map(names).join(" & ") : "Cover not assigned"} · cover until ${clock(current.end)}`
                  : `Until ${clock(current.end)} · ${current.lanes.map((l) => laneInfo[l].tasks).join(". ")}`
                : "Your assigned duties are listed below."}
          </p>
          {extraInstructions && (
            <p className="sw-post-instructions">Also: {extraInstructions}</p>
          )}
          {current && current.lanes.length > 1 && (
            <p className="sw-cover-alert">
              You are covering two posts. Contact the lead if you need support.
            </p>
          )}
        </div>
        <div className="sw-next-post">
          <span className="sw-eyebrow">
            {day === today ? "Next" : "First post"}
            {nextPost ? ` · ${clock(nextPost.start)}` : ""}
          </span>
          <h3>{nextPost ? title(nextPost) : "No further posts"}</h3>
          <p>
            {nextPost
              ? `Until ${clock(nextPost.end)}${nextPost.kind === "break" ? ` · cover: ${nextPost.cover.length ? nextPost.cover.map(names).join(" & ") : "not assigned"}` : ""}`
              : "Check the timetable for the full day."}
          </p>
        </div>
        <div className="sw-next-check">
          <span className="sw-eyebrow">
            {due.length ? "Check due" : "Next check"}
          </span>
          {due.length ? (
            due.map((p) => (
              <div key={`${p.block}:${p.kind}:${p.due}`}>
                <strong>
                  {p.kind === "walk" ? "Lab walk" : "DVR check"} ·{" "}
                  {clock(p.due)}
                </strong>
                <button
                  className="sw-primary"
                  disabled={busy || data.closed}
                  onClick={() => onCheck(p)}
                >
                  <Check size={15} />
                  Record {p.kind === "walk" ? "walk" : "DVR"}
                  <span className="sw-sr"> at {clock(p.due)}</span>
                </button>
              </div>
            ))
          ) : (
            <strong>
              {nextCheck
                ? `${nextCheck.kind === "walk" ? "Lab walk" : "DVR check"} · ${clock(nextCheck.due)}`
                : day !== today
                  ? "Available on the day"
                  : "No check due"}
            </strong>
          )}
          <small>
            {due.length
              ? "Record only after completing the check."
              : "Lab walks every 10 min · DVR every 6 min"}
          </small>
        </div>
      </div>
      {(schedule.length > 0 || missed.length > 0) && (
        <details className="sw-day-outline">
          <summary>
            <span>
              My post timings
              {missed.length > 0 && (
                <em>{missed.length} earlier checks unrecorded</em>
              )}
            </span>
            <ChevronRight size={16} />
          </summary>
          {missed.length > 0 && (
            <p className="sw-missing-checks">
              Earlier checks have no record. Tell the lead what happened; they
              cannot be recorded retrospectively here.
            </p>
          )}
          <ol>
            {schedule.map((slot) => (
              <li
                key={slot.start}
                className={current === slot ? "is-current" : ""}
              >
                <time>
                  {clock(slot.start)}–{clock(slot.end)}
                </time>
                <strong>{title(slot)}</strong>
                {slot.kind === "break" && (
                  <small>
                    Cover:{" "}
                    {slot.cover.length
                      ? slot.cover.map(names).join(" & ")
                      : "not assigned"}
                  </small>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

export function ShiftTimetable({
  data,
  identity,
  names,
  day,
  today,
  time,
  teamView,
  canLead,
  busy,
  log,
}: {
  data: DayData;
  identity: ShiftIdentity;
  names: (id: string | null) => string;
  day: string;
  today: string;
  time: number;
  teamView: boolean;
  canLead: boolean;
  busy: boolean;
  log: (
    block: number,
    lane: DutyEvent["lane"],
    kind: DutyEvent["kind"],
    note: string,
  ) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState("");
  if (data.record?.status !== "published")
    return (
      <div className="sw-empty">
        The lead has not published coverage for this day.
      </div>
    );
  const plan = data.record.plan;
  return (
    <section className="sw-timetable">
      <h3>Coverage & handover</h3>
      <p className="sw-muted">
        The named cover owns the post and its checks during a break. Handover
        results remain part of the day report.
      </p>
      {plan.blocks.flatMap((b, block) =>
        (["front", "floor", "control"] as const)
          .filter(
            (lane) =>
              teamView ||
              ownedBlock(plan, block, lane, identity.profileId, data.changes),
          )
          .map((lane) => {
            const key = `${block}:${lane}`;
            const state = blockReview(data.events, block, lane);
            const submit = [...data.events]
              .reverse()
              .find(
                (e) =>
                  e.block === block && e.lane === lane && e.kind === "submit",
              );
            const owns = ownedBlock(
              plan,
              block,
              lane,
              identity.profileId,
              data.changes,
            );
            const ended = day < today || (day === today && time >= b.end);
            const segments: { start: number; end: number; owner: string }[] =
              [];
            for (let minute = b.start; minute < b.end; minute++) {
              const owner = resolvedOwner(
                plan,
                block,
                lane,
                minute,
                data.changes,
              );
              const last = segments[segments.length - 1];
              if (last?.owner === owner) last.end = minute + 1;
              else segments.push({ start: minute, end: minute + 1, owner });
            }
            const missed = checkpoints(plan, data.changes).filter(
              (p) =>
                p.block === block &&
                p.lane === lane &&
                (day < today || (day === today && p.due < time)) &&
                !data.events.some(
                  (e) =>
                    e.block === block &&
                    e.lane === lane &&
                    e.kind === p.kind &&
                    e.due === p.due,
                ),
            ).length;
            return (
              <article key={key} className="sw-rotation">
                <button
                  className="sw-rotation-heading"
                  aria-expanded={expanded === key}
                  onClick={() => {
                    setExpanded(expanded === key ? "" : key);
                    setNote("");
                  }}
                >
                  <span>
                    {clock(b.start)}–{clock(b.end)}
                  </span>
                  <strong>{laneInfo[lane].title}</strong>
                  <span>
                    {state === "verify"
                      ? "Verified"
                      : state === "submit"
                        ? "Ready for review"
                        : state === "return"
                          ? "Changes requested"
                          : "Handover pending"}
                    <ChevronRight size={15} />
                  </span>
                </button>
                {expanded === key && (
                  <div className="sw-rotation-body">
                    <p>{b.duties[lane] || laneInfo[lane].tasks}</p>
                    <ul>
                      {segments.map((s) => (
                        <li key={s.start}>
                          {clock(s.start)}–{clock(s.end)} ·{" "}
                          <strong>{names(s.owner)}</strong>
                          {s.owner !== b.owners[lane] ? " · Cover" : ""}
                        </li>
                      ))}
                    </ul>
                    {missed > 0 && (
                      <p className="sw-feedback">
                        {missed} past checkpoint(s) have no record. Ask what
                        happened; a missing record alone does not explain the
                        cause.
                      </p>
                    )}
                    {data.events
                      .filter(
                        (e) =>
                          e.block === block &&
                          e.lane === lane &&
                          ["submit", "verify", "return", "support"].includes(
                            e.kind,
                          ),
                      )
                      .map((e) => (
                        <p key={e.id}>
                          <strong>
                            {names(e.actor_id)} ·{" "}
                            {e.kind === "submit"
                              ? "Result"
                              : e.kind === "return"
                                ? "Feedback"
                                : e.kind}
                          </strong>
                          <br />
                          {e.note || "Verified"}
                        </p>
                      ))}
                    {!data.closed && (
                      <>
                        <label>
                          Handover result or feedback
                          <textarea
                            value={note}
                            maxLength={2000}
                            onChange={(e) => setNote(e.target.value)}
                          />
                        </label>
                        <div className="sw-actions">
                          {owns && ended && state !== "verify" && (
                            <button
                              className="sw-primary"
                              disabled={busy || !note.trim()}
                              onClick={() =>
                                void log(block, lane, "submit", note.trim())
                              }
                            >
                              Submit handover
                            </button>
                          )}
                          {canLead &&
                            state === "submit" &&
                            submit?.actor_id !== identity.profileId && (
                              <>
                                <button
                                  className="sw-primary"
                                  disabled={busy}
                                  onClick={() =>
                                    void log(block, lane, "verify", note.trim())
                                  }
                                >
                                  Verify handover
                                </button>
                                <button
                                  disabled={busy || !note.trim()}
                                  onClick={() =>
                                    void log(block, lane, "return", note.trim())
                                  }
                                >
                                  Return with feedback
                                </button>
                              </>
                            )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          }),
      )}
    </section>
  );
}
