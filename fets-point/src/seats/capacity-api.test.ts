import{beforeEach,describe,it,expect,vi}from'vitest';
import{fetchSeatContext,saveSeatCapacity}from'./api';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../lib/supabase',()=>({supabase:{rpc}}));
beforeEach(()=>rpc.mockReset());
const row={branch_location:'cochin' as const,date:'2099-11-14',extra_systems:4,start_time:'10:30',end_time:'11:00',note:'Four spare workstations',updated_at:'2026-11-07T10:00:00Z'};
describe('daily capacity API boundaries',()=>{
 it('loads confirmed capacity in the same anonymous planning snapshot',async()=>{
  rpc.mockResolvedValue({data:{rules:[],details:[],adjacent_sessions:[],can_edit_rules:true,capacity_adjustments:[row]},error:null});
  const ctx=await fetchSeatContext('cochin','2099-11-01','2099-11-30');
  expect(ctx.capacity_adjustments?.[0].extra_systems).toBe(4);expect(rpc).toHaveBeenCalledWith('calendar_seat_planning_context',{p_branch:'cochin',p_from:'2099-11-01',p_through:'2099-11-30'});
 });
 it('rejects a missing capacity section instead of assuming zero extras',async()=>{
  rpc.mockResolvedValue({data:{rules:[],details:[],adjacent_sessions:[],can_edit_rules:true},error:null});
  await expect(fetchSeatContext('cochin','2099-11-01','2099-11-30')).rejects.toThrow(/incomplete/i);
 });
 it('confirms exact date/window/count with an expected version and no business writes',async()=>{
  rpc.mockResolvedValue({data:row,error:null});expect(await saveSeatCapacity({...row,expected_updated_at:row.updated_at})).toEqual(row);
  expect(rpc).toHaveBeenCalledWith('save_calendar_seat_capacity',{p_branch:'cochin',p_date:'2099-11-14',p_extra_systems:4,p_start_time:'10:30',p_end_time:'11:00',p_note:'Four spare workstations',p_expected_updated_at:row.updated_at});
 });
 it('rejects invalid capacity/time/date/count inputs before network access',async()=>{
  const input={...row,expected_updated_at:null};
  for(const patch of[{extra_systems:1.5},{extra_systems:-1},{extra_systems:101},{date:'2099-02-30'},{start_time:'11:00',end_time:'10:00'},{note:'x'.repeat(501)}])await expect(saveSeatCapacity({...input,...patch})).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
 });
 it('does not claim confirmation after stale or denied writes',async()=>{
  rpc.mockResolvedValue({data:null,error:{message:'Capacity changed; refresh'}});await expect(saveSeatCapacity({...row,expected_updated_at:null})).rejects.toThrow('Capacity changed');
 });
});
