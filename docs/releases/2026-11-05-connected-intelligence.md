# Connected Intelligence production release

Deployed to https://fets.live/fets-intelligence on 5 November 2026. Application commit `03839782264c10b887e51dcd527bba8e035fd4d1` adds the reviewed Intelligence repair to the current production source, main `5f017e5`, preserving its newer unrelated changes.

Control now uses the active backend's stored provider, model, allowed actions and write switches. Explicit permitted requests can create or update cases, assigned tasks and calendar sessions. Every operation checks current membership, role, centre, allowlist, controls and optimistic version on the server; duplicate requests return recorded results. Attendance, permissions, approvals, operational deletion and report submission remain outside these tools.

Active applicable personal, centre and global pinned memories are supplied on each text turn and Live setup. Personal memory is private. Text conversations persist by owner and selected centre, can be restored or started afresh, and are shared between the page and floating companion. Knowledge combines existing references and approved documents with source/version information. Telemetry uses actual caller activity and separates successful, blocked and failed actions.

## Installed release

- Website release: `20261105T065720Z-connected-intelligence`.
- Image: `sha256:6de71149755b744d1154d623068ee975097f230c22763273eb41459a341c2558`.
- Public HTML SHA-256: `cbfa3d828aa277999eb5c62fae7afec8e93e0207331ab100f08b7e9b25211572`.
- Supabase project: `qqewusetilxxfvfkmsed`; authenticated `fets-ai-agent` version 6, all seven installed source files compared byte for byte.
- Migration: `20261105070506_connected_intelligence.sql`; SHA-256 `4744303214f3ea8a4ee71c42d2646e9df36b842a266fc3902ee7c5c22e73c280`. Renamed after deployment to match the MCP-assigned installed version; the reviewed SQL is unchanged.

## Verification

- 49 focused AI tests passed against the current production source; frontend TypeScript, backend TypeScript and production build passed.
- Isolated PostgreSQL checks passed for privacy, membership, role/centre permissions, settings, memory, history, optimistic updates, atomic actions and replay. Earlier real PostgreSQL 17 concurrency checks covered retries, competing updates and switching writes OFF during an in-flight action.
- 100 isolated browser checks passed at 1440, 768, 390 and 320 pixels.
- A disposable verified staff account passed 12 authenticated production checks: real Gemini memory tool receipt, memory edit, recall in a new conversation without caller history, restored messages, first-response retry, preserved knowledge, current Shift read, staff write denial, real telemetry and a Google Live token containing the saved memory and owned context.
- A production database transaction verified an authorized write with controls ON, duplicate replay and rejection with controls OFF. The entire transaction, including temporary role/control changes and the task/audit rows, was rolled back.
- Signed-in compiled production UI restored conversation history and displayed the edited private memory at desktop and phone widths. One initial phone browser wait timed out; a fresh phone session passed without application changes.
- All 53 checked public routes/assets matched the reviewed build. The actual lazy application module evaluated successfully before and after switching.
- Original environment, Compose/Docker/Nginx files, effective ports, networks, mounts, routing labels and other existing service identities were preserved. Security advisors reported no new findings.
- Temporary test sessions/account and AI data were removed. Original memory/knowledge content hashes match the pre-deployment snapshot; all 2 memories, 1 reference, 57 legacy conversations and 154 legacy messages remain. Original operational control values were preserved.

A real microphone/camera/screen-sharing session and the optional Claude provider were not exercised. Live token issuance and context were verified; voice transcripts remain session-local. The focused test result is not a claim that the repository's entire unrelated test suite passes.

## Recovery

Private server artifacts are retained under `/opt/fets-releases/20261105T065720Z-connected-intelligence`: previous image archive, original effective configuration, previous function source/policies, candidate and public module checks, authenticated checks and data-preservation proof. `rollback.sh` restores the previous frontend image. Previous function source is in `backend.before/edge-function.current.json`; redeploy those three files with JWT verification enabled if a backend rollback is required. Additive history/audit stores and hardened permissions should be retained during application rollback to preserve new user data and privacy.

Two early switches automatically rolled back because verification bookkeeping treated Compose replacement metadata and a nested backup copy as configuration changes. Inspection confirmed all original routing/configuration values matched; corrected verification then passed. No server configuration was modified to satisfy the checks.
