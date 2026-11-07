import {beforeEach,describe,expect,it,vi} from 'vitest';
import {fetchCalendarRange} from './calendar-data';
const from=vi.hoisted(()=>vi.fn());
vi.mock('../lib/supabase',()=>({supabase:{from}}));
function query(respond:(offset:number)=>unknown){let offset=0;const q:any={select:vi.fn(()=>q),gte:vi.fn(()=>q),lte:vi.fn(()=>q),eq:vi.fn(()=>q),or:vi.fn(()=>q),order:vi.fn(()=>q),range:vi.fn((a:number)=>{offset=a;return q;}),then:(resolve:any)=>Promise.resolve(respond(offset)).then(resolve)};return q;}
beforeEach(()=>from.mockReset());
describe('complete Calendar range loading',()=>{
 it('loads more than one API page with stable ID ordering',async()=>{
  const rows=Array.from({length:1002},(_,n)=>({id:n+1,date:'2026-11-14',branch_location:'cochin'}));
  const q=query(offset=>({data:rows.slice(offset,offset+1000),error:null}));from.mockReturnValue(q);
  const r=await fetchCalendarRange('2026-11-01','2026-11-30','cochin');
  expect(r).toHaveLength(1002);expect(r[1001].id).toBe(1002);expect(q.range.mock.calls).toEqual([[0,999],[1000,1999]]);expect(q.order).toHaveBeenCalledWith('id',{ascending:true});expect(q.eq).toHaveBeenCalledWith('branch_location','cochin');
 });
 it('does not return the first page as a safe complete schedule after a later error',async()=>{
  from.mockReturnValue(query(offset=>offset?{data:null,error:{message:'Second page unavailable'}}:{data:Array.from({length:1000},(_,n)=>({id:n+1})),error:null}));
  await expect(fetchCalendarRange('2026-11-01','2026-11-30','cochin')).rejects.toThrow('Second page unavailable');
 });
 it('limits the Calicut legacy fallback to Calicut or unassigned rows',async()=>{
  from.mockReturnValueOnce(query(()=>({data:[],error:null}))).mockReturnValueOnce(query(()=>({data:[{id:1,branch_location:'cochin'},{id:2,branch_location:null},{id:3,branch_location:'calicut'}],error:null})));
  const r=await fetchCalendarRange('2026-11-01','2026-11-30','calicut');
  expect(r.map(x=>x.id)).toEqual([2,3]);
 });
 it('does not hide a permission failure by falling back to an unscoped query',async()=>{
  from.mockReturnValue(query(()=>({data:null,error:{code:'42501',message:'Access denied'}})));
  await expect(fetchCalendarRange('2026-11-01','2026-11-30','calicut')).rejects.toThrow('Access denied');expect(from).toHaveBeenCalledTimes(1);
 });
 it('keeps global loading unfiltered without pretending the centres share seats',async()=>{
  const q=query(()=>({data:[{id:1,branch_location:'calicut'},{id:2,branch_location:'cochin'}],error:null}));from.mockReturnValue(q);
  expect(await fetchCalendarRange('2026-11-01','2026-11-30','global')).toHaveLength(2);expect(q.eq).not.toHaveBeenCalled();
 });
});
