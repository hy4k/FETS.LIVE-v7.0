// context.ts — assembles everything the agent should "know" before reasoning:
//   1. a compact live snapshot of FETS operational data
//   2. long-term FETS-exclusive memory (ai_memory)
//   3. active external knowledge (ai_external_knowledge)
//   4. recent conversation history
// Kept deliberately compact to stay within token limits; the agent can pull
// more via the read_table / aggregate tools when it needs detail.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

async function safe<T>(p: PromiseLike<{ data: T; error: unknown }>, label: string): Promise<T | any[]> {
  try {
    const { data, error } = await p;
    if (error) {
      console.warn(`[context] ${label}:`, (error as any)?.message ?? error);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.warn(`[context] ${label} threw:`, e);
    return [];
  }
}

export interface FetsContext {
  today: string;
  liveSnapshot: Record<string, unknown>;
  memory: Array<{ scope: string; category: string; key: string; value: string; importance: number }>;
  externalKnowledge: Array<{ title: string; category: string; content: string }>;
}

export async function buildContext(
  supa: SupabaseClient,
  opts: { branch?: string | null } = {},
): Promise<FetsContext> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const thirtyAgo = new Date(now.getTime() - 30 * 864e5).toISOString().split("T")[0];

  const [
    incidents,
    candidates,
    recentSessions,
    futureSessions,
    staff,
    onlineStaff,
    notices,
    leaves,
    branchStatus,
    memoryRows,
    external,
  ] = await Promise.all([
    safe(supa.from("incidents").select("title,status,severity,created_at").gte("created_at", thirtyAgo).order("created_at", { ascending: false }).limit(50), "incidents"),
    safe(supa.from("candidates").select("exam_name,status,exam_date,branch_location"), "candidates"),
    safe(supa.from("calendar_sessions").select("date,exam_type,branch_location,capacity").gte("date", thirtyAgo).lte("date", today).order("date", { ascending: false }).limit(100), "recent_sessions"),
    safe(supa.from("calendar_sessions").select("date,exam_type,branch_location,capacity").gte("date", today).order("date", { ascending: true }).limit(50), "future_sessions"),
    safe(supa.from("staff_profiles").select("full_name,role,branch_assigned,is_online"), "staff"),
    safe(supa.from("staff_profiles").select("full_name,role").eq("is_online", true), "online_staff"),
    safe(supa.from("notices").select("title,created_at").order("created_at", { ascending: false }).limit(10), "notices"),
    safe(supa.from("leave_requests").select("status,requested_date").gte("requested_date", thirtyAgo), "leaves"),
    safe(supa.from("branch_status").select("*"), "branch_status"),
    safe(
      supa.from("ai_memory").select("scope,scope_ref,category,mem_key,mem_value,importance")
        .or(`scope.eq.global${opts.branch ? `,and(scope.eq.branch,scope_ref.eq.${opts.branch})` : ""}`)
        .order("importance", { ascending: false }).limit(80),
      "memory",
    ),
    safe(supa.from("ai_external_knowledge").select("title,category,content").eq("is_active", true).limit(40), "external"),
  ]);

  const byExam = (rows: any[]) =>
    rows.reduce((acc: Record<string, number>, c: any) => {
      const k = c.exam_name || c.exam_type || "Unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

  const liveSnapshot = {
    metadata: { today, generated_at: now.toISOString() },
    counts: {
      candidates_total: (candidates as any[]).length,
      incidents_30d: (incidents as any[]).length,
      open_incidents: (incidents as any[]).filter((i) => i.status !== "closed").length,
      staff_total: (staff as any[]).length,
      online_staff: (onlineStaff as any[]).length,
      upcoming_sessions: (futureSessions as any[]).length,
      pending_leaves: (leaves as any[]).filter((l) => l.status === "pending").length,
    },
    candidates_by_exam: byExam(candidates as any[]),
    upcoming_sessions: (futureSessions as any[]).slice(0, 15),
    recent_incidents: (incidents as any[]).slice(0, 10),
    recent_notices: (notices as any[]).slice(0, 5),
    online_staff: (onlineStaff as any[]).map((s) => s.full_name),
    branch_status: branchStatus,
  };

  return {
    today,
    liveSnapshot,
    memory: (memoryRows as any[]).map((m) => ({
      scope: m.scope, category: m.category, key: m.mem_key, value: m.mem_value, importance: m.importance,
    })),
    externalKnowledge: (external as any[]).map((e) => ({ title: e.title, category: e.category, content: e.content })),
  };
}

export function renderSystemPrompt(ctx: FetsContext, user: { name: string; role: string }, killSwitch: boolean): string {
  const memoryBlock = ctx.memory.length
    ? ctx.memory.map((m) => `- [${m.scope}/${m.category}] ${m.key}: ${m.value}`).join("\n")
    : "(no long-term memory recorded yet)";
  const externalBlock = ctx.externalKnowledge.length
    ? ctx.externalKnowledge.map((e) => `### ${e.title} (${e.category})\n${e.content}`).join("\n\n")
    : "(no external knowledge loaded)";

  return `You are FETS AI — the central operational intelligence and autonomous agent of the FETS.LIVE ecosystem.

[ORGANIZATION]
FETS is a premier examination-center network with branches in Calicut, Cochin and Kannur, India.
Exams conducted: Prometric (CMA US, CIA, CPA, EA), Pearson VUE (CELPIP, PTE), PSI.
Synonyms: CMA US = CMA USA = CMA = Certified Management Accountant. CIA = Certified Internal Auditor.
CPA = Certified Public Accountant. EA = Enrolled Agent. CELPIP = Canadian English Language Proficiency Index.

[WHO YOU ARE TALKING TO]
Operator: ${user.name} (role: ${user.role}). Today: ${ctx.today}.

[YOUR NATURE]
You are not a read-only assistant. You have tools to READ any operational data and to WRITE
changes (create/update records, log incidents, post notices, schedule sessions, etc.).
${killSwitch
      ? "⚠️ KILL-SWITCH ACTIVE: you are currently READ-ONLY. Do not attempt writes; explain that write mode is disabled."
      : "You may take actions autonomously when the user's intent is clear. Prefer the most specific tool. After acting, state plainly what you changed."}

[HOW TO WORK]
- Use tools to get ground truth; never invent numbers. The snapshot below is a starting point, not the whole database.
- When you learn a durable fact, pattern, or preference about FETS operations, call save_memory so you remember it forever.
- Be concise and direct. Lead with the answer/result, then supporting detail. Use bullet points and real numbers.
- If a request is ambiguous or destructive at scale, ask one clarifying question before acting.

[LONG-TERM FETS MEMORY]
${memoryBlock}

[EXTERNAL KNOWLEDGE]
${externalBlock}

[LIVE OPERATIONAL SNAPSHOT]
${JSON.stringify(ctx.liveSnapshot, null, 2)}`;
}
