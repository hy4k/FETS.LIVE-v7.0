import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
export type WorkspaceCapabilities = { ready:boolean; desk:boolean; duties:boolean; blueprint:boolean; error:string; refresh:()=>void };
/** No writes and no assumed activation: the versioned server probe is authoritative. */
export function useWorkspaceCapabilities(enabled=true):WorkspaceCapabilities {
  const {user}=useAuth();const [retry,setRetry]=useState(0);
  const [state,setState]=useState({owner:'',ready:false,desk:false,duties:false,blueprint:false,error:''});
  useEffect(()=>{let live=true;const id=user?.id||'';
    if(!id||!enabled){setState({owner:'',ready:true,desk:false,duties:false,blueprint:false,error:''});return;}
    setState(old=>old.owner===id?old:{owner:id,ready:false,desk:false,duties:false,blueprint:false,error:''});
    const check=async()=>{
      const {data,error}=await (supabase as any).rpc('fets_workspace_capabilities');
      if(!live)return;
      if(error){setState(old=>({...old,owner:id,ready:true,error:'Shared workspace setup is not available yet.'}));return;}
      const valid=data?.version>=2;
      setState({owner:id,ready:true,desk:valid&&data.desk===true,duties:valid&&data.duties===true,blueprint:valid&&data.version>=3&&data.blueprint===true,error:valid?'':'The workspace database needs its latest setup.'});
    };
    const safeCheck=()=>{check().catch(()=>{if(live)setState(old=>({...old,owner:id,ready:true,error:'Could not check the shared workspace connection.'}));});};
    safeCheck();window.addEventListener('focus',safeCheck);
    return()=>{live=false;window.removeEventListener('focus',safeCheck);};
  },[user?.id,retry,enabled]);
  const own=state.owner===(user?.id||'');
  return {ready:own&&state.ready,desk:own&&state.desk,duties:own&&state.duties,blueprint:own&&state.blueprint,error:own?state.error:'',refresh:()=>setRetry(n=>n+1)};
}
