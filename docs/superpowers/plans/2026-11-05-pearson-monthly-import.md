# Pearson monthly import implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the approved November Cochin records to the original workbook and deliver a reusable duplicate-safe Pearson upload.

**Architecture:** Parse actual workbook cells locally, persist a server-owned preview with target versions, and apply approved identity/session bindings atomically. Store dedicated nullable Pearson candidate metadata and private import history; explicit session membership keeps the existing daily importer from duplicating Pearson calendar entries.

**Tech Stack:** Existing React/TypeScript, ExcelJS 4.4.0, Supabase PostgreSQL, Vitest and isolated PGlite PostgreSQL fixtures.

**Spec:** `docs/superpowers/specs/2026-11-05-pearson-registration-import-design.md`

## Global Constraints

- Only Cochin/Calicut Pearson scope selected by an authorized user. Preserve all other records and runtime configuration.
- No dependency installation or upgrades. Work only in `/tmp/fets-pearson-import`.
- Source attachment, personal data, previews and operational SQL remain private outside Git.
- First approved import: 451 bookings, preserve 35 UUIDs/history and 238 calendar IDs; new bookings 416. Exact source SHA is in the spec.
- Full-month coverage is an explicit declaration. Missing future bookings remain counted pending cancellation review.
- Canonical verified User Management + centre permissions gate every preview/apply/review action. No user-metadata authority, no raw SQL endpoint.
- Preserve personal phone contacts; retain and export the file phone separately.

## Review Focus

- Duplicate source identities, reordered/retried uploads and concurrent apply never create extra registrations.
- Missing email and repeat sittings must not be merged by name/date alone.
- Changed email/name or unique email/code reschedules require explicit binding review.
- Stale previews, changed targets, revoked membership and expired requests fail atomically.
- Pending missing bookings and legacy calendar totals never silently lose counted members.

## Contracts

Shared contract is `fets-point/src/pearson/types.ts`. RPCs:

- `preview_pearson_roster(p_branch text,p_from date,p_through date,p_complete boolean,p_source_as_of date,p_file_hash text,p_filename text,p_rows jsonb)` returns `PearsonPreview`.
- `apply_pearson_roster(p_preview_id uuid,p_candidate_bindings jsonb,p_session_bindings jsonb)` returns `PearsonReceipt`.
- `list_pearson_cancellation_reviews(p_branch text)` returns `PearsonCancellation[]`.
- `decide_pearson_cancellation(p_review_id uuid,p_decision text,p_expected_updated_at timestamptz)` accepts `cancel` or `keep` and returns a receipt/result.

## Task 1: Parser and shared types — root

**Files:** Create `src/pearson/{types.ts,parse.ts,parse.test.ts}`.

**Interfaces:** `parsePearsonWorkbook(filename,bytes:Uint8Array):Promise<PearsonParsedFile>` and types consumed by frontend/backend.

- [ ] Write failing tests for real merges, range parsing, missing dates outside merges, required headers, duplicate identity, two sittings, blank email and contact preservation; run RED.
- [ ] Implement parser using existing ExcelJS, retain whitespace-normalised First+Last without deleting placeholder surnames, date/start/end per row, email/owner/code/title/phone, SHA-256.
- [ ] Run GREEN and parse the real 451-row attachment independently.
- [ ] Commit parser/type contract.

## Task 2: Transactional import engine — database agent

**Files:** New CLI-generated migration, isolated PostgreSQL integration test under `scripts/tests/`.

**Interfaces:** Implement contracts above; private owner-only operational preview/apply entry permits an audited administrative first import without impersonating a signed-in user.

- [ ] Write failing isolated DB tests with synthetic fixture rows and actual legacy sync triggers.
- [ ] Add nullable candidate fields and private tables/functions with fixed search_path and minimal grants; invoker public wrappers, private checked entrypoints. Snapshot both target sets and lock all affected old/new days deterministically using namespace 73109.
- [ ] Implement conservative identity/session matching, explicit ambiguity resolutions, persistent FETS IDs, strict scope/version checks, exact counts, idempotent receipts, source ordering and cancellation review.
- [ ] Keep old provider triggers working while excluding explicitly managed Pearson rows from generic sync and reconciling their bound sessions with end times.
- [ ] Run DB tests RED/GREEN covering full spec, repeat/changed uploads, atomic failure, membership denial and other-provider protection. Report exact migration path and command.

## Task 3: Uploader and Candidate Tracker — frontend agent

**Files:** Create `src/pearson/{api.ts,PearsonImportDialog.tsx,*.test.*}` and integrate in `src/roster/CalendarRosterDialog.tsx`; update Candidate Tracker display/search/export of new metadata.

**Interfaces:** Use shared contract/parser; preserve daily/manual CMA behavior. Monthly coverage, explicit centre, source-as-of and complete-snapshot checkbox; preview proposed bindings/counts, resolve ambiguous rows/sessions before apply, missing-future review UI and receipt. Invalidate both candidate and calendar query keys.

- [ ] Write failing tests for monthly mode, reviewed ambiguity bindings, stale preview reset, errors and cache refresh.
- [ ] Implement accessible UI using existing styles, metadata display/search/export including exact source phone. Do not change unrelated AI/roster functionality.
- [ ] Run focused tests GREEN and TypeScript check; commit owned files only.

## Task 4: Approved live reconciliation and release — root

**Files:** Private operational snapshot/SQL under `/root/.codex/artifacts/pearson-review-20261105/`; sanitized deployment receipt under `docs/releases/`.

- [ ] Review complete feature with a fresh reviewer; fix material findings with regression coverage.
- [ ] Build and run appropriate tests including full suite once; record pre-existing unrelated failures separately.
- [ ] Snapshot live schema/functions, all scoped candidates/calendar, broader business fingerprints and running frontend/config/rollback image. Verify no drift before applying migration.
- [ ] Run trusted preview against the original 451 rows. Supply the now-approved 35 candidate and 238 session bindings; inspect exact planned result. Keep private rollback snapshots and recheck original workbook hash.
- [ ] Apply once atomically; verify all source fields, 451 IDs, 238 session memberships/totals, existing history and unrelated fingerprints. Repeating same import returns receipt without mutation.
- [ ] Deploy only the frontend with old assets/config retained, verify public routes/assets and isolated authenticated component behavior. Confirm new email/code metadata and calendar totals in both read paths.
- [ ] Create/attach draft PR and give concise factual completion report.
