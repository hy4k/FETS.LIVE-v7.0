# Shared lab-walk and DVR checks

FETS Online records the 10-minute lab walk and 6-minute DVR check directly against FETS Live's published Shift timetable. The canonical row is `centre_duty_events`: there is no second write, eventual-copy queue or nearest-time matching. Both sites read the same immutable event ID, actual staff profile and server timestamp. The Online lab screen polls every 10 seconds and refreshes after recording. The Online Report screen provides a separate, read-only shared log and CSV; existing signed exam reports and earlier local walkthrough records remain unchanged.

## Identity and permissions

The Online API validates the session with `auth.getUser()`, requires a confirmed email and a non-viewer staff profile, and derives the active centre from that database profile. It ignores any actor, email, centre or timestamp supplied in the request body. Same-origin JSON is required for writes. The server-only Live bridge accepts only `service_role`; browser and anonymous roles cannot call it. The private `online_actor` helper needs definer privileges solely to look up confirmed, non-banned, non-deleted Live auth users. It requires the server role, exactly one matching verified email and an active profile with trusted centre membership. Names and user-editable metadata are not identity evidence. There are no automatically created accounts or staff mappings.

The bridge temporarily sets the transaction-local Live user subject, then uses the existing event trigger to validate and stamp the real actor and timestamp. The previous subject is restored on both success and error. The private provenance table records the Online user ID alongside the canonical event ID. All new functions have fixed search paths and explicit grants; the provenance table has RLS, explicit server-only select/insert policies and no browser privileges.

## Timing, cover and retries

The 90-minute published blocks supply the check grid: each block has walks every 10 minutes and DVR checks every 6 minutes. Ownership resolves at the minute before the due time, matching The Shift. An end-of-block check belongs to the outgoing owner. Effective amendments take precedence, followed by named break cover and the original block owner. The backend rechecks the current roster and shift closure on every write. Missed checks cannot be backfilled and future checks cannot be recorded.

A plan advisory lock and the existing unique check index prevent duplicates. A retry for the same slot, actor and note returns the same immutable event even after its recording window ends. A different actor or changed note is rejected. Errors retain the draft note and pause recording until a successful refresh; neither connection failures nor elapsed time imply completion.

## Rollout and verification

Apply `supabase/migrations/20261019185443_online_shift_checks.sql` and `20261019203847_online_check_provenance_policy.sql` only to FETS Live (`qqewusetilxxfvfkmsed`). FETS Online (`ueufcqmdqtwvhjjyudeu`) requires no schema or data migration. Its app already has server-only credentials for both projects. Deploy the matching `hy4k/fets.tv` branch `codex/online-shift-checks` after the bridge is present.

Seventeen isolated PostgreSQL checks exercise permissions, confirmed/active identities, centre separation, both timing windows, exact rotation and break boundaries, coverage amendments, roster removal, duplicate retries, report closure and reads of checks written directly by The Shift. Online request/unit checks cover forged identity fields, cross-origin requests, anonymous access, input validation, outage handling and exact CSV linkage. Browser checks at 1440, 393 and 320 pixels use labelled fictional data and cover save failure/draft retention, successful recording, wrong-owner controls, stale connections and unpublished plans. No production completion records are fabricated.

Production preflight on 20 October 2026 IST found no published plan for today at either centre. Seven of eight non-viewer Online staff accounts have matching confirmed Live emails and centre membership; the ninth Online account is a viewer. Membership is checked again on each request. A lead must publish the actual day plan before recording becomes available. Unmatched accounts require an authorised staff-account correction; this release does not grant them access automatically.

The existing candidate-roster cron is separate: its runtime secret was empty during inspection, and automatic roster pulls were not changed by this release. This integration makes no claim that candidate-roster automation is repaired.

Rollback restores the previous Online app image. The additive Live bridge can remain installed: the existing Shift UI, event trigger and records remain compatible. To disable bridge access without deleting records, revoke the two public RPC execute grants from `service_role`; retain the provenance table and all duty events.

## Backend activation — 20 October 2026 IST

The bridge migration was installed as version `20261019203512` (`online_shift_checks`), followed by the explicit provenance policies. Production privileges confirm anonymous and authenticated browser roles cannot execute either RPC or the private identity helper; only `service_role` can. The public RPCs are security invoker; the private auth lookup is narrowly privileged. The existing database has unrelated advisor findings; this change does not modify those objects.

Read-only bridge calls using confirmed Online identities matched all **432 due slots and resolved owners** from the three published historical plans, including named cover. No production check records were written. Before/after counts remained 17 auth users, nine plans, zero duty events and one report; the new provenance table is empty. Online's existing 1,749 candidates, 39 sessions, nine profiles and two centres were not modified.

The Online website release is prepared on `hy4k/fets.tv:codex/online-shift-checks`, rebased on current main `cffdec3` so candidate-correction work is preserved. Its 176 tests and production build pass. Website cutover remains pending VPS access: Desktop Commander disconnected before deployment. Re-inspect its current image/configuration and retain rollback before using the guarded script. The installed backend alone does not mean the UI is deployed.
