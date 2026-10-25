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

Deployment pending. Baseline: 20261025T141701Z-calendar-planning-2339b41. The deployment script preserves runtime, Nginx, old assets and the previous image for rollback.
