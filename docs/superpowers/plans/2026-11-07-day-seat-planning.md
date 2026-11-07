# Flexible daily seat planning implementation plan

> **For agentic workers:** Use superpowers:executing-plans for root integration, with independent math/API work delegated under dispatching-parallel-agents. Steps use checkbox syntax.

**Goal:** Let staff plan small per-day exam rearrangements and preview/confirm temporary extra workstations.
**Architecture:** Optional capacity windows extend the boundary sweep; one atom solver supports provider rules and per-exam day limits. A daily workbench owns local previews. A protected additive API persists only additional capacity and supplies it to every Calendar calculation.
**Tech Stack:** Existing React/TypeScript, Supabase, Vitest/PGlite, cached Puppeteer.
**Spec:** docs/superpowers/specs/2026-11-07-day-seat-planning-design.md

## Constraints and review focus

40Calicut/31Kochi installed; all providers share each pool. No booking/candidate writes, no invented duration, no cross-centre/date capacity leak, no auto-rescheduling. Only canonical Calendar editors confirm systems; versioned saves. Uncertainty is never green. Same-day capacity intervals are half-open. Started/past/source-inconsistent rows stay fixed. All stale previews clear. Existing public functions/signatures remain compatible.

## Task 1 — Calculation extension

Files: seats/types.ts (root-owned contracts), engine.ts/solver.ts and tests, new day-plan.ts/tests. Add optional SeatCapacityWindow[] to analyseDay/analyseAtoms; per-segment capacity only when extended capacity is used. Export findAtomSuggestions(atoms,baseline,branch,date,rules,options). Daily limits override provider defaults; manual preparation validates duration/count/clock/locks and marks moved atoms fixed. Tests RED/GREEN cover capacity expiration, exactly-full handoffs, gaps, full-duration fits, locked/started/manual groups, independent provider/date scopes and no new conflicts elsewhere. Preserve old tests.

- [x] RED tests, implementation, GREEN focused suite and commit owned math files.

## Task 2 — Shared additional systems

Files: CLI-created migration, scripts/tests/calendar-seat-capacity.mjs. New calendar_seat_planning_context RPC composes existing anonymous snapshot with capacity_adjustments. save_calendar_seat_capacity accepts centre,date,extra count,from/until,note,expected version. Private RLS table, checked entrypoints, fixed paths, canonical authority, scope locking and version checking. Test actual production columns, anonymity, revoked access, alias scoping and unchanged business fingerprints; no live test rows.

- [x] RED SQL tests, implementation, GREEN tests and commit owned DB files.

## Task 3 — Workbench and integration

Files: new DaySeatPlanner.tsx/tests, CapacityEditor.tsx/tests; existing SeatManagement/Timeline/badges/API/context/CalendarAnalysis. Root integrates. Replace default provider-only workflow with daily controls; retain reusable rules under a separate section. Add manual starts, per-exam locks/limits, reset, original/preview timeline and ranked auto options. Capacity preview and explicit confirmation have distinct labels; shared extras update badges/booking checks and exact interval capacity labels. Accessible mobile layout uses current theme.

- [x] Write failing behaviour/API tests, implement, GREEN focused tests and TypeScript; production build passed.

## Task 4 — Review and rollout

- [x] Fresh independent whole-feature review, fix material findings.
- [x] Full frontend suite once (baseline5 failures), SQL and Pearson regressions as relevant; real-browser desktop/mobile interactions and overflow/contrast.
- [x] Inspect production anew, save configuration/rollback image; publish additive capacity API and frontend only. Verify business fingerprints, permissions, public assets/modules, runtime invariants.
- [x] Receipt, update draftPR55 and attach; report concrete usage and remaining limits.
