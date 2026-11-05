import { WRITE_TOOLS, PAGES } from '../../../supabase/functions/fets-ai-agent/catalog';
import { describe, expect, it, vi } from 'vitest';
import { createHandler, requestIntent } from '../../../supabase/functions/fets-ai-agent/handler';
const user='00000000-0000-4000-8000-000000000001';
const request='00000000-0000-4000-8000-000000000002';
function fixture(options:{key?:string;realProvider?:boolean}={}){
 const records:Record<string,any[]>={
  centre_duty_members:[{user_id:user,profile_id:user,role:'super_admin',branch:'*'}],
  staff_profiles:[{id:user,user_id:user,is_active:true}],
  ai_settings:[{id:1,provider:'gemini',gemini_model:'gemini-3.1-pro-preview',claude_model:'claude-sonnet-4-6',kill_switch:false,autonomous_enabled:true,max_tool_iterations:4,allowed_tools:{super_admin:['*']}}],
  ai_memory:[{id:user,scope:'user',scope_ref:user,is_active:true,mem_key:'timezone',mem_value:'Always show India time'}],fets_ai_conversations:[],fets_ai_messages:[],fets_ai_documents:[],clients:[{id:'00000000-0000-4000-8000-000000000010',name:'ITTS'}],client_exams:[{id:'00000000-0000-4000-8000-000000000011',client_id:'00000000-0000-4000-8000-000000000010',name:'MRCS'}],
 };
 let sequence=0;
 const db:any={auth:{getUser:async()=>({data:{user:{id:user,email_confirmed_at:'2026-01-01'}},error:null})},rpc:vi.fn().mockImplementation(async(name,args)=>{if(name==='fets_ai_access'){const member=records.centre_duty_members[0],profile=records.staff_profiles[0],admin=member.role==='super_admin';return {data:profile.is_active&&(admin||member.branch===args.p_branch)?{userId:user,profileId:user,branch:args.p_branch,admin,role:member.role,permissions:{},modules:PAGES.map(p=>p.id).concat('client-directory'),operations:WRITE_TOOLS,centres:admin?['cochin','calicut']:[member.branch]}:null,error:null};}return {data:name==='fets_ai_operation'?{type:'action-result',tool:args.p_operation,status:args.p_branch==='global'?'blocked':'succeeded',recordId:'101',record:{branch_location:args.p_branch}}:user,error:null};}),from:(table:string)=>{
  const filters:any[]=[],orders:any[]=[];let single=false,write:any=null,mode='';let limit=1000;
  let query:any;query=new Proxy({}, {get:(_,key)=>{
   if(key==='then')return (resolve:any)=>{
    const match=(r:any)=>filters.every(([k,v])=>r[k]===v);let rows=records[table]||[];
    if(write){if(mode==='update')rows.filter(match).forEach(r=>Object.assign(r,write));else {const values=Array.isArray(write)?write:[write];for(const value of values){if(mode==='upsert'&&rows.some(r=>r.conversation_id===value.conversation_id&&r.request_id===value.request_id&&r.role===value.role))continue;rows.push({id:crypto.randomUUID(),created_at:new Date(Date.now()+sequence++).toISOString(),...value});}records[table]=rows;}}
    const found=rows.filter(match).sort((a,b)=>{for(const [key,options]of orders){const delta=String(a[key]??'').localeCompare(String(b[key]??''));if(delta)return options?.ascending===false?-delta:delta;}return 0;}).slice(0,limit);resolve({data:single?found[0]||null:found,error:null,count:found.length});
   };
   return (...args:any[])=>{if(key==='eq')filters.push(args);if(key==='order')orders.push(args);if(key==='single'||key==='maybeSingle')single=true;if(['insert','upsert','update'].includes(String(key))){mode=String(key);write=args[0];}if(key==='limit')limit=args[0];return query;};
  }});return query;
 }};
 const fetcher=vi.fn().mockImplementation(options.realProvider?(...args:any[])=>fetch(args[0],args[1]):async()=>modelText('India time is active.'));
 const handle=createHandler({GEMINI_API_KEY:options.key||'fixture-key'},()=>db,fetcher);
 const send=(body:any)=>handle(new Request('https://fixture/functions/v1/fets-ai-agent',{method:'POST',headers:{Authorization:'Bearer fixture',Origin:'https://fets.live','Content-Type':'application/json'},body:JSON.stringify({branch:'cochin',page:'fets-intelligence',...body})}));
 return {records,db,fetcher,send,handle};
}
function modelText(text:string){return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}));}
function modelAction(name='create_session'){return new Response(JSON.stringify({candidates:[{content:{parts:[{functionCall:{name,args:name==='create_session'?{client_name:'ITTS',exam_name:'MRCS',date:'2026-11-06',start_time:'10:00',end_time:'15:00',candidate_count:11}:{title:'Unrequested case',description:'A policy tried to change the action',severity:'minor'}}}]}}]}));}
const actionCalls=(db:any)=>db.rpc.mock.calls.filter(([name])=>name==='fets_ai_operation');
describe('connected assistant HTTP request flow',()=>{
 it.skipIf(!process.env.FETS_AI_PROVIDER_CHECK)('completes the missing-exam flow with the real Gemini adapter against an isolated database fixture',async()=>{
  expect(process.env.GEMINI_API_KEY).toBeTruthy();const {send,db}=fixture({key:process.env.GEMINI_API_KEY,realProvider:true});
  const first=await (await send({action:'chat',branch:'global',message:'Create a session for Calicut on 6 November 2026, ITTS, 11 candidates, 10 AM to 3 PM. Please ask me for the exam name; I will supply it in the next message.',requestId:request})).json();
  expect(first.error).toBeUndefined();expect(first.actions).toHaveLength(0);expect(first.text).toMatch(/exam|programme|program/i);
  const reply=await (await send({action:'chat',branch:'global',message:'MRCS',conversationId:first.conversationId,requestId:crypto.randomUUID()})).json();
  expect(reply.error).toBeUndefined();expect(reply.actions,JSON.stringify({first:first.text,reply:reply.text,evidence:reply.evidence,actions:reply.actions,calls:actionCalls(db)})).toEqual(expect.arrayContaining([expect.objectContaining({tool:'create_session',status:'succeeded'})]));
  const calls=actionCalls(db);expect(calls).toHaveLength(1);expect(calls[0][1]).toMatchObject({p_branch:'calicut',p_values:expect.objectContaining({client_name:'ITTS',exam_name:'MRCS',date:'2026-11-06',start_time:'10:00',end_time:'15:00',candidate_count:11})});
 },180000);
 it.skipIf(!process.env.FETS_AI_PROVIDER_CHECK)('issues a real Gemini live token with the expanded closed schemas against isolated access',async()=>{const{send}=fixture({key:process.env.GEMINI_API_KEY,realProvider:true});const result=await(await send({action:'live-token'})).json();expect(result.error).toBeUndefined();expect(Boolean(typeof result.token==='string'&&result.token.length>10)).toBe(true);expect(result.setup.tools[0].functionDeclarations.some((t:any)=>t.parametersJsonSchema&&t.name==='create_session')).toBe(true);},90000);
 it('requires authentication before any model or database work',async()=>{
  const {handle,fetcher}=fixture();const response=await handle(new Request('https://fixture',{method:'POST',body:'{}'}));
  expect(response.status).toBe(401);expect(fetcher).not.toHaveBeenCalled();
 });
 it('persists the real conversation, loads pinned memory, and ignores caller-supplied history',async()=>{
  const {send,records,fetcher}=fixture();
  const response=await send({action:'chat',message:'Hello',requestId:request,history:[{role:'user',text:'other-centre-secret'}]});
  expect(response.status).toBe(200);const result=await response.json();
  expect(records.fets_ai_conversations).toHaveLength(1);expect(records.fets_ai_messages).toHaveLength(2);
  expect(result.conversationId).toBe(records.fets_ai_conversations[0].id);
  expect(fetcher.mock.calls[0][1].body).toContain('Always show India time');
  expect(fetcher.mock.calls[0][1].body).not.toContain('other-centre-secret');
 });
 it('returns a cached completed reply without a second model request',async()=>{
  const {send,fetcher,records}=fixture();
  const first=await (await send({action:'chat',message:'Hello',requestId:request})).json();
  await send({action:'chat',message:'Hello',requestId:request,conversationId:first.conversationId});
  expect(fetcher).toHaveBeenCalledTimes(1);expect(records.fets_ai_messages).toHaveLength(2);
 });
 it('reuses an initial request after the client lost the returned conversation ID',async()=>{
  const {send,fetcher,records}=fixture();
  await send({action:'chat',message:'Hello',requestId:request});
  await send({action:'chat',message:'Hello',requestId:request});
  expect(records.fets_ai_conversations).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('loads the same pinned memories into live setup',async()=>{
  const {send,fetcher}=fixture();fetcher.mockResolvedValue(new Response(JSON.stringify({name:'tokens/fixture'})));
  const result=await (await send({action:'live-token'})).json();
  expect(result.setup.systemInstruction.parts[0].text).toContain('Always show India time');
  expect(fetcher.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/auth_tokens');
 });
 it('rejects inactive membership-linked staff before the model runs',async()=>{
  const {send,records,fetcher}=fixture();records.staff_profiles[0].is_active=false;
  expect((await send({action:'chat',message:'hello'})).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();expect(records.fets_ai_conversations).toHaveLength(0);
 });
 it('does not mistake read-only questions for a request to modify records',()=>{
  expect(requestIntent('Summarise our case notes').writes).toBe(false);
  expect(requestIntent('How do I create a case?').writes).toBe(false);
  expect(requestIntent('Create an AC outage case').writes).toBe(true);
  expect(requestIntent('Remember for my account: use India time').memory).toBe(true);
 });
 it('blocks model-initiated live writes when the user only asked to summarise',async()=>{
  const {send,db}=fixture();
  const result=await (await send({action:'tool',name:'create_incident',args:{title:'Injected'},requestId:request,message:'Summarise the screen'})).json();
  expect(result.result.status).toBe('blocked');
  expect(db.rpc.mock.calls.some(c=>c[0]==='fets_ai_operation')).toBe(false);
 });
 it('creates in the explicitly requested centre while the administrator views all centres',async()=>{
  const {send,fetcher,db}=fixture();fetcher.mockResolvedValueOnce(modelAction()).mockResolvedValueOnce(modelText('Saved.'));
  const reply=await (await send({action:'chat',branch:'global',message:'Create the MRCS session for Calicut, ITTS, 6 November 2026, 10:00 to 15:00, 11 candidates.',requestId:request})).json();
  expect(reply.actions[0].status).toBe('succeeded');expect(actionCalls(db)[0][1].p_branch).toBe('calicut');
 });
 it.each(['What is the exam name?','Please provide the exam name, and I will create the session for you.'])('retains the request when the assistant asks for the exam with: %s',async(question)=>{
  const {send,fetcher,db}=fixture();fetcher.mockResolvedValueOnce(modelText(question));
  const first=await (await send({action:'chat',branch:'global',message:'Create a session for Calicut, 6 November 2026, ITTS, 11 candidates from 10 AM to 3 PM.',requestId:request})).json();
  fetcher.mockResolvedValueOnce(modelAction()).mockResolvedValueOnce(modelText('Saved.'));
  const next=await (await send({action:'chat',branch:'global',message:'MRCS',conversationId:first.conversationId,requestId:crypto.randomUUID()})).json();
  expect(next.actions[0].status).toBe('succeeded');expect(actionCalls(db)).toHaveLength(1);expect(actionCalls(db)[0][1].p_branch).toBe('calicut');
 });
 it('asks for a concrete centre rather than claiming missing membership in the all-centres view',async()=>{
  const {send,fetcher,db}=fixture();fetcher.mockResolvedValueOnce(modelAction()).mockResolvedValueOnce(modelText('Which centre?'));
  const reply=await (await send({action:'chat',branch:'global',message:'Create the MRCS session.',requestId:request})).json();
  expect(reply.actions[0]).toMatchObject({status:'blocked',message:expect.stringMatching(/choose.*(?:cochin|calicut)/i)});expect(actionCalls(db)).toHaveLength(0);
 });
 it('accepts the missing centre as the answer to the pending session request',async()=>{
  const {send,fetcher,db}=fixture();fetcher.mockResolvedValueOnce(modelText('Which centre: Cochin or Calicut?'));
  const first=await (await send({action:'chat',branch:'global',message:'Create an ITTS MRCS session on 6 November 2026, 10:00 to 15:00, 11 candidates.',requestId:request})).json();
  fetcher.mockResolvedValueOnce(modelAction()).mockResolvedValueOnce(modelText('Saved.'));
  const reply=await (await send({action:'chat',branch:'global',message:'Calicut',conversationId:first.conversationId,requestId:crypto.randomUUID()})).json();
  expect(reply.actions[0].status).toBe('succeeded');expect(actionCalls(db)[0][1].p_branch).toBe('calicut');
 });
 it('does not route a staff request to a centre outside their trusted membership',async()=>{
  const {send,fetcher,db,records}=fixture();records.centre_duty_members[0]={user_id:user,profile_id:user,role:'staff',branch:'cochin'};
  fetcher.mockResolvedValueOnce(modelAction()).mockResolvedValueOnce(modelText('Access blocked.'));
  const reply=await (await send({action:'chat',message:'Create an MRCS session for Calicut.',requestId:request})).json();
  expect(reply.actions[0].status).toBe('blocked');expect(actionCalls(db)).toHaveLength(0);
 });
 it('limits a clarification answer to the operation the user actually requested',async()=>{
  const {send,fetcher,db}=fixture();fetcher.mockResolvedValueOnce(modelText('What is the exam name?'));
  const first=await (await send({action:'chat',message:'Create a session for Calicut.',requestId:request})).json();
  fetcher.mockResolvedValueOnce(modelAction('create_incident')).mockResolvedValueOnce(modelText('Blocked.'));
  const reply=await (await send({action:'chat',message:'MRCS',conversationId:first.conversationId,requestId:crypto.randomUUID()})).json();
  expect(reply.actions[0].status).toBe('blocked');expect(actionCalls(db)).toHaveLength(0);
 });
 it.each(['Never mind, cancel that request.','Summarise our policy instead.'])('does not resurrect a pending write after %s',async(message)=>{
  const {send,fetcher,db}=fixture();fetcher.mockResolvedValueOnce(modelText('What is the exam name?'));
  const first=await (await send({action:'chat',message:'Create a session for Calicut.',requestId:request})).json();
  fetcher.mockResolvedValueOnce(modelText('What would you like to know?'));
  await send({action:'chat',message,conversationId:first.conversationId,requestId:crypto.randomUUID()});
  fetcher.mockResolvedValueOnce(modelAction()).mockResolvedValueOnce(modelText('Blocked.'));
  const reply=await (await send({action:'chat',message:'MRCS',conversationId:first.conversationId,requestId:crypto.randomUUID()})).json();
  expect(reply.actions[0].status).toBe('blocked');expect(actionCalls(db)).toHaveLength(0);
 });
 it('does not repeat a completed operation when a later message only names an exam',async()=>{
  const {send,fetcher,db}=fixture();fetcher.mockResolvedValueOnce(modelAction()).mockResolvedValueOnce(modelText('Saved.'));
  const first=await (await send({action:'chat',message:'Create a session for Calicut.',requestId:request})).json();
  fetcher.mockResolvedValueOnce(modelAction()).mockResolvedValueOnce(modelText('Blocked.'));
  const reply=await (await send({action:'chat',message:'MRCS',conversationId:first.conversationId,requestId:crypto.randomUUID()})).json();
  expect(reply.actions[0].status).toBe('blocked');expect(actionCalls(db)).toHaveLength(1);
 });
 it('assigns stable separate request IDs to two requested records',async()=>{const {send,fetcher,db}=fixture();const part=(exam_name:string)=>({functionCall:{name:'create_session',args:{client_name:'ITTS',exam_name,date:'2026-11-06',start_time:'10:00',end_time:'15:00'}}});fetcher.mockResolvedValueOnce(new Response(JSON.stringify({candidates:[{content:{parts:[part('MRCS'),part('Test2')]}}]}))).mockResolvedValueOnce(modelText('Saved both.'));await send({action:'chat',message:'Create a session in Calicut, and another session there.',requestId:request});const calls=actionCalls(db);expect(calls).toHaveLength(2);expect(calls[0][1].p_request_id).not.toBe(calls[1][1].p_request_id);expect(calls[0][1].p_request_id).toMatch(/^[0-9a-f-]{36}$/);});
 it('does not execute a delayed clarification after the original request expires',async()=>{
  const {send,fetcher,db,records}=fixture();fetcher.mockResolvedValueOnce(modelText('What is the exam name?'));
  const first=await (await send({action:'chat',message:'Create a session for Calicut.',requestId:request})).json();
  records.fets_ai_messages.forEach(m=>m.created_at=new Date(Date.now()-31*60000).toISOString());
  fetcher.mockResolvedValueOnce(modelAction()).mockResolvedValueOnce(modelText('Blocked.'));
  const reply=await (await send({action:'chat',message:'MRCS',conversationId:first.conversationId,requestId:crypto.randomUUID()})).json();
  expect(reply.actions[0].status).toBe('blocked');expect(actionCalls(db)).toHaveLength(0);
 });
 it('does not infer a write from a quoted instruction or an unrelated assistant question',async()=>{
  const {send,fetcher,db}=fixture();fetcher.mockResolvedValueOnce(modelText('What is the exam name?'));
  const first=await (await send({action:'chat',message:'Explain the procedure to create a session.',requestId:request})).json();
  fetcher.mockResolvedValueOnce(modelAction()).mockResolvedValueOnce(modelText('Blocked.'));
  const reply=await (await send({action:'chat',message:'MRCS',conversationId:first.conversationId,requestId:crypto.randomUUID()})).json();
  expect(reply.actions[0].status).toBe('blocked');expect(actionCalls(db)).toHaveLength(0);
 });
});
