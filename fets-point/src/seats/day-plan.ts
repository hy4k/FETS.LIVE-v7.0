import { analyseAtoms, analyseDay, sessionAtoms, toSeatSecond } from './engine';
import type { SeatAtomLimits, SeatBranch, SeatDayPlan, SeatDayPlanInput, SeatDetail, SeatIssue, SeatMove, SeatSession } from './types';

const validLimit = (value: number) => Number.isInteger(value) && value >= 0 && value <= 120;
const validLimits = (limits: SeatAtomLimits) => !!limits && validLimit(limits.earlier_minutes) && validLimit(limits.later_minutes) && (limits.locked === undefined || typeof limits.locked === 'boolean');

/** Local, review-only placement of complete verified exam groups. */
export function prepareDayPlan(sessions: SeatSession[], branch: SeatBranch, date: string, details: SeatDetail[], input: SeatDayPlanInput): SeatDayPlan {
  const original = analyseDay(sessions, branch, date, details);
  const initial = analyseDay(sessions, branch, date, details, input.capacity_windows);
  const issues = initial.issues.filter(issue => issue.blocking).map(issue => issue.message);
  const dayStart = toSeatSecond(date, '00:00');
  const windowStart = toSeatSecond(date, input.window_start), windowEnd = toSeatSecond(date, input.window_end);
  const clock = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.now) ? Date.parse(input.now) : NaN;
  const now = clock / 1000 + 5.5 * 3600;
  const validClock = Number.isFinite(now);
  const validWindow = dayStart !== null && windowStart !== null && windowEnd !== null && windowStart >= dayStart && windowStart < dayStart + 86400 && windowEnd <= dayStart + 86400 && windowEnd > windowStart;
  if (!validClock) issues.push('Use a valid current-time reference with an explicit timezone.');
  if (!validWindow) issues.push('Use a valid same-day planning window ending after its start.');
  const validDefaults = validLimit(input.earlier_minutes) && validLimit(input.later_minutes);
  if (!validDefaults) issues.push('Daily timing limits must be whole minutes from 0 to 120.');

  const selectedKeys = new Set(initial.atoms.map(atom => atom.key));
  const overrides = input.exam_limits || {};
  for (const [key, limits] of Object.entries(overrides)) {
    if (!selectedKeys.has(key)) issues.push('An exam limit refers to a reservation outside the current daily snapshot; refresh the plan.');
    else if (!validLimits(limits)) issues.push('Each exam needs whole-minute limits from 0 to 120 and a valid lock.');
  }
  const limits: Record<string, SeatAtomLimits> = {};
  let atoms = sessionAtoms(sessions, details).atoms.map(atom => {
    const selected = selectedKeys.has(atom.key);
    const uncertain = initial.issues.some(issue => issue.blocking && (issue.session_id === null || issue.session_id === atom.session_id));
    const fixed = !selected || !atom.movable || uncertain || !validClock || dayStart === null || atom.start <= now || atom.start < dayStart || atom.end > dayStart + 86400 || atom.date !== date;
    if (!selected) return { ...atom, movable: false };
    const override = overrides[atom.key];
    const configured = override && validLimits(override) ? { ...override } : { earlier_minutes: validDefaults ? input.earlier_minutes : 0, later_minutes: validDefaults ? input.later_minutes : 0 };
    limits[atom.key] = fixed || configured.locked ? { earlier_minutes: 0, later_minutes: 0, locked: true } : configured;
    return { ...atom, movable: !fixed && !configured.locked };
  });
  const proposed: SeatMove[] = [];
  for (const [key, startTime] of Object.entries(input.manual_starts || {})) {
    const atom = atoms.find(item => item.key === key && selectedKeys.has(key));
    if (!atom) {
      issues.push('A manual start refers to a reservation outside the current daily snapshot; refresh the plan.');
      continue;
    }
    const start = toSeatSecond(date, startTime);
    if (start === null) {
      issues.push(`Enter a valid manual start for ${atom.exam_name}.`);
      continue;
    }
    if (start === atom.start) continue;
    const end = start + atom.end - atom.start;
    const delta = start - atom.start;
    const permitted = limits[key];
    if (!atom.movable || permitted.locked) {
      issues.push(`${atom.exam_name} is fixed because it is locked, started, completed or crosses midnight.`);
    } else if (delta < -permitted.earlier_minutes * 60 || delta > permitted.later_minutes * 60) {
      issues.push(`The manual start for ${atom.exam_name} exceeds its permitted timing limits.`);
    } else if (!validWindow || dayStart === null || windowStart === null || windowEnd === null || start < windowStart || end > windowEnd || start < dayStart || start >= dayStart + 86400 || end > dayStart + 86400 || start <= now) {
      issues.push(`The complete ${atom.exam_name} interval must remain in the future within the same-day planning window.`);
    } else {
      proposed.push({ atom_key: atom.key, session_id: atom.session_id, provider: atom.provider, exam_code: atom.exam_code, exam_name: atom.exam_name, count: atom.count, minutes: delta / 60, before_start: atom.start, before_end: atom.end, after_start: start, after_end: end });
    }
  }
  // Validate the complete request before applying any placements. A stale key or
  // bad limit must never leave an apparently safe partial manual preview.
  const manual_moves = issues.length ? [] : proposed;
  if (manual_moves.length) {
    const moves = new Map(manual_moves.map(move => [move.atom_key, move]));
    atoms = atoms.map(atom => {
      const move = moves.get(atom.key);
      return move ? { ...atom, start: move.after_start, end: move.after_end, movable: false } : atom;
    });
  }
  const planningIssues: SeatIssue[] = issues.map(message => ({ session_id: null, kind: 'invalid_day_plan', message, blocking: true }));
  const day = analyseAtoms(atoms, branch, date, [...original.issues, ...planningIssues], input.capacity_windows);
  return { original, day, atoms, limits, manual_moves, issues: [...new Set(issues)] };
}
