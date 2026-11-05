# Independent review: connected Intelligence

Reviewed the uncommitted implementation against baseline `1a114e26c38efce34faba9d7ca28dce30be21af8`, the approved audit, and `docs/superpowers/plans/intelligence-contract.md`. This review made no production request, deployment, or operational data change. File/line references below describe the code inspected before the implementers' review fixes.

## Actionable findings

1. **[P1] Apply current-user intent gating to Live mutations.** `supabase/functions/fets-ai-agent/handler.ts:44–47` unconditionally passes `allowMemory:true` and permits writes whenever a request UUID exists. The companion sends `message:lastUserTranscript` at `fets-point/src/fets-ai/FetsAIAgent.tsx:49`, but the handler ignores it. Reproduction: submit `action:'tool'`, `name:'create_task'`, a fresh UUID, and `message:'Summarise this policy'` while the actor is allowed to create tasks and writes are ON; the mutation RPC is reached. The analogous text path blocks the same request. A Live model following instructions from a retrieved policy or screen therefore lacks the text path's explicit-intent barrier. Apply the same current-utterance gate to operational writes and memory; missing transcription must fail closed for mutations. This is an intent-boundary defect, not a bypass of the SQL role/centre/kill-switch checks.

2. **[P2] Permit owned admin conversations in All centres.** `supabase/migrations/20261029204330_connected_intelligence.sql:156–159` permits only `cochin` and `calicut` for new conversations. `core.ts:6–10` and both UIs support the trusted global administrator selecting `global`; `runtime.ts:37–39` inserts that selected scope unchanged. Reproduction: select All centres and send the first chat message; conversation creation violates the branch constraint before any model call. Permit the global history scope only through the existing trusted-admin membership predicate, while retaining centre-only operational mutations.

3. **[P2] Gate Live on the Gemini credential rather than the selected text provider.** `fets-point/src/fets-ai/FetsAIAgent.tsx:26,42,76` uses `status.ready` for Live startup. `runtime.ts:50` deliberately returns a separate `liveReady`. With Claude selected and configured but Gemini absent, Start Live is enabled and always returns 503. With the selected Claude credential absent but Gemini configured, usable Live voice is disabled. Consume the scope-checked `liveReady` and show the Gemini-specific credential state.

4. **[P2] Search legacy reference knowledge with its real version.** `supabase/functions/fets-ai-agent/core.ts:57–58` omits `version` from both legacy projections, while line 62 substitutes `row.version || 1`. Reproduction: edit a legacy policy through Knowledge so its saved version becomes 2; `search_knowledge` still returns and cites version 1. Include the version column in both legacy reads and cover a version greater than 1 in the search regression test.

5. **[P2] Recover the first conversation before replaying an initial request.** `supabase/functions/fets-ai-agent/handler.ts:64–66` creates a fresh conversation before checking its saved reply. `runtime.ts:37–39` generates a new conversation whenever the client has no `conversationId`. Reproduction: the first chat completes on the server, its response is lost, then the client retries with the same `requestId` and no conversation ID. The server creates a second conversation and calls the provider again instead of returning the stored reply. The UI correctly retains the original request UUID, so the backend should find the user's original same-scope request/conversation before creating one. The root implementer was already adding this regression test when review began.

All five findings were communicated to the root implementer as they were identified. The findings above retain their original failure descriptions for traceability. **All five are resolved and independently re-reviewed**, as detailed below.

## Spec and security assessment

The implementation follows the main approved architecture: caller-authenticated database clients, durable owner/centre-filtered text history, active scoped pinned memories on text and Live setup, preserved legacy stores, merged policy search, stored provider routing, dedicated management endpoints, current Shift sources, and explicit source/action rendering. The private SQL action implementation uses fixed statements and an empty search path; validates verified active membership, trusted role allowlists, assignees, and immutable fields; checks operational settings under a row lock; checks expected versions under target-row locks; and commits mutation/audit results atomically. The audit table has no client write grants. Personal memories are not exposed to other users, including administrators, by the inspected read policy.

No additional confirmed role-elevation, foreign-assignee, personal-memory disclosure, or cross-account history vulnerability was found in the inspected code and isolated checks. Gemini response parts, thought signatures, and call IDs are preserved through tool turns. The Anthropic adapter uses lower-case JSON Schema types, assistant tool-use blocks, and user tool-result blocks without silently changing providers. This is a code-and-fixture assessment; no paid model call or real Live media session was made.

The SQL migration preserves existing rows and narrows permissive legacy policies. Its related trigger changes are narrow: qualified incident assignment notification lookup and strictly increasing task versions. Rolling back only the frontend/function will retain the additive history/audit stores and the stricter legacy permissions; restoring the old permissive policies would reopen the privacy defect. No rollback was executed.

Live transcripts are currently displayed in local hook state; only text conversations are written by the backend. The approved detailed contract explicitly requires saved context on Live setup, which is implemented. This review does not claim voice transcript persistence or audio-session restoration.

## Verification and verdict

- Six targeted Vitest files passed: handler, providers, management, connected core, connected UI, and Live tool-call identity: **35 tests passed**.
- The isolated PGlite verification script passed against the complete migration with the recorded live-trigger fixture. It covered ownership, scoped memory, trusted identity/roles, allowlists, actions, replay, switches, stale updates, preservation, and anonymous denial.
- `git diff --check` passed at review time.
- Real production RLS interactions, provider availability/model IDs, actual Google/Anthropic acceptance, and browser media permissions remain outside this review's executed checks. The test adapters simulate those boundaries.

The initial verdict requested changes for the five concrete failures above. The security design is materially aligned with the contract and the code is split into focused backend modules and shared UI hooks. The initial missing scenarios were added as regression coverage.

## Final focused re-review

The final pass re-reviewed only the five fixes and their relevant boundaries:

- **Live intent:** `handler.ts:46–47` now derives operational-write and memory permission from the forwarded user utterance using the same gate as text. Missing utterance produces neither permission. The new handler regression confirms a summarisation request cannot reach the mutation RPC. This advisory language gate supplements SQL authorization; it is not a claim that lexical matching proves the meaning of every possible utterance.
- **Global history:** the conversation branch constraint now admits `global`. `member_active` explicitly prevents a plain `branch='global'` membership from granting that reserved scope; the verified wildcard super-administrator is required. The database suite creates and reads admin global messages, rejects staff inserts/reads/appends, rejects a forged non-admin global membership, and continues to block operational writes in global scope.
- **Live readiness:** the companion consumes scope-checked `liveReady`, separates Live and text readiness, and explains the missing Gemini credential. Both differing-provider credential configurations have UI regressions.
- **Knowledge version:** both legacy knowledge search projections now select `version`; the regression checks a returned version of 4 and verifies both actual SELECT projections include the column.
- **First-request replay:** the first request UUID now deterministically identifies its conversation. Existing lookup and duplicate-insert recovery use the owner/centre guard. Retrying a completed first request without a returned conversation ID finds the original stored reply; the regression verifies one conversation and one provider call.

Independent final validation: the changed handler, connected-core, and intelligence-live test files passed **21/21 tests**; the complete isolated PGlite verification script passed again; `git diff --check` passed. The root implementer separately reported successful broader backend/UI suites and real PostgreSQL concurrency tests; those broader reruns were not repeated in this focused review. The root also reported checking actual model metadata with the existing credential; this reviewer made no production or provider request and does not independently certify that check.

**Final verdict: no remaining blocker identified in the five reviewed fixes.** The implementation satisfies the reviewed contract boundaries subject to the execution limits above. This verdict approves the reviewed code corrections; it does not claim that deployment, a real provider tool turn, or an authenticated production acceptance test has occurred.
