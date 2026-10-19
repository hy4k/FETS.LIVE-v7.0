import React, { useState, useRef } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Coffee,
  Clock3,
  Plus,
} from "lucide-react";
import { clock, LANES, laneInfo, resolvedOwner } from "./shift-plan";
import { personalSchedule } from "./shift-day";
import { personChecks, shortDutyTitle } from "./shift-board";
import { contract, overdue, workState, WORK_LABELS } from "./shift-work";
import type { ListItem } from "./shift-blueprint";
import type { DayData } from "./shift-work-types";
import type { ShiftIdentity } from "./TheShift";

type Checkpoint = ReturnType<typeof personChecks>[number];
type Props = {
  data: DayData;
  items: ListItem[];
  day: string;
  today: string;
  time: number;
  identity: ShiftIdentity;
  teamView: boolean;
  canLead: boolean;
  busy: boolean;
  ready: boolean;
  names: (id: string | null) => string;
  renderDuty: (item: ListItem) => React.ReactNode;
  onCheck: (point: Checkpoint) => void;
  onAdd: () => void;
};

/** One chronological view of the published rota and work deadlines. No inferred completion. */
export default function ShiftDayTimeline({
  data,
  items,
  day,
  today,
  time,
  identity,
  teamView,
  canLead,
  busy,
  ready,
  names,
  renderDuty,
  onCheck,
  onAdd,
}: Props) {
  const [onlyAttention, setOnlyAttention] = useState(false);
  const timelineRef = useRef<HTMLOListElement>(null);
  const plan = data.record?.status === "published" ? data.record.plan : null;
  const mine = items.filter((i) => i.assignee === identity.profileId);
  const duties = teamView ? items : mine;
  const attention = (i: ListItem) =>
    ["help", "review", "unassigned"].includes(workState(i)) ||
    overdue(i, day, today, time);
  const focusCount = duties.filter(attention).length;
  const checkpoints =
    plan && day === today && !data.closed
      ? personChecks(plan, data.changes, data.events, time, identity.profileId)
      : [];
  const due = checkpoints.filter((p) => p.state === "due");
  const next = checkpoints
    .filter((p) => p.state === "upcoming")
    .sort((a, b) => a.due - b.due)[0];
  const missed = checkpoints.filter((p) => p.state === "missed");
  const schedule = plan
    ? personalSchedule(plan, data.changes, identity.profileId).flatMap((slot) =>
        plan.blocks
          .filter((b) => b.start < slot.end && b.end > slot.start)
          .map((b) => ({
            ...slot,
            start: Math.max(slot.start, b.start),
            end: Math.min(slot.end, b.end),
          })),
      )
    : [];
  type Entry = {
    key: string;
    start: number;
    end?: number;
    kind: "post" | "break" | "task" | "team";
    slot?: (typeof schedule)[number];
    item?: ListItem;
    block?: number;
  };
  const entries: Entry[] = [];
  if (plan && !onlyAttention) {
    if (teamView) {
      plan.blocks.forEach((block, index) => {
        const cuts = [
          ...new Set(
            [
              block.start,
              block.end,
              ...plan.breaks.flatMap((b) => [b.start, b.end]),
              ...data.changes
                .filter((c) => c.kind === "coverage" && c.block === index)
                .flatMap((c) => [c.starts, c.ends]),
            ].filter((t) => t >= block.start && t <= block.end),
          ),
        ].sort((a, b) => a - b);
        cuts.slice(0, -1).forEach((start, n) =>
          entries.push({
            key: `team-${index}-${start}`,
            kind: "team",
            start,
            end: cuts[n + 1],
            block: index,
          }),
        );
      });
    } else
      schedule.forEach((slot) =>
        entries.push({
          key: `post-${slot.start}`,
          kind: slot.kind,
          start: slot.start,
          end: slot.end,
          slot,
        }),
      );
  }
  duties
    .filter((i) => !onlyAttention || attention(i))
    .forEach((item) =>
      entries.push({
        key: item.key,
        kind: "task",
        start: contract(item).due ?? Infinity,
        item,
      }),
    );
  entries.sort(
    (a, b) =>
      a.start - b.start ||
      (a.kind === "task" ? 1 : 0) - (b.kind === "task" ? 1 : 0) ||
      a.key.localeCompare(b.key),
  );
  const recordChecks = (
    <div className="st-checks">
      {due.map((p) => (
        <button
          key={`${p.block}-${p.kind}-${p.due}`}
          disabled={busy || !ready || data.closed}
          onClick={() => onCheck(p)}
        >
          <Check size={15} />
          <span>
            Record {p.kind === "walk" ? "lab walk" : "DVR check"}
            <small>Due {clock(p.due)} · after checking</small>
          </span>
        </button>
      ))}
      {!due.length && next && (
        <span className="st-next-check">
          Next {next.kind === "walk" ? "lab walk" : "DVR check"} ·{" "}
          {clock(next.due)}
        </span>
      )}
    </div>
  );
  const currentSlot = entries.find(
    (e) => e.kind !== "task" && e.start <= time && (e.end ?? 0) > time,
  );
  return (
    <section
      className="st-board"
      aria-label={teamView ? "Team timetable" : "My timetable"}
    >
      <div className="st-board-top">
        <div>
          <span className="st-kicker">
            {teamView ? "Centre timetable" : "Your timetable"}
          </span>
          <h2>{teamView ? "Everyone’s day" : identity.name}</h2>
        </div>
        <div className="st-board-actions">
          {day === today && (
            <button
              className="st-live-time"
              aria-label="Jump to current post"
              disabled={!currentSlot}
              onClick={() =>
                timelineRef.current
                  ?.querySelector(".is-current")
                  ?.scrollIntoView({
                    behavior: matchMedia("(prefers-reduced-motion: reduce)")
                      .matches
                      ? "auto"
                      : "smooth",
                    block: "center",
                  })
              }
            >
              <span />
              {clock(time)} <small>IST</small>
              <ChevronDown size={13} />
            </button>
          )}
          {canLead && teamView && (
            <button
              className="sw-primary"
              onClick={onAdd}
              disabled={busy || data.closed || !ready}
            >
              <Plus size={15} />
              Assign a duty
            </button>
          )}
        </div>
      </div>
      <div className="st-summary">
        <span>
          {duties.length} duties <i>·</i>{" "}
          {duties.filter((i) => workState(i) === "verified").length} verified
        </span>
        <button
          aria-pressed={onlyAttention}
          onClick={() => setOnlyAttention(!onlyAttention)}
        >
          {onlyAttention ? "Show whole day" : `${focusCount} need attention`}
          <ArrowUpRight size={14} />
        </button>
      </div>
      {!plan && (
        <div className="sw-notice">
          Coverage not published. Assigned work is shown below; the lead needs
          to publish the rota and break cover.
        </div>
      )}
      {!teamView && !data.team.some((p) => p.id === identity.profileId) && (
        <div className="sw-notice">
          You are not on this centre’s roster for this day. Ask the lead if your
          shift has changed.
        </div>
      )}
      {day === today &&
        (!currentSlot || teamView || onlyAttention) &&
        due.length > 0 && (
          <div className="st-check-strip">
            <strong>Your checks due</strong>
            {recordChecks}
          </div>
        )}
      <div className="st-column-head" aria-hidden="true">
        <span>Time</span>
        <span>{teamView ? "Who is responsible" : "Duty & responsibility"}</span>
        <span>Progress / action</span>
      </div>
      <ol className="st-timeline" ref={timelineRef}>
        {entries.map((entry) => {
          const active =
            day === today &&
            entry.kind !== "task" &&
            entry.start <= time &&
            (entry.end ?? 0) > time;
          if (entry.item) {
            const item = entry.item,
              state = workState(item),
              late = overdue(item, day, today, time);
            return (
              <li
                key={entry.key}
                className={`st-entry st-task is-${state}`}
                data-time={entry.start}
              >
                <div className="st-time">
                  <small>{Number.isFinite(entry.start) ? "BY" : ""}</small>
                  <time>
                    {Number.isFinite(entry.start)
                      ? clock(entry.start)
                      : "No time"}
                  </time>
                  <span className="st-dot" />
                </div>
                <details className="st-task-detail">
                  <summary>
                    <div className="st-task-title">
                      <span className="st-type">
                        {teamView ? names(item.assignee) : "Assigned work"}
                        {late ? " · overdue" : ""}
                      </span>
                      <h3>{shortDutyTitle(item.title)}</h3>
                      {state === "help" && <p>{item.note}</p>}
                    </div>
                    <span className="st-task-status">
                      <span className={`sw-state is-${state}`}>
                        {WORK_LABELS[state]}
                      </span>
                      <span className="st-open-label">
                        {state === "review" && canLead
                          ? "Review"
                          : state === "verified"
                            ? "View result"
                            : "Open duty"}
                        <ChevronDown size={15} />
                      </span>
                    </span>
                  </summary>
                  {renderDuty(item)}
                </details>
              </li>
            );
          }
          const slot = entry.slot;
          const title =
            slot?.kind === "break"
              ? "Break"
              : slot?.lanes.map((l) => laneInfo[l].title).join(" + ");
          const block =
            plan?.blocks[
              entry.block ??
                plan.blocks.findIndex(
                  (b) => b.start <= entry.start && b.end > entry.start,
                )
            ];
          return (
            <li
              key={entry.key}
              className={`st-entry st-post ${entry.kind === "break" ? "is-break" : ""} ${active ? "is-current" : ""}`}
              data-time={entry.start}
            >
              <div className="st-time">
                <time>{clock(entry.start)}</time>
                <small>to {clock(entry.end!)}</small>
                <span className="st-dot" />
              </div>
              <div className="st-post-body">
                {entry.kind === "team" && plan ? (
                  <>
                    <div className="st-lanes">
                      {LANES.map((lane) => {
                        const owner = resolvedOwner(
                          plan,
                          entry.block!,
                          lane,
                          entry.start,
                          data.changes,
                        );
                        const covering = owner !== block?.owners[lane];
                        return (
                          <div key={lane}>
                            <span>{laneInfo[lane].title}</span>
                            <strong>{names(owner)}</strong>
                            {covering && (
                              <small>
                                Cover for {names(block?.owners[lane] || null)}
                              </small>
                            )}
                            {block?.duties[lane] && (
                              <small>{block.duties[lane]}</small>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {plan.breaks
                      .filter(
                        (b) => b.start <= entry.start && b.end > entry.start,
                      )
                      .map((b) => (
                        <p className="st-break-note" key={b.staff}>
                          <Coffee size={13} />
                          {names(b.staff)} on break until {clock(b.end)}
                        </p>
                      ))}
                  </>
                ) : (
                  <div className="st-post-copy">
                    <span className="st-type">
                      {slot?.kind === "break"
                        ? "Rest"
                        : active
                          ? "Your responsibility now"
                          : "Post duty"}
                    </span>
                    <h3>
                      {slot?.kind === "break" && <Coffee size={18} />} {title}
                    </h3>
                    <p>
                      {slot?.kind === "break"
                        ? `Cover: ${slot.cover.length ? slot.cover.map(names).join(" & ") : "not assigned"}`
                        : slot?.lanes.map((l) => laneInfo[l].tasks).join(" · ")}
                    </p>
                    {slot?.lanes
                      .filter(
                        (l) =>
                          block?.owners[l] &&
                          block.owners[l] !== identity.profileId,
                      )
                      .map((l) => (
                        <p key={l} className="st-extra">
                          Cover for {names(block!.owners[l])}
                        </p>
                      ))}
                    {slot && slot.lanes.length > 1 && (
                      <p>
                        Covering multiple posts. Contact the lead if you need
                        support.
                      </p>
                    )}
                    {slot?.kind !== "break" &&
                      slot?.lanes.some((l) => block?.duties[l]) && (
                        <p className="st-extra">
                          {slot.lanes
                            .map((l) => block?.duties[l])
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                  </div>
                )}
                <div className="st-post-action">
                  {active ? (
                    <span className="st-now-label">
                      <span />
                      Now
                    </span>
                  ) : (
                    <span className="st-duration">
                      {entry.end! - entry.start} min
                    </span>
                  )}
                  {active && !teamView && recordChecks}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {!entries.length && (
        <div className="sw-empty">
          {onlyAttention
            ? "No duties need attention. Show the whole day to see the timetable."
            : "No published posts or assigned duties for this day."}
        </div>
      )}
      {plan && !onlyAttention && (
        <div className="st-end">
          <Clock3 size={15} />
          <strong>{clock(plan.blocks[plan.blocks.length - 1].end)}</strong>
          <span>Scheduled posts end</span>
        </div>
      )}
      {missed.length > 0 && (
        <details className="st-missed">
          <summary>
            {missed.length} earlier checks have no record
            <ChevronDown size={14} />
          </summary>
          <p>
            Tell the lead what happened. Past checks cannot be recorded here.
          </p>
          <div>
            {missed.map((p) => (
              <span key={`${p.block}-${p.kind}-${p.due}`}>
                {clock(p.due)} · {p.kind === "walk" ? "Lab walk" : "DVR"}
              </span>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
