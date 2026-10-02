begin;
-- Retire the social feed automation; keep its existing records as history.
drop trigger if exists mission_work_activity on public.mission_work_items;
drop trigger if exists mission_centre_activity on public.expansion_institutions;
drop trigger if exists mission_field_note_activity on public.expansion_activity_logs;
alter table public.expansion_institutions add column if not exists website text;
create table public.mission_institution_stages (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.expansion_institutions(id) on delete cascade,
 stage_key text,
 position integer not null check(position>0),
 title text not null check(length(btrim(title)) between 1 and 150),
 instructions text not null default '' check(length(instructions)<=6000),
 contact_script text not null default '' check(length(contact_script)<=4000),
 completion_note text not null default '' check(length(completion_note)<=4000),
 completed_at timestamptz,
 completed_by uuid references public.staff_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(institution_id,position), unique(institution_id,stage_key)
);
alter table public.mission_work_items
 add column if not exists institution_stage_id uuid references public.mission_institution_stages(id) on delete set null,
 add column if not exists instructions text not null default '',
 add column if not exists due_at timestamptz,
 add column if not exists report_to_id uuid references auth.users(id) on delete set null,
 add column if not exists report_instructions text not null default '',
 add column if not exists updated_by uuid references auth.users(id) on delete set null,
 add column if not exists updated_at timestamptz not null default now();
create table public.mission_task_updates (
 id uuid primary key default gen_random_uuid(),
 work_item_id uuid not null references public.mission_work_items(id) on delete cascade,
 content text not null check(length(btrim(content)) between 1 and 4000),
 status text not null check(status in ('open','in_progress','blocked','done')),
 follow_up_date date,
 follow_up_at timestamptz,
 reported boolean not null default false,
 report_to_id uuid references auth.users(id) on delete set null,
 report_method text not null default '',
 author_id uuid references public.staff_profiles(id) on delete set null,
 edited_by uuid references public.staff_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index mission_stages_institution on public.mission_institution_stages(institution_id,position);
create index mission_updates_task on public.mission_task_updates(work_item_id,created_at desc);
create index mission_tasks_stage on public.mission_work_items(institution_stage_id);
alter table public.mission_institution_stages enable row level security;
alter table public.mission_task_updates enable row level security;
create policy mission_stages_staff on public.mission_institution_stages for all to authenticated using(public.fets_is_active_staff()) with check(public.fets_is_active_staff());
create policy mission_updates_staff on public.mission_task_updates for all to authenticated using(public.fets_is_active_staff()) with check(public.fets_is_active_staff());
drop policy if exists mission_work_delete on public.mission_work_items;
create policy mission_work_delete on public.mission_work_items for delete to authenticated using(public.fets_is_active_staff());
grant select,insert,update,delete on public.mission_institution_stages,public.mission_task_updates to authenticated;

create function public.mission_seed_institution_stages(p_institution_id uuid) returns void language sql security definer set search_path='' as $$
 insert into public.mission_institution_stages(institution_id,stage_key,position,title,instructions,contact_script)
 select p_institution_id,item->>'stage_key',ordinality::integer,item->>'title',item->>'instructions',item->>'contact_script'
 from jsonb_array_elements($guide$[{"stage_key":"identify","title":"Identify an institution","instructions":"Search within the selected district and nearby towns. Try “engineering college computer lab {district} Kerala”, “polytechnic college {district} placement officer contact”, or “training institute computer lab {district}”. Check the institution’s own website and map listing. Record the full postal address, website, office phone/email and a named contact or the office to approach. Do not assume a lab is suitable from a listing. Update the institution details here; record the source links and what still needs checking in your duty result.","contact_script":""},{"stage_key":"approach","title":"Contact and approach","instructions":"Start with the principal, director, administrator, placement officer or facilities decision-maker. Call the published office number to identify the correct person. Introduce FETS, explain that this is an exploratory discussion, and ask about interest and an introductory meeting. Record the person’s name, role, preferred contact method, response and agreed follow-up date here. Inform the reporting person named on your duty after saving the result.","contact_script":"Hello, I’m [name] from FETS. We are exploring potential institutions in [district] for a Pearson VUE test-centre project. May I speak with the person responsible for partnerships or computer-lab facilities? We would like to understand your interest and arrange an introductory discussion. Any proposal would depend on the site review, agreed responsibilities and Pearson VUE approval. What would be a convenient time, and which email should we use?"},{"stage_key":"assess","title":"Visit and assess the site","instructions":"Arrange a visit with the institution’s decision-maker and IT contact. Review the current Pearson VUE facility and technical requirements using the official link below. Record the available space, lab access, equipment, connectivity, power, security arrangements and staffing. Capture evidence links with permission, list gaps, and assign a named owner and due date for each follow-up. Save the findings here and report the recommendation to the person assigned on your duty.","contact_script":""},{"stage_key":"agree","title":"Agree responsibilities","instructions":"Review the findings with FETS management and the institution. Document who would provide the space, equipment, connectivity, staffing and ongoing support. Record open questions, proposed costs and who can approve the arrangement. Obtain the required FETS management review before making commitments. Save the approved discussion notes or document link here; do not treat a discussion or draft as an agreement.","contact_script":""},{"stage_key":"approval","title":"Submit and follow up on approval","instructions":"With the FETS project owner, confirm the appropriate Pearson VUE application route and the current required documents. Submit accurate details through the agreed official channel. Record the application reference, submission date, responsible contact, requested corrections and next follow-up. Save approval evidence when it is received. A submitted application is not an approval.","contact_script":""},{"stage_key":"setup","title":"Set up and validate","instructions":"After the necessary approvals and agreements, assign the remaining setup work to named staff. Follow current Pearson VUE installation, facility and administrator guidance; coordinate validation with the relevant support contact. Record training, trial/validation results and unresolved issues. Save evidence and next actions here. Do not mark this stage complete while required setup or validation work remains open.","contact_script":""},{"stage_key":"handover","title":"Hand over and confirm delivery","instructions":"Ask the FETS project owner to review the approval evidence, agreed responsibilities, completed setup, staff readiness and validation results. Record the operating contact, handover date, support arrangements and any agreed follow-ups. Save the owner’s final sign-off evidence in the stage completion note. Count this centre as delivered only after that confirmation; Pearson approval alone does not confirm delivery.","contact_script":""}]$guide$::jsonb) with ordinality as guide(item,ordinality)
 on conflict(institution_id,stage_key) do nothing;
$$;
create function public.mission_new_institution_stages() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.mission_seed_institution_stages(new.id);return new;end $$;
create trigger mission_new_institution_stages after insert on public.expansion_institutions for each row execute function public.mission_new_institution_stages();
select public.mission_seed_institution_stages(id) from public.expansion_institutions;

create or replace function public.mission_simple_task_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id,new.created_by,new.created_at) is distinct from (old.id,old.created_by,old.created_at) then raise exception 'Task origin cannot change';end if;
 if new.institution_stage_id is not null and not exists(select 1 from public.mission_institution_stages where id=new.institution_stage_id and institution_id=new.institution_id) then raise exception 'Choose a stage in this institution';end if;
 if new.owner_id is not null and (tg_op='INSERT' or new.owner_id is distinct from old.owner_id) and not exists(select 1 from public.staff_profiles where id=new.owner_id and is_active) then raise exception 'Assign an active staff member';end if;
 if new.report_to_id is not null and (tg_op='INSERT' or new.report_to_id is distinct from old.report_to_id) and not exists(select 1 from public.staff_profiles where user_id=new.report_to_id and is_active) then raise exception 'Choose an active staff member to receive the result';end if;
 if new.due_at is not null then new.due_date:=(new.due_at at time zone 'Asia/Kolkata')::date;end if;
 new.updated_at:=now();new.updated_by:=auth.uid();
 return new;
end $$;
create trigger mission_simple_task_guard before insert or update on public.mission_work_items for each row execute function public.mission_simple_task_guard();
create or replace function public.mission_stage_completion_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id,new.institution_id,new.stage_key,new.created_at) is distinct from (old.id,old.institution_id,old.stage_key,old.created_at) then raise exception 'Stage origin cannot change';end if;
 if new.completed_at is not null then
  if length(btrim(new.completion_note))=0 then raise exception 'Record the stage result or evidence before completing it';end if;
  if exists(select 1 from public.mission_work_items where institution_stage_id=new.id and status<>'done') then raise exception 'Complete or reassign the open duties before completing this stage';end if;
  if new.stage_key='handover' and exists(select 1 from public.mission_work_items where institution_id=new.institution_id and status<>'done') then raise exception 'Complete all institution duties before recording delivery';end if;
  if new.stage_key='handover' and exists(select 1 from public.mission_institution_stages where institution_id=new.institution_id and position<new.position and completed_at is null) then raise exception 'Complete the earlier stages before recording delivery';end if;
  if tg_op='INSERT' or old.completed_at is null then new.completed_at:=now();select id into new.completed_by from public.staff_profiles where user_id=auth.uid() limit 1;else new.completed_at:=old.completed_at;new.completed_by:=old.completed_by;end if;
 else new.completed_by:=null;end if;
 return new;
end $$;
create trigger mission_stage_completion_guard before insert or update on public.mission_institution_stages for each row execute function public.mission_stage_completion_guard();
create or replace function public.mission_task_update_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id,new.work_item_id,new.author_id,new.created_at) is distinct from (old.id,old.work_item_id,old.author_id,old.created_at) then raise exception 'Result origin cannot change';end if;
 if tg_op='INSERT' then new.created_at:=clock_timestamp();select id into new.author_id from public.staff_profiles where user_id=auth.uid() limit 1;select report_to_id,report_instructions into new.report_to_id,new.report_method from public.mission_work_items where id=new.work_item_id;
 else new.report_to_id:=old.report_to_id;new.report_method:=old.report_method;end if;
 if new.follow_up_at is not null then new.follow_up_date:=(new.follow_up_at at time zone 'Asia/Kolkata')::date;end if;
 select id into new.edited_by from public.staff_profiles where user_id=auth.uid() limit 1;new.updated_at:=now();return new;
end $$;
create trigger mission_task_update_guard before insert or update on public.mission_task_updates for each row execute function public.mission_task_update_guard();
create function public.mission_sync_task_result() returns trigger language plpgsql security definer set search_path='' as $$
declare task_id uuid; latest public.mission_task_updates;begin
 task_id:=case when tg_op='DELETE' then old.work_item_id else new.work_item_id end;
 perform 1 from public.mission_work_items where id=task_id for update;
 select * into latest from public.mission_task_updates where work_item_id=task_id order by created_at desc,id desc limit 1;
 update public.mission_work_items set status=coalesce(latest.status,'open'),blocker=case when latest.status='blocked' then latest.content else null end where id=task_id;
 -- New work or a changed outcome reopens a previously completed stage and delivery sign-off.
 update public.mission_institution_stages s set completed_at=null,completed_by=null
 where s.completed_at is not null and (s.id=(select institution_stage_id from public.mission_work_items where id=task_id and status<>'done') or (s.stage_key='handover' and s.institution_id=(select institution_id from public.mission_work_items where id=task_id and status<>'done')));
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger mission_sync_task_result after insert or update or delete on public.mission_task_updates for each row execute function public.mission_sync_task_result();
create function public.mission_reopen_stage_for_work() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'done' then
  update public.mission_institution_stages set completed_at=null,completed_by=null where completed_at is not null and (id=new.institution_stage_id or (institution_id=new.institution_id and stage_key='handover'));
 end if;return new;
end $$;
create trigger mission_reopen_stage_for_work after insert or update on public.mission_work_items for each row execute function public.mission_reopen_stage_for_work();

create function public.mission_delete_institution(p_institution_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.fets_is_active_staff() then raise exception 'Active staff access required' using errcode='42501';end if;
 perform 1 from public.expansion_institutions where id=p_institution_id for update;
 if not found then raise exception 'Institution is no longer available';end if;
 delete from public.mission_work_items where institution_id=p_institution_id;
 delete from public.expansion_institutions where id=p_institution_id;
end $$;
revoke all on function public.mission_seed_institution_stages(uuid),public.mission_new_institution_stages(),public.mission_sync_task_result(),public.mission_reopen_stage_for_work(),public.mission_delete_institution(uuid) from public,anon,authenticated;
grant execute on function public.mission_delete_institution(uuid) to authenticated;
alter publication supabase_realtime add table public.mission_institution_stages,public.mission_task_updates;

create function public.mission_reopen_delivery() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.completed_at is not null and new.completed_at is null and new.stage_key is distinct from 'handover' then
  update public.mission_institution_stages set completed_at=null,completed_by=null where institution_id=new.institution_id and stage_key='handover' and completed_at is not null;
 end if;return new;
end $$;
create trigger mission_reopen_delivery after update on public.mission_institution_stages for each row execute function public.mission_reopen_delivery();
revoke all on function public.mission_reopen_delivery() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
