-- =====================================================================
-- FETS AI — Phase 3: Agent core (memory, audit, external knowledge, settings)
-- =====================================================================
-- New tables that turn the read-only assistant into a self-sufficient,
-- learning agent with FETS-exclusive memory and full (audited) write power.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ai_memory — long-term, FETS-exclusive memory.
-- Durable facts the agent learns and should recall across every session:
-- operational patterns, preferences, definitions, recurring issues.
-- Distinct from ai_knowledge_base (which is answer-derived insights):
-- this is curated, keyed, and always loaded into context.
-- ---------------------------------------------------------------------
create table if not exists public.ai_memory (
  id           uuid primary key default gen_random_uuid(),
  scope        text not null default 'global'
                 check (scope in ('global','branch','user')),
  scope_ref    text,                       -- branch name or user id when scoped
  category     text not null default 'fact',  -- 'fact'|'pattern'|'preference'|'definition'|'contact'
  mem_key      text not null,
  mem_value    text not null,
  importance   integer not null default 3 check (importance between 1 and 5),
  source       text not null default 'agent',  -- 'agent'|'user'|'system'|'external'
  embedding    jsonb,                       -- optional number[] for semantic recall
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_used_at timestamptz,
  unique (scope, scope_ref, mem_key)
);
create index if not exists ai_memory_scope_idx on public.ai_memory (scope, scope_ref, importance desc);
create index if not exists ai_memory_key_idx on public.ai_memory (mem_key);

-- ---------------------------------------------------------------------
-- ai_agent_actions — AUDIT LOG for every tool the agent runs.
-- This is the safety net for autonomous writes: every read and (crucially)
-- every write is recorded with enough detail to trace and reverse it.
-- ---------------------------------------------------------------------
create table if not exists public.ai_agent_actions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  conversation_id  uuid references public.ai_conversations(id) on delete set null,
  tool_name        text not null,
  tool_input       jsonb not null default '{}'::jsonb,
  tool_result      jsonb,
  status           text not null default 'executed'
                     check (status in ('executed','failed','blocked','reverted')),
  is_write         boolean not null default false,
  table_affected   text,
  record_id        text,
  before_snapshot  jsonb,       -- prior row state, so a write can be undone
  error_message    text,
  created_at       timestamptz not null default now()
);
create index if not exists ai_actions_time_idx on public.ai_agent_actions (created_at desc);
create index if not exists ai_actions_write_idx on public.ai_agent_actions (is_write, created_at desc);
create index if not exists ai_actions_table_idx on public.ai_agent_actions (table_affected, record_id);

-- ---------------------------------------------------------------------
-- ai_external_knowledge — external information fed to the agent.
-- Documents, policies, SOPs, vendor rules, anything not in the operational
-- tables. Loaded into context so the agent reasons over it too.
-- ---------------------------------------------------------------------
create table if not exists public.ai_external_knowledge (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  category    text not null default 'general',
  source_url  text,
  tags        text[] not null default '{}',
  is_active   boolean not null default true,
  embedding   jsonb,
  added_by    uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_ext_active_idx on public.ai_external_knowledge (is_active, category);

-- ---------------------------------------------------------------------
-- ai_settings — single-row config for the agent.
-- provider toggle (claude|gemini), model, autonomy + kill-switch,
-- and the per-role tool allowlist enforced server-side.
-- ---------------------------------------------------------------------
create table if not exists public.ai_settings (
  id                  integer primary key default 1 check (id = 1),
  provider            text not null default 'claude' check (provider in ('claude','gemini')),
  claude_model        text not null default 'claude-sonnet-4-6',
  gemini_model        text not null default 'gemini-1.5-flash',
  autonomous_enabled  boolean not null default true,   -- allow writes without approval
  kill_switch         boolean not null default false,  -- when true, agent is READ-ONLY
  max_tool_iterations integer not null default 8,
  -- role -> list of allowed tool names. '*' means all tools.
  allowed_tools       jsonb not null default '{
    "super_admin": ["*"],
    "admin": ["*"],
    "manager": ["read_table","aggregate","search_memory","save_memory",
                "create_incident","update_incident","create_notice",
                "create_task","create_session"],
    "staff": ["read_table","aggregate","search_memory"]
  }'::jsonb,
  updated_by          uuid references auth.users(id) on delete set null,
  updated_at          timestamptz not null default now()
);

-- Seed the single settings row.
insert into public.ai_settings (id) values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- RLS
-- Memory / external knowledge / audit / settings are readable by any
-- authenticated staff member. Writes to settings & audit happen through
-- the service-role Edge Function; we still allow authenticated writes to
-- memory/external so the UI can curate them.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'ai_memory','ai_agent_actions','ai_external_knowledge','ai_settings'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t||'_auth_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true);',
      t||'_auth_read', t
    );
  end loop;

  -- Curation writes allowed from the client for memory + external knowledge.
  foreach t in array array['ai_memory','ai_external_knowledge'] loop
    execute format('drop policy if exists %I on public.%I;', t||'_auth_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t||'_auth_write', t
    );
  end loop;
end $$;
