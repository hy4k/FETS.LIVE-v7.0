import { describe, expect, it } from 'vitest';
import { analyseDay, checkBooking, formatSeatTime, normaliseProvider, toSeatSecond } from './engine';
import type { SeatDetail, SeatSession } from './types';

const date = '2026-11-13';
const session = (id: number, start: string | null, end: string | null, count: number | null, extra: Partial<SeatSession> = {}): SeatSession => ({
  id, date, branch_location: 'calicut', client_name: 'Pearson VUE', exam_name: 'Exam', start_time: start, end_time: end, candidate_count: count, status: 'scheduled', ...extra,
});
const detail = (count: number, extra: Partial<SeatDetail> = {}): SeatDetail => ({
  session_id: 1, branch_location: 'calicut', provider: 'Pearson VUE', date, start_time: '09:00', end_time: '10:00', exam_code: 'A', exam_title: 'Exam A', count, status: 'registered', ...extra,
});

describe('seat interval planning', () => {
  it('releases seats at the exact handoff and retains exactly-full periods', () => {
    const day = analyseDay([session(1, '09:00', '10:00', 40), session(2, '10:00', '11:00', 40)], 'calicut', date);
    expect(day.peak).toBe(40);
    expect(day.status).toBe('full');
    expect(day.full.map(s => [formatSeatTime(s.start), formatSeatTime(s.end), s.booked])).toEqual([['09:00', '10:00', 40], ['10:00', '11:00', 40]]);
    expect(day.overbooked).toEqual([]);
  });

  it('counts every provider with second precision and keeps centre pools separate', () => {
    const sessions = [session(1, '09:00', '10:00:01', 40), session(2, '10:00', '11:00', 10, { client_name: 'Prometric' }), session(3, '09:00', '11:00', 31, { branch_location: 'Kochi' })];
    const day = analyseDay(sessions, 'calicut', date);
    expect(day.peak).toBe(50);
    expect(day.overbooked.map(s => [formatSeatTime(s.start), formatSeatTime(s.end), s.excess])).toEqual([['10:00', '10:00:01', 10]]);
    expect(analyseDay(sessions, 'cochin', date)).toMatchObject({ peak: 31, capacity: 31, status: 'full', complete: true });
  });

  it('excludes cancelled and zero counts while retaining pending missing-source seats', () => {
    const day = analyseDay([session(1, '09:00', '10:00', 3, { status: 'missing_from_import_pending_review' }), session(2, null, null, 80, { status: 'cancelled' }), session(3, null, null, 0)], 'calicut', date);
    expect(day).toMatchObject({ peak: 3, total: 3, complete: true, status: 'available' });
  });

  it.each([
    ['missing times', session(1, null, null, 1)],
    ['equal times', session(1, '09:00', '09:00', 1)],
    ['malformed time', session(1, '9:00', '10:00', 1)],
    ['negative count', session(1, '09:00', '10:00', -1)],
    ['fractional count', session(1, '09:00', '10:00', 1.5)],
    ['missing count', session(1, '09:00', '10:00', null)],
    ['unknown branch', session(1, '09:00', '10:00', 1, { branch_location: null })],
  ])('does not declare availability with %s', (_, row) => {
    const day = analyseDay([row], 'calicut', date);
    expect(day.complete).toBe(false);
    expect(day.status).toBe('incomplete');
    expect(day.issues.some(issue => issue.blocking)).toBe(true);
    expect(checkBooking(day, { start_time: '11:00', end_time: '12:00', count: 1 }).status).toBe('unknown');
  });

  it('shows confirmed overload even when other reservations have unknown timing', () => {
    const day = analyseDay([session(1, '09:00', '10:00', 45), session(2, null, null, 3)], 'calicut', date);
    expect(day).toMatchObject({ peak: 45, complete: false, status: 'overbooked' });
    expect(checkBooking(day, { start_time: '09:00', end_time: '10:00', count: 1 }).status).toBe('overbooked');
  });

  it('blocks inconsistent duplicate IDs without doubling a repeated reservation', () => {
    const row = session(1, '09:00', '10:00', 30);
    expect(analyseDay([row, { ...row }], 'calicut', date)).toMatchObject({ peak: 30, complete: true });
    const day = analyseDay([row, { ...row, candidate_count: 31 }], 'calicut', date);
    expect(day.complete).toBe(false);
    expect(day.peak).toBe(30);
    expect(day.issues.some(issue => issue.kind === 'duplicate_session')).toBe(true);
  });

  it('does not let a known other-centre or other-date defect affect the selected pool', () => {
    expect(analyseDay([session(1, null, null, 1, { branch_location: 'cochin' }), session(2, null, null, 1, { date: '2026-11-14' })], 'calicut', date)).toMatchObject({ complete: true, peak: 0 });
  });

  it('uses source exam groups in place of the Calendar count and preserves retakes', () => {
    const day = analyseDay([session(1, '09:00', '10:00', 5)], 'calicut', date, [detail(2), detail(2, { exam_code: 'B', exam_title: 'Exam B' }), detail(1, { status: 'checked_in' })]);
    expect(day).toMatchObject({ peak: 5, total: 5, complete: true });
    expect(day.atoms).toHaveLength(3);
    expect(day.atoms.map(a => a.basis)).toEqual(['source', 'source', 'source']);
    expect(day.atoms.filter(a => !a.movable).reduce((n, a) => n + a.count, 0)).toBe(1);
    expect(new Set(day.atoms.map(a => a.key)).size).toBe(3);
  });

  it.each([
    ['count', detail(4)], ['provider', detail(5, { provider: 'Prometric' })],
    ['branch', detail(5, { branch_location: 'cochin' })], ['date', detail(5, { date: '2026-11-14' })],
    ['time', detail(5, { end_time: '11:00' })], ['invalid count', detail(-5)],
  ])('falls back to the authoritative Calendar group on source %s mismatch', (_, source) => {
    const day = analyseDay([session(1, '09:00', '10:00', 5)], 'calicut', date, [source]);
    expect(day).toMatchObject({ peak: 5, total: 5, complete: false });
    expect(day.atoms).toHaveLength(1);
    expect(day.atoms[0].basis).toBe('calendar');
    expect(day.issues.some(i => i.kind === 'source_detail_mismatch' && i.blocking)).toBe(true);
  });

  it.each(['provider', 'date', 'start_time', 'end_time'] as const)('keeps nullable source %s visible without crashing or borrowing Calendar timing', field => {
    const day = analyseDay([session(1, '09:00', '10:00', 5)], 'calicut', date, [detail(5, { [field]: null })]);
    expect(day).toMatchObject({ peak: 5, total: 5, complete: false });
    expect(day.atoms[0].basis).toBe('calendar');
  });

  it('checks the requested interval including empty gaps even after an earlier overload', () => {
    const day = analyseDay([session(1, '09:00', '10:00', 45), session(2, '11:00', '12:00', 37)], 'calicut', date);
    expect(checkBooking(day, { start_time: '10:00', end_time: '11:00', count: 40 })).toMatchObject({ status: 'full', minimum_free: 40, peak_after: 40 });
    expect(checkBooking(day, { start_time: '10:00', end_time: '12:00', count: 3 })).toMatchObject({ status: 'full', minimum_free: 3, peak_after: 40 });
    expect(checkBooking(day, { start_time: '10:00', end_time: '12:00', count: 4 })).toMatchObject({ status: 'overbooked', minimum_free: 3, peak_after: 41 });
    expect(checkBooking(day, { start_time: '13:00', end_time: '14:00', count: 2 }).status).toBe('fits');
    expect(checkBooking(day, { start_time: '13:00', end_time: '13:00', count: 2 }).status).toBe('invalid');
    expect(checkBooking(day, { start_time: '13:00', end_time: '14:00', count: 0.5 }).status).toBe('invalid');
  });

  it('supports an explicit midnight end with strict date/time parsing', () => {
    const day = analyseDay([session(1, '23:00', '24:00', 40)], 'calicut', date);
    expect(day).toMatchObject({ complete: true, peak: 40 });
    expect(toSeatSecond(date, '24:00')).toBe(1794614400);
    expect(toSeatSecond(date, '24:00:01')).toBeNull();
    expect(toSeatSecond('2026-02-30', '10:00')).toBeNull();
    expect(formatSeatTime(1794564001)).toBe('10:00:01');
    expect(normaliseProvider('  pearson  vue ')).toBe('PEARSON VUE');
    expect(normaliseProvider('CMA US')).toBe('PROMETRIC');
  });

  it('counts an overnight reservation on both dates and releases at the next-day end', () => {
    const rows = [session(1, '23:00', '01:00', 40)];
    const first = analyseDay(rows, 'calicut', date);
    const next = analyseDay(rows, 'calicut', '2026-11-14');
    expect(first).toMatchObject({ complete: true, peak: 40, status: 'full' });
    expect(first.segments.map(s => [formatSeatTime(s.start), formatSeatTime(s.end)])).toEqual([['23:00', '00:00']]);
    expect(next).toMatchObject({ complete: true, peak: 40, total: 40, status: 'full' });
    expect(next.segments.map(s => [formatSeatTime(s.start), formatSeatTime(s.end)])).toEqual([['00:00', '01:00']]);
    expect(checkBooking(next, { start_time: '00:00', end_time: '00:30', count: 1 }).status).toBe('overbooked');
    expect(checkBooking(next, { start_time: '01:00', end_time: '02:00', count: 1 }).status).toBe('fits');
  });

  it('replaces an agreed overnight Calendar group with source groups exactly once', () => {
    const rows = [session(1, '23:00', '01:00', 5)];
    const sources = [detail(2, { start_time: '23:00', end_time: '01:00' }), detail(3, { start_time: '23:00', end_time: '01:00', exam_code: 'B' })];
    const next = analyseDay(rows, 'calicut', '2026-11-14', sources);
    expect(next).toMatchObject({ complete: true, peak: 5, total: 5 });
    expect(next.atoms.map(a => [a.basis, a.count])).toEqual([['source', 2], ['source', 3]]);
  });

  it('keeps overnight source mismatches blocking on the continuation date without inflating Calendar seats', () => {
    const next = analyseDay([session(1, '23:00', '01:00', 5)], 'calicut', '2026-11-14', [detail(4, { start_time: '23:00', end_time: '01:00' })]);
    expect(next).toMatchObject({ complete: false, peak: 5, total: 5, status: 'incomplete' });
    expect(next.issues.some(issue => issue.kind === 'source_detail_mismatch')).toBe(true);
    expect(checkBooking(next, { start_time: '01:00', end_time: '02:00', count: 1 }).status).toBe('unknown');
  });

  it.each([['equal', '23:00', '23:00'], ['missing', '23:00', null]] as const)('keeps prior-day %s timing uncertain on the next day', (_, start, end) => {
    const next = analyseDay([session(1, start, end, 5)], 'calicut', '2026-11-14');
    expect(next).toMatchObject({ complete: false, status: 'incomplete' });
    expect(checkBooking(next, { start_time: '00:00', end_time: '01:00', count: 1 }).status).toBe('unknown');
  });

  it('scopes source date and centre discrepancies to both implicated pools without adding source counts', () => {
    const rows = [session(1, '09:00', '10:00', 5)];
    const sources = [detail(5, { date: '2026-11-14', branch_location: 'cochin' })];
    const calendar = analyseDay(rows, 'calicut', date, sources);
    const sourceDate = analyseDay(rows, 'cochin', '2026-11-14', sources);
    expect(calendar).toMatchObject({ peak: 5, total: 5, complete: false });
    expect(sourceDate).toMatchObject({ peak: 0, total: 0, complete: false, status: 'incomplete' });
    expect(checkBooking(sourceDate, { start_time: '09:00', end_time: '10:00', count: 1 }).status).toBe('unknown');
  });

  it('blocks availability for an active source appointment whose Calendar reservation is missing', () => {
    const sources = [detail(40, { session_id: 99, date: '2026-11-14' })];
    const day = analyseDay([], 'calicut', '2026-11-14', sources);
    expect(day).toMatchObject({ complete: false, status: 'incomplete', peak: 0, total: 0 });
    expect(day.issues.some(issue => issue.kind === 'missing_calendar_session')).toBe(true);
    expect(checkBooking(day, { start_time: '09:00', end_time: '10:00', count: 1 }).status).toBe('unknown');
    expect(analyseDay([], 'cochin', '2026-11-14', sources).complete).toBe(true);
    expect(analyseDay([], 'calicut', date, sources).complete).toBe(true);
  });

  it('propagates an orphan overnight source interval onto its continuation date', () => {
    const next = analyseDay([], 'calicut', '2026-11-14', [detail(40, { session_id: 99, start_time: '23:00', end_time: '01:00' })]);
    expect(next).toMatchObject({ complete: false, status: 'incomplete' });
  });

  it('excludes cancelled and zero-count orphan source appointments from uncertainty', () => {
    const day = analyseDay([], 'calicut', date, [detail(40, { session_id: 99, status: 'cancelled' }), detail(0, { session_id: 100 })]);
    expect(day).toMatchObject({ complete: true, status: 'available', peak: 0, issues: [] });
  });
});
