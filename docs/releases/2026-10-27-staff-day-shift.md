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
- 30 isolated PostgreSQL checks: centre isolation, actual roster hours, gap/overlap validation, named cover, immutable history, independent review, due windows, idempotence, temporary cover, closing rules and explicit cross-project identities.
- Full application browser fixture at 1440px and 393px: timetable, staff sheet, checks, retained editing draft and empty future day; no runtime errors or body overflow. Fixtures use fictional people and are excluded from production entry points.
- FETS Online: 187 tests, TypeScript and production build; browser checks at 1440px, 393px and 320px cover failed saves, retained notes, canonical records, failed refreshes and unpublished days.
- Post-migration security advisors report no findings for the new objects. Unrelated existing advisories were not changed.

## Deployment

Use the pinned scripts `scripts/releases/deploy-staff-day-shift.sh` and the matching Online branch `codex/staff-day-checks`. Each retains the running image, original environment, effective Compose configuration, old assets and Nginx configuration, checks for intervening repository/production changes, verifies candidates, switches only its app and compares public assets byte-for-byte. A failed post-switch check restores the previous image.

Only activate the approved day after both websites pass deployment checks. Production integration verification reads real mapped identities and published slots through the installed Online server credentials, including staff changeovers and temporary break cover; it does not insert production check records.

## Different verified login emails

A second additive migration, `20261027031642_verified_online_staff_links.sql` (installed as `20261027031811`), provides private administrator-reviewed identity links. Its source SHA256 is `e18b15e948548ca2f5fa559653ee944468d8935575ea3330880c622fcb55de6c`. The exact Online UUID and verified email are pinned to the confirmed Live profile; a changed email cannot fall through to another identity. Live activity, verified account and centre membership are still required. No application role can read or edit the link table. `20261027031859_private_online_staff_link_policy.sql` adds an explicit deny policy (installed as `20261027031936`). Login emails and credentials are unchanged. The single confirmed staff link is production data, not part of this repository.

Read-only production verification: `scripts/verification/verify-production-shift-bridge.py PLAN_ID --identity-map ROOT_PRIVATE_JSON`. It compares every canonical slot against the actual published plan, checks all named break covers and changeovers, and validates each existing verified staff identity through the installed Online server connection. It never inserts a check record.

## Verified production release

- Live release: `20261027T032554Z-staff-day-701c23f`; deployed web commit `701c23f909bc257f98a3e53322059f7cde671b70`.
- Live image: `sha256:4d4862556ddb8b0eddd6edde5689073c4e580690d3d3bac9a98b94c22387f5cf`; index SHA256 `4e60c4bc1fffae94321e6a6d0f8cb49a14883431d87af1aeafc48107299289c0`.
- Online release: `20261027T033236Z-staff-day-8ed6441`; deployed web commit `8ed64417f5fc5111b4701c75e131d35120e2e05f` (PR hy4k/fets.tv#81).
- Online image: `sha256:04cb535672686292cb820c631f5c494eef3daf45c8bc0ae61dfb565d78cabbec`.
- All 55 Live public files/routes and 65 Online public assets/metadata passed byte/MIME checks; the actual Live lazy application module evaluated on both candidate and public origins. Online's anonymous check API returned 401. Effective runtime environments, ports, mounts, networks, restart settings and Nginx configuration matched their pre-deploy state. Old hashed assets remain available for existing sessions.
- Today's approved Calicut plan was published at **09:01:40 IST**, version 2, with no day lead and the single approved temporary cover period. Its first imported plan and publication are retained in the audit history. No work/check events were imported.
- Read-only verification through the final installed Online server connection resolved all four verified real staff identities and compared every one of the **208 canonical slots (78 walks / 130 DVR checks)** to the published plan, including all boundaries and named breaks. All matched; verification created zero records. Evidence is retained privately as `shared-shift-production-verification.json` in both release directories. The Lab date follows the current centre day even when a future exam is imported, covered by the browser fixture.

Website rollback commands (retain database and recorded history):

```sh
bash /opt/fets-releases/20261027T032554Z-staff-day-701c23f/rollback.sh
bash /opt/fets-online-releases/20261027T033236Z-staff-day-8ed6441/rollback.sh
```

The final Online rollback restores the immediately preceding shared-check release. Its original pre-change website is also retained via `/opt/fets-online-releases/20261027T032229Z-staff-day-1a3eda1/rollback.sh`.
