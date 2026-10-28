# FETS Sites staff access

FETS Sites was visible when enabled in User Management, but the database capability and record policies still required an administrator profile plus a separate trusted Auth role. That rejected enabled staff and some administrator accounts before the page loaded.

The shared database gate now checks a confirmed signed-in user, an active staff profile and the management-owned `ws_system-manager` switch. The administrator-only Auth-role requirement is removed for this feature. An explicit false remains authoritative for every role. New staff default to Sites access; Home and User Management use the same default in the accompanying frontend change. Other application permissions and Auth roles are not granted by Sites access.

The existing policies and audit trigger use this gate for centre profiles, rooms, programmes, documents, renewals, mobile deployments and history. Existing evidence validation, attributed history, immutable centre identities, archive behaviour and concurrent-edit protection remain. Enabled staff can use the existing page immediately after the database change by clicking Retry or refreshing; the current production website already sends the correct capability request.

## Production backend

Applied only to FETS Live `qqewusetilxxfvfkmsed`, using the connected Primary Supabase account. Migration: `20261028043206_fets_sites_staff_access.sql`. No FETS Online changes and no production test account, room, document, approval or deployment was created.

The production function definition and grants were read back: the private helper has a fixed search path, denies anonymous execution and grants authenticated execution; the public capability remains an invoker function. Security advisors reported no Ascender/Sites finding. All related source-table SELECT grants and policies were also inspected.

Eligibility from the saved production settings is eight confirmed active accounts with Sites on, one active account explicitly off and four inactive accounts. The existing on/off selections are preserved. Profile records changed concurrently during validation, including role changes; the migration performed no profile writes and does not require promoting anyone. Centre records retained checksum `296e859427c92e5d28a52cde3ff25845`; history remains empty. No concurrent management edits were reverted.

## Validation

- 13 isolated PostgreSQL checks reproduce the old rejection, then cover enabled ordinary staff, default access, explicit off settings, inactive/unconfirmed/non-staff users, ignored editable user metadata, site/room/renewal saves, audit attribution, evidence requirements, concurrent edits, revocation and protected profile/Auth administration.
- 20 frontend checks cover the Sites default/override, repository capability success/denial/failure, Home permissions/navigation and existing centre validation.
- TypeScript and Vite production build.

The focused branch is based on the current landing release and does not include the pending My Desk redesign in PR #47. The small frontend default/copy update is prepared but not deployed because the VPS Desktop Commander device is offline. The substantive database access fix is already live and works with the currently deployed website for accounts enabled in User Management.

## Website deployment update

The frontend permission default and wording are now deployed as part of release `20261028T062113Z-sites-d712bae`, verified on 28 October 2026. See `2026-10-28-fets-sites-flexible-forms.md` for the combined Sites release and its production receipt. Earlier counts and checksum values above describe the access-fix verification at that time; subsequent staff edits were retained.
