import {supabase} from '../lib/supabase';
import type {SeatSession} from './types';

/** A failed page is an incomplete schedule, never a smaller successful result. */
export async function fetchCalendarRange(from:string,through:string,branch:string,filter?:(q:any)=>any):Promise<SeatSession[]>{
  const read=async(legacy:boolean,missingColumn=false)=>{
    const rows:SeatSession[]=[],seen=new Set<number>();
    for(let offset=0;;offset+=1000){
      let q=supabase.from('calendar_sessions').select('*').gte('date',from).lte('date',through)
        .order('date',{ascending:true}).order('start_time',{ascending:true}).order('id',{ascending:true});
      if(legacy){if(!missingColumn)q=q.or('branch_location.is.null,branch_location.eq.calicut');}
      else if(branch&&branch!=='global')q=filter?filter(q):q.eq('branch_location',branch);
      const {data,error}=await q.range(offset,offset+999);
      if(error)throw Object.assign(new Error(error.message||'Calendar could not be loaded.'),{code:error.code});
      if(!Array.isArray(data))throw new Error('Calendar returned an incomplete response. Refresh before checking seats.');
      for(const row of data){
        if(seen.has(row.id))throw new Error('Calendar changed while loading. Refresh before checking seats.');
        seen.add(row.id);rows.push(row);
      }
      if(data.length<1000)return legacy?rows.filter(s=>!s.branch_location||s.branch_location==='calicut'):rows;
    }
  };
  try{const rows=await read(false);return rows.length||branch!=='calicut'?rows:await read(true);}
  catch(error){
    if(branch==='calicut'&&String((error as Error).message).includes('branch_location')&&((error as {code?:string}).code==='42703'||/does not exist/i.test((error as Error).message)))return read(true,true);
    throw error;
  }
}
