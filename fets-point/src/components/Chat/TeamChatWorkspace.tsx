import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Bookmark, Check, CheckCheck, ChevronLeft, Circle, FileText, MessageCircle, MoreHorizontal, Paperclip, Phone, Plus, Search, Send, Users, Video, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useConversations, useConversation, useMessages, useMessagesSubscription, useGetOrCreateDM, useSendMessage } from '../../hooks/useChat';
import { useAllStaff } from '../../hooks/useFetsConnect';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import CreateGroupChatModal from './CreateGroupChatModal';
import { LiveKitGroupCall } from './LiveKitGroupCall';
import './team-chat.css';

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
const time = (date: string) => new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const titleOf = (conversation: any, me?: string) => conversation?.is_group ? conversation.name : conversation?.members?.find((m: any) => m.user_id !== me)?.user?.full_name || conversation?.name || 'Direct conversation';
function Attachment({ path, label }: { path: string; label: string }) {
 const [url,setUrl]=useState('');
 useEffect(()=>{let active=true;if(path.startsWith('chat-files:')){supabase.storage.from('chat-files').createSignedUrl(path.slice(11),600,{download:true}).then(({data,error})=>{if(active&&!error)setUrl(data?.signedUrl||'');});}else if(/^https:\/\//.test(path))setUrl(path);return()=>{active=false;};},[path]);
 return url?<a className="tr-attachment" href={url} target="_blank" rel="noreferrer"><FileText size={14}/>{label || 'Download attachment'}</a>:<span className="tr-note">Attachment unavailable — refresh to retry.</span>;
}
export function TeamChatWorkspace({ navigate, initialConversationId, initialTargetUser }: { navigate?: (page: string) => void; initialConversationId?: string; initialTargetUser?: { id: string } }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: conversations = [], isLoading, error } = useConversations(user?.id || '');
  const { data: staff = [] } = useAllStaff();
  const [selected, setSelected] = useState('');
  const [group, setGroup] = useState(false);
  const [filter, setFilter] = useState<'all' | 'groups' | 'saved'>('all');
  const [query, setQuery] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [call, setCall] = useState<'audio' | 'video' | null>(null);
  const [showWork, setShowWork] = useState(false);
  const [workForm, setWorkForm] = useState<{ kind: 'follow_up' | 'decision'; messageId?: string } | null>(null);
  const [workTitle, setWorkTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState('');
  const [savingWork, setSavingWork] = useState(false);
  const { data: conversation } = useConversation(selected);
  const { data: messages = [], error: messagesError } = useMessages(selected);
  const send = useSendMessage();
  const dm = useGetOrCreateDM();
  useMessagesSubscription(selected);
  const end = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading,setUploading]=useState(false);
  const saved = useQuery({ queryKey: ['chat-saved', user?.id], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.from('chat_saved_messages').select('message_id,message:messages(id,conversation_id,content,created_at,type,file_path,sender:staff_profiles(full_name))').order('created_at', { ascending: false }); if (error) throw error; return data || []; } });
  const work = useQuery({ queryKey: ['chat-work', selected], enabled: !!selected,
    queryFn: async () => { const { data, error } = await supabase.from('chat_work_items').select('*,owner:staff_profiles(full_name)').eq('conversation_id', selected).order('created_at', { ascending: false }); if (error) throw error; return data || []; } });
  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['conversations', user.id] }); };
    const channel = supabase.channel(`team-conversations-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);
  useEffect(() => { if (!selected) return; const channel = supabase.channel(`chat-work-${selected}`).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_work_items', filter: `conversation_id=eq.${selected}` }, () => queryClient.invalidateQueries({ queryKey: ['chat-work', selected] })).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [selected, queryClient]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages.length]);
  const members = conversation?.members || [];
  const visible = conversations.filter((c: any) => (filter !== 'groups' || c.is_group) && titleOf(c, profile?.id).toLowerCase().includes(query.toLowerCase()));
  const savedIds = new Set(saved.data?.map((s: any) => s.message_id));
  const shownMessages: any[] = filter === 'saved' ? (saved.data || []).map((s: any) => s.message).filter(Boolean) : messages;
  const openWork = (work.data || []).filter((w: any) => w.kind === 'follow_up' && w.status !== 'done');
  const select = (id: string) => { setSelected(id); setFilter('all'); setMessageSearch(''); setDraft(''); };
  async function startDm(person: any) { if (!profile?.id) return; try { const conv = await dm.mutateAsync({ userId1: profile.id, userId2: person.id }); select(conv.id); } catch { /* Mutation reports the error. */ } }
  useEffect(() => {
    let cancelled = false;
    if (initialConversationId) { select(initialConversationId); return; }
    if (initialTargetUser?.id && profile?.id) {
      dm.mutateAsync({ userId1: profile.id, userId2: initialTargetUser.id })
        .then(conv => { if (!cancelled) select(conv.id); }).catch(() => { /* Mutation reports failures. */ });
    }
    return () => { cancelled = true; };
  }, [initialConversationId, initialTargetUser?.id, profile?.id]);
  async function sendMessage() { const content = draft.trim(); if (!content || !selected || !profile?.id || send.isPending) return; try { await send.mutateAsync({ conversationId: selected, senderId: profile.id, content }); setDraft(''); } catch { /* Keep the draft on failure. */ } }
  async function attach(file?: File) {
    if(!file||!selected||!user||!profile?.id)return;
    if(file.size>20*1024*1024){toast.error('Choose a file smaller than 20 MB');return;}
    setUploading(true);const path=`${selected}/${user.id}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    try{const {error}=await supabase.storage.from('chat-files').upload(path,file);if(error)throw error;
      try{await send.mutateAsync({conversationId:selected,senderId:profile.id,content:file.name,type:'file',filePath:`chat-files:${path}`});}catch(error){await supabase.storage.from('chat-files').remove([path]);throw error;}
    }catch(error){toast.error(error instanceof Error?error.message:'The attachment could not be sent');}finally{setUploading(false);if(fileInput.current)fileInput.current.value='';}
  }
  async function bookmark(message: any) { const result = savedIds.has(message.id) ? await supabase.from('chat_saved_messages').delete().eq('message_id', message.id).eq('user_id', user!.id) : await supabase.from('chat_saved_messages').insert({ message_id: message.id }); if (result.error) toast.error(result.error.message); else void saved.refetch(); }
  function beginWork(kind: 'follow_up' | 'decision', message?: any) { setWorkForm({ kind, messageId: message?.id }); setWorkTitle(message?.content || ''); setOwner(''); setDue(''); }
  async function saveWork() { if (!workForm || !workTitle.trim()) return; setSavingWork(true); const { error } = await supabase.from('chat_work_items').insert({ conversation_id: selected, message_id: workForm.messageId || null, kind: workForm.kind, title: workTitle.trim(), owner_id: owner || null, due_date: due || null }); setSavingWork(false); if (error) toast.error(error.message); else { setWorkForm(null); void work.refetch(); toast.success(workForm.kind === 'decision' ? 'Decision recorded' : 'Follow-up created'); } }
  async function toggleWork(item: any) { const { error } = await supabase.from('chat_work_items').update({ status: item.status === 'done' ? 'open' : 'done' }).eq('id', item.id); if (error) toast.error(error.message); else void work.refetch(); }
  async function copyBrief() { const items = work.data || []; const text = [titleOf(conversation, profile?.id), '', 'Decisions', ...items.filter((w: any) => w.kind === 'decision').map((w: any) => `• ${w.title}`), '', 'Open follow-ups', ...openWork.map((w: any) => `• ${w.title} — ${w.owner?.full_name || 'Unassigned'}${w.due_date ? ` · due ${w.due_date}` : ''}`)].join('\n'); try { await navigator.clipboard.writeText(text); toast.success('Conversation brief copied'); } catch { toast.error('Clipboard is unavailable in this browser'); } }
  return <div className={`team-room ${selected || filter === 'saved' ? 'has-conversation' : ''}`}>
    <header className="tr-heading"><div><span className="tr-kicker">FETS / TEAM SPACE</span><h1>Good conversations.<em>Better work.</em></h1></div><button className="tr-text-button" onClick={() => navigate?.('actionables')}>Our shared mission <ArrowUpRight size={16}/></button></header>
    <div className="tr-workspace">
      <aside className="tr-sidebar"><div className="tr-sidebar-title"><h2>Conversations</h2><button aria-label="Create group chat" onClick={() => setGroup(true)}><Plus size={19}/></button></div>
        <label className="tr-search"><Search size={16}/><input aria-label="Find a conversation" placeholder="Find a conversation" value={query} onChange={e => setQuery(e.target.value)}/></label>
        <nav className="tr-tabs" aria-label="Conversation filters">{(['all', 'groups', 'saved'] as const).map(f => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}>{f === 'all' ? 'All' : f === 'groups' ? 'Groups' : 'Saved'}</button>)}</nav>
        <div className="tr-conversation-list">{isLoading && <p className="tr-note">Loading conversations…</p>}{error && <p role="alert" className="tr-error">{error.message}</p>}{!isLoading && !visible.length && <p className="tr-note">A fresh start. Choose a teammate below or create a group.</p>}{visible.map((c: any) => <button key={c.id} className={`tr-conversation ${selected === c.id && filter !== 'saved' ? 'selected' : ''}`} onClick={() => select(c.id)}><span className={`tr-avatar ${c.is_group ? 'group' : ''}`}>{c.is_group ? <Users size={18}/> : initials(titleOf(c, profile?.id))}</span><span><strong>{titleOf(c, profile?.id)}</strong><small>{c.last_message_preview || 'Say hello'}</small></span>{c.last_message_at && <time>{time(c.last_message_at)}</time>}</button>)}</div>
        <div className="tr-people-heading"><span>YOUR TEAM</span><span>{staff.length}</span></div><div className="tr-people">{staff.filter((s: any) => s.id !== profile?.id && s.is_active !== false && s.full_name.toLowerCase().includes(query.toLowerCase())).map((s: any) => <button key={s.id} onClick={() => void startDm(s)} disabled={dm.isPending}><span className="tr-avatar small">{initials(s.full_name)}</span><span><strong>{s.full_name}</strong><small>{s.branch_assigned || 'FETS'}</small></span><MessageCircle size={15}/></button>)}</div>
        <div className="tr-sidebar-foot"><span className="tr-avatar small">{initials(profile?.full_name)}</span><div><strong>{profile?.full_name}</strong><small>Your space to stay connected</small></div></div>
      </aside>
      <section className="tr-main">{!selected && filter !== 'saved' ? <div className="tr-welcome"><div className="tr-orbit"><MessageCircle size={42}/><span/><i/></div><span className="tr-kicker">A LITTLE CLOSER, EVERY DAY</span><h2>Where the team<br/>comes together.</h2><p>Talk things through. Capture the decision.<br/>Give the next step a name and a date.</p><button className="tr-primary" onClick={() => setGroup(true)}><Plus size={17}/> Start a group</button><div className="tr-welcome-features"><span><Bookmark size={17}/> Save what matters</span><span><CheckCheck size={17}/> Follow through together</span><span><Video size={17}/> Meet in a moment</span></div></div> : <>
        <header className="tr-room-header"><button className="tr-back" aria-label="Back to conversations" onClick={() => { setSelected(''); setFilter('all'); }}><ChevronLeft size={20}/></button><span className="tr-avatar group">{filter === 'saved' ? <Bookmark size={20}/> : conversation?.is_group ? <Users size={20}/> : initials(titleOf(conversation, profile?.id))}</span><div><h2>{filter === 'saved' ? 'Your saved messages' : titleOf(conversation, profile?.id)}</h2><p>{filter === 'saved' ? 'Only you can see your saved collection' : `${members.length} people · A shared space for good work`}</p></div>{filter !== 'saved' && <div className="tr-call-actions"><button aria-label="Join voice call" onClick={() => setCall('audio')}><Phone size={18}/></button><button aria-label="Join video call" onClick={() => setCall('video')}><Video size={19}/></button><button aria-label="Show decisions and follow-ups" onClick={() => setShowWork(!showWork)}><MoreHorizontal size={21}/></button></div>}</header>
        <label className="tr-message-search"><Search size={14}/><input aria-label="Search messages" placeholder="Search messages in this space" value={messageSearch} onChange={e => setMessageSearch(e.target.value)}/></label>
        <div className="tr-messages" aria-live="polite">{(messagesError || saved.error) && <p role="alert" className="tr-error">Messages could not be loaded. Please refresh.</p>}{shownMessages.length === 0 && <div className="tr-empty-thread"><MessageCircle size={28}/><h3>{filter === 'saved' ? 'Keep the useful bits close.' : 'Every good project starts with a conversation.'}</h3><p>{filter === 'saved' ? 'Use the bookmark beside a message to save it here.' : 'Your messages and shared decisions will live here.'}</p></div>}{shownMessages.filter(m => (m.content || '').toLowerCase().includes(messageSearch.toLowerCase())).map(m => <article key={m.id} className={`tr-message ${m.sender_id === profile?.id ? 'own' : ''}`}><span className="tr-avatar small">{initials(m.sender?.full_name || 'Teammate')}</span><div><div className="tr-message-meta"><strong>{m.sender?.full_name || 'Teammate'}</strong><time>{new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} · {time(m.created_at)}</time></div><p className="tr-bubble">{m.type === 'text' || !m.type ? m.content : `[${m.type}] ${m.type === 'call_log' ? 'Call activity' : 'Attachment'}`}</p>{m.file_path && <Attachment path={m.file_path} label={m.content}/>}<div className="tr-message-tools"><button aria-label={savedIds.has(m.id) ? 'Unsave message' : 'Save message'} onClick={() => void bookmark(m)} className={savedIds.has(m.id) ? 'active' : ''}><Bookmark size={13}/></button>{filter !== 'saved' ? <><button onClick={() => beginWork('follow_up', m)}><CheckCheck size={13}/> Follow up</button><button onClick={() => beginWork('decision', m)}>Record decision</button></> : <button onClick={() => select(m.conversation_id)}>Open conversation <ArrowUpRight size={13}/></button>}</div></div></article>)}<div ref={end}/></div>
        {filter !== 'saved' && <div className="tr-composer"><textarea aria-label="Message" placeholder="A thought, a question, a little progress…" value={draft} maxLength={10000} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}/><div><input type="file" ref={fileInput} hidden onChange={e=>void attach(e.target.files?.[0])}/><button className="tr-file-button" aria-label="Attach a file" disabled={uploading} onClick={()=>fileInput.current?.click()}><Paperclip size={17}/>{uploading?'Uploading…':''}</button><span>Enter to send · Shift + Enter for a new line</span><button className="tr-primary" onClick={() => void sendMessage()} disabled={!draft.trim() || send.isPending}><Send size={16}/>{send.isPending ? 'Sending…' : 'Send'}</button></div></div>}
      </>}</section>
      {selected && filter !== 'saved' && <aside className={`tr-followthrough ${showWork ? 'open' : ''}`}><header><span className="tr-kicker">FROM TALK TO PROGRESS</span><button aria-label="Close follow-ups" onClick={() => setShowWork(false)}><X size={17}/></button></header><h2>Make it happen.</h2><p className="tr-note">The important things, kept in sight.</p>{work.error && <p role="alert" className="tr-error">Follow-ups could not be loaded.</p>}<div className="tr-work-heading"><h3>Follow-ups <span>{openWork.length}</span></h3><button aria-label="Add follow-up" onClick={() => beginWork('follow_up')}><Plus size={16}/></button></div>{(work.data || []).filter((w: any) => w.kind === 'follow_up').map((w: any) => <div className={`tr-work-item ${w.status === 'done' ? 'done' : ''}`} key={w.id}><button aria-label={w.status === 'done' ? 'Reopen follow-up' : 'Complete follow-up'} onClick={() => void toggleWork(w)}>{w.status === 'done' ? <Check size={16}/> : <Circle size={16}/>}</button><div><strong>{w.title}</strong><small>{w.owner?.full_name || 'Unassigned'}{w.due_date ? ` · ${w.due_date}` : ''}</small></div></div>)}{!openWork.length && <p className="tr-note">No open follow-ups. Turn a message into the next step.</p>}<div className="tr-work-heading"><h3>Decisions</h3><button aria-label="Record decision" onClick={() => beginWork('decision')}><Plus size={16}/></button></div>{(work.data || []).filter((w: any) => w.kind === 'decision').map((w: any) => <div className="tr-decision" key={w.id}><span>AGREED</span><p>{w.title}</p></div>)}<button className="tr-brief" onClick={() => void copyBrief()}><FileText size={17}/> Copy a handover brief <ArrowUpRight size={15}/></button><p className="tr-note">Decisions and open follow-ups, ready for the next shift.</p></aside>}
    </div>
    {group && <CreateGroupChatModal setIsModalOpen={setGroup} onCreated={select}/>}
    {call && selected && <LiveKitGroupCall conversationId={selected} mode={call} onClose={() => setCall(null)}/>}
    {workForm && <div className="tr-modal-backdrop"><form className="tr-modal" role="dialog" aria-modal="true" aria-label={workForm.kind === 'decision' ? 'Record decision' : 'Create follow-up'} onSubmit={e => { e.preventDefault(); void saveWork(); }}><button type="button" className="tr-modal-close" onClick={() => setWorkForm(null)} aria-label="Close"><X size={19}/></button><span className="tr-kicker">KEEP THE MOMENTUM</span><h2>{workForm.kind === 'decision' ? 'What did we decide?' : 'What happens next?'}</h2><label>{workForm.kind === 'decision' ? 'Decision' : 'Next step'}<textarea required maxLength={2000} value={workTitle} onChange={e => setWorkTitle(e.target.value)}/></label>{workForm.kind === 'follow_up' && <div className="tr-form-row"><label>Owner<select value={owner} onChange={e => setOwner(e.target.value)}><option value="">Unassigned</option>{members.map((m: any) => <option key={m.user_id} value={m.user_id}>{m.user?.full_name || 'Teammate'}</option>)}</select></label><label>Due date<input type="date" value={due} onChange={e => setDue(e.target.value)}/></label></div>}<button className="tr-primary" disabled={savingWork || !workTitle.trim()}>{savingWork ? 'Saving…' : 'Save to this conversation'}</button></form></div>}
  </div>;
}
