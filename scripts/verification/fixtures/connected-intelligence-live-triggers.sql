-- Read-only production metadata snapshot, 2026-10-29. Test fixture only.
-- Functions below are the original definitions, retained for review/rollback.
create table public.notifications(
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.staff_profiles(id) on delete cascade,
 type text not null,title text not null,message text not null,link text,priority text not null default 'medium',
 is_read boolean default false,read_at timestamptz,created_at timestamptz default now(),metadata jsonb,branch_location text
);
CREATE OR REPLACE FUNCTION public.notify_incident_assignment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  assignee_name TEXT;
  assignee_branch TEXT;
BEGIN
  IF OLD.assigned_to = NEW.assigned_to OR NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  SELECT full_name, branch_assigned INTO assignee_name, assignee_branch
  FROM staff_profiles WHERE id = NEW.assigned_to;
  INSERT INTO notifications(recipient_id,type,title,message,link,priority,metadata,branch_location)
  VALUES(NEW.assigned_to,'incident_assigned','Incident Assigned',
    'Incident #' || NEW.id || ' (' || NEW.severity || ') has been assigned to you',
    'incident-manager',CASE WHEN NEW.severity IN ('critical', 'high') THEN 'high' ELSE 'medium' END,
    jsonb_build_object('incident_id',NEW.id,'severity',NEW.severity,'title',NEW.title),assignee_branch);
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.notify_incident_resolved()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE reporter_branch TEXT;
BEGIN
  IF OLD.status = NEW.status OR NEW.status != 'resolved' THEN RETURN NEW; END IF;
  SELECT branch_assigned INTO reporter_branch FROM staff_profiles WHERE id = NEW.reported_by;
  INSERT INTO notifications(recipient_id,type,title,message,link,priority,metadata,branch_location)
  VALUES(NEW.reported_by,'incident_resolved','Incident Resolved',
   'Incident #' || NEW.id || ' that you reported has been resolved','incident-manager','medium',
   jsonb_build_object('incident_id',NEW.id,'title',NEW.title),reporter_branch);
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger LANGUAGE plpgsql
AS $function$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$;
CREATE TRIGGER trigger_notify_incident_assignment AFTER UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.notify_incident_assignment();
CREATE TRIGGER trigger_notify_incident_resolved AFTER UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.notify_incident_resolved();
CREATE TRIGGER update_user_tasks_updated_at BEFORE UPDATE ON public.user_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
