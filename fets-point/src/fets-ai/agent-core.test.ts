import { describe, expect, it } from 'vitest';
import { dateRange, runTool, scopeFor } from '../../../supabase/functions/fets-ai-agent/core';

const user='00000000-0000-4000-8000-000000000001';
const member={user_id:user,branch:'cochin',profile_id:user,role:'staff'};
describe('assistant access scope',()=>{
  it('rejects untrusted centre switches and validates short dates',()=>{
    expect(scopeFor(user,'cochin',[member]).branch).toBe('cochin');
    expect(()=>scopeFor(user,'calicut',[member])).toThrow(/access/);
    expect(()=>scopeFor(user,'global',[member])).toThrow(/access/);
    expect(()=>dateRange('2026-02-30')).toThrow(/valid/);
    expect(()=>dateRange('2026-01-01','2026-02-01')).toThrow(/31 days/);
  });
  it('always scopes fresh reads and caps records at 40',async()=>{
    const calls:unknown[][]=[];
    const query:any={select:(...args:unknown[])=>{calls.push(['select',...args]);return query;},eq:(...args:unknown[])=>{calls.push(['eq',...args]);return query;},ilike:(...args:unknown[])=>{calls.push(['ilike',...args]);return query;},gte:(...args:unknown[])=>{calls.push(['gte',...args]);return query;},lte:(...args:unknown[])=>{calls.push(['lte',...args]);return query;},order:(...args:unknown[])=>{calls.push(['order',...args]);return query;},range:async(...args:unknown[])=>{calls.push(['range',...args]);return {data:Array.from({length:41},(_,id)=>({id})),error:null};}};
    const db={from:(table:string)=>{calls.push(['from',table]);return query;}};
    const result:any=await runTool(db,scopeFor(user,'cochin',[member]),'read_workspace',{source:'calendar',from:'2026-09-29'});
    expect(calls).toContainEqual(['ilike','branch_location','%cochin%']);
    expect(calls).toContainEqual(['range',0,40]);
    expect(result.records).toHaveLength(40);
    expect(result.truncated).toBe(true);
    expect(result.nextOffset).toBe(40);
  });
  it('returns only reviewable proposals, with no write',async()=>{
    const db={from:()=>{throw new Error('A draft must never write to the database.');}};
    const draft:any=await runTool(db,scopeFor(user,'cochin',[member]),'propose_handover',{day:'2026-09-29',summary:'Exam flow was steady.',followups:'Lead to inspect missing DVR checks.'});
    expect(draft).toMatchObject({type:'handover-draft',branch:'cochin',saved:false,requiresReview:true});
  });
});
