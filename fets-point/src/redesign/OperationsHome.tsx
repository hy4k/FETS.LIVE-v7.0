import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, CheckCheck, ClipboardCheck, Coffee, Headphones, Inbox, KeyRound, LayoutDashboard, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { centreDate, loadOperationsSnapshot, summariseOperations, type OperationsSnapshot } from './operations-data';
import './operations-home.css';
import { PersonalHero } from './BrandExperience';

type Props = { userName?: string; branch: string; navigate: (page: string) => void; openDrawer: (drawer: string) => void; load?: typeof loadOperationsSnapshot };
const empty: OperationsSnapshot = { sessions: null, roster: null, attendance: null, handovers: null, failures: [], updatedAt: '' };
export default function OperationsHome({ userName = 'Welcome', branch, navigate, openDrawer, load = loadOperationsSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const request = useRef(0);
  const date = centreDate(now);
  const label = ['all', 'global'].includes(branch) ? 'All centres' : branch.charAt(0).toUpperCase() + branch.slice(1);
  useEffect(() => {
    const tick = window.setInterval(() => { setNow(new Date()); if (document.visibilityState === 'visible') setRefresh(n => n + 1); }, 60000);
    const refreshData = () => setRefresh(n => n + 1);
    window.addEventListener('fets-roster-changed', refreshData);
    window.addEventListener('fets-data-loaded', refreshData);
    return () => { clearInterval(tick); window.removeEventListener('fets-roster-changed', refreshData); window.removeEventListener('fets-data-loaded', refreshData); };
  }, []);
  useEffect(() => {
    const id = ++request.current;
    setLoading(true); setSnapshot(empty);
    load(branch, date).then(data => { if (request.current === id) setSnapshot(data); })
      .catch(() => { if (request.current === id) setSnapshot({ ...empty, failures: ['Operations data'] }); })
      .finally(() => { if (request.current === id) setLoading(false); });
    return () => { request.current++; };
  }, [branch, date, refresh, load]);
  const stats = summariseOperations(snapshot);
  const metrics = [
    { label: 'Scheduled candidates', value: stats.candidates, icon: Users, hint: 'Across today’s active sessions' },
    { label: 'Exam sessions', value: stats.sessions, icon: CalendarDays, hint: 'From the centre calendar' },
    { label: 'Staff checked in', value: stats.checkedIn, icon: ShieldCheck, hint: stats.rostered === null ? 'Roster unavailable' : `${stats.rostered} staff rostered today` },
    { label: 'Handovers to acknowledge', value: stats.pendingHandovers, icon: Inbox, hint: 'Today’s incoming sign-offs' },
  ];
  const actions = [
    { label: 'Raise a case', text: 'Record an incident or ask for help.', icon: ShieldCheck, action: () => navigate('case') },
    { label: 'Actionables', text: 'Standards, rollouts and follow-ups.', icon: CheckCheck, action: () => navigate('actionables') },
    { label: 'Quick access', text: 'Vendor portals and credentials.', icon: KeyRound, action: () => openDrawer('vault') },
    { label: 'Help desk', text: 'Find the right support channel.', icon: Headphones, action: () => openDrawer('help') },
  ];
  return <div className="operations-home">
    <PersonalHero name={userName} branch={label} onDesk={() => navigate('desk')} />
    <div className="oh-overview-heading"><h2>Your centre, at a glance.</h2><div><small>From today’s centre records</small><button className="oh-icon-button" onClick={() => setRefresh(n => n + 1)} aria-label="Refresh operations" disabled={loading}><RefreshCw size={15} /></button></div></div>
    {snapshot.failures.length > 0 && <div className="oh-error" role="status">{snapshot.failures.join(', ')} could not be loaded. Unavailable totals are shown as —.<button onClick={() => setRefresh(n => n + 1)}>Try again</button></div>}
    <section className="oh-metrics" aria-label="Today at a glance">{metrics.map(metric => <div className="oh-metric" key={metric.label}><div><span>{metric.label}</span><metric.icon size={17} /></div><strong>{loading ? '…' : metric.value ?? '—'}</strong><small>{metric.hint}</small></div>)}</section>
    <div className="oh-main-grid">
      <section className="oh-card oh-schedule"><div className="oh-section-heading"><div><span className="oh-eyebrow">THE DAY AHEAD</span><h2>Today’s sessions</h2></div><button className="oh-link" onClick={() => navigate('calendar')}>Open calendar <ArrowUpRight size={15} /></button></div>
        {loading ? <p className="oh-empty">Loading the centre calendar…</p> : snapshot.sessions === null ? <p className="oh-empty">The calendar is temporarily unavailable.</p> : snapshot.sessions.length === 0 ? <div className="oh-empty"><CalendarDays size={30} /><h3>A little breathing room.</h3><p>No sessions are listed for this centre today.</p></div> : <div className="oh-session-list">{snapshot.sessions.map(session => <div className="oh-session" key={session.id}><div className="oh-session-time"><strong>{session.start_time?.slice(0, 5) || 'TBC'}</strong><small>{session.end_time?.slice(0, 5) || 'Time to be confirmed'}</small></div><div className="oh-session-name"><strong>{session.client_name || 'Exam session'}</strong><span>{session.exam_name || 'Exam details to be confirmed'}</span></div><span className="oh-session-count"><Users size={14} />{session.candidate_count ?? '—'}</span><span className="oh-session-status">{String(session.status || 'scheduled').replace(/_/g, ' ')}</span></div>)}</div>}
        <div className="oh-schedule-foot"><span>Plan from the calendar. Track arrivals in the register.</span><button className="oh-link" onClick={() => navigate('candidate-tracker')}>Candidate tracker <ArrowRight size={14} /></button></div>
      </section>
      <aside className="oh-handover"><span className="oh-eyebrow"><ClipboardCheck size={15} /> KEEP THE NEXT SHIFT IN THE LOOP</span><div className="oh-handover-symbol"><ArrowRight size={35} /></div><h2>A smooth shift<br />starts with a good handover.</h2><p>Pass on the details that matter: open items, centre checks, and the next team’s priorities.</p><button onClick={() => navigate('handover')}>Open shift handover <ArrowUpRight size={17} /></button><small>{stats.pendingHandovers === null ? 'Review incoming and outgoing handovers' : `${stats.pendingHandovers} awaiting acknowledgement today`}</small></aside>
    </div>
    <section className="oh-action-grid" aria-label="Operations tools">{actions.map(action => <button key={action.label} onClick={action.action}><span className="oh-action-icon"><action.icon size={20} /></span><ArrowUpRight size={16} /><strong>{action.label}</strong><small>{action.text}</small></button>)}</section>
    <div className="oh-bottom-grid"><section className="oh-card"><div className="oh-section-heading"><div><span className="oh-eyebrow">THE PEOPLE ON THE PLAN</span><h2>Today’s roster</h2></div><button className="oh-link" onClick={() => navigate('roster')}>View roster <ArrowUpRight size={15} /></button></div><div className="oh-roster">{loading ? <p>Loading the roster…</p> : stats.roster === null ? <p>Roster data is temporarily unavailable.</p> : stats.roster.length === 0 ? <p>No staff shifts are listed for today.</p> : stats.roster.map((person, index) => <div key={`${person.profile_id}-${index}`}><span className="oh-person-avatar">{(person.staff_profiles?.full_name || '?').split(' ').slice(0, 2).map((n: string) => n[0]).join('')}</span><span><strong>{person.staff_profiles?.full_name || 'Staff member'}</strong><small>{person.branch_location || person.staff_profiles?.branch_assigned || label}</small></span><span className="oh-shift-code">{person.shift_code}</span></div>)}</div></section><button className="oh-desk-link" onClick={() => navigate('desk')}><Coffee size={28} /><span className="oh-eyebrow">AND A LITTLE SPACE FOR YOU</span><h2>Your workday.<br />Your own rhythm.</h2><p>Focus, jot down an idea, or check in with a teammate.</p><span>Go to My Desk <ArrowRight size={17} /></span></button></div>
    <footer className="oh-footer"><span><LayoutDashboard size={13} /> One place to keep the day moving.</span><span>{snapshot.updatedAt ? `Last refreshed ${new Date(snapshot.updatedAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST` : 'Waiting for centre data'}</span></footer>
  </div>;
}
