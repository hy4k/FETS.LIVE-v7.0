# Calendar seat management — discovery draft

Status: requirements/design only. No product changes, live booking edits or deployment. Three operational questions are pending with the user; do not silently treat them as answered.

## Confirmed purpose

Show seat capacity inside Calendar for Calicut (40 workstations) and Kochi/Cochin (31). Identify exact full and overbooked periods across overlapping exams, explain the contributing sessions, and test small earlier/later starts that might avoid overload. Preserve existing Pearson import, candidate IDs/history, and User Management/centre access. The user specifically wants a planned, calculated, clearly organised feature because the earlier capacity analysis was insufficient.

## Existing behaviour and verified live findings

Production remains Pearson release `20261105T170118Z-pearson-monthly`, frontend commit `ad5d6a530420c52417d6c463b45f8206e03108ee`. Repository branch starts at the receipt-only descendant `3b6e8a4` in an existing isolated workspace; original dirty `/opt/apps/fets-live` is untouched.

- `FetsCalendarPremium.tsx` colours dates from summed daily candidate totals, using 80%/150% thresholds. Daily totals are not concurrent seat usage.
- `sessionUtils.ts` validates one session count against a branch limit; saving a small session can still overload other concurrent sessions.
- `CalendarAnalysis.tsx` computes overlapping intervals, but only shows periods strictly above capacity. Exactly-full periods disappear from overlap alerts, suggestions are generic and there is no verified timing simulation.
- Main Calendar and analysis queries are not paginated. Missing/equal start/end times must not be silently omitted from an availability claim. Client filters must never hide other providers from centre capacity calculations.
- Read-only November snapshot: Calicut 65 sessions/322 candidates; Cochin 276 sessions/547 candidates. Seventeen positive-count Prometric sessions have start=end:12 in Calicut and5 in Cochin, including current6November rows. No configured exam-duration field was found in `client_exams`; do not invent durations.
- With a provisional shared pool, zero turnaround and known scheduled intervals, Calicut13November has50 concurrent candidates09:00–13:30 (10 above40). Kochi14November has34 candidates10:00–10:15;34 at11:00–11:15;35 at11:15–11:30;34 at11:30–11:45;32 at11:45–12:15. No missing-time sessions occur on those two dates. These are planning calculations, not measured workstation occupancy or provider-approved reschedules.

## Pending operational choices

1. One shared workstation pool per centre, or provider/exam-specific reserved pools?
2. Seat reuse immediately at scheduled end, or10/15-minute checkout/preparation buffer?
3. Simulation flexibility:up to15 minutes earlier/later, later only, or provider/exam-specific limits?

Builder defaults, to be shown to the user: recommendations are simulations for human review; no automatic rescheduling. Existing live/running or completed exams cannot be suggested as movable. Missing-time bookings produce an incomplete-data state. Opening/closing constraints must be explicit planning inputs before an adjustment is labelled feasible; do not infer operational permission from an empty calendar.

## Proposed experience

1. Calendar date badges use true peak booked seats, with separate Available, Full, Overbooked and Incomplete data states. Global view keeps centres separate; never add40+31 into a substitute shared capacity.
2. A Seat management panel directly inside Calendar lists affected dates, peak seats, maximum excess and exact full/overbooked periods. Date selection opens a time-proportional day timeline, not a decorative day-total gauge.
3. The day view identifies contributing exams and occupied seats in every segment. Example:11:15–11:30,35 booked/31 available,4 excess. Explain planned bookings and distinguish exact source times from unverified data.
4. A Check a booking control takes date, start, duration/end and number of candidates. It checks free seats across the whole proposed interval and reports the tightest point. Full at10:00 is not a reason to forbid a feasible afternoon booking.
5. A Try timing changes area searches the user-approved adjustment bounds, preserving exam duration and preparation buffers. Recompute the whole day for each option; reject proposals that move the conflict elsewhere. Rank by eliminating conflicts, then fewest people affected and smallest total time shift. Show before/after intervals, people moved, remaining excess and whether this is a complete or partial solution. If no allowed shift works, say so and show the capacity shortfall; do not promise that10–15 minutes will solve a multi-hour overload.
6. Show missing/inconsistent source times with an action to complete the source schedule; never substitute zero-length bookings or confidently show green. Existing imported Pearson times remain source-owned; suggestions do not alter the original report silently.

## Calculation and data boundaries

- Deterministic boundary-event sweep using exact minute/second wall times in Asia/Kolkata; use half-open intervals[start,end) plus the confirmed post-exam buffer. Release and new start at the same timestamp do not overlap when buffer=0.
- Sum all eligible active scheduled seats in the same confirmed pool. Exclude cancelled/zero-count sessions; retain missing-future imported bookings while cancellation review is pending. Define historical planned view separately from current operational state.
- Calendar counts are authoritative aggregate reservations. Candidate rows may be used to split source-linked appointments for a recommendation, but must not be added again to Calendar counts. Do not fuzzy-match legacy candidates to infer individual movable exams.
- Load complete scoped data with stable pagination, ignore provider presentation filters when calculating the shared centre total, and surface refresh/error/staleness. A failed/incomplete fetch cannot be labelled safe.
- A what-if calculation never writes records. If saving/reviewing a selected plan is later included, recheck current source versions and canonical permissions, preserve source provenance and require an atomic reviewed operation; imported-source rules remain intact.
- Never infer greater physical capacity from daily throughput. Maintenance/unavailable-workstation deductions can be explicit scenario inputs, labelled separately from the confirmed installed totals; persistence is a builder decision only if needed for the requested first version.

## Verification that must drive implementation

Boundary handoffs; exactly full; single-minute overload; multi-hour overload; fractional shifts rejected; negative/invalid counts; unknown branch; missing/zero/overnight end times; cancelled sessions; complete pagination; filtering must not hide load; two independent centres; duplicate IDs; mixed provider/source counts; pending cancellations; suggestion preserving duration and not generating another conflict; multiple exams/retakes; fixed/running bookings; no feasible adjustment; stale refresh; small-screen and keyboard use. Use synthetic examples for mutation/UI tests and read-only live schedule comparisons; no fabricated live business records.

## Design direction

Use the existing Calendar shell and typography. Make the seat/time timeline the main analytical surface, with restrained capacity/full/overload colours and text labels. Keep centre/date/turnaround controls together; show one selected-day conflict explanation and ranked actions rather than a wall of identical metric cards. All suggestions remain inspectable at phone width, with exact values available without hovering. Prepare a concrete visual after the pending operational choices are settled.
