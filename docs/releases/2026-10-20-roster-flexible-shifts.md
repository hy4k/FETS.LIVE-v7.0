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

## Rollout status and procedure

Prepared on `codex/roster-flexible-shifts`, based on `1f11bbcfeb5d7120daa59947e4ba1efc996b7764` / PR #36. Main and the parent branch were rechecked and had no newer changes at preparation time. This branch includes the earlier deployed application work; do not deploy old main over it.

**Not deployed. The migration has not been applied.** Desktop Commander reports srv1120621 offline. Deploy the database and frontend together once remote access is restored:

1. Recheck GitHub heads and the running `/opt/apps/fets-live` deployment/container. Retain its image, resolved Compose configuration, runtime settings and Nginx configuration in a dated rollback release. Reuse the existing deployment procedure; do not replace server configuration.
2. Recheck Live migration history/schema and capture baseline counts and original-column data fingerprints. Apply the named migration to Live only, then verify its grants/functions and unchanged pre-existing records. Do not apply anything to the Online project.
3. Build this reviewed commit with the existing production environment. Start and inspect a candidate before switching the app. Preserve runtime ports, mounts, restart policy and proxy configuration.
4. Compare every public asset with the candidate build and inspect the live roster/attendance page. Verify authenticated reads and permissions without fabricating attendance, claims or schedules.
5. Keep the previous image and rollback command. On frontend failure restore the prior image/configuration. Retain additive schema and newly entered data; never drop new tables or truncate numeric OT as an automatic rollback. If a new trigger needs disabling, preserve its data and review that targeted rollback separately.
