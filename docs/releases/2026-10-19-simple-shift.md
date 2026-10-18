# The Shift — simple daily work

Prepared on 19 October 2026, based on the currently deployed Actionables release and its follow-up migration records. This release is a website redesign. It uses the existing Shift repositories and capability version 5; it requires no database migration.

Staff previously had to choose a duty in a list, find its detail panel, interpret several filters and open a hidden timetable. My shift now shows the current post, the next post or break, and the next required check together. All personal duties appear directly below, with the owner/backup, target time, expected result and instructions. Failed saves retain the written draft and visible error through background refresh. Each duty offers one main step: Start duty, then Finish duty with a written result. Need help remains available. Submitted and closed work is retained in a separate expandable list; submission is never labelled verification.

The post summary uses the published rota and its effective coverage changes. Its end time is the next actual change, including breaks inside a rotation. Named break cover receives the corresponding checks, and current block instructions remain visible. Earlier unrecorded checkpoints are shown as missing records, not backfilled. Future work actions are disabled with an explanation, and sending the day report immediately closes the local view to further edits.

Team opens on duties needing attention: missing owners, overdue work, help requests and results awaiting review. Colleague cards show the published current post and assigned work. Leads can assign work, respond to support needs, inspect results and verify or return them. Leads retain their own duties and cannot verify their own results. Plan has plain Daily coverage, Regular duties and Weekly leads destinations. Report distinguishes independently verified work from results still awaiting review. People retains management recognition, support, training and warnings with evidence, context, an action and a follow-up date; staff retain their private feedback and response controls.

## Preservation and scope

- Calicut and Cochin continue to use their own existing rosters and records. Global scope does not substitute a team or invent a personal assignment.
- 90-minute rotations, 10-minute lab walks, 6-minute DVR checks, named break cover, effective amendments, handovers, independent reviews and closure rules use the existing logic and APIs.
- Task agreement snapshots, real actors, server timestamps, version checks and private feedback remain governed by the installed database policies and guards. No historical agreement, completion, audit record or performance score is fabricated.
- Actionables remains the source of its own work and results. Its page and backend are unchanged. FETS Online synchronization is unchanged and has not been newly validated. Android/Google Play remains separate.
- No production data, schema or website was changed while preparing this redesign. The public site still reports `3237999e3af7841293fd5ba36b38848d108eb0c8`. Deploy the reviewed website through the guarded VPS process with a retained rollback image and preserved configuration.

## Validation

- TypeScript and the production build pass. Existing chunk-size/Browserslist warnings remain.
- 67 frontend checks pass, including written results, failed-save retention, independent review, future and closed days, role controls, management privacy/context, overdue attention and report verification totals.
- 29 isolated PostgreSQL checks pass against the existing workflow, including ownership, version conflicts, required evidence, privacy, future-day restrictions, closure and data-preserving rollback compatibility. These checks never connect to production.
- Browser journeys pass at 1440, 768, 393 and 320 pixels without page errors or horizontal overflow. They exercise the staff start/finish/result flow, specific help, independent verification, team attention, assignment keyboard focus/Escape, management evidence, warning context, named break-cover checks, regular duties and report submission/closure.
- The standalone preview loads without a preview server or network connection. It uses clearly labelled fictional staff and in-memory records. Its role and time selectors are review controls only. Local preview markers and example case references are absent from the production bundle.

## Review preview

`fets-point/shift-preview.html` is development-only and is excluded from the production build. `scripts/verification/build-shift-preview.mjs` creates a single self-contained `The-Shift-Interactive-Preview.html`, with inline assets and a content policy that blocks network requests. Preview mutations affect memory only, including assignments, evidence, coverage and reports.

Build the portable preview from the repository root:

```bash
FETS_PREVIEW_OUTPUT=/tmp/fets-simple-shift node scripts/verification/build-shift-preview.mjs
```

For browser verification, start the frontend Vite server on local port 3012 and run `scripts/verification/verify-simple-shift.cjs` with `FETS_PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `FETS_PREVIEW_OUTPUT` set as needed. The verifier is fixed to the isolated local preview URL and blocks external requests. Run `scripts/tests/shift-workflow.mjs` with `FETS_PGLITE_MODULE` pointing to PGlite 0.3.14 for database checks.
