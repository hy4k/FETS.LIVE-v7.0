-- =====================================================================
-- FETS AI — Phase 1: Core memory & knowledge tables
-- =====================================================================
-- These tables are ALREADY referenced by the client code
-- (src/lib/conversationService.ts, src/lib/advancedAIService.ts) but the
-- migrations that create them were missing from the repo, so every write
-- was silently failing. This file makes the existing "memory" code work.
--
-- Safe to re-run: every statement is IF NOT EXISTS / idempotent.
-- Run this in the Supabase SQL Editor (or via scripts/apply-ai-migrations.cjs).
-- =====================================================================

-- gen_random_uuid() lives in pgcrypto (bundled with Supabase Postgres).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ai_conversations — one row per chat thread
-- ---------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  title       text not null default 'New Conversation',
  context     jsonb not null default '{}'::jsonb,
  summary     text,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_conversations_user_idx
  on public.ai_conversations (user_id, updated_at desc);

-- ---------------------------------------------------------------------
-- ai_conversation_messages — the turns inside a conversation
-- ---------------------------------------------------------------------
create table if not exists public.ai_conversation_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations(id) on delete cascade,
  role             text not null check (role in ('user','assistant','system')),
  content          text not null,
  data_references  jsonb not null default '[]'::jsonb,
  tokens_used      integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists ai_messages_conv_idx
  on public.ai_conversation_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------
-- ai_knowledge_base — AI-generated insights / learned facts
-- ---------------------------------------------------------------------
create table if not exists public.ai_knowledge_base (
  id               uuid primary key default gen_random_uuid(),
  topic            text not null,
  insight          text not null,
  source_query     text,
  source_table     text,
  confidence_score numeric not null default 0.7,
  verified         boolean not null default false,
  verified_by      uuid references auth.users(id) on delete set null,
  verified_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists ai_kb_topic_idx on public.ai_knowledge_base (topic);
create index if not exists ai_kb_verified_idx on public.ai_knowledge_base (verified, confidence_score desc);

-- ---------------------------------------------------------------------
-- ai_query_log — analytics: every question asked
-- ---------------------------------------------------------------------
create table if not exists public.ai_query_log (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  conversation_id   uuid references public.ai_conversations(id) on delete set null,
  query_text        text not null,
  response_summary  text,
  data_sources      jsonb not null default '[]'::jsonb,
  execution_time_ms integer not null default 0,
  tokens_used       integer not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists ai_query_log_user_idx on public.ai_query_log (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- ai_citations — which data points backed a given answer
-- ---------------------------------------------------------------------
create table if not exists public.ai_citations (
  id            uuid primary key default gen_random_uuid(),
  query_log_id  uuid references public.ai_query_log(id) on delete cascade,
  source_table  text,
  source_query  text,
  data_points   jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- The browser talks to these tables with the authenticated (anon-key)
-- session; the fets-ai Edge Function uses the service-role key and
-- bypasses RLS entirely. Staff are trusted internal users, so we allow
-- any authenticated user to read/write. Tighten later if needed.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'ai_conversations','ai_conversation_messages','ai_knowledge_base',
    'ai_query_log','ai_citations'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_authenticated_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t||'_authenticated_all', t
    );
  end loop;
end $$;
