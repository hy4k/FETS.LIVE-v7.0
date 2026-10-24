import React from 'react';
import {renderHook,waitFor,act,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {AuthContext} from '../contexts/AuthContextValue';
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{rpc}}));
import {useWorkspaceCapabilities} from './useWorkspaceCapabilities';
afterEach(()=>{cleanup();vi.resetAllMocks();});
const wrapper=({children}:{children:React.ReactNode})=><AuthContext.Provider value={{user:{id:'user'}} as any}>{children}</AuthContext.Provider>;
describe('workspace activation',()=>{
 it('gates result and personnel writes on the version 5 capability',async()=>{
  rpc.mockResolvedValueOnce({data:{version:4,desk:true,duties:true,blueprint:true,dutyReview:true,dutyWorkflow:true}}).mockResolvedValue({data:{version:5,desk:true,duties:true,blueprint:true,dutyReview:true,dutyWorkflow:true}});
  const {result}=renderHook(()=>useWorkspaceCapabilities(),{wrapper});await waitFor(()=>expect(result.current.ready).toBe(true));expect(result.current.dutyWorkflow).toBe(false);act(()=>result.current.refresh());await waitFor(()=>expect(result.current.dutyWorkflow).toBe(true));
 });
 it('enables independent review only after the server advertises it',async()=>{
  rpc.mockResolvedValueOnce({data:{version:3,desk:true,duties:true,blueprint:true}}).mockResolvedValue({data:{version:4,desk:true,duties:true,blueprint:true,dutyReview:true}});
  const {result}=renderHook(()=>useWorkspaceCapabilities(),{wrapper});await waitFor(()=>expect(result.current.blueprint).toBe(true));expect(result.current.dutyReview).toBe(false);
  act(()=>result.current.refresh());await waitFor(()=>expect(result.current.dutyReview).toBe(true));
 });
 it('stays private until the versioned database probe succeeds, then activates on retry',async()=>{
  rpc.mockResolvedValueOnce({error:{message:'function missing'}}).mockResolvedValue({data:{version:2,desk:true,duties:true}});
  const {result}=renderHook(()=>useWorkspaceCapabilities(),{wrapper});await waitFor(()=>expect(result.current.ready).toBe(true));expect(result.current.duties).toBe(false);
  act(()=>result.current.refresh());await waitFor(()=>expect(result.current.duties).toBe(true));expect(result.current.desk).toBe(true);
 });
 it('keeps an activated workspace active during a transient connection failure',async()=>{
  rpc.mockResolvedValueOnce({data:{version:2,desk:true,duties:true}}).mockRejectedValue(new Error('Network offline'));
  const {result}=renderHook(()=>useWorkspaceCapabilities(),{wrapper});await waitFor(()=>expect(result.current.duties).toBe(true));act(()=>result.current.refresh());await waitFor(()=>expect(result.current.error).toContain('connection'));expect(result.current.duties).toBe(true);
 });
 it('does not enable duties for an account without a trusted membership',async()=>{
  rpc.mockResolvedValue({data:{version:2,desk:true,duties:false}});const {result}=renderHook(()=>useWorkspaceCapabilities(),{wrapper});await waitFor(()=>expect(result.current.ready).toBe(true));expect(result.current.duties).toBe(false);expect(result.current.desk).toBe(true);
 });
});
