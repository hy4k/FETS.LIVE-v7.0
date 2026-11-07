import { describe, expect, it } from 'vitest';
import { formatSeatTime } from './engine';
import { prepareDayPlan } from './day-plan';
import { findAtomSuggestions } from './solver';
import type { SeatDayPlanInput, SeatDetail, SeatSession } from './types';

const date = '2026-11-13';
const input = (extra: Partial<SeatDayPlanInput> = {}): SeatDayPlanInput => ({ earlier_minutes: 15, later_minutes: 15, exam_limits: {}, manual_starts: {}, window_start: '08:00', window_end: '18:00', capacity_windows: [], now: '2026-11-12T00:00:00Z', ...extra });
const session = (id: number, start = '09:50', end = '10:30', count = 10, extra: Partial<SeatSession> = {}): SeatSession => ({ id, date, branch_location: 'calicut', client_name: 'Prometric', exam_name: 'Exam', start_time: start, end_time: end, candidate_count: count, status: 'scheduled', ...extra });
const detail = (code: string, count: number, extra: Partial<SeatDetail> = {}): SeatDetail => ({ session_id: 1, branch_location: 'calicut', provider: 'Prometric', date, start_time: '09:50', end_time: '10:30', exam_code: code, exam_title: `Exam ${code}`, count, status: 'registered', ...extra });

describe('review-only daily seat preparation', () => {
  it('gives every verified selected-day provider daily flexibility and retains adjacent atoms', () => {
    const rows = [session(1), session(2, '11:00', '12:00', 2, { client_name: 'Pearson VUE' }), session(3, '09:00', '10:00', 3, { date: '2026-11-14' })];
    const plan = prepareDayPlan(rows, 'calicut', date, [], input());
    expect(plan.issues).toEqual([]);
    expect(plan.limits).toEqual({ '1:calendar': { earlier_minutes: 15, later_minutes: 15 }, '2:calendar': { earlier_minutes: 15, later_minutes: 15 } });
    expect(plan.atoms.map(atom => [atom.session_id, atom.count])).toEqual([[1, 10], [2, 2], [3, 3]]);
    expect(plan.day.atoms.map(atom => atom.session_id)).toEqual([1, 2]);
    expect(plan.manual_moves).toEqual([]);
  });

  it('applies one manual source-group start while retaining duration, counts and the other exam group', () => {
    const rows = [session(1)];
    const sources = [detail('A', 4), detail('B', 6)];
    const before = JSON.stringify({ rows, sources });
    const plan = prepareDayPlan(rows, 'calicut', date, sources, input({ manual_starts: { '1:source:0': '10:00' } }));
    expect(plan.issues).toEqual([]);
    expect(plan.atoms.map(atom => [atom.key, formatSeatTime(atom.start), formatSeatTime(atom.end), atom.count, atom.movable])).toEqual([
      ['1:source:0', '10:00', '10:40', 4, false], ['1:source:1', '09:50', '10:30', 6, true],
    ]);
    expect(plan.manual_moves).toHaveLength(1);
    expect(plan.manual_moves[0]).toMatchObject({ atom_key: '1:source:0', session_id: 1, count: 4, minutes: 10 });
    expect(plan.day.total).toBe(10);
    expect(plan.original.atoms.map(atom => [formatSeatTime(atom.start), atom.count])).toEqual([['09:50', 4], ['09:50', 6]]);
    expect(JSON.stringify({ rows, sources })).toBe(before);
  });

  it('preserves complete second-precision duration when manually moving a whole Calendar group', () => {
    const plan = prepareDayPlan([session(1, '09:50:15', '10:30:45')], 'calicut', date, [], input({ manual_starts: { '1:calendar': '10:00:45' } }));
    expect(plan.issues).toEqual([]);
    expect(plan.atoms.map(atom => [formatSeatTime(atom.start), formatSeatTime(atom.end), atom.count])).toEqual([['10:00:45', '10:41:15', 10]]);
    expect(plan.manual_moves[0].minutes).toBe(10.5);
  });

  it('uses per-exam limits and an explicit lock instead of daily defaults', () => {
    const plan = prepareDayPlan([session(1), session(2)], 'calicut', date, [], input({ exam_limits: { '1:calendar': { earlier_minutes: 3, later_minutes: 7 }, '2:calendar': { earlier_minutes: 15, later_minutes: 15, locked: true } } }));
    expect(plan.issues).toEqual([]);
    expect(plan.limits).toEqual({ '1:calendar': { earlier_minutes: 3, later_minutes: 7 }, '2:calendar': { earlier_minutes: 0, later_minutes: 0, locked: true } });
    expect(plan.atoms.find(atom => atom.session_id === 2)?.movable).toBe(false);
  });

  it('fixes manual placements during the following automatic search', () => {
    const rows = [session(1, '09:00', '10:00', 40), session(2)];
    const settings = input({ exam_limits: { '1:calendar': { earlier_minutes: 0, later_minutes: 0, locked: true } }, manual_starts: { '2:calendar': '09:55' } });
    const plan = prepareDayPlan(rows, 'calicut', date, [], settings);
    expect(plan.day.peak).toBe(50);
    expect(plan.issues).toEqual([]);
    expect(findAtomSuggestions(plan.atoms, plan.day, 'calicut', date, [], { ...settings, atom_limits: plan.limits })).toMatchObject({ status: 'none', suggestions: [] });
    const reset = prepareDayPlan(rows, 'calicut', date, [], input());
    expect(reset.manual_moves).toEqual([]);
    expect(formatSeatTime(reset.atoms[1].start)).toBe('09:50');
  });

  it.each(['checked_in', 'in_progress', 'completed', 'closed'])('keeps %s reservations fixed', status => {
    const plan = prepareDayPlan([session(1, '09:50', '10:30', 10, { status })], 'calicut', date, [], input());
    expect(plan.issues).toEqual([]);
    expect(plan.limits['1:calendar']).toEqual({ earlier_minutes: 0, later_minutes: 0, locked: true });
    expect(plan.atoms[0].movable).toBe(false);
  });

  it('fixes started and carry-in/overnight groups while retaining their occupancy', () => {
    const rows = [session(1), session(2, '23:00', '01:00', 3), session(3, '23:00', '00:30', 4, { date: '2026-11-12' })];
    const plan = prepareDayPlan(rows, 'calicut', date, [], input({ now: '2026-11-13T04:20:00Z' }));
    expect(plan.issues).toEqual([]);
    expect(plan.day.total).toBe(17);
    expect(plan.day.atoms.every(atom => !atom.movable)).toBe(true);
    expect(Object.values(plan.limits).every(limits => limits.locked && limits.earlier_minutes === 0 && limits.later_minutes === 0)).toBe(true);
  });

  it.each([
    ['beyond daily limits', { manual_starts: { '1:calendar': '10:06' } }],
    ['beyond per-exam limits', { exam_limits: { '1:calendar': { earlier_minutes: 1, later_minutes: 2 } }, manual_starts: { '1:calendar': '09:53' } }],
    ['locked exam', { exam_limits: { '1:calendar': { earlier_minutes: 15, later_minutes: 15, locked: true } }, manual_starts: { '1:calendar': '10:00' } }],
    ['past proposed start', { now: '2026-11-13T04:15:00Z', manual_starts: { '1:calendar': '09:45' } }],
    ['outside planning window', { window_end: '10:35', manual_starts: { '1:calendar': '10:00' } }],
    ['unknown exam key', { manual_starts: { 'old:calendar': '10:00' } }],
    ['stale exam limit', { exam_limits: { 'old:calendar': { earlier_minutes: 0, later_minutes: 10 } } }],
    ['malformed start', { manual_starts: { '1:calendar': '9:55' } }],
    ['ambiguous now', { now: '2026-11-12T00:00:00' }],
    ['equal planning window', { window_start: '10:00', window_end: '10:00' }],
  ] satisfies [string, Partial<SeatDayPlanInput>][])('blocks %s without applying a partial manual plan', (_, settings) => {
    const plan = prepareDayPlan([session(1)], 'calicut', date, [], input(settings));
    expect(plan.issues.length).toBeGreaterThan(0);
    expect(plan.day.complete).toBe(false);
    expect(plan.day.status).toBe('incomplete');
    expect(plan.manual_moves).toEqual([]);
    expect(formatSeatTime(plan.atoms[0].start)).toBe('09:50');
  });

  it.each([-1, 0.5, 121, NaN])('rejects invalid whole-minute daily limits %s', earlier_minutes => {
    const plan = prepareDayPlan([session(1)], 'calicut', date, [], input({ earlier_minutes }));
    expect(plan.issues.length).toBeGreaterThan(0);
    expect(plan.day.complete).toBe(false);
  });

  it('rejects a manual move that would cross midnight even within its timing limit', () => {
    const plan = prepareDayPlan([session(1, '23:00', '23:55')], 'calicut', date, [], input({ window_start: '00:00', window_end: '24:00', manual_starts: { '1:calendar': '23:10' } }));
    expect(plan.issues.length).toBeGreaterThan(0);
    expect(plan.day.complete).toBe(false);
    expect(formatSeatTime(plan.atoms[0].end)).toBe('23:55');
  });

  it('blocks manual previews for inconsistent, unknown and checked-in source groups', () => {
    const mismatch = prepareDayPlan([session(1)], 'calicut', date, [detail('A', 9)], input({ manual_starts: { '1:calendar': '10:00' } }));
    expect(mismatch.issues.length).toBeGreaterThan(0);
    expect(mismatch.day.complete).toBe(false);
    expect(mismatch.manual_moves).toEqual([]);
    expect(mismatch.atoms[0].movable).toBe(false);
    expect(mismatch.limits['1:calendar']).toEqual({ earlier_minutes: 0, later_minutes: 0, locked: true });
    const checkedIn = prepareDayPlan([session(1)], 'calicut', date, [detail('A', 10, { status: 'checked_in' })], input({ manual_starts: { '1:source:0': '10:00' } }));
    expect(checkedIn.issues.length).toBeGreaterThan(0);
    expect(checkedIn.day.complete).toBe(false);
    const unknown = prepareDayPlan([{ ...session(1), end_time: null }], 'calicut', date, [], input());
    expect(unknown.issues.length).toBeGreaterThan(0);
    expect(unknown.day.complete).toBe(false);
  });

  it('calculates temporary systems only within their preview interval', () => {
    const plan = prepareDayPlan([session(1, '09:00', '11:00', 45)], 'calicut', date, [], input({ capacity_windows: [{ branch_location: 'calicut', date, extra_systems: 5, start_time: '09:00', end_time: '10:00' }] }));
    expect(plan.issues).toEqual([]);
    expect(plan.day.full.map(segment => [formatSeatTime(segment.start), formatSeatTime(segment.end), segment.capacity])).toEqual([['09:00', '10:00', 45]]);
    expect(plan.day.overbooked.map(segment => [formatSeatTime(segment.start), formatSeatTime(segment.end), segment.excess])).toEqual([['10:00', '11:00', 5]]);
    expect(plan.original.overbooked.map(segment => [formatSeatTime(segment.start), formatSeatTime(segment.end)])).toEqual([['09:00', '11:00']]);
  });
});
