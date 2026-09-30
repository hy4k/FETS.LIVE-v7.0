import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, BookOpen, Camera, Check, ChevronDown, CircleStop, ExternalLink, Headphones, Mic, MonitorUp, Plus, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GeminiLiveClient, type LiveMessageTurn } from '../lib/geminiLiveClient';
import { agentRequest, type AgentReply, type AgentStatus, type HandoverProposal, type SourceEvidence } from './fets-ai-api';
import { offerHandoverDraft } from './handover-draft';
import './fets-ai-agent.css';

type Message={id:string;role:'user'|'assistant';text:string;evidence?:SourceEvidence[];proposals?:AgentReply['proposals'];live?:boolean};
type Media={mic:boolean;camera:boolean;screen:boolean};
const emptyMedia:Media={mic:false,camera:false,screen:false};
const starter=['What needs attention in my centre today?','Who is rostered, and who is lead?','Help draft today’s handover','Find our current procedure'];
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;

export function FetsAIAgent({userId,branch,page,navigate,withMobileNav=false}:{userId:string;branch:string;page:string;navigate:(page:string)=>void;withMobileNav?:boolean}){
  const [open,setOpen]=useState(false),[mode,setMode]=useState<'ask'|'live'|'knowledge'>('ask');
  const [status,setStatus]=useState<AgentStatus|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState('');
  const [liveState,setLiveState]=useState('disconnected'),[media,setMedia]=useState<Media>(emptyMedia);
  const [docTitle,setDocTitle]=useState(''),[docContent,setDocContent]=useState(''),[docScope,setDocScope]=useState('*'),[docUrl,setDocUrl]=useState('');
  const [docs,setDocs]=useState<{id:string;title:string;branch:string;version:number;status:string;updated_at:string}[]>([]);
  const client=useRef<GeminiLiveClient|null>(null),bottom=useRef<HTMLDivElement|null>(null);
  const latest=useRef({branch,page});latest.current={branch,page};
  const ready=Boolean(status?.ready);

  useEffect(()=>{const handler=()=>setOpen(true);window.addEventListener('fets-open-ai',handler);return()=>window.removeEventListener('fets-open-ai',handler);},[]);
  useEffect(()=>{let active=true;setStatus(null);setNotice('');agentRequest<AgentStatus>({action:'status',branch,page}).then(value=>{if(active)setStatus(value);}).catch(e=>{if(active)setNotice(e.message);});return()=>{active=false;};},[branch,userId]);
  useEffect(()=>{client.current?.disconnect();client.current=null;setLiveState('disconnected');setMedia(emptyMedia);setMessages([]);return()=>{client.current?.disconnect();client.current=null;};},[branch,userId]);
  useEffect(()=>{client.current?.updatePageContext(page);},[page]);
  useEffect(()=>{if(open)bottom.current?.scrollIntoView?.({behavior:'smooth',block:'end'});},[messages,open,mode]);
  useEffect(()=>{if(open&&mode==='knowledge'&&status?.admin)loadDocs();},[open,mode,status?.admin,branch]);

  const loadDocs=async()=>{const {data,error}=await supabase.from('fets_ai_documents').select('id,title,branch,version,status,updated_at').order('updated_at',{ascending:false}).limit(30);if(error)setNotice('The knowledge shelf is unavailable.');else setDocs(data||[]);};
  const send=async(value=input)=>{
    const text=value.trim();if(!text||busy||!ready)return;
    const requestBranch=latest.current.branch;
    const current=[...messages,{id:uid(),role:'user' as const,text}];setMessages(current);setInput('');setBusy(true);setNotice('');
    try{
      const reply=await agentRequest<AgentReply>({action:'chat',branch:latest.current.branch,page:latest.current.page,message:text,history:messages.filter(m=>!m.live).slice(-8).map(m=>({role:m.role,text:m.text}))});
      if(latest.current.branch===requestBranch)setMessages(old=>[...old,{id:uid(),role:'assistant',text:reply.text,evidence:reply.evidence,proposals:reply.proposals}]);
    }catch(e){if(latest.current.branch===requestBranch)setNotice(e instanceof Error?e.message:'Could not send your message.');}
    finally{if(latest.current.branch===requestBranch)setBusy(false);}
  };
  const requestLive=async()=>{
    if(!ready)return;setNotice('');
    if(client.current?.isConnected()){client.current.disconnect();return;}
    const liveBranch=latest.current.branch;
    const instance=new GeminiLiveClient({
      getSession:()=>agentRequest<{token:string;setup:Record<string,unknown>}>({action:'live-token',branch:liveBranch,page:latest.current.page}),
      executeTool:async(name,args)=>{if(latest.current.branch!==liveBranch)throw new Error('Centre changed.');const data=await agentRequest<{result:Record<string,unknown>}>({action:'tool',branch:liveBranch,page:latest.current.page,name,args});if(data.result.type==='handover-draft'||data.result.type==='navigation')setMessages(old=>[...old,{id:uid(),role:'assistant',text:data.result.type==='handover-draft'?'I prepared a handover draft for your review.':'Here is a page you can open.',proposals:[data.result as AgentReply['proposals'][number]],live:true}]);return data.result;},
      onStatusChange:(state,error)=>{setLiveState(state);if(error)setNotice(error);},
      onMediaChange:setMedia,
      onTurnUpdate:(turn:LiveMessageTurn)=>setMessages(old=>{const id=`live-${turn.id}`;const next:Message={id,role:turn.sender==='gemini'?'assistant':'user',text:turn.text||'[Voice or video]',live:true};const index=old.findIndex(m=>m.id===id);if(index<0)return [...old,next];const copy=[...old];copy[index]=next;return copy;}),
    });client.current=instance;
    try{await instance.connect();}catch(e){setNotice(e instanceof Error?e.message:'Live session unavailable.');}
  };
  const toggleMedia=async(kind:keyof Media)=>{
    const live=client.current;if(!live?.isConnected())return;
    try{setNotice('');if(kind==='mic'){media.mic?live.stopAudioInput():await live.startAudioInput();}else if(kind==='camera'){media.camera?live.stopCameraStream():await live.startCameraStream();}else{media.screen?live.stopScreenStream():await live.startScreenStream();}}
    catch(e){setNotice(e instanceof Error?e.message:'Media permission was not granted.');}
  };
  const saveDoc=async(e:FormEvent)=>{e.preventDefault();if(!status?.admin)return;setBusy(true);setNotice('');try{
    const {error}=await supabase.from('fets_ai_documents').insert({title:docTitle.trim(),content:docContent.trim(),branch:docScope,status:'published',source_url:docUrl.trim()||null});
    if(error)throw error;setDocTitle('');setDocContent('');setDocUrl('');setNotice('Approved document published. Future searches will use this version.');await loadDocs();
  }catch(e){setNotice(e instanceof Error?e.message:'Could not publish the document.');}finally{setBusy(false);}};
  const reviewDraft=(draft:HandoverProposal)=>{offerHandoverDraft(draft);window.dispatchEvent(new CustomEvent('fets-handover-draft',{detail:{branch:draft.branch,day:draft.day}}));setOpen(false);navigate('handover');};
  const jump=(target:string)=>{setOpen(false);navigate(target);};
  return createPortal(<div className={`fets-ai-root ${withMobileNav?'fets-ai-with-nav':''}`}>
    {!open&&<button className={`fets-ai-orb ${liveState!=='disconnected'?'fets-ai-orb-live':''}`} aria-label="Open FETS AI assistant" onClick={()=>setOpen(true)}><span className="fets-ai-orb-core"><Sparkles size={25}/></span><span className="fets-ai-orb-label">Ask FETS AI</span>{media.mic||media.camera||media.screen?<span className="fets-ai-recording-dot"/>:null}</button>}
    {open&&<section className="fets-ai-panel" role="dialog" aria-label="FETS AI assistant" aria-modal="false">
      <div className="fets-ai-panel-head"><div className="fets-ai-mark"><Sparkles size={22}/></div><div><small>YOUR WORK COMPANION</small><h2>FETS AI <span>is here.</span></h2></div><button className="fets-ai-icon-button" aria-label="Minimize assistant" onClick={()=>setOpen(false)}><ChevronDown size={21}/></button></div>
      <div className="fets-ai-context"><span className="fets-ai-status-dot"/>{branch==='global'?'All centres':branch} · {page.replace(/-/g,' ')}<span>{ready?'Connected to your workspace':'Setup pending'}</span></div>
      <nav className="fets-ai-tabs" aria-label="Assistant modes"><button aria-current={mode==='ask'} onClick={()=>setMode('ask')}><Sparkles size={15}/> Ask</button><button aria-current={mode==='live'} onClick={()=>setMode('live')}><Headphones size={15}/> Live</button>{status?.admin&&<button aria-current={mode==='knowledge'} onClick={()=>setMode('knowledge')}><BookOpen size={15}/> Knowledge</button>}</nav>
      {notice&&<div className="fets-ai-notice" role="status">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={14}/></button></div>}
      {status&&!ready&&<div className="fets-ai-setup"><ShieldCheck size={20}/><strong>One more step to activate FETS AI.</strong><p>{!status.databaseReady?'The assistant database setup is pending.':'The server-side Gemini key is pending.'} Your existing workspace is still available.</p></div>}
      {mode==='ask'&&<><div className="fets-ai-feed" aria-live="polite">
        {!messages.length&&<div className="fets-ai-welcome"><div className="fets-ai-glow"><Sparkles size={31}/></div><h3>What can I help move forward?</h3><p>I can look up fresh roster, calendar, duty and case information for your centre. I’ll tell you when a source isn’t connected yet.</p><div className="fets-ai-starters">{starter.map(x=><button key={x} disabled={!ready} onClick={()=>send(x)}>{x}<ArrowRight size={14}/></button>)}</div></div>}
        {messages.map(m=><article className={`fets-ai-message fets-ai-message-${m.role}`} key={m.id}><small>{m.role==='assistant'?'FETS AI':'You'}{m.live?' · Live':''}</small><p>{m.text}</p>{m.evidence?.length? <div className="fets-ai-evidence">{m.evidence.map((ev,i)=><button key={`${ev.source}-${i}`} onClick={()=>ev.page&&jump(ev.page)} title={`${ev.count??0} records · fetched ${new Date(ev.fetchedAt).toLocaleTimeString()}${ev.truncated?' · partial results':''}`}><Check size={12}/>{ev.source}{!ev.available?' unavailable':ev.truncated?' · partial':''}</button>)}</div>:null}{m.proposals?.map((proposal,i)=>proposal.type==='handover-draft'?<div className="fets-ai-proposal" key={i}><strong>Handover draft · {proposal.day}</strong><p>{proposal.summary}</p><small>For review only. Nothing has been submitted.</small><button onClick={()=>reviewDraft(proposal)}>Review in Handover <ArrowRight size={14}/></button></div>:proposal.type==='navigation'?<button className="fets-ai-page-link" key={i} onClick={()=>jump(proposal.page)}>Open {proposal.label}<ExternalLink size={13}/></button>:null)}</article>)}
        {busy&&<div className="fets-ai-thinking"><span/><span/><span/> Looking up your workspace…</div>}<div ref={bottom}/>
      </div><form className="fets-ai-compose" onSubmit={e=>{e.preventDefault();send();}}><textarea aria-label="Ask FETS AI" placeholder="Ask about your work…" maxLength={4000} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} disabled={!ready||busy} rows={2}/><button aria-label="Send message" disabled={!ready||busy||!input.trim()}><Send size={18}/></button></form></>}
      {mode==='live'&&<div className="fets-ai-live"><div className="fets-ai-live-globe"><div className="fets-ai-live-core"><Sparkles size={39}/></div></div><h3>Talk it through, together.</h3><p>Start a 9-minute session, then choose what to share. Microphone, camera and screen always need your permission.</p><div className="fets-ai-live-state"><span className={liveState==='connected'||liveState==='listening'||liveState==='speaking'?'active':''}/>{liveState.replace(/-/g,' ')}</div><button className="fets-ai-live-start" disabled={!ready||liveState==='connecting'} onClick={requestLive}>{client.current?.isConnected()?<><CircleStop size={18}/> End session</>:<><Headphones size={18}/> Start live session</>}</button><div className="fets-ai-media-controls"><button aria-pressed={media.mic} disabled={!client.current?.isConnected()} onClick={()=>toggleMedia('mic')}><Mic size={19}/>{media.mic?'Stop mic':'Microphone'}</button><button aria-pressed={media.camera} disabled={!client.current?.isConnected()} onClick={()=>toggleMedia('camera')}><Camera size={19}/>{media.camera?'Stop camera':'Camera'}</button><button aria-pressed={media.screen} disabled={!client.current?.isConnected()} onClick={()=>toggleMedia('screen')}><MonitorUp size={19}/>{media.screen?'Stop screen':'Share screen'}</button></div>{(media.mic||media.camera||media.screen)&&<p className="fets-ai-sharing">Sharing now: {[media.mic&&'microphone',media.camera&&'camera',media.screen&&'screen'].filter(Boolean).join(', ')}.</p>}<button className="fets-ai-transcript-link" onClick={()=>setMode('ask')}>See conversation transcript <ArrowRight size={14}/></button></div>}
      {mode==='knowledge'&&status?.admin&&<div className="fets-ai-knowledge"><h3>Approved knowledge</h3><p>Publish a current SOP or centre guide. Staff can search it by name and content; updates are versioned.</p><form onSubmit={saveDoc}><label>Title<input required minLength={3} maxLength={200} value={docTitle} onChange={e=>setDocTitle(e.target.value)} placeholder="e.g. Morning opening procedure"/></label><label>Scope<select value={docScope} onChange={e=>setDocScope(e.target.value)}><option value="*">All centres</option>{branch!=='global'&&<option value={branch}>{branch} only</option>}</select></label><label>Approved content<textarea required minLength={20} maxLength={30000} rows={5} value={docContent} onChange={e=>setDocContent(e.target.value)} placeholder="Write the approved procedure, owner, and when it applies."/></label><label>Source link · optional<input type="url" pattern="https://.*" value={docUrl} onChange={e=>setDocUrl(e.target.value)} placeholder="https://…"/></label><button className="fets-ai-publish" disabled={busy||!ready}><Plus size={16}/> Publish approved guide</button></form><div className="fets-ai-doc-list">{docs.map(doc=><div key={doc.id}><BookOpen size={15}/><span>{doc.title}<small>{doc.branch==='*'?'All centres':doc.branch} · v{doc.version} · {doc.status}</small></span></div>)}</div></div>}
      <footer className="fets-ai-foot">Fresh records when asked · Centre access respected · Reports need your review</footer>
    </section>}
  </div>, document.body);
}
