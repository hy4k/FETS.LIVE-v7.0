# Calendar layout and insights implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for root integration. Independent model/data and Analytics presentation tasks use superpowers:dispatching-parallel-agents with disjoint files. Steps use checkbox syntax for tracking.

**Goal:** An organised Calendar and a useful, accurate operational Analytics workspace.

**Architecture:** Existing Calendar/seat reads feed a typed pure analytical model. A separate identity-scoped loader/hook and portal-based Analytics UI consume it. The Calendar receives an extracted control/header component while all booking, import and seat operations retain their existing handlers.

**Tech Stack:** Existing React, TypeScript, React Query, scoped CSS, Vitest and pinned Puppeteer; no new packages.

**Spec:** docs/superpowers/specs/2026-11-09-calendar-layout-insights-design.md

## Global constraints

- Frontend only; no database writes/migrations, live test records, permission changes, package installs or upgrades.
- Build from 8d3562d in /tmp/fets-pearson-import on codex/calendar-layout-insights. Deployment checkout/configuration remains untouched.
- All date boundaries are civil ISO dates; today's boundary uses Asia/Kolkata.
- Seat safety always includes all providers, confirmed extra systems and overnight carry-in; preview capacity is excluded.
- Text >=4.5:1 contrast, phone controls >=44px/input text >=16px; test actual global styles and fixed shell at 390/768/1440.
- Auth/branch/range scope changes clear private data; read failures never become zero/safe conclusions.
- Shared types in src/calendar-insights/types.ts are authoritative. No interface changes without root coordination.

## Review focus

- Previous-period/seat-context failure must not erase valid current bookings or produce a false all-clear: data and UI tests.
- Duplicate adjacent source groups and time-varying extra systems must not multiply capacity or counts: model/range tests.
- Unknown providers/centres and invalid/conflicting rows must not become Pearson/Calicut or silently verified totals: model and UI tests.
- Scope switches/late responses/background refresh must not leak old identities or export stale verified figures: real hook/component tests.
- Global mobile universal transforms/dialog/focus rules must not move overlays outside the viewport: focused portal tests plus full browser geometry/contrast.

## Task 1: Analytical model and complete reads

**Own files:** src/calendar-insights/model.ts, model.test.ts, data.ts, data.test.ts, hooks.ts (relative to fets-point).

**Consumes:** frozen types; SeatSession/SeatContext; existing fetchCalendarRange, fetchSeatPlanningRange and seat engine.

**Produces:**

- indiaToday(now?:Date): string.
- calendarMonthRange(startMonth:string,endMonth?:string): InsightRange; throws for invalid/reversed/>12-month ranges.
- volumeForSessions(sessions:SeatSession[],from:string,through:string,today:string): InsightVolume.
- buildCalendarInsights(input:CalendarInsightsInput): CalendarInsightsModel.
- exportCalendarCsv(sessions:SeatSession[],range:InsightRange): string.
- fetchInsightData(range:InsightRange,branch:string): Promise<InsightData>.
- useCalendarInsights(range:InsightRange|null,branch:string): React Query result<InsightData,Error>.

- [x] Write meaningful RED tests: daily throughput of62 in sequential Kochi blocks never becomes concurrent62/31; cancellations, unknown aliases, malformed counts/dates; IST month/year boundaries and zero prior baseline; separate pools; overnight carry-in; full/overbooked windows with confirmed interval-specific extras; duplicate context across chunks; current/prior/seat partial failures; CSV quoting/formula protection. Mock transport boundaries only.
- [x] Implement pure range/volume/model/CSV functions. Deduplicate identical context rows; conflicting duplicates stay incomplete. Do not infer providers from exam names or invent attendance/revenue/utilisation.
- [x] Implement parallel current/prior/context reads with distinct errors. Include previous day for carry-in; previous volume does not require seat context. Scope hook key by user, branch and range; no previous-scope placeholder data, refresh/poll safely.
- [x] Run focused tests, inspect outputs and commit owned files.

## Task 2: Analytics workspace

**Own files:** src/calendar-insights/CalendarInsights.tsx, insights.css, CalendarInsights.test.tsx and replacement src/components/CalendarAnalysis.tsx adapter.

**Consumes:** frozen types and Task1 named exports above. Can import them before Task1 implementation lands, but never mock model/hooks to make UI tests pass.

**Produces:** CalendarInsights component with props {onClose:()=>void, activeBranch:string, initialMonth?:string, onOpenSeatManagement?:(date?:string)=>void, onOpenCalendarDate?:(date:string)=>void}; named adapter CalendarAnalysis preserves existing import contract.

- [x] Write RED component tests using actual model/hooks and auth/data-service mocks: selected-month initial scope; unavailable/partial states; provider identity and no daily utilisation; attention link date; CSV disabled while refreshing; month-range validation; identity/branch switch clearing; portal bounds/initial focus/Escape restoration as unit-testable behaviour.
- [x] Implement calm single workspace: period controls, four volume measures/comparison, action list, daily demand, provider/centre analyses, optional source definitions/CSV. Use weekly aggregates with explicit dates for >62-day charts and retain accessible daily values/links rather than tiny bars.
- [x] Use body portal, local viewport sizing and scoped style resets to defeat global mobile/premium overrides. Preserve current data only during same-scope refresh with an explicit pending state; no stale seat-safety success claim or export.
- [x] Run focused tests and commit owned files. Root owns Calendar header/integration.

## Task 3: Calendar controls and integration (root)

**Own files:** src/calendar-insights/CalendarChrome.tsx, chrome.css, CalendarChrome.test.tsx; src/components/FetsCalendarPremium.tsx and targeted Calendar integration tests.

**Consumes:** volumeForSessions, indiaToday, CalendarAnalysis interface.

- [x] Add RED tests for keyboard/outside-dismiss candidate menu, permission-gated old actions, one provider control and named date/view/search controls; preserve existing real seat integration tests.
- [x] Extract aligned heading/actions, month ledger and two-row period/view/filter toolbar. Remove duplicate filter popover/promotional roster card, retain all original handlers and visible active filter clearing. Scope new CSS to chrome, leaving Calendar grid/SeatManagement unchanged.
- [x] Calendar month totals use shared volume accounting; label all-provider month scope. Normalise 'Today' to India civil date. Analytics opens on displayed month; date drill-down returns to Calendar day/Seat management without writes. Lazy-load Analytics and retain import/manual roster/edit access rules.
- [x] Verify focused integration, diff check, TypeScript and commit.

## Task 4: Review, browser and release

- [x] Fresh independent whole-change review against spec and all five review-focus cases; reproduce/fix material findings with tests.
- [x] Run final full frontend suite. Baseline688:681pass/5knownfail/2skip; compare exact failure names. No repeat broad suites without a change/failure that warrants it.
- [x] Build production and check fixture exclusion. Offline real-component browser evidence at390/768/1440 with full global styles, realistic fixed shell, partial/empty/error states, geometry/focus, no overflow and contrast. No live business writes.
- [x] Inspect current running image/config and preserve rollback/archive. Frontend-only guarded switch, public routes/assets and actual lazy Calendar/Analytics module import checks, runtime/config/other-service comparison, receipt.
- [x] Focused draft PR base codex/prometric-institute-outreach; attach PR. Preserve worktree and existing records.


## Verified release

Deployed frontend `5cff4c3` in `20261109T112835Z-calendar-insights`; draft PR [#57](https://github.com/hy4k/FETS.LIVE-v7.0/pull/57). See the deployment receipt and staff guide in `docs/deployments/2026-11-09-calendar-insights.json` and `docs/operations/calendar-analytics.md`.

Final TypeScript/build passed. Frontend suite 766: 759 passed, the same five baseline Calendar-mapping/Chat failures, two skipped; all 78 added tests passed. Offline browser 296 checks, three widths, minimum measured text contrast 4.54:1, no failures/errors/external requests. Production 65 public routes/assets and real lazy application/Analytics modules verified. No database, business-record or dependency changes.

Browser/review follow-ups corrected India civil-date navigation, mobile candidate-menu bounds/stacking, booking-dialog viewport/contrast, cancelled day/provider/session-badge totals, and Details/Edit keyboard focus. Existing pure Calendar view helpers now preserve their DOM across dialog-state updates; editing presents one visible panel. These corrections retain cancelled records for inspection and all existing roster/import/session tools.

The original running configuration and rollback image were saved before changes; runtime files, routing, mounts, ports, networks and other services were compared after the frontend-only switch. Rollback and exact verification paths are in the receipt.
