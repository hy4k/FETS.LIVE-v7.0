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

Deployed from c52619fd51f4122e0b43c0f33e6809215cf1bcdd as release 20261025T175832Z-fets-space-c52619f.

- Running image: sha256:abc710d7cf7658913c7535ef2735704454b67824893d9e2be7dedef7b4868315.
- Index SHA-256: 5d5470da5889f771d526be6c1786152545e42760f076255fc8c755fa9b5777b7.
- 55 public files/routes match the reviewed build. Home, /my-desk, /fets-sites, /fets-news, /fets-space and /team-space additionally match the new index.
- Public My Desk sign-in smoke checks pass at desktop and phone widths (HTTP 200, email input visible, no page errors); signed-in behaviour is covered by the isolated real-router checks above.
- Public module RedesignShell-Nqe7Df14.js evaluates with all six shared components.
- Runtime environment, ports, mounts, restart policy and Nginx configuration preserved. No database or FETS Online changes.
- Rollback: `bash /opt/fets-releases/20261025T175832Z-fets-space-c52619f/rollback.sh`.

