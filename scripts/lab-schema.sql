-- ============================================================
-- The Lab — phase 2 schema
-- Multi-emoji reactions, threaded comments, and read receipts.
-- Posts continue to live in the existing public.social_posts table;
-- these tables add the engagement + unread layer with clean RLS.
--
-- Apply with EITHER:
--   1) Supabase Dashboard -> SQL Editor -> paste this file -> Run
--   2) SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/run-sql.js --query "$(cat scripts/lab-schema.sql)"
-- (post_id is TEXT and unconstrained so it works regardless of social_posts.id type.)
-- ============================================================

-- ---- multi-emoji reactions ----
create table if not exists public.lab_reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    text not null,
  user_id    uuid not null default auth.uid(),
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);
create index if not exists lab_reactions_post_idx on public.lab_reactions (post_id);
alter table public.lab_reactions enable row level security;
drop policy if exists lab_reactions_select on public.lab_reactions;
create policy lab_reactions_select on public.lab_reactions for select to authenticated using (true);
drop policy if exists lab_reactions_insert on public.lab_reactions;
create policy lab_reactions_insert on public.lab_reactions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists lab_reactions_delete on public.lab_reactions;
create policy lab_reactions_delete on public.lab_reactions for delete to authenticated using (user_id = auth.uid());

-- ---- threaded comments ----
create table if not exists public.lab_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     text not null,
  user_id     uuid not null default auth.uid(),
  author_name text,
  content     text not null,
  mentions    text[] default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists lab_comments_post_idx on public.lab_comments (post_id);
alter table public.lab_comments enable row level security;
drop policy if exists lab_comments_select on public.lab_comments;
create policy lab_comments_select on public.lab_comments for select to authenticated using (true);
drop policy if exists lab_comments_insert on public.lab_comments;
create policy lab_comments_insert on public.lab_comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists lab_comments_delete on public.lab_comments;
create policy lab_comments_delete on public.lab_comments for delete to authenticated using (user_id = auth.uid());

-- ---- read receipts / unread badge (one row per user) ----
create table if not exists public.lab_reads (
  user_id      uuid primary key default auth.uid(),
  last_seen_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.lab_reads enable row level security;
drop policy if exists lab_reads_select on public.lab_reads;
create policy lab_reads_select on public.lab_reads for select to authenticated using (user_id = auth.uid());
drop policy if exists lab_reads_insert on public.lab_reads;
create policy lab_reads_insert on public.lab_reads for insert to authenticated with check (user_id = auth.uid());
drop policy if exists lab_reads_update on public.lab_reads;
create policy lab_reads_update on public.lab_reads for update to authenticated using (user_id = auth.uid());
