import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, FileSpreadsheet, Loader2, Upload, UserPlus, X } from 'lucide-react';
import { formatDateForIST } from '../utils/dateUtils';
import { parsePearsonWorkbook } from './parse';
import { applyPearsonRoster, decidePearsonCancellation, listPearsonCancellationReviews, previewPearsonRoster } from './api';
import type { PearsonCancellation, PearsonParsedFile, PearsonPreview, PearsonReceipt } from './types';
import '../roster/calendar-roster.css';
import './pearson-import.css';

type Props = { day: string; branch: string; onClose: () => void; onModeChange: (mode: 'manual' | 'upload') => void };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : (error as { message?: string })?.message || 'The request failed. Preview again before saving.';
const monthBounds = (day: string) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : formatDateForIST(new Date());
  const [year, month] = date.split('-').map(Number);
  return { from: `${date.slice(0, 7)}-01`, through: `${date.slice(0, 7)}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` };
};

export default function PearsonImportDialog({ day, branch: initialBranch, onClose, onModeChange }: Props) {
  const queryClient = useQueryClient();
  const bounds = monthBounds(day);
  const [branch, setBranch] = useState(['cochin', 'calicut'].includes(initialBranch) ? initialBranch : '');
  const [from, setFrom] = useState(bounds.from), [through, setThrough] = useState(bounds.through);
  const [asOf, setAsOf] = useState(formatDateForIST(new Date())), [complete, setComplete] = useState(false);
  const [file, setFile] = useState<File | null>(null), [issues, setIssues] = useState<PearsonParsedFile['issues']>([]);
  const [preview, setPreview] = useState<PearsonPreview | null>(null), [receipt, setReceipt] = useState<PearsonReceipt | null>(null);
  const [candidateChoices, setCandidateChoices] = useState<Record<number, string>>({});
  const [sessionChoices, setSessionChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [reviews, setReviews] = useState<PearsonCancellation[]>([]), [reviewsBusy, setReviewsBusy] = useState(false), [reviewsError, setReviewsError] = useState('');
  const [selectedReview, setSelectedReview] = useState<PearsonCancellation | null>(null), [decisionMessage, setDecisionMessage] = useState('');
  const generation = useRef(0), reviewGeneration = useRef(0), mutating = useRef(false), mounted = useRef(true), dialog = useRef<HTMLElement>(null);

  const reset = () => {
    generation.current++;
    setPreview(null); setReceipt(null); setIssues([]); setCandidateChoices({}); setSessionChoices({}); setError(''); setBusy(false);
  };
  const refreshData = async () => {
    await Promise.all([['candidates'], ['sessions', 'calendar'], ['dashboardStats'], ['upcomingSchedule']].map(queryKey => queryClient.invalidateQueries({ queryKey })));
    window.dispatchEvent(new Event('fets-data-loaded'));
  };
  const loadReviews = async () => {
    const request = ++reviewGeneration.current;
    setReviews([]); setSelectedReview(null); setReviewsError(''); setReviewsBusy(true);
    if (!branch) { setReviewsBusy(false); return; }
    try {
      const result = await listPearsonCancellationReviews(branch);
      if (mounted.current && request === reviewGeneration.current) setReviews(result);
    } catch (e) { if (mounted.current && request === reviewGeneration.current) setReviewsError(errorMessage(e)); }
    finally { if (mounted.current && request === reviewGeneration.current) setReviewsBusy(false); }
  };
  useEffect(() => { void loadReviews(); return () => { reviewGeneration.current++; }; }, [branch]);
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { mounted.current = false; generation.current++; reviewGeneration.current++; previous?.focus(); };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !mutating.current) onClose(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  useEffect(() => {
    if (!preview) return;
    const timeout = window.setTimeout(() => {
      setPreview(null); setCandidateChoices({}); setSessionChoices({});
      setError('This preview has expired. Preview the report again before saving.');
    }, Math.max(0, Math.min(2_147_483_647, Date.parse(preview.expires_at) - Date.now())));
    return () => window.clearTimeout(timeout);
  }, [preview]);

  const unresolved = useMemo(() => preview ? preview.rows.filter(row => row.match_kind === 'review' && !candidateChoices[row.source_row]).length + preview.sessions.filter(session => session.match_kind === 'review' && !sessionChoices[session.group_key]).length : 0, [preview, candidateChoices, sessionChoices]);
  const duplicateBindings = useMemo(() => {
    if (!preview) return false;
    const candidateIds = preview.rows.map(row => row.match_kind === 'review' ? candidateChoices[row.source_row] : row.candidate_id).filter(id => id && id !== 'new');
    const calendarIds = preview.sessions.map(session => session.match_kind === 'review' ? sessionChoices[session.group_key] : String(session.calendar_id ?? '')).filter(id => id && id !== 'new');
    return new Set(candidateIds).size !== candidateIds.length || new Set(calendarIds).size !== calendarIds.length;
  }, [preview, candidateChoices, sessionChoices]);
  const dateTotals = useMemo(() => {
    const counts = new Map<string, number>();
    preview?.rows.forEach(row => counts.set(row.date, (counts.get(row.date) || 0) + 1));
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [preview]);
  const resolvedExisting = preview?.rows.filter(row => row.match_kind === 'exact' || (row.match_kind === 'review' && candidateChoices[row.source_row] && candidateChoices[row.source_row] !== 'new')) || [];
  const proposedNew = preview?.rows.filter(row => row.match_kind === 'new' || (row.match_kind === 'review' && candidateChoices[row.source_row] === 'new')).length || 0;
  const unresolvedBookings = preview?.rows.filter(row => row.match_kind === 'review' && !candidateChoices[row.source_row]).length || 0;
  const proposedUpdates = resolvedExisting.filter(row => row.match_kind === 'review' || row.changes.length > 0).length;
  const boundCandidateIds = new Set(preview?.rows.map(row => row.match_kind === 'review' ? candidateChoices[row.source_row] : row.candidate_id).filter(id => id && id !== 'new') || []);
  const visibleMissing = preview?.missing.filter(item => !boundCandidateIds.has(item.candidate_id)) || [];

  const review = async () => {
    if (mutating.current || busy) return;
    reset();
    if (!['cochin', 'calicut'].includes(branch)) return setError('Choose a concrete centre: Cochin or Calicut.');
    if (!from || !through || from > through || !asOf) return setError('Choose valid inclusive coverage dates and the source snapshot date.');
    if (!file || !/\.xlsx$/i.test(file.name)) return setError('Choose the original Pearson XLSX report.');
    if (file.size > 20 * 1024 * 1024) return setError('The XLSX report must be 20 MB or smaller.');
    const request = ++generation.current;
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (request !== generation.current || !mounted.current) return;
      const parsed = await parsePearsonWorkbook(file.name, bytes);
      if (request !== generation.current || !mounted.current) return;
      setIssues(parsed.issues);
      if (parsed.issues.some(issue => issue.level === 'error')) throw new Error('Correct the report errors before previewing or saving.');
      if (!parsed.rows.length) throw new Error('The report has no valid bookings.');
      if (parsed.rows.some(row => row.date < from || row.date > through)) throw new Error('Every report booking must fall within the selected inclusive coverage.');
      const result = await previewPearsonRoster({ branch, from, through, complete, source_as_of: asOf, filename: parsed.filename, file_hash: parsed.file_hash, rows: parsed.rows });
      if (request !== generation.current || !mounted.current) return;
      if (result.existing_receipt) setReceipt(result.existing_receipt);
      else setPreview(result);
    } catch (e) { if (request === generation.current && mounted.current) setError(errorMessage(e)); }
    finally { if (request === generation.current && mounted.current) setBusy(false); }
  };
  const apply = async () => {
    if (!preview || unresolved || duplicateBindings || mutating.current) return;
    if (Date.parse(preview.expires_at) <= Date.now()) { reset(); setError('This preview has expired. Preview the report again before saving.'); return; }
    mutating.current = true; setSaving(true); setError('');
    try {
      const result = await applyPearsonRoster(preview.preview_id,
        preview.rows.filter(row => row.match_kind === 'review').map(row => ({ source_row: row.source_row, candidate_id: candidateChoices[row.source_row] === 'new' ? null : candidateChoices[row.source_row] })),
        preview.sessions.filter(session => session.match_kind === 'review').map(session => ({ group_key: session.group_key, calendar_id: sessionChoices[session.group_key] === 'new' ? null : Number(sessionChoices[session.group_key]) })));
      if (mounted.current) { setReceipt(result); setPreview(null); }
      await refreshData();
      if (mounted.current) await loadReviews();
    } catch (e) {
      if (mounted.current) { setPreview(null); setCandidateChoices({}); setSessionChoices({}); setError(errorMessage(e)); }
    } finally { mutating.current = false; if (mounted.current) setSaving(false); }
  };
  const decide = async (decision: 'keep' | 'cancel') => {
    if (!selectedReview || mutating.current || (decision === 'cancel' && selectedReview.has_progress)) return;
    mutating.current = true; setSaving(true); setReviewsError(''); setDecisionMessage(''); reset();
    try {
      await decidePearsonCancellation(selectedReview, decision);
      if (mounted.current) setDecisionMessage(decision === 'keep' ? 'Booking kept and remains counted.' : 'Cancellation approved. Calendar totals refreshed.');
      await refreshData();
      if (mounted.current) await loadReviews();
    } catch (e) { if (mounted.current) { setSelectedReview(null); setReviewsError(errorMessage(e)); } }
    finally { mutating.current = false; if (mounted.current) setSaving(false); }
  };

  return createPortal(<div className="calendar-roster-backdrop"><section ref={dialog} className="calendar-roster-dialog pearson-import-dialog" role="dialog" aria-modal="true" aria-label="Pearson monthly report">
    <header><div><span className="cr-eyebrow">PEARSON VUE · MONTHLY REGISTRATIONS</span><h2>Review the whole report.</h2><p>Match bookings and calendar sessions before saving. Appointment times are in IST.</p></div><button aria-label="Close Pearson report" disabled={saving} onClick={() => { if (!mutating.current) onClose(); }}><X size={22}/></button></header>
    <div className="cr-content">
      <nav aria-label="Roster entry method"><button disabled={saving} onClick={() => onModeChange('upload')}><Upload size={17}/>Upload roster</button><button disabled={saving} onClick={() => onModeChange('manual')}><UserPlus size={17}/>Add by hand</button><button aria-pressed="true" disabled={saving}><FileSpreadsheet size={17}/>Pearson monthly report</button></nav>
      <fieldset disabled={saving}><div className="cr-fields">
        <label>Centre<select value={branch} onChange={event => { reset(); setDecisionMessage(''); setBranch(event.target.value); }}><option value="">Choose centre…</option><option value="cochin">Cochin</option><option value="calicut">Calicut</option></select></label>
        <label>Coverage from · inclusive<input type="date" value={from} onChange={event => { reset(); setFrom(event.target.value); }}/></label>
        <label>Coverage through · inclusive<input type="date" value={through} onChange={event => { reset(); setThrough(event.target.value); }}/></label>
        <label>Source snapshot as of<input type="date" value={asOf} onChange={event => { reset(); setAsOf(event.target.value); }}/></label>
      </div>
      <label className="pi-complete"><input type="checkbox" checked={complete} onChange={event => { reset(); setComplete(event.target.checked); }}/>This file is a complete snapshot of the selected coverage</label>
      <p>Declare complete coverage only for a full report. Missing future bookings enter review and remain counted until a cancellation is approved.</p>
      <label className="cr-file"><FileSpreadsheet size={27}/><span><strong>{file?.name || 'Choose the original Pearson report'}</strong><small>XLSX · up to 20 MB · merged date and appointment cells supported</small></span><input aria-label="Pearson XLSX report" type="file" accept=".xlsx" onChange={event => { reset(); const next = event.target.files?.[0] || null; if (next && !/\.xlsx$/i.test(next.name)) { setFile(null); setError('Choose a Pearson XLSX report.'); } else setFile(next); }}/></label>
      <button className="cr-primary" disabled={busy} onClick={review}>{busy ? <Loader2 size={16} className="animate-spin"/> : <ArrowRight size={16}/>} {busy ? 'Reading Pearson report…' : 'Preview Pearson report'}</button>
      </fieldset>
      {error && <p role="alert" className="cr-error">{error}</p>}
      {issues.length > 0 && <div className="cr-issues" aria-label="Workbook issues">{issues.map((issue, index) => <p key={index}>Row {issue.source_row}: {issue.level} · {issue.message}</p>)}</div>}
      {receipt && <section role="status" className="cr-success pi-receipt"><strong>{receipt.already_applied ? 'Previously applied report' : 'Pearson import saved'}</strong><p>{receipt.inserted} added · {receipt.updated} updated · {receipt.saved} bookings · {receipt.sessions} calendar sessions · {receipt.cancellation_reviews} cancellation reviews.</p><small>Receipt: {receipt.import_id}</small></section>}
      {preview && <section className="cr-review" aria-label="Pearson report preview"><div className="cr-review-heading"><div><span className="cr-eyebrow">REVIEW BEFORE SAVING · {preview.branch}</span><h3>{preview.counts.incoming} bookings · {proposedNew} new · {resolvedExisting.length} existing · {unresolvedBookings} need review</h3><p>{preview.from} through {preview.through} · {preview.counts.sessions} calendar sessions · {visibleMissing.length} potentially missing {visibleMissing.length === 1 ? 'booking' : 'bookings'}</p></div><span className="cr-pill">{unresolved} unresolved decisions</span></div>
        <p>{proposedUpdates} proposed {proposedUpdates === 1 ? 'update' : 'updates'} · {resolvedExisting.length - proposedUpdates} unchanged bookings</p>
        <div className="pi-date-totals" aria-label="Bookings by date">{dateTotals.map(([date, count]) => <span key={date}>{date} · {count} {count === 1 ? 'booking' : 'bookings'}</span>)}</div>
        {preview.warnings.length > 0 && <div className="cr-issues">{preview.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
        <p>Existing bookings retain their FETS ID, personal phone and operational progress. File phone numbers are retained separately.</p>
        <div className="cr-table-scroll"><table><thead><tr><th>Source row</th><th>Booking · IST</th><th>Candidate</th><th>Exam</th><th>Contact from report</th><th>Proposed change / resolution</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.source_row}><td>{row.source_row}</td><td>{row.date}<small>{row.start_time}–{row.end_time}</small></td><td>{row.full_name}<small>{row.candidate_id && `FETS ID: ${row.candidate_id}`}</small></td><td>{row.exam_code}<small>{row.exam_title} · {row.exam_owner}</small></td><td>{row.email || 'Email missing'}<small className="pi-source-phone">{row.phone ?? 'Phone missing'}</small></td><td><strong>{row.match_kind === 'new' ? 'New booking' : row.match_kind === 'exact' ? 'Existing booking' : candidateChoices[row.source_row] && candidateChoices[row.source_row] !== 'new' ? 'Reviewed existing booking — source details will be updated' : candidateChoices[row.source_row] === 'new' ? 'Reviewed new booking' : 'Review required'}</strong>{row.possible_candidates.filter(candidate => candidate.id === candidateChoices[row.source_row]).map(candidate => <small key={candidate.id}>Prior appointment: {candidate.date} {candidate.start_time} · {candidate.full_name}</small>)}{row.changes.map((change, index) => <small key={index}>{change}</small>)}{row.match_kind === 'review' && <select aria-label={`Booking resolution for row ${row.source_row}`} disabled={saving} value={candidateChoices[row.source_row] || ''} onChange={event => setCandidateChoices(previous => ({ ...previous, [row.source_row]: event.target.value }))}><option value="">Choose the booking…</option><option value="new">Create a new booking</option>{row.possible_candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.full_name} · {candidate.date} {candidate.start_time} · {candidate.exam_code || 'Code missing'} · {candidate.email || 'Email missing'} · {candidate.id}</option>)}</select>}</td></tr>)}</tbody></table></div>
        <h4>Calendar reconciliation · every source group</h4><div className="cr-table-scroll"><table><thead><tr><th>Date · IST</th><th>Exam owner</th><th>Incoming total</th><th>Session resolution</th></tr></thead><tbody>{preview.sessions.map(session => <tr key={session.group_key}><td>{session.date}<small>{session.start_time}–{session.end_time}</small></td><td>{session.exam_owner}</td><td>{session.candidate_count}</td><td>{session.match_kind === 'review' ? <select aria-label={`Session resolution for ${session.group_key}`} disabled={saving} value={sessionChoices[session.group_key] || ''} onChange={event => setSessionChoices(previous => ({ ...previous, [session.group_key]: event.target.value }))}><option value="">Choose the session…</option><option value="new">Create a new calendar session</option>{session.possible_sessions.map(candidate => <option key={candidate.id} value={candidate.id}>#{candidate.id} · {candidate.exam_name} · {candidate.date ? `${candidate.date} · ` : ''}{candidate.start_time}–{candidate.end_time} · {candidate.candidate_count} currently counted</option>)}</select> : session.match_kind === 'new' ? 'New calendar session' : `Reuse calendar #${session.calendar_id}`}</td></tr>)}</tbody></table></div>
        {visibleMissing.length > 0 && <section className="cr-issues" aria-label="Potential missing bookings"><strong>Potential missing future bookings · remain counted pending review</strong><p>Resolve booking choices to determine which missing future bookings need cancellation review. Choosing an existing booking removes it from this potential missing list.</p>{visibleMissing.map(missing => <p key={missing.id || missing.candidate_id}>{missing.full_name} · {missing.date} {missing.start_time} · {missing.exam_code}</p>)}</section>}
        {duplicateBindings && <p role="alert" className="cr-error">Each existing booking and calendar session can be used only once. Review the duplicate selections.</p>}
        <p className="cr-hint">Review every ambiguous booking and session, including an explicit new booking/session when appropriate. This preview expires at {new Date(preview.expires_at).toLocaleString()}.</p>
      </section>}
      <section className="cr-review" aria-label="Missing future booking reviews"><div className="cr-review-heading"><h3>Missing future bookings</h3><button className="pi-secondary" disabled={saving || reviewsBusy || !branch} onClick={() => void loadReviews()}>Refresh reviews</button></div><p>Pending bookings remain counted. Open each booking to keep it or approve cancellation.</p>
        {reviewsBusy && <p role="status">Loading cancellation reviews…</p>}{reviewsError && <p role="alert" className="cr-error">{reviewsError}</p>}{decisionMessage && <p role="status" className="cr-success">{decisionMessage}</p>}
        {!reviewsBusy && !reviewsError && !reviews.length && <p>No pending cancellation reviews for this centre.</p>}
        {reviews.map(item => <div className="pi-missing-row" key={item.id}><span><strong>{item.full_name}</strong><small>{item.date} · {item.start_time} · {item.exam_code}{item.has_progress ? ' · Operational progress recorded' : ''}</small></span><button className="pi-secondary" disabled={saving} onClick={() => { setSelectedReview(item); setDecisionMessage(''); }}>Review missing booking</button></div>)}
        {selectedReview && <section className="pi-decision" aria-label="Review missing booking"><h4>{selectedReview.full_name}</h4><p>{selectedReview.date} · {selectedReview.start_time} · {selectedReview.exam_code}</p><p>Pending bookings remain counted. Keep preserves this booking. Approve cancellation removes its active calendar membership and preserves the booking history.</p>{selectedReview.has_progress && <p>Operational progress is recorded. This booking cannot be cancelled here.</p>}<div><button className="pi-secondary" disabled={saving} onClick={() => void decide('keep')}>Keep booking</button><button className="pi-cancel" disabled={saving || selectedReview.has_progress} onClick={() => void decide('cancel')}>Approve cancellation</button><button className="pi-secondary" disabled={saving} onClick={() => setSelectedReview(null)}>Close review</button></div></section>}
      </section>
    </div>
    <footer><span>Candidate Tracker + Calendar · reviewed together</span><button className="cr-primary" disabled={!preview || unresolved > 0 || duplicateBindings || saving || busy} onClick={apply}>{saving ? <Loader2 size={17} className="animate-spin"/> : <CheckCircle2 size={17}/>} {saving ? 'Saving Pearson changes…' : 'Apply Pearson import'}</button></footer>
  </section></div>, document.body);
}
