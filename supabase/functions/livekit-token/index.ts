import { AccessToken } from 'npm:livekit-server-sdk@2.15.0';
import { createClient } from 'npm:@supabase/supabase-js@2.55.0';
const cors={'Access-Control-Allow-Origin':'https://fets.live','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type'};
Deno.serve(async req=>{
 const origin=req.headers.get('origin'); const headers={...cors,...(['http://localhost:3000','http://localhost:4173'].includes(origin||'')?{'Access-Control-Allow-Origin':origin!}:{}),'Content-Type':'application/json'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
  const auth=req.headers.get('authorization')||'';
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await db.auth.getUser();if(!user)return reply({error:'Sign in to join a call'},401);
  const {conversationId}=await req.json();if(!/^[0-9a-f-]{36}$/i.test(conversationId||''))return reply({error:'Choose a conversation'},400);
  const {data:member,error}=await db.rpc('is_conversation_member',{p_conversation_id:conversationId,p_user_id:user.id});
  if(error||!member)return reply({error:'Only conversation members can join this call'},403);
  const key=Deno.env.get('LIVEKIT_API_KEY'),secret=Deno.env.get('LIVEKIT_API_SECRET'),url=Deno.env.get('LIVEKIT_URL');
  if(!key||!secret||!url)return reply({error:'Team calling has not been configured'},503);
  const {data:profile}=await db.from('staff_profiles').select('full_name').eq('user_id',user.id).maybeSingle();
  const token=new AccessToken(key,secret,{identity:user.id,name:profile?.full_name||'FETS teammate',ttl:'1h'});
  token.addGrant({roomJoin:true,room:`fets-conversation-${conversationId}`,canPublish:true,canSubscribe:true});
  return reply({token:await token.toJwt(),url});
 }catch{return reply({error:'Could not start the team call. Please try again.'},500);}
});
