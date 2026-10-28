# My Desk, requests and F Vault

My Desk opens with the signed-in staff member’s full name and inclusive calendar days with FETS, counted in India time from `staff_profiles.joining_date`. A missing or future joining date is shown as unset rather than inferred from account creation. The focus timer, notebook, mood/growth area, My Time and Checklist are removed from this page; existing stored history is retained.

Four cards open Leave, Half-day leave, TOIL day off and Shift swap directly. Requests & approvals retains existing application and claim history. New half-day requests record first/second half off relative to the saved roster: for example, 06:00–15:00 becomes 10:30–15:00 working when the first half is approved off. New swaps show the colleague their before/after shifts on the selected dates and require their agreement before Mithun’s management approval. Approval rechecks roster versions, dates, recorded attendance and overtime; changes to the saved shifts and application status commit together. Missing roster cells are not assumed to be Day shifts. Existing full-day leave, TOIL and claim workflows are retained; this does not introduce a new entitlement or payroll rate.

The optional **team round** is a daily communication challenge shared across centres. It uses real participation, one explicit submission per staff account per India day, no rankings and private individual answers. Generic communication questions do not create client rules or test-delivery instructions. No test participation was created in production.

**Raise a case** moves to Home beside Actionables with the same forest-green treatment. **F Vault** occupies the third card; Today’s sessions spans the row above. The Home hero is shorter and its Find your focus button is removed. The mobile Case route now opens the shared incident form with a responsive column layout and scrollable phone drawer, and its top-level route maps to the correct shell page instead of an empty panel. Main-page navigation now resets the internal scroll container so names and headings do not open behind the mobile header.

Quick Access and the old Access Hub already read the same `fets_vault` table. The new F Vault consolidates their entry points and adds search and category filtering. Duplicate titles/portals/accounts within the same owner and site appear once, with the newest Quick Access values retained and missing notes/fields merged. Account names and URL paths remain case-sensitive. No source credentials are copied across owners or deleted. Explicit saves update the primary row only. Passwords and additional fields are masked, reveal expires and clears on window blur, and the native dialog supports focus containment and Escape. Existing per-person navigation overrides and owner RLS remain.

## Verified support channels

Help desk uses the shared client catalogue. Links were checked on 28 October 2026:

- Prometric: [eHelp](https://ehelp.prometric.com/), selecting the session’s actual system.
- Pearson VUE: [technical support](https://www.pearsonvue.com/us/en/help.html), linked from its [existing test-centre page](https://www.pearsonvue.com/us/en/test-centers/existing-test-centers.html); [Connect](https://connect.pearsonvue.com/) remains a separate administrative link.
- PSI: [Test Center Network help desk](https://helpdesk.psionline.com/hc/en-gb).
- PARAGON / CELPIP: [public CELPIP customer support](https://www.celpip.ca/about-us/contact-us/), explicitly distinguished from the assigned live test-centre contact in the current centre guide.
- ITTS: no dedicated official support channel could be verified from the catalogue identity; ask the centre manager rather than inventing a link. FETS mock programmes also use internal management support.

No support case is created until staff choose to submit one.

## Database verification

Only FETS Live `qqewusetilxxfvfkmsed` changed. Migration `20261028022657_personal_desk_requests_and_team_round.sql` was applied through the connected Primary account and recorded at the same version. The verification receipt is `2026-10-28-my-desk-backend.json`.

The migration adds private validated request helpers, authenticated invoker RPCs, application workflow metadata and the RLS-protected participation table. Anonymous execution is revoked. Existing applications remain workflow version zero; current website forms remain compatible while the new frontend awaits deployment. The roster timing guard still clears stale hours from browser code-only edits and preserves complete shifts supplied by the validated resolver.

Immediately after migration, existing application, roster and Vault checksums matched their pre-migration values. Counts remained 8 applications, 1,976 roster entries, 784 attendance rows, 67 Vault records and 4 News publications; participation remained zero. FETS Online was not changed. No production application, attendance, acknowledgement or participation was fabricated.

Security advisors reported no finding for the new Desk objects. Existing unrelated project findings were retained for separate remediation. The performance advisor notes the intentional additional partner read policy and unused new indexes on the empty participation/workflow data, alongside existing application-policy/index findings.

## Validation and deployment

- 38 targeted frontend checks: identity/tenure, direct request entry, account changes, round submission/failure behaviour, Vault privacy/merge/save, core Home navigation, permissions and retained cloud journal behaviour.
- 17 disposable PostgreSQL checks: auth/RLS, privacy, no automatic participation, consent, custom half-day hours, stale roster rejection, recorded attendance, overtime, atomic swaps and legacy timing compatibility.
- TypeScript and Vite production build; the actual compiled lazy application module evaluated successfully in Chromium, including the shared Calendar, Roster, Case, Shift and My Desk components.
- Full-app fixture checks at 1440, 768, 390 and 320 pixels, request forms/history, Home navigation, merged Vault dialog and no page errors or horizontal overflow. Fixtures never contact production or submit real requests.

The VPS device was offline at the latest check. **The redesigned website has not been deployed.** The public site still reports commit `ce2997b3fd4341e0e729539ae46730abc82f1222`.

`scripts/releases/deploy-personal-desk.sh` is prepared for the reviewed branch and that exact production baseline. It validates the backend receipt and migration checksum, retains the previous image/configuration, preserves server settings and old hashed assets, evaluates the real lazy module before/after switching, verifies public assets/routes, and rolls back the website on failed verification. Backend changes are additive and retained on website rollback; protected requests cannot be resolved through the old browser flow.
