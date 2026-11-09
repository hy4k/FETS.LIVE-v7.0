# Prometric institute outreach implementation plan

> Use superpowers:executing-plans for root integration; delegate independent UI/database work under dispatching-parallel-agents. Checkboxes record completion.

**Goal:** Consultative CMA institute outreach with accountable follow-ups and separate incoming/platform mock candidate pipelines under client Actionables boxes.
**Architecture:** Private owner/manager-scoped records and checked versioned RPCs; identity-scoped React Query adapters; one Prometric workspace plus existing Pearson view behind a client landing page.
**Tech stack:** Existing React/TypeScript, Supabase, Vitest/PGlite and pinned Puppeteer. No package changes.
**Spec:** docs/superpowers/specs/2026-11-07-prometric-institute-outreach-design.md

## Constraints/review focus

One owner/institute, canonical User Management/Actionables authority and manager oversight. Preserve all existing Pearson/mission/Calendar/candidate/seat data. No external outreach, student contact collection, false sponsorship or price promises. Incoming candidate counts, platform counts and estimates/confirmation/attendance remain distinct; no automatic registrations. Calls append-only/idempotent, one open follow-up, DNC suppresses outbound work, stale versions/reassigned owners cannot mutate.

## Interfaces

Contracts in src/outreach/types.ts are authoritative. RPCs: outreach_context() -> OutreachContext; outreach_detail(p_institute_id,p_before,p_before_id) -> OutreachDetail (50 calls/page, stable cursor); outreach_save_institute(p_payload jsonb) -> OutreachInstitute; outreach_record_call(p_payload jsonb) -> {call_id,institute:OutreachInstitute}; outreach_save_batch(p_payload jsonb) -> MockBatch; outreach_update_followup(p_payload jsonb) -> OutreachFollowup. Payloads correspond exactly to InstituteInput/CallInput/BatchInput/FollowupInput. Dates are ISO; follow-up times use explicit timezone/IST UI.

## Tasks

- [x] Database: CLI-created migration/private RLS institutes,calls,followups,batches; canonical authority helpers, owner/staff-manager scope, versioned/idempotent atomic workflows and stable scoped reads. PGlite RED/GREEN authorisation, DNC, duplicate/reminder/candidate math, stale/reassignment and unchanged-existing-row tests. No live test rows.
- [x] Prometric UI: responsive overview/institute detail/call guide/forms, dated follow-up queue and history pagination. Real-component tests with service-boundary mocks. Empty/retry/read-only/access-denied/stale/reassigned-owner states. Files confined to outreach UI components/styles/tests.
- [x] Root: API/type validation/cache, candidate/follow-up selectors and IST math, supplied-draft staff scripts/branches; client landing/back links and News-preserving integration. Tests before product implementations.
- [x] Review: fresh whole-feature review, material RED/GREEN fixes, complete frontend suite (baseline5 failures), DB regressions and desktop/mobile browser evidence.
- [x] Rollout: inspect current image/config, preserve rollback, additive API and Live frontend only, no original records changed. Verify public assets/modules/runtime and retain receipts; new focused draft PR stacked on completed seat branch.

Builder choices: no invented institute leads/targets/prices. Name+city normalisation prevents exact duplicate institutes; phone/email matches get review hints. Batch name+delivery+planned date scopes prevent duplicate cohort totals. Counts0..10000, note/text bounds, script content local versioned source. One explicit next action or close reason for every logged interaction; completing without replacement creates a visible needs-next-step flag. No deletion of history. Existing News alias stays on its prior MissionWorkspace.
