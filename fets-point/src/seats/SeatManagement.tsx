import { useEffect, useMemo, useState } from 'react';
import { analyseDay, checkBooking, formatSeatTime, normaliseProvider, toSeatSecond } from './engine';
import { findSuggestions } from './solver';
import { useSeatContext } from './useSeatContext';
import SeatRules from './SeatRules';
import SeatTimeline, { seatEndTime, seatRange } from './SeatTimeline';
import type { BookingFit, SeatBranch, SeatContext, SeatDay, SeatRule, SeatSession, SeatSuggestions } from './types';
import './seat-management.css';

export type SeatManagementProps = {
  sessions: SeatSession[]; currentDate: Date; branch: string; userId: string;
  onSelectDate?: (date: Date) => void; onRefresh?: () => void;
  dataLoading?: boolean; dataError?: string; isFetching?: boolean;
};
const centreNames: Record<SeatBranch, string> = { calicut: 'Calicut', cochin: 'Kochi' };
const normalBranch = (value: string): SeatBranch | 'global' => value?.toLowerCase() === 'calicut' ? 'calicut' : ['cochin', 'kochi'].includes(value?.toLowerCase()) ? 'cochin' : 'global';
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateAt = (iso: string) => new Date(`${iso}T12:00:00`);
const offsetDate = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const dayLabel = (iso: string) => dateAt(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const statusLabel = (day: SeatDay) => day.overbooked.length ? 'Overbooked' : !day.complete ? 'Incomplete data' : day.full.length ? 'Full' : 'Below capacity';

function DayOverview({ day, uncertain }: { day: SeatDay; uncertain: boolean }) {
  const peak = day.segments.find(segment => segment.booked === day.peak);
  return <section className="seat-day" aria-label={`${centreNames[day.branch]} · booked seats`}>
    <div className="seat-day-heading"><div><p className="seat-eyebrow">{centreNames[day.branch]} · {dayLabel(day.date)}</p>
      <h3>{day.peak} / {day.capacity} seats{peak ? ` · ${seatRange(peak)}` : ''}</h3></div>
      <span className={`seat-tag seat-tag-${day.overbooked.length ? 'overbooked' : uncertain || !day.complete ? 'incomplete' : day.full.length ? 'full' : 'available'}`}>{uncertain && !day.overbooked.length ? 'Incomplete data' : statusLabel(day)}</span>
    </div>
    {day.overbooked.length > 0 ? <p className="seat-conflict-summary">{day.peak - day.capacity} seats over capacity</p> : day.full.length > 0 ? <p className="seat-full-summary">Full · no spare seats in this window</p> : !uncertain && day.complete && day.segments.length > 0 ? <p className="seat-muted">Peak booked seats across the recorded appointment span.</p> : null}
    {(uncertain || !day.complete) && <p className="seat-incomplete-note">Incomplete data · available seats cannot be confirmed. Known full or overloaded periods still need attention.</p>}
    <SeatTimeline day={day} uncertain={uncertain} />
    {day.issues.length > 0 && <div className="seat-issues" role="note"><strong>Schedule details to review</strong><ul>{day.issues.map((issue, index) => <li key={`${issue.session_id}-${index}`}>{issue.session_id !== null ? `Session #${issue.session_id}: ` : ''}{issue.message}</li>)}</ul></div>}
  </section>;
}

type WorkdayProps = { day: SeatDay; sessions: SeatSession[]; context?: SeatContext; unavailable: boolean; userId: string; onRuleSaved: (rule: SeatRule) => void };
function Workday({ day, sessions, context, unavailable, userId, onRuleSaved }: WorkdayProps) {
  const [bookingStart, setBookingStart] = useState('');
  const [bookingEnd, setBookingEnd] = useState('');
  const [bookingCount, setBookingCount] = useState('1');
  const [fit, setFit] = useState<BookingFit | null>(null);
  const first = day.segments[0]; const last = day.segments[day.segments.length - 1];
  const [windowStart, setWindowStart] = useState(first ? formatSeatTime(first.start) : '');
  const [windowEnd, setWindowEnd] = useState(last ? seatEndTime(last.end) : '');
  const [result, setResult] = useState<SeatSuggestions | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const rules = (context?.rules || []).filter(rule => rule.branch_location === day.branch);
  const blocked = unavailable || !day.complete;
  const hasRules = rules.some(rule => rule.earlier_minutes > 0 || rule.later_minutes > 0);
  const windowFrom = toSeatSecond(day.date, windowStart);
  const windowThrough = toSeatSecond(day.date, windowEnd);
  const validWindow = windowFrom !== null && windowThrough !== null && windowThrough > windowFrom && windowFrom < toSeatSecond(day.date, '24:00')!;
  const selectedSuggestion = result?.suggestions.find(suggestion => suggestion.id === selected);
  const clear = () => { setResult(null); setSelected(null); };
  const updateBooking = (setter: (value: string) => void, value: string) => { setter(value); setFit(null); clear(); };
  const onSaved = (rule: SeatRule) => { clear(); setFit(null); onRuleSaved(rule); };
  const providers = Array.from(new Set(sessions.filter(session => normalBranch(session.branch_location || '') === day.branch).map(session => normaliseProvider(session.client_name || '')).filter(Boolean))).sort();
  return <div className="seat-workday">
    <section className="seat-booking-check" aria-label="Check a booking">
      <div className="seat-section-heading"><h3>Check a booking</h3><span className="seat-muted">Across the whole interval</span></div>
      <form className="seat-input-row" onSubmit={event => { event.preventDefault(); if (!blocked) setFit(checkBooking(day, { start_time: bookingStart, end_time: bookingEnd, count: Number(bookingCount) })); }}>
        <label>Booking start<input aria-label="Booking start" type="time" step="1" value={bookingStart} onChange={event => updateBooking(setBookingStart, event.target.value)} required /></label>
        <label>Booking end<input aria-label="Booking end" type="time" step="1" value={bookingEnd} onChange={event => updateBooking(setBookingEnd, event.target.value)} required /></label>
        <label>Booking seats<input aria-label="Booking seats" type="number" min="1" step="1" value={bookingCount} onChange={event => updateBooking(setBookingCount, event.target.value)} required /></label>
        <button type="submit" className="seat-button" disabled={blocked}>Check booking fit</button>
      </form>
      {blocked && <p className="seat-muted">Complete and refresh the schedule before confirming a booking fit.</p>}
      {fit && <div className={`seat-fit seat-fit-${fit.status}`} role="status" aria-label="Booking fit result"><strong>{({ fits: 'Fits within planned capacity', full: 'Full at the tightest point', overbooked: 'Overbooked', unknown: 'Available seats unknown', invalid: 'Check booking inputs' })[fit.status]}</strong><p>{fit.message}</p>{fit.minimum_free !== null && <p>Minimum free before booking: {fit.minimum_free} seats · Peak after booking: {fit.peak_after} / {day.capacity}</p>}{fit.conflicts.length > 0 && <ul>{fit.conflicts.map((conflict, index) => <li key={index}>{seatRange(conflict)} · {conflict.booked} / {day.capacity} booked seats</li>)}</ul>}</div>}
    </section>
    <section className="seat-simulation" aria-label="Try timing changes">
      <div className="seat-section-heading"><h3>Try timing changes</h3><span className="seat-tag">Simulation</span></div>
      <p className="seat-muted">Search configured provider and exam limits while preserving exam duration. Recorded appointments set the initial planning window; enter the permitted day limits explicitly as HH:MM (24:00 for midnight).</p>
      <form className="seat-input-row" onSubmit={event => { event.preventDefault(); if (blocked || !hasRules || !validWindow) return; setSelected(null); setResult(findSuggestions(sessions, day.branch, day.date, rules, context?.details, { window_start: windowStart, window_end: windowEnd, now: new Date().toISOString(), max_evaluations: 3000, max_moves: 3 })); }}>
        <label>Planning window start<input aria-label="Planning window start" type="text" placeholder="HH:MM" value={windowStart} onChange={event => { setWindowStart(event.target.value); clear(); }} required /></label>
        <label>Planning window end<input aria-label="Planning window end" type="text" placeholder="HH:MM" value={windowEnd} onChange={event => { setWindowEnd(event.target.value); clear(); }} required /></label>
        <button type="submit" className="seat-button" disabled={blocked || !hasRules || !validWindow}>Find timing options</button>
      </form>
      {!hasRules && <p className="seat-incomplete-note">Timing options need explicit flexibility rules. All unconfigured exams are fixed at 0 / 0 minutes.</p>}
      {!validWindow && <p className="seat-muted">Set a valid start and end for the permitted planning window.</p>}
      <p className="seat-review-note">Review only · timing options never change Calendar sessions, source appointments or candidate bookings.</p>
      {result && <section className="seat-search-result" aria-label="Timing search result" aria-live="polite">
        <p><strong>{result.status === 'resolved' ? 'Options found within these limits' : result.status === 'partial' ? 'Partial improvements found' : result.status === 'needs_rules' ? 'Timing rules needed' : result.status === 'incomplete' ? 'Complete the schedule first' : 'No solution found within these limits'}</strong></p>
        <p className="seat-muted">{result.message}</p><p className="seat-muted">Bounded search · {result.evaluated.toLocaleString()} options evaluated{result.limited ? ' · search limit reached' : ''}. This is not an exhaustive proof of every possible schedule.</p>
        {result.suggestions.map((suggestion, index) => <article className={`seat-option ${selected === suggestion.id ? 'seat-option-selected' : ''}`} key={suggestion.id}>
          <div className="seat-section-heading"><h4>Option {index + 1} · {suggestion.resolved ? 'Overload resolved' : 'Partial improvement'}</h4><button type="button" className="seat-button seat-button-quiet" aria-pressed={selected === suggestion.id} onClick={() => setSelected(selected === suggestion.id ? null : suggestion.id)}>Review option {index + 1}</button></div>
          <p>{suggestion.people_moved} people moved · {suggestion.seat_minutes} seat-minutes shifted</p>
          <p className={suggestion.remaining_excess ? 'seat-error' : 'seat-muted'}>Remaining overload: {suggestion.remaining_excess} excess seats · {Math.round(suggestion.remaining_overload_seconds / 60 * 10) / 10} minutes</p>
          <ol className="seat-moves">{suggestion.moves.map(move => <li key={move.atom_key}><strong>{move.exam_name || move.exam_code || move.provider} · {move.count} {move.count === 1 ? 'person' : 'people'}</strong><span>{move.provider}{move.exam_code && ` · ${move.exam_code}`} · {move.minutes < 0 ? `${-move.minutes} min earlier` : `${move.minutes} min later`}</span><span>Before: {formatSeatTime(move.before_start)}–{seatEndTime(move.before_end)}</span><span>After: {formatSeatTime(move.after_start)}–{seatEndTime(move.after_end)}</span></li>)}</ol>
        </article>)}
        {selectedSuggestion && <div className="seat-before-after"><SeatTimeline day={day} label="Before" /><SeatTimeline day={selectedSuggestion.day} label="Simulated" /></div>}
      </section>}
    </section>
    <SeatRules branch={day.branch} rules={rules} canEdit={Boolean(context?.can_edit_rules && userId)} disabled={unavailable} providers={providers} onSaved={onSaved} onEditing={clear} />
  </div>;
}

export default function SeatManagement({ sessions, currentDate, branch, userId, onSelectDate, onRefresh, dataLoading = false, dataError, isFetching = false }: SeatManagementProps) {
  const [date, setDate] = useState(localDate(currentDate));
  const [centre, setCentre] = useState<SeatBranch | 'global'>(normalBranch(branch));
  const [savedAcknowledgement, setSavedAcknowledgement] = useState<string | null>(null);
  useEffect(() => { setSavedAcknowledgement(null); }, [date, centre, userId]);
  const currentTime = currentDate.getTime();
  useEffect(() => { setDate(localDate(currentDate)); }, [currentTime]);
  useEffect(() => { setCentre(normalBranch(branch)); }, [branch]);
  const monthFrom = `${date.slice(0, 7)}-01`;
  const monthThrough = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const contextQuery = useSeatContext(centre, offsetDate(monthFrom, -1), offsetDate(monthThrough, 1));
  const context = contextQuery.data;
  const combinedSessions = useMemo(() => {
    const extra = context?.adjacent_sessions || [];
    // The engine deduplicates identical rows and blocks conflicting copies.
    // Retaining both prevents a stale monthly row from hiding a fresh reservation.
    return [...sessions, ...extra];
  }, [sessions, context?.adjacent_sessions]);
  const centres: SeatBranch[] = centre === 'global' ? ['calicut', 'cochin'] : [centre];
  const days = centres.map(item => analyseDay(combinedSessions, item, date, context?.details));
  const contextError = contextQuery.isError ? contextQuery.error instanceof Error ? contextQuery.error.message : 'Timing rules and source details could not be loaded.' : null;
  const refreshing = isFetching || Boolean(contextQuery.isFetching);
  const unavailable = Boolean(dataLoading || dataError || contextQuery.isLoading || contextError || !context || refreshing);
  const attention = useMemo(() => {
    const list: SeatDay[] = [];
    for (let dayDate = monthFrom; dayDate <= monthThrough; dayDate = offsetDate(dayDate, 1)) {
      for (const item of centres) {
        const day = analyseDay(combinedSessions, item, dayDate, context?.details);
        if (day.full.length || day.overbooked.length || !day.complete) list.push(day);
      }
    }
    return list;
  }, [combinedSessions, centre, monthFrom, monthThrough, context?.details]);
  const chooseDate = (next: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return; setDate(next); onSelectDate?.(dateAt(next)); };
  // A refreshed source, rule, date, identity or input scope always starts a fresh review.
  const reviewKey = JSON.stringify([date, centre, userId, combinedSessions, context?.rules, context?.details, unavailable, refreshing]);
  return <section className="seat-management" aria-label="Calendar seat management">
    <header className="seat-header"><div><p className="seat-eyebrow">Calendar / shared workstation pools</p><h2>Seat management</h2><p className="seat-muted">All providers · scheduled start to end · seats release immediately at scheduled end · Asia/Kolkata</p></div><button type="button" className="seat-button seat-button-quiet" disabled={dataLoading || refreshing} onClick={() => { onRefresh?.(); void contextQuery.refetch(); }}>{refreshing ? 'Refreshing…' : 'Refresh schedule'}</button></header>
    <div className="seat-toolbar"><label>Centre<select aria-label="Seat management centre" value={centre} onChange={event => setCentre(event.target.value as SeatBranch | 'global')}>{normalBranch(branch) === 'global' ? <><option value="global">Both centres · separate pools</option><option value="calicut">Calicut · 40 seats</option><option value="cochin">Kochi · 31 seats</option></> : <option value={normalBranch(branch)}>{centreNames[normalBranch(branch) as SeatBranch]} · {normalBranch(branch) === 'calicut' ? 40 : 31} seats</option>}</select></label><label>Date<input aria-label="Seat management date" type="date" value={date} onChange={event => chooseDate(event.target.value)} /></label><span className="seat-muted">Booked-seat planning, based on the recorded schedule.</span></div>
    {dataLoading || contextQuery.isLoading ? <p role="status" className="seat-incomplete-note">Loading complete schedule and source context…</p> : null}
    {refreshing && <p role="status" className="seat-incomplete-note">Refreshing schedule · previous calculations need a fresh review.</p>}
    {(dataError || contextError) && <p role="alert" className="seat-error-banner">{dataError || contextError} Available seats and timing recommendations cannot be confirmed until the data refreshes.</p>}
    {savedAcknowledgement && <p role="status" className="seat-save-acknowledgement">{savedAcknowledgement}</p>}
    <div className="seat-layout"><aside className="seat-date-rail" aria-label="Dates needing attention"><div className="seat-section-heading"><h3>Month attention</h3><span>{attention.length}</span></div><p className="seat-muted">{dateAt(monthFrom).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} · full, overbooked or incomplete</p>{attention.length ? <ul>{attention.map(day => <li key={`${day.date}-${day.branch}`}><button type="button" className={`seat-alert-date ${date === day.date && (centre === 'global' || centre === day.branch) ? 'seat-alert-date-selected' : ''}`} onClick={() => chooseDate(day.date)} aria-current={date === day.date ? 'date' : undefined}><span><strong>{dateAt(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong><span>{centreNames[day.branch]}</span></span><span><strong>{day.peak} / {day.capacity}</strong><span>{statusLabel(day)}</span></span></button></li>)}</ul> : <p className="seat-empty">{unavailable ? 'Refresh to confirm month alerts.' : 'No known full or overloaded intervals this month.'}</p>}</aside>
      <div className="seat-main" key={reviewKey}>{days.map(day => <DayOverview key={day.branch} day={day} uncertain={unavailable} />)}{centre === 'global' ? <><p className="seat-incomplete-note">Choose one centre to check a booking or review timing changes. Each centre has its own shared pool.</p><SeatRules branch={null} rules={context?.rules || []} providers={[]} canEdit={false} onSaved={() => {}} /></> : <Workday day={days[0]} sessions={combinedSessions} context={context} unavailable={unavailable} userId={userId} onRuleSaved={rule => setSavedAcknowledgement(`Shared timing rule saved for ${centreNames[rule.branch_location]}. Run a fresh search to review timing options.`)} />}</div>
    </div>
  </section>;
}
