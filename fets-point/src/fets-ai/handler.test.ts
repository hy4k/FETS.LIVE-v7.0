import { describe, expect, it, vi } from 'vitest';
import { createHandler, requestIntent } from '../../../supabase/functions/fets-ai-agent/handler';
const user='00000000-0000-4000-8000-000000000001';
const request='00000000-0000-4000-8000-000000000002';
function fixture(){
 const records:Record<string,any[]>={
  centre_duty_members:[{user_id:user,profile_id:user,role:'super_admin',branch:'*'}],
  staff_profiles:[{id:user,user_id:user,is_active:true}],
  ai_settings:[{id:1,provider:'gemini',gemini_model:'gemini-3.1-pro-preview',claude_model:'claude-sonnet-4-6',kill_switch:false,autonomous_enabled:true,max_tool_iterations:4,allowed_tools:{super_admin:['*']}}],
  ai_memory:[{id:user,scope:'user',scope_ref:user,is_active:true,mem_key:'timezone',mem_value:'Always show India time'}],fets_ai_conversations:[],fets_ai_messages:[],fets_ai_documents:[],
 };
 const db:any={auth:{getUser:async()=>({data:{user:{id:user,email_confirmed_at:'2026-01-01'}},error:null})},rpc:vi.fn().mockResolvedValue({data:user,error:null}),from:(table:string)=>{
  const filters:any[]=[];let single=false,write:any=null,mode='';let limit=1000;
  let query:any;query=new Proxy({}, {get:(_,key)=>{
   if(key==='then')return (resolve:any)=>{
    const match=(r:any)=>filters.every(([k,v])=>r[k]===v);let rows=records[table]||[];
    if(write){if(mode==='update')rows.filter(match).forEach(r=>Object.assign(r,write));else {const values=Array.isArray(write)?write:[write];for(const value of values){if(mode==='upsert'&&rows.some(r=>r.conversation_id===value.conversation_id&&r.request_id===value.request_id&&r.role===value.role))continue;rows.push({id:crypto.randomUUID(),created_at:new Date().toISOString(),...value});}records[table]=rows;}}
    const found=rows.filter(match).slice(0,limit);resolve({data:single?found[0]||null:found,error:null,count:found.length});
   };
   return (...args:any[])=>{if(key==='eq')filters.push(args);if(key==='single'||key==='maybeSingle')single=true;if(['insert','upsert','update'].includes(String(key))){mode=String(key);write=args[0];}if(key==='limit')limit=args[0];return query;};
  }});return query;
 }};
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({candidates:[{content:{parts:[{text:'India time is active.'}]}}]})));
 const handle=createHandler({GEMINI_API_KEY:'fixture-key'},()=>db,fetcher);
 const send=(body:any)=>handle(new Request('https://fixture/functions/v1/fets-ai-agent',{method:'POST',headers:{Authorization:'Bearer fixture',Origin:'https://fets.live','Content-Type':'application/json'},body:JSON.stringify({branch:'cochin',page:'fets-intelligence',...body})}));
 return {records,db,fetcher,send,handle};
}
describe('connected assistant HTTP request flow',()=>{
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
  expect(db.rpc.mock.calls.some(c=>c[0]==='fets_ai_execute_action')).toBe(false);
 });
});
