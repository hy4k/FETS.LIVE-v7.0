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
import { currentDuty, personChecks } from "./shift-board";
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
  const current =
    plan && day === today
      ? currentDuty(plan, data.changes, time, identity.profileId)
      : null;
  const points =
    plan && day === today
      ? personChecks(plan, data.changes, data.events, time, identity.profileId)
      : [];
  const due = points.filter((p) => p.state === "due");
  const next = points
    .filter((p) => p.state === "upcoming")
    .sort((a, b) => a.due - b.due)[0];
  const resting = plan?.breaks.find(
    (b) => b.staff === identity.profileId && b.start <= time && b.end > time,
  );
  return (
    <section className="sw-now" aria-label="My current responsibility">
      <div className="sw-now-main">
        <span className="sw-eyebrow">
          <Clock3 size={14} /> {day === today ? "RIGHT NOW" : "SELECTED DAY"}
        </span>
        <h3>
          {!plan
            ? "Daily coverage has not been published"
            : day !== today
              ? "Use the timetable for this date"
              : current?.lanes.length
                ? current.lanes.map((l) => laneInfo[l].title).join(" + ")
                : resting
                  ? "Your break"
                  : "No post at this time"}
        </h3>
        {current?.lanes.length ? (
          <p>
            Until {clock(current.ends!)} ·{" "}
            {current.lanes.map((l) => laneInfo[l].purpose).join(" ")}{" "}
            {current.lanes.length > 1 &&
              "You are covering more than one post; contact the lead if both cannot be managed safely."}
          </p>
        ) : (
          <p>
            {resting
              ? `${names(resting.cover)} covers until ${clock(resting.end)}.`
              : !plan
                ? "Your lead needs to publish coverage. The duties below remain your assigned work."
                : "Continue with your assigned duties below."}
          </p>
        )}
      </div>
      <div className="sw-next-check">
        {due.length ? (
          due.map((p) => (
            <div key={`${p.block}:${p.kind}:${p.due}`}>
              <strong>
                {p.kind === "walk" ? "Lab walk" : "DVR check"} · {clock(p.due)}
              </strong>
              <button
                className="sw-primary"
                disabled={busy || data.closed}
                onClick={() => onCheck(p)}
              >
                <Check size={15} /> Record {p.kind === "walk" ? "walk" : "DVR"}
                <span className="sw-sr"> at {clock(p.due)}</span>
              </button>
            </div>
          ))
        ) : (
          <>
            <small>NEXT CHECK</small>
            <strong>
              {next
                ? `${next.kind === "walk" ? "Lab walk" : "DVR"} · ${clock(next.due)}`
                : "No upcoming check assigned"}
            </strong>
          </>
        )}
        <small>
          90-minute rotations · walks every 10 min · DVR every 6 min
        </small>
      </div>
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
