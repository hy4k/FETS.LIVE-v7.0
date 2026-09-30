import React, { useEffect, useState } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, Award, BookOpen, CalendarDays,
  Check, CheckCheck, Clock3, Cloud, Coffee, Flower2, Headphones, Heart,
  Inbox, KeyRound, Leaf, LockKeyhole, MapPin, MessageCircle,
  Moon, Pause, Play, RotateCcw, Shuffle, Smile, Sparkles, Sun, Users,
} from 'lucide-react';
import './my-desk.css';
import type { DeskRepository, FocusRecord } from './desk-data';
import { useDeskDocument, useDeskFocusLog } from './useDeskSync';

export type DeskPerson = {
  id: string; full_name: string; branch_assigned?: string; avatar_url?: string;
};
export type DeskPanel = 'time' | 'handovers' | 'checklist' | 'growth' | 'requests';
type Props = {
  repository?: DeskRepository;
  user: { id: string; name: string; role: string; branch: string; avatar?: string };
  people: DeskPerson[];
  pendingHandovers: number | null;
  navigate: (page: string) => void;
  openDrawer: (drawer: string) => void;
  openChat: (person: DeskPerson) => void;
  renderPanel: (panel: DeskPanel) => React.ReactNode;
};

function useSavedString(key: string, fallback = '') {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  });
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try { localStorage.setItem(key, value); setSaved(true); } catch { setSaved(false); }
  }, [key, value]);
  return [value, setValue, saved] as const;
}

function Avatar({ name, src, small = false }: { name: string; src?: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className={`md-avatar ${small ? 'md-avatar-small' : ''}`}>
    {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('')}
  </span>;
}

type Timer = { remaining: number; endsAt: number | null; duration: number; id?: string; completedAt?: string };
const freshTimer = (duration = 25): Timer => ({ remaining: duration * 60, endsAt: null, duration });
function FocusSession({ storageKey, onComplete }: { storageKey: string; onComplete?: (record: FocusRecord) => void }) {
  const [timer, setTimer] = useState<Timer>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (value && [25, 50].includes(value.duration) && Number.isFinite(value.remaining) && value.remaining >= 0 && value.remaining <= value.duration * 60 &&
        (value.endsAt === null || (Number.isFinite(value.endsAt) && value.endsAt > 0))) return value;
    } catch { /* A new session is safe when storage is unavailable. */ }
    return freshTimer();
  });
  const [now, setNow] = useState(Date.now);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const seconds = timer.endsAt ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : timer.remaining;
  const running = timer.endsAt !== null && seconds > 0;
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(timer)); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  }, [storageKey, timer]);
  useEffect(() => {
    if (!timer.endsAt) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      if (time >= timer.endsAt!) setTimer(current => ({ ...current, endsAt: null, remaining: 0, completedAt: new Date(timer.endsAt!).toISOString() }));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [timer.endsAt]);
  useEffect(() => {
    if (timer.id && timer.completedAt) onComplete?.({ id: timer.id, duration_minutes: timer.duration, completed_at: timer.completedAt });
  }, [timer.id, timer.completedAt, timer.duration, onComplete]);
  const toggle = () => {
    const time = Date.now();
    setNow(time);
    setTimer(current => current.endsAt
      ? { ...current, remaining: Math.max(0, Math.ceil((current.endsAt - time) / 1000)), endsAt: null }
      : { ...current, id: current.remaining === 0 || !current.id ? crypto.randomUUID() : current.id, completedAt: undefined, endsAt: time + (current.remaining || current.duration * 60) * 1000 });
  };
  return <section className="md-card md-focus" aria-labelledby="md-focus-title">
    <div className="md-card-heading"><span className="md-kicker"><Headphones size={15} /> A LITTLE HEADSPACE</span><span className="md-mini-tag">Just for you</span></div>
    <h2 id="md-focus-title">One thing at a time.</h2>
    <p>Give your next piece of work a little undivided attention.</p>
    <div className="md-timer-row">
      <div className={`md-timer ${running ? 'is-running' : ''}`} role="timer" aria-label={`${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`}>
        <span>{String(Math.floor(seconds / 60)).padStart(2, '0')}<span className="md-timer-colon">:</span>{String(seconds % 60).padStart(2, '0')}</span>
        <small>{running ? 'You’re in your focus space' : seconds === 0 ? 'Nice work. Take a breather.' : 'Your pace. Your space.'}</small>
      </div>
      <div className="md-focus-settings">
        <div className="md-segment" aria-label="Focus duration">
          {[25, 50].map(minutes => <button key={minutes} aria-pressed={timer.duration === minutes} disabled={running} onClick={() => setTimer(freshTimer(minutes))}>{minutes} min</button>)}
        </div>
        <button className="md-button md-button-dark" onClick={toggle}>{running ? <Pause size={15} /> : <Play size={15} />}{running ? 'Pause focus' : seconds === 0 ? 'Start again' : timer.remaining < timer.duration * 60 ? 'Resume focus' : 'Start focus'}</button>
        <button className="md-text-button" onClick={() => setTimer(freshTimer(timer.duration))}><RotateCcw size={12} /> Reset session</button>
      </div>
    </div>
    <div className="md-focus-foot"><span className={`md-status-dot ${running ? 'is-running' : ''}`} /><span role="status">{running ? 'Focus session in progress' : seconds === 0 ? 'Session complete. Time to recharge.' : 'A small start is still a start.'}</span><span>{storageAvailable ? 'Personal timer' : 'Timer won’t survive a refresh'}</span></div>
  </section>;
}

const breakIdeas = [
  { title: 'Look up. Look out.', text: 'Find something beyond your screen. Give your eyes a quiet minute to wander.', label: 'A fresh perspective', icon: Sun },
  { title: 'A little thank-you.', text: 'Who made your day easier? Open a chat and tell them one thing you appreciated.', label: 'Good energy travels', icon: Heart },
  { title: 'Refill and reset.', text: 'Top up your water, relax your shoulders, and come back at your own pace.', label: 'Small rituals matter', icon: Coffee },
  { title: 'Your next tiny idea.', text: 'What would make a candidate’s first five minutes at FETS a little better? Save the thought in your notebook.', label: 'Room for a bright idea', icon: Sparkles },
];
const moods = [{ value: 'bright', label: 'Feeling bright', icon: Sun }, { value: 'steady', label: 'Taking it steady', icon: Leaf }, { value: 'focused', label: 'In the zone', icon: Headphones }, { value: 'slow', label: 'A slow day', icon: Cloud }];
const tabs: { id: 'today' | DeskPanel; label: string; icon: typeof Sun }[] = [
  { id: 'today', label: 'My day', icon: Sun }, { id: 'time', label: 'My time', icon: Clock3 },
  { id: 'handovers', label: 'Handovers', icon: Inbox }, { id: 'checklist', label: 'Checklist', icon: CheckCheck },
  { id: 'growth', label: 'My growth', icon: Leaf },
];

export default function MyDeskHome(props: Props) {
  const [date, setDate] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setDate(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  // Remount local-only state when the signed-in person or calendar day changes.
  return <PersonalDesk key={`${props.user.id}:${day}`} {...props} day={day} date={date} />;
}

function PersonalDesk({ user, people, pendingHandovers, navigate, openDrawer, openChat, renderPanel, repository, day, date }: Props & { day: string; date: Date }) {
  const [tab, setTab] = useState<'today' | DeskPanel>('today');
  const key = `fets-desk:${user.id}`;
  const [localMood, setLocalMood, moodSaved] = useSavedString(`${key}:mood:${day}`);
  const [localNote, setLocalNote, noteSaved] = useSavedString(`${key}:note:${day}`);
  const [localCover, setLocalCover] = useSavedString(`${key}:cover`, 'peach');
  const cloudDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const journal = useDeskDocument(`${key}:journal:${day}`, { note: localNote, mood: localMood },
    repository ? () => repository.loadJournal(user.id, cloudDay) : undefined,
    repository ? (value, version) => repository.saveJournal(user.id, cloudDay, value, version) : undefined, Boolean(localNote || localMood));
  const preferences = useDeskDocument(`${key}:preferences`, { cover: localCover },
    repository ? () => repository.loadPreferences(user.id) : undefined,
    repository ? (value, version) => repository.savePreferences(user.id, value, version) : undefined, localCover !== 'peach');
  const focusLog = useDeskFocusLog(user.id, repository);
  const mood = repository ? journal.value.mood : localMood;
  const note = repository ? journal.value.note : localNote;
  const cover = repository ? preferences.value.cover : localCover;
  const setMood = (value: string) => repository ? journal.edit({ mood: value }) : setLocalMood(value);
  const setNote = (value: string) => repository ? journal.edit({ note: value }) : setLocalNote(value);
  const setCover = (value: string) => repository ? preferences.edit({ cover: value }) : setLocalCover(value);
  const [breakIndex, setBreakIndex] = useState(date.getDate() % breakIdeas.length);
  const [teamQuery, setTeamQuery] = useState('');
  const idea = breakIdeas[breakIndex];
  const BreakIcon = idea.icon;
  const teammates = people.filter(p => p.full_name.toLowerCase().includes(teamQuery.toLowerCase()));
  const firstName = user.name.trim().split(/\s+/)[0] || 'there';
  const hour = date.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const selectedMood = moods.find(m => m.value === mood);
  return <div className="my-desk" data-cover={['peach', 'sage', 'lilac'].includes(cover) ? cover : 'peach'}>
    <div className="md-page-heading"><div><span className="md-kicker">FETS · LIVE / YOUR PERSONAL SPACE</span><h1>My Desk<span>.</span></h1></div><div className="md-date"><CalendarDays size={16} /><span>{date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div></div>

    <section className="md-profile-cover" aria-label="Your personal workspace">
      <div className="md-cover-art">
        <div className="md-cover-copy"><span className="md-kicker">A GOOD DAY STARTS WITH YOU</span><h2>A little focus.<br />A lot of <em>you.</em></h2><p>Your work, your people, your own little corner of FETS.</p></div>
        <div className="md-artwork" aria-hidden="true"><div className="md-art-orbit" /><div className="md-art-sun"><Sun /></div><div className="md-art-arch"><Flower2 /></div><div className="md-art-note"><span>make good<br /><em>things happen.</em></span><Sparkles /></div><div className="md-art-stamp">GROW AT<br />YOUR PACE<Leaf size={20} /></div></div>
        <div className="md-cover-picker" aria-label="Cover colour">{['peach', 'sage', 'lilac'].map(c => <button key={c} className={`md-swatch md-swatch-${c}`} onClick={() => setCover(c)} aria-label={`${c} cover`} aria-pressed={cover === c}>{cover === c && <Check size={12} />}</button>)}</div>
      </div>
      <div className="md-profile-strip"><Avatar name={user.name} src={user.avatar} /><div className="md-identity"><h2>{greeting}, {firstName} <span>✳</span></h2><p><span>{user.role}</span><span className="md-dot">·</span><MapPin size={12} />{user.branch}</p></div><div className="md-mood"><div><span>How’s your day?</span><small>{selectedMood ? selectedMood.label : 'A moment to check in with yourself'}</small></div><div className="md-mood-buttons">{moods.map(m => <button key={m.value} onClick={() => setMood(m.value)} aria-label={m.label} title={m.label} aria-pressed={mood === m.value}><m.icon size={18} strokeWidth={1.6} /></button>)}</div><span className="md-mood-privacy"><LockKeyhole size={10} />{repository ? journal.dirty ? 'Check-in not synced yet' : 'Only visible to you' : moodSaved ? 'Only on this browser' : 'Not saved on this browser'}</span></div></div>
    </section>

    {repository && <div className="md-cloud-toolbar">
      <span><LockKeyhole size={12} /> Your notes and check-ins belong to you.</span>
      <div>{journal.dirty && <button disabled={!journal.canSave} onClick={() => void journal.save()}>Save my check-in</button>}
      {preferences.dirty && <button disabled={!preferences.canSave} onClick={() => void preferences.save()}>Save cover</button>}
      {preferences.message && <span role="status">{preferences.status === 'conflict' ? 'Cover changed on another device.' : 'Cover sync unavailable.'} <button onClick={() => void preferences.reload(preferences.status === 'conflict')}>{preferences.status === 'conflict' ? 'Load saved cover' : 'Retry'}</button></span>}</div>
    </div>}
    <nav className="md-tabs" aria-label="My Desk sections">{tabs.map(item => <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}><item.icon size={16} />{item.label}{item.id === 'handovers' && pendingHandovers !== null && pendingHandovers > 0 && <span className="md-count">{pendingHandovers}</span>}</button>)}<button className="md-profile-link" onClick={() => navigate('profile')}>My profile <ArrowUpRight size={14} /></button></nav>

    {tab === 'today' ? <div className="md-grid">
      <aside className="md-left-column">
        <section className="md-card md-day-card"><span className="md-kicker"><CalendarDays size={14} /> YOUR WORKDAY</span><h2>Let’s ease into it.</h2><p>A few familiar places to get your day moving.</p><button className="md-work-link" onClick={() => navigate('roster')}><span className="md-link-icon md-icon-peach"><CalendarDays size={18} /></span><span><strong>My schedule</strong><small>Find your next shift</small></span><ArrowUpRight size={15} /></button><button className="md-work-link" onClick={() => setTab('handovers')}><span className="md-link-icon md-icon-lilac"><Inbox size={18} /></span><span><strong>Pick up the thread</strong><small>{pendingHandovers === null ? 'Review your handovers' : pendingHandovers > 0 ? `${pendingHandovers} handover${pendingHandovers === 1 ? '' : 's'} to review` : 'No handovers waiting'}</small></span><ArrowRight size={15} /></button><button className="md-work-link" onClick={() => setTab('requests')}><span className="md-link-icon md-icon-sage"><Coffee size={18} /></span><span><strong>Plan some time off</strong><small>Leave, swaps & requests</small></span><ArrowRight size={15} /></button></section>
        <section className="md-card md-shortcuts"><span className="md-kicker">WITHIN REACH</span><button onClick={() => navigate('handover')}><Users size={16} /> My centre duties <ArrowUpRight size={13} /></button><button onClick={() => navigate('calendar')}><CalendarDays size={16} /> Centre calendar <ArrowUpRight size={13} /></button><button onClick={() => openDrawer('vault')}><KeyRound size={16} /> Quick access vault <ArrowUpRight size={13} /></button><button onClick={() => openDrawer('help')}><MessageCircle size={16} /> Help desk <ArrowUpRight size={13} /></button><button onClick={() => window.dispatchEvent(new Event('fets-open-ai'))}><Sparkles size={16} /> Ask FETS AI <ArrowUpRight size={13} /></button></section>
        <div className="md-margin-note"><Flower2 size={27} /><p>You bring something<br /><em>only you can.</em></p></div>
      </aside>

      <div className="md-main-column">
        <FocusSession storageKey={`${key}:focus`} onComplete={repository ? focusLog.complete : undefined} />
        {repository && <div className="md-focus-history"><Clock3 size={14} /><span>{focusLog.error ? 'Focus history is unavailable.' : `${focusLog.recent.length} recent focus session${focusLog.recent.length === 1 ? '' : 's'} saved`}{focusLog.pending > 0 && ` · ${focusLog.pending} waiting to sync`}{!focusLog.cached && ' · Browser backup unavailable'}</span>{focusLog.error && <button className="md-text-button" onClick={focusLog.retry}>Retry</button>}</div>}
        <section className="md-card md-notebook" aria-labelledby="md-note-title"><div className="md-card-heading"><span className="md-kicker"><BookOpen size={15} /> MY LITTLE NOTEBOOK</span><span className="md-mini-tag"><LockKeyhole size={10} /> Personal</span></div><h2 id="md-note-title">A thought worth keeping.</h2><p>A bright idea, a small win, or something to come back to.</p><label className="md-sr-only" htmlFor="md-note">Today’s personal note</label><textarea id="md-note" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} placeholder="Today, I’m thinking about…" /><div className="md-note-foot"><span role="status">{repository ? !journal.localSaved ? 'Browser backup unavailable. Save or copy your note.' : journal.dirty ? 'Draft saved on this browser' : journal.version !== null && (journal.status === 'saved' || journal.status === 'ready') ? 'Synced to your personal desk' : journal.status === 'ready' ? 'Ready for your first note' : 'Connecting to your personal desk…' : noteSaved ? <><Check size={12} /> Saved on this browser · today only</> : 'Couldn’t save. Keep a copy before leaving.'}</span><span>{note.length}/2000</span></div>{repository && <div className="md-journal-sync">
          {journal.message && <p role="status">{journal.message}</p>}
          <button className="md-button md-button-dark" disabled={!journal.canSave || !journal.dirty} onClick={() => void journal.save()}>{journal.status === 'saving' ? 'Saving…' : 'Save to my desk'}</button>
          {(journal.status === 'error' || journal.status === 'conflict') && <button className="md-text-button" onClick={() => void journal.reload(journal.status === 'conflict')}>{journal.status === 'conflict' ? 'Discard this draft & load cloud version' : 'Retry connection'}</button>}
        </div>}</section>
        <button className="md-growth-banner" onClick={() => setTab('growth')}><span className="md-growth-symbol"><Award size={28} /></span><span><span className="md-kicker">YOUR NEXT CHAPTER</span><strong>Good at what you do. Growing, too.</strong><small>Keep your certificates and qualifications close.</small></span><ArrowUpRight size={20} /></button>
      </div>

      <aside className="md-right-column">
        <section className="md-card md-team"><div className="md-card-heading"><span className="md-kicker"><Users size={15} /> THE PEOPLE PART</span><Heart size={17} /></div><h2>Better, together.</h2><p>A quick hello. A little help. A well-deserved thank-you.</p>{people.length > 0 ? <><label className="md-sr-only" htmlFor="md-team-search">Find a teammate</label><input id="md-team-search" className="md-team-search" value={teamQuery} onChange={e => setTeamQuery(e.target.value)} placeholder="Find a teammate…" /><div className="md-people-list">{teammates.map(person => <button className="md-person" key={person.id} onClick={() => openChat(person)} aria-label={`Chat with ${person.full_name}`}><Avatar name={person.full_name} src={person.avatar_url} small /><span><strong>{person.full_name}</strong><small>{person.branch_assigned?.replace(/_/g, ' ') || 'FETS team'}</small></span><MessageCircle size={16} /></button>)}</div>{teammates.length === 0 && <p className="md-empty">No teammates match that name.</p>}<div className="md-team-foot"><button className="md-text-button" onClick={()=>navigate("fets-chat")}>Open team chat · groups, voice & video <ArrowRight size={13}/></button></div></> : <div className="md-team-empty"><Users size={25} /><p>Your team will appear here when staff details are available.</p><button className="md-text-button" onClick={() => navigate('live')}>Visit the team space <ArrowRight size={13} /></button></div>}</section>
        <section className="md-card md-break"><div className="md-card-heading"><span className="md-kicker">OFF THE CLOCK, FOR A MOMENT</span><Coffee size={15} /></div><div className="md-break-symbol"><BreakIcon size={31} strokeWidth={1.5} /></div><span className="md-break-label">{idea.label}</span><h2>{idea.title}</h2><p>{idea.text}</p><button className="md-text-button" onClick={() => setBreakIndex((breakIndex + 1) % breakIdeas.length)}><Shuffle size={13} /> Another little idea</button></section>
      </aside>
    </div> : <section className="md-panel" aria-label={tabs.find(t => t.id === tab)?.label || 'My requests'}><div className="md-panel-heading"><button className="md-text-button" onClick={() => setTab('today')}><ArrowDown size={14} className="md-back-arrow" /> Back to my day</button><span className="md-kicker">{tab === 'requests' ? 'MAKE ROOM FOR LIFE' : 'YOUR WORK, IN ONE PLACE'}</span></div>{renderPanel(tab)}</section>}
    <footer className="md-footer"><span>Made for the people who make FETS.</span><span><Moon size={12} /> A little balance looks good on you.</span></footer>
  </div>;
}
