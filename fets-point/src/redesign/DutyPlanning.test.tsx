import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import { DayWorkspace } from './DutyPlanning';
import {AuthContext} from '../contexts/AuthContextValue';
import {centreDate} from './operations-data';
import {createDayPlan,monday,type TeamMember} from './shift-plan';
const team:TeamMember[]=['a','b','c'].map(id=>({id,userId:id,name:`Colleague ${id.toUpperCase()}`,code:'D'}));
const repo=()=>({roster:vi.fn().mockResolvedValue(team),monthRoster:vi.fn().mockResolvedValue({[centreDate()]:team}),load:vi.fn().mockResolvedValue({record:null,lead:{lead_id:'a'},events:[]}),leads:vi.fn().mockResolvedValue([]),saveLead:vi.fn(),savePlan:vi.fn(),event:vi.fn(),reports:vi.fn().mockResolvedValue([]),report:vi.fn(),acknowledge:vi.fn(),change:vi.fn()});
function mount(repository:ReturnType<typeof repo>,cloud=false,role='super_admin',id='admin',branch='cochin') {return render(<AuthContext.Provider value={{user:{id},profile:{id,role,full_name:'Reviewer'},hasPermission:()=>true} as any}><DayWorkspace branch={branch} day={centreDate()} identity={{id,profileId:id,name:'Reviewer',admin:role==='super_admin'}} cloud={cloud} repository={repository}/></AuthContext.Provider>);}
beforeEach(()=>localStorage.clear());afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();});
describe('duty workspace',()=>{
 it('labels private drafts and never publishes when the shared backend is disabled',async()=>{const r=repo();mount(r);await screen.findByText('Who is here, and when?');expect(screen.getByRole('button',{name:'Publish shift plan'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Save private draft'}));await screen.findByText('Private draft saved in this browser. Nothing has been published.');expect(r.savePlan).not.toHaveBeenCalled();expect(localStorage.getItem(`fets-duty-draft:admin:cochin:${centreDate()}`)).toContain('availability');});
 it('does not substitute the branch team for an empty roster',async()=>{const r=repo();r.roster.mockResolvedValue([]);mount(r);await screen.findByText('No working staff found in this date’s roster.');expect(screen.getByRole('button',{name:'Publish shift plan'})).toBeDisabled();expect(screen.queryByText('Colleague A')).not.toBeInTheDocument();});
 it('keeps staff from changing a lead’s plan',async()=>{const r=repo();mount(r,true,'staff','b');await screen.findByText('Who is here, and when?');expect(screen.getByLabelText('Block 1 Front office owner')).toBeDisabled();expect(screen.queryByRole('button',{name:'Publish shift plan'})).not.toBeInTheDocument();});
 it('surfaces save failures without claiming the plan was saved',async()=>{const r=repo();r.savePlan.mockRejectedValue(new Error('Connection lost'));mount(r,true);await screen.findByText('Who is here, and when?');fireEvent.click(screen.getByRole('button',{name:'Save shared draft'}));await screen.findByRole('alert');expect(screen.getByText('Connection lost')).toBeInTheDocument();expect(screen.queryByText('Shared draft saved.')).not.toBeInTheDocument();});
 it('isolates another person’s private plan and lead choice',async()=>{localStorage.setItem(`fets-duty-lead:another:cochin:${monday(centreDate())}`,JSON.stringify('b'));const p=createDayPlan(team);p.blocks[0].duties.front='Other person private draft';localStorage.setItem(`fets-duty-draft:another:cochin:${centreDate()}`,JSON.stringify(p));mount(repo());await screen.findByText('Who is here, and when?');expect(screen.queryByDisplayValue('Other person private draft')).not.toBeInTheDocument();});
 it('shows a submitted shift as closed and removes further coverage and report actions',async()=>{
  const r=repo();r.load.mockResolvedValue({record:{id:'plan',branch:'cochin',day:centreDate(),lead_id:'a',plan:createDayPlan(team),status:'published',version:1},lead:null,events:[],changes:[],closed:true} as any);
  mount(r,true);await screen.findByText(/This shift’s records are closed/);
  expect(screen.queryByRole('button',{name:'Arrange cover or acting lead'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Submit report to super admin'})).not.toBeInTheDocument();
 });

});
