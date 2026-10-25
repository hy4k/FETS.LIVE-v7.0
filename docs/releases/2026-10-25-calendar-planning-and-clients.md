# Calendar planning and shared clients

Calendar Analysis is replaced with a light, scrollable planning workspace rendered in a body-level dialog so calendar transforms, overflow and stacking cannot obscure it. It opens on the calendar's selected month and centre, with editable date range, daily workload, capacity/missing-time actions, exact client/programme totals and CSV summary. Open day returns directly to the calendar day. Dates/times use the existing IST calendar convention.

Totals are scheduled workload, not attendance or unique people. Cancelled sessions are excluded; untimed sessions stay in totals and make capacity partial. Seat demand is calculated per centre with seats released before same-minute arrivals. The existing capacity reference is shown explicitly (Calicut 40, Cochin 31); other centres require capacity configuration and are never assumed safe.

The shared Clients & programmes workspace is available in the admin Workspace menu, with shortcuts from Calendar and Candidate Tracker. It uses the existing clients/client_exams tables and React Query keys. Administrators can add providers and linked programmes; other staff can read the catalogue. Saves invalidate both catalogue queries so dropdowns refresh without a reload. Existing database permissions remain in place. No delete or rename controls are added; existing records keep their names.

## Catalogue correction

On FETS Live only (qqewusetilxxfvfkmsed), PARAGON was added and the existing CELPIP programme was moved from PROMETRIC to PARAGON. PROMETRIC → CMA US remains intact. Legacy CELPIP client and all candidate/calendar records remain intact. The programme's original location metadata was preserved. `scripts/releases/configure-paragon-celpip.sql` records the idempotent data correction. No schema migration is required and FETS Online was not changed.

A read-back query confirmed PARAGON → CELPIP and PROMETRIC → CMA US.

## Verification

- Production TypeScript compilation and Vite build.
- 16 targeted tests: missing timing/retry/pagination, simultaneous-seat calculations including changeovers and separate centres, cancellations/unknown capacity, CSV escaping, shared client/programme writes and duplicate detection, staff catalogue access and Workspace menu defaults.
- Six page-render checks pass for Calendar Analysis, Candidate Tracker and shared directory at desktop and phone widths. Browser interaction checks confirm the dialog stays within both viewports, the directory displays PARAGON → CELPIP, and Candidate Tracker allows selecting that client and programme. External network access and record writes are disabled in the fixtures; no production candidate records are fabricated.

## Deployment

Deployed to FETS Live on 25 October 2026 from commit `2339b4103979180ab6e708695676c8ba3981bc3e`.

- Release: `20261025T141701Z-calendar-planning-2339b41`
- Running image: `sha256:61de0a9e7c5c6a7e1e19f11be5ce504c058fbc9438af9f02cde447b1df239531`
- Public index SHA-256: `6f45f60a22f2a522d3de127281a1e785849a70cd7083927587fd8ead0ebf4dce`
- Public module `RedesignShell-CtJrtnOr.js` evaluates and exposes the six required shared components.
- 55 public files/routes match the reviewed build. Runtime environment, ports, mounts, restart policy and Nginx configuration are preserved.
- Public Calendar route smoke checks pass at 1440px and 393px (HTTP 200, visible sign-in email field, no browser page errors). Signed-in operations are covered by the isolated fixture checks, not a production staff session.
- Previous image retained in Docker and a 452 MiB archive. Rollback: `bash /opt/fets-releases/20261025T141701Z-calendar-planning-2339b41/rollback.sh`.

The website deployment script made no database changes. The separate verified client/programme data correction above was applied before deployment. No schema migration was needed.
