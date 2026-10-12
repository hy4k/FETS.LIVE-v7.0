import { supabase } from '../lib/supabase';
import type { ActionableDuty, DayTask, Responsibility, TaskStatus } from './shift-blueprint';
const db = supabase as any;
const checked = (result: any) => { if (result.error) throw new Error(result.error.message); return result.data; };

export type Person = { id: string; name: string };

export const blueprintRepository = {
  /** Everyone who works at the centre, for owners and backups. */
  async staff(branch: string): Promise<Person[]> {
    const rows = checked(await db.from('staff_profiles').select('id,full_name,branch_assigned,is_active').eq('is_active', true)) || [];
    return rows
      .filter((p: any) => p.full_name && String(p.branch_assigned || '').toLowerCase() === branch.toLowerCase())
      .map((p: any) => ({ id: p.id, name: p.full_name }))
      .sort((a: Person, b: Person) => a.name.localeCompare(b.name));
  },
  async responsibilities(branch: string): Promise<Responsibility[]> {
    return checked(await db.from('centre_responsibilities').select('*').eq('branch', branch).eq('active', true).order('area').order('position')) || [];
  },
  async saveResponsibility(value: Partial<Responsibility> & { branch: string }): Promise<Responsibility> {
    const { id, ...rest } = value;
    const query = id ? db.from('centre_responsibilities').update(rest).eq('id', id) : db.from('centre_responsibilities').insert(rest);
    return checked(await query.select().single());
  },
  async removeResponsibility(id: string) {
    // Kept for the history of past days; it simply stops appearing.
    checked(await db.from('centre_responsibilities').update({ active: false }).eq('id', id).select().single());
  },
  async seed(rows: Omit<Responsibility, 'id'>[]): Promise<Responsibility[]> {
    return checked(await db.from('centre_responsibilities').insert(rows).select()) || [];
  },
  async tasks(branch: string, day: string): Promise<DayTask[]> {
    return checked(await db.from('centre_day_tasks').select('*').eq('branch', branch).eq('day', day).order('created_at')) || [];
  },
  /** Saves a change to a task; a task due from the blueprint is created on its first change. */
  async setTask(input: { task: DayTask | null; branch: string; day: string; responsibility_id?: string | null; title: string; assigned_to: string | null; status: TaskStatus; note: string }): Promise<DayTask> {
    const { task, ...value } = input;
    if (task) return checked(await db.from('centre_day_tasks').update({ assigned_to: value.assigned_to, status: value.status, note: value.note, title: value.title }).eq('id', task.id).select().single());
    return checked(await db.from('centre_day_tasks').insert(value).select().single());
  },
  async carry(input: { from: DayTask; branch: string; day: string }): Promise<DayTask> {
    return checked(await db.from('centre_day_tasks').insert({
      branch: input.branch, day: input.day, responsibility_id: null, title: input.from.title,
      assigned_to: input.from.assigned_to, status: 'open', note: input.from.note, carried_from: input.from.id,
    }).select().single());
  },
  async removeTask(id: string) { checked(await db.from('centre_day_tasks').delete().eq('id', id)); },
  async verifyTask(task: DayTask): Promise<DayTask> {
    return checked(await db.rpc('fets_verify_day_task', { task_id: task.id, expected_done_at: task.done_at }));
  },
  /** Open Actionables duties for these people. */
  async actionables(people: string[]): Promise<ActionableDuty[]> {
    if (!people.length) return [];
    return checked(await db.from('mission_work_items')
      .select('id,title,owner_id,status,due_date,due_at,institution:expansion_institutions(name,district)')
      .in('owner_id', people).neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false })) || [];
  },
};
export type BlueprintRepository = typeof blueprintRepository;
