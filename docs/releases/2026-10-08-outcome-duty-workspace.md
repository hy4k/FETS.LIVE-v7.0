# The Shift: clear work agreements and development

The duty board opens on a staff member’s own daily assignments. Each duty has one accountable owner, a backup where applicable, an agreed result, instructions, a target time and an explicit work state. Staff start work, request specific support, and submit a written result. Another lead verifies the result or returns it with feedback. Leads keep their regular duties and cannot verify their own work.

Team day surfaces work needing an owner, support or independent review. Planning is a separate destination for recurring work agreements, daily coverage and weekly leads. The published rota still determines posts, break cover, 90-minute rotations, 10-minute lab walks and 6-minute DVR checks. Actionables remain their existing source of record; the shift screen links to them instead of offering a second completion record.

Management reviews saved assignments over a chosen period, with explicit denominators, recorded results and support context. Recognition, support, training and warnings are human-authored decisions with evidence, an action and a follow-up date. Warnings require recorded circumstances and an explicit context review. Decisions are visible only to management and their subject; staff can add their own response. Closing a follow-up requires an actual outcome and records the manager who closed it. The system does not rank employees or generate disciplinary decisions from task counts.

The home-page Shift promotion is removed. The primary navigation is Calendar → Roster → My Desk → Actionables → The Shift. The FETS Live logo opens home.

## Database and data preservation

Apply `supabase/migrations/20261008140311_shift_outcomes_and_development.sql` only to FETS Live, `qqewusetilxxfvfkmsed`, together with this website release. FETS Online (`ueufcqmdqtwvhjjyudeu`) is outside this migration’s scope.

Required existing schema: centre duty planning, coverage and activation, The Shift blueprint, and daily duty review. Inspect the live definitions and migration history; do not replay prerequisites merely because their original filenames are absent from the remote history. The 23 prerequisite function bodies match the reviewed source after removing comments and whitespace. The daily-review migration is recorded live as `20261008102703`, name `daily_duty_review`.

The new migration adds contract fields, versioned transitions, an append-only task activity trail, and private personnel follow-ups. It updates no existing task, user, plan, assignment, check log or report. Existing completions retain their authors and timestamps. Blank legacy agreements and result notes remain blank; neither historical contracts nor check records are fabricated. A lead can explicitly set an agreement for open work. Changing a completed agreement reopens it, while its prior state remains in the activity trail.

The server capability is version 5 with `dutyWorkflow: true`. The new result and personnel actions remain disabled until it is advertised. Old browser tabs must reload after activation because newly submitted work requires a written result. Authorization, independent review, stale-version protection, closed-day guards and personnel privacy are enforced in PostgreSQL, not just in the screen.

## Validation

- TypeScript production check and Vite production build.
- 55 frontend tests covering work agreements, required results, failed saves, independent review, support reasons, capabilities, planning, roster boundaries and break-cover checks.
- 28 isolated PostgreSQL checks covering migration preservation, contract snapshots, identity, version conflicts, workflow transitions, audit protection, privacy, warnings, closed days, future dates and rollback/restore compatibility.
- The 14 existing daily-review database checks pass separately.
- Local fictional journeys at 1440, 768, 393 and 320 pixels: staff agreement, required result, team allocation, management evidence and assignment modal focus/Escape. No viewport overflow or browser exceptions.
- Actual application shell checks at desktop and phone width: primary menu order, removed promotion, Shift route and logo-to-home navigation.

Run the local fictional preview with Vite at `/shift-preview.html`. This HTML and its `src/test` entry are not production build inputs. The verification harness blocks external Supabase requests; no fixture record is written to production.

## Production and rollback status

At preparation time, the public release manifest still reports commit `ad7d353dcbb643a16bfc661b3ce6eaf5eba7257f`, release `20261008T104724Z-duty-ad7d353`. The repository main ref is `a8272897d7a9107fa9d8e7b153bf6b7af68e8d67`; the prepared branch remains at `ad7d353`. The new outcomes migration is **not applied** and this redesign is **not deployed**.

The live preflight observed 99 saved daily tasks, 62 recurring responsibilities and zero duty events. Preserve these live records, including older completed work and carried duties. Recheck state at deployment; legitimate operational edits may continue.

The retained prior website release is `/opt/fets-releases/20261008T104724Z-duty-ad7d353`. Its predecessor rollback script, image archive and configuration backups were confirmed during the previous deployment. For this next release, also retain the currently running ad7d353 image and effective server configuration before switching assets.

After installing the outcomes migration, restoring only the older website is insufficient: its browser does not send the new result field. The tested compatibility rollback is `docs/releases/sql/2026-10-08-shift-compatibility-rollback.sql`. It advertises capability version 4 and permits older owner completion writes while retaining ownership, review and closure protections, all new columns, task audit records and private feedback. Use it with the older website release. `2026-10-08-shift-restore-workflow.sql` restores the new guards and capability without replaying tables or modifying existing records. Do not drop the new tables or delete operational data.

No connected Remote Desktop Commander device is available, and the installed Hostinger tools do not provide VPS command execution. This preparation therefore cannot switch the VPS release. Authenticated FETS Online integration remains unverified because project access is denied; page availability is not proof of synchronization. Verify the Online consumer against the published Live rota at rotation boundaries and named break cover before claiming that integration works. Do not create synthetic production checks to test it.

Android and Google Play changes remain separate in PR #31.
