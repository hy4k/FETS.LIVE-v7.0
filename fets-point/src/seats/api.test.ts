import {beforeEach,describe,expect,it,vi} from 'vitest';
import {fetchSeatContext,saveSeatRule} from './api';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:mocks.rpc}}));
beforeEach(()=>{mocks.rpc.mockReset();});
describe('seat rule/context boundaries',()=>{
 it('loads anonymous context together with complete boundary-date sessions',async()=>{
  mocks.rpc.mockResolvedValue({data:{rules:[],details:[],can_edit_rules:false,capacity_adjustments:[],adjacent_sessions:[{id:7,date:'2026-10-31',branch_location:'cochin'}]},error:null});
  const d=await fetchSeatContext('cochin','2026-10-31','2026-12-01');
  expect(mocks.rpc).toHaveBeenCalledWith('calendar_seat_planning_context',{p_branch:'cochin',p_from:'2026-10-31',p_through:'2026-12-01'});expect(d.adjacent_sessions?.[0].id).toBe(7);expect(d.can_edit_rules).toBe(false);
 });
 it('does not turn failed or incomplete snapshot reads into an empty safe schedule',async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{message:'No centre access'}});await expect(fetchSeatContext('cochin','2026-11-01','2026-11-30')).rejects.toThrow('No centre access');
  mocks.rpc.mockResolvedValue({data:{rules:[],details:[],can_edit_rules:false},error:null});await expect(fetchSeatContext('cochin','2026-11-01','2026-11-30')).rejects.toThrow('incomplete data');
 });
 it('sends an exact rule scope and expected version; it never writes bookings',async()=>{
  const saved={id:'rule',branch_location:'cochin',provider:'PEARSON VUE',exam_code:'AZ-305',exam_name:null,earlier_minutes:0,later_minutes:15,updated_at:'2026-11-06T10:00:00Z'};mocks.rpc.mockResolvedValue({data:saved,error:null});
  expect(await saveSeatRule({...saved,expected_updated_at:'2026-11-06T09:00:00Z'})).toEqual(saved);
  expect(mocks.rpc).toHaveBeenCalledWith('save_calendar_seat_rule',{p_branch:'cochin',p_provider:'PEARSON VUE',p_exam_code:'AZ-305',p_exam_name:null,p_earlier_minutes:0,p_later_minutes:15,p_expected_updated_at:'2026-11-06T09:00:00Z'});
 });
 it('rejects invalid/fractional limits and conflicting exam scopes before a request',async()=>{
  const r={branch_location:'cochin' as const,provider:'PEARSON VUE',exam_code:null,exam_name:null,earlier_minutes:0,later_minutes:15,expected_updated_at:null};
  await expect(saveSeatRule({...r,later_minutes:1.5})).rejects.toThrow();await expect(saveSeatRule({...r,earlier_minutes:-1})).rejects.toThrow();await expect(saveSeatRule({...r,exam_code:'A',exam_name:'Other'})).rejects.toThrow();expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
