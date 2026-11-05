# Expanded human review UI

Implemented against `docs/superpowers/plans/expanded-ai-contract.md` in the isolated implementation checkout. No production mutations, deployment, dependency installation, or commits were performed.

## Changed files

- `fets-point/src/fets-ai/fets-ai-api.ts`: exact public `ChangeReview` contract, accepted in proposal results and defensively in action results; optional action record projection.
- `fets-point/src/fets-ai/ReviewCard.tsx`: shared accessible review card, target/review IDs, centre, stored original/proposed values, expiry/status, explicit Apply/Cancel, safe module handoff, uncertain-result read refresh, duplicate locking, and stale account/centre request rejection.
- `fets-point/src/fets-ai/ReviewsPanel.tsx`: authenticated centre-scoped queue, real loading/error/empty states, explicit retry/refresh.
- `fets-point/src/fets-ai/AgentResults.tsx`: shared review rendering for page and companion, optional `reviewScope` keeps standalone consumers compatible.
- `fets-point/src/components/FetsIntelligence.tsx`: Reviews tab and scoped chat review cards; existing views preserved.
- `fets-point/src/fets-ai/expanded-review-ui.test.tsx`: ten card boundary tests.
- `fets-point/src/fets-ai/expanded-reviews-page.test.tsx`: three page/queue boundary tests.

## Execution evidence

TDD red evidence: initial card tests failed because `AgentResults` did not render change-review proposals; three page tests subsequently failed because Reviews did not exist. A further regression test failed when rerendering the same preview during an in-flight decision unlocked the controls; the implementation now retains its lock.

Final targeted command, from `fets-point`:

```sh
node node_modules/vitest/vitest.mjs run src/fets-ai/expanded-review-ui.test.tsx src/fets-ai/expanded-reviews-page.test.tsx src/fets-ai/intelligence-connected.test.tsx src/fets-ai/intelligence-page.test.tsx src/fets-ai/FetsAIAgent.test.tsx
```

Result: **5 files, 28 tests passed**. This includes existing page, saved history, Knowledge, settings, telemetry error, and companion behavior checks. Existing browser-data age warnings were emitted; no dependency changes were made.

`node node_modules/typescript/bin/tsc -b tsconfig.app.json --pretty false` passed, including the final in-flight lock and expiry changes.

`git diff --check` passed. A broad suite was not run by this implementer, per root coordination to avoid concurrent broad runs.

## Boundaries and integration

- Preview rendering does not call any decision API. Only deliberate human buttons send `review-decide` with the saved ID and `apply`/`cancel`, never replacement operation arguments.
- State changes to Applied only when returned by the server. Failed/uncertain writes lock decisions until a successful `review` read confirms current status; no write retries happen automatically.
- Module reviews display “Not applied; review in module,” have no Apply button, and only expose a checked local workflow link.
- Account changes immediately hide the old values and verify access before showing a review again. Centre changes hide a review outside the selected centre; late requests cannot restore old state.
- The server remains authoritative for ownership, permissions, expiry, stale targets, replay, and business side effects. UI tests use isolated management API fixtures and do not claim live database authorization verification.
- Root owns passing `reviewScope={{userId,branch}}` from `FetsAIAgent.tsx` and rendering live `change-review` tool results. The shared card is already available; without a scope its decision buttons remain disabled.
- Visual inspection in a real browser and live end-to-end database application were not performed by this implementer.
