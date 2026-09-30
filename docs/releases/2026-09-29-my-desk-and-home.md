# Personal My Desk and operations home

Deployed to `https://fets.live` on 2026-09-29 as release `20260929T083653Z`. Public HTML and entry assets match the verified build. This initial release used private browser storage. The completion release adds automatic cloud activation; the user confirmed the combined database installer returned READY. See the centre-planning release note for current status.

Release backup: `/opt/fets-releases/20260929T083653Z` on the VPS. Rollback image: `fets-live-app:rollback-20260929T083653Z`. Current image: `sha256:96af7a6d7c0d953e299970d1342615f21f433304acba3f3274eaf3a07f908f78`. Reviewed source files were copied to `/opt/apps/fets-live`, preserving server-only files. Changes have not been committed or pushed to GitHub.

My Desk is now a staff workspace with a personal cover, focus timer, daily notebook, self check-in, teammate chat shortcuts and retained staff tools. Cockpit, Actionables, Tasks, Living Board and Readiness are no longer embedded in My Desk; their implementations remain available for relocation.

Live now presents the centre calendar, scheduled candidate totals, checked-in staff, handovers awaiting acknowledgement, the duty roster and operations shortcuts. Actionables has a dedicated `/actionables` route. Shift Handover has a prominent entry point. Team chat and the AI studio remain available in a collapsed section. Totals use existing Supabase sources, distinguish errors from zero results, exclude cancelled sessions and checked-out staff, and use the India calendar date. Visible pages refresh each minute.

## Personal desk persistence

Migration: `supabase/migrations/20260929081548_personal_desk.sql`.

| Table | Purpose | Access |
| --- | --- | --- |
| `desk_preferences` | Cover preference and revision | Owner only |
| `desk_journal_entries` | Daily note, mood and revision | Owner only |
| `desk_focus_sessions` | Completed personal focus sessions | Owner only |

Ownership references `auth.users.id`, not a staff profile ID. RLS is enabled on all three tables; anonymous access is revoked. Writes to notes and preferences use security-invoker RPCs with optimistic revision checks. Focus records use idempotent IDs, with a browser outbox for failed requests. This data is personal, not attendance or a staff performance score. Existing browser notes are retained as drafts; cloud conflicts require explicitly loading the saved version. No service key is added to the browser.

The completion release supersedes build-time feature flags with the authenticated `fets_workspace_capabilities` RPC. The user confirmed the combined installer returned READY in the actual project `qqewusetilxxfvfkmsed`. Refreshing the deployed app enables cloud persistence when the capability probe succeeds. No environment edit or additional SQL is required for this release.

The connected Supabase account lacks access to inspect the project directly. Isolated database tests cover owner isolation and stale-revision rejection; real-account save verification remains a live operational check.

## Verification

- Production TypeScript/Vite build.
- Twelve component, sync, timer and operations tests.
- Twenty-seven isolated PostgreSQL checks against the actual migration, covering ownership, anonymous denial, ownership reassignment, constraints, optimistic concurrency and focus idempotency.
- Desktop and phone browser checks for both pages; cloud-enabled UI tested against an in-memory repository.

Database checks run without touching the real project:

```sh
# Install @electric-sql/pglite in an isolated tooling directory, then:
PGLITE_MODULE=/path/to/node_modules/@electric-sql/pglite/dist/index.js \
  node scripts/verification/verify-personal-desk.mjs
```

## Shift handover: next pass

Keep the current handover implementation for this release. The next design should bring shift start, open duties and shift-end sign-off into a clear sequence with outgoing and incoming ownership.

Before extending it, compare live tables with the repository migrations. `HandoverHub` and `dutyData` use `shift_handovers`, `handover_questions`, `handover_assignments`, `duty_master`, `duty_assignments` and `duty_daily_log`. Existing migration policies on handovers are broad; branch access and who can sign for the receiving shift need explicit database validation. Several duty operations catch database failures, and the old desk checklist and certificate modules still use prototype state. These are follow-up integration work, not verified cloud features in this release.

## VPS publication

The target is the existing `fets-live-app-1` container on `72.61.171.192`, reached internally at port 3021. Publish the tested static bundle as a new image, retain the previous image for rollback, and replace only the `app` service. Preserve other services, existing credentials, proxy configuration, and server-only untracked files. Do not run the repository's reset-and-rebuild deployment scripts: they would discard these uncommitted source changes and combine two different deployment methods.
