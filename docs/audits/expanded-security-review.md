# Expanded operations independent security review

Read-only review of the local expanded migration and backend on 5 November 2026. Production inspection was limited to schema/constraint/function metadata and the deployed staff-creation source. No business row values, credentials or raw permission values were queried; no production action was invoked. Findings were sent immediately to root and the database implementer. Files continued to change during review, so status below distinguishes an observed correction from an open verification item.

## Findings requiring integration verification

1. **P1: direct paid/redeemed TOIL through ordinary roster edits.** In `fets_ai_private.perform_operation` / the `set_roster_shift` registry, `TP`, `TR` and `TRD` were accepted with `review=false` using only `can_edit_roster`. The existing payroll treats TP as paid TOIL and TR/TRD as redemption. Blocking only the literal OT code leaves a path around OT/TOIL review and balance side effects. Restrict direct roster edits to ordinary working/rest changes, or use the existing reviewed financial workflow. The live grace constraint is 0–60, while this branch advertised 0–120.

2. **P1: disposable verification omitted live CHECK constraints.** The verification script built tables from live column metadata plus triggers and asserted journal mood `calm` and cover `solar` succeed. Live constraints accept mood `'',bright,steady,focused,slow` and cover `peach,sage,lilac`; the migration reviewed at this point did not update those constraints. Such passes are false evidence of production compatibility. Include actual live constraints in the fixture and deliberately preserve/widen or align the operation/UI values. This was reported to both owners.

3. **P2: cascading deletion dependencies were absent from the review snapshot.** `target_state(delete_client)` hashed the client row, but `client_exams` is deleted by cascade. An exam added or changed after preview would not stale that review. `delete_incident` similarly cascades `incident_comments` without including them in the hash/preview. Include a bounded dependency summary plus dependency digest/locking, or hand these deletes to their module.

4. **P2: source-specific read semantics need final checks.** `source.explicit` was descriptive only; the backend did not enforce it for metadata sources. `lead_weeks` exact-ID filtering treated its date key as a UUID. A journal exact read uses the user ID (part of a composite key), then skips its date window, so it is not a single-entry selector. The `assets` source lacked its fixed peripheral/rented type filter, and `work` lacked its submit/verify/return/support kind filter. These can cause misleading results/totals even with otherwise safe fields and centre filters.

## Corrections observed while reviewing

- Attendance self actions initially wrote `staff_attendance` directly, replacing notes and bypassing the existing RPC that closes open breaks and accumulates `breakMins`. The implementer changed self-check-in/out to `roster_attendance_action`, preserved actual roster-centre checks, and made corrections a module handoff. Verify open-break checkout and invalid-note handling in the final disposable tests.
- Asset create/update initially omitted the existing `system_logs` side effect. The current migration now inserts attributed creation/status/update logs.
- `read_operation_target` initially exposed own Slate content without the explicit-private-request gate and attendance notes contained raw break/device JSON. Root added a private-note target intent check; confirm the final SQL attendance target projection/correction handoff avoids raw notes exposure.
- The generic reader initially ordered `desk_preferences` by nonexistent `id`; root changed ordering to use the real source key. The initial handler reused one request ID for every model action, colliding with the one-operation request ledger; root added deterministic child action request IDs. Verify repeated whole-request retries plus multiple different mutations.
- Ordinary calendar/roster primary-menu reads were initially inferred only from available write operations. The current access resolver explicitly includes those read modules. Global own/shared actions now resolve a verified ordinary centre instead of blanket rejection. Legacy six-operation permission checks no longer require obsolete `allowed_tools` entries that the new authority contract intentionally replaces.

## Staff creation boundary and profile bootstrap

The old local `create-staff-user/index.ts` accepted arbitrary roles/rest fields and used service privilege without checking the caller. The deployed Primary function was already version **34**, with explicit bearer authentication, verified caller and protected super-admin profile checks, sanitized payload, duplicate detection and rollback. It was not the same unsafe code. Root authorized restoring the exact deployed `index.ts` plus `handler.ts`; those byte-for-byte files and hashes are recorded in `staff-creation-authority-baseline.md`. No runtime deployment was needed or performed.

The new profile BEFORE guard rejected an authenticated first profile before reaching its INSERT branch because it first required an existing actor profile. Current `AuthContext.tsx` only SELECTs profiles; it has no first-login INSERT. Current User Management uses `create-staff-user` with service privilege, preserved by the operator branch. This is a compatibility gap for any separately supported constrained self-bootstrap path, not a confirmed current AuthContext regression. Any change should test an eligible verified first-row creation while still rejecting role, permission, identity and centre escalation.

## Boundaries inspected without finding a bypass

- Backend scope comes from `fets_ai_access`, reloaded before each model tool; actor/branch mismatches are rejected and only boolean permission keys reach the model.
- Current Shift child reads use inner parent joins with parent centre/day filters. Exact record IDs retain those filters. Minimal staff, vault and Quick Access projections exclude password/token/payroll/permission payloads.
- Journal, profile and vault ownership predicates retain current Auth/profile identity in global scope. Team reads require an actual current conversation membership, including for super-admin; no role-based message-membership bypass was found.
- The model registry has no review apply/cancel tool. Stored proposal ownership, exact argument hash, expiry, current controls and target state are checked before applying. Review storage is not client-writable; module handoffs return an honest unapplied result.
- Non-super actors cannot promote their own protected profile role/permission fields through the new BEFORE guard. Its Actionables AFTER synchronization remains in place. Domain-triggered mission stage seeding and latest-result synchronization remain active.

## Verification context

The roster restoration passed 52 focused tests and the full TypeScript build check before this read-only review. Root's combined run in `/tmp/fets-expanded-full-tests.log` reported 413 passed, 1 skipped and 6 failures: the Gemini closed-schema assertion, one legacy calendar mapping assertion and four legacy chat-hook assertions. These are recorded here as observed integration results, not silently treated as a clean full suite. No production mutation was used to validate this review. Final approval should rely on fresh owner verification after the listed fixes and actual live constraints are integrated.

## Final root integration verification

All P1 findings and the deletion dependency findings above have been resolved in the final source. The ordinary roster enum is D/HD/RD with a 60-minute grace cap; existing financial codes, approved overtime and linked active claims require their domain workflow. Roster removal and client deletion are module handoffs. Case deletion binds ordered dependent comments and their count. Attendance uses the real break-aware RPC, and corrections remain module handoffs. Own profile edits allow only non-security fields; other staff targets and role arguments are denied. The unused PL/pgSQL title variable was removed after an isolated update test exposed ambiguous column resolution. Disposable defaults now preserve real non-ID sequences, including Lost & Found reference numbers.

Private metadata and target content use source-specific current-user intent; a team-message request cannot authorize a private note lookup. Journal ID reads retain their date window; work/asset sources apply exact kind/type filters. Multiple requested writes get deterministic separate request UUIDs, with whole-request retries still bound to saved outcomes.

Fresh root verification: the full expanded SQL verifier passed every assertion group, using live CHECK/FK/UNIQUE/NOT NULL constraints and actual domain routines; all 253 isolated AI checks passed (the paid provider case was separately exercised). Real Gemini text and live-token checks passed against isolated database fixtures. Desktop/mobile source harness: 40 checks passed without network access. The broad earlier run has five pre-existing calendar/chat-hook failures after the new Gemini schema test was fixed; no unrelated hooks were changed.

No fabricated live staff, attendance, OT, sessions, mission duties or approvals were created for verification. Module handoffs remain honest unapplied proposals and preserve existing final workflows; this review does not claim autonomous OAuth publication, physical attestation, payroll settlement or arbitrary server access.
