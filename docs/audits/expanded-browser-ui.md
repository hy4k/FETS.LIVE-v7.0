# Expanded review and restored roster browser verification

Verified the current source `ReviewsPanel`, `AgentResults`/`ReviewCard`, and `RosterWorkspace` in isolated Chromium at **1440×1000 and 390×1000**. **40 checks passed; zero failed viewports, page exceptions, or external request attempts.** Screenshots were visually inspected for mobile previews, module handoff, restored roster and desktop Applied receipt.

## Isolation

All harness files and artifacts are under `/tmp/fets-expanded-browser-fixture/`. The harness imports the current source UI and source CSS; management API and roster repository imports resolve to local in-memory fixtures. A production Supabase import would fail the fixture build. There is no real Auth session, production record, provider call, or deployment. Remote font imports are removed from the generated fixture CSS, so offline system font fallbacks are used.

Chromium ran from cached `ghcr.io/puppeteer/puppeteer:25.13.0` with `--user 0 --network none --shm-size=512m`, a mounted local `file://` HTML file, and CSP `connect-src 'none'`. No dependencies were installed.

## Confirmed at both widths

- Loading the queue and rendering shared assistant previews issue no review decisions.
- Cards show stored original/proposed values, the target ID and centre.
- A deliberate Apply click sends only the saved review ID, decision and viewing scope; repeated decision controls disable while waiting. The fixture's acknowledged result shows Applied and a receipt, then removes Apply.
- Module handoff says “Not applied; review in module,” has no Apply control, and links to the existing `/user-management` route.
- Saved 06:00–15:00 and 11:30–20:30 roster shifts render D1/D2 with the corresponding hours in their shared legend. Staff cells are disabled and Quick Add is absent.
- Queue preview, Applied state, shared assistant previews and restored roster have no horizontal page overflow: body/document/main widths are 1440 at desktop and 390 at mobile. The roster retains its internal horizontal scroll region.

## Evidence and commands

- [Results JSON](/tmp/fets-expanded-browser-fixture/results.json), [build log](/tmp/fets-expanded-browser-fixture/build.log), [browser log](/tmp/fets-expanded-browser-fixture/browser.log).
- [Mobile review preview](/tmp/fets-expanded-browser-fixture/reviews-preview-390.png), [mobile Applied receipt](/tmp/fets-expanded-browser-fixture/review-applied-card-390.png), [mobile module handoff](/tmp/fets-expanded-browser-fixture/review-module-390.png), [mobile roster](/tmp/fets-expanded-browser-fixture/roster-390.png).
- [Desktop Applied state](/tmp/fets-expanded-browser-fixture/reviews-applied-1440.png), [desktop roster](/tmp/fets-expanded-browser-fixture/roster-1440.png). Matching preview/assistant/card screenshots are in the same folder.

```sh
node /tmp/fets-expanded-browser-fixture/build.mjs
docker run --rm --user 0 --network none --shm-size=512m \
  -e PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer \
  -v /tmp/fets-expanded-browser-fixture:/fixture \
  --entrypoint node ghcr.io/puppeteer/puppeteer:25.13.0 /fixture/verify.mjs
```

Build completed successfully; existing browser-data age warnings remain. This verifies real browser rendering and human interaction against isolated boundary fixtures; it does not claim live database authorization or production API mutation verification. No product code changed in this verification task.
