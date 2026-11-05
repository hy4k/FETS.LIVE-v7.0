import { describe, expect, it, vi } from 'vitest';
import { managementAction } from '../../../supabase/functions/fets-ai-agent/management';
const user='00000000-0000-4000-8000-000000000001';
const scope={userId:user,branch:'cochin',admin:true,profileIds:[user],role:'super_admin'};
describe('AI administration boundaries',()=>{
 it('blocks non-admin settings changes before accessing storage',async()=>{
  const from=vi.fn();
  await expect(managementAction({from},{...scope,admin:false},{},{action:'settings-update',changes:{kill_switch:false}})).rejects.toThrow(/admin/i);
  expect(from).not.toHaveBeenCalled();
 });
 it('rejects unavailable providers and unknown setting fields',async()=>{
  await expect(managementAction({},scope,{GEMINI_API_KEY:'fixture'},{action:'settings-update',changes:{provider:'claude'}})).rejects.toThrow(/credential|configured/i);
  await expect(managementAction({},scope,{},{action:'settings-update',changes:{allowed_tools:{staff:['*']}}})).rejects.toThrow(/setting/i);
 });
 it('rejects arbitrary knowledge stores and unsafe source links',async()=>{
  await expect(managementAction({},scope,{},{action:'knowledge-save',document:{title:'Policy',content:'Fixture reference policy content',source:'ai_settings'}})).rejects.toThrow(/source/i);
  await expect(managementAction({},scope,{},{action:'knowledge-save',document:{title:'Policy',content:'Fixture reference policy content',source_url:'javascript:alert(1)'}})).rejects.toThrow(/https/i);
 });
 it('requires a version for existing knowledge edits',async()=>{
  await expect(managementAction({},scope,{},{action:'knowledge-save',document:{id:user,source:'legacy',title:'Policy',content:'Fixture reference policy content'}})).rejects.toThrow(/version/i);
 });
 it('soft-disables memory through its protected RPC instead of a client update',async()=>{
  let query:any;query=new Proxy({}, {get:(_,k)=>k==='then'?(resolve:any)=>resolve({data:{id:user,mem_key:'timezone',mem_value:'India',scope:'user',scope_ref:user,importance:3},error:null}):()=>query});
  const rpc=vi.fn().mockResolvedValue({data:{id:user,is_active:false},error:null});
  await managementAction({from:()=>query,rpc},scope,{},{action:'memory-delete',id:user});
  expect(rpc).toHaveBeenCalledWith('fets_ai_save_memory',expect.objectContaining({p_id:user,p_active:false,p_scope_ref:user}));
 });
});
