# Pearson import discovery

Read-only review on5 November2026. Source inspected from the running release7df5868 and its implementation checkout. The original `/opt/apps/fets-live` checkout is dirty and preserved. New isolated worktree: `/tmp/fets-pearson-import`.

- Attachment:451 rows,30 November dates,36 codes, one missing email,112 merged ranges, zero formulas.
- Existing Cochin November Pearson calendar:238 sessions,450 scheduled candidates; file groups into238 slots/451 candidates.227 exact slot matches after reviewed label normalization,11 timing differences,3 count differences. No calendar changes made.
- Existing scoped Candidate Tracker:35 registered rows, zero progressed rows;8 exact file-name/date matches. All have internal confirmations and no provider roster ID. Private matching used SHA256-normalized names; no real candidate fixture or raw attachment is committed.
- Live candidate schema lacks email, exam code, exam owner/title separation and end time. Existing daily save requires provider roster number and synchronizes by provider/date/label/start.
- Confirmed: internal FETS IDs allowed; missing future bookings enter cancellation review. Confirmed: review all existing matches before any import; no subset import before that review. See the design for exact bounds.

No live records, schema, users, settings, files or deployment changed during discovery. Original workbook is treated as source data only.

## Complete review prepared after the user decision

User chose review of ALL existing matches before ANY import. A private review workbook includes all35 existing records,451 source bookings,238 proposed session bindings,238 original sessions and30 daily totals. An independent readback found zero integrity mismatches. All273 decisions are Pending; all override cells are blank. No live import, business mutation, schema change or frontend deployment was performed for this task.

Preserving supplied First/Last values gives8 strict name/date proposals and5 additional formatting-only proposals. The other22 records have no clear proposal. None is an approved identity binding. One strict proposal has a03:45/15:45 discrepancy and is flagged. All451 source rows retain their date/range, exam-owner/code/title, original name, email and phone values in the private review. One email is missing. The file also contains legitimate same-name/day pairs with different exam codes, which must remain separate.

Calendar review contains227 exact date/owner/start/end proposals plus11 proposed time corrections and3 count differences. Every existing session is represented exactly once in the proposals; source groups cover every input row once. Label normalizations remain explicit review proposals. Only two controlled pending-count formulas are included, with no external workbook links.

The artifact is under `/root/.codex/artifacts/pearson-review-20261105/`; personal data and the workbook are not committed to the repository. See the sanitized review receipt for counts/hash. Await the user's review decisions before importing any subset.
