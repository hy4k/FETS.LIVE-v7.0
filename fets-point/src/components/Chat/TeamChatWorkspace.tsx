import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Bell, Bookmark, Check, CheckCheck, ChevronLeft, Circle, CornerUpLeft, FileText, Info, LogOut, MessageCircle, Paperclip, Pencil, Phone, PhoneIncoming, PhoneMissed, Plus, Search, Send, Smile, Trash2, UserMinus, UserPlus, Users, Video, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useAllStaff } from '../../hooks/useFetsConnect';
import { supabase } from '../../lib/supabase';
import { useCallCenter } from './calls/CallCenter';
import { callAlertsState, enableCallAlerts } from './calls/chat-calls';
import { chatApi, clockOf, isImage, listTime, seenBy, thread, type ChatMessage, type InboxMember, type InboxRow } from './chat-api';
import './team-space.css';

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '·';
const first = (name = '') => name.split(' ')[0] || name;
const EMOJI = ['👍', '🙏', '✅', '😊', '😂', '🎉', '👏', '🔥', '❤️', '👀', '🤝', '⏰'];
const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');
const titleOf = (c: InboxRow | undefined, me: string) => !c ? '' : c.is_group ? c.name || 'Group' : c.members.find(m => m.user_id !== me)?.full_name || c.name || 'Conversation';

function Avatar({ name, src, online, group, size = 'md' }: { name?: string | null; src?: string | null; online?: boolean; group?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`tc-avatar ${size} ${group ? 'group' : ''}`}>{group ? <Users size={size === 'lg' ? 22 : 17} /> : src ? <img src={src} alt="" /> : initials(name || '')}{online && <i className="tc-online" aria-label="Online" />}</span>;
}

function FileView({ m }: { m: ChatMessage }) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  const image = isImage(m);
  useEffect(() => { let live = true; if (m.file_path) chatApi.fileUrl(m.file_path, !image).then(u => { if (live) setUrl(u); }).catch(() => undefined); return () => { live = false; }; }, [m.file_path, image]);
  if (!url) return <span className="tc-file muted"><FileText size={15} />{m.content || 'Attachment'}</span>;
  if (image) return <>
    <button className="tc-image" onClick={() => setOpen(true)} aria-label={`Open ${m.content}`}><img src={url} alt={m.content} loading="lazy" /></button>
    {open && <div className="tc-lightbox" role="dialog" aria-label={m.content} onClick={() => setOpen(false)}><img src={url} alt={m.content} /><button className="tc-icon light" aria-label="Close"><X size={18} /></button></div>}
  </>;
  return <a className="tc-file" href={url} target="_blank" rel="noreferrer"><FileText size={15} />{m.content || 'Download attachment'}<ArrowUpRight size={13} /></a>;
}

export function TeamChatWorkspace({ initialConversationId, initialTargetUser }: { navigate?: (page: string) => void; initialConversationId?: string; initialTargetUser?: { id: string } }) {
  const { user, profile } = useAuth();
  const me: string = profile?.id || '';
  const qc = useQueryClient();
  const calls = useCallCenter();
  const { data: staff = [] } = useAllStaff();
  const inbox = useQuery({ queryKey: ['chat-inbox', me], enabled: !!me, queryFn: chatApi.inbox, refetchInterval: 60000 });
  const [selected, setSelected] = useState('');
  const [view, setView] = useState<'all' | 'unread' | 'groups' | 'saved'>('all');
  const [query, setQuery] = useState('');
  const [find, setFind] = useState('');
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [emoji, setEmoji] = useState(false);
  const [panel, setPanel] = useState<'info' | 'work' | null>(null);
  const [newGroup, setNewGroup] = useState(false);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [alerts, setAlerts] = useState(callAlertsState());
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const roomChannel = useRef<any>(null);
  const lastTyped = useRef(0);

  const rows = inbox.data || [];
  const conversation = rows.find(c => c.id === selected);
  const messages = useQuery({ queryKey: ['chat-messages', selected], enabled: !!selected, queryFn: () => chatApi.messages(selected) });
  const saved = useQuery({ queryKey: ['chat-saved', user?.id], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.from('chat_saved_messages').select('message_id,message:messages(id,conversation_id,content,created_at,type,file_path,sender_id,edited_at,is_deleted,reply_to,sender:staff_profiles(id,full_name,avatar_url))').order('created_at', { ascending: false }); if (error) throw error; return data || []; } });
  const work = useQuery({ queryKey: ['chat-work', selected], enabled: !!selected,
    queryFn: async () => { const { data, error } = await supabase.from('chat_work_items').select('*,owner:staff_profiles(full_name)').eq('conversation_id', selected).order('created_at', { ascending: false }); if (error) throw error; return data || []; } });
  const savedIds = new Set((saved.data || []).map((s: any) => s.message_id));

  // Who is online, across the app.
  const online = calls.online;
  useEffect(() => { calls.setOpenChat(selected); return () => calls.setOpenChat(''); }, [selected, calls]);
  useEffect(() => {
    const open = (e: Event) => { const id = (e as CustomEvent<{ conversationId?: string }>).detail?.conversationId; if (id) select(id); };
    window.addEventListener('fets-open-chat', open);
    return () => window.removeEventListener('fets-open-chat', open);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New messages and read receipts anywhere refresh the list; the open room updates in place.
  useEffect(() => {
    if (!me) return;
    const refresh = () => void qc.invalidateQueries({ queryKey: ['chat-inbox', me] });
    const ch = supabase.channel(`chat-inbox-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p: any) => {
        refresh();
        const m = (p.new || p.old) as ChatMessage;
        if (m?.conversation_id) void qc.invalidateQueries({ queryKey: ['chat-messages', m.conversation_id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [me, qc]);

  // Typing, per room.
  useEffect(() => {
    if (!selected || !me) return;
    const ch = supabase.channel(`chat-room-${selected}`);
    ch.on('broadcast', { event: 'typing' }, ({ payload }: any) => { if (payload?.id && payload.id !== me) setTyping(t => ({ ...t, [payload.id]: Date.now() })); }).subscribe();
    roomChannel.current = ch;
    return () => { roomChannel.current = null; void supabase.removeChannel(ch); setTyping({}); };
  }, [selected, me]);
  useEffect(() => { const t = window.setInterval(() => setTyping(old => Object.fromEntries(Object.entries(old).filter(([, at]) => Date.now() - at < 4000))), 1500); return () => window.clearInterval(t); }, []);

  // Reading a room marks it read.
  const list = useMemo(() => messages.data || [], [messages.data]);
  useEffect(() => {
    if (!selected || document.visibilityState !== 'visible') return;
    const t = window.setTimeout(() => { chatApi.markRead(selected).then(() => qc.invalidateQueries({ queryKey: ['chat-inbox', me] })).catch(() => undefined); }, 400);
    return () => window.clearTimeout(t);
  }, [selected, list.length, me, qc]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [selected, list.length, pending.length]);

  const select = useCallback((id: string) => { setSelected(id); setView(v => v === 'saved' ? 'all' : v); setFind(''); setDraft(''); setReplyTo(null); setEditing(null); setPanel(null); }, []);
  useEffect(() => {
    let cancelled = false;
    if (initialConversationId) { select(initialConversationId); return; }
    if (initialTargetUser?.id && me) chatApi.direct(me, initialTargetUser.id).then(id => { if (!cancelled) { void inbox.refetch(); select(id); } }).catch(e => toast.error(message(e)));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId, initialTargetUser?.id, me]);

  const openDirect = async (personId: string) => {
    try { const id = await chatApi.direct(me, personId); await inbox.refetch(); select(id); } catch (e) { toast.error(message(e)); }
  };
  const ping = () => {
    if (Date.now() - lastTyped.current < 2500) return;
    lastTyped.current = Date.now();
    void roomChannel.current?.send({ type: 'broadcast', event: 'typing', payload: { id: me } });
  };

  const send = async (content = draft.trim()) => {
    if (!selected || !me || !content) return;
    if (editing) {
      try { await chatApi.edit(editing.id, content); setEditing(null); setDraft(''); void messages.refetch(); } catch (e) { toast.error(message(e)); }
      return;
    }
    const temp: ChatMessage = { id: `temp-${crypto.randomUUID()}`, conversation_id: selected, sender_id: me, content, type: 'text', file_path: null, created_at: new Date().toISOString(), edited_at: null, is_deleted: false, reply_to: replyTo?.id ?? null, pending: 'sending' };
    setPending(p => [...p, temp]); setDraft(''); const reply = replyTo; setReplyTo(null); setEmoji(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    try {
      await chatApi.send({ conversationId: selected, content, replyTo: reply?.id });
      await messages.refetch();
      setPending(p => p.filter(x => x.id !== temp.id));
      void qc.invalidateQueries({ queryKey: ['chat-inbox', me] });
    } catch (e) {
      setPending(p => p.map(x => x.id === temp.id ? { ...x, pending: 'failed' } : x));
      toast.error(message(e));
    }
  };
  const retry = async (m: ChatMessage) => { setPending(p => p.filter(x => x.id !== m.id)); await send(m.content); };
  const attach = async (file?: File | null) => {
    if (!file || !selected || !user) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Choose a file smaller than 20 MB'); return; }
    setUploading(true);
    let path = '';
    try {
      const up = await chatApi.upload(selected, user.id, file); path = up.path;
      await chatApi.send({ conversationId: selected, content: file.name, type: file.type.startsWith('image/') ? 'image' : 'file', filePath: up.filePath, replyTo: replyTo?.id });
      setReplyTo(null); void messages.refetch(); void qc.invalidateQueries({ queryKey: ['chat-inbox', me] });
    } catch (e) { if (path) void chatApi.discard(path); toast.error(message(e)); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const remove = async (m: ChatMessage) => { if (!window.confirm('Delete this message for everyone?')) return; try { await chatApi.remove(m.id); void messages.refetch(); } catch (e) { toast.error(message(e)); } };
  const bookmark = async (m: ChatMessage) => {
    const r = savedIds.has(m.id) ? await supabase.from('chat_saved_messages').delete().eq('message_id', m.id).eq('user_id', user!.id) : await supabase.from('chat_saved_messages').insert({ message_id: m.id });
    if (r.error) toast.error(r.error.message); else void saved.refetch();
  };

  // ------------------------------------------------------------- derived
  const visible = rows.filter(c => (view !== 'groups' || c.is_group) && (view !== 'unread' || c.unread > 0) && titleOf(c, me).toLowerCase().includes(query.toLowerCase()));
  const totalUnread = rows.reduce((n, c) => n + (c.unread || 0), 0);
  const members: InboxMember[] = conversation?.members || [];
  const other = !conversation?.is_group ? members.find(m => m.user_id !== me) : undefined;
  const byId = useMemo(() => new Map(list.map(m => [m.id, m])), [list]);
  const shown: ChatMessage[] = view === 'saved' ? (saved.data || []).map((s: any) => s.message).filter(Boolean) : [...list, ...pending.filter(p => p.conversation_id === selected)];
  const filtered = find.trim() ? shown.filter(m => (m.content || '').toLowerCase().includes(find.trim().toLowerCase())) : shown;
  const typers = Object.keys(typing).map(id => members.find(m => m.user_id === id)?.full_name).filter(Boolean) as string[];
  const liveCall = selected ? calls.live[selected] : undefined;
  const inThisCall = Boolean(liveCall && liveCall.participants.includes(me));
  const lastMine = [...list].reverse().find(m => m.sender_id === me && !m.is_deleted && m.type !== 'call_log');
  const people = staff.filter((s: any) => s.id !== me && s.is_active !== false && s.full_name);
  const roomOpen = Boolean(selected) || view === 'saved';
  const searching = find !== '';

  const subtitle = view === 'saved' ? 'Only you can see your saved messages'
    : typers.length ? `${typers.map(first).join(', ')} ${typers.length > 1 ? 'are' : 'is'} typing…`
    : conversation?.is_group ? `${members.length} members · ${members.filter(m => online.has(m.user_id)).length} online`
    : other && online.has(other.user_id) ? 'Online' : 'Offline';

  return <div className={`tc-room ${roomOpen ? 'has-room' : ''}`}>
    <header className="tc-heading">
      <div><span className="tc-kicker">FETS / TEAM SPACE</span><h1>Good conversations.<em>Better work.</em></h1></div>
      {alerts === 'default' && <button className="tc-alerts" onClick={async () => setAlerts(await enableCallAlerts())}><Bell size={15} /> Turn on call alerts</button>}
    </header>

    <div className="tc-shell">
      <aside className="tc-side">
        <div className="tc-side-head"><h2>Chats{totalUnread > 0 && <span className="tc-badge">{totalUnread}</span>}</h2><button className="tc-icon solid" aria-label="New group" onClick={() => setNewGroup(true)}><Plus size={18} /></button></div>
        <label className="tc-search"><Search size={15} /><input aria-label="Search chats and people" placeholder="Search chats and people" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <nav className="tc-filters" aria-label="Filter chats">{(['all', 'unread', 'groups', 'saved'] as const).map(f => <button key={f} aria-pressed={view === f} onClick={() => { setView(f); if (f === 'saved') setSelected(''); }}>{f === 'all' ? 'All' : f === 'unread' ? 'Unread' : f === 'groups' ? 'Groups' : 'Saved'}</button>)}</nav>
        <div className="tc-list">
          {inbox.isLoading && <p className="tc-note">Loading chats…</p>}
          {inbox.error && <div className="tc-error" role="alert">Chats could not load. {String((inbox.error as Error).message).includes('chat_inbox') ? 'The chat database update has not been run yet.' : (inbox.error as Error).message}<button onClick={() => void inbox.refetch()}>Retry</button></div>}
          {!inbox.isLoading && !visible.length && !inbox.error && <p className="tc-note">{view === 'unread' ? 'You’re all caught up.' : 'No chats yet. Pick a teammate below or start a group.'}</p>}
          {visible.map(c => {
            const title = titleOf(c, me); const peer = c.members.find(m => m.user_id !== me);
            const live = calls.live[c.id];
            return <button key={c.id} className={`tc-chat ${selected === c.id ? 'selected' : ''} ${c.unread ? 'unread' : ''}`} onClick={() => select(c.id)}>
              <Avatar name={title} src={c.is_group ? null : peer?.avatar_url} group={c.is_group} online={!c.is_group && !!peer && online.has(peer.user_id)} />
              <span className="tc-chat-text"><strong>{title}</strong><small>{live ? <><Phone size={11} /> Call in progress</> : c.last_message_preview || 'Say hello'}</small></span>
              <span className="tc-chat-meta"><time>{listTime(c.last_message_at)}</time>{c.unread > 0 && <span className="tc-badge">{c.unread > 99 ? '99+' : c.unread}</span>}</span>
            </button>;
          })}
        </div>
        <div className="tc-people-head"><span>YOUR TEAM</span><span>{people.filter((p: any) => online.has(p.id)).length} online</span></div>
        <div className="tc-people">{people.filter((s: any) => s.full_name.toLowerCase().includes(query.toLowerCase()))
          .sort((a: any, b: any) => Number(online.has(b.id)) - Number(online.has(a.id)) || a.full_name.localeCompare(b.full_name))
          .map((s: any) => <button key={s.id} onClick={() => void openDirect(s.id)}><Avatar name={s.full_name} src={s.avatar_url} size="sm" online={online.has(s.id)} /><span><strong>{s.full_name}</strong><small>{s.branch_assigned || 'FETS'}</small></span><MessageCircle size={14} /></button>)}</div>
      </aside>

      <section className="tc-main">
        {!roomOpen ? <div className="tc-welcome">
          <div className="tc-orbit"><MessageCircle size={40} /></div>
          <span className="tc-kicker">A LITTLE CLOSER, EVERY DAY</span>
          <h2>Where the team comes together.</h2>
          <p>Message anyone at FETS, start a group, or ring a teammate. Calls ring on their screen wherever they are in fets.live.</p>
          <div className="tc-welcome-actions"><button className="tc-primary" onClick={() => setNewGroup(true)}><Users size={16} /> New group</button></div>
        </div> : <>
          <header className="tc-room-head">
            <button className="tc-icon tc-back" aria-label="Back to chats" onClick={() => { setSelected(''); if (view === 'saved') setView('all'); }}><ChevronLeft size={20} /></button>
            {view === 'saved' ? <span className="tc-avatar md"><Bookmark size={18} /></span> : <Avatar name={titleOf(conversation, me)} src={other?.avatar_url} group={conversation?.is_group} online={!!other && online.has(other.user_id)} />}
            <button className="tc-room-title" onClick={() => view !== 'saved' && setPanel(panel === 'info' ? null : 'info')}><h2>{view === 'saved' ? 'Saved messages' : titleOf(conversation, me)}</h2><p className={typers.length ? 'typing' : ''}>{subtitle}</p></button>
            {view !== 'saved' && <div className="tc-room-actions">
              <button className="tc-icon" aria-label="Voice call" title="Voice call" disabled={!!calls.current && !inThisCall} onClick={() => void calls.call(selected, 'audio')}><Phone size={18} /></button>
              <button className="tc-icon" aria-label="Video call" title="Video call" disabled={!!calls.current && !inThisCall} onClick={() => void calls.call(selected, 'video')}><Video size={19} /></button>
              <button className="tc-icon" aria-label="Search in chat" title="Search" onClick={() => setFind(searching ? '' : ' ')}><Search size={18} /></button>
              <button className="tc-icon" aria-label="Decisions and follow-ups" title="Follow-ups" onClick={() => setPanel(panel === 'work' ? null : 'work')}><CheckCheck size={18} /></button>
              <button className="tc-icon" aria-label="Chat info" title="Info" onClick={() => setPanel(panel === 'info' ? null : 'info')}><Info size={18} /></button>
            </div>}
          </header>
          {liveCall && !inThisCall && view !== 'saved' && <div className="tc-call-banner"><PhoneIncoming size={16} /><span>{liveCall.kind === 'video' ? 'Video' : 'Voice'} call in progress · {liveCall.participants.length} in the call</span><button className="tc-primary small" onClick={() => void calls.join(liveCall)}>Join</button></div>}
          {searching && <label className="tc-find"><Search size={14} /><input autoFocus aria-label="Search messages" placeholder="Search messages" value={find.trim()} onChange={e => setFind(e.target.value || ' ')} /><button className="tc-icon" aria-label="Close search" onClick={() => setFind('')}><X size={14} /></button></label>}

          <div className="tc-messages" aria-live="polite">
            {messages.error && <div className="tc-error" role="alert">Messages could not load: {(messages.error as Error).message}<button onClick={() => void messages.refetch()}>Retry</button></div>}
            {messages.isLoading && view !== 'saved' && <p className="tc-note center">Loading messages…</p>}
            {!messages.isLoading && filtered.length === 0 && <div className="tc-empty"><MessageCircle size={26} /><h3>{view === 'saved' ? 'Keep the useful bits close.' : find.trim() ? 'No messages match.' : 'Say hello 👋'}</h3><p>{view === 'saved' ? 'Save a message from its menu to find it here.' : find.trim() ? 'Try another word.' : 'Messages, files and calls in this chat appear here.'}</p></div>}
            {thread(filtered).map(item => {
              if (item.kind === 'day') return <div key={item.key} className="tc-day"><span>{item.label}</span></div>;
              const { m, first: isFirst, last } = item;
              const missed = /Missed|Declined/.test(m.content);
              if (m.type === 'call_log') return <div key={m.id} className={`tc-call-log ${missed ? 'missed' : ''}`}>{missed ? <PhoneMissed size={14} /> : <Phone size={14} />}{m.content}<time>{clockOf(m.created_at)}</time></div>;
              const mine = m.sender_id === me;
              const quoted = m.reply_to ? byId.get(m.reply_to) : undefined;
              const seen = mine && lastMine?.id === m.id && conversation ? seenBy(m, members, me) : null;
              return <article key={m.id} className={`tc-msg ${mine ? 'mine' : ''} ${isFirst ? 'first' : ''} ${last ? 'last' : ''} ${m.pending || ''}`}>
                {!mine && <span className="tc-msg-avatar">{last && conversation?.is_group ? <Avatar name={m.sender?.full_name} src={m.sender?.avatar_url} size="sm" /> : null}</span>}
                <div className="tc-bubble-wrap">
                  {((!mine && isFirst && conversation?.is_group) || view === 'saved') && <span className="tc-sender">{m.sender?.full_name || 'Teammate'}</span>}
                  <div className={`tc-bubble ${m.is_deleted ? 'deleted' : ''}`} id={`m-${m.id}`}>
                    {quoted && <button className="tc-quote" onClick={() => document.getElementById(`m-${quoted.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}><strong>{quoted.sender_id === me ? 'You' : quoted.sender?.full_name || 'Teammate'}</strong><span>{quoted.is_deleted ? 'Deleted message' : quoted.file_path && isImage(quoted) ? 'Photo' : quoted.content}</span></button>}
                    {m.is_deleted ? <em>This message was deleted</em> : m.file_path ? <FileView m={m} /> : <p>{m.content}</p>}
                    <span className="tc-stamp">{m.edited_at && !m.is_deleted ? 'edited · ' : ''}{clockOf(m.created_at)}{mine && !m.pending && (seen?.all ? <CheckCheck size={14} className="read" aria-label="Read" /> : <Check size={14} aria-label="Sent" />)}{m.pending === 'sending' && ' · sending'}</span>
                  </div>
                  {m.pending === 'failed' && <button className="tc-retry" onClick={() => void retry(m)}>Not sent · Tap to retry</button>}
                  {seen && conversation?.is_group && seen.read > 0 && <span className="tc-seen">Seen by {seen.all ? 'everyone' : seen.names.map(first).join(', ')}</span>}
                  {!m.pending && !m.is_deleted && <div className="tc-msg-tools">
                    {view !== 'saved' && <button aria-label="Reply" title="Reply" onClick={() => { setReplyTo(m); setEditing(null); inputRef.current?.focus(); }}><CornerUpLeft size={14} /></button>}
                    <button aria-label={savedIds.has(m.id) ? 'Unsave' : 'Save'} title={savedIds.has(m.id) ? 'Unsave' : 'Save'} className={savedIds.has(m.id) ? 'active' : ''} onClick={() => void bookmark(m)}><Bookmark size={14} /></button>
                    {view !== 'saved' && <button aria-label="Make a follow-up" title="Follow-up" onClick={() => { setPanel('work'); window.setTimeout(() => window.dispatchEvent(new CustomEvent('tc-work', { detail: m })), 0); }}><CheckCheck size={14} /></button>}
                    {mine && m.type === 'text' && view !== 'saved' && <button aria-label="Edit" title="Edit" onClick={() => { setEditing(m); setReplyTo(null); setDraft(m.content); inputRef.current?.focus(); }}><Pencil size={14} /></button>}
                    {mine && view !== 'saved' && <button aria-label="Delete" title="Delete" onClick={() => void remove(m)}><Trash2 size={14} /></button>}
                    {view === 'saved' && <button aria-label="Open chat" title="Open chat" onClick={() => select(m.conversation_id)}><ArrowUpRight size={14} /></button>}
                  </div>}
                </div>
              </article>;
            })}
            {typers.length > 0 && <div className="tc-typing" aria-label="Someone is typing"><span /><span /><span /></div>}
            <div ref={endRef} />
          </div>

          {view !== 'saved' && <footer className="tc-composer" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void attach(e.dataTransfer.files?.[0]); }}>
            {(replyTo || editing) && <div className="tc-context">{editing ? <Pencil size={14} /> : <CornerUpLeft size={14} />}<div><strong>{editing ? 'Editing your message' : `Replying to ${replyTo!.sender_id === me ? 'yourself' : replyTo!.sender?.full_name || 'teammate'}`}</strong><span>{(editing || replyTo)!.content.slice(0, 140)}</span></div><button className="tc-icon" aria-label="Cancel" onClick={() => { setReplyTo(null); if (editing) { setEditing(null); setDraft(''); } }}><X size={14} /></button></div>}
            {emoji && <div className="tc-emoji">{EMOJI.map(e => <button key={e} onClick={() => { setDraft(d => d + e); inputRef.current?.focus(); }}>{e}</button>)}</div>}
            <div className="tc-compose-row">
              <button className="tc-icon" aria-label="Emoji" onClick={() => setEmoji(!emoji)}><Smile size={19} /></button>
              <input type="file" ref={fileRef} hidden onChange={e => void attach(e.target.files?.[0])} />
              <button className="tc-icon" aria-label="Attach a file or photo" disabled={uploading || !!editing} onClick={() => fileRef.current?.click()}>{uploading ? <span className="tc-spin" /> : <Paperclip size={18} />}</button>
              <textarea ref={inputRef} rows={1} aria-label="Message" placeholder={editing ? 'Edit your message' : 'Type a message'} value={draft} maxLength={10000}
                onChange={e => { setDraft(e.target.value); ping(); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; }}
                onPaste={e => { const f = Array.from(e.clipboardData.files)[0]; if (f) { e.preventDefault(); void attach(f); } }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } if (e.key === 'Escape') { setReplyTo(null); if (editing) { setEditing(null); setDraft(''); } } }} />
              <button className="tc-send" aria-label={editing ? 'Save edit' : 'Send'} disabled={!draft.trim()} onClick={() => void send()}>{editing ? <Check size={18} /> : <Send size={17} />}</button>
            </div>
          </footer>}
        </>}
      </section>

      {selected && view !== 'saved' && panel === 'info' && conversation && <ChatInfo conversation={conversation} me={me} online={online} staff={people} onClose={() => setPanel(null)} onChanged={() => void inbox.refetch()} onLeft={() => { setSelected(''); void inbox.refetch(); }} onMessage={id => void openDirect(id)} />}
      {selected && view !== 'saved' && panel === 'work' && <WorkPanel conversationId={selected} members={members} work={work.data || []} reload={() => void work.refetch()} title={titleOf(conversation, me)} onClose={() => setPanel(null)} />}
    </div>
    {newGroup && <NewGroup staff={people} onClose={() => setNewGroup(false)} onCreated={id => { setNewGroup(false); void inbox.refetch().then(() => select(id)); }} />}
  </div>;
}

function ChatInfo({ conversation, me, online, staff, onClose, onChanged, onLeft, onMessage }: { conversation: InboxRow; me: string; online: Set<string>; staff: any[]; onClose: () => void; onChanged: () => void; onLeft: () => void; onMessage: (id: string) => void }) {
  const [name, setName] = useState(conversation.name || '');
  const [adding, setAdding] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const admin = conversation.members.some(m => m.user_id === me && m.is_admin) || conversation.created_by === me;
  const act = async (fn: () => Promise<void>, done?: string) => { setBusy(true); try { await fn(); if (done) toast.success(done); onChanged(); } catch (e) { toast.error(message(e)); } finally { setBusy(false); } };
  const other = conversation.members.find(m => m.user_id !== me);
  const inGroup = new Set(conversation.members.map(m => m.user_id));
  return <aside className="tc-panel" aria-label="Chat info">
    <header><span className="tc-kicker">{conversation.is_group ? 'GROUP INFO' : 'CONTACT'}</span><button className="tc-icon" aria-label="Close" onClick={onClose}><X size={16} /></button></header>
    <div className="tc-panel-hero"><Avatar name={conversation.is_group ? conversation.name : other?.full_name} src={conversation.is_group ? null : other?.avatar_url} group={conversation.is_group} size="lg" online={!conversation.is_group && !!other && online.has(other.user_id)} />
      {conversation.is_group && admin ? <form onSubmit={e => { e.preventDefault(); if (name.trim() && name !== conversation.name) void act(() => chatApi.rename(conversation.id, name.trim()), 'Group renamed'); }}><input aria-label="Group name" value={name} maxLength={100} onChange={e => setName(e.target.value)} />{name !== (conversation.name || '') && <button className="tc-primary small" disabled={busy}>Save</button>}</form>
        : <h3>{conversation.is_group ? conversation.name : other?.full_name}</h3>}
      <p>{conversation.is_group ? `${conversation.members.length} members` : other && online.has(other.user_id) ? 'Online now' : 'Offline'}</p>
    </div>
    {conversation.is_group && <>
      <div className="tc-panel-head"><h4>Members</h4>{admin && <button className="tc-icon" aria-label="Add members" onClick={() => setAdding(adding ? null : [])}><UserPlus size={16} /></button>}</div>
      {adding && <div className="tc-add">{staff.filter(s => !inGroup.has(s.id)).map(s => <label key={s.id}><input type="checkbox" checked={adding.includes(s.id)} onChange={() => setAdding(a => a!.includes(s.id) ? a!.filter(x => x !== s.id) : [...a!, s.id])} /><Avatar name={s.full_name} size="sm" />{s.full_name}</label>)}
        <button className="tc-primary small" disabled={busy || !adding.length} onClick={() => void act(async () => { await chatApi.addMembers(conversation.id, adding); setAdding(null); }, 'Added to the group')}>Add {adding.length || ''}</button></div>}
      <ul className="tc-members">{conversation.members.map(m => <li key={m.user_id}><Avatar name={m.full_name} src={m.avatar_url} size="sm" online={online.has(m.user_id)} /><span><strong>{m.user_id === me ? 'You' : m.full_name}</strong><small>{m.is_admin ? 'Admin' : online.has(m.user_id) ? 'Online' : 'Member'}</small></span>
        {m.user_id !== me && <button className="tc-icon" aria-label={`Message ${m.full_name}`} onClick={() => onMessage(m.user_id)}><MessageCircle size={14} /></button>}
        {admin && m.user_id !== me && <button className="tc-icon" aria-label={`Remove ${m.full_name}`} onClick={() => { if (window.confirm(`Remove ${m.full_name} from the group?`)) void act(() => chatApi.removeMember(conversation.id, m.user_id), 'Removed'); }}><UserMinus size={14} /></button>}</li>)}</ul>
      <button className="tc-danger" disabled={busy} onClick={() => { if (window.confirm('Leave this group?')) void act(async () => { await chatApi.leave(conversation.id); onLeft(); }, 'You left the group'); }}><LogOut size={15} /> Leave group</button>
    </>}
  </aside>;
}

function WorkPanel({ conversationId, members, work, reload, title, onClose }: { conversationId: string; members: InboxMember[]; work: any[]; reload: () => void; title: string; onClose: () => void }) {
  const [form, setForm] = useState<{ kind: 'follow_up' | 'decision'; messageId?: string; title: string; owner: string; due: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const on = (e: Event) => { const m = (e as CustomEvent<ChatMessage>).detail; setForm({ kind: 'follow_up', messageId: m.id, title: m.content, owner: '', due: '' }); }; window.addEventListener('tc-work', on); return () => window.removeEventListener('tc-work', on); }, []);
  const open = work.filter(w => w.kind === 'follow_up' && w.status !== 'done');
  const save = async () => { if (!form?.title.trim()) return; setBusy(true); const { error } = await supabase.from('chat_work_items').insert({ conversation_id: conversationId, message_id: form.messageId || null, kind: form.kind, title: form.title.trim(), owner_id: form.owner || null, due_date: form.due || null }); setBusy(false); if (error) toast.error(error.message); else { setForm(null); reload(); } };
  const toggle = async (w: any) => { const { error } = await supabase.from('chat_work_items').update({ status: w.status === 'done' ? 'open' : 'done' }).eq('id', w.id); if (error) toast.error(error.message); else reload(); };
  const brief = async () => { const text = [title, '', 'Decisions', ...work.filter(w => w.kind === 'decision').map(w => `• ${w.title}`), '', 'Open follow-ups', ...open.map(w => `• ${w.title} — ${w.owner?.full_name || 'Unassigned'}${w.due_date ? ` · due ${w.due_date}` : ''}`)].join('\n'); try { await navigator.clipboard.writeText(text); toast.success('Brief copied'); } catch { toast.error('Clipboard is unavailable'); } };
  return <aside className="tc-panel" aria-label="Decisions and follow-ups">
    <header><span className="tc-kicker">FROM TALK TO PROGRESS</span><button className="tc-icon" aria-label="Close" onClick={onClose}><X size={16} /></button></header>
    <div className="tc-panel-head"><h4>Follow-ups <span>{open.length}</span></h4><button className="tc-icon" aria-label="Add follow-up" onClick={() => setForm({ kind: 'follow_up', title: '', owner: '', due: '' })}><Plus size={16} /></button></div>
    {form && <form className="tc-work-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      <textarea required autoFocus maxLength={2000} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={form.kind === 'decision' ? 'What did we decide?' : 'What happens next?'} />
      {form.kind === 'follow_up' && <div><select aria-label="Owner" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })}><option value="">Unassigned</option>{members.map(m => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select><input type="date" aria-label="Due date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} /></div>}
      <div><button type="button" className="tc-link" onClick={() => setForm(null)}>Cancel</button><button className="tc-primary small" disabled={busy || !form.title.trim()}>Save</button></div>
    </form>}
    {work.filter(w => w.kind === 'follow_up').map(w => <div key={w.id} className={`tc-work ${w.status === 'done' ? 'done' : ''}`}><button aria-label={w.status === 'done' ? 'Reopen' : 'Done'} onClick={() => void toggle(w)}>{w.status === 'done' ? <Check size={15} /> : <Circle size={15} />}</button><div><strong>{w.title}</strong><small>{w.owner?.full_name || 'Unassigned'}{w.due_date ? ` · ${w.due_date}` : ''}</small></div></div>)}
    {!open.length && !form && <p className="tc-note">No open follow-ups. Turn a message into the next step from its menu.</p>}
    <div className="tc-panel-head"><h4>Decisions</h4><button className="tc-icon" aria-label="Record decision" onClick={() => setForm({ kind: 'decision', title: '', owner: '', due: '' })}><Plus size={16} /></button></div>
    {work.filter(w => w.kind === 'decision').map(w => <div key={w.id} className="tc-decision"><span>AGREED</span><p>{w.title}</p></div>)}
    <button className="tc-link block" onClick={() => void brief()}><FileText size={15} /> Copy a handover brief</button>
  </aside>;
}

function NewGroup({ staff, onClose, onCreated }: { staff: any[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [find, setFind] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async () => { setBusy(true); try { onCreated(await chatApi.createGroup(name.trim(), chosen)); } catch (e) { toast.error(message(e)); } finally { setBusy(false); } };
  return <div className="tc-modal-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="tc-modal" role="dialog" aria-modal="true" aria-label="New group" onSubmit={e => { e.preventDefault(); void create(); }}>
      <header><h2>New group</h2><button type="button" className="tc-icon" aria-label="Close" onClick={onClose}><X size={17} /></button></header>
      <label className="tc-field">Group name<input required autoFocus maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Calicut morning team" /></label>
      {chosen.length > 0 && <div className="tc-chips">{chosen.map(id => { const s = staff.find(x => x.id === id); return <button type="button" key={id} onClick={() => setChosen(c => c.filter(x => x !== id))}>{s?.full_name}<X size={12} /></button>; })}</div>}
      <label className="tc-search"><Search size={14} /><input aria-label="Find people" placeholder="Find people" value={find} onChange={e => setFind(e.target.value)} /></label>
      <div className="tc-pick">{staff.filter(s => s.full_name.toLowerCase().includes(find.toLowerCase())).map(s => <label key={s.id}><input type="checkbox" checked={chosen.includes(s.id)} onChange={() => setChosen(c => c.includes(s.id) ? c.filter(x => x !== s.id) : [...c, s.id])} /><Avatar name={s.full_name} src={s.avatar_url} size="sm" /><span>{s.full_name}<small>{s.branch_assigned || 'FETS'}</small></span>{chosen.includes(s.id) && <Check size={15} />}</label>)}</div>
      <button className="tc-primary" disabled={busy || !name.trim() || !chosen.length}><Users size={16} /> {busy ? 'Creating…' : `Create group · ${chosen.length + 1} people`}</button>
    </form>
  </div>;
}
