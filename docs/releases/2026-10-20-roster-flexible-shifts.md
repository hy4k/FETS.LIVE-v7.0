# Roster: flexible hours and attendance review

## Behavior

The roster opens directly to the timetable. The old roster/team/average-cover cards, attendance invitation banner and centre aggregate attendance blocks are removed. The page has Schedule and Attendance views, restrained navy/white styling, readable time labels, week/month navigation, staff search and contained table scrolling on phones.

Normal Day is 08:00–17:00 IST. Administrators can save named, centre-specific shifts (including 06:00–15:00 and 11:30–20:30) and assign them to individual dates. Custom shifts retain the existing D payroll code. Evening is removed from new roster choices; historical E records remain intact. Half-day helpers split the selected full shift equally (nine hours becomes four hours thirty minutes), with first/second-half choices. Hours are same-day only. Grace defaults to zero and can be set explicitly per shift; no grace policy is inferred.

Quick Add supports continuous date ranges, selected weekdays and repeating multi-part patterns. Fifteen consecutive leave days are one operation. Existing entries are skipped unless replacement is explicitly selected. Previewed changes save atomically with version checks; a concurrent edit requires a fresh preview. No production roster entries are seeded.

Attendance compares each staff member's actual times with that date's assigned start/end and grace. Existing untimed D/OT entries use the confirmed normal 08:00–17:00 baseline without rewriting them. Other untimed historical shifts remain unassessed. Completed work excludes recorded breaks; open shifts and missing check-outs do not become completed hours. Missing check-ins are review items, not assumed absences. Monthly totals identify the number of usable records; on-time results show their denominator. Daily detail and CSV export retain the underlying dates and times.

Outside-roster time is separate from approved OT. Hourly requests count only the requested portion outside that date's roster, including early starts; approval remains required for company-requested work. Fractional approved hours are preserved in the roster rather than truncated to integers. Existing payroll rates are unchanged. Existing TOIL requests remain supported. Approved swap write paths carry saved shift hours and grace with the shift.

## Database and compatibility

Required **FETS Live only** (`qqewusetilxxfvfkmsed`) migration:

`supabase/migrations/20261020144716_roster_shift_times_and_attendance.sql`

It adds a shift-type catalogue, nullable timing/label columns and versioning, changes approved OT storage to numeric, adds atomic roster saves and server-clock attendance actions, and validates hourly OT against roster hours. Existing schedules, attendance, staff, claims and reports are preserved; no historical records are rewritten and no staff check-ins are created by the migration.

The new catalogue and roster-save RPC retain the existing roster administrator rule (super_admin with mithun@fets.in). Ordinary staff can read schedules and record their own attendance through the new RPC. Existing table-level attendance policies are unchanged; this release does not claim to harden every legacy direct-write route.

Schema/history were inspected on Live. The dependency check for `roster_schedules.overtime_hours` found only its default, with no dependent view blocking the numeric conversion. Recheck immediately before rollout. The latest observed migration was `20261019203942_online_check_provenance_policy`.

No FETS Online schema, walk/DVR check records or published Shift plans are modified. Changing roster hours does not automatically republish a duty plan; a lead must review any affected published plan.

## Verification

- TypeScript app build: passed.
- Vite production build: passed (existing large-chunk warnings).
- 19 roster calculation/pattern tests and four existing payroll tests: passed.
- 17 disposable PGlite database checks: passed, including migration preservation, permissions, stale-edit/transaction rollback, custom punctuality, clock identity, break handling and fractional/outside-hours OT.
- Browser verification at 1440, 393 and 320 pixels: timetable, shift types, custom half day, 15-day leave, failed-save retry, attendance details, offline errors and staff editing restrictions.
- Full frontend run: 216 passed, five failed. The same five failures reproduce on the unchanged base: four `useChat` RPC-mock failures and one `useCalendarSessions` Prometric mapping failure.

Run from the repository root (PGlite and Playwright must be installed, or set the module override environment variables used by the scripts):

```sh
cd fets-point
./node_modules/.bin/tsc -b tsconfig.app.json
./node_modules/.bin/vitest run src/roster-workspace/model.test.ts src/redesign/payroll.test.ts
./node_modules/.bin/vite build
cd ..
node scripts/tests/roster-shift-times.mjs
FETS_PREVIEW_OUTPUT=/tmp/fets-roster-preview node scripts/verification/build-roster-preview.mjs
```

The standalone `Roster-Interactive-Preview.html` uses explicitly labelled fictional data and has no network/database access. It is not a production entry point. For browser checks serve that directory on 127.0.0.1:3015 and run `scripts/verification/verify-roster-workspace.cjs` with `FETS_PREVIEW_OUTPUT` pointing to it.

## Deployment — 22 October 2026

Prepared on `codex/roster-flexible-shifts`, based on `1f11bbcfeb5d7120daa59947e4ba1efc996b7764` / PR #36. Main and the parent branch were rechecked and had no newer changes at preparation time. This branch includes the earlier deployed application work; do not deploy old main over it.

**Deployed and verified.**

- Website commit: `f723e037f1270cb4c70f60b21f01a69b2778c2b4` (application changes from `524b18d`; the following commit adds the guarded deployment script).
- Release: `/opt/fets-releases/20261022T033949Z-roster-f723e03`.
- Running image: `sha256:62fbb78e6bb3b17fb828bec9b0584b3471de712cab958f1e5a2814107af1fd86`.
- Public index SHA-256: `adaa267ae038905ab91cd36d76ac4a06d18c1a4189d2c92928716cf8c781ac4d`.
- Live migration applied as `20261022034519_roster_shift_times_and_attendance` by Supabase MCP, from the unchanged source file `20261020144716_roster_shift_times_and_attendance.sql` (SHA-256 `b4ba34f65b4b8d57978e19d2b9c13e20d0bcad46f55033b6ebed7eb4d52d1bca`).
- Before/after fingerprints match for all original columns in 1,976 roster entries, 755 attendance records, 135 OT/TOIL claims and 12 staff profiles. Auth users remain 17 and duty events remain two. No production records or shift types were seeded.
- Production database checks verified authenticated reads, ordinary-staff roster-write denial, administrator validation and anonymous access denial for the new catalogue/RPCs. Validation used rejected empty batches and a rolled-back transaction; no fake attendance or claims were created.
- All five new functions use invoker security and a fixed search path. The shift catalogue has RLS enabled. Security advisors: eight pre-existing findings, zero new findings. Existing advisories remain outside this release; see [Supabase advisors](https://supabase.com/dashboard/project/qqewusetilxxfvfkmsed/advisors).
- Compared 52 public files/routes byte-for-byte with the candidate, including HTML, `/roster`, `/calendar`, release metadata, JS, CSS and fonts. Runtime environment, ports, mounts, restart policy and Nginx configuration match the previous release.
- Public browser smoke tests at 1440 and 393 pixels returned HTTP 200 and a visible sign-in page with no page errors. No authenticated production browser session was available; authenticated database roles were verified directly, and interactive roster workflows were exercised with isolated fixtures before deployment.
- Previous image `sha256:cd90bf6a647308b0073ba13c1eac22cf9c43e8f3ea391880722fdc6e200cd178` retained as a rollback tag and a 400,489,803-byte archive, alongside previous Compose/runtime/Nginx configuration.
- Website rollback: `bash /opt/fets-releases/20261022T033949Z-roster-f723e03/rollback.sh`. It retains the database and recorded data.
- FETS Online and the existing walk/DVR integration were not changed.

The following rollout procedure was used; it remains a reference for subsequent releases:

1. Recheck GitHub heads and the running `/opt/apps/fets-live` deployment/container. Retain its image, resolved Compose configuration, runtime settings and Nginx configuration in a dated rollback release. Reuse the existing deployment procedure; do not replace server configuration.
2. Recheck Live migration history/schema and capture baseline counts and original-column data fingerprints. Apply the named migration to Live only, then verify its grants/functions and unchanged pre-existing records. Do not apply anything to the Online project.
3. Build this reviewed commit with the existing production environment. Start and inspect a candidate before switching the app. Preserve runtime ports, mounts, restart policy and proxy configuration.
4. Compare every public asset with the candidate build and inspect the live roster/attendance page. Verify authenticated reads and permissions without fabricating attendance, claims or schedules.
5. Keep the previous image and rollback command. On frontend failure restore the prior image/configuration. Retain additive schema and newly entered data; never drop new tables or truncate numeric OT as an automatic rollback. If a new trigger needs disabling, preserve its data and review that targeted rollback separately.

## Runtime incident — 22 October 2026

The initial roster release failed when the authenticated application lazy module was evaluated: `ReferenceError: RaiseCasePage is not defined`. Replacing the old roster section had also removed the adjacent incident component, its shared metadata/helpers, and the Calendar/Roster window registrations. TypeScript did not catch it because the legacy shell uses `@ts-nocheck`; the sign-in smoke test did not evaluate the authenticated shell. The isolated roster preview also excluded that shell.

The prior website image was restored from the retained archive (its local Docker image had been removed). The database migration and all records were retained. The fix restores the adjacent shared code verbatim from the previous base. Production module import now passes locally. `verify-production-shell.mjs` explicitly imports the built lazy application module and asserts its shared exports, without credentials and with external network requests blocked. Deployment now runs it in an isolated, version-pinned browser container before switching. Rollback scripts also reload the archived image automatically if it is missing locally.

Corrected rollout verification is recorded below after deployment.
