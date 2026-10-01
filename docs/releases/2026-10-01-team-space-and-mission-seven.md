# Team Space and Mission 7 — 1 October 2026

Deployed to `https://fets.live` as release `20261001T102043Z`, source commit `314289f30c28e3007c75ae3970444b951a5ca4ad`. The public index SHA-256 matches the reviewed build: `8a715f5aa27efe6a1b9d983b95e251ebbffbf1456aa739ac0b288e6537641ef3`. The VPS retains the previous image and source snapshot for rollback. The canonical Windows workspace was synced after backing up its overwritten files to `C:\Projects\00_Inbox\FETS-LIVE-before-team-space-20261001T102045Z.tar.gz`.

The full chat workspace now brings direct and group conversations, voice/video room controls, private file attachments, message search, personal saved messages, shared follow-ups with owners/dates, decisions and a copyable handover brief together. My Desk chat shortcuts and message notification replies use the same workspace, including the correct group conversation. Conversation lists refresh for new memberships and messages. The old page masthead is removed from active chat, Actionables and remaining legacy routes; those legacy routes have compact workspace navigation.

At the owner's request, five old conversations and six old messages were cleared in a one-time guarded transaction, with their associated chat records. No sample conversations or institutions were seeded. Cleanup is deliberately not an installation migration, so future deployments never erase new staff messages.

Actionables opens Mission 7: seven Pearson VUE centres across Kottayam, Ernakulam, Thrissur, Calicut and Kannur by 30 November 2026. It includes a shared board, owners, dates, named blockers, district filters, the existing institution shortlist and field notes. Existing institutions and previous actionables are preserved. Pearson approvals are reported separately from centre delivery; there are no invented district quotas or completed centres. The owner's detailed delivery workflow remains the next design input.

Applied live database migrations:

- `20261001070000_team_communication_and_mission_work.sql`: conversation work items, private saved messages, shared mission work and membership/staff RLS.
- `20261001073000_private_team_files.sql`: private 20 MB chat storage, membership-scoped file access, active staff access to existing expansion records and realtime publication.
- `20261001074500_roster_exam_provider_guard.sql`: known Claude/Anthropic → PEARSON VUE and CMA US → PROMETRIC validation, also surfaced in Calendar preview.

All three are recorded in migration history. No additional SQL is required from the owner. The FETS AI catalogue was redeployed with the new workspace descriptions and client relationships; this does not grant AI automatic access to private conversations.

Validation: 60 focused frontend tests, production TypeScript/build, desktop and mobile layout review, chat/thread/form interactions, real REST relation projections, rolled-back SQL operations and nonmember storage access checks. No fixture messages were written to production. Voice/video entry controls and the existing token path are available; physical two-device microphone/camera quality has not been tested in this session.

Connected roster deployment and its remaining Calicut source-data gap are documented in `2026-10-01-roster-integration-status.md`. Provider portal automation remains a separate pilot requiring real exports or a supervised portal session.
