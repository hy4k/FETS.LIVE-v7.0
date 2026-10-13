# Clear Actionables — prepared release

This release rebuilds Actionables around a quick project overview, personal work and manager follow-up. It uses the user's supplied `actionablesacca.html` as a factual reference, not as executable application code. It is stacked on the existing Shift work in PR #33. Website deployment and these database migrations have **not** been performed.

## Source data and behavior

- The supplied array contains **25 institutions**, despite the source heading saying 23: Ernakulam/Cochin 5, Thrissur 6, Calicut 6, Kannur 4 and Kottayam 4. Names, addresses, PIN codes, phone numbers, nodal roles, capacities, statuses and readiness percentages are preserved as immutable reference snapshots. Cochin maps to the existing Ernakulam district enum.
- The five original team tasks retain their wording, squad assignments, priorities and two todo / two in-progress / one done states. The completed source task has no invented completion author or evidence. Converting another source task to daily work requires a real named owner, due date and reporting recipient; in-progress tasks remain in progress.
- Source percentages and Certified statuses remain visible as recorded facts. No individual readiness observations, approvals, stage completions, personal owners, shortlist choices or operational results are inferred from them.
- The current FETS Live data inspected during preparation contains RIT KOTTAYAM, three assignments, two results and seven stage guides. These remain intact and appear as other saved work alongside the imported catalogue. Existing contact details win when an institution already exists; its supplied snapshot remains available separately. Ambiguous duplicate name/district matches stop the import.

Overview shows the source milestones, seven-centre shortlist, district picture and work needing attention. My work uses the staff-profile ID rather than the authentication-user ID. Finished duties with pending follow-up or reporting remain visible. Date-only deadlines use India dates; timed follow-ups respect their actual time.

Institutions expose contact details and the next stage. Readiness observations require evidence and retain prior entries, actor snapshots and server timestamps. Shortlist decisions are management-only, append-only, serialized and limited to seven; stale decisions are rejected. Guides retain the supplied ten audit criteria and fifteen programmes, link current provider guidance and offer an adjustable estimate using actual recorded capacities. Internal observations and planning estimates do not establish provider approval or guaranteed bookings.

## Database installation

Apply only to **FETS Live `qqewusetilxxfvfkmsed`**, after rechecking current schema, migration history, staff roster and production changes:

1. `supabase/migrations/20261013125943_actionable_rollout_and_readiness.sql`
2. `supabase/migrations/20261013131321_import_supplied_actionables_catalogue.sql`

Prerequisites are the existing expansion/work tables, `staff_profiles`, `fets_is_active_staff`, the stage/results/report-recipient migration `20261001220000_simple_institution_actionables.sql`, its delete RPC and stage seeding trigger. Both new migrations are transactional. No existing users, duties, results or reports are deleted by installation. The second migration imports source facts and stage guides, not fabricated completion history.

Preparation found broad existing staff-profile write policies. The new project cannot safely use browser-editable profile roles for management authority. A private membership roster is seeded once from existing linked staff profiles; review role and active flags before installation. Protected membership supplies the canonical profile ID, project role and name. Project records require enabled membership. The private schema is not an API-exposed schema; a guarded read-only RPC supplies the directory.

A profile trigger protects account identity, role, active status and permissions. Management-approved profile changes provision/revoke project access; normal self edits and delegated HR basic contact edits remain available. Delegated HR cannot grant roles, permissions or activation. Pending self-created profiles receive no project access until management approval. Operator/service-role administration remains possible. This changes staff-administration permission enforcement and should be reviewed with the current administrator roster. Existing broad profile SELECT policies are outside this release: it does not claim to resolve all legacy staff-data privacy issues.

New history tables remove inherited UPDATE, DELETE and TRUNCATE privileges for browser roles. Source snapshots cannot be replaced by clients. Source duties and stages cannot be moved into the legacy scope to bypass project access. Named source-duty owners and reporting recipients must be approved active project colleagues. The current capability response is checked on load and refresh; an access denial hides previously cached project records.

The frontend can display the existing workflow before the extension RPC exists; shortlist and observation features stay unavailable. Install both migrations before enabling the new project for staff. Deploy through the existing guarded VPS release process: retain the previous image and rollback release, preserve Compose and Nginx settings, and verify live assets against the reviewed build. An older website can be restored while retaining the additive catalogue/history; do not delete new data or drop migrations as a website rollback.

FETS Online `ueufcqmdqtwvhjjyudeu` and Android PR #31 are unchanged. Online rota synchronization was not validated as part of this Actionables change.

## Validation

- TypeScript and production Vite build passed. Existing chunk-size and Browserslist warnings remain.
- 25 targeted frontend tests passed, including staff identity, pending follow-up, source states, failed saves, staff/manager controls and cached-data access revocation.
- 17 disposable PostgreSQL/PGlite checks passed against enum-backed institution fields and the real stage/results prerequisite migration. They cover exact snapshots, preservation of prior records, grants/RLS, actor/time enforcement, evidence, stale writes, seven-centre limits, source immutability, task conversion and staff approval/revocation.
- Browser journeys passed at 1440, 768, 393 and 320 pixels without horizontal overflow or browser errors: catalogue search, shortlist, evidence, gap follow-up, named assignment, result recording, team follow-up and planning.
- Supplied phone numbers and task titles, and the local preview entry, are absent from production assets. The production screen loads business facts from the access-controlled database.

`fets-point/actionables-preview.html` is a development-only entry with actual source records and an in-memory repository. Its generic account selector is a technical preview control, not a fabricated source staff member. Browser verification writes only local memory and blocks Supabase requests. Clean screenshots show the supplied state; verification screenshots containing test observations/results are not production evidence.

Reproduce targeted checks from `fets-point` with `vitest run src/redesign/ActionablesWorkspace.test.tsx src/redesign/actionables-model.test.ts src/redesign/institution-workflow.test.ts` and the normal build. Run `scripts/tests/actionables-rollout.mjs` with PGlite 0.3.14 available through `FETS_PGLITE_MODULE`. Start the preview on local port 3011 and run `scripts/verification/verify-actionables-workspace.cjs` with Playwright and Chromium paths in `FETS_PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. The browser verifier is intentionally fixed to the local preview URL.
