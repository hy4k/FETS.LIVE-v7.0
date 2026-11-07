import{describe,it,expect}from'vitest';
import{uniqueContributors}from'./presentation';
describe('conflict contributor presentation',()=>{
 it('shows one current copy per linked Calendar session while omitting unrelated sessions',()=>{
  const first={id:7,date:'2099-11-14',candidate_count:20},fresh={...first,candidate_count:15};
  expect(uniqueContributors([first,{id:8,date:first.date,candidate_count:10},fresh],[7])).toEqual([fresh]);
 });
});
