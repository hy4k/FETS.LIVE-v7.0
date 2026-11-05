# FETS AI: complete workspace operations and verified knowledge

Status: proposed operation expansion for owner review. No expanded permissions or new tools have been applied. The separately requested knowledge update has been published through the existing authenticated administrator rules.

## Intended outcome

The owner wants FETS AI to perform operations throughout FETS Live and to understand the current workspace. Add explicit operations for the app's workflows so a signed-in person can complete their work conversationally. Continue an authorised request when the person supplies a missing detail, without repeatedly asking them to repeat the command.

The assistant acts as the signed-in person. Administrator operations remain administrator operations; using AI does not promote ordinary staff. The global view can read authorised centres, while each record change has a concrete centre. Existing server checks, workflow constraints and record versions continue to apply. This expands supported app operations rather than giving the model database administration or deployment authority.

## Current verified position

- Production authenticated agent version 7 supports create/update for cases, personal/assigned tasks and calendar sessions; it also searches approved/reference knowledge, manages permitted memory, offers navigation and drafts handovers.
- Administrator write controls are ON. The stored wildcard administrator allowlist does not add operations absent from the implementation.
- Seven source-linked, company-wide guide documents have now been published at version 1. The existing legacy shared Pearson VUE reference remains unchanged; its vendor-policy content has not been revalidated as part of this proposal.
- The action log records the actor, target, outcome, versions and before/after values. Current Telemetry is labelled Your AI activity and filters to the caller. There is no general action-review/undo console yet.
- Several legacy staff, attendance and system policies are permissive. They must not be copied into a generic AI table writer. New operations must validate trusted identity, roles, ownership, centre and permitted fields explicitly.

## Operation map

The ordinary-operation default below is execution after an explicit request while controls are ON, with questions only for missing or ambiguous details. The owner's policy for the listed review-sensitive actions is pending.

| Module | Candidate operations | Role and scope | Existing workflow/checks to preserve | Review-sensitive actions and recovery |
|---|---|---|---|---|
| Calendar, clients and programmes | Search/create/edit sessions; manage client/programme definitions; import candidate roster through its existing operation | Calendar management requires trusted administrator or permitted manager membership in the record's centre | Exact dates/times and saved IDs, version checks, client identities, roster import validation | Session/client/programme deletion and bulk changes need chosen review policy; record snapshot and dependent-row count first |
| Cases and assigned tasks | Create, update, assign, add notes, change status, close/reopen, permitted archive/removal | Staff limited to owned/assigned work; trusted managers/admins act within their centres | Correct Auth/profile IDs, active verified assignees, severity/status enums and expected version | Preserve note history and assignment notifications; snapshot before removal; no invented completion evidence |
| Staff roster | Read/create/edit shifts, custom hours, lead/cover and permitted roster removal | Follow the existing roster manager/owner rule; do not grant all staff roster writes | Existing owner-specific roster restriction, centre, actual hours, date collisions and affected people | Review bulk/retroactive changes and removals; capture affected records and compensating changes |
| Shift and daily operations | Read plans/reports, prepare drafts, manage assigned work, submit or amend permitted reports | Existing centre staff and manager roles | Daily report checklist requirements, immutable original author/day/centre, no future reports, valid candidate counts, issue explanation when checks fail | Physical checks and signatures require the responsible person's evidence/attestation; review report submission policy explicitly |
| Attendance | Read authorised records; self check-in/out; authorised corrections | Self identity for own attendance, dedicated management authority for corrections | Actual date/time, original values, correction reason and attributable actor | Corrections follow chosen review policy; no inference of presence from online flags, conversation or images |
| Leave, applications and shift swaps | Prepare/submit/withdraw own requests; record counterpart consent; review/resolve permitted requests | Applicant owns submission; named counterpart consents; authorised manager resolves | Existing consent, eligibility and roster effects; exact applicant identity | Approval/rejection and payroll/roster effects follow chosen review policy; preserve decision history |
| OT, TOIL and payroll | Prepare/submit own claims, edit permitted pending claims, calculate/read authorised values, resolve permitted claims | Own claims for staff; trusted management for rates, payroll and decisions | Existing claim states, roster effects, rates and arithmetic; do not approve by changing a status field alone | Approval, rejection, rates and payroll changes follow chosen review policy; coordinated compensation for dependent records |
| Institutions and Actionables | Search/create/edit institutions, stages and duties; assign owners; save results/follow-ups and stage evidence | Existing active staff/institution ownership rules plus explicit field validation | Required contact point, named owner/reporting person, due date/time in IST, stage ordering and result attribution | Institution deletion cascades through stages, duties and history and is irreversible today; show affected records before chosen review step |
| Systems, assets and lost/found | Manage allowed non-secret asset fields, service notes, items, status and documented claims | Authorised centre staff/asset managers | Current identifiers, inventory validation and claimant evidence; minimise personal claim data exposed to the model | Removals and release of claimed property follow chosen review policy; maintain custody and claim history |
| News, announcements and external publishing | Draft/edit announcements and news; publish through the existing publication workflow | Existing staff/admin publisher roles and audience | Source URL, factual support, preview, audience and current publication rules | Publishing, sending and external business-profile changes follow chosen review policy; log destination and outcome; retraction is not guaranteed |
| Team space and notifications | Work with conversations the caller can access; draft/send a named message; manage groups through existing RPCs | Membership and sender identity enforced by existing chat operations | Recipient/group identity, exact message and supported attachment permissions | Sending/inviting/removing people requires an explicit destination and chosen review policy; no bulk ingestion of private chats into shared knowledge |
| Personal desk and documents | Search/edit the caller's permitted notes, preferences, journal and documents | Owner and current sharing rules | Ownership, document versions and explicit sharing intent | Sharing/export/removal follows chosen policy; private content stays outside shared AI knowledge |
| Staff accounts and delegation | Prepare account invitations, profile edits, archival and delegations through existing account workflows | Existing verified account administrator only | Account-creation service, role hierarchy, permitted fields, identity verification and current centre rules | Role/access changes and staff archival follow chosen review policy; no AI self-promotion or caller-supplied actor ID |
| Knowledge and AI controls | Publish/edit/archive verified guides; manage personal/shared memory; change supported AI settings | Personal memory owner; trusted admin for company publication/configuration | Versioned source, scope, active state, provider availability, current write control | Permission/tool-policy changes remain owner-controlled; retrieved content cannot grant authority or edit the assistant's code |

## Architecture and supervision

1. Keep the existing caller-authenticated Edge Function. Add a reviewed operation registry with exact input schemas, role/centre/ownership rules, expected version, risk/review classification and a saved-result projection for every operation. Do not expose arbitrary tables, SQL, unrestricted RPC names, server credentials, Docker or source-code editing to the model.
2. Prefer existing guarded app RPCs. Where the UI currently performs multi-step direct writes, introduce an atomic domain operation that preserves its business rules and side effects. Never rely solely on editable profile roles, client claims or permissive legacy policies.
3. Separate plan/preview from commit where the owner chooses review. Bind approval to the actor, operation, centre, exact arguments, target versions and a short expiry. A changed target or argument requires a new preview. Turning writes OFF blocks each pending commit.
4. Keep stable request identities and audited results. Record success only after the database confirms it. Surface partial outcomes, changed records and notifications rather than reporting an invented complete success.
5. Add an action-review view for authorised supervisors: operation, actor, target centre, affected IDs, outcome, before/after summary, notifications and any required approval. Preserve private message/credential contents outside shared audit summaries.
6. Provide a compensating action only when the domain supports one and no intervening change makes it unsafe. Show unsupported recovery explicitly. Deletion with cascades, sent messages and external publication do not have a universal Undo.
7. Enforce the same request/clarification bounds in text and Live tools. Live media still uses browser permission and cannot manufacture physical check evidence.

## Knowledge update completed independently of new permissions

Published a versioned company-wide guide pack sourced from the current code and verified setup. It describes the deployed version-7 capabilities separately from proposed additions. The existing vendor reference remains unchanged and has not been labelled newly verified. Exact content is in `2026-11-05-fets-ai-knowledge.json`; publication proof is in `docs/releases/2026-11-05-ai-knowledge-publication.md`.

Published guides: workspace navigation; calendar/client/session handling and IST; case/task workflow; roster/attendance/leave/OT distinctions; Shift reports and evidence; institution/stage/duty/result workflow; memory, knowledge, controls and action receipts. Dynamic schedules, personal records, private conversations, passwords, tokens, payroll amounts and unverified vendor requirements are not copied into shared guides.

Publication used a transaction-local owner actor context and the authenticated database role, with the existing verified-administrator RLS and version/editor trigger enforced. No Auth session, account, membership, role, grant or policy was created or changed. The actor was the already verified administrator who requested the update; the publication was performed through the connected database administration tool. Future publication should preserve the same real-requestor attribution and policy checks.

## Delivery and verification

Deliver by module, enabling only operations that pass their contract tests, permission/centre isolation, stale-version, cancellation, switch-OFF and retry tests. For operations with dependent writes, test atomic failure and rollback. Verify the actual model/tool loop with isolated data, and a designated production acceptance identity without creating real business records.

Preserve the running frontend/configuration and previous backend source before rollout. Inspect current production again before each deploy. Publish a capability list generated from the installed registry and current permissions, so Knowledge and the UI do not claim unimplemented operations.

## Owner decisions required

1. Does full access primarily mean all unsupported operations, fewer repeated confirmations, or both? Pending answer.
2. For deletions, approvals, attendance corrections, account-role changes and external publishing, prepare for review or execute after an explicit instruction? Pending answer. Recommended initial default is a preview/review for these actions.

Implementation details such as registry filenames, test-fixture structure, pagination sizes and UI layout are left to the builder. They do not change the authority described here.
