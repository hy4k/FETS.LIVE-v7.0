# My Desk: personal time insights and simpler tools

My Desk opens with the signed-in staff member’s name and joining-date tenure, followed by three sections: **My time**, **Applications** and **Help desk**. Start Focus, the notebook, Checklist, Better Together, the team round and its chat shortcuts are removed. Their saved records are retained.

## My time

The default view is a read-only monthly analysis of the signed-in person’s own roster and attendance. It shows completed net work, assessable time outside assigned hours, rostered days off, records needing review, weekly assigned/recorded hours, workday streaks, typical check-out and gaps between recorded shifts. A day calendar opens the actual shift, in/out times, breaks, net work and approved roster OT. There are no application forms or approval controls in this section.

Calculations reuse the roster attendance engine. Each saved custom or half-day shift supplies its actual timings. Only legacy untimed Day/OT shifts use the established 8 AM–5 PM default; unknown evening timings stay unassessed. Completed totals exclude active, missing-check-out, future, conflicting and invalid records. Breaks are deducted; outside-roster time remains unassessed where aggregate breaks cannot be allocated. Missing roster dates are not days off, missing check-ins are not automatically absences, and time beyond a shift is not automatically approved overtime. A gap is not claimed across unknown or unfinished intervening days and is not labelled as sleep or leisure. The view uses India dates and refreshes on relevant record events, return to the page and once per minute.

The read adapter verifies the current Supabase Auth user against the requested staff profile, then filters both tables by that exact profile and date range, with pagination. It does not fetch other staff for analysis. Existing database table policies remain; this release does not expand or tighten the project’s broader attendance visibility. Connector failures produce a retry state rather than invented zero hours.

## Applications, Home and Vault

Applications has separate entry points for Leave, Half-day leave, TOIL day off and Shift swap, alongside existing history and approvals. Half-day leave splits the assigned shift, so 06:00–15:00 first-half leave means working 10:30–15:00. A shift swap requires the colleague’s agreement before management approval. Resolution rechecks roster versions, dates, attendance and OT and commits approved roster changes atomically.

Home contains one **F Vault** entry. Quick Access and Access Hub use the same existing Vault data; the merged view deduplicates matching owner/site/portal/account records, prefers the newest Quick Access values and preserves distinct notes/additional fields. It does not merge across owners, copy secrets or delete source credentials. Secrets remain masked, explicit reveal expires, and editing requires an explicit save. Raise a case is also on Home and the banner is shorter. Existing FETS Sites features and permissions are retained.

## Backend and validation

No new database migration is required. The already-applied Live-only request migration `20261028022657_personal_desk_requests_and_team_round.sql` supplies half-day and consented-swap RPCs; its checksum and invoker/grant settings were verified again. Retaining its unused team-round table preserves history without exposing that feature. No production request, roster, attendance, credential or participation record was created for testing. FETS Online is unchanged.

- 67 focused frontend tests cover personal calculations, ownership filtering, retry/stale-account handling, direct applications, Vault masking/deduplication, Home permissions and retained Sites behaviour.
- 17 isolated PostgreSQL checks cover authenticated requests, privacy, half-day timing, swap consent, stale dates/rosters, attendance/OT protection and atomic resolution.
- Production application TypeScript check and Vite build.
- Full-app browser checks at 1440, 768, 390 and 320 pixels, including time analysis, the four application forms/history, Home/Vault navigation and no overflow or page errors. Fixtures remain isolated from production.

Deployed on 28 October 2026 as `20261028T131047Z-my-desk-b90261c`, web commit `b90261cf73508c99b0f17fe7e1bff5e07fdd5f8c`. The completed checksum-verified VPS script reports 58 public file/route comparisons passed, runtime/Nginx preservation and retained rollback. Independent public checks confirmed the release commit, HTML checksum, My Desk/calendar/roster/Sites route responses, retained previous shell asset and successful evaluation of the actual compiled application module with no page errors. These checks did not log in or create production test records.

Live-only backend verification at 13:18 UTC confirmed the existing request migration and invoker-only functions, authenticated execution and no anonymous execution. No new migration was needed. Details and evidence boundaries are recorded in `2026-10-28-my-desk-time-production.json`.

Rollback: `bash /opt/fets-releases/20261028T131047Z-my-desk-b90261c/rollback.sh`.
