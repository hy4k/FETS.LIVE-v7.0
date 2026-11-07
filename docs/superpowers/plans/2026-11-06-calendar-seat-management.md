# Calendar seat management implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Provide exact shared-pool seat alerts and reviewed timing simulations directly inside Calendar.

**Architecture:** A pure interval engine uses complete Calendar reservations and optional anonymous source detail to calculate exact occupancy, booking fit and ranked bounded simulations. An inline Seat management view shares that engine with Calendar date badges; a small protected rules/context API persists only configuration and exposes no personal candidate fields.

**Tech Stack:** Existing React/TypeScript, Supabase PostgreSQL, Vitest, isolated PGlite and existing Puppeteer image; no dependency changes.

**Spec:** `docs/superpowers/specs/2026-11-06-calendar-seat-management-design.md`

## Global Constraints

- Shared pools: Calicut40 and Cochin31. All providers count; never combine centres.
- Zero post-exam buffer, scheduled start/end half-open intervals; no invented earlier setup or exam duration.
- Unset provider/exam rules are fixed. No automatic rescheduling or candidate/calendar business writes.
- Existing Pearson import/history/provenance and original dirty deployment checkout remain intact.
- Work in existing isolated `/tmp/fets-pearson-import`, branch `codex/calendar-seat-management`, baseline3b6e8a4. No dependency installation or updates.
- Canonical verified centre membership gates context; calendar-edit authority gates shared-rule changes. No editable JWT user metadata in authority.
- Source intervals with missing/equal times (earlier ends are next-day continuations), invalid counts, unknown branches or conflicting IDs must not produce a safe availability claim.
- Complete scoped stable pagination; provider/search presentation filters cannot hide occupancy.
- Shared types are `fets-point/src/seats/types.ts`. ISO local dates + wall-clock strings use Asia/Kolkata; absolute seconds use UTC arithmetic only as a local day index, never browser timezone conversion.

## Review Focus

- Exactly-full handoffs and one-minute/second overlaps must be calculated at every boundary.
- Source-linked exam subgroups replace counts, never add them; missing/different source counts cannot justify individual shifts.
- Suggestions preserve all unshifted members and duration and never introduce/increase a conflict elsewhere, including an adjacent date.
- Failed/stale/partial reads, unknown timing and absent rules must be visible rather than green availability.
- Every date/centre/rule/input refresh clears stale suggestion state; rule saving is versioned and permission-checked.

## Task 1: Interval engine and simulation — calculation agent

**Files:** `src/seats/engine.ts`, `solver.ts`, and their tests. Shared types below are authoritative.

**Interfaces:** `analyseDay(sessions,branch,date,details?) → SeatDay`; `checkBooking(day,request) → BookingFit`; `findSuggestions(sessions,branch,date,rules,details?,options?) → SeatSuggestions`; helpers `normaliseProvider`, `formatSeatTime`, `sessionAtoms` may be exported as needed and agreed with root.

- [x] Write/run RED tests for boundaries,exactly-full,allproviders,invaliddata,globalisolation,sourcecountreplacement/subgroupfallback,retakes and cancelled/zero seats.
- [x] Implement deterministic exact boundary sweep, issues and planned source confidence.
- [x] Write/run RED tests for fixed/provider/exam overrides,earlier/later limits,subset moves,duration preservation,multi-window recheck,no feasible or partial solution,running/past seats and adjacent-date safety.
- [x] Implement a deterministic bounded search with explicit budget/depth result, at most3 ranked suggestions; never claim exhaustive impossibility.
- [x] Run GREEN synthetic tests, report commands and commit owned files.

## Task 2: Protected shared rules/context — database agent

**Files:** CLI-created migration + `scripts/tests/calendar-seats.mjs`.

**Interfaces:** `calendar_seat_context(p_branch text,p_from date,p_through date)` → `{rules: SeatRule[],details:SeatDetail[],adjacent_sessions:SeatSession[],can_edit_rules:boolean}`; `save_calendar_seat_rule(p_branch text,p_provider text,p_exam_code text,p_exam_name text,p_earlier_minutes int,p_later_minutes int,p_expected_updated_at timestamptz)` → SeatRule. Null expected version means create; exact version required on update. Empty specific exam is provider default. Rules remain0/0 fixed when unset. Rule earlier/later0..120 integer. Specific code/name mutually exclusive. Context returns only source-linked anonymous grouping (session/date/start/end/branch/provider/code/title/count/status), no candidate IDs/names/contacts. Rules shared per centre, editor identity protected server-side.

- [x] Write/run RED isolated SQL checks for auth,verifiedmembership,centre/read authority,calendar-edit permissions,anon/core denial,optimisticstale saves,normalisedunique scopes,invalid limits,and no business mutation.
- [x] Add RLS/private tables,invoker public wrappers and checked private entrypoints with fixed search_path/minimal grants, no generic mutation endpoint.
- [x] Context source detail query must agree with existing managed Pearson active/cancelled semantics and coverage, and return no personal fields.
- [x] Run GREEN including SuperAdmin and ordinary permitted roles; commit owned files. Do not publish migration yourself.

## Task 3: Inline view — UI agent

**Files:** `src/seats/SeatManagement.tsx`, `SeatTimeline.tsx`, `SeatRules.tsx`, scoped CSS and tests. Root owns engine types/API/Calendar integration.

**Interfaces:** `<SeatManagement sessions={SeatSession[]} currentDate={Date} branch={string} userId={string} onSelectDate? onRefresh?>`; use `useSeatContext(branch,from,through)` and `saveSeatRule` from `api.ts` (root supplies); consume engine signatures above. Source load/error flags may be added as agreed. No booking-write API calls.

- [x] Write/run RED component tests for exact window list,globalcentre separation,known/unknown times,booking checker,unconfiguredrules,versionedsaves and suggestions clearing on date/rule/input refresh.
- [x] Build responsive timeline-first layout using current Calendar theme; expose exact values in text/table for keyboard/mobile users; distinguish full vs overbooked and original vs simulation.
- [x] Provide editable provider/code/name rules only when context can_edit_rules, simulation window inputs, before/after suggestion view and explicit review-only wording. Context failure keeps base Calendar visibility but disables rule-based recommendations.
- [x] Run GREEN/TypeScript, commit owned files. No live writes/deployment.

## Task 4: Data loading and Calendar integration — root

**Files:** `src/seats/api.ts`, `useSeatContext.ts`, tests; `hooks/useCalendarSessions.ts`, `components/FetsCalendarPremium.tsx`, `CalendarAnalysis.tsx` and focused tests.

- [x] Test RED then fix complete stable pagination and scoped legacy fallback; load adjacent-day data where needed; preserve raw provider identity in calculation inputs; presentation labels stay in the Calendar.
- [x] Implement anonymous context loading and versioned rules API adapters. Cache keys include branch and date window; support global two-centre context without assuming permissions for another centre.
- [x] Add Seat management view/button inside Calendar, exact peak/full/incomplete month badges from unfiltered sessions, errors/refresh indicators and selected-day deep links. Navigation treats seat mode as month scope.
- [x] Replace misleading daily-total capacity colouring and align old Overlap analysis with the shared engine, preserving unrelated analysis totals and existing roster uploads.
- [x] Verify all focused/new tests and TypeScript/build. Full suite once, distinguish known5 baseline failures from regressions.

## Task 5: Review, visual verification and guarded rollout — root

- [x] Fresh whole-feature review; reproduce/fix material findings with regression checks.
- [x] Read-only live schedule comparison for Calicut13Nov50/40 and Kochi14Nov35/31 and current missing-times cases. No fabricated live records, no actual exam reschedules.
- [x] Real-browser synthetic checks at1440/390px for all main controls,global/centre views,rule-save denial/success,suggestion before/after and no body/modal overflow. Show the resulting organisation clearly to the user.
- [x] Inspect running frontend/config and save rollback image/metadata before deployment; publish only reviewed additive settings API + Live frontend, verify no business row fingerprints changed.
- [x] Verify https://fets.live, public new module exports/routes/assets and runtime invariants. Preserve original .env/compose/nginx and other services. Commit sanitized verification/receipt, draft PR, attach PR.
