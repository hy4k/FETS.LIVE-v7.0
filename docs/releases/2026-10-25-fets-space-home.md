# Fets Space home and My Desk support tools

Home's centre-at-a-glance statistics are replaced by four tool cards: FETS SITES (existing Ascender centre administration), TEAM SPACE (existing team chat), FETS NEWS (existing News Manager), and FETS SPACE. The last is an explicitly unconfigured destination awaiting the user's separate explanation; equipment records and legacy IT data remain intact.

Moved tools are omitted from the Workspace menu even when a per-user override exists, avoiding duplicate navigation. Permission definitions and existing per-user preferences remain intact and govern the relocated home tools and Access Hub. Staff retain their existing case, quick-access and help-desk entry points in My Desk. Management features keep their role defaults.

Today's Sessions is now one compact card with sequential perspective/fade transitions, a reading interval of at least seven seconds, pause/play and previous/next controls. Hover, keyboard focus and hidden tabs suspend automatic transitions. Reduced-motion users get a static, manually navigable card. The current session's text can scroll within the card if unusually long. Cancelled sessions are excluded and missing times are marked TBC. No marquee or simultaneous scrolling text.

Today's Roster and the three support cards are removed from Home. My Desk has a primary four-card Support & access section: Raise a case, Quick access, Help desk, F-Vault / Access Hub. Older duplicate vault/help shortcuts inside the personal area are removed. The personal cover is more compact; existing notes, check-ins, focus sessions, applications, time and growth tools are retained.

Home now fetches only today's calendar sessions, including pagination and legacy Calicut rows, rather than fetching roster, attendance and handovers solely for removed widgets. The centre date remains IST. Mobile FETS SITES, FETS NEWS and Access Hub now use the shared shell so navigation stays available. New direct aliases: /fets-sites, /fets-news, /fets-space and /team-space; old route IDs and permission keys are retained.

## Verification

- TypeScript compilation and production Vite build pass.
- Twenty targeted tests cover session rotation/pause/manual control/reduced motion, cancellation handling, India-time clock and stale requests, personal desk persistence and support actions, and absence of duplicate Workspace entries.
- Real AppContent/RedesignShell fixture checks pass at 1440px and 393px: moved entries are absent from Workspace, all four home cards open the appropriate routes and reload, My Desk has each support action once, and cases/Access Hub navigate correctly. Fixtures use isolated authentication/data and block writes/external services. Desktop/mobile screenshot review completed.

Deployment pending. Prior baseline: 20261025T161824Z-client-workspace-f0de716. No database or FETS Online changes are required. The deployment script preserves the previous release, assets and server configuration for rollback.
