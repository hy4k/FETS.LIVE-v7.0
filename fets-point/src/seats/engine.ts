import type { BookingFit, BookingRequest, SeatAtom, SeatBranch, SeatDay, SeatDetail, SeatIssue, SeatSegment, SeatSession } from './types';

export function normaliseProvider(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ').toUpperCase();
  if (['CMA US', 'CMAUS', 'PRO', 'PROMETRIC'].includes(name)) return 'PROMETRIC';
  if (['VUE', 'PEARSON', 'PEARSONVUE', 'PEARSON VUE'].includes(name)) return 'PEARSON VUE';
  return name;
}

/** Local wall-clock seconds on a UTC day index, never a timezone conversion. */
export function toSeatSecond(date: string | null | undefined, time: string | null | undefined): number | null {
  if (typeof date !== 'string' || typeof time !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const day = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== date) return null;
  const match = /^(\d{2}):([0-5]\d)(?::([0-5]\d))?$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour > 24 || (hour === 24 && (minute || second))) return null;
  return day / 1000 + hour * 3600 + minute * 60 + second;
}

export function formatSeatTime(absoluteLocalSeconds: number): string {
  if (!Number.isFinite(absoluteLocalSeconds)) return '—';
  const seconds = ((Math.floor(absoluteLocalSeconds) % 86400) + 86400) % 86400;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}${seconds % 60 ? `:${pad(seconds % 60)}` : ''}`;
}

export function seatBranch(value: string | null | undefined): SeatBranch | null {
  const branch = value?.trim().toLowerCase();
  if (branch === 'calicut') return 'calicut';
  if (branch === 'cochin' || branch === 'kochi') return 'cochin';
  return null;
}

const statusKey = (value: string | null | undefined) => value?.trim().toLowerCase().replace(/[\s-]+/g, '_') || '';
const cancelled = (value: string | null | undefined) => ['cancelled', 'canceled'].includes(statusKey(value));
const frozen = (value: string | null | undefined) => ['in_progress', 'checked_in', 'running', 'ongoing', 'started', 'completed', 'complete', 'finished', 'conducted', 'closed', 'checked_out'].includes(statusKey(value));
const validCount = (count: number | null): count is number => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;

/** Source groups replace Calendar counts only when every scope and count agrees. */
export function sessionAtoms(sessions: SeatSession[], details: SeatDetail[] = []): { atoms: SeatAtom[]; issues: SeatIssue[] } {
  const atoms: SeatAtom[] = [];
  const issues: SeatIssue[] = [];
  const seen = new Map<number, string>();
  const detailGroups = new Map<number, SeatDetail[]>();
  for (const detail of details) detailGroups.set(detail.session_id, [...(detailGroups.get(detail.session_id) || []), detail]);
  const issue = (session_id: number, kind: string, message: string) => issues.push({ session_id, kind, message, blocking: true });

  for (const session of sessions) {
    const signature = JSON.stringify([session.date, seatBranch(session.branch_location) || session.branch_location, normaliseProvider(session.client_name || ''), session.exam_name, session.start_time, session.end_time, session.candidate_count, statusKey(session.status)]);
    const previous = seen.get(session.id);
    if (previous !== undefined) {
      if (previous !== signature) issue(session.id, 'duplicate_session', 'The same session ID has inconsistent reservations.');
      continue;
    }
    seen.set(session.id, signature);
    if (cancelled(session.status) || session.candidate_count === 0) continue;
    const branch = seatBranch(session.branch_location);
    const count = session.candidate_count;
    if (!branch) issue(session.id, 'unknown_branch', 'The reservation has no recognised centre.');
    if (!validCount(count)) issue(session.id, 'invalid_count', 'The reservation needs a nonnegative whole candidate count.');
    const dayStart = toSeatSecond(session.date, '00:00');
    const start = toSeatSecond(session.date, session.start_time || '');
    const end = toSeatSecond(session.date, session.end_time || '');
    if (dayStart === null || start === null || end === null || start >= dayStart + 86400 || end <= start) {
      issue(session.id, 'invalid_time', 'The reservation needs a valid date and explicit start/end with end after start.');
      continue;
    }
    if (!branch || !validCount(count)) continue;
    const atom: SeatAtom = {
      key: `${session.id}:calendar`, session_id: session.id, branch, date: session.date,
      provider: normaliseProvider(session.client_name || ''), exam_code: null,
      exam_name: session.exam_name?.trim() || 'Exam', start, end, count,
      movable: !frozen(session.status), basis: 'calendar',
    };
    const source = detailGroups.get(session.id);
    if (!source?.length) { atoms.push(atom); continue; }
    const active = source.filter(detail => !cancelled(detail.status));
    const agrees = active.length > 0 && active.every(detail =>
      seatBranch(detail.branch_location) === branch && detail.date === session.date &&
      !!detail.provider && normaliseProvider(detail.provider) === atom.provider &&
      toSeatSecond(detail.date, detail.start_time) === start && toSeatSecond(detail.date, detail.end_time) === end && validCount(detail.count)
    ) && active.reduce((sum, detail) => sum + detail.count, 0) === count;
    if (!agrees) {
      issue(session.id, 'source_detail_mismatch', 'Source exam groups disagree with the Calendar reservation; Calendar count retained.');
      atoms.push(atom);
      continue;
    }
    const ordered = [...active].sort((a, b) => JSON.stringify([a.exam_code, a.exam_title, a.status, a.count]).localeCompare(JSON.stringify([b.exam_code, b.exam_title, b.status, b.count])));
    ordered.forEach((detail, index) => {
      if (detail.count === 0) return;
      atoms.push({ ...atom, key: `${session.id}:source:${index}`, exam_code: detail.exam_code?.trim().toUpperCase() || null, exam_name: detail.exam_title?.trim() || atom.exam_name, count: detail.count, movable: atom.movable && !frozen(detail.status), basis: 'source' });
    });
  }
  return { atoms, issues };
}

/** Sweep all event boundaries; half-open intervals release seats at their end. */
export function analyseAtoms(atoms: SeatAtom[], branch: SeatBranch, date: string, issues: SeatIssue[] = []): SeatDay {
  const capacity = branch === 'calicut' ? 40 : 31;
  const start = toSeatSecond(date, '00:00');
  const dayIssues = start === null ? [...issues, { session_id: null, kind: 'invalid_date', message: 'Select a valid local date.', blocking: true }] : issues;
  const selected = start === null ? [] : atoms.filter(atom => atom.branch === branch && atom.start < start + 86400 && atom.end > start);
  const boundaries = start === null ? [] : [...new Set(selected.flatMap(atom => [Math.max(start, atom.start), Math.min(start + 86400, atom.end)]))].sort((a, b) => a - b);
  const segments: SeatSegment[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const from = boundaries[index], through = boundaries[index + 1];
    const active = selected.filter(atom => atom.start < through && atom.end > from);
    const booked = active.reduce((sum, atom) => sum + atom.count, 0);
    segments.push({ start: from, end: through, booked, free: capacity - booked, excess: Math.max(0, booked - capacity), session_ids: [...new Set(active.map(atom => atom.session_id))].sort((a, b) => a - b) });
  }
  const peak = Math.max(0, ...segments.map(segment => segment.booked));
  const complete = !dayIssues.some(issue => issue.blocking);
  return {
    branch, date, capacity, peak, complete, issues: dayIssues,
    status: peak > capacity ? 'overbooked' : !complete ? 'incomplete' : peak === capacity ? 'full' : 'available',
    segments, full: segments.filter(segment => segment.booked === capacity), overbooked: segments.filter(segment => segment.excess > 0),
    total: selected.reduce((sum, atom) => sum + atom.count, 0), atoms: selected,
  };
}

export function analyseDay(sessions: SeatSession[], branch: SeatBranch, date: string, details: SeatDetail[] = []): SeatDay {
  const { atoms, issues } = sessionAtoms(sessions, details);
  const scopedIds = new Set(sessions.filter(session => {
    const centre = seatBranch(session.branch_location);
    return (!centre || centre === branch) && (session.date === date || toSeatSecond(session.date, '00:00') === null);
  }).map(session => session.id));
  return analyseAtoms(atoms, branch, date, issues.filter(issue => issue.session_id === null || scopedIds.has(issue.session_id)));
}

export function checkBooking(day: SeatDay, request: BookingRequest): BookingFit {
  const start = toSeatSecond(day.date, request.start_time), end = toSeatSecond(day.date, request.end_time);
  const dayStart = toSeatSecond(day.date, '00:00');
  if (start === null || end === null || dayStart === null || start >= dayStart + 86400 || end <= start || !validCount(request.count) || request.count === 0) {
    return { status: 'invalid', minimum_free: null, peak_after: null, conflicts: [], message: 'Enter a positive whole count and a valid interval ending after its start.' };
  }
  const overlapping = day.segments.filter(segment => segment.start < end && segment.end > start);
  const minimum_free = Math.min(day.capacity, ...overlapping.map(segment => segment.free));
  const peak_after = day.capacity - minimum_free + request.count;
  const conflicts = overlapping.filter(segment => segment.booked + request.count > day.capacity).map(segment => ({ ...segment, start: Math.max(segment.start, start), end: Math.min(segment.end, end), booked: segment.booked + request.count, free: segment.free - request.count, excess: segment.booked + request.count - day.capacity }));
  if (request.count > day.capacity && !conflicts.length) conflicts.push({ start, end, booked: request.count, free: day.capacity - request.count, excess: request.count - day.capacity, session_ids: [] });
  if (peak_after > day.capacity) return { status: 'overbooked', minimum_free, peak_after, conflicts, message: 'This interval exceeds the shared seat capacity.' };
  if (!day.complete) return { status: 'unknown', minimum_free: null, peak_after: null, conflicts: [], message: 'Incomplete reservations prevent a safe fit result.' };
  return { status: peak_after === day.capacity ? 'full' : 'fits', minimum_free, peak_after, conflicts, message: peak_after === day.capacity ? 'The booking fits and exactly fills the shared pool.' : 'The booking fits throughout the requested interval.' };
}
