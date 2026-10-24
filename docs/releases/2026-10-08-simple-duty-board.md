# Simple daily duty board

Prepared for review; not deployed to FETS Live, Supabase or FETS Online.

The daily view now starts with the published 90-minute rota, then shows the
existing jobs under each staff member. Calicut and Cochin still use their own
rosters, weekly leads, responsibilities and records. Staff start on **My jobs
today**; the lead and super admin start on **Team today**. The lead retains
regular duties. Existing owners, backups and recurrence schedules are preserved.
Known template titles have shorter display labels; stored titles and instructions
are unchanged. Custom jobs retain their wording.

Each card shows the current post, rotation end, due/next checks and daily jobs.
Named break cover and temporary coverage changes use the existing resolution
functions. Lab walks remain every 10 minutes; DVR checks remain every 6 minutes.
A check at a rotation boundary stays with the ending rotation's responsible
person. Missed checks are visible and cannot be backfilled through the board.
Record buttons require an explicit action by the responsible staff member.
The full rota, coverage editor, block review and log remain under an expandable
section. Jobs, instructions and report history are retained.

Completed jobs await an independent review. A lead or permitted planner can
verify another person's work; neither the assignee nor the person who recorded
completion can verify it. The super admin can review the lead's own work.
Verified work collapses. Reopening, editing or reassigning completed work clears
the review. Server checks reject stale reviews and changes to closed days.
Daily reports retain completion and review evidence and list outstanding reviews.

## Activation

Apply `supabase/migrations/20261008090000_daily_duty_review.sql` to the existing
FETS Live project only, after the existing duty planning, coverage and blueprint
migrations. This adds two nullable task columns, guarded review functions and
the `dutyReview` capability. It does not replace duties, plans or existing logs.
Deploy the frontend after the migration. Without the new capability, job
completion still works and the UI says independent verification is awaiting
activation. Do not enable the capability manually before installing its guards.

The FETS Online link and FETS Live's published rota/check storage are unchanged.
Live cross-application synchronization has **not** been verified. The public
FETS Online homepage responds, but its older documented `/release.json` marker
returns 404. Before deployment is signed off, check real authenticated staff in
both centres around a 90-minute changeover, a lab-walk checkpoint, a DVR checkpoint
and named break cover. Verify that FETS Online reads the same published owner
and records each check once. No production check records were fabricated.

## Validation

- Production TypeScript/Vite build.
- 42 focused frontend tests: daily board, rotation, coverage, duties, recurrence,
  reports and runtime capability activation.
- 14 isolated PostgreSQL/PGlite checks applying all four exact duty migrations:
  owner completion, review permissions, cross-centre denial, stale reviews,
  self-review denial, reassignment/reopening, evidence integrity, anonymous denial,
  report snapshots and closed-day mutation rejection.
- Actual board component rendered in Chromium at 1280, 390 and 320 pixels with
  labelled synthetic fixtures: no horizontal overflow or page errors, review and
  personal-view interactions passed. This is not authenticated production testing.

Run frontend checks from `fets-point`:

```sh
node node_modules/vitest/vitest.mjs run src/redesign/TodayBoard.test.tsx src/redesign/shift-board.test.ts src/redesign/shift-plan.test.ts src/redesign/DutyWorkspace.test.tsx src/redesign/shift-blueprint.test.ts src/redesign/CoverageEditor.test.tsx src/redesign/useWorkspaceCapabilities.test.tsx
```

Run the isolated database regression from the repository root, with PGlite
installed outside the application dependencies:

```sh
npm install --prefix /tmp/fets-duty-test @electric-sql/pglite@0.5.8
FETS_PGLITE_MODULE=/tmp/fets-duty-test/node_modules/@electric-sql/pglite/dist/index.js node scripts/tests/duty-review.mjs
```

No live migration, server deployment, Play upload or main-branch merge was made.
The Android update remains in its separate draft PR.
