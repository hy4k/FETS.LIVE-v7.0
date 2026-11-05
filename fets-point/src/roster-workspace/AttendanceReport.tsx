import React, { useState } from "react";
import type { PrivateReport } from "./private-reports";
import type { RosterRepository } from "./repository";
import type { Snapshot } from "./model";
import { attendanceReport, downloadReport } from "./report";
export function AttendanceReport({
  data,
  month,
  branch,
  now,
  repo,
  initial,
}: {
  data: Snapshot;
  month: string;
  branch: string;
  now: Date;
  repo: RosterRepository;
  initial?: PrivateReport;
}) {
  const people = data.people.filter(
    (p) =>
      branch === "global" ||
      p.branch_assigned?.toLowerCase() === branch ||
      data.schedules.some(
        (s) => s.profile_id === p.id && s.branch_location === branch,
      ),
  );
  const [person, setPerson] = useState(initial?.recipient_profile_id || "");
  const [saved, setSaved] = useState<PrivateReport | undefined>(initial);
  const [draft, setDraft] = useState<ReturnType<
    typeof attendanceReport
  > | null>(
    initial
      ? {
          title: initial.title,
          summary: initial.summary,
          evidence: initial.source_evidence,
          count: initial.source_count,
          generated: initial.source_generated,
        }
      : null,
  );
  const [title, setTitle] = useState(initial?.title || ""),
    [text, setText] = useState(initial?.summary || ""),
    [notes, setNotes] = useState(initial?.manager_notes || "");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const shared = saved?.status === "shared";
  const recipientName =
    saved?.recipient_name ||
    people.find((p) => p.id === person)?.full_name ||
    "";
  async function save(share: boolean) {
    if (!draft || busy || shared) return;
    setBusy(true);
    setMessage("");
    try {
      let record = saved;
      const edits = { title, summary: text, manager_notes: notes };
      if (!record) {
        record = await repo.createReport({
          ...edits,
          recipient_profile_id: person,
          month: month + "-01",
          branch,
          source_evidence: draft.evidence,
          source_generated: draft.generated,
          source_count: draft.count,
        });
        setSaved(record);
      }
      record = await repo.updateReport(record.id, record.version, edits, share);
      setSaved(record);
      setMessage(
        share
          ? `Shared privately with ${record.recipient_name}. They can open it from Roster → My reports.`
          : "Draft saved. Only you can see it until you share it.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not save the report. Your edits are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
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
      setMessage("PDF downloaded.");
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
        {initial?.month.slice(0, 7) || month} · {initial?.branch || branch} ·{" "}
        {shared
          ? "Shared privately"
          : saved
            ? "Saved draft · private to you"
            : "Unsaved draft"}
        {draft && <> · {recipientName}</>}
        {!shared && (
          <>
            <br />
            Save your edits before closing. Share only when the report is ready.
          </>
        )}
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
            <input
              aria-label="Report title"
              maxLength={200}
              disabled={shared || busy}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Review summary · editable
            <textarea
              aria-label="Review summary · editable"
              maxLength={20000}
              disabled={shared || busy}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <label>
            Manager comments
            <textarea
              aria-label="Manager comments"
              disabled={shared || busy}
              maxLength={20000}
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
            {!shared && (
              <>
                <button
                  disabled={busy || !title.trim() || !text.trim()}
                  onClick={() => save(false)}
                >
                  Save draft
                </button>
                <button
                  className="rw-primary"
                  disabled={busy || !title.trim() || !text.trim()}
                  onClick={() => save(true)}
                >
                  Share with {recipientName}
                </button>
              </>
            )}
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
