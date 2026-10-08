import {describe,it,expect} from 'vitest';
import {contract,workEvidence,workState,overdue} from './shift-work';
import {dayList} from './shift-blueprint';
const day='2026-10-08';
const job:any={id:'r',branch:'cochin',title:'Readiness check',details:'New instructions',expected_result:'New expected result',due_minute:600,priority:'important',owner_id:'a',backup_id:'b',frequency:'daily',active:true};
const task:any={id:'t',day,branch:'cochin',responsibility_id:'r',title:job.title,assigned_to:'a',status:'open',note:'',expected_result:'Agreed result',instructions:'Agreed instructions',due_minute:0,priority:'normal',version:1};
const item=(patch={})=>dayList([job],[{...task,...patch}],day,new Set(['a','b']))[0];
describe('work agreements and management evidence',()=>{
 it('keeps the saved result, instructions, midnight target and priority after a regular duty changes',()=>{expect(contract(item())).toEqual({result:'Agreed result',instructions:'Agreed instructions',due:0,priority:'normal'});});
 it('does not invent a historical agreement for an older saved task',()=>{expect(contract(item({expected_result:'',instructions:'',due_minute:null}))).toMatchObject({result:'',instructions:'',due:null});});
 it('shows a first due job’s current agreement before it has a saved assignment',()=>{expect(contract(dayList([job],[],day,new Set(['a']))[0])).toMatchObject({result:'New expected result',instructions:'New instructions',due:600});});
 it('keeps submitted work out of late-open filters while independent review is pending',()=>{const i=item({status:'done'});expect(workState(i)).toBe('review');expect(overdue(i,day,day,800)).toBe(false);});
 it('reports saved facts with explicit denominators and India-time deadlines',()=>{
  const rows=[{...task,status:'done',done_at:'2026-10-08T04:30:00Z',due_minute:600,verified_by:'b',verified_at:'2026-10-08T05:00:00Z',completion_note:'Checked'},{...task,id:'late',status:'done',done_at:'2026-10-08T05:30:01Z',due_minute:660,completion_note:''},{...task,id:'help',status:'blocked',rework_count:2},{...task,id:'skipped',status:'skipped'},{...task,id:'other',assigned_to:'b',status:'done'}];
  expect(workEvidence(rows as any,'a')).toEqual({assigned:3,verified:1,awaiting:1,support:1,reworks:2,withoutEvidence:1,onTime:1,timedCompleted:2});
 });
});
