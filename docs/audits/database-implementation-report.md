# Connected Intelligence database implementation

Implemented locally in `supabase/migrations/20261029204330_connected_intelligence.sql`. Production was inspected through read-only metadata queries only; no migration, operational record, or configuration was applied there. Migration creation used the pinned Supabase CLI 2.95.3 after inspecting its top-level, migration and migration-new help.

## Contract and scope

- Preserves every legacy memory, external knowledge, approved document, conversation, message and audit row. Adds active memory state, scoped external knowledge/version, owner/centre conversations and messages, and server-written action audit.
- Exact public RPC contracts: `fets_ai_save_memory(...) returns jsonb` and `fets_ai_execute_action(p_tool text,p_args jsonb,p_branch text,p_request_id uuid) returns jsonb`. Public functions are invoker wrappers around fixed-search-path private implementations; anonymous/PUBLIC execution is revoked.
- Verified, unbanned, undeleted Auth identity and an active membership-linked profile are mandatory. Membership role is authoritative: `*`/`super_admin` maps to super_admin; selected-centre planner maps to manager; ordinary membership maps to staff. Editable profile roles cannot elevate access.
- Personal memory uses the Auth UUID, works with operations OFF, and cannot change scope/ownership. Centre publication requires trusted planner/global administrator; global publication requires the trusted global administrator. Invalid/unclassified legacy branch memory is preserved without becoming globally visible.
- New history requires both conversation ownership and current centre membership. The reserved `global` conversation scope is available only to the verified trusted wildcard administrator; ordinary staff cannot create, read or append global history, including when a stray ordinary membership row names global. Operational writes still require a specific centre. Cross-user messages and messages larger than 60,000 characters are rejected. Append-only messages have unique `(conversation_id,request_id,role)`.
- Clients may only read action outcomes, never insert, update or delete them. Each action checks the stored role-specific exact tool allowlist, operational switches, active centre membership, fixed permitted fields, assignees and expected version. Legacy read-tool aliases never grant writes.
- A request/tool/arguments/centre hash advisory lock serializes retries. A unique audit key is the second idempotency barrier. The settings row uses `FOR SHARE`; target records use `FOR UPDATE`. Mutation failures roll back their subtransaction while the failed/blocked outcome is recorded in the outer transaction. Revoked membership cannot replay old evidence.
- Results follow `{type:'action-result',tool,status,recordId?,path?,title?,message?,replayed?}` and include only limited saved operational fields in `record`. Operational records and audit insertion commit atomically.
- Settings replace only the exact obsolete `gemini-1.5-flash` stored value/default with `gemini-3.1-pro-preview`. Any different existing model is preserved.

### Clarifications made against the actual live schema

`user_tasks` had no centre field. Adds nullable `branch_location`, leaves all old tasks unclassified and stamps only newly created AI tasks. Legacy task updates require both existing owner/assignee to have unambiguous membership in the selected centre; ambiguous legacy work stays in its existing workflow.

`calendar_sessions.id` is bigint identity; returned IDs are strings to preserve precision. Incident severity is `critical | major | minor`, despite its obsolete database default of `medium`; AI creates explicitly supply `minor` when omitted. Actual database enums are checked before writing.

Safe action arguments:

| Target | Permitted operational arguments |
| --- | --- |
| Incident | title, description, severity, category, status, notes, due_date, assigned_to |
| Task | title, description, priority, status, due_date, assigned_to |
| Session | client_name, exam_name, date, start_time, end_time, candidate_count, status |

Every update additionally requires `id` and `expected_updated_at`. Record identities, centre and creator fields are server-derived/immutable through this RPC. Staff may create their own work and update owned/assigned records; reassignment requires trusted management. Foreign assignees must be active verified staff in scope. Calendar mutations require a trusted planner/global administrator and an explicit matching allowlist entry. Arbitrary table, SQL, metadata, roster, check and approval writes are unavailable.

### Legacy policy compatibility

Only audited active/legacy stores are modified: ai_settings, ai_memory, ai_external_knowledge, fets_ai_documents, ai_conversations, ai_conversation_messages, ai_query_log and ai_agent_actions, plus the new stores. Other AI modules, embeddings, insights, verification, engagement and citations remain unchanged.

Legacy conversation insert/safe content update and message append remain available to their active verified owner. Ownership cannot be transferred. Legacy query/action audit rows are read-only to clients. Query logs support verified owner/global administrator reading; action/history privacy remains owner-scoped. Existing old history has no trustworthy centre column, so it remains owner-restricted rather than being reclassified or loaded into new centre conversations.

### Proven live-trigger dependencies

Read-only inspection of all non-internal triggers on incidents, tasks, calendar_sessions, settings, memory and external knowledge found three existing triggers. Their original function bodies and trigger declarations are retained in `scripts/verification/fixtures/connected-intelligence-live-triggers.sql` and loaded by both isolated suites.

1. `notify_incident_assignment()` used unqualified relations and assumed `incidents.assigned_to` was a profile ID. Live constraints prove it references Auth users while notifications.recipient_id references staff_profiles.id. The migration qualifies relations, fixes the mapping and preserves assignment notifications. It uses a fixed empty search_path and has client execution revoked.
2. The task timestamp trigger uses `NOW()`, giving repeated updates within one transaction the same optimistic version. A later task-only trigger sets a strictly increasing clock timestamp. The shared `update_updated_at_column()` function and all other tables remain unchanged.
3. The existing resolved-notification trigger only handles `resolved`, which is absent from the actual incident status enum. It is unchanged and its supported-status early return is exercised by the fixture.

For rollback review, the original assignment function definition is in the fixture. Its original metadata was `proconfig = null` and ACL `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. A full rollback must retain newly created history/audit rows and should disable AI operations first; do not run the entire test fixture against production. Restoring the original assignment function restores its known ID/search_path defects, so prefer rolling back application routing while retaining the additive stores and corrected trigger.

## Verification evidence

All commands below completed successfully after implementation. The suite contains 84 explicit assertion sites, including three real concurrency scenarios, with dynamic assertions for allowed/denied actions.

```bash
PGLITE_MODULE=/tmp/fets-ai-db-test/node_modules/@electric-sql/pglite/dist/index.js \
  node scripts/verification/verify-connected-intelligence.mjs

PGLITE_MODULE=/tmp/fets-ai-db-test/node_modules/@electric-sql/pglite/dist/index.js \
  FETS_TEST_EXISTING_MODEL=gemini-3-pro-preview \
  node scripts/verification/verify-connected-intelligence.mjs

# Fresh disposable localhost database named fets_isolated; never a production URL.
FETS_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:<ephemeral-port>/fets_isolated \
  node scripts/verification/verify-connected-intelligence.mjs

git diff --check
```

Pinned PGlite 0.5.13 and Supabase CLI 2.95.3 were installed under `/tmp/fets-ai-db-test`, without changing repository dependencies. Real PostgreSQL used a disposable `postgres:17-alpine` container, localhost-only ephemeral port, no mounted volumes and no production connections. The disposable container was stopped and removed after the final passing run.

Checks cover preservation of legacy rows and custom model selection; private/foreign-centre history and trusted global administrator history; forged owners and oversized messages; personal/shared memory authorization and OFF independence; inactive/unverified/revoked identities; role spoofing; exact allowlists; immutable/unknown action fields; foreign/inactive assignment; all six action tools; replay; kill/autonomy switches; stale/missing optimistic versions; limited result fields; immutable audit; actual notification mapping; original live trigger compatibility; and anonymous function denial. An injected after-insert exception proves failed actions leave no operational record but retain a failed audit.

Real concurrency scenarios pass: three identical simultaneous retries yield one record and two replays; two updates with the same expected version yield one success and one blocked result; an OFF update waits for the already-running write, then the next write is blocked.

RED failures were observed before implementing settings/history, approved-reference active/verified authorization, legacy own-write compatibility, task timestamp freshness, live notification compatibility, unclassified branch-memory privacy, and global administrator conversation compatibility. The notification regression also failed when only its fix was removed from a temporary migration copy. Final runs use the unchanged full migration.

## Deployment boundary

No production schema/advisors execution or authenticated operational smoke write was performed. Tests reproduce the actual relevant column/enums/FK semantics and live trigger definitions in isolated PostgreSQL; they cannot prove every production extension, server configuration or unrelated policy. Parent review/deployment must inspect the full combined diff and apply the migration only within the authorized release workflow. Frontend/backend compilation and their test suites are owned by their respective implementers.

## Review repair: global administrator history

The reviewer identified that the UI/backend legitimately select `global` for trusted global administrators, while the initial new-conversation CHECK allowed only cochin/calicut. The added regression first failed on `fets_ai_conversations_branch_check`. The CHECK now accepts global, and the membership helper explicitly reserves that scope to the trusted wildcard administrator. New checks exercise global conversation create/read, user and assistant messages, ordinary staff create/read/append denial, a malformed ordinary global membership denial, and continued denial of global operational writes. Both PGlite variants and real PostgreSQL/concurrency suites pass after the repair. No deployment was performed.
