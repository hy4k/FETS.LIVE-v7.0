# Compact roster and attendance report drafts

The roster opens to the whole month. Cells show short codes in separate muted colours for Day, Half Day, Rest, Leave and the other existing roster types. Custom timing variants get D1/D2 (or corresponding HD variants); the shared key explains each time range and any grace. Codes are derived from saved timing, not shift names, and remain consistent across week/month and staff filters within the loaded month. Staff names remain fixed when scrolling on small screens.

A small underline identifies the lead for each day. The roster reads existing `centre_lead_weeks`, `centre_day_plans` and lead changes from `centre_duty_changes`. A shared pure resolver keeps the same acting lead > plan lead > weekly lead rules as The Shift, including current-day timed changeovers and weeks crossing month boundaries. If lead queries fail, the roster stays usable and explicitly shows that lead assignments are unavailable. It does not create or change lead assignments.

Mithun's existing super-admin gate exposes **Attendance → Attendance report**. Select the month/centre in the roster, choose a staff member, generate a draft, edit its title/summary and manager comments, and download a PDF for manual sharing. Drafts stay in memory until the dialog closes; source evidence is captured when the draft is generated and appended to the PDF. Nothing is sent automatically and no production report is created during tests. The report generator uses the existing attendance model, with each roster's hours/grace, incomplete records excluded from completed work totals, unknown timings unassessed, and approved OT separate from outside-hours time. This release additionally rejects future clock times today and check-outs with no check-in as invalid analysis records.

## Backend

No new migration is required. FETS Live (`qqewusetilxxfvfkmsed`) already contains the lead tables, authenticated branch-scoped SELECT policies, and the installed roster timing migration (`20261022034519`, source `20261020144716_roster_shift_times_and_attendance.sql`). Schema and lead read policies were inspected. No rows, permissions or FETS Online data were changed for this enhancement.

## Validation

- 57 targeted frontend checks across roster, lead resolution, report calculation and existing shift workflows pass.
- TypeScript and production build pass.
- Existing roster interactions pass at 1440, 393 and 320px: custom shifts, half days, 15-day leave, conflict handling, missing checkout and offline failure.
- Additional browser checks verify 31 dates, no desktop roster scrolling at 1440px, distinct code colours, lead underline, edited PDF download and hidden report controls for staff at 1440/393px.
- PDF text inspection confirms the edited title/comments and source records; PDF is paginated A4.
- The full built lazy application shell is explicitly evaluated; login-only checks are insufficient (see earlier recovery incident).

## Deployment status

Prepared on `codex/roster-flexible-shifts`, PR #37. The deployment script is pinned to the currently verified public release `03366536a07d95aa5ab9c7f40fd1fc0fb7f51fb8`, public index SHA256 `7b8a4d25c287a027639da0f72348ffa6c71c542b938adca38d26e16117b9edf6`. It retains the rollback image/configuration, tests the candidate application module and checks for concurrent production/repository changes before switching.

Not deployed at preparation time: Desktop Commander reports srv1120621 offline. Public release.json still identifies `0336653`. Reconnect the authorized device, recheck release/schema, and run the reviewed release script with the exact commit. The existing database verification receipt gate still applies; no new DDL is needed.
