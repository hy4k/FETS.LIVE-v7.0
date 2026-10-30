import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Filter,
  Moon,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Sun,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './daily-operations-reports.css';

export type Kind = 'morning' | 'evening';
export type Status = 'green' | 'yellow' | 'red';
export type Answer = 'yes' | 'no' | 'unchecked';

export type DailyReportRecord = {
  id?: string;
  branch: string;
  day: string;
  kind: Kind;
  overall: Status;
  exam_client: string;
  expected_sessions: number | null;
  expected_candidates: number | null;
  attended: number | null;
  no_shows: number | null;
  checks: Record<string, Answer>;
  issues: string;
  action_taken: string;
  pending: string;
  manager_attention: boolean;
  submitted_by?: string;
  updated_by?: string;
  submitted_at?: string;
  updated_at?: string;
};

export const DAILY_CHECK_GROUPS: Record<Kind, { key: string; label: string; hint: string }[]> = {
  morning: [
    { key: 'systems', label: 'Systems / Server / RMA', hint: 'Workstations booted, admin server & RMA verified' },
    { key: 'cctv', label: 'CCTV / DVR / Internet', hint: 'All cameras recording, primary & backup net live' },
    { key: 'rooms', label: 'AC / Admin / Front Office', hint: 'Cooling, lighting, lockers & reception ready' },
    { key: 'roster', label: 'Roster / FETS.Live', hint: 'Staff checked in & day schedule verified' },
    { key: 'duties', label: 'Duties allocated', hint: 'Floor posts, proctoring & breaks assigned' },
  ],
  evening: [
    { key: 'monitoring', label: 'Hall walks / DVR checks', hint: 'All scheduled 10-min walks & 6-min DVR checks logged' },
    { key: 'checkin', label: 'Candidate check-in / out', hint: 'ID verification, biometrics & locker return complete' },
    { key: 'cpr', label: 'CPR / Client reports', hint: 'Center Problem Reports & client closeout submitted' },
    { key: 'records', label: 'FETS.Live / records updated', hint: 'Register, attendance & incident logs up to date' },
    { key: 'duties', label: 'Assigned duties completed', hint: 'Centre blueprint tasks & daily duties finished' },
    { key: 'signedout', label: 'Candidates signed out', hint: 'Every candidate signed out & exam hall cleared' },
    { key: 'closing', label: 'Closing checks completed', hint: 'Systems secured, AC/lights off & premises locked' },
  ],
};

const CENTRES = ['calicut', 'cochin'] as const;

const blank = (branch: string, day: string, kind: Kind): DailyReportRecord => ({
  branch: branch.toLowerCase(),
  day,
  kind,
  overall: 'green',
  exam_client: '',
  expected_sessions: null,
  expected_candidates: null,
  attended: null,
  no_shows: null,
  checks: {},
  issues: '',
  action_taken: '',
  pending: '',
  manager_attention: false,
});

const parseWholeNumber = (input: string): number | null => {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

const formatIstTime = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
};

const formatBranchName = (branch: string) =>
  branch ? branch.charAt(0).toUpperCase() + branch.slice(1).toLowerCase() : '';

export default function DailyOperationsReports({
  branch,
  day,
  profileId,
  staffName,
  isAdmin = false,
}: {
  branch: string;
  day: string;
  profileId?: string;
  staffName?: string;
  isAdmin?: boolean;
}) {
  const normalizedBranch = branch.toLowerCase();
  const [kind, setKind] = useState<Kind>('morning');
  const [records, setRecords] = useState<Partial<Record<Kind, DailyReportRecord>>>({});
  const [draft, setDraft] = useState<DailyReportRecord>(() => blank(normalizedBranch, day, 'morning'));
  const [staffDirectory, setStaffDirectory] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const existing = records[kind];
  const items = DAILY_CHECK_GROUPS[kind];

  const loadReports = useCallback(
    async (activeKind: Kind, keepDraft = false) => {
      setLoading(true);
      setError('');
      try {
        const [reportRes, staffRes] = await Promise.all([
          supabase
            .from('centre_daily_reports')
            .select('*')
            .eq('branch', normalizedBranch)
            .eq('day', day),
          supabase.from('staff_profiles').select('id,full_name'),
        ]);
        if (reportRes.error) throw reportRes.error;
        const map: Record<string, string> = {};
        for (const s of staffRes.data || []) {
          if (s?.id && s?.full_name) map[s.id] = s.full_name;
        }
        setStaffDirectory(map);

        const next: Partial<Record<Kind, DailyReportRecord>> = {};
        for (const item of reportRes.data || []) {
          next[item.kind as Kind] = item as DailyReportRecord;
        }
        setRecords(next);
        if (!keepDraft) {
          setDraft(next[activeKind] || blank(normalizedBranch, day, activeKind));
        }
      } catch (e: any) {
        setError(e?.message || 'Could not load daily reports. Check database migration.');
      } finally {
        setLoading(false);
      }
    },
    [normalizedBranch, day]
  );

  useEffect(() => {
    let live = true;
    setKind('morning');
    setNotice('');
    setError('');
    (async () => {
      if (!live) return;
      await loadReports('morning', false);
    })();
    return () => {
      live = false;
    };
  }, [normalizedBranch, day, loadReports]);

  const hasFailedCheck = useMemo(
    () => items.some(i => draft.checks[i.key] === 'no'),
    [items, draft.checks]
  );

  const failedCheckLabels = useMemo(
    () => items.filter(i => draft.checks[i.key] === 'no').map(i => i.label),
    [items, draft.checks]
  );

  const answered = useMemo(
    () => items.filter(i => draft.checks[i.key] === 'yes' || draft.checks[i.key] === 'no').length,
    [items, draft.checks]
  );

  const choose = (next: Kind) => {
    setKind(next);
    const saved = records[next];
    if (saved) {
      setDraft(saved);
    } else {
      // Carry over exam_client, expected_sessions, expected_candidates from morning report if switching to blank evening report
      const morningSource = records.morning;
      const fresh = blank(normalizedBranch, day, next);
      if (next === 'evening' && morningSource) {
        fresh.exam_client = morningSource.exam_client;
        fresh.expected_sessions = morningSource.expected_sessions;
        fresh.expected_candidates = morningSource.expected_candidates;
      }
      setDraft(fresh);
    }
    setNotice('');
    setError('');
  };

  const update = (value: Partial<DailyReportRecord>) => {
    setDraft(d => {
      const next = { ...d, ...value };
      const anyNo = DAILY_CHECK_GROUPS[next.kind].some(i => next.checks[i.key] === 'no');
      if (anyNo && next.overall === 'green') {
        next.overall = 'yellow';
      }
      return next;
    });
  };

  const setCheckAnswer = (key: string, answer: Answer) => {
    const nextChecks = { ...draft.checks, [key]: answer };
    const anyNo = items.some(i => nextChecks[i.key] === 'no');
    update({
      checks: nextChecks,
      overall: anyNo && draft.overall === 'green' ? 'yellow' : draft.overall,
    });
  };

  const confirmAllChecks = () => {
    const nextChecks: Record<string, Answer> = {};
    for (const item of items) nextChecks[item.key] = 'yes';
    update({ checks: nextChecks });
  };

  const autofillFromSchedule = async () => {
    setSyncingCalendar(true);
    setError('');
    setNotice('');
    try {
      const { data: sessions, error: sessErr } = await supabase
        .from('calendar_sessions')
        .select('*')
        .eq('date', day);
      if (sessErr) throw sessErr;
      const centreSessions = (sessions || []).filter(
        (s: any) =>
          s.status !== 'cancelled' &&
          String(s.branch_location || s.branch || '').toLowerCase().includes(normalizedBranch)
      );
      if (!centreSessions.length) {
        setNotice('No scheduled calendar sessions found for this centre on this date.');
        return;
      }
      const clients = Array.from(
        new Set(
          centreSessions
            .map((s: any) => [s.client_name, s.exam_name].filter(Boolean).join(' · ').trim())
            .filter(Boolean)
        )
      ).join(', ');
      const totalCandidates = centreSessions.reduce(
        (acc: number, s: any) => acc + (Number(s.candidate_count) || 0),
        0
      );
      update({
        exam_client: clients.slice(0, 160) || draft.exam_client,
        expected_sessions: Math.min(30, centreSessions.length),
        expected_candidates: Math.min(5000, totalCandidates),
      });
      setNotice(`Synced ${centreSessions.length} session(s) and ${totalCandidates} expected candidates from calendar.`);
    } catch (e: any) {
      setError(e?.message || 'Could not sync from centre calendar.');
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleAttendedChange = (val: string) => {
    const attended = parseWholeNumber(val);
    if (
      attended !== null &&
      attended >= 0 &&
      draft.expected_candidates !== null &&
      attended <= draft.expected_candidates &&
      (draft.no_shows === null || draft.attended === null || draft.attended + draft.no_shows === draft.expected_candidates)
    ) {
      update({ attended, no_shows: draft.expected_candidates - attended });
    } else {
      update({ attended });
    }
  };

  const save = async () => {
    setError('');
    setNotice('');
    const clientName = draft.exam_client.trim();
    if (!clientName) {
      setError('Enter the exam or client name.');
      return;
    }
    if (draft.expected_sessions === null || draft.expected_candidates === null) {
      setError('Enter sessions and expected candidates.');
      return;
    }
    if (
      !Number.isInteger(draft.expected_sessions) ||
      !Number.isInteger(draft.expected_candidates) ||
      draft.expected_sessions < 0 ||
      draft.expected_candidates < 0
    ) {
      setError('Numbers cannot be negative and must be whole numbers.');
      return;
    }
    if (draft.expected_sessions > 30) {
      setError('Expected sessions cannot exceed 30.');
      return;
    }
    if (draft.expected_candidates > 5000) {
      setError('Expected candidates cannot exceed 5000.');
      return;
    }
    if (items.some(i => !draft.checks[i.key] || draft.checks[i.key] === 'unchecked')) {
      setError('Complete every checklist item. Select Yes or No.');
      return;
    }
    if (hasFailedCheck && draft.overall === 'green') {
      setError('Overall centre status cannot be All clear (Green) when any required check is marked No.');
      return;
    }
    if (kind === 'evening') {
      if (draft.attended === null || draft.no_shows === null) {
        setError('Enter attendance and no-shows.');
        return;
      }
      if (
        !Number.isInteger(draft.attended) ||
        !Number.isInteger(draft.no_shows) ||
        draft.attended < 0 ||
        draft.no_shows < 0
      ) {
        setError('Attended and no-shows cannot be negative.');
        return;
      }
      if (draft.attended > draft.expected_candidates) {
        setError('Attended candidates cannot exceed expected candidates.');
        return;
      }
      if (draft.no_shows > draft.expected_candidates) {
        setError('No-shows cannot exceed expected candidates.');
        return;
      }
      if (draft.attended + draft.no_shows > draft.expected_candidates) {
        setError('Attended + no-shows exceeds expected candidates.');
        return;
      }
    }
    if ((draft.overall !== 'green' || hasFailedCheck) && !draft.issues.trim()) {
      setError('Describe the issue when any check fails or status is not green.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        branch: normalizedBranch,
        day,
        kind,
        overall: hasFailedCheck && draft.overall === 'green' ? 'yellow' : draft.overall,
        exam_client: clientName,
        expected_sessions: draft.expected_sessions,
        expected_candidates: draft.expected_candidates,
        attended: kind === 'evening' ? draft.attended : null,
        no_shows: kind === 'evening' ? draft.no_shows : null,
        checks: draft.checks,
        issues: draft.issues.trim(),
        action_taken: draft.action_taken.trim(),
        pending: draft.pending.trim(),
        manager_attention: draft.manager_attention,
      };

      // Lookup latest existing row byid or (branch, day, kind) to safely handle concurrent staff edits
      let targetId = existing?.id;
      if (!targetId) {
        const { data: found } = await supabase
          .from('centre_daily_reports')
          .select('id')
          .eq('branch', normalizedBranch)
          .eq('day', day)
          .eq('kind', kind)
          .maybeSingle();
        if (found?.id) targetId = found.id;
      }

      const query = targetId
        ? supabase.from('centre_daily_reports').update(payload).eq('id', targetId)
        : supabase
            .from('centre_daily_reports')
            .insert(profileId ? { ...payload, submitted_by: profileId } : payload);

      const { data, error: saveErr } = await query.select().single();
      if (saveErr) throw saveErr;
      const saved = data as DailyReportRecord;
      setRecords(r => ({ ...r, [kind]: saved }));
      setDraft(saved);
      setNotice(targetId ? 'Report updated successfully.' : 'Report submitted successfully.');
      window.dispatchEvent(new CustomEvent('fets-daily-report-saved', { detail: { branch: normalizedBranch, day, kind } }));
    } catch (e: any) {
      setError(e?.message || 'Could not save your report.');
    } finally {
      setSaving(false);
    }
  };

  const submitterName = existing?.submitted_by
    ? staffDirectory[existing.submitted_by] || (existing.submitted_by === profileId ? staffName || 'You' : 'Centre Staff')
    : null;
  const updaterName = existing?.updated_by
    ? staffDirectory[existing.updated_by] || (existing.updated_by === profileId ? staffName || 'You' : 'Centre Staff')
    : null;

  const unaccountedCandidates =
    kind === 'evening' &&
    draft.expected_candidates !== null &&
    draft.attended !== null &&
    draft.no_shows !== null &&
    draft.attended + draft.no_shows >= 0
      ? draft.expected_candidates - (draft.attended + draft.no_shows)
      : null;

  return (
    <section className="fets-daily" aria-label="Daily operations reports">
      <header className="fets-daily-hero">
        <div className="fets-daily-hero-copy">
          <div className="fets-daily-badge-row">
            <span className="fets-daily-kicker">FETS / OPERATIONS CONTROL</span>
            {existing ? (
              <span className={`fets-daily-pill is-${existing.overall}`}>
                ● {existing.overall === 'green' ? 'All Clear' : existing.overall === 'yellow' ? 'Attention' : 'Urgent'}
              </span>
            ) : (
              <span className="fets-daily-pill is-pending">Awaiting {kind === 'morning' ? 'Opening' : 'Closing'} Report</span>
            )}
          </div>
          <h2>
            Every shift. <em>Accounted for.</em>
          </h2>
          <p>Two quick reports. Clear answers. No missed issues across {formatBranchName(normalizedBranch)}.</p>
        </div>
        <div className="fets-daily-hero-right">
          <div className="fets-daily-location">
            <ClipboardCheck size={20} />
            <div>
              <strong>{normalizedBranch.toUpperCase()}</strong>
              <small>{day}</small>
            </div>
          </div>
        </div>
      </header>

      <div className="fets-daily-switch" role="tablist" aria-label="Shift report type">
        {(['morning', 'evening'] as const).map(k => {
          const rec = records[k];
          return (
            <button
              type="button"
              key={k}
              className={kind === k ? 'active' : ''}
              aria-pressed={kind === k}
              onClick={() => choose(k)}
            >
              <span className="fets-daily-switch-icon">{k === 'morning' ? <Sun size={18} /> : <Moon size={18} />}</span>
              <span className="fets-daily-switch-text">
                <strong>{k === 'morning' ? 'Opening readiness' : 'Evening summary'}</strong>
                <small>
                  {rec
                    ? `Saved · ${rec.overall === 'green' ? 'All clear' : rec.overall === 'yellow' ? 'Attention' : 'Urgent'}`
                    : k === 'morning'
                    ? 'Before admissions begin'
                    : 'After final session closes'}
                </small>
              </span>
              {rec && <CheckCircle2 size={18} className="fets-daily-done" />}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="fets-daily-message">
          <RefreshCw size={16} className="fets-daily-spin" /> Loading centre reports…
        </div>
      ) : (
        <>
          <div className="fets-daily-subheading">
            <div>
              <span>{kind === 'morning' ? '01 / BEFORE ADMISSIONS' : '02 / AFTER FINAL SESSION'}</span>
              <h3>{kind === 'morning' ? 'Ready for the day?' : 'How did the day go?'}</h3>
            </div>
            <div className="fets-daily-subheading-actions">
              <button
                type="button"
                className="fets-daily-ghost-btn"
                disabled={syncingCalendar}
                onClick={() => void autofillFromSchedule()}
                title="Pull exam clients, session count and candidate count from today's centre calendar"
              >
                <Sparkles size={14} /> {syncingCalendar ? 'Syncing…' : 'Sync from calendar'}
              </button>
              <button
                type="button"
                className="fets-daily-ghost-btn"
                onClick={confirmAllChecks}
                title="Mark all checklist items as Yes"
              >
                <CheckCircle2 size={14} /> Confirm all Yes
              </button>
              <small className="fets-daily-progress-pill">
                {answered}/{items.length} checks confirmed
              </small>
            </div>
          </div>

          <div className={`fets-daily-fields ${kind === 'evening' ? 'is-evening' : ''}`}>
            <label className="fets-daily-field-wide">
              Exam / client
              <input
                maxLength={160}
                placeholder="e.g. CMA US / Prometric / Pearson VUE"
                value={draft.exam_client}
                onChange={e => update({ exam_client: e.target.value })}
              />
            </label>
            <label>
              Sessions
              <input
                type="number"
                min="0"
                max="30"
                step="1"
                placeholder="0–30"
                value={draft.expected_sessions ?? ''}
                onChange={e => update({ expected_sessions: parseWholeNumber(e.target.value) })}
              />
            </label>
            <label>
              Expected candidates
              <input
                type="number"
                min="0"
                max="5000"
                step="1"
                placeholder="0"
                value={draft.expected_candidates ?? ''}
                onChange={e => update({ expected_candidates: parseWholeNumber(e.target.value) })}
              />
            </label>
            {kind === 'evening' && (
              <>
                <label>
                  Attended
                  <input
                    type="number"
                    min="0"
                    max={draft.expected_candidates ?? 5000}
                    step="1"
                    placeholder="0"
                    value={draft.attended ?? ''}
                    onChange={e => handleAttendedChange(e.target.value)}
                  />
                </label>
                <label>
                  No-shows
                  <input
                    type="number"
                    min="0"
                    max={draft.expected_candidates ?? 5000}
                    step="1"
                    placeholder="0"
                    value={draft.no_shows ?? ''}
                    onChange={e => update({ no_shows: parseWholeNumber(e.target.value) })}
                  />
                </label>
              </>
            )}
          </div>

          {kind === 'evening' && unaccountedCandidates !== null && (
            <div className={`fets-daily-tally ${unaccountedCandidates < 0 ? 'is-invalid' : unaccountedCandidates === 0 ? 'is-match' : 'is-partial'}`}>
              <span>
                Candidate reconciliation: <strong>{(draft.attended ?? 0) + (draft.no_shows ?? 0)}</strong> of{' '}
                <strong>{draft.expected_candidates ?? 0}</strong> accounted for
              </span>
              {unaccountedCandidates < 0 ? (
                <em>Exceeds expected candidates by {Math.abs(unaccountedCandidates)}</em>
              ) : unaccountedCandidates > 0 ? (
                <em>{unaccountedCandidates} candidate(s) not yet marked attended or no-show</em>
              ) : (
                <em>100% reconciled</em>
              )}
            </div>
          )}

          <div className="fets-daily-checks">
            {items.map(item => {
              const current = draft.checks[item.key] || 'unchecked';
              return (
                <div className={`fets-daily-check state-${current}`} key={item.key}>
                  <div className="fets-daily-check-copy">
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </div>
                  <div role="group" aria-label={item.label}>
                    {(['yes', 'no', 'unchecked'] as const).map(a => (
                      <button
                        type="button"
                        key={a}
                        aria-pressed={current === a}
                        className={current === a ? 'selected ' + a : ''}
                        onClick={() => setCheckAnswer(item.key, a)}
                      >
                        {a === 'yes' ? 'Yes' : a === 'no' ? 'No' : 'Not checked'}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="fets-daily-fields fets-daily-notes">
            <label>
              <span>
                Issues / incidents{' '}
                {(hasFailedCheck || draft.overall !== 'green') && <b className="fets-daily-req">Required</b>}
              </span>
              <textarea
                rows={2}
                maxLength={2000}
                placeholder={
                  hasFailedCheck
                    ? `Describe what failed (${failedCheckLabels.join(', ')})`
                    : 'Write None if all clear'
                }
                value={draft.issues}
                onChange={e => update({ issues: e.target.value })}
              />
            </label>
            <label>
              <span>Action taken</span>
              <textarea
                rows={2}
                maxLength={2000}
                placeholder="What did you do to resolve or mitigate?"
                value={draft.action_taken}
                onChange={e => update({ action_taken: e.target.value })}
              />
            </label>
            <label>
              <span>Pending / next shift</span>
              <textarea
                rows={2}
                maxLength={2000}
                placeholder="Anything left to finish or follow up?"
                value={draft.pending}
                onChange={e => update({ pending: e.target.value })}
              />
            </label>
          </div>

          <div className="fets-daily-bottom">
            <div className="fets-daily-status">
              <span>Overall centre status</span>
              <div>
                {(['green', 'yellow', 'red'] as const).map(s => {
                  const blockedGreen = s === 'green' && hasFailedCheck;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={blockedGreen}
                      title={
                        blockedGreen
                          ? 'Cannot select All clear when a required check is marked No'
                          : undefined
                      }
                      className={`${draft.overall === s ? 'on ' + s : ''} ${blockedGreen ? 'is-blocked' : ''}`.trim()}
                      aria-pressed={draft.overall === s}
                      onClick={() => update({ overall: s })}
                    >
                      {s === 'green' ? '● All clear' : s === 'yellow' ? '● Attention' : '● Urgent'}
                    </button>
                  );
                })}
              </div>
              {hasFailedCheck && (
                <small className="fets-daily-status-hint">
                  All clear (Green) is locked because {failedCheckLabels.length} check{failedCheckLabels.length > 1 ? 's' : ''} failed ({failedCheckLabels.join(', ')}).
                </small>
              )}
            </div>

            <label className={`fets-daily-attention ${draft.manager_attention ? 'is-flagged' : ''}`}>
              <input
                type="checkbox"
                checked={draft.manager_attention}
                onChange={e => update({ manager_attention: e.target.checked })}
              />
              <UserCheck size={18} />
              <span>Manager attention needed</span>
            </label>
          </div>

          {(draft.overall === 'red' || draft.manager_attention) && (
            <p className="fets-daily-warning">
              <AlertTriangle size={16} /> For urgent issues, contact the manager immediately. This report is not an emergency alert.
            </p>
          )}
          {error && (
            <p className="fets-daily-error" role="alert">
              <XCircle size={16} /> <span>{error}</span>
            </p>
          )}
          {notice && (
            <p className="fets-daily-success" role="status">
              <CheckCircle2 size={16} /> <span>{notice}</span>
            </p>
          )}

          <footer className="fets-daily-footer">
            <div className="fets-daily-meta">
              {existing?.submitted_at ? (
                <>
                  <span>
                    Submitted by <strong>{submitterName}</strong> · {formatIstTime(existing.submitted_at)} IST
                  </span>
                  {existing.updated_at &&
                    existing.updated_at !== existing.submitted_at && (
                      <small>
                        Last updated{updaterName ? ` by ${updaterName}` : ''} · {formatIstTime(existing.updated_at)} IST
                      </small>
                    )}
                </>
              ) : (
                <span>
                  Your name{staffName ? ` (${staffName})` : ''} and submission time are recorded. Any centre staff member or lead can update this report.
                </span>
              )}
            </div>
            <button type="button" disabled={saving} onClick={() => void save()}>
              <Save size={17} />
              {saving ? 'Saving…' : existing ? 'Update report' : 'Submit report'}
            </button>
          </footer>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Manager Operations Dashboard: Daily Reports, Issues & Pending Work         */
/* Across Calicut & Cochin                                                    */
/* -------------------------------------------------------------------------- */

export function ManagerDailyOperationsDashboard({
  day,
  onDayChange,
  onSelectCentre,
  activeBranch = 'global',
}: {
  day: string;
  onDayChange?: (nextDay: string) => void;
  onSelectCentre?: (branch: string, day: string) => void;
  activeBranch?: string;
}) {
  const [reports, setReports] = useState<DailyReportRecord[]>([]);
  const [recentReports, setRecentReports] = useState<DailyReportRecord[]>([]);
  const [dayTasks, setDayTasks] = useState<any[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [centreFilter, setCentreFilter] = useState<'all' | 'calicut' | 'cochin'>(
    activeBranch === 'calicut' || activeBranch === 'cochin' ? activeBranch : 'all'
  );
  const [viewFilter, setViewFilter] = useState<'all' | 'attention' | 'pending' | 'issues'>('all');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (activeBranch === 'calicut' || activeBranch === 'cochin') {
      setCentreFilter(activeBranch);
    } else {
      setCentreFilter('all');
    }
  }, [activeBranch]);

  useEffect(() => {
    const onSaved = () => setRefreshTick(x => x + 1);
    window.addEventListener('fets-daily-report-saved', onSaved);
    return () => window.removeEventListener('fets-daily-report-saved', onSaved);
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        // Compute 14-day window ending on `day` for open issues & pending follow-ups across centres
        const endDate = new Date(`${day}T12:00:00Z`);
        const startDate = new Date(endDate);
        startDate.setUTCDate(startDate.getUTCDate() - 13);
        const startStr = startDate.toISOString().slice(0, 10);

        const [dayRes, recentRes, tasksRes, staffRes] = await Promise.all([
          supabase
            .from('centre_daily_reports')
            .select('*')
            .eq('day', day)
            .order('branch', { ascending: true }),
          supabase
            .from('centre_daily_reports')
            .select('*')
            .gte('day', startStr)
            .lte('day', day)
            .order('day', { ascending: false })
            .order('updated_at', { ascending: false }),
          supabase
            .from('centre_day_tasks')
            .select('*')
            .eq('day', day)
            .in('status', ['open', 'blocked', 'carried']),
          supabase.from('staff_profiles').select('id,full_name'),
        ]);

        if (dayRes.error) throw dayRes.error;
        if (!live) return;

        const map: Record<string, string> = {};
        for (const s of staffRes.data || []) {
          if (s?.id && s?.full_name) map[s.id] = s.full_name;
        }
        setStaffMap(map);
        setReports((dayRes.data || []) as DailyReportRecord[]);
        setRecentReports(((recentRes.data || dayRes.data || []) as DailyReportRecord[]));
        setDayTasks(tasksRes.data || []);
      } catch (e: any) {
        if (live) setError(e?.message || 'Could not load centre daily reports.');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [day, refreshTick]);

  const visibleCentres = useMemo(
    () => (centreFilter === 'all' ? [...CENTRES] : [centreFilter]),
    [centreFilter]
  );

  const byCentre = useMemo(() => {
    const map: Record<string, { morning?: DailyReportRecord; evening?: DailyReportRecord }> = {
      calicut: {},
      cochin: {},
    };
    for (const r of reports) {
      const b = r.branch.toLowerCase();
      if (!map[b]) map[b] = {};
      map[b][r.kind] = r;
    }
    return map;
  }, [reports]);

  const summaryMetrics = useMemo(() => {
    const filteredDay = reports.filter(r => centreFilter === 'all' || r.branch === centreFilter);
    const totalExpected = CENTRES.filter(c => centreFilter === 'all' || c === centreFilter).reduce((sum, c) => {
      const pair = byCentre[c] || {};
      const count = pair.evening?.expected_candidates ?? pair.morning?.expected_candidates ?? 0;
      return sum + count;
    }, 0);
    const totalAttended = CENTRES.filter(c => centreFilter === 'all' || c === centreFilter).reduce((sum, c) => {
      const pair = byCentre[c] || {};
      return sum + (pair.evening?.attended ?? 0);
    }, 0);
    const totalNoShows = CENTRES.filter(c => centreFilter === 'all' || c === centreFilter).reduce((sum, c) => {
      const pair = byCentre[c] || {};
      return sum + (pair.evening?.no_shows ?? 0);
    }, 0);
    const attentionCount = filteredDay.filter(r => r.manager_attention || r.overall !== 'green').length;
    const pendingCount = filteredDay.filter(r => r.pending && r.pending.trim().toLowerCase() !== 'none').length;
    return {
      submittedCount: filteredDay.length,
      expectedReports: visibleCentres.length * 2,
      totalExpected,
      totalAttended,
      totalNoShows,
      attentionCount,
      pendingCount,
    };
  }, [reports, byCentre, centreFilter, visibleCentres]);

  const feedItems = useMemo(() => {
    return recentReports.filter(r => {
      if (centreFilter !== 'all' && r.branch !== centreFilter) return false;
      const hasIssue =
        (r.issues && r.issues.trim() !== '' && r.issues.trim().toLowerCase() !== 'none') ||
        Object.values(r.checks || {}).includes('no');
      const hasPending = r.pending && r.pending.trim() !== '' && r.pending.trim().toLowerCase() !== 'none';
      const needsAttention = r.manager_attention || r.overall !== 'green';

      if (viewFilter === 'attention') return needsAttention;
      if (viewFilter === 'pending') return hasPending;
      if (viewFilter === 'issues') return hasIssue;
      return needsAttention || hasPending || hasIssue || r.day === day;
    });
  }, [recentReports, centreFilter, viewFilter, day]);

  const openCentreTasks = useMemo(
    () => dayTasks.filter(t => centreFilter === 'all' || String(t.branch || '').toLowerCase() === centreFilter),
    [dayTasks, centreFilter]
  );

  const staffNameOf = (id?: string) => (id && staffMap[id]) || 'Centre Staff';

  return (
    <section className="fets-manager-board" aria-label="Manager daily operations dashboard">
      <header className="fets-mgr-hero">
        <div>
          <span className="fets-daily-kicker">FETS / EXECUTIVE COMMAND · CALICUT & COCHIN</span>
          <h2>
            Centre Operations <em>Overview.</em>
          </h2>
          <p>
            Morning readiness, end-of-day reconciliation, escalations and pending handover work from both centres.
          </p>
        </div>
        <div className="fets-mgr-controls">
          {onDayChange && (
            <label className="fets-mgr-date">
              <Calendar size={15} />
              <input
                type="date"
                aria-label="Dashboard date"
                value={day}
                onChange={e => {
                  if (e.target.value) onDayChange(e.target.value);
                }}
              />
            </label>
          )}
          <div className="fets-mgr-pills" role="group" aria-label="Filter by centre">
            {(['all', 'calicut', 'cochin'] as const).map(c => (
              <button
                key={c}
                type="button"
                className={centreFilter === c ? 'active' : ''}
                onClick={() => setCentreFilter(c)}
              >
                {c === 'all' ? 'Both Centres' : formatBranchName(c)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="fets-mgr-refresh"
            onClick={() => setRefreshTick(x => x + 1)}
            disabled={loading}
            aria-label="Refresh manager dashboard"
          >
            <RefreshCw size={15} className={loading ? 'fets-daily-spin' : ''} />
          </button>
        </div>
      </header>

      {error && (
        <p className="fets-daily-error" role="alert">
          <XCircle size={16} /> <span>{error}</span>
        </p>
      )}

      <div className="fets-mgr-kpis">
        <div className="fets-mgr-kpi">
          <span>Reports filed ({day})</span>
          <strong>
            {summaryMetrics.submittedCount}
            <small> / {summaryMetrics.expectedReports}</small>
          </strong>
          <small>Morning & evening across {centreFilter === 'all' ? 'Calicut + Cochin' : formatBranchName(centreFilter)}</small>
        </div>
        <div className="fets-mgr-kpi">
          <span>Candidates (Attended / Expected)</span>
          <strong>
            {summaryMetrics.totalAttended}
            <small> / {summaryMetrics.totalExpected}</small>
          </strong>
          <small>{summaryMetrics.totalNoShows} no-shows recorded</small>
        </div>
        <div className={`fets-mgr-kpi ${summaryMetrics.attentionCount > 0 ? 'is-alert' : ''}`}>
          <span>Manager attention / alerts</span>
          <strong>{summaryMetrics.attentionCount}</strong>
          <small>{summaryMetrics.attentionCount > 0 ? 'Requires review or escalation' : 'All submitted shifts green'}</small>
        </div>
        <div className={`fets-mgr-kpi ${summaryMetrics.pendingCount + openCentreTasks.length > 0 ? 'is-warn' : ''}`}>
          <span>Pending items & open jobs</span>
          <strong>{summaryMetrics.pendingCount + openCentreTasks.length}</strong>
          <small>
            {summaryMetrics.pendingCount} shift follow-up(s) · {openCentreTasks.length} open job(s)
          </small>
        </div>
      </div>

      <div className="fets-mgr-centres">
        {visibleCentres.map(centre => {
          const pair = byCentre[centre] || {};
          return (
            <article className="fets-mgr-centre-card" key={centre}>
              <header className="fets-mgr-centre-head">
                <div>
                  <span className="fets-daily-kicker">CENTRE STATUS · {day}</span>
                  <h3>
                    <Building2 size={18} /> {formatBranchName(centre)}
                  </h3>
                </div>
                {onSelectCentre && (
                  <button
                    type="button"
                    className="fets-daily-ghost-btn"
                    onClick={() => onSelectCentre(centre, day)}
                  >
                    Open {formatBranchName(centre)} Shift ↗
                  </button>
                )}
              </header>

              <div className="fets-mgr-shift-pair">
                {(['morning', 'evening'] as const).map(k => {
                  const rep = pair[k];
                  const groups = DAILY_CHECK_GROUPS[k];
                  const failed = rep
                    ? groups.filter(g => rep.checks?.[g.key] === 'no')
                    : [];
                  const passed = rep
                    ? groups.filter(g => rep.checks?.[g.key] === 'yes').length
                    : 0;
                  return (
                    <div
                      key={k}
                      className={`fets-mgr-report-slot ${rep ? `status-${rep.overall}` : 'is-missing'}`}
                    >
                      <div className="fets-mgr-slot-top">
                        <span className="fets-mgr-slot-title">
                          {k === 'morning' ? <Sun size={15} /> : <Moon size={15} />}
                          {k === 'morning' ? 'Morning Readiness' : 'Evening Summary'}
                        </span>
                        {rep ? (
                          <span className={`fets-daily-pill is-${rep.overall}`}>
                            ● {rep.overall === 'green' ? 'All Clear' : rep.overall === 'yellow' ? 'Attention' : 'Urgent'}
                          </span>
                        ) : (
                          <span className="fets-daily-pill is-pending">Not submitted</span>
                        )}
                      </div>

                      {!rep ? (
                        <p className="fets-mgr-empty-slot">
                          No {k} report submitted for {formatBranchName(centre)} on {day}.
                        </p>
                      ) : (
                        <>
                          <div className="fets-mgr-slot-stats">
                            <div>
                              <small>Exam / Client</small>
                              <strong>{rep.exam_client || '—'}</strong>
                            </div>
                            <div>
                              <small>Sessions</small>
                              <strong>{rep.expected_sessions ?? 0}</strong>
                            </div>
                            <div>
                              <small>Candidates</small>
                              <strong>
                                {k === 'evening'
                                  ? `${rep.attended ?? 0}/${rep.expected_candidates ?? 0} (${rep.no_shows ?? 0} NS)`
                                  : `${rep.expected_candidates ?? 0} expected`}
                              </strong>
                            </div>
                            <div>
                              <small>Checklist</small>
                              <strong>
                                {passed}/{groups.length} Yes
                              </strong>
                            </div>
                          </div>

                          {rep.manager_attention && (
                            <div className="fets-mgr-flag">
                              <ShieldAlert size={14} /> Flagged for Manager Attention
                            </div>
                          )}

                          {failed.length > 0 && (
                            <div className="fets-mgr-failed-checks">
                              <span>Failed checks:</span>
                              {failed.map(f => (
                                <b key={f.key}>{f.label}</b>
                              ))}
                            </div>
                          )}

                          {rep.issues && rep.issues.toLowerCase() !== 'none' && (
                            <div className="fets-mgr-note is-issue">
                              <span>Issues / Incidents:</span>
                              <p>{rep.issues}</p>
                            </div>
                          )}

                          {rep.action_taken && rep.action_taken.toLowerCase() !== 'none' && (
                            <div className="fets-mgr-note">
                              <span>Action Taken:</span>
                              <p>{rep.action_taken}</p>
                            </div>
                          )}

                          {rep.pending && rep.pending.toLowerCase() !== 'none' && (
                            <div className="fets-mgr-note is-pending">
                              <span>Pending / Next Shift:</span>
                              <p>{rep.pending}</p>
                            </div>
                          )}

                          <footer className="fets-mgr-slot-foot">
                            <span>
                              By <strong>{staffNameOf(rep.submitted_by)}</strong> · {formatIstTime(rep.submitted_at)}
                            </span>
                            {rep.updated_by && rep.updated_at !== rep.submitted_at && (
                              <span>Updated by {staffNameOf(rep.updated_by)}</span>
                            )}
                          </footer>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      <div className="fets-mgr-bottom-grid">
        <div className="fets-mgr-feed-card">
          <div className="fets-mgr-feed-head">
            <div>
              <span className="fets-daily-kicker">ISSUES, ESCALATIONS & FOLLOW-UPS (LAST 14 DAYS)</span>
              <h3>Reported Issues & Pending Handover Work</h3>
            </div>
            <div className="fets-mgr-pills" role="group" aria-label="Filter issues and pending work">
              {(
                [
                  ['all', 'All Recent'],
                  ['attention', 'Manager Attention'],
                  ['issues', 'Issues'],
                  ['pending', 'Pending Work'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={viewFilter === id ? 'active' : ''}
                  onClick={() => setViewFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {feedItems.length === 0 ? (
            <p className="fets-mgr-empty">No matching reports or escalations in this view.</p>
          ) : (
            <ul className="fets-mgr-feed-list">
              {feedItems.slice(0, 12).map(item => (
                <li key={item.id || `${item.branch}-${item.day}-${item.kind}`} className="fets-mgr-feed-row">
                  <div className="fets-mgr-feed-meta">
                    <span className="fets-mgr-centre-tag">{item.branch.toUpperCase()}</span>
                    <span>{item.day}</span>
                    <span>{item.kind === 'morning' ? 'Morning' : 'Evening'}</span>
                    <span className={`fets-daily-pill is-${item.overall}`}>
                      ● {item.overall.toUpperCase()}
                    </span>
                    {item.manager_attention && (
                      <span className="fets-mgr-attention-badge">
                        <UserCheck size={12} /> Manager Attention
                      </span>
                    )}
                  </div>
                  <div className="fets-mgr-feed-body">
                    <strong>
                      {item.exam_client || 'Exam shift'} ·{' '}
                      {item.kind === 'evening'
                        ? `${item.attended ?? 0}/${item.expected_candidates ?? 0} attended (${item.no_shows ?? 0} no-shows)`
                        : `${item.expected_candidates ?? 0} expected across ${item.expected_sessions ?? 0} session(s)`}
                    </strong>
                    {item.issues && item.issues.toLowerCase() !== 'none' && (
                      <p>
                        <b>Issue:</b> {item.issues}
                      </p>
                    )}
                    {item.action_taken && item.action_taken.toLowerCase() !== 'none' && (
                      <p>
                        <b>Action:</b> {item.action_taken}
                      </p>
                    )}
                    {item.pending && item.pending.toLowerCase() !== 'none' && (
                      <p className="is-pending-text">
                        <b>Pending:</b> {item.pending}
                      </p>
                    )}
                    <small>
                      Submitted by {staffNameOf(item.submitted_by)} · {formatIstTime(item.submitted_at)} IST
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="fets-mgr-feed-card">
          <div className="fets-mgr-feed-head">
            <div>
              <span className="fets-daily-kicker">OPEN & BLOCKED CENTRE JOBS ({day})</span>
              <h3>Pending Blueprint Duties</h3>
            </div>
            <span className="fets-daily-progress-pill">{openCentreTasks.length} open</span>
          </div>
          {openCentreTasks.length === 0 ? (
            <p className="fets-mgr-empty">No blocked or pending daily tasks recorded for {day}.</p>
          ) : (
            <ul className="fets-mgr-feed-list">
              {openCentreTasks.map(task => (
                <li key={task.id} className="fets-mgr-feed-row">
                  <div className="fets-mgr-feed-meta">
                    <span className="fets-mgr-centre-tag">{String(task.branch || '').toUpperCase()}</span>
                    <span className={`fets-daily-pill ${task.status === 'blocked' ? 'is-red' : 'is-yellow'}`}>
                      {task.status.toUpperCase()}
                    </span>
                    <span>Owner: {staffNameOf(task.assigned_to)}</span>
                  </div>
                  <div className="fets-mgr-feed-body">
                    <strong>{task.title}</strong>
                    {task.note && <p>{task.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
