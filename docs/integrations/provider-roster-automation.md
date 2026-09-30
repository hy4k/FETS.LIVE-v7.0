# Provider roster automation

Decision, 30 September 2026: automate download and ingestion into **fets.live**, then let fets.online pull the checked candidate roster. Do not maintain a second provider importer in fets.online.

## Portal assessment

| Provider | Confirmed staff workflow | Proposed automation | First setup |
|---|---|---|---|
| Prometric EasyServe | Login; export the next five days as Excel; no OTP | Scheduled browser login/download; parse each date and branch; idempotent roster import | Observe one real export and validate its headings/date fields |
| Pearson VUE Connect | Login; email verification on a new device | Persistent browser profile on the VPS; download reports from the verified session | Staff completes the first email verification; request human attention if verification recurs |
| CELPIP / Paragon | Login; Schedule menu | Extend the existing Playwright reader after checking whether the portal exposes candidate IDs/names as well as counts | Verify the current schedule/export structure and both centre accounts |

These are feasibility conclusions from the staff-described workflow and source inspection, not proof that unattended provider access has already been tested. No verified public provider API has been identified. Prefer a provider-supported report feed if one is available to FETS.

## Existing code and limitations

- `scripts/scrape-prometric.js` reads public ProScheduler appointment availability. This is **not** the EasyServe candidate roster and must not populate candidates.
- `scripts/paragon-portal-ingest` already contains browser login and schedule extraction, sending slot totals to `paragon-schedule-sync`. It is not a complete candidate-roster integration. Its default month range is April–June 2026; use a rolling current horizon before scheduling it for current operations.
- Calendar's shared parser and atomic import RPC already supply the correct destination. Reuse them rather than writing another spreadsheet interpretation.

## Operating design

1. Run on the Hostinger VPS with a separate persistent browser profile per provider/centre. Keep credentials and session cookies outside Git and browser bundles.
2. Download all available next-five-day reports before the 06:00 IST fets.online pull; retry a failed download without clearing previously imported data.
3. Record provider, centre, capture time, content hash, covered dates and counts. Skip byte-identical reports. Reject an expired login page masquerading as Excel.
4. Parse into the existing contract: whole `full_name`, `roster_number`, provider, branch, date, exam, part and IST start time. Preserve ID leading zeros. Missing identity/date/time must stop the affected import for staff review.
5. Upsert by branch + exam date + provider + roster number through the existing atomic database path. Recalculate calendar counts from candidates. Never add the export total to an existing total.
6. Compare totals by provider/exam/time and display a result for each date. Missing rows in a later export are a review item; never automatically delete an arrived candidate or assume cancellation from absence.
7. Show a small source-health panel: last successful download, dates covered, rows added/updated, unresolved problems, and “sign in again” when required. An unsuccessful run must remain visible; it must not appear as zero bookings.

## Pilot before unattended operation

Use one real export from each provider and both branches. Compare automated and manual results for several working days, including changed names, late bookings, cancellations and duplicate IDs across providers. Then enable scheduled imports. The next practical input is a supervised portal walkthrough or representative exports; passwords and email codes should be entered in the browser, not pasted into chat or committed.

No automated provider login or scheduled provider ingestion was enabled during this repair. The roster connection between the two FETS apps is a separate step and does not require sharing provider credentials with fets.online.
