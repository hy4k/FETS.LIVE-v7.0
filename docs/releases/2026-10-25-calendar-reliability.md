# Calendar Analysis and page reliability repair

## Problem and changes

Calendar Analysis called `split()` on nullable session times. A read-only check found an existing Calicut session on 2 October with both times absent. Opening analysis could therefore replace the application with its generic lazy-load error. The regression test reproduced that failure before the fix.

- Keep all sessions in candidate/session totals; mark missing, invalid or non-increasing times as incomplete and exclude them from overlap calculations. Never guess missing times or overwrite source records.
- Fetch every page of the selected period, retain legacy null-centre records in Calicut, ignore superseded requests, and show an explicit retry state on fetch failures. Disable exports while loading or failed.
- Keep navigation available if an individual page fails to render, with retry and home controls.
- Stop the OT & TOIL Manager refresh loop: roster/payroll change events now refresh cached display state instead of fetching data that emits the same events again.

No schema, attendance, payroll policy, staff records, or FETS Online integration changes.

## Verification

- Production TypeScript compilation and Vite build pass. The built application module evaluates successfully in Chromium; the public baseline module also evaluates, confirming that loading the login/module alone cannot detect the Calendar render failure.
- Six targeted tests pass: nullable session times, pagination beyond 1,000 rows, midnight/invalid times, retry after load failure, real capacity conflicts alongside incomplete records, and page-boundary recovery.
- Read-only browser fixtures render all 23 main routes (including aliases) at 1440px and 393px: 46 checks pass. Calendar Analysis opens, switches tabs and closes at both widths; OT reads settle after initial loading.
- The fixtures mock authentication, Supabase and communication services; network connections and record writes are disabled. These checks cover page rendering, not authenticated production operations, external integrations, or every data-dependent action.

Reproduce browser checks with `node scripts/verification/build-page-audit.mjs`, serve `.page-audit` on port 3018, and run `node scripts/verification/verify-page-audit.cjs`. Supply `FETS_PLAYWRIGHT_MODULE` and `FETS_CHROME_PATH` if Playwright/Chrome are installed outside the default resolution paths. Optional `FETS_AUDIT_DIR`, `FETS_AUDIT_URL` and comma-separated `FETS_AUDIT_ROUTES` configure output, origin and route subset. Fixtures never enter the production bundle.

## Deployment status

Prepared; deployment blocked by the offline Desktop Commander device `srv1120621`. Public release remains `846bf49612497f95fd6bbf3e106320428bb59e0d` (`20261024T204956Z-ascender-846bf49`) when checked on 25 October.

`scripts/releases/deploy-calendar-reliability.sh COMMIT` pins that baseline, rejects newer repository/production changes, preserves the image, Nginx/runtime configuration and old hashed assets, checks the candidate module, and verifies every public built asset after switching only the application service. It reuses the baseline backend receipt only after asserting the entire Supabase source tree is unchanged. No migration is applied. Verification failures after switching restore the saved website image.

The script requires actual VPS access. Its existence and local checks do not imply a deployment occurred.
