# Calendar layout and operational insights

## Intent

The Calendar header is cluttered: separate summary cards, a promotional roster card, candidate import buttons, view tabs, date navigation, duplicated provider filters and session actions compete for attention. Analytics repeats large tables, guesses providers from exam names, and presents daily throughput as seat utilisation. The user wants an elegant, organised Calendar and a useful Analytics page showing where the centres stand and what needs action.

This is a frontend change using existing authorised Calendar and seat-planning reads. No database changes, booking writes, permission changes or dependency upgrades. Preserve Pearson/CMA imports, candidate entry, Calendar CRUD, all views, roster links and seat-management capabilities. Build on the latest deployed outreach release; original deployment checkout and runtime configuration remain untouched.

## Calendar arrangement

Use one compact page heading, 'Calendar', with the centre and India time. Main actions sit together: 'Add session' is primary; 'Analytics' secondary; 'Candidate roster' opens a small action menu containing Upload roster and Add by hand. Existing edit permissions govern all entry actions. Roster navigation becomes a quiet link in that menu instead of a fourth promotional summary box.

A short horizontal month ledger shows scheduled candidates, sessions and booked days. It always describes the selected month and all providers, even when a schedule filter is active. Exclude cancelled records and invalid candidate counts consistently with Analytics. Use an em dash for unavailable reads. No exaggerated display heading, marketing copy or repeated client badges.

Below it, a single structured control band has period navigation/Today on one row and Month/Week/Day/Seat management tabs plus search/provider filter on the next. One provider control works at all widths; remove its duplicate popover. Give every icon action an accessible name and every filter a visible or programmatic label. Show compact removable active filters and a clear/reset action only when needed. Seat calculations always use all providers irrespective of visible schedule filters.

Use scoped Calendar chrome CSS, leaving existing day/week/month grid and seat styles intact. Controls wrap in deliberate rows at 390px rather than forming a long strip. Candidate-menu popovers must close on Escape/outside click, support keyboard focus and avoid transformed-ancestor positioning problems.

## Analytics surface

Open a dedicated full-height Analytics workspace in a portal to document.body, with a clear 'Back to Calendar' control. Preserve the selected centre and start with the Calendar's displayed month, not the current machine month. Navigation, settings, search or provider filters from Calendar do not hide safety data or silently change report scope.

Retain month and month-range selection, bounded to twelve calendar months, with a compact range control. Fetch the preceding equal number of calendar months for a labelled scheduled-volume comparison. This is a comparison of current Calendar bookings in those date ranges, not a historical forecast or attendance trend. If previous data fails, show the current period and make comparison unavailable. If seat context fails, retain valid volume information but make seat conclusions unavailable. Never display a failed read as zero or 'all clear'.

One purposeful dashboard, without redundant tabs:

1. A clear period/centre heading and compact period controls, refresh and CSV download.
2. Four readable headline measures: scheduled candidates, exam sessions, booked days and upcoming candidates (dates on/after today in IST). Candidate change versus the prior period is shown only with complete comparable volume data and a nonzero baseline; zero baseline gets a textual comparison, not infinite growth.
3. An action-first 'Needs attention' list: exact overbooked/full windows, incomplete scheduling details and the dates/centres involved. Each links to Seat management at that date. Overbooked facts remain visible when another part of the data is incomplete; never imply that unverified dates are safe. Explain when there are no known issues and when no conclusion is possible.
4. A daily demand chart/heatmap for the complete chosen range, including zero-booking days. Accessible text values and click-through to the corresponding Calendar date. Do not call blank days available slots. A short list of busiest/upcoming dates can support team planning.
5. Provider mix and comparison plus centre workload. Show actual provider names, grouped only by explicit canonical aliases (Pearson VUE and Prometric families from the shared seat engine); never turn unknown providers or ITTS into Pearson based on exam names. Keep booked candidates, sessions and concurrent seat use distinct. Centre cards show scheduled volume, critical simultaneous booked/capacity pair with exact date/time, and counts of full/overbooked/unverified centre-days. A global view must not combine the two centres into one seat pool.
6. A concise, collapsible 'About these figures' section for definitions and data quality: calendar counts are bookings, not unique people or attendance; cancellations excluded; invalid counts/unassigned centres identified. Remove invoices, fake efficiency scores, generic motivational blocks and daily-candidates/seats utilisation percentages. No revenue, attendance, pass-rate or financial claims without source data.

CSV exports the current period's actual visible Calendar booking rows with explicit dates, centres, providers, exams, counts, times and statuses; no invoice framing. Quote fields and neutralise spreadsheet formula prefixes. Exclude cancelled records consistently; retain invalid/unknown fields explicitly rather than inventing values.

## Data and correctness

Reuse fetchCalendarRange pagination and fetchSeatPlanningRange protected context, plus analyseDay/intervalCapacity/criticalLoad/formatSeatTime. Include the day before the period for overnight carry-in. Fetch source details and confirmed extra systems, never preview-only capacity. Duplicate context rows from adjacent 62-day chunks must not double-count source groups, capacity or sessions. A conflicting duplicate should be reported as incomplete, not silently resolved into a safe result.

Dates are civil ISO dates and month keys; all today/period boundaries use Asia/Kolkata. End times release seats immediately, as already implemented. Unknown centre names stay unassigned; do not assume Calicut. Known current and prior volume rows are deduplicated by ID. Cancelled aliases are excluded. Nonnegative safe integer counts are required for candidate totals; invalid rows are reported and excluded from that numeric total. Zero-count sessions may appear as recorded sessions but create no seat pressure.

Keep current/prior volume errors and seat-context errors separate. Query keys include authenticated identity, branch and range; an identity or branch change must clear previous private data immediately. Protect against late read responses and unmounts. A refresh must invalidate Calendar/seat context and Analytics so imported/edited sessions are visible. Preserve working current data during a same-scope refresh with an explicit refreshing state; do not export or claim verified seat safety while a refresh is outstanding.

The analytical model is pure and testable; its types are shared by the UI and data loader. Keep presentation and data loading separate. Use existing React Query and CSS, no new chart package. SVG/HTML plots must also expose accessible values.

## Visual direction (builder's choice)

An operations workspace, not a decorative report. Base #f5f7f7, white surfaces #ffffff, ink #18353b, secondary #50656b, petrol accent #225f66, amber #85520b and red #a33a31. Retain existing Calendar body colours so provider identities remain familiar. A compact Newsreader heading can connect with the existing FETS shell; Inter/system body, clear numeric alignment and 12–16px support text. Use a ledger/plot as the main visual structure, varied panel sizes rather than equal card tiles, quiet borders and generous alignment. No ornamental gradients, giant slogans or all-caps metadata. Text contrast >=4.5:1, controls >=44px on phones, input text >=16px. Support 390px, 768px and 1440px, keyboard focus, reduced motion, Escape and focus restoration. Scope/reset the global premium heading styles and mobile universal transform/dialog rules locally.

## Builder decisions

The exact chart treatment, column proportions and secondary copy are implementation choices. Keep the measured dashboard compact, honest and actionable rather than adding every possible metric. Staff permissions, source data and all existing business operations are fixed constraints. Do not contact users, send reports or seed production data.

## Verification and rollout

Meaningful RED/GREEN tests for model accounting, timezone/month boundaries, source aliases, cancellations/invalid counts, global branch separation, overnight carry-in, changing confirmed extra capacity, full/overbooked/incomplete data, range/context deduplication, previous-period failure and identity races. Component tests exercise actual model/hooks and mock only auth/data service boundaries. Calendar integration tests prove all old actions remain reachable and date/view/filter/seat safety behaviour remains intact.

Run targeted checks, TypeScript, production build and one final full frontend suite. Baseline at 8d3562d has 688 tests: 681 passed, five known Calendar-mapping/Chat failures and two skipped. Record rather than hide these existing failures. Review the entire change independently. Browser-test real global styles and fixed FETS shell at 390/768/1440 with local synthetic data and no external requests; inspect screenshots, contrast, overlay bounds, chart accessibility and error/empty/loading states. Fixture markers must not enter production bundles.

Before rollout, inspect the running Live image/configuration and save rollback. Change only the frontend app container; preserve all original configuration, other services and data. Verify public routes/assets and actual lazy application/Analytics module evaluation. Keep a focused draft PR stacked on the deployed outreach branch, attach it to this task and record rollback and verification receipts.
