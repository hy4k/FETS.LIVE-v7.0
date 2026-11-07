import {describe,it,expect,vi,beforeEach} from 'vitest';
import {renderHook,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {analyseDay} from '../seats/engine';
import {useCalendarSessions} from './useCalendarSessions';
const from=vi.hoisted(()=>vi.fn());
vi.mock('../lib/supabase',()=>({supabase:{from}}));
function query(respond:(offset:number)=>any){let offset=0;const q:any={select:()=>q,gte:()=>q,lte:()=>q,order:()=>q,eq:()=>q,or:()=>q,range:(a:number)=>{offset=a;return q;},then:(resolve:any)=>Promise.resolve(respond(offset)).then(resolve)};return q;}
const setup=()=>{const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});return({children}:any)=><QueryClientProvider client={client}>{children}</QueryClientProvider>;};
beforeEach(()=>from.mockReset());
describe('Calendar hook complete data contract',()=>{
 it('returns every page used for concurrent seat calculations without changing provider identity',async()=>{
  const rows=Array.from({length:1001},(_,n)=>({id:n+1,date:'2026-11-14',client_name:'PROMETRIC',exam_name:'CMA US',start_time:'09:00',end_time:'13:30',branch_location:'cochin',candidate_count:1}));
  from.mockReturnValue(query(offset=>({data:rows.slice(offset,offset+1000),error:null})));
  const{result}=renderHook(()=>useCalendarSessions(new Date('2026-11-14T12:00:00'),'cochin',q=>q.eq('branch_location','cochin'),false),{wrapper:setup()});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));expect(result.current.data).toHaveLength(1001);expect(result.current.data![1000].client_name).toBe('PROMETRIC');
 });
 it('does not invent a provider that conflicts with the raw protected seat context',async()=>{
  const row={id:8,date:'2026-11-14',branch_location:'cochin',client_name:null,exam_name:'Untitled exam',start_time:'09:00',end_time:'10:00',candidate_count:1};
  from.mockReturnValue(query(()=>({data:[row],error:null})));
  const{result}=renderHook(()=>useCalendarSessions(new Date('2026-11-14T12:00:00'),'cochin',q=>q,false),{wrapper:setup()});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));
  const day=analyseDay([...result.current.data!,row],'cochin','2026-11-14');expect(day.complete).toBe(true);expect(day.peak).toBe(1);
 });
 it('does not include Kochi rows when a Calicut legacy fallback is used',async()=>{
  from.mockReturnValueOnce(query(()=>({data:[],error:null}))).mockReturnValueOnce(query(()=>({data:[{id:1,branch_location:'cochin',client_name:'PEARSON VUE'},{id:2,branch_location:'calicut',client_name:'PROMETRIC'}],error:null})));
  const{result}=renderHook(()=>useCalendarSessions(new Date('2026-11-14T12:00:00'),'calicut',q=>q.eq('branch_location','calicut'),false),{wrapper:setup()});
  await waitFor(()=>expect(result.current.isSuccess).toBe(true));expect(result.current.data?.map(x=>x.id)).toEqual([2]);
 });
});
