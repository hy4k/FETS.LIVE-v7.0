import React, { useEffect, useState } from "react";
import type { PrivateReport } from "./private-reports";
import type { Snapshot } from "./model";
import type { RosterRepository } from "./repository";
import { AttendanceReport } from "./AttendanceReport";
export function PrivateReports({
  repo,
  canEdit,
  data,
  now,
}: {
  repo: RosterRepository;
  canEdit: boolean;
  data: Snapshot;
  now: Date;
}) {
  const [rows, setRows] = useState<PrivateReport[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PrivateReport | null>(null),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    repo
      .reports()
      .then((r) => {
        if (live) setRows(r);
      })
      .catch((e) => {
        if (live) setError(e.message || "Could not load reports.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [repo, refresh]);
  useEffect(() => {
    const h = () => setRefresh((x) => x + 1);
    window.addEventListener("focus", h);
    const id = setInterval(h, 30000);
    return () => {
      window.removeEventListener("focus", h);
      clearInterval(id);
    };
  }, []);
  if (selected)
    return (
      <>
        <div className="rw-report-actions" style={{ padding: "18px 22px 0" }}>
          <button
            onClick={() => {
              setSelected(null);
              setRefresh((x) => x + 1);
            }}
          >
            Back to reports
          </button>
        </div>
        {canEdit ? (
          <AttendanceReport
            key={selected.id}
            data={data}
            repo={repo}
            month={selected.month.slice(0, 7)}
            branch={selected.branch}
            now={now}
            initial={selected}
          />
        ) : (
          <article className="rw-report">
            <p className="rw-method">
              Private report for {selected.recipient_name} ·{" "}
              {selected.month.slice(0, 7)}
            </p>
            <h3>{selected.title}</h3>
            <div style={{ whiteSpace: "pre-wrap" }}>{selected.summary}</div>
            {selected.manager_notes && (
              <>
                <h4>Manager comments</h4>
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {selected.manager_notes}
                </div>
              </>
            )}
            <details>
              <summary>Source records · {selected.source_generated}</summary>
              <pre>{selected.source_evidence}</pre>
            </details>
            <p className="rw-method">
              Shared{" "}
              {selected.shared_at &&
                new Date(selected.shared_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
              IST
            </p>
          </article>
        )}
      </>
    );
  return (
    <div className="rw-report">
      <p className="rw-method">
        {canEdit
          ? "Drafts are visible only to you. Shared reports are also visible to their selected recipient."
          : "Attendance reports shared privately with you."}
      </p>
      <button onClick={() => setRefresh((x) => x + 1)} disabled={loading}>
        Refresh reports
      </button>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading reports…</p>}
      {!loading && !error && !rows.length && <p>No reports yet.</p>}
      {!error &&
        rows.map((r) => (
          <button
            key={r.id}
            className="rw-report-row"
            onClick={() => setSelected(r)}
          >
            <span>
              <strong>{r.title}</strong>
              <small>
                {canEdit ? r.recipient_name + " · " : ""}
                {r.month.slice(0, 7)} ·{" "}
                {r.status === "draft" ? "Draft" : "Shared"}
              </small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
    </div>
  );
}
