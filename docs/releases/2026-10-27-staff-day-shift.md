# Staff-day Shift and shared Lab checks — 27 October 2026

The Shift now opens to a chronological team timetable and individual duty sheets. It replaces the previous rotations, blueprint and review screens. A day plan uses that centre's actual roster hours, named opening tasks, duty periods, break cover, handovers and closing notes. Managers can prepare and publish a different pattern for each date; the supplied Plan B is a single approved example, not a recurring schedule.

## Staff and management workflow

1. Select the centre and date. Staff open on **My duty sheet**; managers open on **Team timetable**.
2. Managers create the day's plan using the actual roster. Enter monitoring hours and named duties, opening-task owners and break cover. The optional CMA checklist is a starting point only for that programme.
3. Publish only after the validation succeeds. Missing roster hours, overlaps, monitoring gaps, invalid cover and unnamed opening tasks block publication.
4. Staff record completed checklist items, request help or add handover notes. A different lead/planner verifies or returns submitted work; actor and time come from the server.
5. Walks and DVR checks are recorded in **Walk & DVR log** or **FETS Online → Lab**. Both use the same immutable Live ledger. Only the named monitor/cover can record a currently due check.
6. At the planned finish, management records pending work and the closing handover. Closed days remain readable.

Future days start with their own roster and calendar. Copying a previous layout regenerates IDs and excludes temporary cover and every completion/check event. Calendar timing import requires complete, increasing exam times; incomplete calendar rows do not invent a finish time.

## Backend

Additive migration: `supabase/migrations/20261027021528_staff_day_shift_workspace.sql`.

Applied only to FETS Live (`qqewusetilxxfvfkmsed`) as migration `20261027025510`, name `staff_day_shift_workspace_v2`. SHA256: `70ef1aed803af60647f37a1bcc1f6971ea772b22784a3f9215b6d360af89fad6`.

Four RLS tables hold plans, immutable plan versions, staff work events and canonical check events. Old plans, checks, users, attendance and signed exam reports are retained. Online needs no schema change. Its authenticated API derives the verified user and centre on the server and calls service-only Live RPCs; private credentials never reach the browser.

The approved example was imported privately from the supplied PDFs. Two same-day roster finishes were corrected from 15:00 to 16:00 as instructed. A display alias preserves the existing staff identity. Temporary break cover is a management-approved availability record, not a fabricated payroll/attendance record. No paper checklist, walk, DVR or work completion has been backfilled.

Checks remain on a continuous 10/6-minute cadence through handovers and breaks. The outgoing monitor owns a check exactly at the boundary. Slots due before publication are marked **not tracked**, never missed or completed. Live plan edits cannot rewrite elapsed assignments or check owners. Every version is retained.

## Validation

- Production TypeScript and Vite build.
- 19 targeted frontend tests, including explicit removal of a previous lead marker.
- 24 isolated PostgreSQL checks: centre isolation, actual roster hours, gap/overlap validation, named cover, immutable history, independent review, due windows, idempotence, temporary cover and closing rules.
- Full application browser fixture at 1440px and 393px: timetable, staff sheet, checks, retained editing draft and empty future day; no runtime errors or body overflow. Fixtures use fictional people and are excluded from production entry points.
- FETS Online: 187 tests, TypeScript and production build; browser checks at 1440px, 393px and 320px cover failed saves, retained notes, canonical records, failed refreshes and unpublished days.
- Post-migration security advisors report no findings for the new objects. Unrelated existing advisories were not changed.

## Deployment

Use the pinned scripts `scripts/releases/deploy-staff-day-shift.sh` and the matching Online branch `codex/staff-day-checks`. Each retains the running image, original environment, effective Compose configuration, old assets and Nginx configuration, checks for intervening repository/production changes, verifies candidates, switches only its app and compares public assets byte-for-byte. A failed post-switch check restores the previous image.

Only activate the approved day after both websites pass deployment checks. Production integration verification reads real mapped identities and published slots through the installed Online server credentials, including staff changeovers and temporary break cover; it does not insert production check records.
