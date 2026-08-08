-- =====================================================================
-- FETS AI — Phase 2: Advanced tables (embeddings, verification, engagement)
-- =====================================================================
-- Referenced by src/lib/advancedAIService.ts (semantic search, knowledge
-- verification workflow, longitudinal analytics). Embeddings are stored as
-- jsonb float arrays and compared with cosine similarity in JS, so no
-- pgvector extension is required.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ai_embeddings — vector store for semantic search over content
-- ---------------------------------------------------------------------
create table if not exists public.ai_embeddings (
  id            uuid primary key default gen_random_uuid(),
  content_id    text,
  content_type  text,               -- 'conversation' | 'knowledge' | 'document' | ...
  content       text,
  embedding     jsonb not null default '[]'::jsonb,   -- number[]
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists ai_embeddings_type_idx on public.ai_embeddings (content_type);

-- ---------------------------------------------------------------------
-- ai_verification_requests — human review queue for AI insights
-- ---------------------------------------------------------------------
create table if not exists public.ai_verification_requests (
  id            uuid primary key default gen_random_uuid(),
  knowledge_id  uuid references public.ai_knowledge_base(id) on delete cascade,
  topic         text,
  insight       text,
  status        text not null default 'pending'
                  check (status in ('pending','verified','rejected','needs_review')),
  requested_by  uuid references auth.users(id) on delete set null,
  verified_by   uuid references auth.users(id) on delete set null,
  verified_at   timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists ai_verif_status_idx on public.ai_verification_requests (status, created_at desc);

-- ---------------------------------------------------------------------
-- ai_user_engagement — per-user usage rollup (longitudinal analysis)
-- ---------------------------------------------------------------------
create table if not exists public.ai_user_engagement (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  day           date not null default current_date,
  query_count   integer not null default 0,
  action_count  integer not null default 0,
  tokens_used   integer not null default 0,
  updated_at    timestamptz not null default now(),
  unique (user_id, day)
);

-- ---------------------------------------------------------------------
-- ai_insights_generated — audit of insights the AI proposed over time
-- ---------------------------------------------------------------------
create table if not exists public.ai_insights_generated (
  id            uuid primary key default gen_random_uuid(),
  topic         text,
  insight       text,
  source_query  text,
  confidence    numeric not null default 0.7,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'ai_embeddings','ai_verification_requests','ai_user_engagement','ai_insights_generated'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_authenticated_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t||'_authenticated_all', t
    );
  end loop;
end $$;
