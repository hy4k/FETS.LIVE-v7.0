import { analyseAtoms, analyseDay, normaliseProvider, seatBranch, sessionAtoms, toSeatSecond } from './engine';
import type { SeatAtom, SeatBranch, SeatDay, SeatDetail, SeatMove, SeatRule, SeatSession, SeatSolverOptions, SeatSuggestion, SeatSuggestions } from './types';

type Limits = { earlier: number; later: number; configured: boolean };
type SearchState = { moves: SeatMove[]; day: SeatDay; integral: number; people: number; shift: number; signature: string };
// Match the database's exam scopes exactly: case-insensitive and edge-trimmed.
const textKey = (value: string | null) => value?.trim().toUpperCase() || '';
const excessIntegral = (day: SeatDay) => day.overbooked.reduce((sum, segment) => sum + segment.excess * (segment.end - segment.start), 0);
const ruleLimit = (value: number) => Number.isInteger(value) && value >= 0 && value <= 120;

function limitsFor(atom: SeatAtom, rules: SeatRule[]): Limits {
  const providerRules = rules.filter(rule => normaliseProvider(rule.provider) === atom.provider);
  const code = atom.exam_code && providerRules.find(rule => textKey(rule.exam_code) === textKey(atom.exam_code) && !!textKey(rule.exam_code));
  const name = providerRules.find(rule => !!textKey(rule.exam_name) && textKey(rule.exam_name) === textKey(atom.exam_name));
  const fallback = providerRules.find(rule => !textKey(rule.exam_code) && !textKey(rule.exam_name));
  const matched = code || name || fallback;
  return matched ? { earlier: matched.earlier_minutes, later: matched.later_minutes, configured: true } : { earlier: 0, later: 0, configured: false };
}

function rank(a: SearchState, b: SearchState): number {
  const completeA = a.integral === 0, completeB = b.integral === 0;
  if (completeA !== completeB) return completeA ? -1 : 1;
  return (!completeA && a.integral - b.integral) || a.people - b.people || a.shift - b.shift || a.moves.length - b.moves.length || a.signature.localeCompare(b.signature);
}

function movedAtoms(original: SeatAtom[], moves: SeatMove[]): SeatAtom[] {
  const changes = new Map(moves.map(move => [move.atom_key, move]));
  return original.flatMap(atom => {
    const move = changes.get(atom.key);
    if (!move) return [atom];
    const retained = atom.count - move.count;
    return [
      ...(retained ? [{ ...atom, count: retained }] : []),
      { ...atom, key: `${atom.key}:shift:${move.minutes}`, start: move.after_start, end: move.after_end, count: move.count },
    ];
  });
}

/** Check every changed boundary, including the neighbouring dates in the input. */
function neverWorse(original: SeatAtom[], changed: SeatAtom[], capacity: number): boolean {
  const events = new Map<number, { before: number; after: number }>();
  const add = (at: number, count: number, side: 'before' | 'after') => {
    const event = events.get(at) || { before: 0, after: 0 };
    event[side] += count;
    events.set(at, event);
  };
  for (const atom of original) { add(atom.start, atom.count, 'before'); add(atom.end, -atom.count, 'before'); }
  for (const atom of changed) { add(atom.start, atom.count, 'after'); add(atom.end, -atom.count, 'after'); }
  let before = 0, after = 0;
  for (const [, event] of [...events].sort(([a], [b]) => a - b)) {
    before += event.before;
    after += event.after;
    if (Math.max(0, after - capacity) > Math.max(0, before - capacity)) return false;
  }
  return true;
}

function asSuggestion(state: SearchState, index: number): SeatSuggestion {
  return {
    id: `simulation-${index + 1}`, moves: state.moves, day: state.day, resolved: state.integral === 0,
    people_moved: state.people, seat_minutes: state.shift,
    remaining_excess: Math.max(0, state.day.peak - state.day.capacity),
    remaining_overload_seconds: state.day.overbooked.reduce((sum, segment) => sum + segment.end - segment.start, 0),
  };
}

/**
 * Bounded deterministic beam search. All moves are review-only simulations.
 * Calendar groups move together; agreed anonymous source groups may split while
 * their remaining members keep the original interval. This is not exhaustive.
 */
export function findSuggestions(sessions: SeatSession[], branch: SeatBranch, date: string, rules: SeatRule[], details: SeatDetail[] = [], options: SeatSolverOptions = {}): SeatSuggestions {
  const baseline = analyseDay(sessions, branch, date, details);
  const empty = (status: SeatSuggestions['status'], message: string): SeatSuggestions => ({ status, suggestions: [], evaluated: 0, limited: false, message });
  if (!baseline.complete) return empty('incomplete', 'Complete the missing or inconsistent reservations before trying timing changes.');
  const scopedRules = rules.filter(rule => seatBranch(rule.branch_location) === branch);
  const ruleScopes = new Set<string>();
  for (const rule of scopedRules) {
    const code = textKey(rule.exam_code), name = textKey(rule.exam_name);
    const scope = JSON.stringify([normaliseProvider(rule.provider || ''), code, name]);
    if (!normaliseProvider(rule.provider || '') || (code && name) || !ruleLimit(rule.earlier_minutes) || !ruleLimit(rule.later_minutes) || ruleScopes.has(scope)) {
      return empty('incomplete', 'Rules need unique provider/exam scopes and whole-minute limits from 0 to 120.');
    }
    ruleScopes.add(scope);
  }
  if (!baseline.overbooked.length) return empty('none', 'No recorded overload needs a timing change.');
  const dayStart = toSeatSecond(date, '00:00')!;
  const windowStart = options.window_start === undefined ? Math.max(dayStart, Math.min(...baseline.atoms.map(atom => atom.start))) : toSeatSecond(date, options.window_start);
  const windowEnd = options.window_end === undefined ? Math.min(dayStart + 86400, Math.max(...baseline.atoms.map(atom => atom.end))) : toSeatSecond(date, options.window_end);
  const clock = options.now === undefined ? Date.now() : /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(options.now) ? Date.parse(options.now) : NaN;
  // Convert an actual instant to the Asia/Kolkata local wall-clock day index.
  const now = clock / 1000 + 5.5 * 3600;
  if (windowStart === null || windowEnd === null || windowStart < dayStart || windowEnd > dayStart + 86400 || windowEnd <= windowStart || !Number.isFinite(now)) {
    return empty('incomplete', 'Use a valid same-day planning window and a valid current-time reference.');
  }
  const original = sessionAtoms(sessions, details).atoms.filter(atom => atom.branch === branch);
  // Cross-midnight reservations contribute occupancy on both dates, but this
  // same-day planner cannot authorise moving either their start or continuation.
  const futureAtoms = baseline.atoms.filter(atom => atom.movable && atom.start > now && atom.start >= dayStart && atom.end <= dayStart + 86400);
  const movable = futureAtoms.map(atom => ({ atom, limits: limitsFor(atom, scopedRules) })).filter(({ limits }) => limits.earlier || limits.later);
  if (!movable.length) {
    if (futureAtoms.some(atom => !limitsFor(atom, scopedRules).configured)) return empty('needs_rules', 'Unset provider/exam rules are fixed. Configure permitted limits before a simulation.');
    return empty('none', 'No movable reservation has a permitted timing change within these limits.');
  }
  const budget = Number.isInteger(options.max_evaluations) && options.max_evaluations! >= 0 ? Math.min(options.max_evaluations!, 20000) : 3000;
  const depthLimit = Number.isInteger(options.max_moves) && options.max_moves! >= 0 ? Math.min(options.max_moves!, 6) : 3;
  const baselineIntegral = excessIntegral(baseline);
  const initial: SearchState = { moves: [], day: baseline, integral: baselineIntegral, people: 0, shift: 0, signature: '' };
  let beam = [initial], evaluated = 0, limited = false;
  const seen = new Set<string>();
  const improvements: SearchState[] = [];
  const beamWidth = 24;

  search: for (let depth = 0; depth < depthLimit; depth++) {
    const next: SearchState[] = [];
    for (const state of beam) {
      for (const { atom, limits } of movable) {
        if (state.moves.some(move => move.atom_key === atom.key)) continue;
        // Critical seat counts bound subgroup branching without scanning a huge
        // reservation one person at a time; all counts remain source-authorised.
        const counts = atom.basis === 'source' ? [...new Set([1, atom.count, ...state.day.overbooked.map(segment => Math.min(atom.count, segment.excess))])].filter(count => count > 0).sort((a, b) => a - b) : [atom.count];
        if (atom.basis === 'source' && counts.length < atom.count) limited = true;
        const offsets = Array.from({ length: limits.earlier + limits.later + 1 }, (_, index) => index - limits.earlier).filter(minutes => minutes !== 0).sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
        for (const count of counts) for (const minutes of offsets) {
          const start = atom.start + minutes * 60, end = atom.end + minutes * 60;
          if (start < windowStart || end > windowEnd || start <= now) continue;
          const move: SeatMove = { atom_key: atom.key, session_id: atom.session_id, provider: atom.provider, exam_code: atom.exam_code, exam_name: atom.exam_name, count, minutes, before_start: atom.start, before_end: atom.end, after_start: start, after_end: end };
          const moves = [...state.moves, move].sort((a, b) => a.atom_key.localeCompare(b.atom_key));
          const signature = JSON.stringify(moves.map(item => [item.atom_key, item.count, item.minutes]));
          if (seen.has(signature)) continue;
          if (evaluated >= budget) { limited = true; break search; }
          seen.add(signature);
          evaluated++;
          const atoms = movedAtoms(original, moves);
          if (!neverWorse(original, atoms, baseline.capacity)) continue;
          const day = analyseAtoms(atoms, branch, date);
          const candidate: SearchState = { moves, day, integral: excessIntegral(day), people: moves.reduce((sum, item) => sum + item.count, 0), shift: moves.reduce((sum, item) => sum + item.count * Math.abs(item.minutes), 0), signature };
          if (candidate.integral < baselineIntegral) improvements.push(candidate);
          next.push(candidate);
        }
      }
    }
    next.sort(rank);
    if (next.length > beamWidth) limited = true;
    beam = next.slice(0, beamWidth);
    if (!beam.length) break;
    if (depth === depthLimit - 1 && beam.some(state => movable.some(({ atom }) => !state.moves.some(move => move.atom_key === atom.key)))) limited = true;
  }
  if (depthLimit === 0 || budget === 0) limited = true;
  improvements.sort(rank);
  const suggestions = improvements.slice(0, 3).map(asSuggestion);
  const status = suggestions.some(suggestion => suggestion.resolved) ? 'resolved' : suggestions.length ? 'partial' : 'none';
  const limitNote = ` Checked ${evaluated}/${budget} candidates, up to ${depthLimit} moves in whole minutes.`;
  return {
    status, suggestions, evaluated, limited,
    message: (status === 'resolved' ? 'Review these simulated timing changes within the configured limits; no bookings were changed.' : status === 'partial' ? 'A partial improvement was found within the search limits; the remaining overload still needs review.' : 'No solution found within these planning and search limits.') + limitNote,
  };
}
