-- FETS LIVE ONLY: qqewusetilxxfvfkmsed. Online keeps its own authentication.
-- Next's authenticated server supplies a VERIFIED auth email, never a display name
-- or a client-supplied identity. No new accounts, ownership or completions are seeded.
begin;
create table fets_duty_private.online_check_sources (
 event_id uuid primary key references public.centre_duty_events(id),
 online_user_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp()
);
alter table fets_duty_private.online_check_sources enable row level security;
revoke all on fets_duty_private.online_check_sources from public,anon,authenticated;
grant select,insert on fets_duty_private.online_check_sources to service_role;

-- Narrow definer lookup is required because service_role cannot read auth.users.
-- It is private and executable only by the server role. A user JWT is not accepted.
create function fets_duty_private.online_actor(p_online_user uuid,p_email text,p_branch text)
returns uuid language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 if current_setting('role',true) is distinct from 'service_role' then raise exception 'Server connection required' using errcode='42501'; end if;
 if p_online_user is null or p_email is null or length(btrim(p_email))<3 or p_branch not in ('calicut','cochin') or p_branch is null then raise exception 'Invalid staff context' using errcode='22023'; end if;
 select array_agg(distinct u.id) into ids from auth.users u join public.staff_profiles s on s.user_id=u.id
 where lower(btrim(u.email))=lower(btrim(p_email)) and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until<clock_timestamp()) and u.deleted_at is null
 and s.is_active is distinct from false
 and exists(select 1 from public.centre_duty_members m where m.user_id=u.id and m.profile_id=s.id and (m.branch=p_branch or (m.branch='*' and m.role='super_admin')));
 if coalesce(cardinality(ids),0)<>1 then raise exception 'Your verified email needs an active FETS Live staff account with access to this centre' using errcode='42501'; end if;
 return ids[1];
end $$;
revoke all on function fets_duty_private.online_actor(uuid,text,text) from public,anon,authenticated;
grant execute on function fets_duty_private.online_actor(uuid,text,text) to service_role;

create function public.fets_online_check_snapshot(p_online_user uuid,p_email text,p_branch text,p_day date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare uid uuid; prior_sub text:=current_setting('request.jwt.claim.sub',true); viewer uuid; p public.centre_day_plans; result jsonb;
begin
 uid:=fets_duty_private.online_actor(p_online_user,p_email,p_branch);
 if p_day is null then raise exception 'Choose a date' using errcode='22023'; end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 viewer:=fets_duty_private.me();
 select * into p from public.centre_day_plans where branch=p_branch and day=p_day and status='published';
 if p.id is null then
  result:=jsonb_build_object('connected',true,'plan',null,'server_now',clock_timestamp(),'reason','Publish this day in The Shift before recording checks.');
 else
  select jsonb_build_object('connected',true,'server_now',clock_timestamp(),'viewer_id',viewer,
   'viewer_rostered',fets_duty_private.rostered(viewer,p_branch,p_day),
   'plan',jsonb_build_object('id',p.id,'day',p.day,'branch',p.branch,'version',p.version,'closed',exists(select 1 from public.centre_duty_reports where plan_id=p.id)),
   'checks',coalesce(jsonb_agg(jsonb_build_object('block',b.n-1,'kind',k.kind,'due',due.t,'owner_id',owner.id,'owner_name',s.full_name,
     'event',case when e.id is null then null else jsonb_build_object('id',e.id,'actor_id',e.actor_id,'actor_name',actor.full_name,'created_at',e.created_at,'note',e.note) end) order by due.t,k.kind),'[]'::jsonb)) into result
  from jsonb_array_elements(p.plan->'blocks') with ordinality b(value,n)
  cross join (values ('walk','floor',10),('dvr','control',6)) k(kind,lane,step)
  cross join lateral generate_series((b.value->>'start')::int+k.step,(b.value->>'end')::int,k.step) due(t)
  cross join lateral (select fets_duty_private.resolved_owner(p.id,(b.n-1)::int,k.lane,due.t-1) id) owner
  left join public.staff_profiles s on s.id=owner.id
  left join public.centre_duty_events e on e.plan_id=p.id and e.block=b.n-1 and e.kind=k.kind and e.lane=k.lane and e.due=due.t
  left join public.staff_profiles actor on actor.id=e.actor_id;
 end if;
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 return result;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);raise;
end $$;
revoke all on function public.fets_online_check_snapshot(uuid,text,text,date) from public,anon,authenticated;
grant execute on function public.fets_online_check_snapshot(uuid,text,text,date) to service_role;

create function public.fets_online_record_check(p_online_user uuid,p_email text,p_branch text,p_plan uuid,p_block integer,p_kind text,p_due integer,p_note text default '')
returns public.centre_duty_events language plpgsql security invoker set search_path='' as $$
declare uid uuid; prior_sub text:=current_setting('request.jwt.claim.sub',true); viewer uuid; e public.centre_duty_events; lane_name text;
begin
 uid:=fets_duty_private.online_actor(p_online_user,p_email,p_branch);
 if p_plan is null or p_block is null or p_block not between 0 and 5 or p_kind is null or p_kind not in ('walk','dvr') or p_due is null or p_due not between 481 and 1020 or length(coalesce(p_note,''))>2000 then raise exception 'Invalid check' using errcode='22023'; end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);viewer:=fets_duty_private.me();
 perform pg_advisory_xact_lock(hashtextextended(p_plan::text,0));
 if not exists(select 1 from public.centre_day_plans where id=p_plan and branch=p_branch and status='published') then raise exception 'Published plan not found at your centre' using errcode='42501'; end if;
 lane_name:=case when p_kind='walk' then 'floor' else 'control' end;
 select * into e from public.centre_duty_events where plan_id=p_plan and block=p_block and lane=lane_name and kind=p_kind and due=p_due;
 if e.id is not null then
  -- Retrying an acknowledged/unknown network response returns the same immutable
  -- record, even after its window expires. It cannot relabel or change a check.
  if e.actor_id is distinct from viewer or e.note is distinct from btrim(coalesce(p_note,'')) then raise exception 'This check is already recorded; refresh the log' using errcode='23505'; end if;
 else
  -- The existing trigger stamps the real actor/time and enforces due-1 ownership,
  -- current roster, 6/10-minute window, break cover and report closure.
  insert into public.centre_duty_events(plan_id,block,lane,kind,due,note)
  values(p_plan,p_block,lane_name,p_kind,p_due,btrim(coalesce(p_note,''))) returning * into e;
  insert into fets_duty_private.online_check_sources(event_id,online_user_id) values(e.id,p_online_user);
 end if;
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);return e;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);raise;
end $$;
revoke all on function public.fets_online_record_check(uuid,text,text,uuid,integer,text,integer,text) from public,anon,authenticated;
grant execute on function public.fets_online_record_check(uuid,text,text,uuid,integer,text,integer,text) to service_role;
notify pgrst,'reload schema';
commit;
