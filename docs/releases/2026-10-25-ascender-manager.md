# Ascender Manager

System Manager is now Ascender Manager in Admin Tools. Its existing route and `ws_system-manager` permission key remain stable. The equipment UI is removed; all 116 equipment records and their existing logs are retained. Calicut and Cochin reuse the original `centres` IDs; Mobile unit is a separate new centre. Historical Kannur and Mangalore centre rows remain intact. Kannur is removed from User Management filters and Add/Edit choices, and new staff creation rejects that branch. Existing staff are not reassigned.

## Responsibilities and existing features

| Information / action | Owner |
| --- | --- |
| Centre contacts, manager, backup and descriptive opening hours | Ascender centre profile |
| Rooms, usable seats and programme-specific approvals | Ascender records; no capacity inferred from equipment |
| Documents | Links to existing secure documents, not another uploader/file store |
| Renewals | Existing `compliance_items` register, with administrator-only RLS and reminder dates |
| Venue, dates, setup, lead, readiness declaration and handover | Mobile deployment records |
| Exam bookings | Existing Calendar; next scheduled exam is read-only here |
| Staff profile and role | Existing User Management |
| Weekly lead and duties | Existing The Shift; weekly lead is read-only here |
| Shift timing, attendance and overtime | Existing Roster / attendance; centre opening hours do not alter calculations |
| Follow-up tasks and incidents | Existing Actionables / case workflows; no new task system |
| Walk/DVR evidence, credentials and messaging | Existing tools, unchanged |

Mobile is an administrative unit with deployments, not a new attendance branch. Its staff retain their existing home centre and each deployment has a responsible lead. For Mobile, Roster opens the all-centres view and The Shift asks the administrator to choose the staff’s home centre. Fixed centres navigate with their selected centre. No invented addresses, capacities, approvals, renewals or readiness declarations are seeded. Reminders appear in the page; they do not send notifications or automatically complete/advance renewals.

## Backend and access

FETS Live only (`qqewusetilxxfvfkmsed`). Migration source `20261024203812_ascender_centre_administration.sql` was applied as `20261024204716` on 25 October 2026 IST. It creates the three administrative profiles and protected centre metadata tables, reuses the existing renewal table, and records changes with server-attributed history. Updates compare versions to prevent overwriting a concurrent edit. Archive preserves history; normal clients cannot delete records or edit history. Program approval requires evidence, centre code and capacity; Mobile readiness requires a lead and evidence, and closure requires handover notes.

Access requires an active admin profile plus server-owned Auth role or a verified legacy Mithun/Niyas identity, checked against Auth rather than writable user metadata. Existing workspace visibility alone does not confer database access. Super-admin reads of all source tables were verified using a transaction-scoped authenticated role. No production test records were written. Counts after migration remain 13 staff, 116 equipment records and 67 vault entries. Security advisors report no Ascender findings.

The existing `create-staff-user` function is deployed as version 34, preserving its authentication and full profile behavior while removing Kannur from accepted new assignments.

## Verification

- 27 isolated PostgreSQL checks: permissions, privilege escalation rejection, capacity constraints, approval evidence, same-centre document/renewal association, Mobile-only deployments, attributed readiness, closeout, immutable identity/history and concurrent edits.
- 21 frontend/model/staff-creation tests; TypeScript and production build.
- Actual component checks at 1440px and 393px: failed-save recovery, centre edits, existing-tool navigation, capacity validation, approvals, shared renewals, document links, deployment creation, history, access denial and horizontal overflow.
- Preview screenshots use labelled fictional data and do not enter the production bundle.

## Deployment

Prepared on `codex/ascender-manager`, based on the verified Add User release `11bc920cd617416697908da866bda819beba0987`. The guarded deployment preserves runtime/Nginx configuration, retains the previous image and hashed assets, requires verified migration/function hashes, and evaluates the full lazy module before and after switching. Public deployment results will be recorded after verification. A website rollback retains the additive database records and version 34 function.
