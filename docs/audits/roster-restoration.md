# Roster and OT regression restoration

Restored locally from the exact tested source commit `1a114e26c38efce34faba9d7ca28dce30be21af8`, also preserved at `/opt/fets-releases/20261029T191121Z-my-desk-ot-1a114e2/source`. No production changes, schema/permission changes, installs or deployment were performed.

## Root cause

The newer main source removed the complete `roster-workspace` and `desk-workspace` implementations and replaced `RosterPage` with the older concatenated roster. It also stopped loading custom roster labels, start/end times, grace and versions into the shared cache. D1/D2 are compact UI labels derived from each saved working shift's actual hours; they are not separate stored database shift codes. Removing that renderer removed the labels while the live schema still supports their underlying hours.

The same source transition removed the direct OT application entry, `initialKind` routing, roster-aware overtime calculation, half-day period selection, partner-swap consent and the versioned request adapters. The remaining form calculated elapsed hours without excluding the assigned shift. My Time reverted to a legacy fixed-hour panel. These are source regressions rather than evidence that staff data needs rewriting.

## Bounded restoration

- Restored the exact saved `roster-workspace/` implementation, model/display tests and its pure `redesign/shift-lead.ts` dependency. Added one rendered UI test for D1/D2/custom hours and staff read-only controls.
- Restored only the desk time/consent dependencies: `MyTime`, personal date model, time model/repository, related tests, `SwapInvitations`, and their styles. Removed HelpDesk, Vault, News, Shift and other unrelated old screens were not restored.
- Restored `attendance-data.ts`, `useAttendance.ts` and `write-data.ts` from the saved commit; their differences concern current-day roster attendance RPCs, custom-hours-preserving swaps, validated half-day/swap requests and accurate save failures.
- Restored only roster timing fields and application workflow metadata in `live-data.ts`; retained the newer social profile fields.
- In `RedesignShell.tsx`, changed only relevant imports, `RosterPage`, the bounded application functions and the My Desk panel bindings. The current Shift and AI integrations remain in place.
- Kept the current social My Desk layout, member wall, images and four navigation tabs. Added explicit request-type shortcuts inside its existing Leave Application panel, including **Overtime / TOIL Pay**, with the selected request passed to the restored form. My Time again uses saved custom roster hours.

## Existing live dependencies verified read-only

The database exposes `roster_save_batch(p_changes jsonb)`, `roster_attendance_action(p_action text,p_staff uuid)`, `desk_request_submit(...)`, `desk_request_resolve(...,p_version bigint,...)`, and `desk_swap_reply(...,p_version bigint)`. Their existence and signatures were read from metadata only; none was executed. Existing roster/report/request constraints and guards are retained.

The saved roster UI's editor gate remains the established roster administrator identity. This restoration does not widen that authority. Other staff retain their read-only roster. Full account/role/permission changes belong to the separately reviewed User Management work.

## Verification

The new OT shortcut test and restored versioned request adapter tests failed against the regressed implementation before restoration. After restoration:

```text
node node_modules/vitest/vitest.mjs run src/roster-workspace src/desk-workspace src/redesign/MyDeskApplications.test.tsx src/redesign/MyDeskHome.test.tsx --reporter=dot --testTimeout=15000
9 test files passed; 52 tests passed.

node node_modules/typescript/bin/tsc -b tsconfig.app.json
Passed, exit 0; no TypeScript errors.

git diff --check
Passed.
```

Coverage includes D1/D2 legend stability and rendered custom hours, custom-shift late/early attendance, breaks and unknown historic checkout, time ownership, half-day/swap snapshot adapters and rejection behavior, overtime only outside assigned hours, attendance reports, and preservation of current social profile behavior. The 15-second test allowance avoids contention from concurrent integration typechecks; a concurrent run with the default 5-second timeout had two timeouts, with no assertion failures after the ambiguous test selector was corrected. Existing dependency metadata warnings were not addressed because no installs were authorized.

## Remaining integration limits

The full combined application suite, production bundle and browser checks should run after all parallel changes are integrated. No live attendance/request/OT records were created to test persistence. The restored roster's existing lead display prefers published v2 day leads when present before its centre-plan fallback; the current Shift route uses centre planning tables, so any future unification should be a separate explicit change. No data or historical shift values were rewritten.
