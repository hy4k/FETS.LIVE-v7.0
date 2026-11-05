import { describe, expect, it, vi } from 'vitest';
import { generateAnswer } from '../../../supabase/functions/fets-ai-agent/providers';

const base={provider:'gemini' as const,model:'gemini-3.1-pro-preview',key:'test-only-key',system:'Fixture',history:[],message:'Create a case',tools:[{name:'create_incident',description:'Create a case',parameters:{type:'OBJECT',properties:{title:{type:'STRING'}}}}],maxIterations:4};
describe('model tool execution and confirmed outcomes',()=>{
 it('preserves Gemini thought signatures and matches function response IDs',async()=>{
  const signed={role:'model',parts:[{thoughtSignature:'keep-exact',functionCall:{id:'call-1',name:'create_incident',args:{title:'AC'}}}]};
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({candidates:[{content:signed}]}))).mockResolvedValueOnce(new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Saved'}]}}]})));
  const execute=vi.fn().mockResolvedValue({type:'action-result',tool:'create_incident',status:'succeeded',recordId:'real-1'});
  const result=await generateAnswer({...base,execute,fetcher});
  const second=JSON.parse(fetcher.mock.calls[1][1].body);
  expect(second.contents).toContainEqual(signed);
  expect(second.contents.at(-1).parts[0].functionResponse.id).toBe('call-1');
  expect(result.actions).toEqual([{type:'action-result',tool:'create_incident',status:'succeeded',recordId:'real-1'}]);
 });
 it('retains confirmed results if the model fails after the database saved',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{functionCall:{name:'create_incident',args:{title:'AC'}}}]}}]}))).mockRejectedValueOnce(new Error('timeout'));
  const result=await generateAnswer({...base,fetcher,execute:async()=>({type:'action-result',tool:'create_incident',status:'succeeded',recordId:'real'})});
  expect(result.actions[0].recordId).toBe('real');
  expect(result.text).toMatch(/saved|completed/i);
 });
 it('uses Anthropic tool_result blocks and the selected model without a Gemini fallback',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({content:[{type:'tool_use',id:'a-1',name:'create_incident',input:{title:'AC'}}]}))).mockResolvedValueOnce(new Response(JSON.stringify({content:[{type:'text',text:'Saved'}]})));
  const result=await generateAnswer({...base,provider:'claude',model:'claude-sonnet-4-6',fetcher,execute:async()=>({type:'action-result',status:'succeeded',recordId:'c-1'})});
  expect(fetcher.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
  const second=JSON.parse(fetcher.mock.calls[1][1].body);
  expect(second.model).toBe('claude-sonnet-4-6');
  expect(second.messages.at(-1).content[0]).toMatchObject({type:'tool_result',tool_use_id:'a-1'});
  expect(result.provider).toBe('claude');
 });
 it('surfaces provider errors without leaking the configured key',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'bad key test-only-key'}}),{status:403}));
  await expect(generateAnswer({...base,fetcher,execute:vi.fn()})).rejects.toThrow(/403/);
  await expect(generateAnswer({...base,fetcher,execute:vi.fn()})).rejects.not.toThrow(/test-only-key/);
 });
});
