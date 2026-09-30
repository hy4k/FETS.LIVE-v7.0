-- FETS AI uses trusted duty membership and the caller's RLS, never browser profile roles.
begin;
do $$ begin
 if to_regclass('public.centre_duty_members') is null then raise exception 'Run complete_workspace_setup.sql first'; end if;
end $$;
-- Preserve approved guides and usage if the earlier draft SQL was already run.
do $$ begin
 if to_regclass('public.sita_documents') is not null then
  if to_regclass('public.fets_ai_documents') is not null then raise exception 'Both old and new AI knowledge tables exist; merge them before continuing'; end if;
  alter table public.sita_documents rename to fets_ai_documents;
 end if;
 if to_regclass('public.sita_usage') is not null then
  if to_regclass('public.fets_ai_usage') is not null then raise exception 'Both old and new AI usage tables exist; merge them before continuing'; end if;
  alter table public.sita_usage rename to fets_ai_usage;
 end if;
 if to_regprocedure('public.sita_reserve_usage(text)') is not null and to_regprocedure('public.fets_ai_reserve_usage(text)') is null then
  alter function public.sita_reserve_usage(text) rename to fets_ai_reserve_usage;
 end if;
 if to_regprocedure('fets_duty_private.sita_document_version()') is not null and to_regprocedure('fets_duty_private.fets_ai_document_version()') is null then
  alter function fets_duty_private.sita_document_version() rename to fets_ai_document_version;
 end if;
end $$;
alter index if exists public.sita_documents_search rename to fets_ai_documents_search;
alter index if exists public.sita_documents_scope rename to fets_ai_documents_scope;
alter index if exists public.sita_documents_author rename to fets_ai_documents_author;
alter index if exists public.sita_usage_user_time rename to fets_ai_usage_user_time;
create table if not exists public.fets_ai_documents (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 3 and 200),
 content text not null check(length(content) between 20 and 30000),
 branch text not null default '*' check(branch=lower(branch) and length(branch) between 1 and 80),
 source_url text check(source_url is null or source_url ~ '^https://'),
 status text not null default 'published' check(status in ('published','archived')),
 version integer not null default 1,
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 search_text tsvector generated always as (to_tsvector('english',coalesce(title,'')||' '||coalesce(content,''))) stored
);
create index if not exists fets_ai_documents_search on public.fets_ai_documents using gin(search_text);
create index if not exists fets_ai_documents_scope on public.fets_ai_documents(branch,status);
create index if not exists fets_ai_documents_author on public.fets_ai_documents(updated_by);
alter table public.fets_ai_documents enable row level security;
revoke all on public.fets_ai_documents from public,anon,authenticated;
grant select,insert,update on public.fets_ai_documents to authenticated;
drop policy if exists sita_document_read on public.fets_ai_documents;
drop policy if exists sita_document_insert on public.fets_ai_documents;
drop policy if exists sita_document_update on public.fets_ai_documents;
drop policy if exists fets_ai_document_read on public.fets_ai_documents;
create policy fets_ai_document_read on public.fets_ai_documents for select to authenticated using (
 fets_duty_private.is_admin() or (status='published' and exists(select 1 from public.centre_duty_members where user_id=(select auth.uid())) and (branch='*' or fets_duty_private.can_read(branch)))
);
drop policy if exists fets_ai_document_insert on public.fets_ai_documents;
create policy fets_ai_document_insert on public.fets_ai_documents for insert to authenticated with check(fets_duty_private.is_admin() and updated_by=(select auth.uid()));
drop policy if exists fets_ai_document_update on public.fets_ai_documents;
create policy fets_ai_document_update on public.fets_ai_documents for update to authenticated using(fets_duty_private.is_admin()) with check(fets_duty_private.is_admin() and updated_by=(select auth.uid()));
create or replace function fets_duty_private.fets_ai_document_version() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();
 if tg_op='UPDATE' then new.version:=old.version+1; else new.version:=1; end if;return new;
end $$;
drop trigger if exists sita_document_version on public.fets_ai_documents;
drop trigger if exists fets_ai_document_version on public.fets_ai_documents;
create trigger fets_ai_document_version before insert or update on public.fets_ai_documents for each row execute function fets_duty_private.fets_ai_document_version();

-- Minimal usage ledger: no audio, screenshots, prompts or private conversation text.
create table if not exists public.fets_ai_usage (
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('chat','live-token','tool')),created_at timestamptz not null default clock_timestamp()
);
create index if not exists fets_ai_usage_user_time on public.fets_ai_usage(user_id,created_at desc);
alter table public.fets_ai_usage enable row level security;
revoke all on public.fets_ai_usage from public,anon,authenticated;
grant select,insert on public.fets_ai_usage to authenticated;
drop policy if exists fets_ai_usage_read on public.fets_ai_usage;
create policy fets_ai_usage_read on public.fets_ai_usage for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists fets_ai_usage_insert on public.fets_ai_usage;
create policy fets_ai_usage_insert on public.fets_ai_usage for insert to authenticated with check(user_id=(select auth.uid()));
create or replace function public.fets_ai_reserve_usage(request_kind text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;begin
 if auth.uid() is null or not exists(select 1 from public.centre_duty_members where user_id=auth.uid()) then raise exception 'FETS AI requires trusted staff membership';end if;
 if request_kind not in ('chat','live-token','tool') then raise exception 'Invalid request kind';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,441));
 if (select count(*) from public.fets_ai_usage where user_id=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=120 then raise exception 'FETS AI hourly request limit reached. Please try again later.';end if;
 if request_kind='live-token' and (select count(*) from public.fets_ai_usage where user_id=auth.uid() and kind='live-token' and created_at>clock_timestamp()-interval '1 hour')>=10 then raise exception 'FETS AI live-session limit reached. Please try again later.';end if;
 insert into public.fets_ai_usage(user_id,kind) values(auth.uid(),request_kind) returning id into result;return result;
end $$;
revoke all on function public.fets_ai_reserve_usage(text) from public,anon;
grant execute on function public.fets_ai_reserve_usage(text) to authenticated;
notify pgrst,'reload schema';
commit;
select 'FETS AI DATABASE READY — deploy fets-ai-agent with GEMINI_API_KEY next' as result;
