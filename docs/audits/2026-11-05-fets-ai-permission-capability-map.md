# FETS AI permission and capability map for operator review

Status: read-only audit and proposed operation contracts. This document is not an executable registry, permission grant, migration or deployment. No new AI execution authority has been enabled.

## Owner policy recorded

- Cover all requested FETS Live modules; do not ask the owner to choose one module first.
- Ordinary users may use only the access assigned in User Management, subject to existing actor, centre, ownership and workflow rules.
- Super administrators should have all application capabilities, while the selected human-review policy still applies to sensitive actions.
- Deletions, approvals, attendance corrections, role/access changes and publication are prepared for review. They are not approved by a model response, chat text, stored memory or retrieved document.
- A future sensitive commit must require a deliberate authenticated human app action bound to the exact actor, operation, target, arguments, record version and expiry. Recheck current permissions and OFF immediately before execution. Approval/permission editing is not a model tool.

## Sources and current state

Inspected the local User Management page, workspace-feature helpers, AuthContext, current domain entrypoints and relevant live metadata. The installed AI agent is active version 7 with JWT verification. Its six current operational actions remain unchanged. Seven factual guide documents remain published at version 1.

Only permission keys/booleans and workflow metadata are included here. Unrelated values held in staff profile fields are not reproduced or published.

Relevant source paths:

- `fets-point/src/components/UserManagement.tsx`
- `fets-point/src/redesign/workspace-features.ts`
- `fets-point/src/contexts/AuthContext.tsx`
- `fets-point/src/utils/authUtils.ts`
- `fets-point/src/redesign/write-data.ts`
- `fets-point/src/redesign/MissionWorkspace.tsx`
- `fets-point/src/components/Chat/chat-api.ts`
- `supabase/functions/fets-ai-agent/{catalog,core,runtime}.ts`

## Authority mismatches that require operator resolution

1. `ws_<feature>` values control Workspace menu visibility. They do not define CRUD authority. The main Live/Calendar/Roster/My Desk/Actionables menu items are not governed by that feature list.
2. The live AI trusts verified active centre membership and its role/tool allowlist. User Management changes `staff_profiles.role` and permission values; its current profile-security trigger synchronizes a separate private Actionables membership. This does not establish synchronization with the AI's centre-membership authority.
3. Roster authority is inconsistent: User Management displays `can_edit_roster`, AuthContext delegates to a role helper that currently requires super-admin role, and the inspected live roster policies impose an additional owner-email condition. A displayed switch cannot silently bypass those rules.
4. User Management displays `user_management_edit`, but the page itself is gated by super-admin role/owner-email logic. The live profile guard independently uses trusted private project-manager membership for sensitive profile/permission changes. These layers are not one canonical permission evaluator.
5. Workspace defaults have an administrator-layout exception in addition to profile role. Showing that layout must not be interpreted as super-administrator execution authority.
6. Explicit workspace overrides can hide a feature even for a super-admin profile. The owner's requested all-access super-admin exception must be reconciled with current visibility semantics rather than assumed to be installed.
7. Some inspected legacy table policies are permissive. They are not sufficient evidence of intended authority for a new AI connector. Unverified operations remain unavailable; no generic table, SQL or RPC dispatcher is proposed as a workaround.

## Per-workflow contracts

All rows below are proposed, unavailable AI additions unless explicitly marked as one of the existing six actions. Every enabled operation needs a named, closed contract; accepted fields below describe the review boundary rather than a deployed API.

| Workflow | Current UI key or entrypoint | Trusted authority and scope to verify | Proposed fields and sensitive side effects | Required audit evidence and recovery limit |
|---|---|---|---|---|
| Calendar session create/update | Main Calendar; existing six-action AI gate | Existing verified centre member, role/allowlist, concrete centre and current controls | Exact client, exam, date, start/end, candidates; saved ID/version for updates | Existing saved outcome/ID and before/after version; current behaviour retained |
| Calendar deletion and candidate-roster import | Main Calendar; `save_calendar_roster` for import | Calendar authority plus exact centre and existing import checks; deletion reviewed | Exact session ID/version; import date/provider/source and validated rows; possible dependent records | Target snapshot, affected rows, import outcome; deletion has no assumed universal undo |
| Client/programme catalogue | Client controls; historical `ws_client-directory` values are stored but not declared in the current Workspace feature list | Catalogue-management authority is unresolved; table writeability alone is insufficient | Named catalogue record and allowed public fields; references from sessions | Source/version, dependent references and actual result; destructive changes reviewed |
| Cases and assigned tasks | `ws_case` for case shortcut; main personal desk; existing create/update AI actions | Current caller ownership/assignment, centre and role/allowlist remain authoritative | Existing fields, assignee identity and latest record version; notes/assignment notifications must be preserved | Existing receipts retained; any new removal/reassignment contract separately verified |
| Roster editing | Main Roster; `can_edit_roster` | Resolve the UI/role/owner-policy mismatch before adding a connector; exact staff and centre | Staff ID, day, shift code, actual start/end and lead/cover; bulk/retroactive changes reviewed | Original roster versions, affected people and resulting rows; no silent overwriting |
| Shift reports and handovers | Main Shift; existing draft-only proposal | Current centre staff/report ownership and checklist guard | Exact centre/day/report kind, source values, checklist evidence and issue notes; submission/sign-off reviewed | Original author, checklist evidence, saved report/version; physical checks cannot be invented |
| Attendance | `ws_attn-admin`; attendance page actions | Self identity for self events and separately verified correction authority; legacy broad policies are insufficient | Staff/date, original values, requested correction and reason; correction is a review draft | Actor, original/proposed times/status and actual decision; no online-flag inference |
| Leave, staff applications and swaps | Personal desk/application workflows | Applicant identity, counterpart consent, resolving authority and roster side effects | Exact request, dates, kind, counterpart, status and reason; approvals reviewed | Submission/consent/decision evidence plus dependent roster changes; no status-only approval |
| OT, TOIL and payroll | `ws_staff-ot`; own claim and management workflows | Own claims versus trusted financial decision authority must be verified separately | Exact claim/period and requested fields; approvals, rates and payroll changes reviewed | Claim/version, calculation inputs and dependent effects; no guessed rates or generic payroll update |
| Institutions and Actionables | Main Actionables; institution/stage/duty/result forms | Existing active staff/project rules and exact institution relationships; verify each domain guard | Institution contact fields; stage; duty owner/reporting recipient/due date; result and evidence | Actor, linked IDs, before/after values and result; institution deletion cascades and requires human review |
| Systems/assets | `ws_system-manager` | Workspace visibility plus verified asset/system management authority | Exact asset IDs and permitted non-secret fields; removal reviewed | Target/version and custody/service history; do not expose server configuration or credentials |
| Lost/found claims | Existing lost/found page | Centre/custody/claimant handling authority unresolved for AI | Item ID, factual status and limited claim evidence; release/removal reviewed | Claim/custody evidence and outcome; physical release cannot be reversed by a database edit |
| News and announcements | `ws_news-manager`; current publication workflow | Publisher role, audience, source and existing publication checks | Draft text/source/audience and exact item/version; sending/publication reviewed | Approved content, destination and actual publication result; retraction not guaranteed |
| Google Business/external publication | `ws_business` | Existing connected-account/OAuth and publisher authority must be verified | Exact destination and proposed public content; preview only until human action | Destination, exact content and provider result; no blanket external-account authority |
| Team messages/groups | `ws_fets-chat`; existing `chat_*` RPCs | Caller membership, sender identity and group-management rules | Exact conversation/recipient, message and allowed attachment; sending/invites/removal reviewed | Destination/content reference and actual RPC result; no bulk private-chat ingestion |
| Personal notes/journal/documents | Main My Desk and owner document flows | Current owner and sharing rules | Exact own record/version and proposed content; sharing/export/removal reviewed | Ownership/version, sharing destination and result; no publishing private values to shared knowledge |
| Staff accounts and delegation | `ws_user-management`, `user_management_edit`, `ws_branch-delegation` | Resolve page/profile-guard/private-membership authority first; no caller-supplied actor | Existing invitation/profile/archive/delegation fields; access/role changes are review drafts | Requestor, target, original/proposed rights and deliberate human decision; assistant cannot promote itself |
| Knowledge and AI settings | Existing trusted admin management endpoints; own memory | Keep current owner/centre/company publication rules and operational controls | Factual guide content/version/source and permitted memory/settings; no authority grant from guide text | Existing publication/version proof; current seven guides remain; capability/policy changes require operator authorization |
| Access Hub/credentials | `ws_access-hub` | No connector authorized by this audit; any future workflow needs separate data-minimization/credential-use design | Do not place credentials, tokens or unrestricted vault contents into model context or shared knowledge | No credential exposure or new secret access has occurred as part of this map |

## Human review boundary

A draft must show what will change, what it affects, who may apply it, the current target version and what cannot be undone. The model cannot apply its own draft or approve a changed payload. No approval endpoint, connector, authority-bearing migration or deployment has been generated by this audit.

An independent human operator must review the authority mismatches and each resulting operation contract, and explicitly authorize any capability/authority change before implementation or activation. This audit does not treat technically callable legacy functions as permission to expose them.
