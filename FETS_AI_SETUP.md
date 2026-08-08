# FETS AI — Setup & Deployment

FETS AI is now a self-sufficient, learning agent with FETS-exclusive memory and
(audited) autonomous write access. This guide gets it running.

## Architecture

```
Browser (FetsIntelligence / MobileAiChat)
   │  supabase.functions.invoke('fets-ai')  ← forwards the user's session JWT
   ▼
Supabase Edge Function  fets-ai            ← holds API keys, enforces guardrails
   ├─ context.ts   builds live-data + long-term memory + external knowledge
   ├─ tools.ts     read_table · aggregate · search_memory · save_memory
   │               · write_table · create_incident · create_notice   (+ audit log)
   └─ providers.ts Claude (tool use)  or  Gemini (function calling)
   ▼
Claude / Gemini API   +   your Supabase Postgres
```

Everything the agent reads or writes is recorded in `ai_agent_actions`.
The `ai_settings` row controls the provider, models, the kill-switch, and the
per-role tool allowlist.

## 1. Apply the database migrations

Creates the AI memory, knowledge, audit, external-knowledge and settings tables.
All migrations are idempotent (safe to re-run).

**Option A — the runner (recommended):**
```bash
# From the repo root. Connection string: Supabase Dashboard →
# Project Settings → Database → Connection string (URI)
SUPABASE_DB_URL="postgresql://postgres:<password>@db.qqewusetilxxfvfkmsed.supabase.co:5432/postgres" \
  node scripts/run-ai-migrations.mjs
```

**Option B — manual:** paste each file in `migrations/` (001 → 002 → 003) into
the Supabase SQL Editor and run them in order.

## 2. Set the model API keys as function secrets

The keys live server-side only (never shipped to the browser):
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set GEMINI_API_KEY=AIza...      # optional, for the Gemini provider
```
(Alternatively store them in the `app_config` table under keys
`anthropic_api_key` / `gemini_api_key`.)

## 3. Deploy the Edge Function

```bash
cd fets-point
supabase functions deploy fets-ai
```

## 4. Use it

Open the app → **AI** tab (bottom nav) or the mobile AI chat. Ask it anything,
or tell it to *do* something ("log an incident for the Cochin power outage",
"post a notice that Kannur closes early Friday"). Actions appear as chips under
its reply and are logged in `ai_agent_actions`.

## Controlling the agent (ai_settings, single row, id = 1)

| Column | Effect |
|---|---|
| `provider` | `claude` (default) or `gemini` |
| `claude_model` / `gemini_model` | model ids |
| `kill_switch` | `true` → agent becomes **read-only** immediately |
| `autonomous_enabled` | `false` → same effect as kill-switch (no writes) |
| `max_tool_iterations` | reasoning-loop cap (default 8) |
| `allowed_tools` | JSON map of role → allowed tool names (`"*"` = all) |

**Emergency stop:** `update ai_settings set kill_switch = true where id = 1;`

## Safety notes

- Every read and write is audited in `ai_agent_actions`, with a `before_snapshot`
  on updates/deletes so any change can be traced and reversed.
- `ai_settings` and `ai_agent_actions` are on a hard write-blocklist — the agent
  cannot rewrite its own guardrails or erase its audit trail.
- Writes are gated by the per-role `allowed_tools` map. Default: admins get all
  tools, managers get a curated write set, staff are read-only.
