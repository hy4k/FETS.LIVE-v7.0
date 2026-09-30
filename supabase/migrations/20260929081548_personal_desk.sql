-- Personal staff data. Auth user IDs (not staff profile IDs) own every row.
create table public.desk_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cover text not null default 'peach' check (cover in ('peach', 'sage', 'lilac')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
create table public.desk_journal_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  note text not null default '' check (char_length(note) <= 2000),
  mood text not null default '' check (mood in ('', 'bright', 'steady', 'focused', 'slow')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_date)
);
create table public.desk_focus_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  duration_minutes integer not null check (duration_minutes in (25, 50)),
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index desk_focus_sessions_user_completed_idx
  on public.desk_focus_sessions (user_id, completed_at desc);

-- No staff member (including a manager) can read another person's journal.
alter table public.desk_preferences enable row level security;
alter table public.desk_journal_entries enable row level security;
alter table public.desk_focus_sessions enable row level security;
revoke all on public.desk_preferences, public.desk_journal_entries, public.desk_focus_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.desk_preferences, public.desk_journal_entries to authenticated;
grant select, insert, delete on public.desk_focus_sessions to authenticated;
grant all on public.desk_preferences, public.desk_journal_entries, public.desk_focus_sessions to service_role;

do $$
declare tab text;
begin
  foreach tab in array array['desk_preferences', 'desk_journal_entries', 'desk_focus_sessions'] loop
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', tab);
    execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', tab);
    execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', tab);
  end loop;
  foreach tab in array array['desk_preferences', 'desk_journal_entries'] loop
    execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', tab);
  end loop;
end $$;

-- Compare-and-swap prevents a stale tab/device from silently overwriting a note.
-- Invoker security preserves the table policies; the client cannot choose an owner.
create function public.desk_save_journal(p_date date, p_note text, p_mood text, p_version integer)
returns public.desk_journal_entries
language plpgsql security invoker set search_path = '' as $$
declare result public.desk_journal_entries;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to save your desk' using errcode = '28000'; end if;
  if p_version is null then
    insert into public.desk_journal_entries (user_id, entry_date, note, mood)
    values ((select auth.uid()), p_date, p_note, p_mood)
    on conflict (user_id, entry_date) do nothing returning * into result;
  else
    update public.desk_journal_entries set note = p_note, mood = p_mood, version = version + 1, updated_at = now()
    where user_id = (select auth.uid()) and entry_date = p_date and version = p_version
    returning * into result;
  end if;
  if result.user_id is null then raise exception 'This entry changed on another device. Reload before saving.' using errcode = '40001'; end if;
  return result;
end $$;

create function public.desk_save_preferences(p_cover text, p_version integer)
returns public.desk_preferences
language plpgsql security invoker set search_path = '' as $$
declare result public.desk_preferences;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to save your desk' using errcode = '28000'; end if;
  if p_version is null then
    insert into public.desk_preferences (user_id, cover) values ((select auth.uid()), p_cover)
    on conflict (user_id) do nothing returning * into result;
  else
    update public.desk_preferences set cover = p_cover, version = version + 1, updated_at = now()
    where user_id = (select auth.uid()) and version = p_version returning * into result;
  end if;
  if result.user_id is null then raise exception 'Your preferences changed on another device. Reload before saving.' using errcode = '40001'; end if;
  return result;
end $$;
revoke all on function public.desk_save_journal(date, text, text, integer) from public, anon;
revoke all on function public.desk_save_preferences(text, integer) from public, anon;
grant execute on function public.desk_save_journal(date, text, text, integer) to authenticated;
grant execute on function public.desk_save_preferences(text, integer) to authenticated;
comment on table public.desk_journal_entries is 'Private daily notes and self check-ins; visible only to their owner through the application.';
comment on table public.desk_focus_sessions is 'Personal completed focus sessions, not attendance or performance scores.';
