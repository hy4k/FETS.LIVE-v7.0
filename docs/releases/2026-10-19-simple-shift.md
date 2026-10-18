# The Shift — the day in time order

Prepared on 19 October 2026, based on the currently deployed Actionables release and its follow-up migration records. This release is a website redesign. It uses the existing Shift repositories and capability version 5; it requires no database migration.

The Shift opens as a chronological timetable. Post intervals, breaks and assigned-work deadlines appear in one sequence. The current post has a distinct green treatment, and the clock jumps to it. Deadline rows show progress without hiding them after submission. Opening a duty reveals the expected result, instructions, Start/Finish, help request, evidence and independent review controls in place.

The timetable follows the published rota and effective coverage changes. Personal intervals end at break and rotation boundaries. The team timetable splits at every rotation, break and effective coverage change, showing the actual responsible person and named cover. Future work remains visible but cannot be started. Submitted work stays unverified until an independent reviewer verifies it; elapsed post time never implies a completed check or task.

My shift shows the signed-in person’s day; Team shows everyone’s responsibilities and deadlines in time order. A needs-attention filter brings forward unassigned work, overdue duties, help requests and results awaiting review, and a single action restores the whole day. Earlier missing checks are disclosed as missing records and cannot be backfilled. Handover records remain available below the timetable.

The visual design uses warm off-white, dark green, restrained status colours, aligned time labels and expandable work rows. Desktop, tablet and phone layouts use the same chronological order. The timetable supports keyboard expansion, visible focus, reduced-motion navigation and a compact current-post shortcut.

Leads retain Plan, independent verification, help requests and report submission. Managers retain evidence-based private recognition, support, training, warnings and follow-up outcomes. Saved result drafts and errors survive failed writes and background refresh, and report submission immediately closes the local day to further changes.

## Preservation and scope

- Calicut and Cochin continue to use their own existing rosters and records. Global scope does not substitute a team or invent a personal assignment.
- 90-minute rotations, 10-minute lab walks, 6-minute DVR checks, named break cover, effective amendments, handovers, independent reviews and closure rules use the existing logic and APIs.
- Task agreement snapshots, real actors, server timestamps, version checks and private feedback remain governed by the installed database policies and guards. No historical agreement, completion, audit record or performance score is fabricated.
- Actionables remains the source of its own work and results. Its page and backend are unchanged. FETS Online synchronization is unchanged and has not been newly validated. Android/Google Play remains separate.
- No production data, schema or website was changed while preparing this redesign. The public site still reports `3237999e3af7841293fd5ba36b38848d108eb0c8`. Deploy the reviewed website through the guarded VPS process with a retained rollback image and preserved configuration.

## Validation

- TypeScript and the production build pass. Existing chunk-size/Browserslist warnings remain.
- 49 targeted frontend checks pass across six files (21 workspace checks and 28 scheduling/planning checks), including chronological ordering, effective ownership at exact break boundaries, written results, failed-save retention, independent review, future and closed days, role controls, management privacy/context, overdue attention and report verification totals.
- The existing workflow previously passed 29 isolated PostgreSQL checks; this revision changes no database code. Those checks cover the existing workflow, including ownership, version conflicts, required evidence, privacy, future-day restrictions, closure and data-preserving rollback compatibility. These checks never connect to production.
- Browser journeys pass at 1440, 768, 393 and 320 pixels without page errors or horizontal overflow. They exercise the staff start/finish/result flow, specific help, independent verification, timetable ordering, assignment keyboard focus/Escape, management evidence, warning context, named break-cover checks, regular duties and report submission/closure.
- The standalone preview loads without a preview server or network connection. It uses clearly labelled fictional staff and in-memory records. Offline checks also exercise keyboard expansion and the current-post shortcut at 1440, 393 and 320 pixels with zero network requests. Its role and time selectors are review controls only. Local preview markers and example case references are absent from the production bundle.

## Review preview

`fets-point/shift-preview.html` is development-only and is excluded from the production build. `scripts/verification/build-shift-preview.mjs` creates a single self-contained `The-Shift-Interactive-Preview.html`, with inline assets and a content policy that blocks network requests. Preview mutations affect memory only, including assignments, evidence, coverage and reports.

Build the portable preview from the repository root:

```bash
FETS_PREVIEW_OUTPUT=/tmp/fets-simple-shift node scripts/verification/build-shift-preview.mjs
```

For browser verification, start the frontend Vite server on local port 3012 and run `scripts/verification/verify-simple-shift.cjs` with `FETS_PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `FETS_PREVIEW_OUTPUT` set as needed. The verifier is fixed to the isolated local preview URL and blocks external requests. Run `scripts/tests/shift-workflow.mjs` with `FETS_PGLITE_MODULE` pointing to PGlite 0.3.14 for database checks.
