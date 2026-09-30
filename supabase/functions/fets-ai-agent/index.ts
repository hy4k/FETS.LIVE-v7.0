import { createClient } from 'npm:@supabase/supabase-js@2.55.0';
import { TOOL_DECLARATIONS, PAGES, SOURCES } from './catalog.ts';
import { scopeFor, runTool, systemPrompt } from './core.ts';
const origins=(Deno.env.get('FETS_AI_ALLOWED_ORIGINS')||'https://fets.live,http://localhost:3000,http://localhost:4173').split(',');
const LIVE_MODEL=Deno.env.get('GEMINI_LIVE_MODEL')||'gemini-3.1-flash-live-preview';
const TEXT_MODEL=Deno.env.get('GEMINI_TEXT_MODEL')||'gemini-3.1-pro-preview';
async function google(path:string,key:string,body:unknown) {
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/${path}`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 if(!response.ok){const failure=await response.json().catch(()=>({}));const detail=String(failure?.error?.message||'').replaceAll(key,'[redacted]').slice(0,350);throw new Error(response.status===429?'Gemini usage limit reached. Check the project quota or try again shortly.':`Gemini request failed (${response.status}): ${detail||'Please try again.'}`);}
 return await response.json();
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('Origin')||'';
 const headers={'Access-Control-Allow-Origin':origins.includes(origin)?origin:origins[0],'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json','Cache-Control':'no-store'};
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.includes(origin))return json({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'POST required'},405);
 try {
  const authorization=req.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))return json({error:'Sign in to use FETS AI.'},401);
  // Never use a service-role client for knowledge retrieval or model tools.
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await db.auth.getUser();if(authError||!auth.user)return json({error:'Your session expired. Sign in again.'},401);
  const raw=await req.text();if(raw.length>60000)return json({error:'Request is too large.'},413);
  const input=JSON.parse(raw);
  const {data:members,error:membershipError}=await db.from('centre_duty_members').select('user_id,branch,role,profile_id').eq('user_id',auth.user.id);
  if(membershipError)return json({error:'Trusted staff access is unavailable. Finish the workspace database setup.'},503);
  let scope;try{scope=scopeFor(auth.user.id,input.branch,members||[]);}catch(e){return json({error:(e as Error).message},403);}
  const page=PAGES.find(p=>p.id===input.page)?.id||'command-center';
  if(input.action==='status'){
   const {error:setup}=await db.from('fets_ai_documents').select('id').limit(1);
   return json({ready:!setup&&Boolean(Deno.env.get('GEMINI_API_KEY')),databaseReady:!setup,modelReady:Boolean(Deno.env.get('GEMINI_API_KEY')),admin:scope.admin,branch:scope.branch,sources:Object.entries(SOURCES).map(([id,s])=>({id,label:s.label,page:s.page})),liveModel:LIVE_MODEL,textModel:TEXT_MODEL});
  }
  if(!['chat','live-token','tool'].includes(input.action))return json({error:'Unknown action'},400);
  const {error:quota}=await db.rpc('fets_ai_reserve_usage',{request_kind:input.action});
  if(quota)return json({error:quota.message.includes('limit')?quota.message:'Assistant database setup is required before starting.'},quota.message.includes('limit')?429:503);
  if(input.action==='tool'){
   try{return json({result:await runTool(db,scope,input.name,input.args||{})});}catch(e){return json({result:{error:(e as Error).message}});}
  }
  const key=Deno.env.get('GEMINI_API_KEY');if(!key)return json({error:'FETS AI needs the server-side Gemini key configured.'},503);
  const system=systemPrompt(scope,page);
  if(input.action==='live-token'){
   const setup={model:`models/${LIVE_MODEL}`,generationConfig:{responseModalities:['AUDIO']},systemInstruction:{parts:[{text:system}]},tools:TOOL_DECLARATIONS,inputAudioTranscription:{},outputAudioTranscription:{}};
   const token=await google('auth_tokens',key,{uses:1,expireTime:new Date(Date.now()+9*60000).toISOString(),newSessionExpireTime:new Date(Date.now()+60000).toISOString(),bidiGenerateContentSetup:setup});
   if(typeof token.name!=='string')throw new Error('Gemini did not issue a live-session token.');
   return json({token:token.name,setup,expiresAt:new Date(Date.now()+9*60000).toISOString()});
  }
  if(typeof input.message!=='string'||!input.message.trim()||input.message.length>4000)return json({error:'Enter a message of 1–4000 characters.'},400);
  const history=Array.isArray(input.history)?input.history.slice(-8).filter((m:any)=>['user','assistant'].includes(m.role)&&typeof m.text==='string').map((m:any)=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.text.slice(0,3000)}]})):[];
  const contents:any[]=[...history,{role:'user',parts:[{text:input.message}]}];const evidence:any[]=[];const proposals:any[]=[];let calls=0;
  for(let step=0;step<4;step++){
   const response=await google(`models/${TEXT_MODEL}:generateContent`,key,{systemInstruction:{parts:[{text:system}]},contents,tools:TOOL_DECLARATIONS,generationConfig:{maxOutputTokens:3072}});
   const content=response.candidates?.[0]?.content;if(!content)return json({error:'Gemini could not answer this request. Try rephrasing.'},502);
   const functions=(content.parts||[]).filter((p:any)=>p.functionCall);
   if(!functions.length)return json({text:(content.parts||[]).filter((p:any)=>p.text&&!p.thought).map((p:any)=>p.text).join('\n')||'I could not produce an answer. Try a more specific question.',evidence,proposals,model:TEXT_MODEL});
   // Preserve thought signatures and every model part unchanged during tool turns.
   contents.push(content);const results=[];
   for(const part of functions){
    if(++calls>12)return json({text:'This request needs more lookups. Please narrow the date range or ask about one centre.',evidence,proposals,model:TEXT_MODEL});
    const fc=part.functionCall;let result:any;
    try{result=await runTool(db,scope,fc.name,fc.args||{});}catch(e){result={error:(e as Error).message};}
    if(result.type)proposals.push(result);
    if(result.source)evidence.push({source:result.source,page:result.page,available:result.available,fetchedAt:result.fetchedAt,truncated:result.truncated,count:result.records?.length,documents:fc.name==='search_knowledge'?(result.records||[]).map((r:any)=>({id:r.id,title:r.title,version:r.version,url:r.source_url,updatedAt:r.updated_at})):undefined});
    if(JSON.stringify(result).length>45000)result={available:false,error:'Result too large. Narrow the query; do not summarise unseen records.'};
    results.push({functionResponse:{name:fc.name,...(fc.id?{id:fc.id}:{}),response:result}});
   }
   contents.push({role:'user',parts:results});
  }
  return json({text:'I gathered some sources but reached the lookup limit. Please ask a narrower question.',evidence,proposals,model:TEXT_MODEL});
 }catch(e){console.error('[fets-ai-agent]',e instanceof Error?e.name:'RequestError');return json({error:e instanceof SyntaxError?'Invalid request.':e instanceof Error?e.message:'FETS AI is temporarily unavailable.'},500);}
});
