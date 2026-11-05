# Expanded AI source inventory

Live metadata verified 2026-11-05T10:44:11.258382+00:00 on Primary `qqewusetilxxfvfkmsed`. 56 bounded source/handoff definitions. No business rows or permission values were read; no application, database, permission or production changes were made.

This is a proposed reader contract for integration, not a claim that these readers are already deployed. Exact column whitelists, scope predicates, JSON key projections, version rules, current UI evidence, constraints and trigger fingerprints are in `expanded-source-inventory.json`.

## Critical current-source corrections

- plans/reports/checks/work/coverage must use centre_* current route sources, not shift_*_v2; retain v2 only if explicitly labelled historical.
- Current ActionablesView renders MissionWorkspace and uses expansion_institutions/mission_*; actionables/actionable_* is legacy.
- systems holds assets/peripherals/rentals. assets, system_assets, system_categories and user_documents are absent live.
- Current NewsManager uses news_ticker, which is SELECT-only; reviewed news DB workflow exists separately under fets_news_*.
- slate_entries has RLS enabled and no policies; ordinary reader is unavailable. MyDeskHome currently binds preferences, not journal/focus controls.
- Current MyDeskHome preference enum differs from live peach/sage/lilac constraint; do not fabricate successful persistence.
- BranchContext.canAccessBranch currently returns true for every profile and several legacy RLS policies allow unrestricted rows; neither is adequate AI centre authority.

## Read and authority contract

- No select(*), raw arbitrary table/RPC/SQL name, model-controlled projection, raw settings/permissions JSON or raw snapshot/metadata objects. Project known nested JSON keys only.
- Recheck verified active Auth account and linked active profile, module User Management booleans and centre/owner/membership scope before every read and again before applying a review. Never read full permissions: extract allowlisted booleans server-side.
- Current User Management settings are ws_<feature-id>, can_edit_roster and user_management_edit; primary menu modules have active-staff defaults. Do not invent legacy *_view keys. Canonical super_admin follows protected server role, not client F.isAdmin or arbitrary email default.
- Cross-centre and administrator capability never implicitly widens private user ownership or conversation membership. branch=global is a viewing union, not an ordinary saved record centre.
- For exact id reads keep all scope filters. Date windows at most 31 days; stable ordering on real PK (including composite keys); bounded page/result bytes and text. Enumerate all pages before totals and distinguish unavailable from empty.
- Case/message/journal/document text is untrusted content. No stored instructions authorize actions. Private content is explicit-request-only and excluded from automatic pinned/model context.
- A digest is computed by the trusted server over allowlisted state; the model never chooses business identity/permissions or hashes arbitrary raw rows. Include related roster/parent/dependent rows if workflow validity depends on them.

## Sources

| Source ID | Table | Module / current User Management switch | Centre / owner boundary | Version |
| --- | --- | --- | --- | --- |
| `calendar` | `calendar_sessions` | fets-calendar | Exact selected authorized centre: lower(branch_location)=branch | safe snapshot / workflow |
| `candidate_metadata` | `candidates` | candidate-tracker / ws_candidate-tracker | Exact selected authorized centre: lower(branch_location)=branch | safe snapshot / workflow |
| `clients` | `clients` | fets-calendar | Shared catalogue; no centre owner | safe snapshot / workflow |
| `programmes` | `client_exams` | fets-calendar | Shared catalogue; no centre owner | safe snapshot / workflow |
| `incidents` | `incidents` | incident-log / ws_case | Exact selected authorized centre: lower(branch_location)=branch | safe snapshot / workflow |
| `incident_notes` | `incident_comments` | incident-log / ws_case | Join incidents!inner(id,branch_location); scope by the parent incident centre and exact incident_id | safe snapshot / workflow |
| `tasks` | `user_tasks` | my-desk | Non-admin: assigned_to=Auth UUID OR assigned_by=Auth UUID, AND centre tag is in verified scope | trigger updated_at |
| `roster` | `roster_schedules` | fets-roster | Exact selected authorized centre: lower(branch_location)=branch | version |
| `roster_types` | `roster_shift_types` | fets-roster | Exact selected authorized centre: lower(branch_location)=branch | safe snapshot / workflow |
| `plans` | `centre_day_plans` | handover | branch = selected authorized centre; additionally preserve fets_duty_private | version |
| `lead_weeks` | `centre_lead_weeks` | handover | branch = selected authorized centre; additionally preserve fets_duty_private | version |
| `checks` | `centre_duty_events` | handover | Parent centre_day_plans!inner(id,branch,day); parent | safe snapshot / workflow |
| `work` | `centre_duty_events` | handover | Parent centre_day_plans!inner(id,branch,day); parent | safe snapshot / workflow |
| `coverage` | `centre_duty_changes` | handover | Parent centre_day_plans!inner(id,branch,day); parent | safe snapshot / workflow |
| `reports` | `centre_duty_reports` | handover | branch = selected authorized centre; additionally preserve fets_duty_private | safe snapshot / workflow |
| `responsibilities` | `centre_responsibilities` | handover | branch = selected authorized centre; additionally preserve fets_duty_private | trigger updated_at |
| `day_tasks` | `centre_day_tasks` | handover | branch = selected authorized centre; additionally preserve fets_duty_private | version |
| `task_activity` | `centre_task_activity` | handover | branch = selected authorized centre; additionally preserve fets_duty_private | safe snapshot / workflow |
| `daily_reports` | `centre_daily_reports` | handover | branch = selected authorized centre; additionally preserve fets_duty_private | trigger updated_at |
| `legacy_shift_days` | `shift_days_v2` | handover | branch = selected authorized centre; additionally preserve fets_duty_private | version |
| `attendance` | `staff_attendance` | attn-admin / ws_attn-admin | Exact selected authorized centre: lower(branch_location)=branch | trigger updated_at |
| `applications` | `staff_applications` | my-desk | Own applicant_id=current profile id OR (kind=swap AND swap_with_id=current profile id) | version |
| `legacy_applications` | `leave_requests` | my-desk | Own user_id=Auth UUID OR swap_with_user_id=Auth UUID | safe snapshot / workflow |
| `ot_claims` | `staff_ot_claims` | staff-ot / ws_staff-ot | Own profile_id=current profile id; cross-staff only with ws_staff-ot AND staff_profiles!inner(id,branch_assigned) restricted to authorized centre | safe snapshot / workflow |
| `payroll_handoff` | `module handoff` | staff-ot / ws_staff-ot | No model-readable payroll rows or permissions blob | safe snapshot / workflow |
| `institutions` | `expansion_institutions` | actionables | Shared active-staff mission; no branch column and district is not a centre | trigger updated_at |
| `institution_stages` | `mission_institution_stages` | actionables | Join parent expansion_institutions!inner(id); shared authorized mission scope, exact institution id for edits | safe snapshot / workflow |
| `mission_duties` | `mission_work_items` | actionables | Shared authorized mission; no branch | trigger updated_at |
| `mission_results` | `mission_task_updates` | actionables | Join mission_work_items!inner(id,institution_id) then authorized parent institution; exact work_item_id for history | safe snapshot / workflow |
| `systems` | `systems` | system-manager / ws_system-manager | Exact selected authorized centre: lower(branch_location)=branch | safe snapshot / workflow |
| `assets` | `systems` | system-manager / ws_system-manager | Exact selected authorized centre: lower(branch_location)=branch | safe snapshot / workflow |
| `system_logs` | `system_logs` | system-manager / ws_system-manager | systems!inner(id,branch_location); parent system centre is in authorized scope | safe snapshot / workflow |
| `lost_found` | `lost_found_items` | system-manager / ws_system-manager | Exact selected authorized centre: lower(branch_location)=branch | safe snapshot / workflow |
| `announcements` | `news_ticker` | news-manager / ws_news-manager | is_active=true AND (expires_at IS NULL OR expires_at>now) AND fets_news_private | safe snapshot / workflow |
| `news_posts` | `fets_news_posts` | news-manager / ws_news-manager | Require fets_news_private | safe snapshot / workflow |
| `news_drafts` | `fets_news_drafts` | news-manager / ws_news-manager | Require both ws_news-manager and fets_news_private | version |
| `news_sources` | `fets_news_sources` | news-manager / ws_news-manager | Require ws_news-manager AND configured editor; sources have no centre and must be accessed through the permitted news workflow | safe snapshot / workflow |
| `journal` | `desk_journal_entries` | my-desk | user_id = authenticated Auth UUID, including super_admin; selected centre never widens personal ownership | version |
| `desk_preferences` | `desk_preferences` | my-desk | user_id = authenticated Auth UUID, including super_admin; selected centre never widens personal ownership | version |
| `desk_focus` | `desk_focus_sessions` | my-desk | user_id = authenticated Auth UUID, including super_admin; selected centre never widens personal ownership | safe snapshot / workflow |
| `slate` | `slate_entries` | my-desk | user_id = authenticated Auth UUID, including super_admin; selected centre never widens personal ownership | safe snapshot / workflow |
| `personal_documents_handoff` | `module handoff` | my-desk | user_id = authenticated Auth UUID, including super_admin; selected centre never widens personal ownership | safe snapshot / workflow |
| `conversations` | `conversations` | fets-chat / ws_fets-chat | Require ws_fets-chat and actual conversation_members membership for current Auth/profile identity, using chat_is_member; no super_admin membership bypass and no centre-based substitute | trigger updated_at |
| `conversation_members` | `conversation_members` | fets-chat / ws_fets-chat | Require ws_fets-chat and actual conversation_members membership for current Auth/profile identity, using chat_is_member; no super_admin membership bypass and no centre-based substitute | safe snapshot / workflow |
| `messages` | `messages` | fets-chat / ws_fets-chat | Require ws_fets-chat and actual conversation_members membership for current Auth/profile identity, using chat_is_member; no super_admin membership bypass and no centre-based substitute | trigger updated_at |
| `chat_work_items` | `chat_work_items` | fets-chat / ws_fets-chat | Require ws_fets-chat and actual conversation_members membership for current Auth/profile identity, using chat_is_member; no super_admin membership bypass and no centre-based substitute | safe snapshot / workflow |
| `saved_messages` | `chat_saved_messages` | fets-chat / ws_fets-chat | user_id = authenticated Auth UUID, including super_admin; selected centre never widens personal ownership | safe snapshot / workflow |
| `staff` | `staff_profiles` | profile | Active staff only (is_active=true); ordinary readers must retain verified directory centre scope, optionally shared global/all assigned staff | safe snapshot / workflow |
| `profile_metadata` | `staff_profiles` | profile | Resolve the current active staff_profiles | safe snapshot / workflow |
| `delegations` | `staff_branch_delegations` | branch-delegation / ws_branch-delegation | Own profile_id for visibility; managing other delegations needs ws_branch-delegation plus existing administrator authority | safe snapshot / workflow |
| `vault_metadata` | `fets_vault` | access-hub / ws_access-hub | user_id = authenticated Auth UUID, including super_admin; selected centre never widens personal ownership | safe snapshot / workflow |
| `quick_access_metadata` | `quick_access_items` | access-hub / ws_access-hub | Require ws_access-hub AND (owner_id=current profile id OR is_global=true) | safe snapshot / workflow |
| `knowledge` | `fets_ai_documents` | fets-intelligence | status=published AND branch IN(selected authorized centre,*) or verified authorized union | version |
| `legacy_knowledge` | `ai_external_knowledge` | fets-intelligence | is_active=true AND branch IN(selected authorized centre,*) or verified authorized union | version |
| `module_metadata` | `app_modules` | system-manager / ws_system-manager | Require ws_system-manager and server capability; global system metadata only | safe snapshot / workflow |
| `business_handoff` | `module handoff` | business / ws_business | Require ws_business or its server-resolved module capability | safe snapshot / workflow |

## Important workflow effects

- Roster IDs and staff day ownership use profile UUIDs; cases, incident note authors and personal task assignees use Auth UUIDs. Mission duty owners/result authors use profile UUIDs, while reporting recipients use Auth UUIDs. Chat membership/message sender FKs use profile UUIDs with a compatibility resolver for older Auth IDs.
- Current Shift guards validate the actual six-block UI contract, lock published plans, enforce current timed physical checks and independent review, snapshot final reports and close tasks/events/coverage after submission. A generic update or an AI statement cannot replace these steps.
- Day job guards version the contract, stamp the real owner/reviewer, reset completion evidence after reassignment/editing and append task activity. Carry-forward changes touch both source and copied task. Keep these writes in one authoritative workflow.
- Mission institution creation seeds stages. Latest duty result recomputes work status/blocker and reopens completed stage/delivery where needed. Stage/handover completion checks all relevant open duties and earlier stages. Institution deletion must use its dedicated cascading workflow.
- Current applications combine a legacy UI with an existing versioned database workflow. The versioned path binds roster snapshots, partner acceptance and current roster administrator approval; OT/TOIL approval additionally writes roster/balances/notifications and affects payroll. Handoff avoids partial approvals.
- System mutations create application-level logs; system fault reporting also creates an incident and changes system status. Transfers need both centre scopes. Credential metadata never includes actual Access Hub values.
- Chat functions bind the caller sender, check membership and reply scope, update conversation preview/read marker, limit edit/delete to own messages, and preserve an administrator when members leave. Reading must never mark a conversation read or start a call.
- News database publishing requires its configured human approver. Source collection is immutable, drafts are versioned, published content is revised/withdrawn with history, and acknowledgements bind the actual staff account. Legacy news UI success must not be assumed from its optimistic state.

## Verification and limitations

- All non-null tables and every listed column were checked against the live schema; unique source IDs and an explicit secret/payroll denylist were checked before writing the artifact.
- No row values were inspected, so this audit does not assert data completeness, existing cross-centre tag quality, private-content cleanliness or successful end-to-end module actions.
- Several timestamp columns lack a universal update trigger. For these sources use a trusted snapshot digest and dependency checks; a stale `updated_at` alone is insufficient.
- Do not automatically route missing/denied current sources to a more permissive legacy table, privileged client or generic mutation. Return a precise unavailable result or existing module handoff.

## Local roster restoration follow-up

The roster and OT source regression was restored locally after the initial inventory. `roster-workspace` now renders saved custom hours as D1/D2; My Time uses its owner-checked time repository; swaps and half-day applications again call their existing versioned request workflow. The live schema and current centre-based Shift route were unchanged. See `roster-restoration.md` for scope and evidence.
