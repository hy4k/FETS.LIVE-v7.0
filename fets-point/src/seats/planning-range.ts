import{fetchSeatContext}from'./api';
import{toSeatSecond}from'./engine';
import type{SeatBranch,SeatContext}from'./types';
/** Legacy analysis can span more than the protected context's 62-day window. */
export async function fetchSeatPlanningRange(branch:string,from:string,through:string):Promise<SeatContext>{
 const start=toSeatSecond(from,'00:00'),end=toSeatSecond(through,'00:00');
 if(start===null||end===null||end<start||!['calicut','cochin','global'].includes(branch))throw new Error('Choose a valid Calendar planning range.');
 const branches:SeatBranch[]=branch==='global'?['calicut','cochin']:[branch as SeatBranch];
 const contexts:SeatContext[]=[];
 for(let day=start;day<=end;day+=62*86400){
  const first=new Date(day*1000).toISOString().slice(0,10),last=new Date(Math.min(end,day+61*86400)*1000).toISOString().slice(0,10);
  contexts.push(...await Promise.all(branches.map(b=>fetchSeatContext(b,first,last))));
 }
 return{rules:contexts.flatMap(c=>c.rules),details:contexts.flatMap(c=>c.details),adjacent_sessions:contexts.flatMap(c=>c.adjacent_sessions||[]),capacity_adjustments:contexts.flatMap(c=>c.capacity_adjustments||[]),can_edit_rules:false};
}
