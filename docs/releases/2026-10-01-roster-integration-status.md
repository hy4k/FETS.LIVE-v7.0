# Connected roster status — 1 October 2026

The fets.online migration is applied and the connected-roster release `20261001T071240Z` is live. Its public release marker is `https://fets.online/release.json`. Repeated production pulls preserved all 22 existing candidate IDs and operational fields. Cochin matched nine source candidates. Calicut retained 13 existing candidates because the corresponding fets.live roster was empty; this is shown as a warning, never treated as permission to delete operational records.

The owner clarified that Pearson VUE supplies Claude/Anthropic exams and Prometric supplies CMA US. Two Cochin source records were corrected to PEARSON VUE, retaining their uploaded 10:15 time, and calendar totals were reconciled. Future uploads and database writes reject these known provider mismatches. The superseded aggregate calendar session remains with a zero candidate count.

The morning pull is enabled at 06:00 IST through `fets-roster-sync.timer`. Its manual execution succeeded. Anonymous POST cron requests return 401. Staff can also pull from the online Roster page; legacy entry/upload links now send them to fets.live Calendar. Runtime source and rollback assets are retained on the VPS under `/opt/fets-online-releases/20261001T071240Z`.

Validation: 132 online tests, production build, targeted lint, isolated database regressions, repeated production pulls and stable-progress comparison. No further online SQL is required for this release. Staff still need to upload the missing Calicut source roster.

Provider portal automation is assessed in `docs/integrations/provider-roster-automation.md`. No unattended provider import has been enabled yet.
