import { supabase } from '../lib/supabase';
import type { CandidateRosterRecord, RosterRow } from './types';
export type RosterSession = { id:number; client_name:string|null; exam_name:string|null; start_time:string|null; candidate_count:number|null };
export async function loadRosterContext(day:string,branch:string) {
  const candidates:CandidateRosterRecord[]=[];
  for(let from=0;;from+=1000){
    const {data,error}=await supabase.from('candidates').select('id,full_name,phone,roster_number,client_name,exam_name,exam_start_time')
      .eq('branch_location',branch).gte('exam_date',`${day}T00:00:00+05:30`).lte('exam_date',`${day}T23:59:59.999+05:30`).order('id').range(from,from+999);
    if(error)throw error;candidates.push(...(data||[]));if(!data||data.length<1000)break;
  }
  const {data,error}=await supabase.from('calendar_sessions').select('id,client_name,exam_name,start_time,candidate_count').eq('date',day).eq('branch_location',branch);
  if(error)throw error;return {candidates,sessions:(data||[]) as RosterSession[]};
}
export async function saveRoster(day:string,branch:string,provider:string,source:'upload'|'manual',rows:RosterRow[]) {
  const {data,error}=await supabase.rpc('save_calendar_roster',{p_date:day,p_branch:branch,p_provider:provider,p_source:source,p_rows:rows.map(({full_name,phone,roster_number,exam_name,exam_part,exam_start_time})=>({full_name,phone,roster_number,exam_name,exam_part,exam_start_time}))});
  if(error)throw error;return data as {saved:number;inserted:number;updated:number;calendar_synced:boolean};
}
export function rosterMatch(row:RosterRow,candidates:CandidateRosterRecord[],provider:string){
  return candidates.find(c=>c.client_name?.toUpperCase()===provider&&c.roster_number===row.roster_number);
}
export function possibleLegacyMatch(row:RosterRow,candidates:CandidateRosterRecord[],provider:string){
  return candidates.some(c=>!c.roster_number&&c.client_name?.toUpperCase()===provider&&c.full_name.trim().toLowerCase()===row.full_name.trim().toLowerCase());
}
export function projectedGroups(rows:RosterRow[],candidates:CandidateRosterRecord[],sessions:RosterSession[],provider:string){
  const next=candidates.filter(c=>c.client_name?.toUpperCase()===provider).map(c=>({...c}));
  for(const row of rows){const i=next.findIndex(c=>c.roster_number===row.roster_number);const value={...row,id:i<0?row.roster_number:next[i].id,client_name:provider};if(i<0)next.push(value);else next[i]=value;}
  const key=(exam:string|null,time:string|null)=>JSON.stringify([exam,time]);
  const groups=new Map<string,{exam:string|null;time:string|null;before:number;after:number;sessionCount:number}>();
  for(const c of [...candidates.filter(c=>c.client_name?.toUpperCase()===provider),...next]){const k=key(c.exam_name,c.exam_start_time);if(!groups.has(k)){const matching=sessions.filter(s=>s.client_name?.toUpperCase()===provider&&s.exam_name===c.exam_name&&s.start_time===c.exam_start_time);groups.set(k,{exam:c.exam_name,time:c.exam_start_time,before:matching.reduce((n,s)=>n+(s.candidate_count||0),0),after:0,sessionCount:matching.length});}}
  for(const c of next)groups.get(key(c.exam_name,c.exam_start_time))!.after++;
  return [...groups.values()].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
}

export function expectedProvider(exam: string): string | null {
  if (/\b(Claude|Anthropic)\b/i.test(exam)) return 'PEARSON VUE';
  if (/\bCMA\s*US\b/i.test(exam) || exam.toUpperCase() === 'INSTITUTE OF CERTIFIED MANAGEMENT ACCOUNTANTS') return 'PROMETRIC';
  return null;
}
