# Workspace consolidation and restored premium release

The live site had been replaced by release `20260930T000000Z`, built from `C:\Projects\00_Inbox\FETS.LIVE-v7.0`. That checkout was based on the old UI and did not contain the premium arrival/login, My Desk, centre handover or floating FETS AI work from the VS Code virtual workspace. The public index hash matched the running Docker container, confirming a server deployment regression rather than browser cache.

Amazon Q had added a Calendar roster form and a related migration. Its form saved through the shared roster RPC but did not preview matches against existing candidates or calendar totals. Its parser used a different header list and XLS reader. The consolidated implementation restores the requested shared parser, custom-heading priority, existing-candidate/legacy-match review, total reconciliation preview, tracker contract fields, IST filtering, and calendar invalidation. Extra provider headings from Q have been retained. The old RosterDialog import path forwards to CalendarRosterDialog.

The manually applied Q SQL functions were compared with the live function bodies, matched after normalizing line endings, and recorded as migration `20260930000000`. Follow-up migration `20260930024000` restores explicit NULL context rejection and deterministic group lock ordering while preserving the schema contract and existing RLS. The entire three-migration sequence passes isolated PostgreSQL checks. A live authenticated transaction again passes insert/re-upload/preserved status/time move/delete-count checks and rolls back without leaving fixture rows.

Both local folders now contain the reviewed premium and roster changes. Environment files and unrelated work were not overwritten. The original overlapping files from the Projects folder are backed up outside the repository at `C:\Projects\00_Inbox\FETS-LIVE-before-consolidation-20260930.tar.gz`.

Use the Projects folder for subsequent work. Run `pnpm install --frozen-lockfile` if its dependencies have not been refreshed. Its old fixed-date deployment script now forwards to `scripts/deploy-reviewed-vps.sh`. The new script requires the premium/roster source files, builds the current working tree, rejects a stale build, makes a unique release, retains a rollback image and source snapshot, and verifies the public index hash. Set `FETS_SSH_KEY` to the authorized local SSH key path, then run `bash scripts/deploy-reviewed-vps.sh`; no credentials are committed. The optional `--built` mode still checks source freshness.

The release includes `/release.json` for checking the running version. This is a working-tree deployment; source has not been pushed to GitHub. The old GitHub main deployment workflow still pulls remote main, so it should only be run after the consolidated source is committed and pushed. No fets-api or fets.online code was changed.

## Deployed and verified

Release `20260930T024542Z` is live at https://fets.live. Public index SHA-256: `cd2351141c61144aed0f7fbf5dd4352624570762a6d9981d49e21d752b840df4`. Docker image: `sha256:6854cea594dbb169d3d5910d0eda98dd9279737477eafed3687d8671eac2dc8b`. Previous image retained as `fets-live-app:rollback-20260930T024542Z`. Release directory contains both the exact static build and a source snapshot.

31 focused interface/parser tests and the TypeScript/Vite production build passed. Live workspace capabilities report desk=true and duties=true for the supplied user. The FETS AI Edge Function remains ACTIVE with JWT verification. Signed-in Gemini/media behavior still requires a real browser session; the interaction UI was checked with mocked responses.

Public Chromium checks confirmed the restored premium login on desktop and mobile without page errors. `/calendar` and the local development server return HTTP 200.
