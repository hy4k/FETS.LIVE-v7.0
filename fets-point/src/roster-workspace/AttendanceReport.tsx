import React, { useState } from "react";
import type { Snapshot } from "./model";
import { attendanceReport, downloadReport } from "./report";
export function AttendanceReport({
  data,
  month,
  branch,
  now,
}: {
  data: Snapshot;
  month: string;
  branch: string;
  now: Date;
}) {
  const people = data.people.filter(
    (p) =>
      branch === "global" ||
      p.branch_assigned?.toLowerCase() === branch ||
      data.schedules.some(
        (s) => s.profile_id === p.id && s.branch_location === branch,
      ),
  );
  const [person, setPerson] = useState("");
  const [draft, setDraft] = useState<ReturnType<
    typeof attendanceReport
  > | null>(null);
  const [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  function generate() {
    const next = attendanceReport(data, person, month, branch, now);
    setDraft(next);
    setTitle(next.title);
    setText(next.summary);
    setNotes("");
    setMessage("");
  }
  async function download() {
    if (!draft) return;
    setBusy(true);
    setMessage("");
    try {
      await downloadReport(
        title,
        `${text}\n\nManager comments\n${notes || "No comments added."}\n\nSource records (snapshot ${draft.generated})\n${draft.evidence}\n\nPrepared for review. Attendance measures alone do not assess overall work quality.`,
        `FETS-attendance-${month}-${person}.pdf`,
      );
      setMessage(
        "PDF downloaded. Review it before sharing with the staff member.",
      );
    } catch {
      setMessage(
        "The PDF could not be generated. Your draft is still here; try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rw-report">
      <p className="rw-method">
        {month} · {branch === "global" ? "Both centres" : branch}. Private draft
        for your review. Nothing is sent automatically. Draft edits stay here
        until you close this window.
      </p>
      {!draft ? (
        <>
          <label>
            Staff member
            <select
              aria-label="Staff member"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
            >
              <option value="">Choose staff</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <button className="rw-primary" disabled={!person} onClick={generate}>
            Generate draft
          </button>
        </>
      ) : (
        <>
          <label>
            Report title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Review summary · editable
            <textarea value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <label>
            Manager comments
            <textarea
              style={{ minHeight: 90 }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context, agreed support or follow-up actions"
            />
          </label>
          <details>
            <summary>
              Source records · {draft.count} entries · {draft.generated}
            </summary>
            <pre>{draft.evidence}</pre>
          </details>
          <div className="rw-report-actions">
            <button
              className="rw-primary"
              disabled={busy || !title.trim() || !text.trim()}
              onClick={download}
            >
              {busy ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
