/** ISOLATED_BROWSER_FIXTURE_ONLY: never import from a production entry. */
import type { AgentReply, AgentSettings, KnowledgeRow, MemoryRow } from '../fets-ai/fets-ai-api';
export const useAuth=()=>({user:{id:'22222222-2222-4222-8222-222222222222'},profile:{full_name:'Example Administrator',role:'super_admin'}});
export const useBranch=()=>({activeBranch:'calicut'});
export const NewsManager=()=> 'Updated pre-session checklist';
export const GeminiLiveStudio=()=> 'Live media is disabled in this isolated fixture';
const fixtureUser='22222222-2222-4222-8222-222222222222';
const fixtureKey='fets-intelligence-browser-fixture-state-v1';
const now=()=>new Date().toISOString();
const initial=()=>({settings:{provider:'gemini',gemini_model:'fixture-gemini-model',claude_model:'fixture-claude-model',kill_switch:true,autonomous_enabled:false,max_tool_iterations:5} as AgentSettings,memories:[] as MemoryRow[],documents:[{id:'fixture-guide',title:'Fixture approved guide',category:'policy',content:'This approved reference stays available in the isolated fixture.',branch:'calicut',status:'published',version:4,source:'approved',source_url:'https://example.invalid/approved-guide',updated_at:now()},{id:'fixture-legacy',title:'Fixture legacy reference',category:'legacy',content:'Legacy knowledge remains visible.',branch:'*',status:'published',version:1,source:'legacy',source_url:null,updated_at:now()}] as KnowledgeRow[],conversations:[] as any[],messages:{} as Record<string,any[]>,completed:{} as Record<string,AgentReply>});
let state=initial();
try{const saved=sessionStorage.getItem(fixtureKey);if(saved)state=JSON.parse(saved);}catch{}
const persist=()=>sessionStorage.setItem(fixtureKey,JSON.stringify(state));
const status=()=>({ready:true,liveReady:false,databaseReady:true,modelReady:true,admin:true,branch:'calicut',sources:[],provider:state.settings.provider,settings:state.settings,providers:{gemini:true,claude:false},writesEnabled:!state.settings.kill_switch&&state.settings.autonomous_enabled,allowedActions:['create_task'],memoryCount:state.memories.filter(m=>m.is_active).length,textModel:state.settings.gemini_model,liveModel:'fixture-live-disabled'});
(window as any).intelligenceFixture={marker:'ISOLATED_BROWSER_FIXTURE_ONLY',calls:[],readState:()=>structuredClone(state)};
export async function agentRequest<T>(body:Record<string,any>):Promise<T>{
 (window as any).intelligenceFixture.calls.push(structuredClone(body));
 const action=body.action;
 let result:any;
 switch(action){
 case 'status':result=status();break;
 case 'settings-update':Object.assign(state.settings,body.changes);result=status();break;
 case 'memories':result={memories:state.memories};break;
 case 'memory-save':{
  const existing=state.memories.find(m=>m.id===body.id);const memory={...existing,id:existing?.id||crypto.randomUUID(),scope:body.scope,scope_ref:body.scope==='user'?fixtureUser:body.scope==='branch'?body.branch:'*',created_by:fixtureUser,mem_key:body.key,mem_value:body.value,is_active:body.active!==false,importance:body.importance??3,category:'pinned',updated_at:now()};state.memories=state.memories.filter(m=>m.id!==memory.id);state.memories.push(memory);result={memory};break;
 }
 case 'memory-delete':{const m=state.memories.find(m=>m.id===body.id);if(!m)throw Error('Fixture memory not found');m.is_active=false;result={ok:true};break;}
 case 'knowledge':result={documents:state.documents};break;
 case 'knowledge-save':{const d=body.document,existing=state.documents.find(x=>x.id===d.id);if(existing&&d.version!==existing.version)throw Error('Fixture document version conflict');const document={...existing,...d,id:existing?.id||crypto.randomUUID(),source:d.source||'legacy',status:'published',version:existing?existing.version+1:1,updated_at:now()};state.documents=state.documents.filter(x=>x.id!==document.id);state.documents.push(document);result={document};break;}
 case 'knowledge-archive':{const d=state.documents.find(x=>x.id===body.id&&x.source===body.source);if(d)d.status='archived';result={ok:true};break;}
 case 'telemetry':result={stats:{totalQueries:Object.keys(state.completed).length,queries7d:Object.keys(state.completed).length,totalActions:Object.keys(state.completed).length,writeActions:Object.keys(state.completed).length,blockedActions:0,failedActions:0,memoryCount:state.memories.filter(m=>m.is_active).length,knowledgeCount:state.documents.length,topTools:[{name:'create_task',count:Object.keys(state.completed).length}],recent:[]}};break;
 case 'conversations':result={conversations:state.conversations};break;
 case 'conversation':{const conversation=state.conversations.find(c=>c.id===body.conversationId);if(!conversation)throw Error('Fixture conversation not found');result={conversation,messages:state.messages[conversation.id]||[]};break;}
 case 'chat':{
  if(state.completed[body.requestId]){result=state.completed[body.requestId];break;}
  let conversation=state.conversations.find(c=>c.id===body.conversationId);
  if(!conversation){conversation={id:crypto.randomUUID(),title:body.message.slice(0,70),branch:body.branch,updated_at:now()};state.conversations.unshift(conversation);state.messages[conversation.id]=[];}
  result={text:'Fixture task saved with a confirmed receipt.',conversationId:conversation.id,provider:'gemini',model:state.settings.gemini_model,evidence:[{source:'Fixture Current Shift',page:'handover',available:true,fetchedAt:now(),count:1,documents:[{id:'fixture-guide',title:'Fixture approved guide',version:4,url:'https://example.invalid/approved-guide',updatedAt:now()}]}],actions:[{type:'action-result',tool:'create_task',status:'succeeded',recordId:'fixture-task-receipt',path:'/actionables',title:'Fixture task'}],proposals:[{type:'handover-draft',branch:body.branch,day:'2026-10-30',summary:'Review fixture handover.',followups:'',recognition:'',saved:false,requiresReview:true}]} satisfies AgentReply;
  state.messages[conversation.id].push({id:crypto.randomUUID(),role:'user',content:body.message,metadata:{},created_at:now()},{id:crypto.randomUUID(),role:'assistant',content:result.text,metadata:result,created_at:now()});state.completed[body.requestId]=result;break;
 }
 default:throw Error(`Fixture action disabled: ${action}`);
 }
 persist();return structuredClone(result) as T;
}
