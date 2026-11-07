import {toSeatSecond} from './engine';
import {supabase} from '../lib/supabase';
import type {SeatBranch,SeatContext,SeatRule,SeatRuleInput,SeatCapacityInput,SeatCapacityAdjustment} from './types';

export async function fetchSeatContext(branch:SeatBranch,from:string,through:string):Promise<SeatContext>{
  if(!['calicut','cochin'].includes(branch))throw new Error('Choose Calicut or Kochi for seat planning.');
  const response=await supabase.rpc('calendar_seat_planning_context',{p_branch:branch,p_from:from,p_through:through});
  if(response.error)throw new Error(response.error.message||'Seat planning context could not be loaded.');
  const d=response.data;
  if(!d||!Array.isArray(d.rules)||!Array.isArray(d.details)||!Array.isArray(d.adjacent_sessions)||!Array.isArray(d.capacity_adjustments)||typeof d.can_edit_rules!=='boolean')throw new Error('Seat planning returned incomplete data. Refresh before calculating suggestions.');
  return{rules:d.rules,details:d.details,can_edit_rules:d.can_edit_rules,adjacent_sessions:d.adjacent_sessions,capacity_adjustments:d.capacity_adjustments};
}

export async function saveSeatRule(input:SeatRuleInput):Promise<SeatRule>{
  if(!['calicut','cochin'].includes(input.branch_location)||!input.provider?.trim()||
    [input.earlier_minutes,input.later_minutes].some(n=>!Number.isInteger(n)||n<0||n>120)||
    (input.exam_code?.trim()&&input.exam_name?.trim()))throw new Error('Choose one centre/provider and either an exam code or title, with whole-minute limits from 0 to 120.');
  const {data,error}=await supabase.rpc('save_calendar_seat_rule',{
    p_branch:input.branch_location,p_provider:input.provider.trim(),p_exam_code:input.exam_code?.trim()||null,p_exam_name:input.exam_name?.trim()||null,
    p_earlier_minutes:input.earlier_minutes,p_later_minutes:input.later_minutes,p_expected_updated_at:input.expected_updated_at
  });
  if(error)throw new Error(error.message||'The rule was not saved. Refresh and try again.');
  if(!data||typeof data.id!=='string'||typeof data.updated_at!=='string')throw new Error('The rule receipt is incomplete. Refresh before editing again.');
  return data as SeatRule;
}


export async function saveSeatCapacity(input:SeatCapacityInput):Promise<SeatCapacityAdjustment>{
  const start=toSeatSecond(input.date,input.start_time),end=toSeatSecond(input.date,input.end_time),midnight=toSeatSecond(input.date,'24:00');
  if(!['calicut','cochin'].includes(input.branch_location)||!Number.isInteger(input.extra_systems)||input.extra_systems<0||input.extra_systems>100||
    start===null||end===null||midnight===null||start>=midnight||end<=start||(input.note||'').trim().length>500)
    throw new Error('Choose a valid date, 0 to 100 whole additional systems and a same-day availability window.');
  const {data,error}=await supabase.rpc('save_calendar_seat_capacity',{
    p_branch:input.branch_location,p_date:input.date,p_extra_systems:input.extra_systems,p_start_time:input.start_time,p_end_time:input.end_time,
    p_note:(input.note||'').trim(),p_expected_updated_at:input.expected_updated_at
  });
  if(error)throw new Error(error.message||'Extra systems were not confirmed. Refresh and try again.');
  if(!data||data.branch_location!==input.branch_location||data.date!==input.date||typeof data.updated_at!=='string'||!Number.isInteger(data.extra_systems))
    throw new Error('Capacity receipt is incomplete. Refresh before confirming again.');
  return data;
}
