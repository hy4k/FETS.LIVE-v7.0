# FETS News: private collection, reviewed publication

FETS News replaces the manual ticker editor with a readable staff feed and a private review inbox. Updates state what changed, why it matters, what assigned staff should do and the applicable client/programme, centre and dates. Industry information is explicitly separate from client instructions. The home-page News tile is available to staff by default, while existing per-user visibility choices remain respected.

Mithun explicitly chose **approval for all news**, including public industry stories. Only his configured, active, verified Live account can approve a draft. The collector can create private drafts but has no table or RPC publication capability. Other super admins cannot approve simply by holding that role. No emails are sent or modified.

## Workflow

- Staff: open **FETS News**, filter by client/centre or search; open an approved update; explicitly acknowledge when requested. The original mailbox and private review material are never exposed to staff.
- Mithun: open **Review inbox**, compare the original source with the editable staff summary, choose audience/priority/dates and save changes before approving. A stale draft version cannot be published.
- Existing publications are immutable. **Create revision** prepares another private draft; the old version remains visible until the replacement is approved. The replacement requires a fresh acknowledgement. Withdrawn, superseded and expired versions remain in the archive.
- **Collection** shows actual scan results, supports pausing each source and editing approved official domains. It does not pretend that a staff browser can use the owner's Gmail sign-in.
- Client and programme choices use the shared `clients` / `client_exams` catalogue. Calendar, cases, roster and credentials are linked through their existing pages rather than duplicated.

## Collection

Two connected tasks are configured: hourly read-only collection from the verified Work Gmail account `mithun@fets.in`, and a daily morning industry-source review around 08:00 India time. The Gmail and Supabase connections, and public source retrieval, were successfully read before scheduling. The tasks use the private collector RPC and never call approval/publication endpoints. They honour pause settings and approved domains. Future execution depends on those connected services remaining available; failures are reported as failures, not successful empty scans.

The first private collection contains three client documentation/capacity drafts and one verified public industry draft. These are production data stored behind RLS, not fixtures committed in this repository. They are **unpublished**. Programme applicability is flagged for review when a programme is not in the shared catalogue. A follow-up real mailbox scan added no duplicates and recorded a successful zero-result scan.

Collection excludes sign-in codes, access details, personal candidate cases, appointments, security-sensitive material, promotions, routine repeated portal notices and case follow-up. Client/programme scope is preserved. A documentation notification points staff to the current guide instead of inventing eligibility decisions or equipment lists. Industry items use official sources, actual source dates and short paraphrased summaries. Empty relevant results are valid; there is no content quota.

## Database and access

Additive migrations create five RLS tables for immutable source references, private drafts, immutable published snapshots, explicit staff acknowledgements and collection runs. Private settings bind the single approver, source domains, source enablement and configured task references. Historical `news_ticker` records are retained read-only, including revocation of broad old publication and truncate privileges. Supabase default `service_role` grants were explicitly narrowed; collection cannot publish, acknowledge or write the legacy ticker. FETS Online was not changed.

Source migration files:

- `20261027111646_fets_news_review_workspace.sql` → installed `20261027113512`
- `20261027113611_news_read_policy_indexes.sql` → installed `20261027113808`
- `20261027114809_news_collector_privileges.sql` → installed `20261027114856`
- `20261027115022_news_legacy_publication_lock.sql` → installed `20261027115133`
- `20261027115258_news_legacy_read_only.sql` → installed `20261027115430`

## Validation and release

- 25 isolated PostgreSQL checks cover collection-only grants, source validation, de-duplication, private reads, exact approver identity, optimistic approval, centre scope, actual acknowledgement actors/timestamps, immutable publications, reviewed revisions, expiry, pauses, domain controls and protection of historical notices. The fixture reproduces Supabase's broad default service grants before testing the explicit revocations.
- 16 frontend/model/navigation tests cover staff privacy, deliberate acknowledgements, no automatic publication, retained edits on failed saves, unsaved-edit approval blocking, date conversion, scopes, archive and safe source links.
- Full application browser checks at 1440, 393 and 320 pixels cover the feed, private source review, unsaved draft retention, staff-only controls and body overflow. All fixtures are fictional, read-only and excluded from production entry points.
- Production TypeScript and Vite build passed. Post-migration security advisors reported no new News findings.

Deployment script: `scripts/releases/deploy-fets-news.sh`. It pins the inspected Live release, checks repository/production changes, saves the running image and effective server configuration, verifies the exact applied migration hashes/receipt, builds in isolation, evaluates the real lazy application module and compares every public asset. Rollback restores the prior website image and retains the database approval gate and recorded history. No news item is approved or published by deployment.

## Verified production deployment

- Release: `20261027T120354Z-fets-news-0c1c9e8`.
- Deployed web commit: `0c1c9e81f658615922b448d508bda7e7e63344bd` (PR #45).
- Image: `sha256:125eda3dd099c0918a30aa12abf30f14ae7892d78255b14994f66a14c0dd7f06`.
- Index SHA256: `92dbca1cff2c10335ceb9c9104dc5320d41c2a739407f1c05fa96ce47ae7795d`.
- All **56 public files/routes** matched the build, including the direct `/news-manager` route, JavaScript, styles, font and licence. The real lazy application module evaluated on candidate and public origins; its shared application components remain registered.
- Runtime environment, ports, mounts, restart policy and Nginx matched the pre-deploy state. Existing hashed assets remain available for open browser sessions.
- Final database readback: **4 private review drafts, 0 publications, 0 acknowledgements**. Both collection tasks are configured. Collector publication/table permissions are false, and ordinary staff cannot call collection. Deployment did not approve any item.
- The first scheduled client-collection request completed a real read-only mailbox scan, added no duplicates and recorded a successful empty batch. No staff or external recipients were messaged.

Rollback the website while retaining the database approval gate and history:

```sh
bash /opt/fets-releases/20261027T120354Z-fets-news-0c1c9e8/rollback.sh
```

The prior website's legacy direct news-writing controls remain disabled by the approval gate after rollback. Other prior application data and features are retained.
