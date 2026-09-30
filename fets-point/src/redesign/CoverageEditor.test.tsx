import React from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import CoverageEditor from './CoverageEditor';
import {createDayPlan,resolvedOwner,checkpoints,ownedBlock,type CoverageChange} from './shift-plan';
const team=['a','b','c','d'].map(id=>({id,userId:id,name:`Staff ${id}`,code:'D'}));
const plan=createDayPlan(team);
const change:CoverageChange={id:'change',plan_id:'p',kind:'coverage',block:0,lane:'control',staff_id:'d',starts:500,ends:530,shift_start:480,shift_end:1020,reason:'Relief cover agreed',actor_id:'a',created_at:'2026-09-29T00:00:00Z'};
afterEach(cleanup);
describe('audited coverage',()=>{
 it('preserves history and restores the previous owner after temporary cover ends',()=>{expect(resolvedOwner(plan,0,'control',499,[change])).toBe('c');expect(resolvedOwner(plan,0,'control',500,[change])).toBe('d');expect(resolvedOwner(plan,0,'control',530,[change])).toBe('c');expect(ownedBlock(plan,0,'control','d',[change])).toBe(true);expect(checkpoints(plan,[change]).find(p=>p.block===0&&p.kind==='dvr'&&p.due===504)?.owner).toBe('d');expect(plan.blocks[0].owners.control).toBe('c');});
 it('requires named cover, a reason and confirmation before submitting',async()=>{
  const repository={change:vi.fn().mockResolvedValue(change)} as any;const onSaved=vi.fn();
  render(<CoverageEditor record={{id:'p',day:'2099-01-01'} as any} plan={plan} team={team} changes={[]} repository={repository} canManage onSaved={onSaved}/>);
  fireEvent.click(screen.getByRole('button',{name:'Arrange cover or acting lead'}));
  const save=screen.getByRole('button',{name:'Save audited change'});expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Named replacement'),{target:{value:'d'}});
  fireEvent.change(screen.getByLabelText('Reason and coverage arrangement'),{target:{value:'Relief covers the front office while the owner is away'}});
  fireEvent.click(screen.getByRole('checkbox'));expect(save).toBeEnabled();fireEvent.click(save);
  await screen.findByRole('button',{name:'Arrange cover or acting lead'});
  expect(repository.change).toHaveBeenCalledWith(expect.objectContaining({staff_id:'d',starts:480,ends:570,kind:'coverage'}));
 });
 it('staff can inspect the history but cannot arrange changes',()=>{
  render(<CoverageEditor record={{id:'p',day:'2099-01-01'} as any} plan={plan} team={team} changes={[change]} repository={{} as any} canManage={false} onSaved={vi.fn()}/>);
  expect(screen.queryByRole('button',{name:'Arrange cover or acting lead'})).not.toBeInTheDocument();expect(screen.getByText(/Relief cover agreed/)).toBeInTheDocument();
 });
});
