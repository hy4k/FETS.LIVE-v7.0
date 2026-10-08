import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, ChevronDown, Copy, Crown, Flag, MessageCircle, Pencil, Plus, RotateCcw, Send, Sparkles, Trash2, UserPlus, X } from 'lucide-react';
import { centreDate } from './operations-data';
import { LANES, laneInfo, checkpoints, clock, minutes, resolvedOwner, type CoverageChange, type DutyEvent, type PlanRecord, type TeamMember, type DutyReport } from './shift-plan';
import type { ShiftRepository } from './shift-repository';
import type { BlueprintRepository, Person } from './shift-blueprint-repository';
import { AREAS, FREQUENCIES, TEMPLATE, WEEKDAYS, actionablesDue, dayList, draftReport, frequencyLabel, nextDay, progress, reportText, type ActionableDuty, type AreaKey, type DayTask, type ListItem, type Responsibility, type TaskStatus } from './shift-blueprint';
import { peekHandoverDraft, takeHandoverDraft } from '../fets-ai/handover-draft';
import './the-shift.css';
import { currentDuty, isVerified, personChecks, shortDutyTitle } from './shift-board';
import './shift-board.css';

export type ShiftIdentity = { id: string; profileId: string; name: string; admin: boolean };
const message = (e: unknown) => e instanceof Error ? e.message : 'Could not save. Please try again.';
const indiaMinute = (date: Date) => minutes(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(date));
const initials = (name: string) => name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
const first = (name: string) => name.split(/\s+/)[0];
const STATUS: Record<TaskStatus, string> = { open: 'To do', done: 'Done', blocked: 'Blocked', carried: 'Moved to tomorrow', skipped: 'Not needed' };

/** The lead for a day: an acting lead from a later change, the plan's acting lead, the plan's lead, then the week's lead. */
export function dayLead(record: PlanRecord | null, weekLead: string | null | undefined, changes: CoverageChange[], now = new Date()) {
  const today = centreDate(now);
  const day = record?.day;
  const lead = changes.filter(c => c.kind === 'lead' && day && (day < today || (day === today && c.starts <= indiaMinute(now))));
  return lead[lead.length - 1]?.staff_id || record?.plan.actingLead || record?.lead_id || weekLead || '';
}

type DayData = {
  team: TeamMember[]; staff: Person[]; record: PlanRecord | null; weekLead: string | null; events: DutyEvent[]; changes: CoverageChange[];
  closed: boolean; responsibilities: Responsibility[]; tasks: DayTask[]; actionables: ActionableDuty[];
};

/** Everything the day needs, loaded together. */
function useDay(branch: string, day: string, repository: ShiftRepository, blueprint: BlueprintRepository, reload: number, paused = false) {
  const [data, setData] = useState<DayData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (paused) return;
    let live = true;
    setError('');
    (async () => {
      const [team, staff, shared, responsibilities, tasks] = await Promise.all([
        repository.roster(branch, day), blueprint.staff(branch), repository.load(branch, day),
        blueprint.responsibilities(branch), blueprint.tasks(branch, day),
      ]);
      const people = [...new Set([...team.map(p => p.id), ...staff.map(p => p.id)])];
      const actionables = await blueprint.actionables(people).catch(() => [] as ActionableDuty[]);
      if (!live) return;
      setData({ team, staff, record: shared.record, weekLead: shared.lead?.lead_id ?? null, events: shared.events, changes: (shared as any).changes || [], closed: Boolean((shared as any).closed), responsibilities, tasks, actionables });
    })().catch(e => { if (live) setError(message(e)); });
    return () => { live = false; };
  }, [branch, day, repository, blueprint, reload, paused]);
  return { data, setData, error };
}

function namer(data: DayData) {
  const all = new Map<string, string>([...data.staff.map(p => [p.id, p.name] as const), ...data.team.map(p => [p.id, p.name] as const)]);
  return (id: string | null) => (id && all.get(id)) || (id ? 'A colleague' : 'Nobody yet');
}

function Ring({ done, total, size = 64, label }: { done: number; total: number; size?: number; label?: string }) {
  const r = size / 2 - 5; const c = 2 * Math.PI * r; const share = total ? done / total : 0;
  return <svg className="ts-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${done} of ${total} done`}>
    <circle cx={size / 2} cy={size / 2} r={r} className="ts-ring-track" />
    <circle cx={size / 2} cy={size / 2} r={r} className="ts-ring-fill" strokeDasharray={`${c * share} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">{total ? Math.round(share * 100) : 0}%</text>
  </svg>;
}

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */

type Draft = { id?: string; area: AreaKey; title: string; details: string; frequency: Responsibility['frequency']; weekday: number; monthday: number; owner_id: string; backup_id: string; expected_result: string; due: string; priority: 'normal' | 'important' };
const blank = (area: AreaKey): Draft => ({ area, title: '', details: '', frequency: 'daily', weekday: 1, monthday: 1, owner_id: '', backup_id: '', expected_result: '', due: '', priority: 'normal' });

export function Blueprint({ branch, identity, repository, blueprint, workflowReady = false, canPlan = false }: { branch: string; identity: ShiftIdentity; repository: ShiftRepository; blueprint: BlueprintRepository; workflowReady?: boolean; canPlan?: boolean }) {
  const [rows, setRows] = useState<Responsibility[] | null>(null);
  const [staff, setStaff] = useState<Person[]>([]);
  const [lead, setLead] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const today = centreDate();
      const [r, s, shared, team] = await Promise.all([blueprint.responsibilities(branch), blueprint.staff(branch), repository.load(branch, today), repository.roster(branch, today)]);
      if (!live) return;
      const people = new Map(s.map(p => [p.id, p]));
      for (const p of team) if (!people.has(p.id)) people.set(p.id, { id: p.id, name: p.name });
      setRows(r); setStaff([...people.values()].sort((a, b) => a.name.localeCompare(b.name)));
      setLead(dayLead(shared.record, shared.lead?.lead_id, (shared as any).changes || []));
    })().catch(e => { if (live) setError(message(e)); });
    return () => { live = false; };
  }, [branch, repository, blueprint]);
  const canEdit = canPlan || identity.admin || (Boolean(lead) && lead === identity.profileId);
  const name = (id: string | null) => staff.find(p => p.id === id)?.name || (id ? 'A colleague' : 'Not chosen');
  const act = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(message(e)); } finally { setBusy(false); } };
  const save = () => act(async () => {
    if (!draft || !draft.title.trim()) return;
    const value = { id: draft.id, branch, area: draft.area, title: draft.title.trim(), details: draft.details.trim(), frequency: draft.frequency,
      weekday: draft.frequency === 'weekly' ? draft.weekday : null, monthday: draft.frequency === 'monthly' ? draft.monthday : null,
      owner_id: draft.owner_id || null, backup_id: draft.backup_id && draft.backup_id !== draft.owner_id ? draft.backup_id : null,
      position: draft.id ? rows!.find(r => r.id === draft.id)!.position : (rows || []).filter(r => r.area === draft.area).length };
    const saved = await blueprint.saveResponsibility({ ...value, ...(workflowReady ? { expected_result: draft.expected_result.trim(), due_minute: draft.due ? minutes(draft.due) : null, priority: draft.priority } : {}) });
    setRows(old => [...(old || []).filter(r => r.id !== saved.id), saved]); setDraft(null);
  });
  const seed = () => act(async () => {
    const counts: Record<string, number> = {};
    const saved = await blueprint.seed(TEMPLATE.map(t => ({ ...t, branch, owner_id: null, backup_id: null, active: true, position: (counts[t.area] = (counts[t.area] ?? -1) + 1) })));
    setRows(saved);
  });
  const remove = (r: Responsibility) => act(async () => { await blueprint.removeResponsibility(r.id); setRows(old => (old || []).filter(x => x.id !== r.id)); });

  if (error && !rows) return <div className="dw-notice dw-error" role="alert">{error}</div>;
  if (!rows) return <div className="dw-empty">Loading the centre blueprint…</div>;
  const load = staff.map(p => ({ ...p, owns: rows.filter(r => r.owner_id === p.id).length, backs: rows.filter(r => r.backup_id === p.id).length })).filter(p => p.owns || p.backs);
  const orphan = rows.filter(r => !r.owner_id).length;

  return <div className="ts-blueprint">
    {error && <div className="dw-notice dw-error" role="alert">{error}</div>}
    <section className="ts-hero ts-blueprint-hero">
      <div className="ts-hero-main"><span className="planning-eyebrow">REGULAR JOBS</span><h2>Assign once. Repeat when due.</h2><p className="ts-muted">Agree an owner, backup, expected result and target time. These agreements become each person’s daily work.</p></div>
      <div className="ts-hero-stats"><div><strong>{rows.length}</strong><span>jobs</span></div><div className={orphan ? 'is-warn' : ''}><strong>{orphan}</strong><span>without an owner</span></div><div><strong>{load.length}</strong><span>people sharing them</span></div></div>
    </section>
    {load.length > 0 && <div className="ts-workload" aria-label="Who carries what">{load.sort((a, b) => b.owns - a.owns).map(p => <span key={p.id}><b>{initials(p.name)}</b>{p.name}<small>owns {p.owns} · backup {p.backs}</small></span>)}</div>}
    {!canEdit && <p className="ts-muted ts-readonly">The week’s lead and the super admin keep the blueprint up to date.</p>}
    {!rows.length && <section className="ts-card ts-empty-blueprint"><Sparkles size={28} /><h3>Start with the FETS blueprint.</h3><p>{TEMPLATE.length} jobs a FETS centre runs on, across six areas. Then choose an owner and a backup for each, and change anything that doesn’t fit.</p>{canEdit && <button className="dw-primary" disabled={busy} onClick={() => void seed()}>Use the FETS template <ArrowRight size={15} /></button>}</section>}

    <div className="ts-areas">{AREAS.map(area => {
      const list = rows.filter(r => r.area === area.key).sort((a, b) => a.position - b.position);
      return <section key={area.key} className={`ts-card ts-area c-${area.color}`}>
        <div className="ts-card-head"><div><span className="planning-eyebrow">{list.length} JOBS</span><h3>{area.title}</h3><p className="ts-muted">{area.blurb}</p></div>{canEdit && <button className="ts-icon" aria-label={`Add a job to ${area.title}`} onClick={() => setDraft(blank(area.key))}><Plus size={16} /></button>}</div>
        <ul>{list.map(r => <li key={r.id}>
          <div><strong>{shortDutyTitle(r.title)}</strong><small>{frequencyLabel(r)} · {r.due_minute == null ? 'Time not agreed' : `By ${clock(r.due_minute)}`}</small>{r.expected_result && <p className="ts-agreed-result">Done means: {r.expected_result}</p>}{r.details && <details><summary>Instructions</summary><p>{r.details}</p></details>}</div>
          <div className="ts-owners"><span className={r.owner_id ? '' : 'is-warn'}>{r.owner_id ? first(name(r.owner_id)) : 'No owner'}</span><small>backup {r.backup_id ? first(name(r.backup_id)) : '—'}</small></div>
          {canEdit && <div className="ts-row-actions"><button className="ts-icon" aria-label={`Edit ${r.title}`} onClick={() => setDraft({ id: r.id, area: r.area, title: r.title, details: r.details, frequency: r.frequency, weekday: r.weekday ?? 1, monthday: r.monthday ?? 1, owner_id: r.owner_id ?? '', backup_id: r.backup_id ?? '', expected_result: r.expected_result || r.details, due: r.due_minute == null ? '' : clock(r.due_minute), priority: r.priority || 'normal' })}><Pencil size={14} /></button><button className="ts-icon" aria-label={`Remove ${r.title}`} onClick={() => void remove(r)}><Trash2 size={14} /></button></div>}
        </li>)}{!list.length && <li className="ts-muted">No jobs here yet.</li>}</ul>
      </section>;
    })}</div>

    {draft && <div className="ts-overlay" role="dialog" aria-modal="true" aria-label={draft.id ? 'Edit job' : 'Add a job'} onKeyDown={e => { if (e.key === 'Escape') setDraft(null); }}>
      <form className="ts-modal" onSubmit={e => { e.preventDefault(); void save(); }}>
        <header><h3>{draft.id ? 'Edit job' : 'Add a job'}</h3><button type="button" className="ts-icon" aria-label="Close" onClick={() => setDraft(null)}><X size={16} /></button></header>
        <label>Job<input required autoFocus maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Office supplies reorder" /></label>
        <label>Instructions<textarea maxLength={2000} value={draft.details} onChange={e => setDraft({ ...draft, details: e.target.value })} placeholder="What “done” looks like" /></label>
        {workflowReady && <><label>Done means<textarea required maxLength={2000} value={draft.expected_result} onChange={e => setDraft({ ...draft, expected_result: e.target.value })} /></label><div className="ts-form-row"><label>Target time<input type="time" value={draft.due} onChange={e => setDraft({ ...draft, due: e.target.value })} /></label><label>Priority<select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Draft['priority'] })}><option value="normal">Normal</option><option value="important">Important</option></select></label></div></>}
        <div className="ts-form-row">
          <label>Area<select value={draft.area} onChange={e => setDraft({ ...draft, area: e.target.value as AreaKey })}>{AREAS.map(a => <option key={a.key} value={a.key}>{a.title}</option>)}</select></label>
          <label>How often<select value={draft.frequency} onChange={e => setDraft({ ...draft, frequency: e.target.value as Draft['frequency'] })}>{FREQUENCIES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
          {draft.frequency === 'weekly' && <label>On<select value={draft.weekday} onChange={e => setDraft({ ...draft, weekday: Number(e.target.value) })}>{WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>}
          {draft.frequency === 'monthly' && <label>Day of month<input type="number" min={1} max={31} value={draft.monthday} onChange={e => setDraft({ ...draft, monthday: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} /></label>}
        </div>
        <div className="ts-form-row">
          <label>Owner<select value={draft.owner_id} onChange={e => setDraft({ ...draft, owner_id: e.target.value })}><option value="">Choose later</option>{staff.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Backup<select value={draft.backup_id} onChange={e => setDraft({ ...draft, backup_id: e.target.value })}><option value="">None</option>{staff.filter(p => p.id !== draft.owner_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        </div>
        <button className="dw-primary" disabled={busy || !draft.title.trim()}>{busy ? 'Saving…' : 'Save job'}</button>
      </form>
    </div>}
  </div>;
}

/* ------------------------------------------------------------------ */
/* Day report                                                          */
/* ------------------------------------------------------------------ */

function share(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

export function DayReport({ branch, day, identity, repository, blueprint, canPlan = false }: { branch: string; day: string; identity: ShiftIdentity; repository: ShiftRepository; blueprint: BlueprintRepository; canPlan?: boolean }) {
  const [reload, setReload] = useState(0);
  const { data, error } = useDay(branch, day, repository, blueprint, reload);
  const [summary, setSummary] = useState(''); const [followups, setFollowups] = useState(''); const [recognition, setRecognition] = useState('');
  const [busy, setBusy] = useState(false); const [problem, setProblem] = useState(''); const [sent, setSent] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<DutyReport | null>(null);
  const [assistant, setAssistant] = useState(() => peekHandoverDraft(branch, day));
  const now = new Date();
  useEffect(() => {
    if (!data?.closed) return;
    let live = true;
    repository.reports(branch, day.slice(0, 7)).then(rows => { if (live) setSubmitted(rows.find(r => r.day === day) ?? null); }).catch(() => undefined);
    return () => { live = false; };
  }, [data?.closed, branch, day, repository]);
  const computed = useMemo(() => {
    if (!data) return null;
    const names = namer(data);
    const items = dayList(data.responsibilities, data.tasks, day, new Set(data.team.map(p => p.id)));
    const plan = data.record?.status === 'published' ? data.record.plan : null;
    const points = plan ? checkpoints(plan, data.changes) : [];
    const recordedCount = points.filter(p => data.events.some(e => e.block === p.block && e.lane === p.lane && e.kind === p.kind && e.due === p.due)).length;
    const time = indiaMinute(now);
    const missed = points.filter(p => !data.events.some(e => e.block === p.block && e.lane === p.lane && e.kind === p.kind && e.due === p.due) && (day < centreDate(now) || (day === centreDate(now) && p.due < time))).length;
    const due = actionablesDue(data.actionables, day);
    return { names, items, checks: { recorded: recordedCount, expected: points.length, missed }, due, lead: dayLead(data.record, data.weekLead, data.changes, now) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, day]);
  if (error) return <div className="dw-notice dw-error" role="alert">{error}<button onClick={() => setReload(n => n + 1)}>Try again</button></div>;
  if (!data || !computed) return <div className="dw-empty">Gathering the day’s records…</div>;
  const { names, items, checks, due, lead } = computed;
  const canReport = canPlan || identity.admin || (Boolean(lead) && lead === identity.profileId);
  const published = data.record?.status === 'published';
  const afterFive = day < centreDate(now) || (day === centreDate(now) && indiaMinute(now) >= 1020);
  const fill = () => { const d = draftReport({ items, names, checks, actionables: due }); setSummary(d.summary); setFollowups(d.followups); };
  const all = progress(items);
  const text = (r: { summary: string; followups: string; recognition: string }) => reportText({ branch, day, lead: names(lead || null), ...r });

  return <div className="ts-report">
    {problem && <div className="dw-notice dw-error" role="alert">{problem}</div>}
    <section className="ts-hero">
      <div className="ts-hero-main"><span className="planning-eyebrow">THE LEAD’S DAILY REPORT</span><h2>Close the day. Set up tomorrow.</h2><p className="ts-muted">Talk to the team, check the numbers below, then send it. It goes to the super admin in fets.live, and you can also send it on WhatsApp.</p></div>
      <div className="ts-hero-stats"><Ring done={all.done} total={all.total} size={80} /><div><strong>{all.done}<small>/{all.total}</small></strong><span>jobs done</span></div><div><strong>{checks.recorded}<small>/{checks.expected}</small></strong><span>checks recorded</span></div><div className={checks.missed ? 'is-warn' : ''}><strong>{checks.missed}</strong><span>checks missed</span></div><div className={due.length ? 'is-warn' : ''}><strong>{due.length}</strong><span>Actionables due</span></div></div>
    </section>

    {(data.closed || sent) ? <section className="ts-card ts-sent">
      <Check size={26} /><h3>Report sent for {day}.</h3>
      <pre>{sent ?? (submitted ? text(submitted) : 'Loading the submitted report…')}</pre>
      <div className="dw-actions"><button className="dw-primary" disabled={!sent && !submitted} onClick={() => share(sent ?? text(submitted!))}><MessageCircle size={15} /> Send on WhatsApp</button><button className="dw-secondary" disabled={!sent && !submitted} onClick={() => void navigator.clipboard?.writeText(sent ?? text(submitted!))}><Copy size={14} /> Copy</button></div>
    </section> : !published ? <section className="ts-card"><h3>Publish the day’s rota first.</h3><p className="ts-muted">The report is attached to the published exam floor rota for {day}. Publish it from Today.</p></section>
      : !canReport ? <section className="ts-card"><h3>The lead sends this report.</h3><p className="ts-muted">{lead ? `${names(lead)} leads this day.` : 'No lead is set for this day.'} Tell them what you finished and what is still open; it all ends up here.</p></section>
      : <section className="ts-card ts-compose">
        <div className="ts-card-head"><div><span className="planning-eyebrow">YOUR REPORT</span><h3>What happened, and what’s next.</h3></div><button className="dw-secondary" onClick={fill}><Sparkles size={14} /> Fill from today’s records</button></div>
        {assistant && <div className="dw-notice"><strong>An assistant draft is ready.</strong> Check it against today’s records before using it.<button onClick={() => { const d = takeHandoverDraft(branch, day); if (d) { setSummary(d.summary); setFollowups(d.followups); setRecognition(d.recognition); setAssistant(null); } }}>Use it</button></div>}
        <label>Today<textarea value={summary} maxLength={4000} onChange={e => setSummary(e.target.value)} placeholder="Jobs done, exam floor checks, anything that went wrong and how it was handled" /></label>
        <label>Carry into tomorrow<textarea value={followups} maxLength={4000} onChange={e => setFollowups(e.target.value)} placeholder="What is still open, who owns it and by when. Write None if nothing remains." /></label>
        <label>Thank you, team<textarea value={recognition} maxLength={2000} onChange={e => setRecognition(e.target.value)} placeholder="Someone who went the extra mile today" /></label>
        <button className="dw-primary" disabled={busy || !summary.trim() || !followups.trim() || !afterFive} onClick={async () => {
          setBusy(true); setProblem('');
          try { await repository.report(data.record!, summary, followups, recognition); setSent(text({ summary, followups, recognition })); }
          catch (e) { setProblem(message(e)); } finally { setBusy(false); }
        }}><Send size={15} /> Send report to super admin</button>
        <small className="ts-muted">{afterFive ? 'One report per day. It keeps the rota, checks and jobs exactly as they are now.' : 'You can send it from 17:00 India time.'}</small>
      </section>}

    <section className="ts-card">
      <div className="ts-card-head"><div><span className="planning-eyebrow">WHAT’S STILL OPEN</span><h3>Before you send it.</h3></div></div>
      <ul className="ts-tasks ts-open">{items.filter(i => i.status !== 'skipped' && (i.status !== 'done' || (i.task?.verified_at !== undefined && !isVerified(i)))).map(i => <li key={i.key} className={`ts-task is-${i.status}`}><span className="ts-check" aria-hidden="true" /><div className="ts-task-body"><strong>{i.title}</strong><small>{names(i.assignee)} · {i.status === 'done' && !isVerified(i) ? 'Awaiting review' : STATUS[i.status]}{i.status === 'blocked' && i.note ? `: ${i.note}` : ''}</small></div></li>)}
        {due.map(a => <li key={a.id} className="ts-task"><span className="ts-check" aria-hidden="true" /><div className="ts-task-body"><strong>{a.title}</strong><small>Actionables · {names(a.owner_id)} · due {a.due_date}</small></div></li>)}
        {!items.some(i => i.status !== 'skipped' && (i.status !== 'done' || (i.task?.verified_at !== undefined && !isVerified(i)))) && !due.length && <li className="ts-muted">Everything is done. A good day.</li>}</ul>
    </section>
  </div>;
}

export { share as shareOnWhatsApp };
export function reportAsText(r: DutyReport, leadName: string) { return reportText({ branch: r.branch, day: r.day, lead: leadName, summary: r.summary, followups: r.followups, recognition: r.recognition }); }
