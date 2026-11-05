# Pearson VUE monthly registration uploads

## User intent and confirmed rules

Add a reusable Excel upload, following the existing CMA US calendar/candidate upload, for Pearson VUE registrations. A first file covers Cochin, 1–30 November 2026, and is a snapshot as of 5 November. Later refreshed files must update existing bookings, Calendar and Candidate Tracker without appending duplicates or adding counts twice. Store the added email and exam-code columns. No external booking ID is required: assign FETS identifiers and reuse them. User chose to show missing future bookings for cancellation review instead of automatically removing them.

Confirmed initial import boundary: review ALL existing candidate and calendar matches before ANY import. The live tracker has35 Pearson rows dated1–5 November, but only8 exact name/date matches to the attachment. Prepare a complete private review of all35 existing records, all451 incoming bookings and every calendar-group reconciliation. No safe-subset or upcoming-only import is authorized before the user has reviewed the complete matching result. Do not resolve uncertain identities by overwriting history or guessing.

## Read-only findings

Attachment: `Site Registrations (1).xlsx`, one sheet `TC Exam Details`,451 candidate rows, no formulas,112 merged ranges. Columns: Exam Date, Appointment Time, First Name, Last Name, Email, Phone Number, Client, Exam Series, Exam Title. Dates/time cells are merged vertically, so expand actual merged ranges, not arbitrary blank forward-fill. There are36 exam titles/codes and10 client/programme-owner labels. One email is missing; all exam codes and appointment ranges are present. No repeated exact name/email/code/date/time rows or email/code pairs occur in this file.

Live calendar:238 Pearson sessions,450 scheduled candidates. Source file groups into238 issuer/date/start/end slots.227 match existing slots with known label normalization;11 differ in timing and3 matched counts differ. Daily total differs by one on22 November. Existing labels include aliases such as AWS/Amazon Web Services and Salesforce/Sales Force. These mappings are reviewed data bindings, not permission to invent programme relationships.

Tracker has35 Pearson rows in scope, all registered, no check-in/completion progress. All have internal confirmation numbers but no provider roster numbers; no email or exam-code columns currently exist. Only8 source rows match an existing name/date; do not treat counts/positions as candidate identities. Older nonmatching rows belong to the review boundary above.

Current daily importer requires provider roster IDs, has one date per save, drops email/exam code, and cannot parse this appointment range/month format. Its calendar synchronizer groups candidates by provider+date+exam_name+start, so mapping full file exam titles over existing broad issuer labels would create extra sessions unless explicitly reconciled.

## Proposed behavior

- Keep the current daily/manual CMA upload working. Add a Pearson report mode that detects these headings, reads dates and both ends of appointments in IST, expands genuine merged cells and previews all dates.
- Preserve file Client (exam owner), Exam Title and Exam Series separately from delivery provider PEARSON VUE. Store email and exam code as actual candidate fields, and show/search/export them through Candidate Tracker. Do not use phone as identity: some rows contain provider contact numbers.
- Assign a FETS registration ID at first import. Matching is scoped by centre/provider; unchanged email+exam+appointment matches reuse an ID. A unique email+exam with moved time is a reschedule candidate, not proof of identity. Missing emails, multiple sittings, changed emails/names, legacy rows and uncertain reschedules require explicit review bindings. Never depend on filename, row number, workbook order or phone alone. Do not collapse a legitimate second exam/retake.
- Preview new/unchanged/changed/legacy-match/uncertain/cancellation-review counts plus calendar changes. Persist a trusted preview snapshot; saving rechecks scope, permissions, source identity and target versions. Repeated saves/uploads cannot create another candidate or count increment. Concurrent imports serialize in the same centre/day order as the existing sync workflow.
- Reconcile existing calendar sessions before candidate synchronization. Reuse their IDs when reviewed, update candidate totals by replacement, preserve unrelated providers/dates/centres and assigned staff/status. Never assume same counts means same people, nor create a detailed-title session alongside an existing issuer summary. Timing conflicts are visible for review. Candidate and calendar changes commit together or neither does.
- Existing candidate check-in, locker, confirmation, attendance/progress, notes and history are preserved. Names/contact/exam schedule updates are limited to confirmed bindings. Missing future imported bookings enter cancellation review. No automatic cancellation/deletion of historical, manual or progressed records, and no cancellation inferred from a partial file.
- Show an import receipt and refresh both Calendar and Candidate Tracker after success. Upload permissions follow the current server-side account/centre authority; file contents never authorize changes. Candidate personal data remains inside the existing staff workspace and must not appear in public logs or fixtures.

## Builder review decisions

A fresh read-only builder review found no additional user product questions beyond the historical-import choice (now answered: review all before any import). The following engineering defaults clarify the existing intent:

- Unresolved/held registrations do not lower a calendar session total. Reconcile only a fully resolved session membership, otherwise keep the existing session total and expose the difference/review state. Do not create another session merely because some candidate bindings are held.
- A pending cancellation remains active and counted until an authorized human approves it. Dismiss keeps the booking; reappearance in a later snapshot automatically closes the stale missing-booking review. Approval preserves the record/history and makes its counted membership inactive. Pearson counting uses explicit import/session membership and excludes approved cancelled registrations; other providers retain existing semantics.
- Persist centre, delivery provider, inclusive coverage dates, completeness declaration, source-as-of value, file digest and upload time. Do not infer full coverage from first/last populated date. Previously seen older files return their existing receipts, and older declared snapshots cannot overwrite a newer state without an explicit reviewed correction. If source ordering cannot be established, show that in review rather than inventing export time from upload time.
- Persist explicit candidate-to-session/source-group bindings including end time. Pearson synchronization follows those bindings and retains the existing display labels/IDs unless an approved preview changes them. The old provider/title/start trigger alone is not an acceptable reconciliation mechanism for this mode.
- Before mutation acquire every affected old/new centre/day lock in deterministic order, including reschedules and cancellation approval; verify both candidate and calendar snapshots under those locks. Reuse the established lock namespace when interacting with the daily importer.

## Implementation choices to resolve during planning

Prefer a bounded batch/preview import RPC and explicit import identity/history storage over exposing generic SQL or relying only on frontend duplicate checks. Keep source snapshots/version checks and user review bindings server-owned. Add only required nullable candidate metadata fields and backward-compatible types/readers. Preserve existing other-provider triggers and reconcile Pearson source ownership rather than disabling validation or rewriting unrelated records.

Develop and test in `/tmp/fets-pearson-import`, branch `codex/pearson-monthly-registration-import`, from the deployed expanded-AI branch. The live frontend is still7df5868; current worktree base0427d40 adds receipts and a migration filename alignment only. No product code, schema, records or deployment have changed for this task at design time.

## Acceptance checks

Parse all451 attachment rows with correct IST dates/start/end and retained email/code/title. Test same-file reupload, reordered file, small additions/updates, moved booking, two sittings sharing email+exam, one missing email, changed source values, review expiry/staleness, concurrent/retried saves, cancellation review, all-or-nothing rollback, unrelated-centre/provider protection, existing progress preservation, legacy adoption and existing calendar reuse. Check a dry-run against live records before the first approved import. Use isolated synthetic candidates for mutation tests; do not commit the attachment or real candidate contact details. Verify both user screens after deployment and retain frontend/database rollback artifacts.
