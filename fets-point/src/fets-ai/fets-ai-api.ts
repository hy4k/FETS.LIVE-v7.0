import { supabase } from '../lib/supabase';

export type SourceEvidence = { source:string; page?:string; available:boolean; fetchedAt:string; truncated?:boolean; count?:number; documents?:{id:string;title:string;version:number;url?:string;updatedAt:string}[] };
export type HandoverProposal = {type:'handover-draft';branch:string;day:string;summary:string;followups:string;recognition:string;saved:false;requiresReview:true};
export type AgentReply = {text:string;evidence:SourceEvidence[];proposals:(HandoverProposal|{type:'navigation';page:string;label:string;path:string})[];model:string};
export type AgentStatus = {ready:boolean;databaseReady:boolean;modelReady:boolean;admin:boolean;branch:string;sources:{id:string;label:string;page:string}[];liveModel:string;textModel:string};

export async function agentRequest<T>(body:Record<string,unknown>):Promise<T> {
  const {data,error}=await supabase.functions.invoke('fets-ai-agent',{body});
  if(error){
    const response=error.context as Response|undefined;
    let detail='The assistant could not connect. Please try again.';
    try { const parsed=await response?.json(); if(typeof parsed?.error==='string')detail=parsed.error; } catch { /* network error */ }
    throw new Error(detail);
  }
  if(data?.error)throw new Error(data.error);
  return data as T;
}
