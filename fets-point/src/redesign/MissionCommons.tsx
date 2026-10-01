import { useEffect, useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, HeartHandshake, MessageCircle, PartyPopper, Plus, Send, Sparkles, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { CENTRE_STAGES, CENTRE_STAGE_LABELS, changesSince, closestCentres, istToday, myNextSteps } from './mission-workplace';
import './mission-commons.css';

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
const dateLabel = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const kinds: Record<string, string> = { update: 'An update', help: 'Asking for help', win: 'A moment worth celebrating', activity: 'Work moved forward' };
const postSelect = '*,author:staff_profiles(full_name),institution:expansion_institutions(name),work_item:mission_work_items(title,impact)';

type CommonsProps = { institutions: any[]; tasks: any[]; staff: any[]; onTask: (task: any) => void; onInstitution: (institution: any) => void; onAddTask: (institution?: any) => void; onMyWork: () => void; loading: boolean };

export default function MissionCommons({ institutions, tasks, staff, onTask, onInstitution, onAddTask, onMyWork, loading }: CommonsProps) {
  const { profile } = useAuth();
  const personal = myNextSteps(tasks, profile?.id);
  const available = tasks.filter(t => !t.owner_id && t.status === 'open');
  const blocked = tasks.filter(t => t.status === 'blocked');
  const centres = closestCentres(institutions, tasks).slice(0, 3);
  const today = istToday();
  return <div className="mc-home">
    <section className="mc-daily" aria-label="Your daily starting point">
      <div className="mc-daily-heading"><div><span className="ms-eyebrow">YOUR PLACE IN THE MISSION</span><h2>Let’s move something forward, {profile?.full_name?.split(' ')[0] || 'team'}.</h2><p>A useful next step. A little help. Something worth sharing.</p></div><button className="mc-quiet" onClick={onMyWork}>All my work <ArrowUpRight size={15}/></button></div>
      <div className="mc-start-grid">
        <div className="mc-start-card"><span className="mc-number">01 / YOUR NEXT MOVE</span><h3>{personal.length ? 'Start here today' : 'Find your next contribution'}</h3>{loading ? <p>Loading your next steps…</p> : (personal.length ? personal : available).slice(0, 3).map(t => <button className="mc-step" key={t.id} onClick={() => onTask(t)}><strong>{t.title}</strong><span>{t.institution?.name || 'Across our mission'}{t.due_date ? ` · ${t.due_date < today ? 'Overdue · ' : t.due_date === today ? 'Due today · ' : 'Due '}${t.due_date}` : !t.owner_id ? ' · Open to claim' : ''}</span>{t.status === 'blocked' && <small>Needs help: {t.blocker}</small>}</button>)}{!loading && !personal.length && !available.length && <p>No assigned next steps yet. Add a useful contribution or help a teammate below.</p>}<button className="mc-inline" onClick={() => onAddTask()}><Plus size={14}/> Add a next step</button></div>
        <div className="mc-start-card mc-help-card"><span className="mc-number">02 / SOMEONE NEEDS YOU</span><h3>{blocked.length ? `${blocked.length} ${blocked.length === 1 ? 'step needs' : 'steps need'} a hand` : 'Make room for each other'}</h3>{blocked.slice(0, 3).map(t => <button className="mc-step" key={t.id} onClick={() => onTask(t)}><strong>{t.title}</strong><span>{t.owner?.full_name || 'Team'} · {t.blocker || 'Tell the team how you can help'}</span><small>Join the conversation <ArrowUpRight size={12}/></small></button>)}{!blocked.length && <p>No blocked work right now. The shared feed below is a place to ask a question before it becomes a blocker.</p>}</div>
      </div>
    </section>
    <div className="mc-social-layout"><MissionFeed institutions={institutions} tasks={tasks} staff={staff} onTask={onTask} onInstitution={onInstitution}/><aside className="mc-centres"><span className="ms-eyebrow">CLOSEST TO THE NEXT MILESTONE</span><h2>Every centre has a story.</h2><p>Ordered by recorded stage. Approval and delivery are different milestones.</p>{centres.map(c => <article key={c.id} className="mc-centre"><button className="mc-centre-title" onClick={() => onInstitution(c)}><strong>{c.name}</strong><ArrowUpRight size={15}/></button><small>{c.district} · {c.assigned_staff_name || 'Owner to be assigned'}</small><div className="mc-stage-track" aria-label={`Recorded stage: ${CENTRE_STAGE_LABELS[c.stage] || c.stage}`}>{CENTRE_STAGES.map((stage, index) => <span key={stage} className={index <= c.stageIndex ? 'reached' : ''} title={CENTRE_STAGE_LABELS[stage]}/>)}</div><b>{CENTRE_STAGE_LABELS[c.stage] || 'Stage not recorded'}</b>{c.remaining.length ? <button className="mc-centre-next" onClick={() => onTask(c.remaining[0])}><span>NEXT OPEN STEP</span>{c.remaining[0].title}<small>{c.remaining.length} open · {c.wins} completed contributions</small></button> : <div className="mc-centre-next"><span>NEXT OPEN STEP</span>No next step recorded yet.<button className="mc-inline" onClick={() => onAddTask(c)}>Plan one together <Plus size={12}/></button></div>}</article>)}{!centres.length && <div className="mc-empty">Add shortlisted institutions to see where each one stands. No progress is assumed.</div>}<div className="mc-culture"><Sparkles size={20}/><h3>Small contributions count.</h3><p>A contact introduced. A visit arranged. A document checked. Share the work so the whole team can build on it.</p></div></aside></div>
  </div>;
}

export function MissionFeed({ institutions, tasks, staff, onTask, onInstitution, workItem }: { institutions: any[]; tasks: any[]; staff: any[]; onTask: (task: any) => void; onInstitution: (institution: any) => void; workItem?: any }) {
  const { user, profile } = useAuth(); const qc = useQueryClient(); const channelId = useId();
  const [limit, setLimit] = useState(30); const [filter, setFilter] = useState('all');
  const [kind, setKind] = useState('update'); const [content, setContent] = useState(''); const [centre, setCentre] = useState(''); const [posting, setPosting] = useState(false);
  const [enteredAt] = useState(() => new Date().toISOString()); const checkpointed = useRef(false); const composer = useRef<HTMLTextAreaElement>(null);
  const visit = useQuery({ queryKey: ['mission-visit', user?.id, enteredAt], enabled: !!user && !workItem, staleTime: Infinity, retry: false, queryFn: async () => { const { data, error } = await supabase.from('mission_visits').select('last_seen_at').eq('user_id', user!.id).maybeSingle(); if (error) throw error; return data?.last_seen_at || null; } });
  const feed = useQuery({ queryKey: ['mission-feed', workItem?.id || 'all', limit], queryFn: async () => {
    let query = supabase.from('mission_posts').select(postSelect).is('parent_id', null).order('last_activity_at', { ascending: false }).limit(limit);
    if (workItem) query = query.eq('work_item_id', workItem.id);
    const { data, error } = await query; if (error) throw error;
    const ids = (data || []).map(p => p.id);
    const reactions = ids.length ? await supabase.from('mission_reactions').select('*').in('post_id', ids) : { data: [], error: null };
    if (reactions.error) throw reactions.error;
    return { posts: data || [], reactions: reactions.data || [] };
  } });
  useEffect(() => {
    if (!workItem && user && visit.isSuccess && feed.isSuccess && !checkpointed.current) {
      checkpointed.current = true;
      void supabase.from('mission_visits').upsert({ user_id: user.id, last_seen_at: enteredAt }).then(({error}) => { if (error) toast.error('Your visit could not be saved. Recent updates are still available.'); });
    }
  }, [workItem, user, visit.isSuccess, feed.isSuccess, enteredAt]);
  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: ['mission-feed'] }); void qc.invalidateQueries({ queryKey: ['mission-thread'] }); };
    const channel = supabase.channel(`mission-commons-${channelId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'mission_posts' }, refresh).on('postgres_changes', { event: '*', schema: 'public', table: 'mission_reactions' }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [channelId, qc]);
  const posts = feed.data?.posts || []; const newPosts = changesSince(posts, visit.data);
  const visible = posts.filter(p => filter === 'all' || filter === 'new' && newPosts.some(n => n.id === p.id) || filter === 'help' && p.kind === 'help' && !p.resolved || filter === 'win' && p.kind === 'win');
  async function publish() {
    if (!profile?.id || !content.trim() || posting) return;
    setPosting(true);
    try { const { error } = await supabase.from('mission_posts').insert({ author_id: profile.id, kind, content: content.trim(), institution_id: workItem?.institution_id || centre || null, work_item_id: workItem?.id || null }); if (error) throw error; setContent(''); setFilter('all'); await qc.invalidateQueries({ queryKey: ['mission-feed'] }); toast.success(kind === 'win' ? 'A moment shared with the team' : 'Your team is in the picture'); }
    catch (error: any) { toast.error(error.message || 'Could not post. Your draft is kept here.'); } finally { setPosting(false); }
  }
  return <section className="mc-stream" aria-label={workItem ? 'Conversation about this work' : 'Shared team feed'}>
    {!workItem && <header className="mc-stream-heading"><div><span className="ms-eyebrow">THE TEAM, IN MOTION</span><h2>Our shared day.</h2></div>{visit.isSuccess && <button className="mc-new-badge" onClick={() => setFilter('new')}>{visit.data ? `${newPosts.length}${posts.length === limit ? '+' : ''} new since your last visit` : 'Your first visit · welcome in'}</button>}</header>}
    {visit.error && <p role="status" className="mc-muted">Your last visit couldn’t be loaded. All recent updates are shown.</p>}
    <form className="mc-composer" onSubmit={e => { e.preventDefault(); void publish(); }}>
      <div className="mc-compose-top"><span className="mc-avatar">{initials(profile?.full_name)}</span><div><strong>{profile?.full_name || 'You'}</strong><small>{workItem ? 'Keep this work moving together' : 'Your update helps everyone move forward'}</small></div></div>
      <nav aria-label="Type of contribution">{[{ id: 'update', label: 'Share an update', icon: MessageCircle }, { id: 'help', label: 'Ask for help', icon: HeartHandshake }, { id: 'win', label: 'Celebrate a win', icon: PartyPopper }].map(k => <button type="button" key={k.id} aria-pressed={kind === k.id} onClick={() => { setKind(k.id); composer.current?.focus(); }}><k.icon size={15}/>{k.label}</button>)}</nav>
      <textarea ref={composer} aria-label="Your contribution" required maxLength={4000} placeholder={kind === 'help' ? 'What would help? Give someone a clear way to contribute…' : kind === 'win' ? 'What moved forward, and who helped make it happen?' : 'What changed? What did you learn? What is the next step?'} value={content} onChange={e => setContent(e.target.value)}/>
      <footer>{!workItem ? <select aria-label="Link update to an institution" value={centre} onChange={e => setCentre(e.target.value)}><option value="">Across our mission</option>{institutions.map(i => <option value={i.id} key={i.id}>{i.name}</option>)}</select> : <span className="mc-muted">Linked to this next step</span>}<button className="ms-primary" disabled={posting || !content.trim()}><Send size={14}/>{posting ? 'Sharing…' : 'Share with the team'}</button></footer>
    </form>
    <nav className="mc-feed-filters" aria-label="Team feed filters">{[['all', 'Everything'], ['help', 'Help wanted'], ['win', 'Wins'], ...(!workItem && visit.data ? [['new', 'Since your last visit']] : [])].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</nav>
    {feed.error && <div role="alert" className="ms-error">The team feed could not be loaded. <button onClick={() => void feed.refetch()}>Try again</button></div>}
    {feed.isLoading && <p className="mc-muted">Bringing the team’s updates together…</p>}
    {visible.map(post => <PostCard key={post.id} post={post} reactions={feed.data?.reactions.filter(r => r.post_id === post.id) || []} staff={staff} isNew={!!visit.data && Date.parse(post.last_activity_at || post.created_at) > Date.parse(visit.data)} onTask={() => { const task = tasks.find(t => t.id === post.work_item_id); if (task) onTask(task); }} onInstitution={() => { const i = institutions.find(i => i.id === post.institution_id); if (i) onInstitution(i); }}/>) }
    {!feed.isLoading && !feed.error && !visible.length && <div className="mc-empty"><MessageCircle size={25}/><h3>{filter === 'new' ? 'You’re up to date with these updates.' : filter === 'help' ? 'No open requests in these updates.' : filter === 'win' ? 'Make the small wins visible.' : 'This is where our working day comes together.'}</h3><p>{filter === 'win' ? 'Recognise a useful contribution, a good conversation or a milestone reached.' : 'Share an update, ask a question, or tell the team how you can help.'}</p></div>}
    {posts.length === limit && <button className="mc-load" onClick={() => setLimit(value => value + 30)}>Load earlier updates</button>}
  </section>;
}

function PostCard({ post, reactions, staff, isNew, onTask, onInstitution }: { post: any; reactions: any[]; staff: any[]; isNew: boolean; onTask: () => void; onInstitution: () => void }) {
  const { user, profile } = useAuth(); const qc = useQueryClient(); const [expanded, setExpanded] = useState(false); const [reply, setReply] = useState(''); const [busy, setBusy] = useState(false);
  const comments = useQuery({ queryKey: ['mission-thread', post.id], enabled: expanded, queryFn: async () => { const { data, error } = await supabase.from('mission_posts').select('*,author:staff_profiles(full_name)').eq('parent_id', post.id).order('created_at'); if (error) throw error; return data || []; } });
  const cheers = reactions.filter(r => r.reaction === 'celebrate'); const helpers = reactions.filter(r => r.reaction === 'help');
  async function react(reaction: string) {
    if (!user || busy) return; setBusy(true);
    const exists = reactions.some(r => r.reaction === reaction && r.user_id === user.id);
    try { const result = exists ? await supabase.from('mission_reactions').delete().eq('post_id', post.id).eq('user_id', user.id).eq('reaction', reaction) : await supabase.from('mission_reactions').insert({ post_id: post.id, reaction }); if (result.error) throw result.error; await qc.invalidateQueries({ queryKey: ['mission-feed'] }); }
    catch (error: any) { toast.error(error.message); } finally { setBusy(false); }
  }
  async function respond() {
    if (!reply.trim() || !profile?.id || busy) return; setBusy(true);
    try { const { error } = await supabase.from('mission_posts').insert({ author_id: profile.id, kind: 'comment', content: reply.trim(), parent_id: post.id }); if (error) throw error; setReply(''); await comments.refetch(); }
    catch (error: any) { toast.error(error.message); } finally { setBusy(false); }
  }
  async function resolve() {
    setBusy(true);
    try { const { error } = await supabase.from('mission_posts').update({ resolved: !post.resolved }).eq('id', post.id); if (error) throw error; await qc.invalidateQueries({ queryKey: ['mission-feed'] }); }
    catch (error: any) { toast.error(error.message); } finally { setBusy(false); }
  }
  return <article className={`mc-post mc-post-${post.kind}`}>
    <header><span className="mc-avatar">{initials(post.author?.full_name) || 'F'}</span><div><strong>{post.author?.full_name || 'FETS team'}</strong><small>{kinds[post.kind]} · {dateLabel(post.created_at)}</small></div>{isNew && <span className="mc-new-dot">New</span>}{post.kind === 'win' && <PartyPopper size={21}/>}</header>
    <p className="mc-post-content">{post.content}</p>
    {post.work_item ? <button className="mc-context" onClick={onTask}><span>NEXT STEP</span><strong>{post.work_item.title}</strong>{post.work_item.impact && <small>{post.work_item.impact}</small>}<ArrowUpRight size={14}/></button> : post.institution && <button className="mc-context" onClick={onInstitution}><span>CENTRE</span><strong>{post.institution.name}</strong><ArrowUpRight size={14}/></button>}
    {helpers.length > 0 && <p className="mc-helpers"><HeartHandshake size={15}/>{helpers.map(r => staff.find(s => s.user_id === r.user_id)?.full_name || 'A teammate').join(', ')} offered to help.</p>}
    {post.resolved && <p className="mc-resolved"><Check size={14}/> Help received · resolved</p>}
    <footer><button disabled={busy} aria-pressed={cheers.some(r => r.user_id === user?.id)} onClick={() => void react('celebrate')}><PartyPopper size={15}/> Celebrate{cheers.length ? ` · ${cheers.length}` : ''}</button><button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><MessageCircle size={15}/>{expanded ? 'Hide conversation' : `Join the conversation${post.reply_count ? ` · ${post.reply_count}` : ''}`}</button>{post.kind === 'help' && !post.resolved && <button disabled={busy} aria-pressed={helpers.some(r => r.user_id === user?.id)} onClick={() => void react('help')}><HeartHandshake size={15}/>{helpers.some(r => r.user_id === user?.id) ? 'Help offered' : 'I can help'}</button>}{post.kind === 'help' && post.author_id === profile?.id && <button disabled={busy} onClick={() => void resolve()}>{post.resolved ? 'Reopen request' : 'Mark resolved'}</button>}</footer>
    {expanded && <div className="mc-comments">{comments.isLoading && <p>Loading conversation…</p>}{comments.error && <p role="alert">Comments could not be loaded. <button onClick={() => void comments.refetch()}>Retry</button></p>}{comments.data?.map(c => <div key={c.id} className="mc-comment"><span className="mc-avatar">{initials(c.author?.full_name)}</span><div><strong>{c.author?.full_name || 'Teammate'}</strong><time>{dateLabel(c.created_at)}</time><p>{c.content}</p></div></div>)}<form onSubmit={e => { e.preventDefault(); void respond(); }}><label className="mc-sr" htmlFor={`reply-${post.id}`}>Reply to {post.author?.full_name || 'this update'}</label><textarea id={`reply-${post.id}`} placeholder="Add a thought, a question or an offer of help…" maxLength={4000} required value={reply} onChange={e => setReply(e.target.value)}/><button className="ms-primary" disabled={busy || !reply.trim()}>{busy ? 'Sending…' : 'Reply'}<Send size={13}/></button></form></div>}
  </article>;
}

export function MissionWorkConversation({ task, institutions, tasks, staff, onClose, onClaim, onStatus, onInstitution }: { task: any; institutions: any[]; tasks: any[]; staff: any[]; onClose: () => void; onClaim: (task: any) => void; onStatus: (task: any, status: string) => void; onInstitution: (institution: any) => void }) {
  const current = tasks.find(t => t.id === task.id) || task;
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  return <div className="ms-modal-backdrop"><section className="ms-modal mc-work-dialog" role="dialog" aria-modal="true" aria-label="Work together"><button className="ms-close" aria-label="Close work conversation" onClick={onClose}><X size={20}/></button><span className="ms-eyebrow">ONE CONTRIBUTION TO OUR SHARED MISSION</span><h2>{current.title}</h2><p className="mc-muted">{current.institution?.name || 'Across our mission'} · {current.owner?.full_name || 'Open to claim'}{current.due_date ? ` · Due ${current.due_date}` : ''}</p><div className="mc-impact"><strong>Why this matters</strong><p>{current.impact || 'Connect this step to the next centre milestone in the conversation below.'}</p></div>{current.blocker && <p className="ms-blocker">Help needed: {current.blocker}</p>}{!current.owner_id && current.status !== 'done' && <button className="ms-primary" onClick={() => onClaim(current)}>I’ll take this next step</button>}<div className="mc-work-actions"><span className="mc-muted">Status: {current.status.replace('_', ' ')}</span>{current.status !== 'done' && <><button className="mc-quiet" onClick={() => onStatus(current, 'in_progress')}>Start / resume</button><button className="mc-quiet" onClick={() => onStatus(current, 'blocked')}>Ask for a hand</button><button className="ms-primary" onClick={() => onStatus(current, 'done')}><Check size={14}/> Mark complete</button></>}{current.status === 'done' && <button className="mc-quiet" onClick={() => onStatus(current, 'open')}>Reopen step</button>}</div><MissionFeed workItem={current} institutions={institutions} tasks={tasks} staff={staff} onTask={() => {}} onInstitution={onInstitution}/></section></div>;
}
