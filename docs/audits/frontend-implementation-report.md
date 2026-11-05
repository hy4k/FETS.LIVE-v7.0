**Frontend implementation: connected FETS Intelligence**

Implemented in `/tmp/fets-intelligence-implementation`; no deployment, production mutation or commit from this subtask.

- Control now uses authenticated `status` and `settings-update` on `fets-ai-agent`, displays the effective text/live models, server credential availability, actual operational-write state and allowed actions. Missing credentials disable that provider; errors offer retry without displaying invented settings.
- Knowledge now loads the union of legacy and approved documents through `knowledge`, supports authorized edit/archive with version and HTTPS source-link preservation, and exposes personal/centre/company pinned-memory create/edit/active-state controls. Memory disable is soft; server authorization remains authoritative. Both text and voice consume these managed settings/memories on the backend.
- The page and floating companion use one conversation hook and result renderer. Only the selected conversation UUID is stored locally, namespaced by Auth UUID and centre. Server-owned message history is restored, new chat/history selection works, and same-window selection changes synchronize the page and companion. Chat never submits caller-provided history.
- Identity/centre changes immediately mask old data and reset busy/input/media state; response generations reject stale chat, history, management and voice callbacks. Retry reuses the failed chat request UUID; new chat discards that retry key.
- Voice setup includes the selected durable conversation ID. The live client now forwards an optional provider tool-call ID; each live session maps it to a stable request UUID for retries. Latest user transcription is sent as advisory `message` for explicit-request checks; server permissions remain authoritative. Old sessions cannot append transcripts or results after replacement, scope change or conversation selection.
- Source badges/document IDs and references, actual action status/saved IDs/module links, and review-only handover controls render on both surfaces. Read errors remain visible. Telemetry separates succeeded writes, blocked and failed actions, and explicitly labels caller-owned activity and query/action scope. The existing News tab, page layout and permissioned media controls are retained.

**Validation**

The initial six component/hook checks were run RED before implementation, then GREEN. Additional regression checks were observed RED for same-window conversation synchronization, failed-history retry, repeated live tool-call request IDs and source-link preservation, then GREEN.

Focused command, from `fets-point`:

```
node node_modules/vitest/vitest.mjs run src/fets-ai/intelligence-connected.test.tsx src/fets-ai/intelligence-live.test.tsx src/fets-ai/intelligence-page.test.tsx src/fets-ai/FetsAIAgent.test.tsx src/fets-ai/live-tool-identity.test.ts
node node_modules/typescript/bin/tsc -b tsconfig.app.json --pretty false
node node_modules/vite/bin/vite.js build --outDir /tmp/fets-intelligence-ui-build
```

Final focused run: 5 files passed, 19 tests passed, 14.04 seconds. Final TypeScript check passed with no diagnostics. Latest focused output is recorded in `/tmp/fets-intelligence-ui-focused-final.log`; TypeScript output in `/tmp/fets-intelligence-ui-tsc-final.log`. The final candidate build completed successfully in 29.97 seconds with normal existing chunk-size/browser-data notices. Final Vite output is recorded in `/tmp/fets-intelligence-ui-vite-final.log`. Candidate assets live under `/tmp/fets-intelligence-ui-build`, outside the durable source diff.

Full-suite snapshot command `node node_modules/vitest/vitest.mjs run` completed once: 57 passed / 4 failed files; 350 passed / 8 failed tests (358 total), 170.78 seconds. Log: `/tmp/fets-intelligence-ui-full-suite.log`. The suite ran while backend implementation was in progress; root owns those fixes and baseline comparisons. Failed tests:

- `agent-core.test.ts`: always scopes fresh reads and caps records at 40.
- `connected-core.test.ts`: validates ownership and branch before loading saved conversation messages; routes real writes through the atomic database gate with a stable request identity.
- `useCalendarSessions.test.tsx`: should map Prometric clients correctly based on the exam name.
- `useChat.test.tsx`: should send a message successfully; should return an existing DM conversation; should create a new DM conversation if none exists; should handle error when creating new DM conversation.

No broad-suite repeat or unrelated failure edits were made. Existing companion input test now allows the added read-only `conversations` fetch while preserving its assertion that opening a header draft never sends a chat request.

**Owned paths**

- `fets-point/src/components/FetsIntelligence.tsx`
- `fets-point/src/components/fetsai/{SettingsPanel,DataVaultPanel,TelemetryPanel}.tsx`
- `fets-point/src/fets-ai/{FetsAIAgent.tsx,FetsAIAgent.test.tsx,fets-ai-api.ts,fets-ai-agent.css}`
- New `fets-point/src/fets-ai/{useAgentConversation.ts,useAgentResource.ts,AgentResults.tsx,ConversationControls.tsx}`
- New `fets-point/src/fets-ai/{intelligence-connected.test.tsx,intelligence-page.test.tsx,intelligence-live.test.tsx,live-tool-identity.test.ts}`
- `fets-point/src/lib/geminiLiveClient.ts` (optional third callback argument only, authorized by root)
- This report.

**Limits and review notes**

Live transcripts remain session-local: the agreed API has no transcript persistence action. Voice setup restores durable text context and active pinned instructions; this work does not claim live transcript durability. All mutation/privacy checks here use isolated fixtures, not production operational records. Actual browser media permissions and signed-in public acceptance remain root's deployment verification work. Optional `document.source_url` was explicitly agreed with root and is sent for both knowledge sources; backend validates HTTPS/null. AI source content/model prose never becomes an independent success toast: action panels require returned server results and only successful actions expose saved-record links.

**Reviewer follow-up: separate voice readiness and truthful module links**

Observed RED for both independent text/voice configurations and module-link wording (three assertions failed). Added optional `AgentStatus.liveReady`; the companion's Live readiness badge, session button and `requestLive` guard now use `liveReady`, falling back to `ready` only when the older response omits that field. Text and voice setup messages are mode-specific. Missing Gemini credentials explicitly explain why live sessions are disabled even if Claude text is ready. Gemini voice remains usable when the selected Claude text credential is unavailable. Module-only action URLs now read “Open module”, without implying they select the exact saved record.

Focused reviewer verification: five files passed, 21 tests passed, 15.30 seconds. Output: `/tmp/fets-intelligence-ui-review-green.log`; RED evidence: `/tmp/fets-intelligence-ui-review-red.log`. No broad-suite rerun. Reviewer follow-up paths: `FetsAIAgent.tsx`, `fets-ai-api.ts`, `AgentResults.tsx`, `intelligence-live.test.tsx`, `intelligence-connected.test.tsx` and this report.

Final reviewer TypeScript verification also passed (exit 0, no diagnostics): `node node_modules/typescript/bin/tsc -b tsconfig.app.json --pretty false`; output `/tmp/fets-intelligence-ui-review-tsc.log`. `git diff --check` passed.
