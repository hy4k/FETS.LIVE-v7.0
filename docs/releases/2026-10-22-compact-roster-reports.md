# Compact roster and attendance report drafts

The roster opens to the whole month. Cells show short codes in separate muted colours for Day, Half Day, Rest, Leave and the other existing roster types. Custom timing variants get D1/D2 (or corresponding HD variants); the shared key explains each time range and any grace. Codes are derived from saved timing, not shift names, and remain consistent across week/month and staff filters within the loaded month. Staff names remain fixed when scrolling on small screens.

A small underline identifies the lead for each day. The roster reads existing `centre_lead_weeks`, `centre_day_plans` and lead changes from `centre_duty_changes`. A shared pure resolver keeps the same acting lead > plan lead > weekly lead rules as The Shift, including current-day timed changeovers and weeks crossing month boundaries. If lead queries fail, the roster stays usable and explicitly shows that lead assignments are unavailable. It does not create or change lead assignments.

Mithun's super-admin account provides **Attendance → Attendance report**. Select month/centre and staff, generate a draft, edit its title/summary and manager comments, save it, then use **Share with [staff name]**. Saved drafts reopen from **Roster → Reports**. Staff read reports addressed to their account under **Roster → My reports**. Drafts are hidden from recipients; shared copies are immutable. PDF download remains optional. No report is automatically shared or emailed, and no real staff report was generated during testing.

The report uses the existing attendance model, with each roster's hours/grace, incomplete records excluded from completed work totals, unknown timings unassessed, and approved OT separate from outside-hours time. This release also rejects future clock times today and check-outs with no check-in as invalid analysis records. Source evidence is captured at generation and cannot be rewritten in a saved draft; editable commentary is separate.

## Backend

FETS Live (`qqewusetilxxfvfkmsed`) already contains the lead tables and roster timing migration. This release adds `20261022105031_roster_private_attendance_reports.sql`: a private report table, RLS and a guarded lifecycle trigger. Only Mithun's verified Auth identity plus super-admin role may write; recipients can SELECT only shared reports bound to their Auth user ID. The author check does not trust editable profile email/role alone. Draft updates use expected-version checks. Recipient, author, source snapshot and shared content cannot be changed. No delete access is granted to client roles. Existing profile permissions were not broadened.

Migration applied to FETS Live on 22 October. Before/after counts and fingerprints match for 1,976 roster entries, 756 attendance records and 12 staff profiles. No FETS Online changes. The new report table is empty: no test production report or notification was sent. The eight existing security advisory categories and counts are unchanged, with no report-related findings. Existing advisories remain outside this release; see https://supabase.com/docs/guides/database/database-linter for remediation guidance.

## Validation

- 57 targeted frontend checks across roster, lead resolution, report calculation and existing shift workflows pass.
- TypeScript and production build pass.
- 17 isolated database checks cover author identity, draft/recipient privacy, anonymous denial, stale versions, immutable source/recipient and shared records.
- Desktop/mobile browser checks cover saving/reopening/editing drafts, private sharing, recipient reading and exclusion of another staff account.
- Existing roster interactions pass at 1440, 393 and 320px: custom shifts, half days, 15-day leave, conflict handling, missing checkout and offline failure.
- Additional browser checks verify 31 dates, no desktop roster scrolling at 1440px, distinct code colours, lead underline, edited PDF download and hidden report controls for staff at 1440/393px.
- PDF text inspection confirms the edited title/comments and source records; PDF is paginated A4.
- The full built lazy application shell is explicitly evaluated; login-only checks are insufficient (see earlier recovery incident).

## Deployment status

Deployed and verified on **23 October 2026, approximately 03:24 IST** (22 October 21:54 UTC). Website commit: `b1b423c8e8aa079fe881af15992540f0183302b8`; release directory: `/opt/fets-releases/20261022T105909Z-roster-b1b423c`. The directory retains the build's original 22 October timestamp; the website switch occurred after the remote connection was restored.

The already-built candidate was resumed with `scripts/releases/resume-roster-private-reports.sh`. The script verified the rollback archive, exact candidate image, source commit, current runtime/Compose configuration, unchanged GitHub branches and production baseline, and both migration receipts before switching. All 52 public files/routes match the reviewed build. The full lazy application module and shared components passed explicit browser evaluation against both candidate and public origins (`RedesignShell-BJrtryO3.js`). Runtime environment, ports, mounts, restart policy and Nginx configuration were preserved.

FETS Live report migration history version: `20261022105734`; source migration SHA256: `81c2b42f7de444bd915221e8a883917d34f27fb7c8266944bcb429247de7d469`. The existing timing migration remains `20261022034519`. Live read-only identity checks confirm Mithun can author reports and an ordinary staff account cannot; anonymous reads and client deletes are denied. No report was generated or sent in production. UI sharing/read tests used isolated fictional fixtures, not an authenticated production staff session.

Rollback: `bash /opt/fets-releases/20261022T105909Z-roster-b1b423c/rollback.sh`. This restores the previous verified website `0336653`; the additive report backend and all saved records remain. The previous image archive and effective server configuration are retained. FETS Online is unchanged.
