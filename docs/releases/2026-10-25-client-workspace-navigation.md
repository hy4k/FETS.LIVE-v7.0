# Clients & programmes workspace

The Workspace menu changed the app tab to client-directory, but AppContent did not recognise that tab as a redesigned page. It therefore rendered the legacy command-centre fallback. The previous isolated shell preview used a no-op bridge and could not catch this failure.

Register client-directory with the actual app router and fullscreen shell, including direct /client-directory, /clients and /clients-and-programmes paths. Refresh and browser Back now retain the appropriate page.

Rebuild the directory as a dedicated, light workspace: searchable client/programme list, selected-provider panel, programme cards with centre labels, provider creation strip and linked programme creation form. Existing shared catalogue hooks, save behaviour and permissions are retained. No database/schema changes.

Validation:

- TypeScript and production Vite build pass.
- Seven client-save/permission and Workspace-default tests pass.
- A new browser fixture mounts the real AppContent router and RedesignShell bridge. At desktop and phone widths, it clicks Workspace → Clients & programmes, verifies PARAGON/CELPIP, refreshes, uses Back, and opens a direct alias. Both pass without page errors. Screenshot review confirms the dedicated layout.
- Fixtures use isolated auth/data and block record writes and external requests. The AI assistant is stubbed in this navigation-only test. Production sign-in/session behaviour is not replaced.

Reproduce: FETS_AUDIT_APP=1 FETS_AUDIT_DIR=<directory> node scripts/verification/build-page-audit.mjs; serve the generated index for all SPA paths; run scripts/verification/verify-client-navigation.cjs with FETS_AUDIT_URL, FETS_AUDIT_DIR, FETS_PLAYWRIGHT_MODULE and FETS_CHROME_PATH as needed.

Deployed from commit f0de71644bfb20cb686c80eea2fd10dd123454b1 as release 20261025T161824Z-client-workspace-f0de716.

- Running image: sha256:a2f21b6033ecb54d7c617ef97cdd1cd7fd8f16427f1657db0cdea9d504989c77.
- Public index SHA-256: 69d2815ea6bbecd691edd53367806271d3e63b87eae7f41aab60b69a7b0a3640.
- All 55 public files/routes match the build; /client-directory, /clients and /clients-and-programmes additionally match the new index exactly.
- Public /client-directory sign-in smoke checks pass at desktop and phone widths (HTTP 200, email field visible, no page errors). Authenticated menu/refresh/Back coverage uses the isolated real-router fixture described above.
- Public module RedesignShell-CDrorm0R.js evaluates with the six expected shared components.
- Runtime, ports, mounts, restart policy and Nginx configuration preserved; no database records changed.
- Rollback: `bash /opt/fets-releases/20261025T161824Z-client-workspace-f0de716/rollback.sh`.

