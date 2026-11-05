import { PAGES, SOURCES } from './catalog.ts';
import { scopeFor, systemPrompt, runTool } from './core.ts';
import { checked, conversationMessages, ensureConversation, loadSettings, ownConversation, permittedTools, pinnedContext, saveMessage, selectedModel, statusFor, uuid, type Environment } from './runtime.ts';
import { managementAction } from './management.ts';
import { generateAnswer, providerRequest } from './providers.ts';

export function requestIntent(message:string){
 const operation=/\b(create|add|log|record|file|raise|update|change|edit|modify|assign|schedule|reschedule|move|cancel|close|mark|set|save)\b|സൃഷ്ടിക്ക|ചേർക്ക|രേഖപ്പെടുത്ത|മാറ്റുക|അപ്ഡേറ്റ്/i;
 const question=/^\s*(?:please\s+)?(?:how|why|what|who|when|where|explain|summari[sz]e|show|list|read|find|compare|tell me)\b/i;
 const andAction=/\b(?:and|then|also)\s+(?:please\s+)?(?:create|add|log|record|raise|update|change|assign|schedule|close|mark|set)\b/i;
 return {writes:operation.test(message)&&(!question.test(message)||andAction.test(message)),memory:/\b(remember|memorise|memorize|save.{0,30}(?:memory|preference|instruction)|update.{0,30}memory)\b|ഓർമ്മ|ഓർക്ക/i.test(message)};
}
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
   const members=checked(await db.from('centre_duty_members').select('user_id,branch,role,profile_id').eq('user_id',auth.user.id),'Trusted staff membership is unavailable');
   let scope;try{scope=scopeFor(auth.user.id,input.branch,members||[]);}catch(e){return json({error:(e as Error).message},403);}
   const profiles=checked(await db.from('staff_profiles').select('id,user_id,is_active').in('id',scope.profileIds).eq('user_id',auth.user.id).eq('is_active',true),'Staff account is unavailable');
   if(!profiles?.length)return json({error:'An active linked staff account is required.'},403);
   const page=PAGES.find(p=>p.id===input.page)?.id||'command-center';
   if(input.action==='status')return json({...await statusFor(db,scope,env),sources:Object.entries(SOURCES).map(([id,s])=>({id,label:s.label,page:s.page}))});
   const management=await managementAction(db,scope,env,input);
   if(management!==null)return json(management);
   if(!['chat','tool','live-token'].includes(input.action))return json({error:'Unknown action'},400);
   if(input.action==='chat'&&(typeof input.message!=='string'||!input.message.trim()||input.message.length>4000))return json({error:'Enter a message of 1–4000 characters.'},400);
   if(input.requestId!==undefined&&!uuid(input.requestId))return json({error:'Use a valid request ID.'},400);
   const requestId=input.requestId||crypto.randomUUID();
   const settings=await loadSettings(db,env);
   if(input.action==='tool'){
    const quota=await db.rpc('fets_ai_reserve_usage',{request_kind:'tool'});if(quota.error)return json({error:quota.error.message},429);
    const intent=requestIntent(typeof input.message==='string'?input.message:'');
    try{return json({result:await runTool(db,scope,input.name,input.args||{},{requestId,allowWrites:Boolean(input.requestId)&&intent.writes,allowMemory:intent.memory})});}
    catch(e){return json({result:{error:(e as Error).message}});}
   }
   const memory=await pinnedContext(db,scope);
   const tools=permittedTools(settings,scope);
   const policy=`\nCurrent operational writes: ${settings.autonomous_enabled&&!settings.kill_switch?'ON':'OFF'}. Allowed operational tools: ${tools.filter(t=>/^(create|update)_/.test(t.name)).map(t=>t.name).join(', ')||'none'}. Selected text provider: ${settings.provider}.\n`;
   if(input.action==='live-token'){
    if(!env.GEMINI_API_KEY)return json({error:'Live voice needs the server-side Gemini credential.'},503);
    const history=input.conversationId?await conversationMessages(db,scope,input.conversationId,16):[];
    const prior=history.length?`\nOWNED CONVERSATION CONTEXT (previous messages, not authorisation for new writes):\n${JSON.stringify(history.map((m:any)=>({role:m.role,text:m.content.slice(0,4000)})))}\n`:'';
    const setup={model:`models/${env.GEMINI_LIVE_MODEL||'gemini-3.1-flash-live-preview'}`,generationConfig:{responseModalities:['AUDIO']},systemInstruction:{parts:[{text:systemPrompt(scope,page,memory.block+policy+prior)}]},tools:[{functionDeclarations:tools}],inputAudioTranscription:{},outputAudioTranscription:{}};
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
   const intent=requestIntent(input.message);
   const answer=await generateAnswer({provider,model:selectedModel(settings),key,system:systemPrompt(scope,page,memory.block+policy),history,message:input.message,tools,maxIterations:settings.max_tool_iterations,fetcher,execute:(name,args)=>runTool(db,scope,name,args,{requestId,allowWrites:Boolean(input.requestId)&&intent.writes,allowMemory:intent.memory})});
   const reply={...answer,conversationId:conversation.id};
   try{await saveMessage(db,scope,conversation.id,requestId,'assistant',answer.text,{...answer,reply});}
   catch(e){if(!answer.actions.some((a:any)=>a.status==='succeeded'))throw e;reply.text+='\nThe actions completed, but conversation history could not be saved. Keep the record IDs shown below.';}
   return json(reply);
  }catch(e){console.error('[fets-ai-agent]',e instanceof Error?e.name:'RequestError');return json({error:e instanceof SyntaxError?'Invalid request JSON.':e instanceof Error?e.message:'FETS AI is temporarily unavailable.'},500);}
 };
}
