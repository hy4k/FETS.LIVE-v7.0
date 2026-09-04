/**
 * Gemini Live Function Calling — tool declarations + Supabase query handlers.
 * 9 tools for on-demand historical lookups Gemini can invoke mid-conversation.
 */

import { supabase } from './supabase';

const MAX_ROWS = 50;

/** Gemini function declaration schema (matches google.ai.generativelanguage format) */
export function getToolDeclarations() {
  return [
    {
      functionDeclarations: [
        {
          name: 'query_sessions',
          description: 'Query exam sessions from the calendar. Use for looking up sessions on specific dates, by branch, or by exam/vendor name.',
          parameters: {
            type: 'OBJECT',
            properties: {
              date: { type: 'STRING', description: 'Date in YYYY-MM-DD format' },
              date_from: { type: 'STRING', description: 'Start date for range query (YYYY-MM-DD)' },
              date_to: { type: 'STRING', description: 'End date for range query (YYYY-MM-DD)' },
              branch: { type: 'STRING', description: 'Branch: calicut or cochin' },
              exam_name: { type: 'STRING', description: 'Exam name to search (partial match)' },
            },
          },
        },
        {
          name: 'query_roster',
          description: 'Query staff roster schedules. Use for checking who was/is/will be on duty on a specific date or date range.',
          parameters: {
            type: 'OBJECT',
            properties: {
              date: { type: 'STRING', description: 'Date in YYYY-MM-DD format' },
              date_from: { type: 'STRING', description: 'Start date (YYYY-MM-DD)' },
              date_to: { type: 'STRING', description: 'End date (YYYY-MM-DD)' },
              branch: { type: 'STRING', description: 'Branch: calicut or cochin' },
              staff_name: { type: 'STRING', description: 'Staff member name (partial match)' },
            },
          },
        },
        {
          name: 'query_candidates',
          description: 'Search candidate records by name, exam, or date.',
          parameters: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING', description: 'Candidate name (partial match)' },
              exam_name: { type: 'STRING', description: 'Exam name (partial match)' },
              date: { type: 'STRING', description: 'Exam date (YYYY-MM-DD)' },
              branch: { type: 'STRING', description: 'Branch: calicut or cochin' },
            },
          },
        },
        {
          name: 'query_incidents',
          description: 'Query incident/case history. Look up past incidents by status, category, severity, or date range.',
          parameters: {
            type: 'OBJECT',
            properties: {
              status: { type: 'STRING', description: 'Filter by status: open, progress, resolved' },
              category: { type: 'STRING', description: 'Incident category (partial match)' },
              priority: { type: 'STRING', description: 'Severity level (partial match)' },
              date_from: { type: 'STRING', description: 'Start date (YYYY-MM-DD)' },
              date_to: { type: 'STRING', description: 'End date (YYYY-MM-DD)' },
              branch: { type: 'STRING', description: 'Branch: calicut or cochin' },
            },
          },
        },
        {
          name: 'query_attendance',
          description: 'Query staff attendance records (check-in/check-out times, status). Can look up by staff name or date range.',
          parameters: {
            type: 'OBJECT',
            properties: {
              staff_name: { type: 'STRING', description: 'Staff member name' },
              date: { type: 'STRING', description: 'Specific date (YYYY-MM-DD)' },
              date_from: { type: 'STRING', description: 'Start date (YYYY-MM-DD)' },
              date_to: { type: 'STRING', description: 'End date (YYYY-MM-DD)' },
            },
          },
        },
        {
          name: 'query_duty_log',
          description: 'Query daily duty log entries for shift completion records.',
          parameters: {
            type: 'OBJECT',
            properties: {
              date: { type: 'STRING', description: 'Date (YYYY-MM-DD)' },
              date_from: { type: 'STRING', description: 'Start date (YYYY-MM-DD)' },
              date_to: { type: 'STRING', description: 'End date (YYYY-MM-DD)' },
              branch: { type: 'STRING', description: 'Branch: calicut or cochin' },
            },
          },
        },
        {
          name: 'query_handover_notes',
          description: 'Query shift handover notes between staff for operational continuity.',
          parameters: {
            type: 'OBJECT',
            properties: {
              date: { type: 'STRING', description: 'Date (YYYY-MM-DD)' },
              date_from: { type: 'STRING', description: 'Start date (YYYY-MM-DD)' },
              date_to: { type: 'STRING', description: 'End date (YYYY-MM-DD)' },
              branch: { type: 'STRING', description: 'Branch: calicut or cochin' },
            },
          },
        },
        {
          name: 'query_leave_requests',
          description: 'Query leave and shift swap requests. Filter by status, staff, or date.',
          parameters: {
            type: 'OBJECT',
            properties: {
              status: { type: 'STRING', description: 'Filter: pending, approved, rejected' },
              staff_name: { type: 'STRING', description: 'Staff name (partial match)' },
              date_from: { type: 'STRING', description: 'Start date (YYYY-MM-DD)' },
              date_to: { type: 'STRING', description: 'End date (YYYY-MM-DD)' },
            },
          },
        },
        {
          name: 'query_staff_profiles',
          description: 'Search the staff directory by name, role, or branch.',
          parameters: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING', description: 'Staff name (partial match)' },
              role: { type: 'STRING', description: 'Role filter (partial match)' },
              branch: { type: 'STRING', description: 'Branch: calicut or cochin' },
              active_only: { type: 'BOOLEAN', description: 'Only active staff (default true)' },
            },
          },
        },
      ],
    },
  ];
}

/** Resolves a staff name to a profile ID using the in-memory lookup */
function resolveStaffId(name: string): string | null {
  const F = (window as any).FETS;
  if (!F?._staffIdByName) return null;

  // Exact match first
  if (F._staffIdByName[name]) return F._staffIdByName[name];

  // Case-insensitive partial match
  const lower = name.toLowerCase();
  for (const [fullName, id] of Object.entries(F._staffIdByName)) {
    if (fullName.toLowerCase().includes(lower)) return id as string;
  }
  return null;
}

/** Execute a tool call and return the result object */
export async function executeToolCall(
  name: string,
  args: Record<string, any>
): Promise<Record<string, any>> {
  try {
    switch (name) {
      case 'query_sessions':
        return await querySessions(args);
      case 'query_roster':
        return await queryRoster(args);
      case 'query_candidates':
        return await queryCandidates(args);
      case 'query_incidents':
        return await queryIncidents(args);
      case 'query_attendance':
        return await queryAttendance(args);
      case 'query_duty_log':
        return await queryDutyLog(args);
      case 'query_handover_notes':
        return await queryHandoverNotes(args);
      case 'query_leave_requests':
        return await queryLeaveRequests(args);
      case 'query_staff_profiles':
        return await queryStaffProfiles(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    console.error(`[GeminiTools] ${name} error:`, err);
    return { error: err?.message || 'Query failed' };
  }
}

// ─── Tool implementations ───────────────────────────────────────────────────

async function querySessions(args: Record<string, any>) {
  let q = supabase
    .from('calendar_sessions')
    .select('id, date, client_name, exam_name, candidate_count, start_time, end_time, branch_location')
    .order('date', { ascending: false })
    .limit(MAX_ROWS);

  if (args.date) q = q.eq('date', args.date);
  if (args.date_from) q = q.gte('date', args.date_from);
  if (args.date_to) q = q.lte('date', args.date_to);
  if (args.branch) q = q.ilike('branch_location', `%${args.branch}%`);
  if (args.exam_name) q = q.ilike('exam_name', `%${args.exam_name}%`);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { sessions: data, count: data?.length || 0 };
}

async function queryRoster(args: Record<string, any>) {
  let q = supabase
    .from('roster_schedules')
    .select('date, shift_code, overtime_hours, branch_location, staff_profiles(full_name, branch_assigned)')
    .order('date', { ascending: false })
    .limit(MAX_ROWS);

  if (args.date) q = q.eq('date', args.date);
  if (args.date_from) q = q.gte('date', args.date_from);
  if (args.date_to) q = q.lte('date', args.date_to);
  if (args.branch) q = q.ilike('branch_location', `%${args.branch}%`);

  if (args.staff_name) {
    const profileId = resolveStaffId(args.staff_name);
    if (profileId) {
      q = q.eq('profile_id', profileId);
    }
  }

  const { data, error } = await q;
  if (error) return { error: error.message };

  const rows = (data || []).map((r: any) => ({
    date: r.date,
    staff: r.staff_profiles?.full_name || 'Unknown',
    shift: r.shift_code,
    overtime_hours: r.overtime_hours,
    branch: r.branch_location || r.staff_profiles?.branch_assigned,
  }));
  return { roster: rows, count: rows.length };
}

async function queryCandidates(args: Record<string, any>) {
  let q = supabase
    .from('candidates')
    .select('id, full_name, exam_name, exam_date, branch_location, status, check_in_time, client_name, confirmation_number')
    .order('exam_date', { ascending: false })
    .limit(MAX_ROWS);

  if (args.name) q = q.ilike('full_name', `%${args.name}%`);
  if (args.exam_name) q = q.ilike('exam_name', `%${args.exam_name}%`);
  if (args.date) q = q.gte('exam_date', args.date + 'T00:00:00').lte('exam_date', args.date + 'T23:59:59');
  if (args.branch) q = q.ilike('branch_location', `%${args.branch}%`);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { candidates: data, count: data?.length || 0 };
}

async function queryIncidents(args: Record<string, any>) {
  let q = supabase
    .from('incidents')
    .select('id, title, category, severity, status, branch_location, assigned_to, reporter, created_at, description')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (args.status) {
    const s = args.status.toLowerCase();
    if (s === 'open') q = q.eq('status', 'open');
    else if (s === 'progress') q = q.ilike('status', '%progress%');
    else if (s === 'resolved') q = q.or('status.ilike.%resolv%,status.ilike.%close%,status.ilike.%done%');
  }
  if (args.category) q = q.ilike('category', `%${args.category}%`);
  if (args.priority) q = q.ilike('severity', `%${args.priority}%`);
  if (args.date_from) q = q.gte('created_at', args.date_from);
  if (args.date_to) q = q.lte('created_at', args.date_to + 'T23:59:59');
  if (args.branch) q = q.ilike('branch_location', `%${args.branch}%`);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { incidents: data, count: data?.length || 0 };
}

async function queryAttendance(args: Record<string, any>) {
  let q = supabase
    .from('staff_attendance')
    .select('id, staff_id, date, check_in, check_out, status, notes')
    .order('date', { ascending: false })
    .limit(MAX_ROWS);

  if (args.staff_name) {
    const profileId = resolveStaffId(args.staff_name);
    if (profileId) {
      q = q.eq('staff_id', profileId);
    }
  }
  if (args.date) q = q.eq('date', args.date);
  if (args.date_from) q = q.gte('date', args.date_from);
  if (args.date_to) q = q.lte('date', args.date_to);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { attendance: data, count: data?.length || 0 };
}

async function queryDutyLog(args: Record<string, any>) {
  let q = supabase
    .from('duty_daily_log')
    .select('*')
    .order('date', { ascending: false })
    .limit(MAX_ROWS);

  if (args.date) q = q.eq('date', args.date);
  if (args.date_from) q = q.gte('date', args.date_from);
  if (args.date_to) q = q.lte('date', args.date_to);
  if (args.branch) q = q.ilike('branch', `%${args.branch}%`);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { duty_logs: data, count: data?.length || 0 };
}

async function queryHandoverNotes(args: Record<string, any>) {
  let q = supabase
    .from('handover_notes')
    .select('id, author, content, tagged_staff, centers, created_at, created_by')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (args.date) q = q.gte('created_at', args.date + 'T00:00:00').lte('created_at', args.date + 'T23:59:59');
  if (args.date_from) q = q.gte('created_at', args.date_from + 'T00:00:00');
  if (args.date_to) q = q.lte('created_at', args.date_to + 'T23:59:59');
  if (args.branch) q = q.contains('centers', [args.branch]);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { handover_notes: data, count: data?.length || 0 };
}

async function queryLeaveRequests(args: Record<string, any>) {
  let q = supabase
    .from('leave_requests')
    .select('id, user_id, request_type, requested_date, swap_date, reason, status, created_at, swap_with_user_id')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  if (args.status) q = q.ilike('status', `%${args.status}%`);
  if (args.date_from) q = q.gte('requested_date', args.date_from);
  if (args.date_to) q = q.lte('requested_date', args.date_to);

  if (args.staff_name) {
    const profileId = resolveStaffId(args.staff_name);
    if (profileId) {
      q = q.eq('user_id', profileId);
    }
  }

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { leave_requests: data, count: data?.length || 0 };
}

async function queryStaffProfiles(args: Record<string, any>) {
  let q = supabase
    .from('staff_profiles')
    .select('id, full_name, email, role, branch_assigned, is_active, joining_date')
    .order('full_name');

  if (args.name) q = q.ilike('full_name', `%${args.name}%`);
  if (args.role) q = q.ilike('role', `%${args.role}%`);
  if (args.branch) q = q.ilike('branch_assigned', `%${args.branch}%`);
  if (args.active_only !== false) q = q.eq('is_active', true);

  q = q.limit(MAX_ROWS);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { staff: data, count: data?.length || 0 };
}
