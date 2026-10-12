# The Shift: clear work agreements and development

The duty board opens on a staff member’s own daily assignments. Each duty has one accountable owner, a backup where applicable, an agreed result, instructions, a target time and an explicit work state. Staff start work, request specific support, and submit a written result. Another lead verifies the result or returns it with feedback. Leads keep their regular duties and cannot verify their own work.

Team day surfaces work needing an owner, support or independent review. Planning is a separate destination for recurring work agreements, daily coverage and weekly leads. The published rota still determines posts, break cover, 90-minute rotations, 10-minute lab walks and 6-minute DVR checks. Actionables remain their existing source of record; the shift screen links to them instead of offering a second completion record.

Management reviews saved assignments over a chosen period, with explicit denominators, recorded results and support context. Recognition, support, training and warnings are human-authored decisions with evidence, an action and a follow-up date. Warnings require recorded circumstances and an explicit context review. Decisions are visible only to management and their subject; staff can add their own response. Closing a follow-up requires an actual outcome and records the manager who closed it. The system does not rank employees or generate disciplinary decisions from task counts.

The home-page Shift promotion is removed. The primary navigation is Calendar → Roster → My Desk → Actionables → The Shift. The FETS Live logo opens home.

## Database and data preservation

Apply `supabase/migrations/20261008140311_shift_outcomes_and_development.sql` only to FETS Live, `qqewusetilxxfvfkmsed`, together with this website release. FETS Online (`ueufcqmdqtwvhjjyudeu`) is outside this migration’s scope.

Follow it with `20261012163514_shift_development_least_privilege.sql`. Supabase's default grants included DELETE, TRUNCATE, REFERENCES and TRIGGER on the new personnel table. The follow-up explicitly revokes client grants and restores only authenticated SELECT, INSERT and UPDATE, governed by the existing policies and guards. TRUNCATE bypasses RLS and must not remain granted. No rows are changed by this correction.

Required existing schema: centre duty planning, coverage and activation, The Shift blueprint, and daily duty review. Inspect the live definitions and migration history; do not replay prerequisites merely because their original filenames are absent from the remote history. The 23 prerequisite function bodies match the reviewed source after removing comments and whitespace. The daily-review migration is recorded live as `20261008102703`, name `daily_duty_review`.

The new migration adds contract fields, versioned transitions, an append-only task activity trail, and private personnel follow-ups. It updates no existing task, user, plan, assignment, check log or report. Existing completions retain their authors and timestamps. Blank legacy agreements and result notes remain blank; neither historical contracts nor check records are fabricated. A lead can explicitly set an agreement for open work. Changing a completed agreement reopens it, while its prior state remains in the activity trail.

The server capability is version 5 with `dutyWorkflow: true`. The new result and personnel actions remain disabled until it is advertised. Old browser tabs must reload after activation because newly submitted work requires a written result. Authorization, independent review, stale-version protection, closed-day guards and personnel privacy are enforced in PostgreSQL, not just in the screen.

## Validation

- TypeScript production check and Vite production build.
- 55 frontend tests covering work agreements, required results, failed saves, independent review, support reasons, capabilities, planning, roster boundaries and break-cover checks.
- 29 isolated PostgreSQL checks covering migration preservation, contract snapshots, identity, version conflicts, workflow transitions, audit protection, privacy, warnings, closed days, future dates, rollback/restore compatibility and client privileges under Supabase's default grants.
- The 14 existing daily-review database checks pass separately.
- Local fictional journeys at 1440, 768, 393 and 320 pixels: staff agreement, required result, team allocation, management evidence and assignment modal focus/Escape. No viewport overflow or browser exceptions.
- Actual application shell checks at desktop and phone width: primary menu order, removed promotion, Shift route and logo-to-home navigation.

Run the local fictional preview with Vite at `/shift-preview.html`. This HTML and its `src/test` entry are not production build inputs. The verification harness blocks external Supabase requests; no fixture record is written to production.

## Production and rollback status

Deployed on 12 October 2026: public release `20261012T121508Z-shift-deb779c`, website commit `deb779c8435dcad0bc2b6c0f91e3b3ae67aceacf`. The user executed the guarded VPS deployment and resume scripts. The first attempt automatically restored the previous website when an environment-array ordering comparison failed. The resume compared variable names and values, enforced the other configuration checks and reused the completed build. It verified 49 public files/routes and preserved runtime values, ports, mounts, restart policy and Nginx configuration. Independent verification confirmed all 46 JavaScript/CSS assets and matching root/calendar HTML hashes, `9a4d7a13a395b84996cb6ce356f83547195d77338eafe0cc5566fbdc858d6a0f`.

The outcomes migration is applied only to FETS Live, recorded as `20261012163340`; the least-privilege correction is recorded as `20261012163555`. Capability version 5 is active. Enabled guards, RLS policies, authenticated-only public RPC access and final table grants were inspected. Counts and content fingerprints across 16 existing tables remained identical, including 17 users, 12 profiles, 1,976 roster records, 136 daily tasks, 62 responsibilities, 70 duty assignments, 390 duty logs and the existing report. Both new tables remained empty; no production test records were created. Security advisors reported no new findings compared with the pre-migration baseline.

Rollback image archive and configuration snapshots are retained in `/opt/fets-releases/20261012T121508Z-shift-deb779c`. Its `rollback.sh` restores the preceding ad7d353 website. The database compatibility script below is also required after version-5 activation; the website rollback alone does not restore old completion compatibility.

After installing the outcomes migration, restoring only the older website is insufficient: its browser does not send the new result field. The tested compatibility rollback is `docs/releases/sql/2026-10-08-shift-compatibility-rollback.sql`. It advertises capability version 4 and permits older owner completion writes while retaining ownership, review and closure protections, all new columns, task audit records and private feedback. Use it with the older website release. `2026-10-08-shift-restore-workflow.sql` restores the new guards and capability without replaying tables or modifying existing records. Do not drop the new tables or delete operational data.

Remote Desktop Commander did not expose the paired VPS through this session, and the installed Hostinger tools did not provide VPS command execution, so the user ran the guarded deployment through the VPS terminal. Authenticated FETS Online integration remains unverified: the read-only access recheck on 12 October returned `You do not have permission to perform this action` for `ueufcqmdqtwvhjjyudeu`. Page availability is not proof of synchronization. Verify the Online consumer against the published Live rota at rotation boundaries and named break cover before claiming that integration works. Do not create synthetic production checks to test it.

Android and Google Play changes remain separate in PR #31.
