import{describe,it,expect,vi,beforeEach}from'vitest';
import{fetchSeatPlanningRange}from'./planning-range';
const read=vi.hoisted(()=>vi.fn());vi.mock('./api',()=>({fetchSeatContext:read}));
beforeEach(()=>read.mockReset());
describe('long Calendar analysis capacity ranges',()=>{
 it('loads a long range in bounded snapshots and keeps both centres distinct',async()=>{
  read.mockImplementation(async(branch:string,from:string,through:string)=>({rules:[],details:[],adjacent_sessions:[],can_edit_rules:true,capacity_adjustments:[{branch_location:branch,date:from,extra_systems:2,start_time:'00:00',end_time:'24:00',note:'',updated_at:'v1'}]}));
  const context=await fetchSeatPlanningRange('global','2099-01-01','2099-04-30');expect(read).toHaveBeenCalledTimes(4);expect(read).toHaveBeenCalledWith('cochin','2099-01-01','2099-03-03');expect(read).toHaveBeenCalledWith('calicut','2099-03-04','2099-04-30');expect(context.capacity_adjustments).toHaveLength(4);
 });
 it('rejects a failed subrange instead of reporting capacity from partial data',async()=>{
  read.mockResolvedValueOnce({rules:[],details:[],adjacent_sessions:[],can_edit_rules:false,capacity_adjustments:[]}).mockRejectedValueOnce(Error('Unavailable'));
  await expect(fetchSeatPlanningRange('cochin','2099-01-01','2099-04-30')).rejects.toThrow('Unavailable');
 });
});
