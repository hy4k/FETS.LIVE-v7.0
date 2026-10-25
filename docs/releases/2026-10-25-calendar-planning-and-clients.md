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

Prepared for the current Calendar reliability baseline: release 20261025T092330Z-calendar-fix-dbd1c59, commit dbd1c59856f33e8d48af870af1807993e8af8aa9. The deployment script preserves the previous image/runtime/Nginx configuration and verifies public assets and application evaluation. Deployment evidence will be recorded after the switch.
