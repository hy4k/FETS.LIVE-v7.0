import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, RefreshCw } from "lucide-react";
import {
  duration,
  formatTime,
  monthDays,
  shiftName,
  timing,
} from "../roster-workspace/model";
import { indiaDay } from "./model";
import { timeInsights, type TimeData } from "./time-model";
import { timeRepository, type TimeRepository } from "./time-repository";
import "./time.css";
const shortDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
const clock = (n: number | null) =>
  n === null
    ? "Not enough records"
    : formatTime(
        `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`,
      );
export default function MyTime({
  profileId,
  repository = timeRepository,
}: {
  profileId?: string;
  repository?: TimeRepository;
}) {
  const [now, setNow] = useState(() => new Date()),
    [month, setMonth] = useState(() => indiaDay().slice(0, 7)),
    [selected, setSelected] = useState(() => indiaDay()),
    [data, setData] = useState<TimeData | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const dates = useMemo(() => monthDays(month), [month]);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    setLoading(true);
    if (!profileId) {
      setLoading(false);
      return;
    }
    repository
      .load(profileId, dates[0], dates[dates.length - 1])
      .then(
        (value) => {
          if (alive) {
            setData(value);
            setNow(new Date());
          }
        },
        (e) => {
          if (alive) setError(e.message || "Could not load your time records.");
        },
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [profileId, repository, month, revision]);
  useEffect(() => {
    const changed = () => setRevision((n) => n + 1);
    const visible = () => {
      if (!document.hidden) changed();
    };
    const events = [
      "fets-attendance-changed",
      "fets-applications-changed",
      "fets-roster-changed",
      "fets-data-loaded",
    ];
    events.forEach((e) => window.addEventListener(e, changed));
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(changed, 60000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, changed));
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, []);
  const report =
    data && profileId
      ? timeInsights(data, profileId, dates[0], dates[dates.length - 1], now)
      : null;
  const day =
    report?.days.find((d) => d.date === selected) ||
    report?.days.find((d) => d.date === indiaDay()) ||
    report?.days[0];
  const max = report
    ? Math.max(60, ...report.weeks.flatMap((w) => [w.assigned, w.worked]))
    : 60;
  const offset = (new Date(dates[0] + "T12:00:00Z").getUTCDay() + 6) % 7;
  return (
    <section className="mt-workspace" aria-label="My time analysis">
      <header className="mt-heading">
        <div>
          <span className="pd-eyebrow">MY TIME</span>
          <h2>Work & time off</h2>
          <p>Your saved roster and attendance, in one view.</p>
        </div>
        <div className="mt-period">
          <label>
            Month
            <input
              aria-label="Analysis month"
              type="month"
              value={month}
              max={indiaDay().slice(0, 7)}
              onChange={(e) => {
                const m = e.target.value;
                if (
                  /^\d{4}-(0[1-9]|1[0-2])$/.test(m) &&
                  m <= indiaDay().slice(0, 7)
                ) {
                  setMonth(m);
                  setSelected(m + "-01");
                }
              }}
            />
          </label>
          <button
            aria-label="Refresh time records"
            disabled={loading || !profileId}
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
      {!profileId ? (
        <p className="mt-message" role="status">
          Your staff record is still loading. Refresh My Desk if it does not
          appear.
        </p>
      ) : loading ? (
        <p className="mt-message" role="status">
          Loading your time records…
        </p>
      ) : error ? (
        <div className="mt-message mt-error" role="alert">
          {error}
          <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      ) : (
        report && (
          <>
            <div className="mt-stat-grid">
              {[
                [
                  "Recorded work",
                  duration(report.worked),
                  `${report.completeDays} completed attendance ${report.completeDays === 1 ? "record" : "records"} · recorded breaks deducted`,
                  "work",
                ],
                [
                  "Outside roster",
                  duration(report.outside),
                  report.outsideUnknown
                    ? `${report.outsideUnknown} records cannot be assessed`
                    : "Recorded time beyond assigned hours · not automatic OT",
                  "outside",
                ],
                [
                  "Rostered days off",
                  String(report.offDays),
                  "Elapsed days marked rest, leave, TOIL leave or holiday",
                  "off",
                ],
                [
                  "Days to review",
                  String(report.review),
                  "Missing or conflicting times · not an absence count",
                  "review",
                ],
              ].map(([label, value, note, tone]) => (
                <article className={`mt-stat mt-${tone}`} key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{note}</small>
                </article>
              ))}
            </div>
            {!report.days.some((d) => d.s || d.a) && (
              <p className="mt-live-note" role="status">
                No saved roster or attendance in this month. Choose another
                month to review your records.
              </p>
            )}
            {report.active > 0 && (
              <p className="mt-live-note">
                <Clock3 size={14} />
                Today’s shift is in progress. Its running hours are excluded
                from completed totals.
              </p>
            )}
            <div className="mt-overview">
              <section className="mt-panel">
                <header>
                  <h3>Weekly hours</h3>
                  <span>
                    Through{" "}
                    {shortDate(
                      report.today < dates[dates.length - 1]
                        ? report.today
                        : dates[dates.length - 1],
                    )}
                  </span>
                </header>
                <div className="mt-legend">
                  <span>
                    <i className="mt-assigned" />
                    Assigned hours
                  </span>
                  <span>
                    <i className="mt-recorded" />
                    Completed net work
                  </span>
                </div>
                {report.weeks.map((w) => (
                  <div className="mt-week" key={w.from}>
                    <div>
                      <span>
                        {shortDate(w.from)} – {shortDate(w.to)}
                      </span>
                      <small>
                        {w.missingDays
                          ? `${w.missingDays} days to review`
                          : `${w.recordedDays} completed days`}
                      </small>
                    </div>
                    <div
                      className="mt-bars"
                      aria-label={`${shortDate(w.from)}: assigned ${duration(w.assignedKnownDays ? w.assigned : null)}, completed work ${duration(w.recordedDays ? w.worked : null)}`}
                    >
                      <div>
                        <i
                          className="mt-assigned"
                          style={{ width: `${(w.assigned / max) * 100}%` }}
                        />
                        <span>
                          {duration(w.assignedKnownDays ? w.assigned : null)}
                        </span>
                      </div>
                      <div>
                        <i
                          className="mt-recorded"
                          style={{ width: `${(w.worked / max) * 100}%` }}
                        />
                        <span>
                          {duration(w.recordedDays ? w.worked : null)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                <p className="mt-caption">
                  Assigned hours include elapsed roster days. Completed work
                  excludes unfinished or invalid records; a difference is not a
                  performance score.
                </p>
              </section>
              <section className="mt-panel mt-rhythm">
                <header>
                  <h3>Work rhythm</h3>
                  <CalendarDays size={18} />
                </header>
                <dl>
                  <div>
                    <dt>Typical check-out</dt>
                    <dd>{clock(report.medianEnd)}</dd>
                    <small>Median of completed records</small>
                  </div>
                  <div>
                    <dt>Longest run of recorded workdays</dt>
                    <dd>
                      {report.longestStreak === null
                        ? "Not enough records"
                        : `${report.longestStreak} ${report.longestStreak === 1 ? "day" : "days"}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Shortest gap between recorded shifts</dt>
                    <dd>
                      {report.shortestGap === null
                        ? "Not enough records"
                        : duration(report.shortestGap)}
                    </dd>
                  </div>
                  <div>
                    <dt>Next rostered day off in this month</dt>
                    <dd>
                      {report.nextOff
                        ? shortDate(report.nextOff)
                        : "None recorded"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-caption">
                  Gaps are time between attendance records, not a measure of
                  sleep or leisure. Days with no saved roster are not counted as
                  days off.
                </p>
              </section>
            </div>
            <section className="mt-panel">
              <header>
                <div>
                  <h3>Day by day</h3>
                  <p className="mt-caption">Select a day to see its timings.</p>
                </div>
                <span className="mt-month-name">
                  {new Date(month + "-01T12:00:00Z").toLocaleDateString(
                    "en-IN",
                    {
                      month: "long",
                      year: "numeric",
                      timeZone: "Asia/Kolkata",
                    },
                  )}
                </span>
              </header>
              <div className="mt-days-layout">
                <div>
                  <div className="mt-weekdays">
                    {["M", "T", "W", "T", "F", "S", "S"].map((v, i) => (
                      <span key={i}>{v}</span>
                    ))}
                  </div>
                  <div className="mt-calendar">
                    {Array.from({ length: offset }, (_, i) => (
                      <span key={"blank" + i} />
                    ))}
                    {report.days.map((d) => (
                      <button
                        key={d.date}
                        className={"mt-day mt-day-" + d.state}
                        aria-pressed={day?.date === d.date}
                        aria-label={`${shortDate(d.date)}: ${d.issue || (d.future ? "Upcoming" : d.complete ? "Completed work" : d.m.active ? "In progress" : d.off ? "Rostered day off" : "No completed record")}`}
                        onClick={() => setSelected(d.date)}
                      >
                        <strong>{Number(d.date.slice(-2))}</strong>
                        <small>{d.s?.shift_code || "—"}</small>
                      </button>
                    ))}
                  </div>
                  <div className="mt-legend mt-day-legend">
                    <span>
                      <i className="mt-recorded" />
                      Recorded work
                    </span>
                    <span>
                      <i className="mt-off-key" />
                      Day off
                    </span>
                    <span>
                      <i className="mt-review-key" />
                      Review
                    </span>
                    <span>
                      <i className="mt-unknown-key" />
                      No complete record
                    </span>
                  </div>
                </div>
                {day && (
                  <aside
                    className="mt-day-detail"
                    aria-label="Selected day details"
                  >
                    <span className="pd-eyebrow">{shortDate(day.date)}</span>
                    <h4>{day.issue || day.m.status}</h4>
                    <dl>
                      <div>
                        <dt>Assigned shift</dt>
                        <dd>
                          {day.s ? shiftName(day.s) : "No roster saved"}
                          {day.s && <small>{timing(day.s)}</small>}
                        </dd>
                      </div>
                      <div>
                        <dt>Check-in / check-out</dt>
                        <dd>
                          {formatTime(day.a?.check_in)} /{" "}
                          {formatTime(day.a?.check_out)}
                        </dd>
                      </div>
                      <div>
                        <dt>Recorded breaks</dt>
                        <dd>
                          {day.a && !day.issue ? duration(day.m.breaks) : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Completed net work</dt>
                        <dd>{day.complete ? duration(day.m.worked) : "—"}</dd>
                      </div>
                      <div>
                        <dt>Outside assigned hours</dt>
                        <dd>{day.complete ? duration(day.m.outside) : "—"}</dd>
                      </div>
                      <div>
                        <dt>Approved OT on roster</dt>
                        <dd>
                          {day.s
                            ? duration(
                                Math.round(
                                  Number(day.s.overtime_hours || 0) * 60,
                                ),
                              )
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    {day.m.present && !day.m.timed && (
                      <p className="mt-caption">
                        No assessable shift timing. Outside-roster time is not
                        calculated.
                      </p>
                    )}
                  </aside>
                )}
              </div>
            </section>
            <p className="mt-source-note">
              India time · Normal untimed Day shifts use 8 AM–5 PM; custom
              shifts use their saved hours.{" "}
              {report.unassigned > 0
                ? `${report.unassigned} elapsed days have no roster or attendance. `
                : ""}
              {report.untimed > 0
                ? `${report.untimed} work shifts have no assessable timings. `
                : ""}
              This view does not change your records.
            </p>
          </>
        )
      )}
    </section>
  );
}
