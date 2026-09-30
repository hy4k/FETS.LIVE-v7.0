# Calendar, roster and centre duty planning

## Product model

A weekly lead is a responsibility shared by the team, not a permanent rank. The lead keeps ordinary duties, supports colleagues, arranges named break cover, reviews submitted block updates and sends one final centre report to the super admin. A lead cannot verify their own work. The super admin can review the lead’s submissions.

The roster remains the source of who works at a centre. Month-ahead planning chooses a Monday–Sunday lead from that week’s roster and prepares each day from actual staff IDs. A named acting lead covers a weekly lead’s rest day. Missing roster rows never become fictional assignments.

Each day has the six supplied 90-minute blocks from 08:00 to 17:00. Front office, scanning/lab and check-in/DVR retain the supplied role rotation and additional duties. Lab walks recur every 10 minutes; DVR checks every 6 minutes. Checks at a block’s closing boundary belong to the ending block. A check during a break belongs to the named cover person. Confirmed by the user on 29 September 2026.

The supplied 30-minute breaks are staggered at 10:00, 10:30, 11:00 and 14:00, 14:30, 15:00. The lead names an available colleague for every break and records how they will handle combined duties. The software does not claim that two people provide three independent staff positions. If combined work is not practical, arrange relief and amend the roster. One person alone at opening cannot publish a fully covered three-lane plan.

Staff see My part or Whole team, recurring checks, regular duties, additional work and break coverage. Updates carry server-recorded identities and timestamps. Late or missing checks stay visible; expired checks cannot be backfilled. End-of-block submissions need a short note. Leads review or return them with an explanation. Support requests are recorded in the shift log, not automatically sent to external chat recipients.

The final report is submitted after 17:00 India time. It preserves the day plan and audit events, including unresolved checks and unreviewed submissions. The lead adds a summary, open items with next owner/action/due time, and team recognition. Reports remain visible to that centre; the super admin can see all centres and acknowledge reports. There is no click-based performance leaderboard in the new duty workspace.

## Implemented

- Warm paper/sage Calendar and Roster layouts matching My Desk, readable summaries, shorter headers and responsive toolbars. Calendar retains session editing, search, filters, day/week/month views and analysis. Small screens open in day view; month grid scrolls within its own container.
- Roster keeps its existing shift editing, quick-add, attendance and review tools. Missing shifts show Not planned, not generated leave/rest/day/evening codes. New lead badges read the weekly planning tables only when activated; old stretch-based lead guesses are no longer displayed on the main roster.
- New `/handover` workspace: The shift, Plan ahead, Centre reports and Previous handovers. The previous handover system remains accessible in its own tab.
- A My centre duties shortcut in My Desk and planning links from Calendar/Roster.
- Roster-based draft generation, editable lane ownership/additional duties, confirmation of actual shift hours, acting lead, break cover, publication checks, staff events, independent review, final report and super-admin acknowledgement.
- Five Supabase tables with RLS, trusted membership authorization, branch isolation, immutable events, protected reports, server validation, duplicate-check prevention and optimistic version checks.

## Activation status

The user confirmed that `complete_workspace_setup.sql` returned **READY — refresh fets.live and open My Desk or Handover** in project `qqewusetilxxfvfkmsed` on 2026-09-29. No further SQL is required for this release. This is user-confirmed execution; the connected Supabase account still lacks access to inspect this project directly.

The app uses the authenticated `fets_workspace_capabilities` RPC to enable personal cloud storage and trusted-member duty access. Build-time cloud flags are obsolete. Refresh the app after installation. When database capabilities cannot be confirmed, the UI labels private drafts explicitly and does not claim shared publication.

Trusted `centre_duty_members` records are seeded from active staff profiles by the installer. New employees, centre transfers and revoked access require trusted SQL/server administration. Browser-editable profile metadata cannot grant duty access. Existing roster RLS must permit the intended centre colleagues' roster reads.

Real-account verification of publication, staff updates and the super-admin report inbox remains a live operational check; no fabricated production duties or reports were created for testing.

## Practical limits and next iteration

- This is the supplied 08:00–17:00 operating template. Before using other operating hours, night shifts, other exam-window cadences or multiple labs, add centre-specific templates and corresponding server validation.
- Published base plans stay immutable. The new coverage-change workflow records temporary duty/break cover or an acting lead with a reason, author and future effective minute. Prior ownership is preserved, expired checks cannot be reassigned, changes stop when the final report closes the shift, and the final report includes the change history.
- Checks and refreshes run while the page is open. There is no background push notification or unattended monitoring service.
- Follow-up ownership and due times are recorded in the report as text, not yet a separate assigned follow-up queue.
- `fets.online/t` opens as an external candidate-calling screen. No undocumented API or candidate identity data is copied into the new module.
- The new database/repository accepts centre names without a two-centre enum. The wider legacy app still contains centre-specific selectors, capacities and reports; onboarding a fourth/fifth centre requires updating those configurations and provisioning trusted duty memberships.

## Verification

- Focused frontend tests cover desk/home, rotation, cadence, availability, permissions, private drafts, coverage changes, report closure and runtime activation.
- Exact SQL migration exercised in isolated PostgreSQL/PGlite: 44 checks covering branch isolation, publication gaps, missing/self break cover, rostered leads, staff ownership, independent review, immutable events, report snapshots, acknowledgement and anonymous denial.
- Desktop and 390px browser review of actual Calendar, Roster and Duty Workspace components with labelled test fixtures, no runtime page errors. Tables scroll inside their containers.
- Production TypeScript/Vite build and public deployment checks are recorded when deployment completes.

## Earlier deployment

Release `20260929T094131Z` deployed to Hostinger VPS and verified publicly. Production TypeScript/Vite build passed. Desktop, 390px and fresh 320px Calendar checks passed without runtime errors. Previous image retained as `fets-live-app:rollback-20260929T094131Z`. Both new cloud feature flags remain disabled.

Active image: `sha256:04eb03cad454b15b42d84e35c4c237c9792716afcbeeda99ecb397f1e039a6db`. Release directory: `/opt/fets-releases/20260929T094131Z`. The original My Desk/Home release remains the rollback image.


## End-to-end completion update

Run `fets-point/scripts/complete_workspace_setup.sql` in the SQL Editor for project `qqewusetilxxfvfkmsed`. It combines the personal-desk migration, duty-planning migration and `20260929100511_duty_coverage_and_activation.sql` in a rerunnable transaction. It verifies required existing columns, active super-admin membership and RLS on all nine workspace tables. It does not replace chat, roster, calendar or old handover tables.

The app now uses the authenticated `fets_workspace_capabilities` RPC, rather than build-time feature flags, to detect completion. Once SQL returns READY, refresh the app (or choose Check database setup in Handover). My Desk cloud storage and shared duties activate only after the versioned probe succeeds; duty access also requires a trusted centre membership. There is no need to edit environment variables or rebuild after running SQL.

Audited coverage is implemented in the database and UI. Named replacements must be rostered, have confirmed hours covering the full period, and cannot be on their own planned break. Only the current lead or super admin can arrange changes. Former and replacement owners may submit block updates; anyone who owned part of a lane cannot independently review that lane. Centre reports preserve all amendments alongside the original plan and audit events.

Validation: 61 PostgreSQL end-to-end checks including full installer reruns, branch/role access, immutable history, non-retroactive changes, temporary replacement/reversion, report closure and activation. Frontend ownership/coverage and activation tests verify the corresponding UI. The user subsequently confirmed the installer returned READY in the live project. Authenticated live-account actions have not been exercised by the agent because the connected account lacks project access.


## Completion release — 20260929T102443Z

Deployed to Hostinger and verified against the local production build. Active image: `sha256:7355ac4aa1d6d62e54a1696dd21c6408503836cadca73b351ce7266fbad875e5`. Release directory: `/opt/fets-releases/20260929T102443Z`. Rollback image: `fets-live-app:rollback-20260929T102443Z`. The current server source retains server-specific configuration.

The user confirmed the combined SQL returned READY. A read-only anonymous API probe returned PostgreSQL `42501` (permission denied) for `fets_workspace_capabilities`, independently confirming the function exists and is protected. Authenticated staff and super-admin production actions were not performed by the agent.

Final verification: production TypeScript/Vite build passed; all 34 focused frontend tests passed; 61 isolated PostgreSQL checks passed; desktop and mobile coverage editing fixture passed without runtime errors. Public route and entry-asset checks use exact build hashes. Existing bundle-size warnings remain.

No further SQL is required for this release. Refresh the site to activate the authenticated capability check. Start with an agreed real roster and review each draft before publication. Changes remain uncommitted locally and have not been pushed to GitHub.
