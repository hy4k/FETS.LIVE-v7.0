import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, BookOpen, Camera, ChevronDown, CircleStop, Headphones, Mic, MonitorUp, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { DataVaultPanel } from '../components/fetsai/DataVaultPanel';
import { useAgentConversation } from './useAgentConversation';
import { AgentResults } from './AgentResults';
import { ConversationControls } from './ConversationControls';
import { GeminiLiveClient, type LiveMessageTurn } from '../lib/geminiLiveClient';
import { agentRequest, type AgentReply, type AgentStatus, type HandoverProposal } from './fets-ai-api';
import { offerHandoverDraft } from './handover-draft';
import './fets-ai-agent.css';

type Media={mic:boolean;camera:boolean;screen:boolean};
const emptyMedia:Media={mic:false,camera:false,screen:false};
const starter=['What needs attention in my centre today?','Who is rostered, and who is lead?','Help draft today’s handover','Find our current procedure'];
const uid=()=>crypto.randomUUID();

export function FetsAIAgent({userId,branch,page,navigate,withMobileNav=false,hideLauncher=false}:{userId:string;branch:string;page:string;navigate:(page:string)=>void;withMobileNav?:boolean;hideLauncher?:boolean}){
  const [open,setOpen]=useState(false),[mode,setMode]=useState<'ask'|'live'|'knowledge'>('ask');
  const [status,setStatus]=useState<(AgentStatus&{scope?:string})|null>(null),[notice,setNotice]=useState('');
  const chat=useAgentConversation(userId,branch,page),busy=chat.busy;
  const {messages}=chat;const [input,setInput]=useState('');
  const [liveState,setLiveState]=useState('disconnected'),[media,setMedia]=useState<Media>(emptyMedia);
  const client=useRef<GeminiLiveClient|null>(null),bottom=useRef<HTMLDivElement|null>(null);
  const scope=`${userId}:${branch}`;const latest=useRef({branch,page,userId,scope});latest.current={branch,page,userId,scope};
  const ready=Boolean(status?.ready&&status.scope===scope);
  const liveReady=Boolean(status?.scope===scope&&(status.liveReady??status.ready));
  const modeReady=mode==='live'?liveReady:ready;
  const composer=useRef<HTMLTextAreaElement|null>(null);
  useEffect(()=>{if(open&&mode==='ask'&&ready)composer.current?.focus();},[open,mode,ready]);

  useEffect(()=>{const handler=(event:Event)=>{const query=(event as CustomEvent<{query?:string}>).detail?.query;if(typeof query==='string'&&query.trim()){setInput(query.trim().slice(0,4000));setMode('ask');}setOpen(true);};window.addEventListener('fets-open-ai',handler);return()=>window.removeEventListener('fets-open-ai',handler);},[]);
  useEffect(()=>{let active=true;setStatus(null);setNotice('');agentRequest<AgentStatus>({action:'status',branch,page}).then(value=>{if(active)setStatus({...value,scope});}).catch(e=>{if(active)setNotice(e.message);});return()=>{active=false;};},[branch,userId]);
  useEffect(()=>{client.current?.disconnect();client.current=null;setLiveState('disconnected');setMedia(emptyMedia);setInput('');setNotice('');return()=>{client.current?.disconnect();client.current=null;};},[branch,userId]);
  useEffect(()=>{client.current?.updatePageContext(page);},[page]);
  useEffect(()=>{if(open)bottom.current?.scrollIntoView?.({behavior:'smooth',block:'end'});},[messages,open,mode]);
  const stopLive=()=>{client.current?.disconnect();client.current=null;setLiveState('disconnected');setMedia(emptyMedia);};
  useEffect(()=>{stopLive();},[chat.conversationId]);
  const send=async(value=input)=>{
    const text=value.trim();if(!text||busy||chat.restoring||!ready)return;
    setInput('');setNotice('');await chat.send(text);
  };
  const requestLive=async()=>{
    if(!liveReady)return;setNotice('');
    if(client.current?.isConnected()){client.current.disconnect();client.current=null;return;}
    const liveBranch=latest.current.branch,liveScope=latest.current.scope;
    const toolRequests=new Map<string,string>();let lastUserTranscript='';
    const active=()=>latest.current.scope===liveScope&&client.current===instance;
    const instance=new GeminiLiveClient({
      getSession:async()=>{if(!active())throw new Error('Account or centre changed.');const result=await agentRequest<{token:string;setup:Record<string,unknown>}>({action:'live-token',branch:liveBranch,page:latest.current.page,conversationId:chat.conversationId});if(!active())throw new Error('Account or centre changed.');return result;},
      executeTool:async(name,args,toolCallId)=>{if(!active())throw new Error('Account, centre or session changed.');let requestId=toolCallId?toolRequests.get(toolCallId):undefined;if(!requestId){requestId=uid();if(toolCallId)toolRequests.set(toolCallId,requestId);}const data=await agentRequest<{result:Record<string,unknown>}>({action:'tool',branch:liveBranch,page:latest.current.page,name,args,requestId,conversationId:chat.conversationId,message:lastUserTranscript});if(!active())throw new Error('Account or centre changed.');const result=data.result;if(result.type==='handover-draft'||result.type==='navigation'||result.type==='action-result')chat.appendLive({id:uid(),role:'assistant',content:typeof result.message==='string'?result.message:result.type==='handover-draft'?'A draft is ready for your review.':result.type==='action-result'?'Operational action result':'Here is a page you can open.',timestamp:new Date(),metadata:result.type==='action-result'?{actions:[result as unknown as NonNullable<AgentReply['actions']>[number]]}:{proposals:[result as AgentReply['proposals'][number]]},live:true});return result;},
      onStatusChange:(state,error)=>{if(active()){setLiveState(state);if(error)setNotice(error);}},
      onMediaChange:(value)=>{if(active())setMedia(value);},
      onTurnUpdate:(turn:LiveMessageTurn)=>{if(active()){if(turn.sender!=='gemini'&&turn.text)lastUserTranscript=turn.text.slice(0,4000);chat.appendLive({id:`live-${turn.id}`,role:turn.sender==='gemini'?'assistant':'user',content:turn.text||'[Voice or video]',timestamp:new Date(),live:true});}},
    });client.current=instance;
    try{await instance.connect();if(!active())instance.disconnect();}catch(e){if(active())setNotice(e instanceof Error?e.message:'Live session unavailable.');}
  };
  const toggleMedia=async(kind:keyof Media)=>{
    const live=client.current;if(!live?.isConnected())return;
    try{setNotice('');if(kind==='mic'){media.mic?live.stopAudioInput():await live.startAudioInput();}else if(kind==='camera'){media.camera?live.stopCameraStream():await live.startCameraStream();}else{media.screen?live.stopScreenStream():await live.startScreenStream();}}
    catch(e){setNotice(e instanceof Error?e.message:'Media permission was not granted.');}
  };
  const reviewDraft=(draft:HandoverProposal)=>{offerHandoverDraft(draft);window.dispatchEvent(new CustomEvent('fets-handover-draft',{detail:{branch:draft.branch,day:draft.day}}));setOpen(false);navigate('handover');};
  const jump=(target:string)=>{setOpen(false);navigate(target);};
  return createPortal(<div className={`fets-ai-root ${withMobileNav?'fets-ai-with-nav':''}`}>
    {!open&&(!hideLauncher||liveState!=='disconnected')&&<button className={`fets-ai-orb ${liveState!=='disconnected'?'fets-ai-orb-live':''}`} aria-label="Open FETS AI assistant" onClick={()=>setOpen(true)}><span className="fets-ai-orb-core"><Sparkles size={25}/></span><span className="fets-ai-orb-label">Ask FETS AI</span>{media.mic||media.camera||media.screen?<span className="fets-ai-recording-dot"/>:null}</button>}
    {open&&<section className="fets-ai-panel" role="dialog" aria-label="FETS AI assistant" aria-modal="false">
      <div className="fets-ai-panel-head"><div className="fets-ai-mark"><Sparkles size={22}/></div><div><small>YOUR WORK COMPANION</small><h2>FETS AI <span>is here.</span></h2></div><button className="fets-ai-icon-button" aria-label="Minimize assistant" onClick={()=>setOpen(false)}><ChevronDown size={21}/></button></div>
      <div className="fets-ai-context"><span className="fets-ai-status-dot" data-ready={modeReady}/>{branch==='global'?'All centres':branch} · {page.replace(/-/g,' ')}<span>{modeReady?'Connected to your workspace':'Setup pending'}</span></div>
      <nav className="fets-ai-tabs" aria-label="Assistant modes"><button aria-current={mode==='ask'} onClick={()=>setMode('ask')}><Sparkles size={15}/> Ask</button><button aria-current={mode==='live'} onClick={()=>setMode('live')}><Headphones size={15}/> Live</button>{status?.admin&&<button aria-current={mode==='knowledge'} onClick={()=>setMode('knowledge')}><BookOpen size={15}/> Knowledge</button>}</nav>
      {(notice||chat.error)&&<div className="fets-ai-notice" role="status">{notice||chat.error}{chat.error&&<button onClick={()=>chat.retry()}>Retry</button>}<button aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={14}/></button></div>}
      {mode==='ask'&&status&&!ready&&<div className="fets-ai-setup"><ShieldCheck size={20}/><strong>One more step to activate FETS AI.</strong><p>{!status.databaseReady?'The assistant database setup is pending.':status.provider==='claude'?'The server-side Claude credential is pending.':'The server-side Gemini key is pending.'} Your existing workspace is still available.</p></div>}
      {mode==='ask'&&<><ConversationControls chat={{...chat,newChat:()=>{stopLive();chat.newChat();},selectConversation:async(id)=>{stopLive();await chat.selectConversation(id);}}}/><div className="fets-ai-feed" aria-live="polite">
        {!messages.length&&<div className="fets-ai-welcome"><div className="fets-ai-glow"><Sparkles size={31}/></div><h3>What can I help move forward?</h3><p>I can look up fresh roster, calendar, duty and case information for your centre. I’ll tell you when a source isn’t connected yet.</p><div className="fets-ai-starters">{starter.map(x=><button key={x} disabled={!ready||chat.restoring||busy} onClick={()=>send(x)}>{x}<ArrowRight size={14}/></button>)}</div></div>}
        {messages.map(m=><article className={`fets-ai-message fets-ai-message-${m.role}`} key={m.id}><small>{m.role==='assistant'?'FETS AI':'You'}{m.live?' · Live':''}</small><p>{m.content}</p>{m.metadata&&<AgentResults reply={m.metadata} navigate={jump} onReview={reviewDraft}/>}</article>)}
        {busy&&<div className="fets-ai-thinking"><span/><span/><span/> Looking up your workspace…</div>}<div ref={bottom}/>
      </div><form className="fets-ai-compose" onSubmit={e=>{e.preventDefault();send();}}><textarea ref={composer} aria-label="Ask FETS AI" placeholder="Ask about your work…" maxLength={4000} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} disabled={!ready||busy||chat.restoring} rows={2}/><button aria-label="Send message" disabled={!ready||busy||chat.restoring||!input.trim()}><Send size={18}/></button></form></>}
      {mode==='live'&&<div className="fets-ai-live"><div className="fets-ai-live-globe"><div className="fets-ai-live-core"><Sparkles size={39}/></div></div><h3>Talk it through, together.</h3>{status&&!liveReady&&<p role="status">{!status.databaseReady?'The assistant database setup is pending.':'The server-side Gemini credential is required for live sessions.'}</p>}<p>Start a 9-minute session, then choose what to share. Microphone, camera and screen always need your permission.</p><div className="fets-ai-live-state"><span className={liveState==='connected'||liveState==='listening'||liveState==='speaking'?'active':''}/>{liveState.replace(/-/g,' ')}</div><button className="fets-ai-live-start" disabled={!liveReady||chat.restoring||busy||liveState==='connecting'} onClick={requestLive}>{client.current?.isConnected()?<><CircleStop size={18}/> End session</>:<><Headphones size={18}/> Start live session</>}</button><div className="fets-ai-media-controls"><button aria-pressed={media.mic} disabled={!client.current?.isConnected()} onClick={()=>toggleMedia('mic')}><Mic size={19}/>{media.mic?'Stop mic':'Microphone'}</button><button aria-pressed={media.camera} disabled={!client.current?.isConnected()} onClick={()=>toggleMedia('camera')}><Camera size={19}/>{media.camera?'Stop camera':'Camera'}</button><button aria-pressed={media.screen} disabled={!client.current?.isConnected()} onClick={()=>toggleMedia('screen')}><MonitorUp size={19}/>{media.screen?'Stop screen':'Share screen'}</button></div>{(media.mic||media.camera||media.screen)&&<p className="fets-ai-sharing">Sharing now: {[media.mic&&'microphone',media.camera&&'camera',media.screen&&'screen'].filter(Boolean).join(', ')}.</p>}<button className="fets-ai-transcript-link" onClick={()=>setMode('ask')}>See conversation transcript <ArrowRight size={14}/></button></div>}
      {mode==='knowledge'&&status?.admin&&<div className="fets-ai-knowledge"><DataVaultPanel key={scope} userId={userId} branch={branch} isAdmin={status.admin}/></div>}
      <footer className="fets-ai-foot">Fresh records when asked · Centre access respected · Reports need your review</footer>
    </section>}
  </div>, document.body);
}
