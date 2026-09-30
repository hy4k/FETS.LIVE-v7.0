# Premium arrival and personal home

A shared ivory, sage, pearl and lilac visual language now connects the first browser paint, authentication, route loading, home hero and navigation.

- Lightweight CSS 3D sculpture with three intersecting loops, a glass FETS monogram and pointer-responsive depth. The first sign-in introduction lasts 1.9 seconds, can be skipped, and is remembered within the browser session. Reduced-motion visitors go directly to the form. Decorative entrance motion settles; there is no video, canvas renderer or new package.
- Login uses a responsive editorial layout, a translucent form, visible labels, password visibility toggle, error/retry states and the existing Supabase sign-in/recovery calls. An optional “moment of calm” control softens the ambient effects. Credentials remain available after a failed attempt.
- Home features the signed-in person's actual name, large FETS LIVE typography, the same sculpture, a My Desk shortcut, and date/time with seconds in Asia/Kolkata. The clock updates independently of the existing minute-based data fetches and handles midnight and returning to the tab.
- A continuous navigation bar replaces the floating banner. A searchable native-dialog workspace menu includes Calendar, Roster and Handover on phones; it supports keyboard focus containment, Escape and restoring focus. Existing admin-only tools remain admin-only in this menu. Drawers and home cards share the light surfaces.
- The initial HTML includes a branded loading fallback before JavaScript loads, plus a noscript message, matching favicon/theme colour, and browser zoom support.

No SQL, schema or authorization changes. Authenticated production sign-in is not performed with real staff credentials by the agent. Local browser fixtures use explicitly synthetic centre data.

Validation: production TypeScript/Vite build passed. Four sign-in/recovery/intro tests and four hero/clock/operations tests passed. Browser review at 1440px, 390px and 320px found no runtime errors or horizontal overflow. Additional checks cover reduced motion, a short phone viewport, recovery navigation, password visibility, mobile Calendar navigation and Escape to close the menu. The compiled production preview also passed the opening-animation and 320px login checks without runtime errors. Existing Vite bundle-size warnings remain.

Deployment is pending: two SSH attempts to the known Hostinger VPS `72.61.171.192:22` timed out. Public HTTPS requests from both the Linux and Windows environments also failed. No remote files or containers were changed for this update. A compiled artifact and SHA-256 manifest are prepared in `/tmp/fets-premium-release-dist.tar.gz` and `/tmp/fets-premium-manifest.json`. The last verified live release remains `20260929T102443Z`.

Development preview: `http://localhost:3000`. Compiled production preview: `http://localhost:4173`. No SQL is required. Local changes remain uncommitted.
