"""Build the SQL Editor installer from the reviewed migration sources."""
from pathlib import Path
root=Path(__file__).resolve().parents[2]
parts=[('personal_desk','20260929081548_personal_desk.sql',"to_regclass('public.desk_journal_entries') is null", "to_regprocedure('public.desk_save_journal(date,text,text,integer)') is not null and to_regclass('public.desk_preferences') is not null and to_regclass('public.desk_focus_sessions') is not null"),('centre_duties','20260929091547_centre_duty_planning.sql',"to_regclass('public.centre_day_plans') is null", "to_regclass('public.centre_duty_reports') is not null and to_regclass('public.centre_duty_events') is not null and to_regclass('public.centre_lead_weeks') is not null and to_regprocedure('fets_duty_private.plan_guard()') is not null"),('coverage','20260929100511_duty_coverage_and_activation.sql',"to_regclass('public.centre_duty_changes') is null", "to_regprocedure('public.fets_workspace_capabilities()') is not null and to_regprocedure('fets_duty_private.change_guard()') is not null")]
text='''-- FETS LIVE: My Desk + centre duties + audited coverage changes
-- RUN ONLY in project qqewusetilxxfvfkmsed, SQL Editor, as postgres.
-- This is separate from setup_chat_and_tools.sql. Existing chat, calendar,
-- roster and historical handovers are not replaced or deleted.
-- Rerunnable. All installation steps run in one transaction.
BEGIN;
DO $preflight$
DECLARE item record;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('staff_profiles','id'),('staff_profiles','user_id'),('staff_profiles','role'),
 ('staff_profiles','is_active'),('staff_profiles','permissions'),('staff_profiles','branch_assigned'),
 ('roster_schedules','profile_id'),('roster_schedules','date'),
 ('roster_schedules','shift_code'),('roster_schedules','branch_location')) AS fields(table_name,column_name)
 LOOP
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=item.table_name AND c.column_name=item.column_name) THEN
   RAISE EXCEPTION 'Required existing column %.% is missing. Nothing has been installed; share this error for a schema-compatible update.',item.table_name,item.column_name;
  END IF;
 END LOOP;
END $preflight$;
'''
for name,file,missing,complete in parts:
 sql=(root/'supabase/migrations'/file).read_text()
 text+=f"\nDO $step_{name}$\nBEGIN\n IF {missing} THEN\n  EXECUTE $install_{name}$\n{sql}\n$install_{name}$;\n ELSIF NOT ({complete}) THEN\n  RAISE EXCEPTION 'An incomplete {name} installation already exists. No changes committed. Share this error before retrying.';\n END IF;\nEND $step_{name}$;\n"
text+='''
DO $verify$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.centre_duty_members WHERE branch='*' AND role='super_admin') THEN
  RAISE EXCEPTION 'No active super admin found in staff_profiles. No changes committed. Confirm your existing staff profile role before running setup.';
 END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('desk_preferences','desk_journal_entries','desk_focus_sessions','centre_duty_members','centre_lead_weeks','centre_day_plans','centre_duty_events','centre_duty_reports','centre_duty_changes') AND c.relrowsecurity)<>9 THEN
  RAISE EXCEPTION 'Workspace security verification failed. No changes committed.';
 END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'READY — refresh fets.live and open My Desk or Handover' AS status,
 (SELECT count(*) FROM public.centre_duty_members WHERE role='super_admin') AS super_admin_access_records,
 (SELECT count(*) FROM public.centre_duty_members WHERE role='staff') AS staff_centre_access_records,
 2 AS workspace_schema_version;
'''
out=root/'fets-point/scripts/complete_workspace_setup.sql';out.write_text(text)
public=root/'fets-point/public/setup/complete-workspace-setup.sql'
public.parent.mkdir(parents=True,exist_ok=True)
public.write_text(text)
print(out)
