# FETS Sites: optional questions and General Inventory

Each centre section now has **Edit questions**: rename, remove or restore an existing question, and add text, long text, number, date, web link, email, Yes/No or choice-list questions. Settings apply to that centre and section. All entry answers are optional. **Clear answer** clears the current form value; it is persisted only when Save succeeds. Removing a question preserves its saved answers so they return when restored.

**General inventory** has quantities, units, categories, locations, notes and the same configurable extra questions. Add, search, edit and delete items. **Show deleted items** provides Restore. Deletion removes the item from the current list while retaining its audit history. Duplicate active item names in the same category/location are rejected. Unknown quantity stays blank; an explicit zero stays zero. The register starts empty: no counts were inferred from the older computer records.

Existing centre records, room identities, programme references, documents, renewal links, deployments and history are retained. Internal IDs and centre identity cannot be changed. Server validation still checks supplied answer types, HTTPS links, nonnegative whole inventory quantities, capacity consistency and date order. Audit actor/time/version are server-owned; stale edits cannot overwrite a newer version.

The old form-only evidence requirements for an approval/readiness declaration and deployment closeout were removed to allow optional answers. This administration register does not grant client approval or alter client instructions, exam delivery checks, staff shifts or FETS Online monitoring.

## Backend

Applied only to FETS Live `qqewusetilxxfvfkmsed` through Primary Supabase: `20261028061819_fets_sites_flexible_forms_inventory.sql`, following the existing staff-access migration `20261028043206`. All existing Sites rows and audit history retained matching before/after checksums. No production test questions, answers or stock records were created. The new tables deny anonymous access, require an active confirmed staff account with Sites enabled, and grant no ordinary hard deletion or history rewriting. Security advisors reported no finding for the changed objects; newly created FK indexes have informational unused-index notices before first use.

Details and migration hashes are in `2026-10-28-fets-sites-backend.json`. FETS Online was not changed.

## Validation and release

- 19 isolated PostgreSQL checks: optional fields, retained data, custom answer validation, removal/restoration, actor attribution, denied access, duplicate stock and stale edits.
- 28 frontend tests, TypeScript and production build.
- Browser workflows at 1440, 768, 390 and 320 pixels: question removal/restoration, custom date answers, inventory creation/edit/deletion/restoration, answer clearing, failed-save recovery and centre isolation; no page errors or horizontal overflow.
- The guarded release script `scripts/releases/deploy-fets-sites.sh` checks the current public release and image, retains the rollback image/configuration, builds the exact reviewed commit, evaluates the compiled application module, verifies public assets, and compares runtime/Nginx configuration.

Website deployment is pending the guarded release run. This branch includes the staff-access frontend fix in PR #48; the separate My Desk redesign in PR #47 remains on its own branch.
