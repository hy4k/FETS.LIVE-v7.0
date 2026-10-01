# Actionables: our working day

Live release `20261001T204642Z` on `https://fets.live`; the public index matches the reviewed production build (`19d4ed530a3d228360e50bc852418ea23ddb343824ea7bc4fb9ebc2ae94ce1f7`). The prior image and source snapshot are retained on the VPS. The canonical Windows workspace was synced after backup `C:\Projects\00_Inbox\FETS-LIVE-before-working-day-20261001T204522Z.tar.gz`.

The default Mission 7 view is a staff workspace. Its compact mission header keeps the seven-centre target and 30 November 2026 deadline visible while personal next steps and blocked work take priority.

- Personal priorities put dated/overdue work first. When nothing is assigned, staff see unclaimed contributions. New next steps default to the current staff member and capture why the work matters to the mission.
- Shared updates, help requests and celebrations support centre links, replies, named help offers and appreciation. Help-request authors can resolve or reopen their requests. Work cards open their own discussion with the purpose, owner, due date and start/complete controls.
- Task creation, status/ownership changes, centre stages and new field notes appear in the feed automatically. Replies bring older conversations back into recent activity. Saved visit checkpoints show changes since the last visit, including replies, and cannot move backwards when two tabs are open.
- Centre cards rank actual recorded stages and show outstanding next steps. Staff can update a recorded milestone and plan the next step from the centre detail. Pearson approval is still separate from confirmed delivery; no invented completion percentages, district quotas or sample progress are added.

Backend: `20261001110000_mission_shared_workplace.sql` adds posts, replies, reactions/help offers, private visit checkpoints and task purpose. All shared content requires active staff access. Authors cannot be impersonated, staff cannot insert forged automatic activity, and reactions are unique per person/type. Deleting a task or institution preserves its conversation with the obsolete link cleared.

Validation: six focused reporting tests (`mission-workplace.test.ts` and `MissionWorkspace.test.ts`); rolled-back production SQL (`scripts/verification/mission-workplace.sql`) covering events, reply context/counters, help resolution, duplicate offers, author isolation, private visits, nonstaff denial, field-note events and parent deletion; real REST relation projection checks; desktop/mobile UI interactions with all backend requests mocked. Review fixtures are removed before building and are never deployed.

The migration is applied directly to fets.live Supabase. No manual SQL is required. Existing institutions, task ownership and historical field notes remain intact. The AI page catalogue describes the new navigation and capabilities; it does not claim access to live mission content.
