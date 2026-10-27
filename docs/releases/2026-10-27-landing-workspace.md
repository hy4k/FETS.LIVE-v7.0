# Landing workspace and header AI

Home now uses one grid for Roster, Calendar, My Desk, The Shift, FETS Sites, Team Space, FETS News and FETS Space. The section is called **Your workspace**, keeping the FETS Space page name distinct. The four main work areas have moved out of the top bar; existing routes and the logo's Home action remain. All tools also provides navigation from other pages. Existing per-person tool permissions still apply.

The cards share translucent surfaces, pearl borders, soft colour and inset highlights. Actionables has its own forest-green card beside a session deck spanning the width of three desktop cards. On phones the deck and Actionables each take the full available width. The deck shows client, programme, centre, times in IST, scheduled candidate counts, session status and daily totals, omitting an aggregate count when source counts are unknown. Cancelled sessions remain excluded. Manual controls, reading time, hover/focus pause and reduced-motion support are retained.

The top bar uses the supplied expanding rounded input treatment for **Ask FETS AI**, implemented with existing React/CSS dependencies. Enter or the arrow opens an editable question in the current assistant; sending remains a separate staff action. The ordinary floating launcher is removed where the header is available; an active live session retains its status/recording affordance when minimized.

No schema, stored records, News approvals, Shift rules or FETS Online integration changes are required.

## Validation

- 15 frontend checks: session controls/reduced motion, stale branch response handling, core navigation with restricted tool permissions, assistant question handoff without automatic sending, existing workspace permissions.
- TypeScript and Vite production build.
- Full application fixture checks at 1440, 768, 393 and 320 pixels: six Home routes, Home return, secondary navigation, session controls, header query handoff, input expansion and no horizontal overflow or page errors.
- Desktop and phone visual inspection using isolated sample records; fixtures are excluded from production.
- Release script syntax checked. Deployment has not yet run: the confirmed VPS is offline.

## Deployment

`scripts/releases/deploy-landing-workspace.sh` requires the complete reviewed commit. It is pinned to the currently inspected release `20261027T120354Z-fets-news-0c1c9e8` and index hash `92dbca1cff2c10335ceb9c9104dc5320d41c2a739407f1c05fa96ce47ae7795d`. It stops if production, repository head or server configuration changes. It retains the prior image/configuration and database verification receipt, checks that there are no backend-file changes, builds an isolated candidate, evaluates the real lazy application module, switches only the Live app and verifies public assets. Existing Nginx, runtime environment, ports and mounts are preserved, along with old hashed assets for open browsers. Failed post-switch verification restores the previous image.
