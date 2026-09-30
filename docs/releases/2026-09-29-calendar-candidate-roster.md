# Calendar candidate roster

Calendar now provides Upload roster and Add by hand. Staff select the date, centre and provider, preview candidate changes and replacement calendar totals, then save. CSV, XLSX and legacy XLS are supported. All saves use the existing public.candidates table. Totals always recalculate, as requested; they are never added on top of an existing forecast.

## Database and integration contract

Migration `20260929195737_calendar_candidate_roster.sql` was applied to Supabase project `qqewusetilxxfvfkmsed` on 2026-09-29 and recorded in migration history. No user-run SQL remains for this feature.

The four new nullable columns are `roster_number text`, `exam_part text`, `exam_start_time time` and `source text`. New tracker entries default to source `tracker`; Calendar sets `upload` or `manual`. Existing rows remain nullable. Providers are stored as PROMETRIC, PEARSON VUE, CELPIP, PSI or ITTS. Full names remain one field.

The unique key is centre + IST exam day + upper(client_name) + roster_number, for non-null roster numbers. The actual exam_date column is timestamptz: PostgreSQL cannot index its session-dependent `::date` cast. The index therefore uses `((exam_date AT TIME ZONE 'Asia/Kolkata')::date)` explicitly. IDs remain text, including leading zeros. The authenticated, security-invoker `save_calendar_roster` RPC targets this partial expression index and commits candidates and counts atomically. Matching rows update names, phone, part, exam and time while retaining status, check-in, locker and existing internal identifiers.

Candidate insert/update/delete statement triggers reconcile affected calendar groups, including the old group after a move or deletion. A zero-count session is retained. If pre-existing sessions have identical grouping keys, their combined count is assigned once to the first session and the others become zero; no session is deleted. Missing sessions reuse the most recent positive duration configured for the same provider/exam, preferring the same centre, or use end=start. Legacy candidates with no time remain in a time-to-be-confirmed group.

The external read contract remains: full_name, phone, roster_number, exam_part, exam_start_time, client_name, exam_name, exam_date, branch_location, status. Filter exam_date by the IST day's timestamp boundaries; exam_start_time is IST wall-clock time, not UTC. No fets-api or fets.online code was changed, and the other app's daily pull/removal of its importer is a separate task.

Existing tracker confirmation_number values are internal generated IDs and were not copied into roster_number. The preview flags matching legacy names without a provider ID and excludes them by default. Staff can add the true provider ID in Candidate Tracker and preview again. Tracker edits expose provider ID, part and start time.

## Parsing and access

Header aliases, extra-before-built-in matching and the OLE/BIFF XLS reader were ported from [hy4k/fets.tv](https://github.com/hy4k/fets.tv/blob/main/lib/roster/parse.ts), with IST time parsing added locally. Preview reports missing fields, duplicate provider IDs and malformed data. Broken CSV quoting is rejected. Limits are 20 MB per file and 2,000 selected candidates per save. Workbook cover sheets are detected. The spreadsheet parser is loaded only when opening the roster dialog.

Candidate and calendar RLS policies were preserved byte-for-byte by policy fingerprint (`59836daab36934c4b3b311ed14d37e2e`). RPCs and triggers run with caller privileges. A calendar access failure rolls back the candidate write. Security-advisor findings were unchanged before/after this migration (146 existing findings, zero new findings).

## Verification

- Eleven parser/API-preview/form tests passed, including real XLS/XLSX files, header overrides, leading-zero IDs, malformed input, manual review and context changes.
- Isolated PostgreSQL executed the exact migration and verified safe re-upload, preserved status/locker, IST dates, moved/deleted groups, known exam duration, duplicate rejection, anonymous denial and wrong-centre rollback.
- Live Supabase transaction under the supplied authenticated user verified insert, re-upload, status preservation, time move and delete/count synchronization. It was rolled back; no verification candidates remain.
- Chromium desktop and mobile checks passed with mocked API fixtures: FETS AI opens, roster preview identifies one update plus one new candidate, calendar forecast 20 becomes 2, and Save works at 390px without the orb intercepting it. No page errors. This does not substitute for a signed-in Gemini response check.
- Production TypeScript/Vite build and git diff whitespace checks passed.

The companion now sits behind modal dialogs so it cannot cover their actions. The development server was restarted with file polling to avoid stale styles when running from this Windows-mounted workspace.
