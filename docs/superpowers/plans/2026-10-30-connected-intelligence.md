# Connected FETS Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make the existing AI controls, persistent memory, chat history, operational actions and telemetry work together in the deployed FETS Live app.

**Architecture:** Extend the caller-authenticated `fets-ai-agent` backend. Preserve existing AI records; harden their access rules and add owner-scoped conversation and append-only action stores. Execute explicitly requested case/task/calendar actions through an atomic, narrowly scoped database operation with per-call control checks and idempotency.

**Tech Stack:** Existing React/TypeScript, Vitest, Supabase Edge Functions and PostgreSQL; existing Gemini and optional Anthropic credentials. No new model provider or paid dependency.

**Spec:** `docs/audits/2026-10-30-fets-intelligence-audit.md`, approved by the user's instruction to proceed.

## Global Constraints

- Work from the exact deployed frontend commit `1a114e26c38efce34faba9d7ca28dce30be21af8`; preserve the dirty server checkout and runtime configuration.
- Existing memory/knowledge/history must remain. No real operational record is created for testing.
- Keep caller authentication and trusted centre membership; no arbitrary-table tool, role changes, attendance fabrication or approval bypass.
- Operational ON means execute explicit permitted user requests without a second confirmation. OFF is checked on the server immediately before each write.
- Start with cases, tasks and calendar sessions. Read current Shift data; keep report submission and physical checks in their existing workflows.
- Pinned applicable memories are supplied to every text request and voice setup, independently from on-demand policy search.
- Never print credentials; preserve current provider/model intent and reject unavailable provider selections clearly.
- Deploy only the Live frontend and its reviewed AI backend/migration. Preserve frontend and function rollback artifacts.

## Review Focus

- Account/centre changes during requests must discard stale results and never send another scope's history.
- Retried requests must return the saved result without duplicating operational records.
- A control switch during a model/tool loop must block subsequent writes.
- Model output or policy text must never widen tool permissions or count a failed mutation as success.
- A failed memory/history/knowledge query must be visible instead of producing invented empty data.

## Task 1: Database persistence, permissions and atomic actions

**Files:** new migration under `supabase/migrations`, isolated SQL verification under `scripts/verification`.
**Interfaces:** defined in `docs/superpowers/plans/intelligence-contract.md`.
- [ ] Write failing isolated checks for private memory/conversations, shared memory publication, idempotency, kill switch, role/centre checks and optimistic updates.
- [ ] Implement additive persistence, preserve legacy rows, and correct the overly broad legacy policies.
- [ ] Implement exact typed action RPC and memory RPC; verify all allow/deny boundaries and no generic SQL writes.
- [ ] Run the isolated database suite and review the migration.

## Task 2: Connected agent backend

**Files:** `supabase/functions/fets-ai-agent/{index,core,catalog}.ts`, new runtime/provider/persistence modules, backend tests under `fets-point/src/fets-ai`.
- [ ] Write failing tests for settings, pinned context, protected history, action routing, returned evidence and current Shift sources.
- [ ] Implement provider routing, scoped context/history, read and write tools, management actions and live-token memory.
- [ ] Preserve Gemini thought signatures; limit tool loops and classify errors correctly; persist replies before reporting saved success.
- [ ] Run backend tests and Edge Function type checks.

## Task 3: Intelligence UI and floating companion

**Files:** page, Control/Knowledge/Telemetry panels, client types, shared conversation hook and result rendering, floating companion.
- [ ] Write failing component tests for working controls, memory CRUD/history restore and actual result/evidence display.
- [ ] Connect all panels to the active agent API, implement per-account/centre conversation restoration, new chat and history selection.
- [ ] Display actual provider/writes state; disable unconfigured providers; expose pinned memory management and combined knowledge.
- [ ] Keep media explicitly permissioned and give live setup the same saved context.
- [ ] Run focused UI tests and full production TypeScript/build checks.

## Task 4: Review and deployment

- [ ] Review complete diff for authorization, prompt injection, replay races, scope changes, legacy compatibility and leaked fixtures/secrets.
- [ ] Run isolated SQL, targeted frontend/backend, production build and browser fixtures.
- [ ] Save the existing Edge Function, schema/policy evidence, current image and effective config.
- [ ] Apply the reviewed additive migration, deploy the authenticated function, and verify installed code/permissions.
- [ ] Build a candidate frontend on the existing runtime image, verify it, and switch only Live.
- [ ] Verify public assets/routes, real compiled module, backend health and rollback artifacts; record exact proof and verification limits.

## Execution ledger

- Baseline: isolated local clone at `/tmp/fets-intelligence-implementation`, branch `codex/fets-intelligence-connected`; six existing agent tests passed.
- Ruling: User approval of the audit proposal authorizes implementation and its required scoped database changes; the earlier frontend-only deployment constraint applied to the completed OT release.
- Ruling: Use independently owned database/frontend/backend work areas with the parallel-agent skill; keep the API contract fixed and integrate/review before any production mutation.
- Ruling: Task creation uses the application's actual auth-user foreign keys; cases use the installed minor/major/critical severity enum; calendar IDs remain database-generated bigint identities.
