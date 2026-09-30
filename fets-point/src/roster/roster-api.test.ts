import {describe,it,expect,vi} from 'vitest';
vi.mock('../lib/supabase',()=>({supabase:{}}));
import {projectedGroups,possibleLegacyMatch} from './roster-api';
const row={source_row:1,roster_number:'123',full_name:'Alex',exam_name:'CMA',exam_part:'Part 1',exam_start_time:'09:00:00',phone:null};
describe('roster count preview',()=>{
  it('replaces a matching candidate without increasing the count',()=>{
    const existing={...row,id:'existing',client_name:'PROMETRIC'};
    const g=projectedGroups([row],[existing],[{id:1,client_name:'PROMETRIC',exam_name:'CMA',start_time:'09:00:00',candidate_count:20}],'PROMETRIC');
    expect(g[0]).toMatchObject({before:20,after:1});
  });
  it('shows both groups when a candidate moves time and flags unnamed legacy identity',()=>{
    const g=projectedGroups([{...row,exam_start_time:'11:00:00'}],[{...row,id:'existing',client_name:'PROMETRIC'}],[],'PROMETRIC');
    expect(g.map(x=>x.after)).toEqual([0,1]);expect(possibleLegacyMatch(row,[{...row,roster_number:null,id:'legacy',client_name:'PROMETRIC'}],'PROMETRIC')).toBe(true);
  });
});
