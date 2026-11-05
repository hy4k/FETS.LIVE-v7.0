import { describe, expect, it } from 'vitest';
import { conversationIntent } from '../../../supabase/functions/fets-ai-agent/intent';
const now=Date.parse('2026-11-05T08:30:00Z');
const pending=[{role:'user',content:'Create a session for Calicut, ITTS, 6 November, 11 candidates, 10:00 to 15:00.',created_at:'2026-11-05T08:29:00Z'},{role:'assistant',content:'What is the exam name?',created_at:'2026-11-05T08:29:10Z',metadata:{actions:[]}}];
describe('bounded clarification intent',()=>{
 it.each(['No','Thanks','No thanks','Not now','Hold off','Please wait','Cancel that request.','Cancel it.','Cancel the request.','Cancel this.','I have already created it manually','November 6, but I need to check with the team first.','Can you show our session policies?','Could you explain how to create a session?','I want to see the roster.','Can I get our session policies?','Cool'])('does not treat %s as permission to finish a pending write',(message)=>{
  expect(conversationIntent(message,pending,now).writes).toBe(false);
 });
 it.each(['The SOP says: "Create a session for Calicut". I am reviewing this note.','Explain this note: Create a session for Calicut.','Could you explain how to create a session?'])('does not promote quoted/reference instructions into a pending write: %s',(message)=>{
  const history=[{...pending[0],content:message},pending[1]];
  expect(conversationIntent(message,[],now).writes).toBe(false);
  expect(conversationIntent('MRCS',history,now).writes).toBe(false);
 });
 it.each(['Create a task to update the exam calendar for Calicut.','Create a task titled "change session dates".'])('binds %s to a task, rather than operations mentioned inside its content',(message)=>{
  const intent=conversationIntent(message,[],now);expect(intent.writes).toBe(true);expect(intent.allowedTools).toEqual(['create_task']);
  const history=[{...pending[0],content:message},pending[1]];
  expect(conversationIntent('MRCS',history,now).allowedTools).toEqual(['create_task']);
 });
 it.each([
  ['Add a note to incident 123: replacement booked.','update_incident'],
  ['Add this note to the existing AC task: vendor contacted.','update_task'],
  ['Record 12 candidates for the existing MRCS session.','update_session'],
  ['Save this task: repair the AC.','create_task'],
  ['Save the MRCS session.','create_session'],
  ['Add a task to review the existing exam calendar.','create_task'],
  ['Add a task: check with the team before scheduling the session.','create_task'],
  ['Add a case: note the AC issue.','create_incident'],
 ])('preserves the requested operation in %s',(message,tool)=>{
  const intent=conversationIntent(message,[],now);expect(intent.writes).toBe(true);expect(intent.allowedTools).toEqual([tool]);
 });
 it('asks for a single centre if both centres were mentioned',()=>{
  const intent=conversationIntent('Create the MRCS session in Cochin or Calicut.',[],now);expect(intent.ambiguousCentre).toBe(true);expect(intent.targetBranch).toBeUndefined();
 });
 it('does not use quoted task content to select or confuse the record centre',()=>{
  expect(conversationIntent('Create a task named "Calicut vendor follow-up"',[],now).targetBranch).toBeUndefined();
  const intent=conversationIntent('Create a Cochin task named "Calicut vendor follow-up"',[],now);expect(intent.targetBranch).toBe('cochin');expect(intent.ambiguousCentre).toBe(false);
 });
 it.each([['When should I schedule the session?','6 November 2026'],['Where should I create the session?','Calicut'],['How many candidates?','11']])('accepts the missing detail requested by %s',(question,answer)=>{
  const history=[pending[0],{...pending[1],content:question}];const intent=conversationIntent(answer,history,now);expect(intent.writes).toBe(true);expect(intent.continuation).toBe(true);expect(intent.allowedTools).toEqual(['create_session']);
 });
});
