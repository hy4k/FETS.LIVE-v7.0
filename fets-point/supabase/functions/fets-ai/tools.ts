// tools.ts — the agent's capabilities. Provider-agnostic definitions plus a
// single executor that enforces guardrails and writes an audit row for EVERY
// call (read or write) to ai_agent_actions.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Tables the agent may never touch, even with full autonomy: its own guardrails,
// its own audit trail, and auth internals. Everything else in `public` is fair game.
const WRITE_BLOCKLIST = new Set(["ai_settings", "ai_agent_actions"]);

// Reads are broadly allowed but we still refuse obviously sensitive targets.
const READ_BLOCKLIST = new Set(["ai_settings"]);

export interface ToolContext {
  supa: SupabaseClient;         // service-role client (bypasses RLS)
  userId: string | null;
  role: string;
  conversationId: string | null;
  killSwitch: boolean;
  allowedTools: string[];       // resolved for this user's role; ['*'] = all
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;   // JSON Schema (Claude format)
  isWrite: boolean;
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "read_table",
    description:
      "Read rows from any FETS table. Use filters to narrow results. Returns up to `limit` rows. " +
      "Common tables: candidates, incidents, calendar_sessions, staff_profiles, roster_schedules, " +
      "leave_requests, notices, fets_vault, lost_found_items, clients, user_tasks, branch_status.",
    isWrite: false,
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "table name" },
        columns: { type: "string", description: "comma-separated columns, or '*'", default: "*" },
        filters: {
          type: "array",
          description: "equality/comparison filters",
          items: {
            type: "object",
            properties: {
              column: { type: "string" },
              op: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"] },
              value: {},
            },
            required: ["column", "op", "value"],
          },
        },
        order_by: { type: "string" },
        ascending: { type: "boolean", default: false },
        limit: { type: "number", default: 50 },
      },
      required: ["table"],
    },
  },
  {
    name: "aggregate",
    description: "Count rows in a table matching optional filters. Use for 'how many …' questions.",
    isWrite: false,
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: { column: { type: "string" }, op: { type: "string" }, value: {} },
            required: ["column", "op", "value"],
          },
        },
      },
      required: ["table"],
    },
  },
  {
    name: "search_memory",
    description: "Search long-term FETS memory and external knowledge for a keyword.",
    isWrite: false,
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "save_memory",
    description:
      "Persist a durable fact, pattern, preference or definition to FETS long-term memory so you recall it forever. " +
      "Use for things learned during conversation that will matter later.",
    isWrite: true,
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "short stable identifier for the fact" },
        value: { type: "string", description: "the fact itself" },
        category: { type: "string", enum: ["fact", "pattern", "preference", "definition", "contact"], default: "fact" },
        scope: { type: "string", enum: ["global", "branch", "user"], default: "global" },
        scope_ref: { type: "string", description: "branch name or user id when scope is branch/user" },
        importance: { type: "number", minimum: 1, maximum: 5, default: 3 },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "write_table",
    description:
      "Create, update or delete rows in any FETS table (autonomous write). " +
      "For update/delete you MUST provide filters identifying the target rows. " +
      "The prior row state is snapshotted for audit/undo. Prefer a typed tool (e.g. create_incident) when one exists.",
    isWrite: true,
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        operation: { type: "string", enum: ["insert", "update", "delete"] },
        values: { type: "object", description: "column→value map for insert/update" },
        filters: {
          type: "array",
          description: "required for update/delete — identifies target rows",
          items: {
            type: "object",
            properties: { column: { type: "string" }, op: { type: "string" }, value: {} },
            required: ["column", "op", "value"],
          },
        },
      },
      required: ["table", "operation"],
    },
  },
  {
    name: "create_incident",
    description: "Log a new incident. Typed convenience wrapper over the incidents table.",
    isWrite: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        severity: { type: "string", enum: ["minor", "moderate", "major", "critical"], default: "minor" },
        branch_location: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "create_notice",
    description: "Post a notice/announcement to the notices board.",
    isWrite: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string", description: "the notice body" },
        priority: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
        branch_location: { type: "string", description: "'global' or a branch name", default: "global" },
        expires_at: { type: "string", description: "ISO date; defaults to 30 days out" },
      },
      required: ["title"],
    },
  },
];

function applyFilters(q: any, filters?: Array<{ column: string; op: string; value: unknown }>) {
  for (const f of filters ?? []) {
    if (f.op === "in" && typeof f.value === "string") q = q.in(f.column, (f.value as string).split(","));
    else q = (q as any)[f.op](f.column, f.value);
  }
  return q;
}

async function audit(ctx: ToolContext, row: Record<string, unknown>) {
  try {
    await ctx.supa.from("ai_agent_actions").insert({
      user_id: ctx.userId,
      conversation_id: ctx.conversationId,
      ...row,
    });
  } catch (e) {
    console.warn("[audit] failed:", e);
  }
}

export interface ToolOutcome {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export async function executeTool(ctx: ToolContext, name: string, input: any): Promise<ToolOutcome> {
  const def = TOOL_DEFS.find((t) => t.name === name);
  if (!def) return fail(ctx, name, input, false, "Unknown tool");

  // Per-role allowlist
  const allowed = ctx.allowedTools.includes("*") || ctx.allowedTools.includes(name);
  if (!allowed) return fail(ctx, name, input, def.isWrite, `Tool '${name}' not permitted for role '${ctx.role}'`, "blocked");

  // Kill-switch blocks all writes
  if (def.isWrite && ctx.killSwitch) {
    return fail(ctx, name, input, true, "Write blocked: kill-switch is active (read-only mode)", "blocked");
  }

  try {
    switch (name) {
      case "read_table": {
        if (READ_BLOCKLIST.has(input.table)) throw new Error(`Reading '${input.table}' is not allowed`);
        let q = ctx.supa.from(input.table).select(input.columns || "*");
        q = applyFilters(q, input.filters);
        if (input.order_by) q = q.order(input.order_by, { ascending: !!input.ascending });
        q = q.limit(Math.min(input.limit ?? 50, 200));
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        await audit(ctx, { tool_name: name, tool_input: input, tool_result: { rows: data?.length ?? 0 }, is_write: false, table_affected: input.table });
        return { ok: true, result: data };
      }

      case "aggregate": {
        let q = ctx.supa.from(input.table).select("*", { count: "exact", head: true });
        q = applyFilters(q, input.filters);
        const { count, error } = await q;
        if (error) throw new Error(error.message);
        await audit(ctx, { tool_name: name, tool_input: input, tool_result: { count }, is_write: false, table_affected: input.table });
        return { ok: true, result: { count } };
      }

      case "search_memory": {
        const like = `%${input.query}%`;
        const [{ data: mem }, { data: ext }] = await Promise.all([
          ctx.supa.from("ai_memory").select("scope,category,mem_key,mem_value,importance").or(`mem_key.ilike.${like},mem_value.ilike.${like}`).limit(20),
          ctx.supa.from("ai_external_knowledge").select("title,category,content").eq("is_active", true).or(`title.ilike.${like},content.ilike.${like}`).limit(10),
        ]);
        await audit(ctx, { tool_name: name, tool_input: input, tool_result: { memory: mem?.length ?? 0, external: ext?.length ?? 0 }, is_write: false });
        return { ok: true, result: { memory: mem, external_knowledge: ext } };
      }

      case "save_memory": {
        const rec = {
          scope: input.scope || "global",
          scope_ref: input.scope_ref ?? null,
          category: input.category || "fact",
          mem_key: input.key,
          mem_value: input.value,
          importance: input.importance ?? 3,
          source: "agent",
          created_by: ctx.userId,
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        };
        const { data, error } = await ctx.supa.from("ai_memory")
          .upsert(rec, { onConflict: "scope,scope_ref,mem_key" }).select().single();
        if (error) throw new Error(error.message);
        await audit(ctx, { tool_name: name, tool_input: input, tool_result: { id: data?.id }, is_write: true, table_affected: "ai_memory", record_id: data?.id });
        return { ok: true, result: { saved: true, id: data?.id } };
      }

      case "write_table": {
        const table = input.table as string;
        if (WRITE_BLOCKLIST.has(table)) throw new Error(`Writing to '${table}' is not allowed`);
        const op = input.operation as string;

        if (op === "insert") {
          const { data, error } = await ctx.supa.from(table).insert(input.values).select();
          if (error) throw new Error(error.message);
          const id = (data as any[])?.[0]?.id;
          await audit(ctx, { tool_name: name, tool_input: input, tool_result: data, is_write: true, table_affected: table, record_id: id ? String(id) : null });
          return { ok: true, result: data };
        }

        if (op === "update" || op === "delete") {
          if (!input.filters?.length) throw new Error(`${op} requires filters identifying target rows`);
          // snapshot before-state for undo
          let snapQ = ctx.supa.from(table).select("*");
          snapQ = applyFilters(snapQ, input.filters);
          const { data: before } = await snapQ.limit(50);

          let q = ctx.supa.from(table)[op === "update" ? "update" : "delete"](op === "update" ? input.values : undefined);
          q = applyFilters(q, input.filters);
          const { data, error } = await q.select();
          if (error) throw new Error(error.message);
          await audit(ctx, {
            tool_name: name, tool_input: input, tool_result: data, is_write: true,
            table_affected: table, before_snapshot: before,
            record_id: (before as any[])?.[0]?.id ? String((before as any[])[0].id) : null,
          });
          return { ok: true, result: { affected: (data as any[])?.length ?? 0, rows: data } };
        }
        throw new Error(`Unknown operation '${op}'`);
      }

      case "create_incident": {
        const rec = {
          title: input.title,
          description: input.description ?? null,
          category: input.category ?? "general",
          severity: input.severity ?? "minor",
          status: "open",
          branch_location: input.branch_location ?? null,
          user_id: ctx.userId,
          created_at: new Date().toISOString(),
        };
        const { data, error } = await ctx.supa.from("incidents").insert(rec).select().single();
        if (error) throw new Error(error.message);
        await audit(ctx, { tool_name: name, tool_input: input, tool_result: data, is_write: true, table_affected: "incidents", record_id: data?.id ? String(data.id) : null });
        return { ok: true, result: data };
      }

      case "create_notice": {
        const rec = {
          title: input.title,
          description: input.description ?? input.content ?? null,
          priority: input.priority ?? "medium",
          branch_location: input.branch_location ?? "global",
          expires_at: input.expires_at ?? new Date(Date.now() + 30 * 864e5).toISOString(),
        };
        const { data, error } = await ctx.supa.from("notices").insert(rec).select().single();
        if (error) throw new Error(error.message);
        await audit(ctx, { tool_name: name, tool_input: input, tool_result: data, is_write: true, table_affected: "notices", record_id: data?.id ? String(data.id) : null });
        return { ok: true, result: data };
      }

      default:
        return fail(ctx, name, input, def.isWrite, "Tool not implemented");
    }
  } catch (e) {
    return fail(ctx, name, input, def.isWrite, (e as Error).message);
  }
}

async function fail(ctx: ToolContext, name: string, input: unknown, isWrite: boolean, message: string, status = "failed"): Promise<ToolOutcome> {
  await audit(ctx, { tool_name: name, tool_input: input, is_write: isWrite, status, error_message: message });
  return { ok: false, error: message };
}
