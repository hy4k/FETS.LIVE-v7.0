import { describe, expect, it } from 'vitest';
import { TEMPLATE, actionablesDue, dayList, draftReport, dueOn, frequencyLabel, nextDay, progress, reportText, stand, type DayTask, type Responsibility } from './shift-blueprint';

const job = (id: string, extra: Partial<Responsibility> = {}): Responsibility => ({ id, branch: 'calicut', area: 'office', title: `Job ${id}`, details: '', frequency: 'daily', weekday: null, monthday: null, owner_id: 'a', backup_id: 'b', position: 0, active: true, ...extra });
const task = (id: string, extra: Partial<DayTask> = {}): DayTask => ({ id, branch: 'calicut', day: '2026-10-02', responsibility_id: null, title: `Task ${id}`, assigned_to: 'a', status: 'open', note: '', carried_from: null, done_by: null, done_at: null, ...extra });

describe('when a job is due', () => {
  it('daily, weekly on its weekday, monthly on its day or the month’s last day', () => {
    expect(dueOn(job('1'), '2026-10-02')).toBe(true);
    expect(dueOn(job('1', { frequency: 'weekly', weekday: 5 }), '2026-10-02')).toBe(true); // a Friday
    expect(dueOn(job('1', { frequency: 'weekly', weekday: 1 }), '2026-10-02')).toBe(false);
    expect(dueOn(job('1', { frequency: 'monthly', monthday: 2 }), '2026-10-02')).toBe(true);
    expect(dueOn(job('1', { frequency: 'monthly', monthday: 31 }), '2026-11-30')).toBe(true);
    expect(dueOn(job('1', { frequency: 'as_needed' }), '2026-10-02')).toBe(false);
    expect(dueOn(job('1', { active: false }), '2026-10-02')).toBe(false);
    expect(frequencyLabel({ frequency: 'weekly', weekday: 5, monthday: null })).toBe('Every Fri');
  });
});

describe('who does it', () => {
  it('the owner when working, else the backup, else nobody yet', () => {
    expect(stand(job('1'), new Set(['a', 'b']))).toEqual({ assignee: 'a', reason: 'owner' });
    expect(stand(job('1'), new Set(['b']))).toEqual({ assignee: 'b', reason: 'backup' });
    expect(stand(job('1'), new Set(['c']))).toEqual({ assignee: null, reason: 'unassigned' });
  });
  it('a saved task keeps the lead’s choice and its status', () => {
    const items = dayList([job('1')], [task('t', { responsibility_id: '1', assigned_to: 'c', status: 'done' })], '2026-10-02', new Set(['a']));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ assignee: 'c', status: 'done', reason: 'lead' });
  });
  it('lists jobs due from the blueprint and tasks added for the day', () => {
    const items = dayList([job('1'), job('2', { frequency: 'weekly', weekday: 1 })], [task('x')], '2026-10-02', new Set(['a']));
    expect(items.map(i => i.title)).toEqual(['Job 1', 'Task x']);
    expect(progress(items, 'a')).toEqual({ done: 0, total: 2, blocked: 0 });
  });
  it('a moved task leaves the day’s count', () => {
    const items = dayList([], [task('x', { status: 'carried' }), task('y', { status: 'done' })], '2026-10-02', new Set());
    expect(progress(items)).toEqual({ done: 1, total: 1, blocked: 0 });
    expect(nextDay('2026-10-31')).toBe('2026-11-01');
  });
});

describe('the lead’s report', () => {
  it('drafts what was done and what carries over, Actionables included', () => {
    const items = dayList([job('1'), job('2', { owner_id: 'b' })], [task('t', { responsibility_id: '1', status: 'done' }), task('u', { responsibility_id: '2', assigned_to: 'b', status: 'blocked', note: 'No ink' })], '2026-10-02', new Set(['a', 'b']));
    const names = (id: string | null) => ({ a: 'Aysha', b: 'Bindu' } as Record<string, string>)[id ?? ''] ?? 'Nobody yet';
    const due = actionablesDue([{ id: 'm', title: 'Call the principal', owner_id: 'a', status: 'open', due_date: '2026-10-01', due_at: null, institution: { name: 'GEC' } }, { id: 'n', title: 'Later', owner_id: 'a', status: 'open', due_date: '2026-10-09', due_at: null }], '2026-10-02');
    const d = draftReport({ items, names, checks: { recorded: 40, expected: 42, missed: 2 }, actionables: due });
    expect(d.summary).toContain('Tasks: 1 of 2 done.');
    expect(d.summary).toContain('42 recorded, 2 missed'.replace('42 recorded', '40 of 42 recorded'));
    expect(d.summary).toContain('Aysha: Job 1');
    expect(d.followups).toContain('Job 2 · Bindu · blocked: No ink');
    expect(d.followups).toContain('Actionables: Call the principal (GEC) · Aysha · due 2026-10-01');
    expect(d.followups).not.toContain('Later');
    expect(reportText({ branch: 'calicut', day: '2026-10-02', lead: 'Aysha', summary: 's', followups: 'f', recognition: '' })).toBe('FETS Calicut · daily report · 2026-10-02\nLead: Aysha\n\nTODAY\ns\n\nCARRY INTO TOMORROW\nf');
  });
  it('the starting template covers all six areas', () => {
    expect(new Set(TEMPLATE.map(t => t.area)).size).toBe(6);
    for (const t of TEMPLATE) expect(t.frequency !== 'weekly' || t.weekday).toBeTruthy();
  });
});
