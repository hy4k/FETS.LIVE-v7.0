import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { formatSeatTime } from "../seats/engine";
import { useCalendarInsights } from "./hooks";
import {
  buildCalendarInsights,
  calendarMonthRange,
  exportCalendarCsv,
  indiaToday,
} from "./model";
import type { CalendarInsightsModel, InsightDay, InsightRange } from "./types";
import "./insights.css";

export interface CalendarInsightsProps {
  onClose: () => void;
  activeBranch: string;
  initialMonth?: string;
  onOpenSeatManagement?: (date?: string) => void;
  onOpenCalendarDate?: (date: string) => void;
}

const number = new Intl.NumberFormat("en-IN");
const longDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
const shortDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
const centreLabel = (branch: string) =>
  branch === "cochin"
    ? "Kochi"
    : branch === "calicut"
    ? "Calicut"
    : "All centres";
const timeWindow = (start: number, end: number) =>
  `${formatSeatTime(start)}–${
    end % 86400 === 0 ? "24:00" : formatSeatTime(end)
  }`;
const dayLabel = (day: InsightDay) =>
  `${longDate(day.date)}: ${number.format(
    day.candidates
  )} scheduled candidates, ${number.format(day.sessionCount)} ${
    day.sessionCount === 1 ? "session" : "sessions"
  }`;

function initialRange(month?: string): InsightRange {
  try {
    return calendarMonthRange(month || indiaToday().slice(0, 7));
  } catch {
    return calendarMonthRange(indiaToday().slice(0, 7));
  }
}

function comparison(model: CalendarInsightsModel, range: InsightRange): string {
  if (!model.volume.complete || !model.previous?.complete)
    return "Comparison unavailable for incomplete booking data.";
  const current = model.volume.candidates;
  const prior = model.previous.candidates;
  if (prior === 0)
    return current === 0
      ? `No scheduled candidates in either period (${range.previousLabel}).`
      : `No scheduled candidates in ${range.previousLabel}; ${number.format(
          current
        )} in this period.`;
  const delta = Math.abs(((current - prior) / prior) * 100);
  return current === prior
    ? `Unchanged from ${range.previousLabel}.`
    : `${number.format(Math.round(delta * 10) / 10)}% ${
        current > prior ? "more" : "fewer"
      } scheduled candidates vs ${range.previousLabel}.`;
}

function Demand({
  days,
  onOpenDate,
}: {
  days: InsightDay[];
  onOpenDate?: (date: string) => void;
}) {
  const weekly = days.length > 62;
  const columns = weekly
    ? Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => {
        const group = days.slice(index * 7, index * 7 + 7);
        return {
          start: group[0].date,
          end: group[group.length - 1].date,
          candidates: group.reduce((total, day) => total + day.candidates, 0),
        };
      })
    : [];
  const maximum = Math.max(
    1,
    ...days.map((day) => day.candidates),
    ...columns.map((week) => week.candidates)
  );
  return (
    <section className="ci-panel ci-demand" aria-label="Daily demand">
      <div className="ci-section-heading">
        <div>
          <h3>Daily demand</h3>
          <p>
            Scheduled candidates across all providers. Select a date to open
            Calendar.
          </p>
        </div>
        <span className="ci-unit">Candidates</span>
      </div>
      <div
        className="ci-plot-scroll"
        tabIndex={0}
        aria-label={
          weekly
            ? "Weekly demand chart, scroll for the full period"
            : "Daily demand chart, scroll for the full period"
        }
      >
        {weekly ? (
          <>
            <p className="ci-plot-caption">
              Weekly totals · each bar covers the dates shown
            </p>
            <ol
              className="ci-plot ci-weekly"
              aria-label="Weekly scheduled candidates"
              style={{ "--ci-columns": columns.length } as React.CSSProperties}
            >
              {columns.map((week) => (
                <li
                  key={week.start}
                  aria-label={`${longDate(week.start)} to ${longDate(
                    week.end
                  )}: ${number.format(week.candidates)} scheduled candidates`}
                >
                  <span className="ci-bar-track">
                    <span
                      className="ci-bar"
                      style={{
                        height: `${(week.candidates / maximum) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="ci-tick">
                    {shortDate(week.start)}
                    <br />
                    {shortDate(week.end)}
                  </span>
                  <span className="ci-week-value">
                    {number.format(week.candidates)}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div
            className="ci-plot"
            style={{ "--ci-columns": days.length } as React.CSSProperties}
          >
            {days.map((day, index) => (
              <button
                type="button"
                className={`ci-day ci-day-${day.status}`}
                key={day.date}
                aria-label={dayLabel(day)}
                title={`${dayLabel(day)}${
                  day.status === "overbooked" || day.status === "full"
                    ? ` · ${day.status} window detected`
                    : ""
                }`}
                onClick={() => onOpenDate?.(day.date)}
                disabled={!onOpenDate}
              >
                <span className="ci-bar-track" aria-hidden="true">
                  <span
                    className="ci-bar"
                    style={{ height: `${(day.candidates / maximum) * 100}%` }}
                  />
                </span>
                <span className="ci-tick" aria-hidden="true">
                  {index % 7 === 0 || index === days.length - 1
                    ? shortDate(day.date)
                    : day.date.slice(-2)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="ci-plot-note">
        {weekly
          ? "Open daily booking values below to inspect or select any date."
          : "The full period includes days with no recorded bookings."}{" "}
        Blank days do not establish seat availability.
      </p>
      {weekly && (
        <div role="group" aria-label="Daily booking values">
          <details className="ci-daily-values">
            <summary>
              Daily booking values <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="ci-daily-list">
              {days.map((day) => (
                <button
                  type="button"
                  key={day.date}
                  onClick={() => onOpenDate?.(day.date)}
                  disabled={!onOpenDate}
                  aria-label={dayLabel(day)}
                >
                  <span>{longDate(day.date)}</span>
                  <strong>{number.format(day.candidates)}</strong>
                  <span>{day.sessionCount} sessions</span>
                </button>
              ))}
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

export function CalendarInsights({
  onClose,
  activeBranch,
  initialMonth,
  onOpenSeatManagement,
  onOpenCalendarDate,
}: CalendarInsightsProps) {
  const { user } = useAuth();
  const client = useQueryClient();
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [range, setRange] = useState(() => initialRange(initialMonth));
  const [mode, setMode] = useState<"month" | "range">("month");
  const [fromMonth, setFromMonth] = useState(range.startMonth);
  const [throughMonth, setThroughMonth] = useState(range.endMonth);
  const [rangeError, setRangeError] = useState("");
  const [exportError, setExportError] = useState("");
  const [refreshScope, setRefreshScope] = useState<string | null>(null);
  const [expandedAttention, setExpandedAttention] = useState(false);
  const branch = activeBranch || "global";
  const today = indiaToday();
  const scope = `${user?.id || ""}|${branch}|${range.from}|${range.through}`;
  const query = useCalendarInsights(range, branch);
  const data = user ? query.data : undefined;
  const model = useMemo(
    () =>
      data ? buildCalendarInsights({ ...data, range, branch, today }) : null,
    [data, range, branch, today]
  );
  const refreshing = !!data && (query.isFetching || refreshScope === scope);
  const exportable =
    !!data && !query.isFetching && refreshScope !== scope && !query.isError;
  const verified = !!model?.capacityAvailable && !refreshing && !query.isError;
  const knownIncomplete =
    model?.days.some(
      (day) => day.status === "incomplete" || day.status === "unavailable"
    ) || model?.centres.some((centre) => centre.incompleteDays > 0);
  const currentComplete = model?.volume.complete;
  const visibleAttention = expandedAttention
    ? model?.attention
    : model?.attention.slice(0, 6);

  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const documentClass = "fets-calendar-insights-open";
    const alreadyOpen =
      document.documentElement.classList.contains(documentClass);
    document.documentElement.classList.add(documentClass);
    document.body.style.overflow = "hidden";
    back.current?.focus({ preventScroll: true });
    const focusables = () =>
      Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], summary, [tabindex="0"]'
        ) || []
      ).filter(
        (element) =>
          !element.closest("details:not([open])") ||
          element.tagName === "SUMMARY"
      );
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key !== "Tab") return;
      const elements = focusables();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !root.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !root.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        back.current?.focus();
    };
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("focusin", containFocus);
      document.body.style.overflow = previousOverflow;
      if (!alreadyOpen)
        document.documentElement.classList.remove(documentClass);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    setExpandedAttention(false);
    setExportError("");
  }, [scope]);

  const applyPeriod = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "range" && throughMonth < fromMonth) {
      setRangeError("Through month must be on or after the start month.");
      return;
    }
    try {
      const next = calendarMonthRange(
        fromMonth,
        mode === "range" ? throughMonth : fromMonth
      );
      setRange(next);
      setRangeError("");
    } catch (error) {
      setRangeError(
        error instanceof Error
          ? error.message
          : "Choose a valid range of up to 12 calendar months."
      );
    }
  };

  const refresh = async () => {
    setRefreshScope(scope);
    setExportError("");
    try {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["sessions", "calendar"] }),
        client.invalidateQueries({ queryKey: ["seat-context"] }),
        client.invalidateQueries({ queryKey: ["calendar-insights"] }),
      ]);
    } finally {
      setRefreshScope((value) => (value === scope ? null : value));
    }
  };

  const download = () => {
    if (!exportable || !data) return;
    try {
      const blob = new Blob(
        ["\uFEFF", exportCalendarCsv(data.sessions, range)],
        { type: "text/csv;charset=utf-8;" }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `calendar-bookings-${branch}-${range.from}-to-${range.through}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      const revoke = URL.revokeObjectURL.bind(URL);
      setTimeout(() => revoke(url), 1000);
    } catch {
      setExportError(
        "CSV could not be downloaded. Try again after refreshing."
      );
    }
  };

  return createPortal(
    <div
      ref={root}
      className="fets-calendar-insights"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="ci-workspace">
        <header className="ci-header">
          <div className="ci-header-start">
            <button
              type="button"
              ref={back}
              className="ci-back"
              onClick={onClose}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Back to Calendar
            </button>
            <div>
              <h1 id={titleId}>Calendar analytics</h1>
              <p>
                {centreLabel(branch)} <span aria-hidden="true">/</span> All
                providers <span aria-hidden="true">/</span> India time
              </p>
            </div>
          </div>
          <div className="ci-actions">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={query.isFetching || refreshScope === scope || !user}
              aria-label="Refresh analytics"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              className="ci-primary"
              onClick={download}
              disabled={!exportable}
            >
              <Download size={16} aria-hidden="true" />
              Download CSV
            </button>
          </div>
        </header>

        <div className="ci-period-row">
          <div>
            <h2>{range.label}</h2>
            <p>Calendar bookings and concurrent seat pressure</p>
          </div>
          <form
            className="ci-period-controls"
            onSubmit={applyPeriod}
            noValidate
          >
            <label>
              Report period
              <select
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as "month" | "range");
                  setRangeError("");
                }}
              >
                <option value="month">Month</option>
                <option value="range">Month range</option>
              </select>
            </label>
            <label>
              {mode === "month" ? "Month" : "From month"}
              <input
                type="month"
                value={fromMonth}
                onChange={(event) => setFromMonth(event.target.value)}
                required
              />
            </label>
            {mode === "range" && (
              <label>
                Through month
                <input
                  type="month"
                  value={throughMonth}
                  onChange={(event) => setThroughMonth(event.target.value)}
                  required
                />
              </label>
            )}
            <button type="submit">Apply period</button>
          </form>
        </div>
        {rangeError && (
          <p className="ci-message ci-message-warning" role="alert">
            {rangeError}
          </p>
        )}
        {exportError && (
          <p className="ci-message ci-message-warning" role="alert">
            {exportError}
          </p>
        )}
        {!user ? (
          <p className="ci-message" role="status">
            Sign in to view Calendar analytics.
          </p>
        ) : !data ? (
          query.isError ? (
            <div className="ci-state" role="alert">
              <AlertTriangle size={24} aria-hidden="true" />
              <h3>Unable to load Calendar bookings</h3>
              <p>
                {query.error?.message ||
                  "Calendar data is unavailable. Refresh to try again."}
              </p>
              <button type="button" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          ) : (
            <div className="ci-state" role="status">
              <span className="ci-loading-mark" aria-hidden="true" />
              <h3>Loading Calendar bookings</h3>
              <p>Reading the selected period, prior period and seat details.</p>
            </div>
          )
        ) : (
          model && (
            <>
              {refreshing && (
                <p className="ci-message" role="status">
                  Refreshing bookings and seat checks. Figures below are from
                  the last completed read; CSV download is paused.
                </p>
              )}
              {query.isError && (
                <p className="ci-message ci-message-warning" role="alert">
                  Refresh failed. Last loaded bookings remain visible; seat
                  verification and CSV download are unavailable.{" "}
                  {query.error?.message}
                </p>
              )}
              {!currentComplete && (
                <p className="ci-message ci-message-warning" role="status">
                  Known booking totals only. Some candidate counts or records
                  need review; the figures below are incomplete.
                </p>
              )}

              <section className="ci-ledger" aria-label="Scheduled volume">
                <dl>
                  {[
                    [
                      "Scheduled candidates",
                      model.volume.candidates,
                      currentComplete
                        ? "Calendar bookings"
                        : "Known valid counts",
                    ],
                    [
                      "Exam sessions",
                      model.volume.sessionCount,
                      "Recorded sessions",
                    ],
                    [
                      "Booked days",
                      model.volume.bookedDays,
                      `In ${range.label}`,
                    ],
                    [
                      "Upcoming candidates",
                      model.volume.upcomingCandidates,
                      `On or after ${shortDate(indiaToday())} (IST)`,
                    ],
                  ].map(([label, value, note]) => (
                    <div
                      key={String(label)}
                      role="group"
                      aria-label={String(label)}
                    >
                      <dt>{label}</dt>
                      <dd>{number.format(Number(value))}</dd>
                      <span>{note}</span>
                    </div>
                  ))}
                </dl>
                <p className="ci-comparison">
                  {data.previousError
                    ? "Comparison unavailable: the prior period could not be read."
                    : comparison(model, range)}
                  <span>
                    Comparison uses bookings currently recorded for each period.
                  </span>
                </p>
              </section>

              <div className="ci-main-grid">
                <section
                  className="ci-panel ci-attention"
                  aria-label="Needs attention"
                >
                  <div className="ci-section-heading">
                    <div>
                      <h3>Needs attention</h3>
                      <p>All providers, exact seat windows</p>
                    </div>
                    {model.attention.length > 0 && (
                      <span className="ci-count">
                        {number.format(model.attention.length)}
                      </span>
                    )}
                  </div>
                  {(!model.capacityAvailable || data.seatError) && (
                    <p className="ci-inline-warning" role="status">
                      Seat verification unavailable. Known booking issues may be
                      shown, but unverified dates cannot be confirmed safe.
                    </p>
                  )}
                  {refreshing && (
                    <p className="ci-inline-warning">
                      Rechecking seat details. Previously detected issues remain
                      below.
                    </p>
                  )}
                  {knownIncomplete && model.capacityAvailable && (
                    <p className="ci-inline-warning">
                      Some dates have incomplete scheduling details. Known
                      issues remain visible; other dates may need review.
                    </p>
                  )}
                  {model.attention.length > 0 ? (
                    <ul className="ci-attention-list">
                      {visibleAttention?.map((item) => (
                        <li
                          key={item.id}
                          className={`ci-issue ci-issue-${item.kind}`}
                        >
                          <div className="ci-issue-heading">
                            <span className="ci-issue-kind">
                              {item.kind === "overbooked"
                                ? "Overbooked"
                                : item.kind === "full"
                                ? "Full window"
                                : "Details incomplete"}
                            </span>
                            <span>{centreLabel(item.branch)}</span>
                          </div>
                          <p className="ci-issue-date">
                            {longDate(item.date)}
                            {item.start !== null && item.end !== null && (
                              <strong>
                                {timeWindow(item.start, item.end)}
                              </strong>
                            )}
                          </p>
                          {item.booked !== null && item.capacity !== null && (
                            <p className="ci-seat-pair">
                              <strong>
                                {number.format(item.booked)} /{" "}
                                {number.format(item.capacity)}
                              </strong>{" "}
                              simultaneous seats
                              {item.excess !== null && item.excess > 0 && (
                                <span>
                                  {number.format(item.excess)} over capacity
                                </span>
                              )}
                            </p>
                          )}
                          <p>{item.detail}</p>
                          {onOpenSeatManagement && (
                            <button
                              type="button"
                              className="ci-text-button"
                              aria-label={`Review ${centreLabel(
                                item.branch
                              )}, ${longDate(item.date)}${
                                item.start !== null && item.end !== null
                                  ? `, ${timeWindow(item.start, item.end)}`
                                  : ""
                              } in Seat management`}
                              onClick={() => onOpenSeatManagement(item.date)}
                            >
                              Review in Seat management
                              <ArrowUpRight size={15} aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="ci-attention-empty">
                      <p>
                        {verified && !knownIncomplete
                          ? "No known full or overbooked windows."
                          : "Seat conclusions are unavailable until checks are complete."}
                      </p>
                      <p>
                        {verified && !knownIncomplete
                          ? "This reflects the loaded booking times and confirmed capacity. Check Seat management before accepting a new booking."
                          : "Refresh or open Seat management to review missing scheduling details."}
                      </p>
                    </div>
                  )}
                  {model.attention.length > 6 && (
                    <button
                      className="ci-expand"
                      type="button"
                      onClick={() => setExpandedAttention((value) => !value)}
                    >
                      {expandedAttention
                        ? "Show fewer issues"
                        : `Show all ${number.format(
                            model.attention.length
                          )} issues`}
                    </button>
                  )}
                </section>
                <div className="ci-demand-column">
                  <Demand days={model.days} onOpenDate={onOpenCalendarDate} />
                  <div className="ci-planning-note">
                    <h3>Dates to plan around</h3>
                    {model.days.some((day) => day.candidates > 0) ? (
                      <ol>
                        {[...model.days]
                          .filter((day) => day.candidates > 0)
                          .sort(
                            (a, b) =>
                              b.candidates - a.candidates ||
                              a.date.localeCompare(b.date)
                          )
                          .slice(0, 3)
                          .map((day) => (
                            <li key={day.date}>
                              <button
                                type="button"
                                onClick={() => onOpenCalendarDate?.(day.date)}
                                disabled={!onOpenCalendarDate}
                              >
                                <span>
                                  {shortDate(day.date)}
                                  {day.date >= indiaToday() && (
                                    <small>Upcoming</small>
                                  )}
                                </span>
                                <strong>
                                  {number.format(day.candidates)}{" "}
                                  <small>candidates</small>
                                </strong>
                              </button>
                            </li>
                          ))}
                      </ol>
                    ) : (
                      <p>No bookings recorded in this period.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="ci-detail-grid">
                <section
                  className="ci-panel ci-providers"
                  aria-label="Provider mix"
                >
                  <div className="ci-section-heading">
                    <div>
                      <h3>Provider mix</h3>
                      <p>Scheduled volume, with provider names as recorded</p>
                    </div>
                  </div>
                  {model.providers.length > 0 ? (
                    <>
                      <div className="ci-provider-strip" aria-hidden="true">
                        {model.providers
                          .filter((provider) => provider.candidates > 0)
                          .map((provider) => (
                            <span
                              key={provider.name}
                              className={`ci-provider-${
                                provider.name === "PEARSON VUE"
                                  ? "pearson"
                                  : provider.name === "PROMETRIC"
                                  ? "prometric"
                                  : "other"
                              }`}
                              style={{ flexGrow: provider.candidates }}
                            />
                          ))}
                      </div>
                      <div className="ci-table-scroll">
                        <table>
                          <caption className="ci-sr-only">
                            Provider bookings in {range.label}; prior bookings
                            in {range.previousLabel}
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Provider</th>
                              <th scope="col">Candidates</th>
                              <th scope="col">Sessions</th>
                              <th scope="col">Prior period</th>
                            </tr>
                          </thead>
                          <tbody>
                            {model.providers.map((provider) => (
                              <tr key={provider.name}>
                                <th scope="row">
                                  <span
                                    className={`ci-provider-dot ci-provider-${
                                      provider.name === "PEARSON VUE"
                                        ? "pearson"
                                        : provider.name === "PROMETRIC"
                                        ? "prometric"
                                        : "other"
                                    }`}
                                  />
                                  {provider.name}
                                </th>
                                <td>{number.format(provider.candidates)}</td>
                                <td>{number.format(provider.sessionCount)}</td>
                                <td>
                                  {model.volume.complete &&
                                  model.previous?.complete &&
                                  provider.previousCandidates !== null ? (
                                    number.format(provider.previousCandidates)
                                  ) : (
                                    <span aria-label="Prior period unavailable">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="ci-panel-empty">
                      No provider bookings recorded in this period.
                    </p>
                  )}
                </section>
                <section
                  className="ci-panel ci-centres"
                  aria-label="Centre workload"
                >
                  <div className="ci-section-heading">
                    <div>
                      <h3>Centre workload</h3>
                      <p>Each centre has its own seat capacity</p>
                    </div>
                  </div>
                  <div className="ci-centre-list">
                    {model.centres.map((centre) => (
                      <article
                        key={centre.branch}
                        aria-label={`${centre.label} workload`}
                      >
                        <div className="ci-centre-heading">
                          <h4>{centre.label}</h4>
                          <p>
                            <strong>{number.format(centre.candidates)}</strong>{" "}
                            candidates <span>/</span>{" "}
                            {number.format(centre.sessionCount)} sessions
                          </p>
                        </div>
                        {centre.critical && model.capacityAvailable ? (
                          <div className="ci-critical">
                            <p>
                              {verified
                                ? "Critical simultaneous load"
                                : "Last loaded simultaneous load"}
                            </p>
                            <strong>
                              {number.format(centre.critical.booked)} /{" "}
                              {number.format(centre.critical.capacity)}{" "}
                              <span>seats</span>
                            </strong>
                            <p>
                              {longDate(centre.critical.date)} <span>·</span>{" "}
                              {timeWindow(
                                centre.critical.start,
                                centre.critical.end
                              )}
                            </p>
                          </div>
                        ) : (
                          <p className="ci-centre-unavailable">
                            {model.capacityAvailable
                              ? "No simultaneous seat load recorded."
                              : "Seat verification unavailable."}
                          </p>
                        )}
                        <dl className="ci-centre-days">
                          <div>
                            <dt>Overbooked days</dt>
                            <dd>
                              {model.capacityAvailable
                                ? centre.overbookedDays
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt>Full days</dt>
                            <dd>
                              {model.capacityAvailable ? centre.fullDays : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt>Unverified days</dt>
                            <dd>{centre.incompleteDays}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <details className="ci-about">
                <summary>
                  About these figures{" "}
                  <ChevronDown size={17} aria-hidden="true" />
                </summary>
                <div>
                  <p>
                    Candidate totals are Calendar bookings, not unique people or
                    attendance. Exam sessions count recorded non-cancelled rows;
                    booked days count dates with those rows. Cancelled records
                    are excluded. Invalid candidate counts are excluded from
                    candidate totals and reported as incomplete.
                  </p>
                  <p>
                    Upcoming candidates are scheduled on or after today in
                    Asia/Kolkata. Prior-period comparisons use the preceding
                    equal number of calendar months and the bookings currently
                    recorded there.
                  </p>
                  <p>
                    Seat pressure uses simultaneous bookings, source scheduling
                    details, overnight carry-in and confirmed extra systems.
                    Daily candidate totals measure volume and do not measure
                    concurrent seat use. Unassigned centres are not included in
                    either centre's seat pool.
                  </p>
                  {model.qualityNotes.length > 0 && (
                    <ul>
                      {model.qualityNotes.map((note, index) => (
                        <li key={`${index}-${note}`}>{note}</li>
                      ))}
                    </ul>
                  )}
                  <p>
                    CSV includes the current period's non-cancelled Calendar
                    rows, including explicit unknown or invalid values. Provider
                    names are grouped only by recognised aliases.
                  </p>
                </div>
              </details>
            </>
          )
        )}
      </div>
    </div>,
    document.body
  );
}

export default CalendarInsights;
