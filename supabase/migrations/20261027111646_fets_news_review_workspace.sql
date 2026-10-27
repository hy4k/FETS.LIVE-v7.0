-- Collection creates private drafts. Only the configured active approver can
-- publish immutable staff-facing snapshots. No imported message is a command.
create schema fets_news_private;
revoke all on schema fets_news_private from public,anon;
grant usage on schema fets_news_private to authenticated,service_role;
create table fets_news_private.settings (
 id boolean primary key default true check(id), approver_user_id uuid references auth.users(id),
 mailbox text not null default 'mithun@fets.in',client_task_id text,industry_task_id text,client_enabled boolean not null default true,industry_enabled boolean not null default true,
 domains text[] not null default array['prometric.com','pearson.com','pearsonvue.com','paragontesting.ca','celpip.ca','psiexams.com','ets.org','accaglobal.com','imanet.org','credentialingexcellence.org','testpublishers.org','itc-tests.org','datamatics.com']
);
insert into fets_news_private.settings(id) values(true);
alter table fets_news_private.settings enable row level security;
create policy news_settings_deny on fets_news_private.settings for all to public using(false) with check(false);
revoke all on fets_news_private.settings from public,anon,authenticated,service_role;
create function fets_news_private.actor() returns uuid language sql stable security invoker set search_path='' as $$
 select id from public.staff_profiles where user_id=(select auth.uid()) and is_active is distinct from false limit 1
$$;
create function fets_news_private.editor() returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from fets_news_private.settings c join public.staff_profiles s on s.user_id=c.approver_user_id where c.id and c.approver_user_id=(select auth.uid()) and s.is_active is distinct from false and exists(select 1 from auth.users u where u.id=s.user_id and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<clock_timestamp())))
$$;
create function fets_news_private.collector() returns boolean language sql stable security invoker set search_path='' as $$
 select current_setting('role',true)='service_role' or (session_user='postgres' and current_setting('role',true) in('none','postgres'))
$$;
create function fets_news_private.can_read(b text) returns boolean language sql stable security invoker set search_path='' as $$
 select fets_news_private.actor() is not null and (b='global' or fets_news_private.editor() or exists(select 1 from public.staff_profiles s where s.id=fets_news_private.actor() and (lower(s.branch_assigned)=b or s.branch_assigned in('global','all'))))
$$;
create function fets_news_private.allowed_domain(d text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from fets_news_private.settings s,unnest(s.domains) root where lower(d)=root or lower(d) like '%.'||root)
$$;

create table public.fets_news_sources (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in('client','industry')),
 external_key text not null check(length(external_key) between 1 and 2000),source_label text not null check(length(source_label) between 1 and 200),
 domain text not null,sender text not null default '',source_date timestamptz not null,
 public_url text,private_reference text not null default '',excerpt text not null check(length(excerpt) between 1 and 20000),
 verification text not null check(length(verification) between 1 and 2000),collected_at timestamptz not null default clock_timestamp(),unique(kind,external_key)
);
create table public.fets_news_drafts (
 id uuid primary key default gen_random_uuid(),source_id uuid references public.fets_news_sources(id),kind text not null check(kind in('client','industry','internal')),
 document jsonb not null, status text not null default 'review' check(status in('draft','review','published','rejected')),
 revision_of uuid,version integer not null default 1,review_note text not null default '',
 created_by uuid references public.staff_profiles(id),updated_by uuid references public.staff_profiles(id),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create unique index news_one_open_revision on public.fets_news_drafts(revision_of) where status in('draft','review');
create index news_draft_source on public.fets_news_drafts(source_id);
create index news_draft_revision on public.fets_news_drafts(revision_of);
create index news_draft_creator on public.fets_news_drafts(created_by);
create index news_draft_updater on public.fets_news_drafts(updated_by);
create unique index news_original_draft_source on public.fets_news_drafts(source_id) where revision_of is null;
create table public.fets_news_posts (
 id uuid primary key default gen_random_uuid(),draft_id uuid not null unique references public.fets_news_drafts(id),
 kind text not null check(kind in('client','industry','internal')),document jsonb not null,
 source_label text not null,source_date timestamptz,source_url text,
 approved_by uuid not null references public.staff_profiles(id),published_at timestamptz not null default clock_timestamp(),
 supersedes_id uuid unique references public.fets_news_posts(id),state text not null default 'live' check(state in('live','superseded','withdrawn')),
 withdrawn_at timestamptz,withdrawal_reason text not null default ''
);
alter table public.fets_news_drafts add foreign key(revision_of) references public.fets_news_posts(id);
create table public.fets_news_receipts (
 post_id uuid not null references public.fets_news_posts(id),profile_id uuid not null references public.staff_profiles(id),
 acknowledged_at timestamptz not null default clock_timestamp(),primary key(post_id,profile_id)
);
create table public.fets_news_collection_runs (
 id bigint generated always as identity primary key,kind text not null check(kind in('client','industry')),
 status text not null check(status in('success','failed','paused')),added integer not null default 0 check(added>=0),
 note text not null default '' check(length(note)<=2000),completed_at timestamptz not null default clock_timestamp()
);
create index news_drafts_queue on public.fets_news_drafts(status,updated_at desc);
create index news_source_recent on public.fets_news_sources(collected_at desc);
create index news_posts_approver on public.fets_news_posts(approved_by);
create index news_run_recent on public.fets_news_collection_runs(completed_at desc);
create index news_posts_feed on public.fets_news_posts(state,published_at desc);
create index news_receipts_staff on public.fets_news_receipts(profile_id,post_id);
alter table public.fets_news_sources enable row level security;
alter table public.fets_news_drafts enable row level security;
alter table public.fets_news_posts enable row level security;
alter table public.fets_news_receipts enable row level security;
alter table public.fets_news_collection_runs enable row level security;
revoke all on public.fets_news_sources,public.fets_news_drafts,public.fets_news_posts,public.fets_news_receipts,public.fets_news_collection_runs from public,anon,authenticated;
grant select on public.fets_news_sources,public.fets_news_drafts,public.fets_news_posts,public.fets_news_receipts,public.fets_news_collection_runs to authenticated;
grant insert,update on public.fets_news_drafts,public.fets_news_posts to authenticated;
grant insert on public.fets_news_receipts to authenticated;
grant select,insert,update on public.fets_news_sources,public.fets_news_drafts,public.fets_news_collection_runs to service_role;
grant select on public.fets_news_posts to service_role;
grant usage,select on sequence public.fets_news_collection_runs_id_seq to service_role;
create policy news_sources_editor on public.fets_news_sources for select to authenticated using(fets_news_private.editor());
create policy news_drafts_editor on public.fets_news_drafts for all to authenticated using(fets_news_private.editor()) with check(fets_news_private.editor());
create policy news_posts_read on public.fets_news_posts for select to authenticated using(fets_news_private.can_read(document->>'branch'));
create policy news_posts_editor on public.fets_news_posts for all to authenticated using(fets_news_private.editor()) with check(fets_news_private.editor());
create policy news_receipts_read on public.fets_news_receipts for select to authenticated using(profile_id=fets_news_private.actor() or fets_news_private.editor());
create policy news_receipts_self on public.fets_news_receipts for insert to authenticated with check(profile_id=fets_news_private.actor());
create policy news_runs_editor on public.fets_news_collection_runs for select to authenticated using(fets_news_private.editor());

create function fets_news_private.validate_document(d jsonb,k text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(d)<>'object' or length(btrim(coalesce(d->>'title',''))) not between 1 and 200 or length(btrim(coalesce(d->>'summary',''))) not between 1 and 1500 or length(coalesce(d->>'body',''))>10000 or length(coalesce(d->>'action',''))>2000 or length(coalesce(d->>'why',''))>2000 then raise exception 'Enter a title, short summary and valid update text';end if;
 if coalesce(d->>'branch','') not in('global','calicut','cochin','mobile') or coalesce(d->>'priority','') not in('normal','important','urgent') or jsonb_typeof(d->'requires_ack') is distinct from 'boolean' then raise exception 'Choose an audience, priority and acknowledgement option';end if;
 if k='industry' and (d->>'requires_ack')::boolean then raise exception 'Industry awareness is not a required client instruction';end if;
 if coalesce(d->>'client_id','')<>'' and not exists(select 1 from public.clients where id=(d->>'client_id')::uuid) then raise exception 'Choose a client from the shared catalogue';end if;
 if coalesce(d->>'programme_id','')<>'' and not exists(select 1 from public.client_exams where id=(d->>'programme_id')::uuid and client_id=(d->>'client_id')::uuid) then raise exception 'Choose a programme belonging to this client';end if;
 if coalesce(d->>'expires_at','')<>'' and (d->>'expires_at')::timestamptz<=clock_timestamp() then raise exception 'The expiry time is already past';end if;
 if coalesce(d->>'effective_on','')<>'' then perform (d->>'effective_on')::date;end if;
 if coalesce(d->>'related_page','') not in('','calendar','roster','shift','case','client-directory') then raise exception 'Choose a supported existing page';end if;
 if d- array['title','summary','body','action','why','branch','client_id','programme_id','priority','requires_ack','effective_on','expires_at','related_page']::text[] <> '{}'::jsonb then raise exception 'Unexpected staff-facing field';end if;
end $$;
create function fets_news_private.source_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not fets_news_private.collector() or tg_op<>'INSERT' then raise exception 'Sources are immutable collector records' using errcode='42501';end if;
 if not fets_news_private.allowed_domain(new.domain) then raise exception 'Source domain is not approved';end if;
 if new.source_date>clock_timestamp()+interval '5 minutes' then raise exception 'A future publication is not current news';end if;
 if new.kind='industry' and new.public_url is null then raise exception 'Industry news requires its public source';end if;
 if new.public_url is not null and (new.public_url !~ '^https://[^/]+/' or lower(split_part(split_part(new.public_url,'://',2),'/',1))<>lower(new.domain) or new.public_url ~ '[[:space:]]') then raise exception 'Source URL must use the verified HTTPS domain';end if;
 new.collected_at:=clock_timestamp();return new;
end $$;
create trigger news_source_guard before insert or update or delete on public.fets_news_sources for each row execute function fets_news_private.source_guard();
create function fets_news_private.draft_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Reject drafts instead of deleting history';end if;
 if not fets_news_private.editor() and not fets_news_private.collector() then raise exception 'News review access required' using errcode='42501';end if;
 if tg_op='UPDATE' and old.status='published' then raise exception 'Create a new revision of a published update';end if;
 if tg_op='UPDATE' and (new.id,new.source_id,new.kind,new.revision_of,new.created_by,new.created_at) is distinct from (old.id,old.source_id,old.kind,old.revision_of,old.created_by,old.created_at) then raise exception 'Draft source and identity cannot be changed';end if;
 if fets_news_private.collector() and (tg_op<>'INSERT' or new.status not in('draft','review')) then raise exception 'Collection can only create unpublished drafts';end if;
 if new.status='published' and not exists(select 1 from public.fets_news_posts where draft_id=new.id) then raise exception 'Use approve and publish';end if;
 if new.kind<>'internal' and not exists(select 1 from public.fets_news_sources s where s.id=new.source_id and s.kind=new.kind) then raise exception 'External news requires its verified source';end if;
 perform fets_news_private.validate_document(new.document,new.kind);
 new.updated_at:=clock_timestamp();new.updated_by:=fets_news_private.actor();
 if tg_op='INSERT' then new.created_at:=clock_timestamp();new.created_by:=fets_news_private.actor();new.version:=1;else new.version:=old.version+1;end if;
 return new;
end $$;
create trigger news_draft_guard before insert or update or delete on public.fets_news_drafts for each row execute function fets_news_private.draft_guard();
create function fets_news_private.post_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare draft public.fets_news_drafts; src public.fets_news_sources;
begin
 if not fets_news_private.editor() or fets_news_private.collector() then raise exception 'Only your signed-in approver can publish news' using errcode='42501';end if;
 if tg_op='DELETE' then raise exception 'Withdraw news instead of deleting history';end if;
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['state','withdrawn_at','withdrawal_reason']) is distinct from (to_jsonb(old)-array['state','withdrawn_at','withdrawal_reason']) or old.state<>'live' or new.state not in('withdrawn','superseded') then raise exception 'Published content is immutable; create a reviewed revision';end if;
  if new.state='superseded' and not exists(select 1 from public.fets_news_posts where supersedes_id=old.id) then raise exception 'Publish the reviewed replacement first';end if;
  if length(btrim(new.withdrawal_reason))=0 then raise exception 'Give the reason for withdrawing or replacing this update';end if;
  new.withdrawn_at:=clock_timestamp();return new;
 end if;
 select * into draft from public.fets_news_drafts where id=new.draft_id for update;
 if draft.id is null or draft.status not in('draft','review') then raise exception 'Choose an unpublished draft';end if;
 perform fets_news_private.validate_document(draft.document,draft.kind);
 if draft.source_id is not null then select * into src from public.fets_news_sources where id=draft.source_id;end if;
 new.kind:=draft.kind;new.document:=draft.document;new.supersedes_id:=draft.revision_of;
 new.source_label:=coalesce(src.source_label,'FETS');new.source_date:=src.source_date;new.source_url:=src.public_url;
 new.approved_by:=fets_news_private.actor();new.published_at:=clock_timestamp();new.state:='live';new.withdrawn_at:=null;new.withdrawal_reason:='';
 if new.supersedes_id is not null and not exists(select 1 from public.fets_news_posts where id=new.supersedes_id and state='live') then raise exception 'The original update changed; refresh before publishing';end if;
 return new;
end $$;
create trigger news_post_guard before insert or update or delete on public.fets_news_posts for each row execute function fets_news_private.post_guard();
create function fets_news_private.receipt_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.fets_news_posts;
begin
 if tg_op<>'INSERT' or fets_news_private.actor() is null or fets_news_private.collector() then raise exception 'Acknowledgements require the actual staff account';end if;
 select * into p from public.fets_news_posts where id=new.post_id;
 if p.id is null or p.state<>'live' or not fets_news_private.can_read(p.document->>'branch') or (p.document->>'requires_ack')::boolean is not true or (coalesce(p.document->>'expires_at','')<>'' and (p.document->>'expires_at')::timestamptz<=clock_timestamp()) then raise exception 'This update is not awaiting acknowledgement';end if;
 new.profile_id:=fets_news_private.actor();new.acknowledged_at:=clock_timestamp();return new;
end $$;
create trigger news_receipt_guard before insert or update or delete on public.fets_news_receipts for each row execute function fets_news_private.receipt_guard();

create function public.fets_news_publish(p_draft uuid,p_version integer) returns uuid language plpgsql security invoker set search_path='' as $$
declare d public.fets_news_drafts;p uuid;
begin
 if not fets_news_private.editor() or fets_news_private.collector() then raise exception 'Your approval is required';end if;
 select * into d from public.fets_news_drafts where id=p_draft for update;
 if d.id is null or d.version<>p_version then raise exception 'This draft changed; review the latest version before publishing';end if;
 insert into public.fets_news_posts(draft_id,kind,document,source_label,approved_by) values(d.id,d.kind,d.document,'',fets_news_private.actor()) returning id into p;
 update public.fets_news_drafts set status='published' where id=d.id;
 if d.revision_of is not null then update public.fets_news_posts set state='superseded',withdrawal_reason='Replaced by an approved revision' where id=d.revision_of;end if;
 return p;
end $$;
create function fets_news_private.context() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s fets_news_private.settings;
begin
 if not fets_news_private.editor() and not fets_news_private.collector() then return jsonb_build_object('can_review',false);end if;
 select * into s from fets_news_private.settings where id;
 return jsonb_build_object('can_review',fets_news_private.editor(),'mailbox',s.mailbox,'client_enabled',s.client_enabled,'industry_enabled',s.industry_enabled,'domains',s.domains,'approval_required',true,'client_scheduled',s.client_task_id is not null,'industry_scheduled',s.industry_task_id is not null);
end $$;
create function public.fets_news_context() returns jsonb language sql stable security invoker set search_path='' as $$select fets_news_private.context()$$;
create function fets_news_private.set_collection(k text,enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not fets_news_private.editor() then raise exception 'News review access required';end if;
 if k='client' then update fets_news_private.settings set client_enabled=enabled where id;elsif k='industry' then update fets_news_private.settings set industry_enabled=enabled where id;else raise exception 'Unknown collection source';end if;
 return fets_news_private.context();
end $$;
create function public.fets_news_set_collection(p_kind text,p_enabled boolean) returns jsonb language sql security invoker set search_path='' as $$select fets_news_private.set_collection(p_kind,p_enabled)$$;
create function public.fets_news_collect(p_kind text,p_items jsonb,p_note text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
declare x jsonb;s uuid;added integer:=0;n integer;enabled boolean;
begin
 if not fets_news_private.collector() then raise exception 'Collector server access required' using errcode='42501';end if;
 enabled:=fets_news_private.collection_enabled(p_kind);
 if enabled is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>30 then raise exception 'Invalid collection batch';end if;
 if not enabled then insert into public.fets_news_collection_runs(kind,status,note) values(p_kind,'paused','Collection paused by the approver');return jsonb_build_object('added',0,'paused',true);end if;
 for x in select * from jsonb_array_elements(p_items) loop
  s:=null;
  insert into public.fets_news_sources(kind,external_key,source_label,domain,sender,source_date,public_url,private_reference,excerpt,verification)
  values(p_kind,x->>'key',x->>'label',x->>'domain',coalesce(x->>'sender',''),(x->>'source_date')::timestamptz,nullif(x->>'public_url',''),coalesce(x->>'private_reference',''),x->>'excerpt',x->>'verification') on conflict(kind,external_key) do nothing returning id into s;
  if s is not null then insert into public.fets_news_drafts(source_id,kind,document,status) values(s,p_kind,x->'document','review');added:=added+1;end if;
 end loop;
 insert into public.fets_news_collection_runs(kind,status,added,note) values(p_kind,'success',added,left(p_note,2000));
 return jsonb_build_object('added',added,'approval_required',true);
end $$;
-- The collector sees configuration via a narrow function, never the approver table.
grant select,insert on public.fets_news_collection_runs to service_role;
grant select,insert on public.fets_news_sources to service_role;
-- Invoker collector needs settings only via this guarded, owner-run read helper.
create function fets_news_private.collection_enabled(k text) returns boolean language sql stable security definer set search_path='' as $$select case when k='client' then client_enabled when k='industry' then industry_enabled end from fets_news_private.settings where id and fets_news_private.collector()$$;
-- Replace the direct private-settings read in the collector with the helper.

create function fets_news_private.set_domains(d text[]) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not fets_news_private.editor() then raise exception 'News review access required';end if;
 if coalesce(cardinality(d),0) not between 1 and 50 or exists(select 1 from unnest(d) x where x is null or x<>lower(btrim(x)) or x !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' or x in('gmail.com','outlook.com','hotmail.com','yahoo.com')) then raise exception 'Enter official domain names only, one per line';end if;
 update fets_news_private.settings set domains=array(select distinct x from unnest(d) x order by x) where id;
 return fets_news_private.context();
end $$;
create function public.fets_news_set_domains(p_domains text[]) returns jsonb language sql security invoker set search_path='' as $$select fets_news_private.set_domains(p_domains)$$;
revoke all on function public.fets_news_set_domains(text[]) from public,anon;
grant execute on function public.fets_news_set_domains(text[]) to authenticated;
revoke all on all functions in schema fets_news_private from public,anon;
grant execute on all functions in schema fets_news_private to authenticated,service_role;
revoke all on function public.fets_news_collect(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.fets_news_collect(text,jsonb,text) to service_role;
revoke all on function public.fets_news_context(),public.fets_news_set_collection(text,boolean),public.fets_news_publish(uuid,integer) from public,anon;
grant execute on function public.fets_news_context(),public.fets_news_set_collection(text,boolean),public.fets_news_publish(uuid,integer) to authenticated;
-- The old ticker stays readable as historical notices, but cannot bypass approval.
drop policy if exists news_ticker_access_all on public.news_ticker;
drop policy if exists "Authenticated can view active news" on public.news_ticker;
drop policy if exists "Authenticated can manage news" on public.news_ticker;
revoke insert,update,delete on public.news_ticker from public,authenticated,anon;
revoke select on public.news_ticker from public,anon;
grant select on public.news_ticker to authenticated;
create policy news_legacy_read on public.news_ticker for select to authenticated using(is_active is true and (expires_at is null or expires_at>clock_timestamp()) and fets_news_private.can_read(coalesce(branch_location,'global')));
comment on table public.fets_news_posts is 'Immutable staff-facing snapshots. Every client, industry and internal post requires the configured approver.';
