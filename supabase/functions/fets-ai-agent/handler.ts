import { loadScope, hasModule } from './access.ts';
import { PAGES, SOURCES, WRITE_TOOLS } from './catalog.ts';
import { systemPrompt, runTool } from './core.ts';
import { checked, conversationMessages, ensureConversation, loadSettings, ownConversation, permittedTools, pinnedContext, saveMessage, selectedModel, statusFor, uuid, type Environment } from './runtime.ts';
import { managementAction } from './management.ts';
import { generateAnswer, providerRequest, geminiTools } from './providers.ts';
import { conversationIntent } from './intent.ts';
export { requestIntent } from './intent.ts';
export function createHandler(env:Environment,clientFactory:(authorization:string)=>any,fetcher?:typeof fetch){
 const origins=(env.FETS_AI_ALLOWED_ORIGINS||'https://fets.live,http://localhost:3000,http://localhost:4173').split(',').map(s=>s.trim());
 return async(req:Request)=>{
  const origin=req.headers.get('Origin')||'';
  const headers={'Access-Control-Allow-Origin':origins.includes(origin)?origin:origins[0],'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.includes(origin))return json({error:'Origin not allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return json({error:'POST required'},405);
  try{
   const authorization=req.headers.get('Authorization')||'';
   if(!authorization.startsWith('Bearer '))return json({error:'Sign in to use FETS AI.'},401);
   const db=clientFactory(authorization);
   const {data:auth,error:authError}=await db.auth.getUser();
   if(authError||!auth.user)return json({error:'Your session expired. Sign in again.'},401);
   if(!auth.user.email_confirmed_at)return json({error:'Verify your staff email before using FETS AI.'},403);
   const raw=await req.text();if(raw.length>60000)return json({error:'Request is too large.'},413);
   const input=JSON.parse(raw);if(!input||Array.isArray(input)||typeof input!=='object')return json({error:'Invalid request.'},400);
   let scope;try{scope=await loadScope(db,auth.user.id,input.branch);}catch(e){return json({error:(e as Error).message},403);}
   const page=PAGES.find(p=>p.id===input.page)?.id||'command-center';
   if(input.action==='status')return json({...await statusFor(db,scope,env),sources:Object.entries(SOURCES).filter(([,s])=>hasModule(scope,s.page)).map(([id,s])=>({id,label:s.label,page:s.page}))});
   const management=await managementAction(db,scope,env,input);
   if(management!==null)return json(management);
   if(!['chat','tool','live-token'].includes(input.action))return json({error:'Unknown action'},400);
   if(input.action==='chat'&&(typeof input.message!=='string'||!input.message.trim()||input.message.length>4000))return json({error:'Enter a message of 1–4000 characters.'},400);
   if(input.requestId!==undefined&&!uuid(input.requestId))return json({error:'Use a valid request ID.'},400);
   const requestId=input.requestId||crypto.randomUUID();
   const settings=await loadSettings(db,env);
   let writeIndex=0;
   const execute=async(intent:ReturnType<typeof conversationIntent>,name:string,args:Record<string,unknown>)=>{
    const toolRequestId=input.action==='chat'&&WRITE_TOOLS.includes(name)?await actionRequestId(requestId,++writeIndex):requestId;
    let target=scope;
    if(intent.writes&&intent.targetBranch&&!intent.ambiguousCentre){
     try{target=await loadScope(db,scope.userId,intent.targetBranch);}
     catch{return Promise.resolve(WRITE_TOOLS.includes(name)?{type:'action-result',tool:name,status:'blocked',message:`You do not have assistant access to ${intent.targetBranch}. Choose a centre in your trusted membership.`}:{error:'The requested centre is outside your trusted membership.'});}
    }
    const requestText=`${typeof input.message==='string'?input.message:''} ${intent.continuation?intent.directive||'':''}`;
    const explicitSources=privateSourceRequests(requestText);
    return runTool(db,target,name,args,{requestId:toolRequestId,allowWrites:Boolean(input.requestId)&&intent.writes,allowMemory:intent.memory,allowedWriteTools:intent.allowedTools,requiresCentre:intent.ambiguousCentre,allowPrivateContent:explicitSources.some(source=>['journal','slate','messages'].includes(source)),explicitSources});
   };
   if(input.action==='tool'){
    const quota=await db.rpc('fets_ai_reserve_usage',{request_kind:'tool'});if(quota.error)return json({error:quota.error.message},429);
    const intent=conversationIntent(typeof input.message==='string'?input.message:'');
    try{return json({result:await execute(intent,input.name,input.args||{})});}
    catch(e){return json({result:{error:(e as Error).message}});}
   }
   const memory=await pinnedContext(db,scope);
   const tools=permittedTools(settings,scope);
   const policy=`\nCurrent operational writes: ${settings.autonomous_enabled&&!settings.kill_switch?'ON':'OFF'}. Allowed operational tools: ${tools.filter(t=>WRITE_TOOLS.includes(t.name)).map(t=>t.name).join(', ')||'none'}. Selected text provider: ${settings.provider}.\n`;
   if(input.action==='live-token'){
    if(!env.GEMINI_API_KEY)return json({error:'Live voice needs the server-side Gemini credential.'},503);
    const history=input.conversationId?await conversationMessages(db,scope,input.conversationId,16):[];
    const prior=history.length?`\nOWNED CONVERSATION CONTEXT (previous messages, not authorisation for new writes):\n${JSON.stringify(history.map((m:any)=>({role:m.role,text:m.content.slice(0,4000)})))}\n`:'';
    const setup={model:`models/${env.GEMINI_LIVE_MODEL||'gemini-3.1-flash-live-preview'}`,generationConfig:{responseModalities:['AUDIO']},systemInstruction:{parts:[{text:systemPrompt(scope,page,memory.block+policy+prior)}]},tools:[{functionDeclarations:geminiTools(tools)}],inputAudioTranscription:{},outputAudioTranscription:{}};
    const quota=await db.rpc('fets_ai_reserve_usage',{request_kind:'live-token'});if(quota.error)return json({error:quota.error.message},429);
    const token=await providerRequest('https://generativelanguage.googleapis.com/v1beta/auth_tokens',{'x-goog-api-key':env.GEMINI_API_KEY},{uses:1,expireTime:new Date(Date.now()+9*60000).toISOString(),newSessionExpireTime:new Date(Date.now()+60000).toISOString(),bidiGenerateContentSetup:setup},env.GEMINI_API_KEY,fetcher);
    if(typeof token.name!=='string')throw new Error('Gemini did not issue a live-session token.');
    return json({token:token.name,setup,expiresAt:new Date(Date.now()+9*60000).toISOString()});
   }
   const provider=settings.provider,key=provider==='claude'?env.ANTHROPIC_API_KEY:env.GEMINI_API_KEY;
   if(!key)return json({error:`The selected ${provider} provider has no server credential configured.`},503);
   const conversation=await ensureConversation(db,scope,input.conversationId,input.message,requestId);
   const cached=checked(await db.from('fets_ai_messages').select('metadata').eq('conversation_id',conversation.id).eq('user_id',scope.userId).eq('request_id',requestId).eq('role','assistant').maybeSingle(),'Saved reply could not be checked');
   if(cached?.metadata?.reply)return json(cached.metadata.reply);
   const quota=await db.rpc('fets_ai_reserve_usage',{request_kind:'chat'});if(quota.error)return json({error:quota.error.message},429);
   const history=(await conversationMessages(db,scope,conversation.id,24)).filter((m:any)=>m.request_id!==requestId);
   await saveMessage(db,scope,conversation.id,requestId,'user',input.message);
   const intent=conversationIntent(input.message,history);
   const pending=intent.continuation?`\nSERVER-IDENTIFIED UNFINISHED USER REQUEST: ${JSON.stringify({request:intent.directive,tools:intent.allowedTools,centre:intent.targetBranch||scope.branch})}. The current message supplies its missing details. Complete only that request; do not require the user to repeat the create/update command.\n`:'';
   const target=intent.writes&&intent.targetBranch&&!intent.ambiguousCentre?`\nUSER-REQUESTED RECORD CENTRE: ${intent.targetBranch}. Preserve the conversation viewing scope separately.\n`:'';
   const chatTools=tools.filter(tool=>!WRITE_TOOLS.includes(tool.name)||(intent.writes&&intent.allowedTools.includes(tool.name)));
   const answer=await generateAnswer({provider,model:selectedModel(settings),key,system:systemPrompt(scope,page,memory.block+policy+pending+target),history,message:input.message,tools:chatTools,maxIterations:settings.max_tool_iterations,fetcher,execute:(name,args)=>execute(intent,name,args)});
   const reply={...answer,conversationId:conversation.id};
   try{await saveMessage(db,scope,conversation.id,requestId,'assistant',answer.text,{...answer,reply});}
   catch(e){if(!answer.actions.some((a:any)=>a.status==='succeeded')&&!answer.proposals.some((p:any)=>p.type==='change-review'))throw e;reply.text+='\nThe action receipts or prepared reviews could not be saved to conversation history. Keep the record and review IDs shown below.';}
   return json(reply);
  }catch(e){console.error('[fets-ai-agent]',e instanceof Error?e.name:'RequestError');return json({error:e instanceof SyntaxError?'Invalid request JSON.':e instanceof Error?e.message:'FETS AI is temporarily unavailable.'},500);}
 };
}

/** Stable operation slots keep multi-record requests separate and retries bound. */
async function actionRequestId(parent:string,slot:number){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`fets-ai-operation:${parent}:${slot}`))).slice(0,16);bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}

function privateSourceRequests(text:string){const sources:string[]=[];const add=(pattern:RegExp,ids:string[])=>{if(pattern.test(text))sources.push(...ids);};add(/\b(?:journal|diary)\b|ഡയറി|ജേണൽ/i,['journal']);add(/\b(?:notes?|slate)\b|കുറിപ്പ്/i,['slate']);add(/\b(?:chat|conversation|messages?|team)\b|ചാറ്റ്|സന്ദേശ/i,['conversations','conversation_members','messages','chat_work_items','saved_messages']);add(/\b(?:news|announcements?|drafts?)\b/i,['news_drafts','news_sources']);add(/\b(?:profile|staff|account)\b/i,['profile_metadata']);add(/\b(?:vault|access|portal)\b/i,['vault_metadata','quick_access_metadata']);add(/\b(?:delegation|branch access)\b/i,['delegations']);add(/\b(?:preferences?|cover|desk)\b/i,['desk_preferences']);add(/\b(?:focus|timer)\b/i,['desk_focus']);return sources;}
