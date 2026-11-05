import { checked, conversationMessages, ownConversation, statusFor, uuid, type Environment } from './runtime.ts';
import { runTool, type Scope } from './core.ts';

const admin=(scope:Scope)=>{if(!scope.admin)throw new Error('Only a trusted administrator can change shared AI configuration or publish knowledge.');};
const id=(value:unknown)=>{if(!uuid(value))throw new Error('A valid saved record ID is required.');return value;};
const version=(value:unknown)=>{if(!Number.isInteger(value)||Number(value)<1)throw new Error('The current document version is required. Refresh before editing.');return value;};
export async function knowledgeRows(db:any,scope:Scope){
 let old=db.from('ai_external_knowledge').select('id,title,category,content,branch,is_active,version,source_url,updated_at').order('updated_at',{ascending:false}).limit(201);
 let current=db.from('fets_ai_documents').select('id,title,content,branch,status,version,source_url,updated_at').order('updated_at',{ascending:false}).limit(201);
 if(scope.branch!=='global'){old=old.in('branch',['*',scope.branch]);current=current.in('branch',['*',scope.branch]);}
 const [a,b]=await Promise.all([old,current]);
 const legacy=checked(a,'Legacy reference knowledge could not be loaded')||[],approved=checked(b,'Approved knowledge could not be loaded')||[];
 if(legacy.length>200||approved.length>200)throw new Error('Too many knowledge documents to display. Narrow the centre selection.');
 return [...legacy.map((row:any)=>({...row,status:row.is_active?'published':'archived',source:'legacy'})),...approved.map((row:any)=>({...row,category:'approved',source:'approved'}))].sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
}
export async function managementAction(db:any,scope:Scope,env:Environment,input:any):Promise<any|null>{
 switch(input.action){
 case 'reviews':{
  let q=db.from('fets_ai_reviews').select('id,operation,label,module,path,branch,status,apply_mode,record_id,before_values,proposed_values,summary,expires_at,created_at,decided_at,result');
  if(scope.branch!=='global')q=q.eq('branch',scope.branch);
  return {reviews:(checked(await q.order('created_at',{ascending:false}).limit(80),'Reviews could not be loaded')||[]).map(reviewRow)};
 }
 case 'review':{
  let q=db.from('fets_ai_reviews').select('id,operation,label,module,path,branch,status,apply_mode,record_id,before_values,proposed_values,summary,expires_at,created_at,decided_at,result').eq('id',id(input.reviewId));
  if(scope.branch!=='global')q=q.eq('branch',scope.branch);
  const row=checked(await q.maybeSingle(),'Review could not be loaded');if(!row)throw new Error('This review is unavailable to your account and centre.');
  return {review:reviewRow(row)};
 }
 case 'review-decide':{
  if(!['apply','cancel'].includes(input.decision))throw new Error('Choose Apply or Cancel.');
  const current=await managementAction(db,scope,env,{action:'review',reviewId:input.reviewId});
  const row=checked(await db.rpc('fets_ai_review',{p_id:current.review.id,p_decision:input.decision}),'This review could not be decided');
  return {review:reviewRow(row)};
 }

 case 'settings-update':{
  admin(scope);const changes=input.changes;
  const allowed=['provider','gemini_model','claude_model','kill_switch','autonomous_enabled','max_tool_iterations'];
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).some(k=>!allowed.includes(k)))throw new Error('Unsupported AI setting.');
  if('provider' in changes){if(!['gemini','claude'].includes(changes.provider))throw new Error('Choose Gemini or Claude.');if(!env[changes.provider==='gemini'?'GEMINI_API_KEY':'ANTHROPIC_API_KEY'])throw new Error('That provider has no server credential configured.');}
  for(const k of ['gemini_model','claude_model'])if(k in changes&&(typeof changes[k]!=='string'||! /^[a-zA-Z0-9._:-]{1,120}$/.test(changes[k])))throw new Error('Enter a valid model ID.');
  for(const k of ['kill_switch','autonomous_enabled'])if(k in changes&&typeof changes[k]!=='boolean')throw new Error('Operational write settings must be true or false.');
  if('max_tool_iterations' in changes&&(!Number.isInteger(changes.max_tool_iterations)||changes.max_tool_iterations<1||changes.max_tool_iterations>12))throw new Error('Tool iterations must be between 1 and 12.');
  checked(await db.from('ai_settings').update({...changes,updated_by:scope.userId,updated_at:new Date().toISOString()}).eq('id',1).select('id').single(),'AI settings could not be saved');
  return statusFor(db,scope,env);
 }
 case 'conversations':return {conversations:checked(await db.from('fets_ai_conversations').select('id,title,branch,updated_at').eq('user_id',scope.userId).eq('branch',scope.branch).order('updated_at',{ascending:false}).limit(40),'Conversations could not be loaded')||[]};
 case 'conversation':{const conversation=await ownConversation(db,scope,input.conversationId);return {conversation,messages:await conversationMessages(db,scope,conversation.id,100)};}
 case 'memories':{
  const filter=`scope.eq.global,and(scope.eq.user,scope_ref.eq.${scope.userId})${scope.branch==='global'?'':`,and(scope.eq.branch,scope_ref.eq.${scope.branch})`}`;
  const memories=checked(await db.from('ai_memory').select('id,scope,scope_ref,category,mem_key,mem_value,importance,is_active,updated_at,created_by').or(filter).order('importance',{ascending:false}).order('id').limit(201),'Saved memories could not be loaded')||[];
  if(memories.length>200)throw new Error('Too many saved memories. Ask an administrator to review the scope.');return {memories};
 }
 case 'memory-save':{
  const memory=checked(await db.rpc('fets_ai_save_memory',{p_key:input.key,p_value:input.value,p_scope:input.scope||'user',p_scope_ref:input.scope==='branch'?scope.branch:input.scope==='global'?null:scope.userId,p_id:input.id||null,p_active:input.active??true,p_importance:input.importance??3}),'Memory could not be saved');
  return {memory};
 }
 case 'memory-delete':{
  const memory=checked(await db.from('ai_memory').select('id,mem_key,mem_value,scope,scope_ref,importance').eq('id',id(input.id)).maybeSingle(),'Memory could not be loaded');
  if(!memory)throw new Error('This saved memory is unavailable to your account.');
  checked(await db.rpc('fets_ai_save_memory',{p_key:memory.mem_key,p_value:memory.mem_value,p_scope:memory.scope,p_scope_ref:memory.scope_ref,p_id:memory.id,p_active:false,p_importance:memory.importance}),'Memory could not be disabled');return {ok:true};
 }
 case 'knowledge':return {documents:await knowledgeRows(db,scope)};
 case 'knowledge-save':{
  admin(scope);const document=input.document;
  if(!document||typeof document!=='object')throw new Error('Enter a knowledge document.');
  const source=document.source||'legacy';if(!['legacy','approved'].includes(source))throw new Error('Unknown knowledge source.');
  let source_url=document.source_url||null;
  if(source_url){try{if(new URL(source_url).protocol!=='https:')throw Error();}catch{throw new Error('Source links must use HTTPS.');}}
  if(typeof document.title!=='string'||document.title.trim().length<3||document.title.length>200||typeof document.content!=='string'||document.content.trim().length<20||document.content.length>30000)throw new Error('Use a title of 3–200 characters and approved content of 20–30000 characters.');
  if(!['*','cochin','calicut'].includes(document.branch||'*'))throw new Error('Select a supported knowledge scope.');
  const value:any={title:document.title.trim(),content:document.content.trim(),branch:document.branch||'*',source_url};
  if(source==='legacy')Object.assign(value,{category:String(document.category||'general').slice(0,80),is_active:true,added_by:scope.userId});
  else Object.assign(value,{status:'published',updated_by:scope.userId});
  const table=source==='legacy'?'ai_external_knowledge':'fets_ai_documents';
  let query;
  if(document.id){const savedId=id(document.id),savedVersion=version(document.version);query=db.from(table).update(value).eq('id',savedId).eq('version',savedVersion);}
  else query=db.from(table).insert(value);
  const row=checked(await query.select().single(),'Document could not be saved; it may have changed. Refresh and retry');
  return {document:{...row,source,category:row.category||'approved',status:source==='legacy'?(row.is_active?'published':'archived'):row.status}};
 }
 case 'knowledge-archive':{
  admin(scope);if(!['legacy','approved'].includes(input.source))throw new Error('Unknown knowledge source.');
  const savedId=id(input.id),savedVersion=version(input.version),legacy=input.source==='legacy';
  checked(await db.from(legacy?'ai_external_knowledge':'fets_ai_documents').update(legacy?{is_active:false}:{status:'archived'}).eq('id',savedId).eq('version',savedVersion).select('id').single(),'Document could not be archived; refresh and retry');return {ok:true};
 }
 case 'telemetry':{
  const sevenAgo=new Date(Date.now()-7*86400000).toISOString();
  const count=async(table:string,filter:(q:any)=>any)=>{const r=await filter(db.from(table).select('id',{count:'exact',head:true}));if(r.error)throw new Error('Activity counts could not be loaded. Retry.');return r.count||0;};
  const own=(q:any)=>q.eq('user_id',scope.userId);
  const action=(q:any)=>{q=own(q);return scope.branch==='global'?q:q.eq('branch',scope.branch);};
  const [totalQueries,queries7d,totalActions,writeActions,blockedActions,failedActions,memoryCount,documents]=await Promise.all([
   count('fets_ai_usage',q=>own(q).eq('kind','chat')),count('fets_ai_usage',q=>own(q).eq('kind','chat').gte('created_at',sevenAgo)),
   count('fets_ai_action_log',action),count('fets_ai_action_log',q=>action(q).eq('is_write',true).eq('status','succeeded')),
   count('fets_ai_action_log',q=>action(q).eq('status','blocked')),count('fets_ai_action_log',q=>action(q).eq('status','failed')),
   count('ai_memory',q=>q.eq('is_active',true)),knowledgeRows(db,scope),
  ]);
  const rows=checked(await action(db.from('fets_ai_action_log').select('tool_name,table_affected,status,created_at,record_id')).order('created_at',{ascending:false}).limit(200),'Recent actions could not be loaded')||[];
  const counts:Record<string,number>={};for(const row of rows)counts[row.tool_name]=(counts[row.tool_name]||0)+1;
  return {stats:{totalQueries,queries7d,totalActions,writeActions,blockedActions,failedActions,memoryCount,knowledgeCount:documents.filter((d:any)=>d.status==='published').length,topTools:Object.entries(counts).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,6),recent:rows.slice(0,12).map((row:any)=>({tool:row.tool_name,table:row.table_affected,status:row.status,when:row.created_at,recordId:row.record_id}))}};
 }
 default:return null;
 }
}

export function reviewRow(row:any){if(row?.type==='change-review')return row;return {type:'change-review',id:row.id,operation:row.operation,label:row.label,module:row.module,path:row.path,branch:row.branch,status:row.status,applyMode:row.apply_mode,recordId:row.record_id,before:row.before_values||{},proposed:row.proposed_values||{},summary:row.summary,expiresAt:row.expires_at,createdAt:row.created_at,result:row.result};}
