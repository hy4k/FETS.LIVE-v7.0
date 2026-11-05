import { describe, expect, it, vi } from 'vitest';
import { loadSettings, pinnedContext, ownConversation, permittedTools } from '../../../supabase/functions/fets-ai-agent/runtime';
import { runTool, scopeFor } from '../../../supabase/functions/fets-ai-agent/core';
import { SOURCES, TOOL_DECLARATIONS, WRITE_TOOLS, PAGES } from '../../../supabase/functions/fets-ai-agent/catalog';

const user='00000000-0000-4000-8000-000000000001';
const scope={...scopeFor(user,'cochin',[{user_id:user,branch:'*',role:'super_admin',profile_id:user}]),modules:PAGES.map(p=>p.id),operations:WRITE_TOOLS};
const access={userId:user,profileId:user,branch:'cochin',admin:true,modules:scope.modules,operations:scope.operations,centres:['cochin','calicut']};
const settings={provider:'gemini',gemini_model:'gemini-3.1-pro-preview',claude_model:'claude-sonnet-4-6',kill_switch:false,autonomous_enabled:true,max_tool_iterations:8,allowed_tools:{super_admin:['*'],staff:['read_table','aggregate','search_memory']}};
function database(rows:Record<string,any>,errors:Record<string,string>={}) {
 const calls:any[]=[];
 const db={rpc:async()=>({data:access,error:null}),from:(table:string)=>{
   calls.push(['from',table]);
   let query:any;
   query=new Proxy({}, {get:(_,key)=>key==='then'?(resolve:any)=>resolve({data:(Object.hasOwn(rows,table)?rows[table]:[]),error:errors[table]?{message:errors[table]}:null}):(...args:any[])=>{calls.push([table,key,...args]);return query;}});
   return query;
 }};
 return {db,calls};
}
describe('connected AI controls and persisted context',()=>{
 it('uses the currently working Gemini model instead of the obsolete legacy default',async()=>{
  const {db}=database({ai_settings:{...settings,gemini_model:'gemini-1.5-flash'}});
  expect((await loadSettings(db,{})).gemini_model).toBe('gemini-3.1-pro-preview');
 });
 it('keeps pinned memory for every request and filters identity and selected centre',async()=>{
  const memory={id:'saved',scope:'user',scope_ref:user,mem_key:'time_zone',mem_value:'Always use India time',is_active:true};
  const {db,calls}=database({ai_memory:[memory]});
  const result=await pinnedContext(db,scope);
  expect(result.block).toContain('Always use India time');
  expect(calls).toContainEqual(['ai_memory','eq','is_active',true]);
  expect(calls.find(c=>c[1]==='or')?.[2]).toContain(user);
  expect(calls.find(c=>c[1]==='or')?.[2]).toContain('cochin');
 });
 it('does not silently ignore a failed memory lookup',async()=>{
  const {db}=database({}, {ai_memory:'permission denied'});
  await expect(pinnedContext(db,scope)).rejects.toThrow(/memor/i);
 });
 it('fails rather than silently dropping excess always-on memories',async()=>{
  const {db}=database({ai_memory:Array.from({length:201},(_,i)=>({id:String(i),mem_key:'key',mem_value:'fact',scope:'global'}))});
  await expect(pinnedContext(db,scope)).rejects.toThrow(/memor/i);
 });
 it('validates ownership and branch before loading saved conversation messages',async()=>{
  const {db,calls}=database({fets_ai_conversations:null});
  await expect(ownConversation(db,scope,user)).rejects.toThrow(/conversation/i);
  expect(calls).toContainEqual(['fets_ai_conversations','eq','user_id',user]);
  expect(calls).toContainEqual(['fets_ai_conversations','eq','branch','cochin']);
  expect(calls.some(c=>c[0]==='from'&&c[1]==='fets_ai_messages')).toBe(false);
 });
 it('does not expose write tools when the switch is off or staff has only read aliases',()=>{
  expect(permittedTools({...settings,kill_switch:true},scope).some((t:any)=>t.name==='create_incident')).toBe(false);
  expect(permittedTools(settings,{...scope,admin:false,role:'staff',operations:[]}).some((t:any)=>t.name==='create_incident')).toBe(false);
  expect(permittedTools(settings,scope).some((t:any)=>t.name==='create_incident')).toBe(true);
 });
 it('routes real writes through the atomic database gate with a stable request identity',async()=>{
  const requestId='00000000-0000-4000-8000-000000000002';
  const rpc=vi.fn().mockImplementation(async(name)=>({data:name==='fets_ai_access'?access:{type:'action-result',status:'succeeded',recordId:'real-id'},error:null}));
  await expect(runTool({rpc},scope,'create_incident',{title:'AC',description:'AC failed',severity:'major'},{requestId,allowWrites:true})).resolves.toMatchObject({status:'succeeded',recordId:'real-id'});
  expect(rpc).toHaveBeenCalledWith('fets_ai_operation',{p_operation:'create_incident',p_values:{title:'AC',description:'AC failed',severity:'major'},p_branch:'cochin',p_request_id:requestId});
 });
 it('reads the current Shift plan, actual roster hours, and staff presence',()=>{
  expect(SOURCES.plans.table).toBe('centre_day_plans');
  expect(SOURCES.roster.columns).toContain('shift_start');
  expect(SOURCES.roster.columns).toContain('overtime_hours');
  expect(SOURCES.staff.columns).toContain('is_online');
  expect(TOOL_DECLARATIONS[0].functionDeclarations.map(t=>t.name)).toContain('save_memory');
 });
 it('cites the actual saved version of legacy reference knowledge',async()=>{
  const {db,calls}=database({fets_ai_documents:[],ai_external_knowledge:[{id:'policy',title:'Policy',content:'Verified content',version:4}]});
  const result=await runTool(db,scope,'search_knowledge',{query:'Policy'});
  expect(result.documents[0].version).toBe(4);
  expect(calls.filter(c=>c[0]==='ai_external_knowledge'&&c[1]==='select').every(c=>c[2].includes('version'))).toBe(true);
 });
});
