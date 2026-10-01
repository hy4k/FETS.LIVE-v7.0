# Connected roster status — 1 October 2026

FETS LIVE premium workspace, calendar roster, staff chat and FETS AI repairs are saved in main at `22ef11cd5fe0abf22ece614328f27bb3acea0fa1`. The deployed frontend remains release `20260930T174143Z`. Desktop/mobile public-page verification reports no JavaScript errors or horizontal overflow.

The reviewed files have also been synced into `C:\Projects\00_Inbox\FETS.LIVE-v7.0`; overwritten local versions were archived in `C:\Projects\00_Inbox\FETS-LIVE-before-chat-sync-20261001T061356Z.tar.gz`. The separate `roster-dialog.css` from that folder is preserved in Git; the active Calendar dialog uses `calendar-roster.css`.

The fets.online sync release is saved on [codex/verified-live-roster-sync](https://github.com/hy4k/fets.tv/tree/codex/verified-live-roster-sync). Its 132 tests, production build and targeted lint passed. The application reads both centres with the existing server-only source key. Unauthorized pull/cron requests are rejected.

Still required before deployment:

1. Run `docs/integrations/fets-online-roster-sync.sql` in **fets.online project ueufcqmdqtwvhjjyudeu**. The connected Supabase management account only has the fets.live/FETS POINT project, focus timer and fets.in, so it cannot apply this separate project's DDL.
2. Resolve the 1 October Cochin mismatch: two Claude/Anthropic candidates are tagged PROMETRIC at 10:15, while Calendar lists ANTHROPIC under PEARSON VUE at 08:00. Provider and time were not guessed.
3. Deploy the reviewed online branch, verify two pulls retain candidate IDs and operational progress, then enable its prepared 06:00 IST timer. Its current upload flow remains live until this succeeds.

Provider portal automation is assessed in `docs/integrations/provider-roster-automation.md`. No unattended provider import has been enabled yet.
