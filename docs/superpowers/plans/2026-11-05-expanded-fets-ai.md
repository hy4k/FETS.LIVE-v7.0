# Expanded FETS AI Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add concrete unsupported FETS Live operations under the caller's existing authority, with sensitive changes prepared for human review.

**Architecture:** Implement one explicitly named domain connector at a time. A closed operation registry supplies schemas, reads and permissions; no arbitrary table, SQL or RPC dispatcher is exposed. Review preparation and execution are separate, and only a deliberate authenticated app action can approve an exact, current proposal.

**Tech Stack:** Existing React/TypeScript, authenticated Supabase Edge Function, current domain RPCs and PostgreSQL rules, Vitest and isolated PostgreSQL fixtures.

**Spec:** `docs/superpowers/specs/2026-11-05-expanded-fets-ai-design.md`.

## Global Constraints

- Owner choice: add unsupported operations; prepare sensitive changes for review.
- Preserve current six operational actions, caller identity, trusted membership, centre/ownership checks, current allowlists, OFF checks, stable request identities and rollback artifacts.
- No generic table/SQL/RPC writer, service-role model client, caller-supplied actor identity, role escalation, assistant self-modification or policy-controlled authority from retrieved text.
- Deletions, approvals, attendance corrections, account-role changes, financial changes and outward sending/publication remain pending drafts until a deliberate human app action. Do not expose approval or confirmation as a model tool or infer it from chat text.
- A new connector must preserve the existing workflow's validations and side effects. A permissive legacy table policy is not sufficient authorization.
- Shared knowledge contains verified facts and actual installed capabilities, not proposed authority. The seven published guides remain available.
- No production business record is created for testing.

## Review Focus

- Model attempts to change the operation, target, centre or fields after a preview cannot reuse its review status.
- Another person, stale version, expired request, revoked membership or control switched OFF cannot commit a draft.
- An unsupported or unverified connector reports that state clearly and cannot fall through to generic access.
- Success requires actual saved evidence; partial workflow failures must not be reported as complete.
- Private values are not copied into shared knowledge or unrestricted audit summaries.

## Task 1: Bind the first unsupported operation to its current workflow

**Inputs:** one concrete user request; the operation map in the spec; installed server policy/RPC metadata.

- [x] Inspect the active agent version, stored controls and tool catalog without changing them.
- [x] Verify existing capability and workflow entrypoints, including Actionables institution deletion and protected chat operations.
- [x] Record the owner's selected scope and review policy.
- [x] Record the owner's clarification: all modules; ordinary-user access follows User Management, with all application access intended for super administrators. No module-priority question remains.
- [x] Produce the read-only per-workflow permission/capability map and record unresolved UI/server authority differences.
- [ ] Independent human operator reviews and explicitly authorizes the named operation contracts and any authority reconciliation before implementation or activation.
- [ ] Define exact input fields, target IDs, required role/centre/ownership, record version, allowed side effects, expected saved result and recovery limits for that connector.
- [ ] Verify those requirements from current source and live metadata; unresolved authority blocks that connector only.

## Task 2: Implement the bounded connector and review preparation

**Files:** a domain-specific module under `supabase/functions/fets-ai-agent/`; focused tests under `fets-point/src/fets-ai/`; narrowly scoped migration only if the existing domain transaction cannot preserve atomicity.

- [ ] Write failing behaviour tests for the concrete request, missing details, cross-account/centre denial, unknown fields, OFF, stale versions, retry and accurate outcomes.
- [ ] Add only the closed operation names and exact schemas required for the selected workflow.
- [ ] Use the caller-authenticated client and existing guarded operation where possible. Do not alter grants/policies simply to make a failed operation pass.
- [ ] For sensitive operations, return/persist a draft containing actor, operation, target centre/ID, original/proposed values, exact argument hash, target version, expiry, affected-record summary and recovery limits.
- [ ] Verify a draft has no business-write, notification or external-send side effect.

## Task 3: Human review and application

**Files:** a focused review component under `fets-point/src/fets-ai/`, its test, and explicit authenticated management endpoints for the selected operation if needed.

- [ ] Display the exact draft and distinguish pending, rejected, expired, stale, applied and failed outcomes.
- [ ] Require a deliberate review/apply app action; the model tool list contains no approval/confirmation operation.
- [ ] At application, recheck caller identity, role, centre, ownership, controls, exact payload and current record versions.
- [ ] Reject changed or stale drafts rather than silently replacing their target or arguments.
- [ ] Record the review and actual domain result; preserve the original record and partial-failure evidence where applicable.

## Task 4: Verify and release the selected connector

- [ ] Run focused connector/review tests and existing AI regressions; report unrelated baseline failures separately.
- [ ] Run the appropriate type/build/database checks and actual provider flow using isolated data.
- [ ] Review the closed diff for authority widening and workflow regressions.
- [ ] Back up the running function/image/configuration before a scoped deployment; preserve current runtime configuration.
- [ ] Verify installed source, public application and allowed/denied paths without a real business mutation.
- [ ] Update capability reporting and knowledge only with the operations actually installed.

## Remaining module work

Repeat the same connector contract and verification for the remaining requested workflows in the spec's operation map. Do not implement an unrestricted dispatcher as a shortcut. Domain-specific validation, required authority and recovery must be established before enabling each operation.

## Current state

Only scope recording, read-only inspection and planning have occurred for this expansion. Production agent version 7, current permissions and the seven published knowledge guides are unchanged. The owner selected all modules and User Management permission parity, with super-administrator all-access as the intended policy. The read-only capability map is ready for independent human operator review. No connector, approval endpoint, new execution authority or deployment has been introduced.
