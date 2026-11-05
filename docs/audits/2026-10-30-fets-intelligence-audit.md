**FETS Intelligence: current features, confirmed failures, and repair proposal**

Inspected on 30 October 2026, India time. This is an audit and repair proposal; no application, Edge Function, setting, or database record was changed.

The public `/fets-intelligence` route serves frontend commit `1a114e26c38efce34faba9d7ca28dce30be21af8`, release `20261029T191121Z-my-desk-ot-1a114e2`. I retrieved the actual deployed `fets-ai-agent` function, version 5, and the older `fets-ai` function, version 18. All three files in the deployed agent match the inspected release source exactly. Live database queries, policy inspection, and logs establish the production state below. A separate diagnostic executed the retrieved agent code with a fake database and made no external requests.

**The central problem is a split between the old AI administration screens and the newer chat backend.**

The Intelligence Assistant and the floating companion call `fets-ai-agent`. That backend offers four tools: read workspace records, search approved documents, prepare an unsaved handover draft, and suggest a page. It has no operational write tool and no saved-memory tool.

Control updates `ai_settings`. Learned Memory reads `ai_memory`. External Knowledge saves to `ai_external_knowledge`. Telemetry reads the older query and action logs. The current chat backend does not consume these settings or memory stores and does not update those audit logs. Its document search uses `fets_ai_documents` instead.

| Feature | Actual options and purpose | Current behavior and useful limits |
| --- | --- | --- |
| Gemini 3.1 Live | Opens the floating FETS AI companion. Start/end a live session; enable microphone, camera, or screen sharing individually; view the conversation transcript. | Uses the same guarded agent backend as text chat. Sessions are limited to nine minutes. Media requires browser permission and stops on disconnect. Token requests have succeeded in recent production logs; this audit did not start a microphone, camera, or screen session. |
| Assistant | Text chat; quick prompts for candidate totals, exam schedule, incidents, and online staff. | Can request fresh data from its connected sources. It cannot currently create or update a case, task, session, roster, or memory. The Intelligence view displays only the answer text and discards the returned source evidence and action proposals. |
| Broadcasts | FETS News: latest updates, items to acknowledge, industry news, archive, search and filters. Reviewers also receive a review inbox, new-notice editor, and collection controls. | Embeds the existing News workspace. It uses separate News tables and publish RPCs. Publication remains an explicit reviewer action; the AI Control toggle does not govern it. |
| Telemetry | Total queries, queries in seven days, agent actions, writes executed, memories learned, external documents; top tools and recent actions. | Reads historical stores that current chat does not update. Current usage exists elsewhere. The write counter filters only `is_write`, so historical failed or blocked write attempts can be counted as executed writes. Top tools are calculated from the latest 200 action rows, not all-time history. |
| Knowledge → External Knowledge | Add a document with title, category and content; list documents; delete a document. | Saves successfully to the legacy knowledge table when permitted, but current chat never searches that table. This page has no edit, archive, or scope selector. |
| Knowledge → Learned Memory | Show remembered keys, values, categories and scopes; delete a memory. | Two saved records exist. Current chat neither loads them nor has a tool to save additional memories. The statement that memories will accumulate through use is unsupported by the current backend. |
| Control → Autonomous Writes | Admin toggle; other staff see read-only controls. ON sets `kill_switch=false` and `autonomous_enabled=true`; OFF reverses them. | The saved setting is already ON. The active agent never reads it, and its tool dispatcher rejects create/update requests. Turning the setting OFF also does not change that backend's behavior. |
| Control → Model Provider | Choose Claude or Gemini; display the model name saved for the selected provider. | The active backend does not read this choice. It calls Google and uses server configuration for its model names. The displayed model can therefore differ from the actual model. Stored iteration limits and role/tool lists are also not enforced by this backend. |

**What is saved today.**

| Live observation | Value at inspection |
| --- | --- |
| Autonomous writes | Enabled; kill switch OFF |
| Selected legacy provider | Gemini |
| Displayed legacy Gemini model | `gemini-1.5-flash` |
| Saved learned memories | 2: `pearson_vue_id_policy`, `fets_space_definition` |
| Saved external knowledge | 1 active document, titled Pearson VUE ID Policy |
| Documents in the current agent's knowledge store | 0 |
| Old query log | 84 rows; latest recorded query on 30 August 2026 |
| Old action log | 336 rows; latest recorded action on 30 August 2026 |
| Current minimal usage ledger | 39 reservations: 14 chat, 15 live-token, 10 tool |

These are database observations, not evidence that every request succeeded. In the inspected 24-hour function logs, there were 40 HTTP 200 POST responses, one 403, and one 500. HTTP 200 alone does not establish that a tool succeeded: this backend can return a tool error inside a successful HTTP response. A function log records one timeout. Neither this isolated timeout nor model availability explains the disconnected controls and memory paths.

**Which operational information the Assistant can actually read.**

Its source catalogue includes exam calendar sessions, roster entries, old duty plans, weekly leads, old check events, old coverage changes, old centre reports, incidents, and published documents in the new knowledge store. Reads use the signed-in caller's access and centre membership. Date ranges are limited to 31 days, results are paginated, and large responses are truncated.

Calendar candidate counts are scheduled totals, not a complete candidate registration or attendance count. The “online staff” quick prompt has no connected presence or attendance source. Roster projections include shift codes but omit saved custom start/end times and approved overtime fields, so the agent does not receive the full information needed for accurate custom-hours analysis.

The current Shift screen uses `shift_days_v2`, `shift_work_events_v2`, and current check RPCs. The agent still reads `centre_day_plans`, `centre_duty_events`, `centre_duty_changes`, and `centre_duty_reports`. At inspection, the old plan store had 13 records, with its latest date 27 October; the current shift store had three records and extended to 30 October. Existing rows were retained during the Shift upgrade, so the old stores' continued existence masks this mismatch.

The system prompt still describes the superseded fixed 08:00–17:00 pattern and six 90-minute blocks. It needs to derive the actual day's pattern from the current plan. Actionables, current staff work events, News, and private personal time analysis are not automatically connected just because their pages exist. Private credentials and messages are deliberately excluded.

**Why “remember this whenever we chat” currently fails.**

There are three separate concepts to repair:

1. **Persistent instructions:** facts or preferences the user deliberately pins and wants included every time. These need a scoped loader on every text request and live-session setup. A search-only document tool is insufficient because the model may never search for the pinned instruction.
2. **Reference knowledge:** SOPs and longer policies, retrieved when relevant. The Intelligence Knowledge page and the floating companion's approved Knowledge shelf currently use different tables. Their existing content must be retained and connected to one agreed publication/search path.
3. **Conversation history:** prior messages and conversation titles. Current chat keeps messages in React state and sends only the latest eight messages. It does not save or reload a durable conversation. Reloading or remounting loses that history. The floating companion also clears messages on centre/user changes and excludes live transcript messages from subsequent text-history requests.

The Intelligence view does not implement the companion's centre/user-change reset, so its previous messages may remain in the history sent after a centre switch. This should be corrected as part of account and centre isolation.

For the user's intended behavior, an explicitly saved personal instruction should survive refresh, logout/login, and a new conversation. Text and voice sessions should receive the same applicable instructions. Personal, centre, and company knowledge need distinct ownership and visibility. The UI should show what is saved and allow its owner to edit, disable, or delete it; merely replying “I will remember” is not proof of a successful save.

**How to make Autonomous Writes work as described.**

Keep the current caller-authenticated backend and give it specific action tools connected to the same validation and permission rules as the application forms. The proposed first scope is creating/updating cases, creating/updating assigned tasks, and adding/updating calendar sessions. Roster and duty planning can follow using their existing versioned operations and validation. This is a proposed scope, not an enabled capability.

For an explicit request such as “Create an open AC-outage case for Cochin, severity high,” ON should execute the permitted action without an additional confirmation dialog, then return the real record ID, saved details and a link. If required information is missing, the assistant should ask for it. The user's role and centre access remain authoritative. ON does not authorize unrequested background work or imply that every database operation exists.

OFF should reject operational writes on the server, including direct tool requests. It should be checked again immediately before each mutation, rather than once at the start of a long conversation. Changing Control should affect the actual active backend, and the UI should display capabilities returned by that backend.

Each action needs input validation, exact target resolution, duplicate-request protection, stale-version checks where applicable, and an audit entry containing actor, centre, operation, target, result and necessary before/after information. Success should be reported only after the database confirms it. A failed or blocked write must not increase the “writes executed” count. Destructive deletion and changes to roles, credentials, attendance or approvals require separately defined tools and permissions; they are not implied by create/update access.

The repository contains an older agent implementation with a service-role, arbitrary-table writer. That is not the deployed legacy function. The deployed `fets-ai` version 18 is a small text-only Gemini wrapper that returns an empty action list and does not implement durable memory. Switching the frontend back to that function would not repair these features. Restoring the old arbitrary-table writer would also bypass the newer caller-scoped design and current workflows.

**A concrete access issue to fix with memory/history.**

The live legacy memory and external-knowledge tables have authenticated SELECT/INSERT/UPDATE/DELETE grants and unconditional authenticated policies. The legacy conversation tables also have unconditional authenticated ALL policies alongside owner policies. Those broad policies permit access beyond the narrower owner policy; the existence of an owner policy does not cancel them. This is established from live grants and policy definitions; I did not attempt another user's login or mutate a record to demonstrate it.

A durable personal-memory/history feature must enforce ownership and centre membership at the database layer. Shared company guidance should have controlled publication rights. Merely hiding edit buttons or filtering rows in the browser would not provide that boundary. See the current [Supabase row-level security guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

**Recommended repair order and proof that each repair works.**

| Order | Repair | Acceptance check |
| --- | --- | --- |
| 1 | Connect settings to the active backend; show truthful health, model and capability status. | A control change alters the next backend request; OFF blocks direct mutation calls; model display agrees with the actual reply. |
| 2 | Connect and preserve existing memories and knowledge; implement scoped pinned instructions and durable history. | Save a harmless instruction, open a new conversation, refresh and sign in again; text and voice setup receive it. Another user cannot retrieve a personal instruction. Existing records remain. |
| 3 | Add the agreed create/update tools using current application operations. | With ON, an explicit request creates exactly one record and returns its ID; retry does not duplicate it. Invalid/unauthorized requests fail without a write. |
| 4 | Replace old duty mappings and static assumptions with current Shift/roster sources; align the quick prompts with connected data. | Answers match the actual date's duty sheet and custom hours; missing/unconnected information is identified explicitly. |
| 5 | Display returned source evidence and proposals in Intelligence; share the companion's account/centre handling. | Source links and draft review controls are usable; changing account or centre cannot carry previous context into a different scope. |
| 6 | Connect Telemetry to current usage and action outcomes; handle backend errors explicitly. | A successful action appears with its real outcome; failed/blocked actions are separate. Failed reads show an error rather than zero activity. |

Testing should use isolated fixtures for mutation and privacy checks, then a designated test account and non-operational test records for an approved live acceptance test. Memory/history and trustworthy auditing may require database migrations or policy changes. None were applied during this audit.

**Useful requests after the relevant connections are repaired.**

- “Remember for my account: answer in English and show all times in India time.” The response should identify the saved memory and scope.
- “What instructions have you saved for me?” This should show the actual saved records, with edit/delete controls.
- “Using our approved Pearson VUE policy, explain the ID requirements and show the source.” The answer should cite the maintained policy rather than general model knowledge.
- “Create a high-priority AC-outage case for Cochin and assign it to the selected responsible staff member.” ON should save the permitted record and provide its link.
- “Show tomorrow's calendar for Calicut and tell me which sessions have incomplete times.” This can use the existing calendar source, with complete pagination.
- “Summarise today's duty coverage and pending work from the current Shift plan.” This requires the new Shift source mapping before it is reliable.

**Evidence and boundaries.**

The public route returned HTTP 200 and matched the inspected release HTML checksum. The retrieved production function exposes exactly four tools. Twelve isolated production-core checks passed: six unsupported action/memory tools were rejected, no database call followed those unsupported actions, knowledge searched only the new document table, handovers remained unsaved proposals, the exposed tool list was verified, current Shift tables were absent, and the old fixed-duty instruction was present.

No model request, live voice/media session, database mutation, setting toggle, deployment, or production test record was created during this audit. The browser connector did not establish a session; authenticated button interactions were therefore traced through deployed source and live backend state rather than exercised in the user's signed-in browser.

Primary implementation references:

- [Intelligence page and request handling](/opt/fets-releases/20261029T191121Z-my-desk-ot-1a114e2/source/fets-point/src/components/FetsIntelligence.tsx:67)
- [Active function client](/opt/fets-releases/20261029T191121Z-my-desk-ot-1a114e2/source/fets-point/src/fets-ai/fets-ai-api.ts:8)
- [Control settings](/opt/fets-releases/20261029T191121Z-my-desk-ot-1a114e2/source/fets-point/src/components/fetsai/SettingsPanel.tsx:24)
- [Legacy Knowledge and Memory UI](/opt/fets-releases/20261029T191121Z-my-desk-ot-1a114e2/source/fets-point/src/components/fetsai/DataVaultPanel.tsx:26)
- [Telemetry counters](/opt/fets-releases/20261029T191121Z-my-desk-ot-1a114e2/source/fets-point/src/components/fetsai/TelemetryPanel.tsx:20)
- [Active agent backend](/opt/fets-releases/20261029T191121Z-my-desk-ot-1a114e2/source/supabase/functions/fets-ai-agent/index.ts:31)
- [Active tool execution and knowledge lookup](/opt/fets-releases/20261029T191121Z-my-desk-ot-1a114e2/source/supabase/functions/fets-ai-agent/core.ts:21)
- [Current Shift repository](/opt/fets-releases/20261029T191121Z-my-desk-ot-1a114e2/source/fets-point/src/shift-v2/repository.ts:100)
- [Isolated diagnostic results](/tmp/fets-intelligence-audit/probe-result.json)
