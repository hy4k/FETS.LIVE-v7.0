# Calendar and operational analytics

Open **Calendar** for the active centre. The month ledger shows scheduled candidates, exam sessions and booked days across all providers for the displayed month. Search and the single provider filter affect the visible schedule; seat checks continue to include every provider sharing that centre.

**Candidates** groups the existing Upload roster and Add by hand tools. **Add session** retains the existing editing permissions. Month, Week, Day and Seat management are together beside the period controls. Staff roster remains a quiet link.

## Reading Analytics

Choose **Analytics** in Calendar. It starts on the month you are viewing and uses the active centre. Select a month or up to twelve consecutive months, then Apply period.

- **Scheduled candidates, exam sessions and booked days** describe currently recorded Calendar bookings. **Upcoming candidates** includes dates on or after today in India time. These measures do not establish attendance, revenue or completed exams.
- **Comparison** uses the immediately preceding equal number of calendar months. It describes the bookings currently recorded in each period. A zero prior baseline has a text explanation instead of an infinite growth percentage.
- **Needs attention** lists exact overbooked and full windows, plus incomplete data needing review. Open a row in Seat management at that date to investigate possible timing changes or confirmed additional workstations.
- **Daily demand** and **Dates to plan around** identify heavier booked dates for staffing and planning. Select a date to return to Calendar. Longer ranges aggregate chart bars by week; daily values and dates remain available. Days with no recorded bookings do not prove that seats are available.
- **Provider breakdown** retains the recorded provider identity. **Centre workload** keeps Kochi and Calicut separate. Daily candidate throughput is never presented as concurrent workstation utilisation.
- **Download CSV** exports the chosen period's active Calendar rows with dates, centres, providers, exams, counts, times and statuses. Refresh before exporting recent changes; downloads are disabled during refresh.

Kochi has 31 base workstations and Calicut 40, with separate shared pools. Analytics uses the existing seat engine, confirmed time-specific extra capacity and overnight carry-in. Seats become available at the scheduled end. Calendar and Analytics omit cancelled reservations from scheduled totals while leaving their records available for inspection.

## Missing or changing information

Current-period, prior-period and seat-detail errors are shown separately. A prior-period failure does not hide current bookings. Missing seat details do not become an all-clear result. Invalid counts, conflicting records, unassigned centres and other limitations are disclosed. During refresh, retained results are marked pending and verified seat-safety conclusions are withheld.

This release changes the frontend only. It creates no bookings, modifies no database structure or business records, and does not reschedule exams automatically.
