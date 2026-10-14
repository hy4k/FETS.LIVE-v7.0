# Clear Actionables — deployed release

This release follows the supplied Actionables feature structure with an institution-first landing page and a restrained blue/white design. It removes the added dashboard, slogans and separate personal-work navigation. It uses the user's supplied `actionablesacca.html` as a factual reference, not as executable application code. It is stacked on the existing Shift work in PR #33. The website was deployed on 14 October from commit `3237999e3af7841293fd5ba36b38848d108eb0c8`. The FETS Live backend migrations, access controls and Realtime publication were installed and verified.

## Source data and behavior

- The supplied array contains **25 institutions**, despite the source heading saying 23: Ernakulam/Cochin 5, Thrissur 6, Calicut 6, Kannur 4 and Kottayam 4. Names, addresses, PIN codes, phone numbers, nodal roles, capacities, statuses and readiness percentages are preserved as immutable reference snapshots. Cochin maps to the existing Ernakulam district enum.
- The five original team tasks retain their wording, squad assignments, priorities and two todo / two in-progress / one done states. The completed source task has no invented completion author or evidence. Converting another source task to daily work requires a real named owner, due date and reporting recipient; in-progress tasks remain in progress.
- Source percentages and Certified statuses remain visible as recorded facts. No individual readiness observations, approvals, stage completions, personal owners, shortlist choices or operational results are inferred from them.
- The current FETS Live data inspected during preparation contains RIT KOTTAYAM, three assignments, two results and seven stage guides. These remain intact and appear as other saved work alongside the imported catalogue. Existing contact details win when an institution already exists; its supplied snapshot remains available separately. Ambiguous duplicate name/district matches stop the import.

The landing page shows all 25 institution cards immediately, with search, district counts and direct Details, Audit and Select centre actions. Six plain tabs match the source feature structure: Institutions, Selected centres, Exam programmes, Audit, Tasks and Resources. The Tasks owner filter includes My tasks and uses the staff-profile ID rather than the authentication-user ID. Finished duties with pending follow-up or reporting remain visible. Date-only deadlines use India dates; timed follow-ups respect their actual time.

Institution cards expose contact details, type, PIN, capacity, status and the supplied readiness score. The existing institution stages remain available inside Details. The shared Audit tab has a selected-institution field and retains that selection after recording findings. The team board retains its three source task columns, displays source-linked duties only once, provides status/owner filters and supports adding a named task with an explicit institution and reporting recipient. Readiness observations require evidence and retain prior entries, actor snapshots and server timestamps. Shortlist decisions are management-only, append-only, serialized and limited to seven; stale decisions are rejected. Guides retain the supplied ten audit criteria and fifteen programmes, link current provider guidance and offer an adjustable estimate using actual recorded capacities. Internal observations and planning estimates do not establish provider approval or guaranteed bookings.

## Database installation

Installed only on **FETS Live `qqewusetilxxfvfkmsed`**. The prepared SQL contents are unchanged; local filenames now match the actual migration-history versions. Do not apply these again:

1. `supabase/migrations/20261013211421_actionable_rollout_and_readiness.sql`
2. `supabase/migrations/20261013211431_import_supplied_actionables_catalogue.sql`
3. `supabase/migrations/20261014081340_actionables_realtime_updates.sql`

Prerequisites are the existing expansion/work tables, `staff_profiles`, `fets_is_active_staff`, the stage/results/report-recipient migration `20261001220000_simple_institution_actionables.sql`, its delete RPC and stage seeding trigger. All three migrations are transactional. The third adds the six existing shared-work subscriptions to the Realtime publication, including audit observations and shortlist history; it writes no operational records. No existing users, duties, results or reports are deleted by installation. The second migration imports source facts and stage guides, not fabricated completion history.

Preparation found broad existing staff-profile write policies. The new project cannot safely use browser-editable profile roles for management authority. A private membership roster is seeded once from existing linked staff profiles; the installed roster matches all 12 existing linked profiles (eight enabled managers, two enabled staff and two disabled staff). Protected membership supplies the canonical profile ID, project role and name. Project records require enabled membership. The private schema is not an API-exposed schema; a guarded read-only RPC supplies the directory.

A profile trigger protects account identity, role, active status and permissions. Management-approved profile changes provision/revoke project access; normal self edits and delegated HR basic contact edits remain available. Delegated HR cannot grant roles, permissions or activation. Pending self-created profiles receive no project access until management approval. Operator/service-role administration remains possible. This changes staff-administration permission enforcement and should be reviewed with the current administrator roster. Existing broad profile SELECT policies are outside this release: it does not claim to resolve all legacy staff-data privacy issues.

New history tables remove inherited UPDATE, DELETE and TRUNCATE privileges for browser roles. Source snapshots cannot be replaced by clients. Source duties and stages cannot be moved into the legacy scope to bypass project access. Named source-duty owners and reporting recipients must be approved active project colleagues. The current capability response is checked on load and refresh; an access denial hides previously cached project records.

The frontend disables shortlist and observation actions if the extension RPC is unavailable. All required migrations are installed. The guarded VPS release process retained the previous image and rollback release, preserved Compose and Nginx settings, and verified public assets against the reviewed build. An older website can be restored while retaining the additive catalogue/history; do not delete new data or drop migrations as a website rollback.

FETS Online `ueufcqmdqtwvhjjyudeu` and Android PR #31 are unchanged. Online rota synchronization was not validated as part of this Actionables change.

## Validation

- TypeScript and production Vite build passed. Existing chunk-size and Browserslist warnings remain.
- 26 targeted frontend tests passed, including staff identity, pending follow-up, source states, failed saves, staff/manager controls and cached-data access revocation, institution-first navigation and task creation.
- 18 disposable PostgreSQL/PGlite checks passed against enum-backed institution fields and the real stage/results prerequisite migration. They cover exact snapshots, preservation of prior records, grants/RLS, actor/time enforcement, evidence, stale writes, seven-centre limits, source immutability, task conversion staff approval/revocation and the six-table Realtime publication.
- Browser journeys passed at 1440, 768, 393 and 320 pixels without horizontal overflow or browser errors: catalogue search, shortlist, evidence, gap follow-up, named assignment, result recording, team follow-up, separate exam programmes, shared field-audit selection and planning.
- Supplied phone numbers and task titles, and the local preview entry, are absent from production assets. The production screen loads business facts from the access-controlled database.

`fets-point/actionables-preview.html` is a development-only entry with actual source records and an in-memory repository. Its generic account selector is a technical preview control, not a fabricated source staff member. Browser verification writes only local memory and blocks Supabase requests. Clean screenshots show the supplied state; verification screenshots containing test observations/results are not production evidence. `scripts/verification/build-actionables-preview.mjs` builds a self-contained HTML review file with the supplied data, in-memory edits and no live authentication/database initialization. It sets a network-blocking content policy and works without a preview server.

Reproduce targeted checks from `fets-point` with `vitest run src/redesign/ActionablesWorkspace.test.tsx src/redesign/actionables-model.test.ts src/redesign/institution-workflow.test.ts` and the normal build. Run `scripts/tests/actionables-rollout.mjs` with PGlite 0.3.14 available through `FETS_PGLITE_MODULE`. Start the preview on local port 3011 and run `scripts/verification/verify-actionables-workspace.cjs` with Playwright and Chromium paths in `FETS_PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. The browser verifier is intentionally fixed to the local preview URL.

## Activation evidence — 14 October

The backend import matches all 25 source institution objects and all five source task objects exactly. The original RIT KOTTAYAM is retained, giving 26 saved institutions. The import adds 175 stage guides, with zero invented stage completions, shortlist decisions or audit observations. The three pre-existing duties and two results remain intact. Before/after counts and content fingerprints match across 20 existing tables, including users, profiles, rotas, duty assignments, logs, reports and the original institution/workflow records.

Production SQL role checks verified management authority for existing managers, read/evidence access without shortlist authority for ordinary active staff, and denied project access for inactive accounts. REST checks confirmed anonymous callers cannot invoke the capability RPC or read the source brief/imported catalogue, and the private schema is not exposed. Security advisors reported no new findings relative to the preflight baseline; existing unrelated project warnings remain. Their existing remediation guidance is available in the [Supabase security advisor documentation](https://supabase.com/docs/guides/database/database-linter) and [platform upgrade guide](https://supabase.com/docs/guides/platform/upgrading). No fake operational records were written for verification.

The guarded website deployment completed successfully on `srv1120621`. The public release metadata reports commit `3237999e3af7841293fd5ba36b38848d108eb0c8`; its index fingerprint is `3dd2bbcf6c29948ed86e1048920bfbf1cf491180b06aeccb439db42c3d4aedef`. The deployment's byte-for-byte public asset checks and runtime/environment/port/mount/restart/Nginx preservation assertions passed. A separate public crawl verified 46 JavaScript/CSS assets and `/`, `/calendar` and `/actionables`, including the expected new interface labels and absence of supplied business facts in public bundles. A guest browser loaded the production site without script errors or failed requests. Authenticated production UI writes and live event delivery were not exercised; role authorization was checked read-only with existing identities and complete UI journeys used the isolated preview.

Release directory: `/opt/fets-releases/20261014T075907Z-actionables-3237999`. The previous Shift image, configuration and compressed image backup are retained there. Website-only rollback:

```bash
bash /opt/fets-releases/20261014T075907Z-actionables-3237999/rollback.sh
```

The previous release is `deb779c8435dcad0bc2b6c0f91e3b3ae67aceacf`, with index fingerprint `9a4d7a13a395b84996cb6ce356f83547195d77338eafe0cc5566fbdc858d6a0f`. Rollback retains the additive catalogue and all legitimate database history. The final publication migration and deployment documentation do not change the deployed frontend source. FETS Online authenticated changeover and break-cover synchronization remains unverified; no synchronization success is claimed.
