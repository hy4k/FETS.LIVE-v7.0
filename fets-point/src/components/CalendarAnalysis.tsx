import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { PlanningDialog } from "./PlanningDialog";
import {
  analyseCalendar,
  csvCell,
  type PlanningSession,
} from "./calendar-planning";
const monthDate = (d: Date, last = false) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${last ? new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() : "01"}`;
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const time = (m: number | null) =>
  m === null
    ? "—"
    : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;
export function CalendarAnalysis({
  onClose,
  activeBranch,
  initialMonth = new Date(),
  onOpenDay,
}: {
  onClose: () => void;
  activeBranch: string;
  initialMonth?: Date;
  onOpenDay?: (date: string) => void;
}) {
  const [from, setFrom] = useState(() => monthDate(initialMonth)),
    [to, setTo] = useState(() => monthDate(initialMonth, true));
  const [rows, setRows] = useState<PlanningSession[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [tab, setTab] = useState("days");
  const seq = useRef(0);
  useEffect(() => {
    const request = ++seq.current;
    setLoading(true);
    setError("");
    (async () => {
      try {
        if (!from || !to || from > to)
          throw Error("Choose a valid date range.");
        const all: PlanningSession[] = [];
        for (let n = 0; ; n += 1000) {
          let q = supabase
            .from("calendar_sessions")
            .select("*")
            .gte("date", from)
            .lte("date", to)
            .order("date")
            .order("start_time")
            .order("id");
          if (activeBranch && activeBranch !== "global")
            q =
              activeBranch === "calicut"
                ? q.or("branch_location.eq.calicut,branch_location.is.null")
                : q.eq("branch_location", activeBranch);
          const { data, error } = await q.range(n, n + 999);
          if (error) throw error;
          if (request !== seq.current) return;
          all.push(...(data || []));
          if ((data || []).length < 1000) break;
        }
        setRows(all);
      } catch (e) {
        if (request === seq.current) {
          setRows([]);
          setError(
            e instanceof Error
              ? e.message
              : "Could not load sessions. Please retry.",
          );
        }
      } finally {
        if (request === seq.current) setLoading(false);
      }
    })();
    return () => {
      seq.current++;
    };
  }, [from, to, activeBranch, retry]);
  const a = useMemo(() => analyseCalendar(rows), [rows]);
  const attention = a.days.filter(
    (d) => d.missing.length || d.overCapacity || d.capacity === null,
  );
  const exportCSV = () => {
    const data = [
      [
        "Date",
        "Centre",
        "Sessions",
        "Scheduled candidates",
        "Known peak seats",
        "Capacity",
        "Missing timings",
      ],
      ...a.days.map((d) => [
        d.date,
        d.centre,
        d.rows.length,
        d.candidates,
        d.peakTime === null ? "Unknown" : d.peak,
        d.capacity ?? "Not configured",
        d.missing.length,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + data.map((r) => r.map(csvCell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const el = document.createElement("a");
    el.href = url;
    el.download = `calendar-planning-${from}-${to}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  };
  return (
    <PlanningDialog title="Calendar Analysis" onClose={onClose}>
      <div className="pw-toolbar">
        <label>
          From
          <input
            aria-label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            aria-label="To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button onClick={() => setRetry((n) => n + 1)} disabled={loading}>
          Refresh
        </button>
        <button
          onClick={exportCSV}
          disabled={loading || !!error || !rows.length}
        >
          Download summary
        </button>
        <span className="pw-muted">
          {activeBranch === "global"
            ? "All centres"
            : label(activeBranch || "calicut")}{" "}
          · IST
        </span>
      </div>
      {loading ? (
        <p role="status">Loading calendar sessions…</p>
      ) : error ? (
        <div role="alert" className="pw-error">
          {error}{" "}
          <button onClick={() => setRetry((n) => n + 1)}>Retry analysis</button>
        </div>
      ) : (
        <>
          <div className="pw-metrics">
            {[
              [a.candidates, "Scheduled candidates"],
              [a.sessions.length, "Sessions"],
              [a.days.length, "Days with sessions"],
              [attention.length, "Days to review"],
            ].map(([v, l]) => (
              <div className="pw-metric" key={l}>
                <span>{l}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <p className="pw-muted">
            Planned workload from Calendar, not attendance or candidates who
            actually appeared. Cancelled sessions excluded ({a.cancelled}). Peak
            seats count simultaneous candidates using recorded times, separately
            for each centre.
          </p>
          {a.missing.length > 0 && (
            <div className="pw-warn" role="status">
              <strong>
                {a.missing.length} session{a.missing.length === 1 ? "" : "s"}{" "}
                with incomplete timing
              </strong>
              <br />
              These candidates remain in totals. Their seat demand cannot be
              assessed until start and end times are recorded.
            </div>
          )}
          <div className="pw-tabs">
            {[
              ["days", "Daily workload"],
              ["attention", "Needs attention"],
              ["clients", "Clients & programmes"],
            ].map(([id, t]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "days" && (
            <section className="pw-panel">
              <h2>Daily workload</h2>
              {!a.days.length ? (
                <p className="pw-empty">No sessions in this period.</p>
              ) : (
                <div className="pw-table-wrap">
                  <table className="pw-table">
                    <thead>
                      <tr>
                        {[
                          "Date / centre",
                          "Sessions",
                          "Candidates",
                          "Known peak / capacity",
                          "Review",
                          "",
                        ].map((h, i) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {a.days.map((d) => (
                        <tr key={d.date + d.centre}>
                          <td>
                            <strong>{d.date}</strong>
                            <br />
                            {label(d.centre)}
                          </td>
                          <td>{d.rows.length}</td>
                          <td>{d.candidates}</td>
                          <td>
                            {d.peakTime === null
                              ? "Unknown"
                              : `${d.peak} / ${d.capacity ?? "Not configured"}`}
                            <br />
                            <small>
                              {d.peakTime !== null
                                ? `at ${time(d.peakTime)} IST`
                                : ""}
                              {d.missing.length ? " · Partial timing" : ""}
                            </small>
                          </td>
                          <td>
                            <span className="pw-tag">
                              {d.overCapacity
                                ? "Over capacity"
                                : d.missing.length
                                  ? "Timing incomplete"
                                  : d.capacity === null
                                    ? "Set capacity"
                                    : "Within recorded capacity"}
                            </span>
                          </td>
                          <td>
                            {onOpenDay && (
                              <button onClick={() => onOpenDay(d.date)}>
                                Open day
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          {tab === "attention" && (
            <section className="pw-panel">
              <h2>Needs attention</h2>
              {!attention.length ? (
                <p className="pw-empty">
                  No timing or capacity issues found in the recorded sessions.
                </p>
              ) : (
                <ul className="pw-list">
                  {attention.map((d) => (
                    <li key={d.date + d.centre}>
                      <div>
                        <strong>
                          {d.date} · {label(d.centre)}
                        </strong>
                        {d.overCapacity && (
                          <p>
                            Known peak {d.peak} exceeds {d.capacity} seats at{" "}
                            {time(d.peakTime)} IST. Review bookings or session
                            times.
                          </p>
                        )}
                        {d.capacity === null && (
                          <p>
                            Centre capacity is not configured; capacity cannot
                            be confirmed.
                          </p>
                        )}
                        {d.missing.map((s) => (
                          <small key={s.id}>
                            {s.client_name} ·{" "}
                            {s.exam_name || "Programme not specified"} ·{" "}
                            {s.candidate_count} candidates · Record valid start
                            and end times
                          </small>
                        ))}
                      </div>
                      {onOpenDay && (
                        <button onClick={() => onOpenDay(d.date)}>
                          Open day
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {tab === "clients" && (
            <section className="pw-panel">
              <h2>Clients & programmes</h2>
              {!a.mix.length ? (
                <p className="pw-empty">No sessions in this period.</p>
              ) : (
                <div className="pw-table-wrap">
                  <table className="pw-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Programme</th>
                        <th>Sessions</th>
                        <th>Candidates</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.mix.map((m, i) => (
                        <tr key={i}>
                          <td>{m.client}</td>
                          <td>{m.exam}</td>
                          <td>{m.sessions}</td>
                          <td>{m.candidates}</td>
                          <td>
                            {a.candidates
                              ? Math.round((m.candidates / a.candidates) * 100)
                              : 0}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          <p className="pw-muted">
            Capacity reference: Calicut 40 seats · Cochin 31 seats. Unknown
            capacities are flagged. Client names are shown exactly as recorded;
            older records are preserved.
          </p>
        </>
      )}
    </PlanningDialog>
  );
}
