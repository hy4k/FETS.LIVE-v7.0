# Staff chat and Gemini Live repair

Deployed frontend release `20260930T174143Z` at https://fets.live. Public index SHA-256: `985b701e01bc32cb0f7084cdda2b63082716326615a7b124358ca52063c4612b`.

- Removed three redundant legacy conversation-members policies, including the self-referencing SELECT policy causing infinite recursion.
- Corrected group creation and direct-message RPCs to use staff-profile IDs; group creators are always members. Sending binds the sender to the signed-in staff profile. Membership insertion is restricted to the creator/group admin. Qualified the preview trigger for safe RPC search paths.
- Restored a real team-conversation page, group creation, and group voice/video rooms. My Desk links to that page. The LiveKit token function checks authenticated conversation membership before granting room access.
- Fixed the Gemini ephemeral-token REST body (`bidiGenerateContentSetup`) and websocket setup (`generationConfig.responseModalities`). Existing API key and Gemini 3.1 model retained; misleading blanket billing error removed.

Validation: 57 focused frontend tests passed; production build passed. On the real database, membership reads, message insert/read, group creation, group-message RPC, and nonmember membership rejection passed in rolled-back transactions. Gemini's token endpoint returned 200 and its Live websocket acknowledged setupComplete with the existing key. No customer message/media was sent for that test. Multi-device microphone/camera media remains a manual acceptance check.

Applied migrations: `20260930173000`, `20260930182000`, `20260930183000`. Both `fets-ai-agent` and `livekit-token` Edge Functions deployed. Staff do not need to run these SQL files themselves.

The separate fets.online migration in `docs/integrations/fets-online-roster-sync.sql` belongs to **ueufcqmdqtwvhjjyudeu**, not this application's Supabase project. Its deployment status is tracked separately; do not infer it from this frontend release.
