import { describe, expect, it } from 'vitest';
import { analyseDay, formatSeatTime } from './engine';
import { findSuggestions } from './solver';
import type { SeatDetail, SeatRule, SeatSession, SeatSolverOptions } from './types';

const date = '2026-11-13';
const future: SeatSolverOptions = { now: '2026-11-12T00:00:00Z', window_start: '09:00', window_end: '12:00' };
const session = (id: number, start: string, end: string, count: number, extra: Partial<SeatSession> = {}): SeatSession => ({ id, date, branch_location: 'calicut', client_name: 'Fixed', exam_name: 'Exam', start_time: start, end_time: end, candidate_count: count, status: 'scheduled', ...extra });
const rule = (earlier: number, later: number, extra: Partial<SeatRule> = {}): SeatRule => ({ id: 'r1', branch_location: 'calicut', provider: 'Pearson VUE', exam_code: null, exam_name: null, earlier_minutes: earlier, later_minutes: later, updated_at: '2026-11-06T00:00:00Z', ...extra });
const fixedRule = rule(0, 0, { id: 'fixed', provider: 'Fixed' });
const rows = () => [session(1, '09:00', '10:00', 40), session(2, '09:50', '10:30', 10, { client_name: 'Pearson VUE' })];
const source = (count = 10): SeatDetail => ({ session_id: 2, branch_location: 'calicut', provider: 'Pearson VUE', date, start_time: '09:50', end_time: '10:30', exam_code: 'A', exam_title: 'Exam A', count, status: 'registered' });

describe('review-only bounded seat timing search', () => {
  it('finds the smallest permitted later shift and preserves duration without mutating inputs', () => {
    const sessions = rows();
    const before = JSON.stringify(sessions);
    const result = findSuggestions(sessions, 'calicut', date, [rule(0, 15)], [], future);
    expect(result.status).toBe('resolved');
    expect(result.suggestions.length).toBeLessThanOrEqual(3);
    const best = result.suggestions[0];
    expect(best).toMatchObject({ resolved: true, people_moved: 10, seat_minutes: 100, remaining_excess: 0, remaining_overload_seconds: 0 });
    expect(best.moves).toHaveLength(1);
    expect(best.moves[0]).toMatchObject({ session_id: 2, minutes: 10, count: 10 });
    expect(best.moves[0].after_end - best.moves[0].after_start).toBe(2400);
    expect(best.day).toMatchObject({ peak: 40, total: 50 });
    expect(JSON.stringify(sessions)).toBe(before);
  });

  it('keeps unset provider rules fixed and distinguishes configured zero limits', () => {
    expect(findSuggestions(rows(), 'calicut', date, [], [], future)).toMatchObject({ status: 'needs_rules', suggestions: [] });
    expect(findSuggestions(rows(), 'calicut', date, [rule(0, 0), fixedRule], [], future)).toMatchObject({ status: 'none', suggestions: [] });
  });

  it('gives code overrides precedence over name and provider limits', () => {
    const rules = [rule(0, 0), rule(0, 0, { id: 'title', exam_name: 'Exam A' }), rule(0, 10, { id: 'code', exam_code: 'a' })];
    const result = findSuggestions(rows(), 'calicut', date, rules, [source()], future);
    expect(result.status).toBe('resolved');
    expect(result.suggestions[0].moves[0]).toMatchObject({ exam_code: 'A', minutes: 10 });
  });

  it('uses a title override for a Calendar group and canonical provider aliases', () => {
    const sessions = rows().map(s => s.id === 2 ? { ...s, client_name: 'VUE', exam_name: ' Exam B ' } : s);
    const result = findSuggestions(sessions, 'calicut', date, [rule(0, 0), rule(0, 10, { id: 'title', provider: 'Pearson', exam_name: 'exam b' })], [], future);
    expect(result.status).toBe('resolved');
    expect(result.suggestions[0].people_moved).toBe(10);
  });

  it('can start earlier within its specific bound and returns a partial improvement if the bound is too small', () => {
    const sessions = [session(1, '10:00', '11:00', 30), session(2, '09:50', '10:10', 20, { client_name: 'Pearson VUE' })];
    const options = { ...future, window_start: '09:30' };
    const solved = findSuggestions(sessions, 'calicut', date, [rule(10, 0)], [], options);
    expect(solved.suggestions[0].moves[0].minutes).toBe(-10);
    expect(solved.status).toBe('resolved');
    const partial = findSuggestions(sessions, 'calicut', date, [rule(9, 0)], [], options);
    expect(partial.status).toBe('partial');
    expect(partial.suggestions[0]).toMatchObject({ resolved: false, remaining_excess: 10, remaining_overload_seconds: 60 });
    expect(partial.suggestions[0].moves[0].minutes).toBe(-9);
  });

  it('moves a minimal source subgroup subset and preserves every unmoved seat', () => {
    const sessions = [session(1, '09:00', '10:00', 35), rows()[1]];
    const result = findSuggestions(sessions, 'calicut', date, [rule(0, 10)], [source()], future);
    expect(result.status).toBe('resolved');
    const best = result.suggestions[0];
    expect(best).toMatchObject({ people_moved: 5, seat_minutes: 50 });
    expect(best.moves[0].count).toBe(5);
    expect(best.day.atoms.filter(a => a.session_id === 2).map(a => [formatSeatTime(a.start), a.count]).sort()).toEqual([['09:50', 5], ['10:00', 5]]);
    expect(best.day.total).toBe(45);
  });

  it('moves a Calendar aggregate only as a whole when individual source counts are absent', () => {
    const sessions = [session(1, '09:00', '10:00', 35), rows()[1]];
    const result = findSuggestions(sessions, 'calicut', date, [rule(0, 10)], [], future);
    expect(result.suggestions[0].people_moved).toBe(10);
  });

  it.each(['in_progress', 'checked_in', 'completed', 'running'])('keeps %s reservations fixed', status => {
    const sessions = rows().map(s => s.id === 2 ? { ...s, status } : s);
    expect(findSuggestions(sessions, 'calicut', date, [rule(15, 15), fixedRule], [], future)).toMatchObject({ status: 'none', suggestions: [] });
  });

  it('keeps source-progress subgroups fixed even when the Calendar group is scheduled', () => {
    expect(findSuggestions(rows(), 'calicut', date, [rule(15, 15), fixedRule], [{ ...source(), status: 'checked_in' }], future)).toMatchObject({ status: 'none', suggestions: [] });
  });

  it('uses Kolkata current time to freeze started or historical reservations', () => {
    expect(findSuggestions(rows(), 'calicut', date, [rule(15, 15)], [], { ...future, now: '2026-11-13T04:20:00Z' })).toMatchObject({ status: 'none', suggestions: [] });
    expect(findSuggestions(rows(), 'calicut', date, [rule(15, 15)], [], { ...future, now: '2026-11-14T00:00:00Z' })).toMatchObject({ status: 'none', suggestions: [] });
  });

  it('does not shift a future session backwards into the present', () => {
    const sessions = [session(1, '10:00', '11:00', 40), session(2, '09:55', '10:05', 5, { client_name: 'Pearson VUE' })];
    expect(findSuggestions(sessions, 'calicut', date, [rule(10, 0)], [], { ...future, now: '2026-11-13T04:24:30Z' })).toMatchObject({ status: 'none', suggestions: [] });
  });

  it('rechecks a second overload window and rejects moving the conflict elsewhere', () => {
    const sessions = [session(1, '09:00', '10:00', 40), session(2, '09:50', '10:20', 10, { client_name: 'Pearson VUE' }), session(3, '10:20', '11:00', 40)];
    const result = findSuggestions(sessions, 'calicut', date, [rule(0, 20)], [], future);
    expect(result).toMatchObject({ status: 'none', suggestions: [] });
    expect(result.message).toMatch(/within|limits/i);
  });

  it('resolves multiple independent overload windows with multiple allowed moves', () => {
    const sessions = [...rows(), session(3, '10:40', '11:20', 40), session(4, '11:10', '11:40', 5, { client_name: 'Pearson VUE' })];
    const result = findSuggestions(sessions, 'calicut', date, [rule(0, 10)], [], future);
    expect(result.status).toBe('resolved');
    expect(result.suggestions[0]).toMatchObject({ people_moved: 15, remaining_excess: 0 });
    expect(result.suggestions[0].moves).toHaveLength(2);
  });

  it('honours the conservative recorded span by default and explicit window boundaries', () => {
    expect(findSuggestions(rows(), 'calicut', date, [rule(0, 10)], [], { now: future.now })).toMatchObject({ status: 'none', suggestions: [] });
    const shorterWindow = findSuggestions(rows(), 'calicut', date, [rule(0, 10)], [], { ...future, window_end: '10:39' });
    expect(shorterWindow.status).toBe('partial');
    expect(shorterWindow.suggestions[0].moves[0].minutes).toBe(9);
    expect(findSuggestions(rows(), 'calicut', date, [rule(0, 10)], [], { ...future, window_end: '10:40' }).status).toBe('resolved');
  });

  it('does not cross into an adjacent date even when that date has reservations', () => {
    const sessions = [session(1, '23:00', '24:00', 40), session(2, '23:50', '24:00', 5, { client_name: 'Pearson VUE' }), session(3, '00:00', '01:00', 40, { date: '2026-11-14' })];
    expect(findSuggestions(sessions, 'calicut', date, [rule(0, 20)], [], { ...future, window_start: '23:00', window_end: '24:00' })).toMatchObject({ status: 'none', suggestions: [] });
  });

  it('keeps centres and their rules independent', () => {
    const sessions = [...rows(), session(3, '09:00', '10:00', 31, { branch_location: 'cochin' })];
    expect(findSuggestions(sessions, 'calicut', date, [rule(0, 10, { branch_location: 'cochin' })], [], future).status).toBe('needs_rules');
    expect(findSuggestions(sessions, 'cochin', date, [rule(0, 10)], [], future)).toMatchObject({ status: 'none', suggestions: [] });
  });

  it.each([-1, 0.5, 121, NaN])('rejects invalid rule limits %s instead of inventing flexibility', earlier => {
    expect(findSuggestions(rows(), 'calicut', date, [rule(earlier, 10)], [], future)).toMatchObject({ status: 'incomplete', suggestions: [] });
  });

  it('blocks suggestions on inconsistent source count and unknown schedule times', () => {
    expect(findSuggestions(rows(), 'calicut', date, [rule(0, 15)], [source(9)], future)).toMatchObject({ status: 'incomplete', suggestions: [] });
    expect(findSuggestions([...rows(), session(3, '00:00', '00:00', 1)], 'calicut', date, [rule(0, 15)], [], future)).toMatchObject({ status: 'incomplete', suggestions: [] });
  });

  it('does not apply an exam-specific permission to a different internal-space exam code', () => {
    const rules = [fixedRule, rule(0, 0), rule(0, 10, { id: 'specific', exam_code: 'A  B' })];
    expect(findSuggestions(rows(), 'calicut', date, rules, [{ ...source(), exam_code: 'A B' }], future)).toMatchObject({ status: 'none', suggestions: [] });
  });

  it('rejects ambiguous current-time references without a timezone', () => {
    expect(findSuggestions(rows(), 'calicut', date, [rule(0, 10)], [], { ...future, now: '2026-11-13T04:20:00' })).toMatchObject({ status: 'incomplete', suggestions: [] });
  });

  it('returns bounded deterministic results and declares an exhausted evaluation budget', () => {
    const options = { ...future, max_evaluations: 1, max_moves: 1 };
    const first = findSuggestions(rows(), 'calicut', date, [rule(0, 120)], [], options);
    const second = findSuggestions(rows(), 'calicut', date, [rule(0, 120)], [], options);
    expect(first).toEqual(second);
    expect(first.evaluated).toBeLessThanOrEqual(1);
    expect(first.limited).toBe(true);
    expect(first.message).toMatch(/limit|budget/i);
    expect(analyseDay(rows(), 'calicut', date).peak).toBe(50);
  });

  it('keeps overnight groups fixed even if an earlier same-day shift would remove the first-day overload', () => {
    const sessions = [session(1, '23:00', '24:00', 40), session(2, '23:30', '00:30', 5, { client_name: 'Pearson VUE' })];
    const result = findSuggestions(sessions, 'calicut', date, [fixedRule, rule(120, 0)], [], { ...future, window_start: '21:00', window_end: '24:00' });
    expect(result).toMatchObject({ status: 'none', suggestions: [] });
  });

  it('keeps carry-in reservations fixed and resolves the next-day conflict by moving only same-day groups', () => {
    const sessions = [session(1, '23:00', '00:30', 40, { client_name: 'Pearson VUE' }), session(2, '00:20', '00:40', 5, { date: '2026-11-14', client_name: 'Pearson VUE' })];
    const result = findSuggestions(sessions, 'calicut', '2026-11-14', [rule(0, 10)], [], { ...future, window_start: '00:00', window_end: '01:00' });
    expect(result.status).toBe('resolved');
    expect(result.suggestions[0].moves.map(m => [m.session_id, m.minutes])).toEqual([[2, 10]]);
    expect(result.suggestions[0].day.total).toBe(45);
  });

  it('uses the clipped recorded day span when an overnight reservation carries into the selected date', () => {
    const sessions = [session(1, '23:00', '00:30', 40), session(2, '00:20', '00:40', 5, { date: '2026-11-14', client_name: 'Pearson VUE' }), session(3, '00:50', '01:00', 1, { date: '2026-11-14' })];
    const result = findSuggestions(sessions, 'calicut', '2026-11-14', [rule(0, 10)], [], { now: future.now });
    expect(result.status).toBe('resolved');
    expect(result.suggestions[0].moves.map(m => m.session_id)).toEqual([2]);
  });
});
