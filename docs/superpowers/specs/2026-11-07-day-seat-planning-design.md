# Flexible daily seat planning

The user clarified that small timing changes can apply to any provider; feasibility varies by date and individual exam. Extend the existing Calendar page with a daily planning workbench, rather than requiring reusable provider policies before every simulation. User explicitly chose both preview and authorised confirmation of extra workstations.

## Behaviour

- Start with the real recorded schedule. Daily simulation inputs allow up to15 minutes earlier/later by default (builder choice), editable0..120 whole minutes. Per-exam limits and a fixed/locked control override daily defaults. Provider defaults remain available as a separate optional mode; they are no longer a prerequisite for daily what-if planning.
- A manual per-exam start-time preview preserves its complete duration and counts. Changing one source exam subgroup preserves all other groups. Manually placed exams are fixed for the following automatic search. A reset restores the original recorded schedule. No session/candidate timing is written.
- Past, already started, checked-in, completed and cross-midnight reservations remain fixed. Unknown/inconsistent schedules remain visibly incomplete. Timing controls apply to anonymous verified source groups or entire Calendar groups, not invented candidate identities.
- A proposed capacity addition has a whole number0..100 extra systems and an explicit same-day availability interval (default00:00–24:00, builder choice). The preview recalculates capacity at every interval boundary. Added capacity cannot help before or after its stated window. Show installed capacity40/31 separately from confirmed/preview extras. No automatic provisioning or purchase occurs.
- Authorised Calendar editors can confirm extra systems for one centre/date using a versioned protected settings API. Saving affects only shared capacity configuration, not business bookings. Ordinary centre members can preview/view but cannot save. SuperAdmin follows existing canonical authority. Editing saved settings invalidates the preview and requires a fresh source/version read; reset to0 removes added capacity.
- Saved additional capacity is reflected in Calendar badges, the legacy overlap summary, booking-fit checks and simulations. Other dates and centres retain their own capacity. No silent permanent change to installed40/31.
- Timeline and exact interval text show the capacity actually available in each interval. Red means booked seats exceed that interval's capacity, amber means full. Booking fit examines the whole requested interval including idle gaps/capacity changes.
- All proposals remain review-only; no automatic exam rescheduling. Source refresh, identity/centre/date changes clear stale manual plans and results. In-flight capacity saves cannot show success under a different date/centre.

## Implementation choices

Extend the existing pure interval engine with optional capacity windows and expose an atom-based solver shared by the original provider-rule workflow and the daily workbench. Keep old signatures backward compatible. Use a new additive planning-context RPC so rollback to the prior frontend remains compatible. Store one additional-systems configuration per centre/date with count, availability interval, version and protected actor. Return anonymous settings alongside the existing source snapshot.

Use existing React/TypeScript, Supabase, Vitest/PGlite and cached Puppeteer image. No dependency upgrades. Continue in the isolated workspace/feature branch; preserve the original deployment checkout and existing Live configuration. Existing Calendar/candidate data must remain unchanged. The user authorised continuing this implementation and confirmed the only material persistence choice.
