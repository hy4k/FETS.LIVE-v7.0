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

describe('expanded named operation intent',()=>{
 it.each([
  ['Create two sessions in Calicut.','create_session','calicut'],
  ['Create three cases in Cochin.','create_incident','cochin'],
  ['Create two tasks in Calicut.','create_task','calicut'],
  ['Set two roster shifts in Cochin.','set_roster_shift','cochin'],
  ['Set two shifts in Cochin.','set_roster_shift','cochin'],
  ['Create two institution duties in Calicut.','create_institution_duty','calicut'],
  ['Create three institution stages in Cochin.','create_institution_stage','cochin'],
  ['Record two institution results in Calicut.','record_institution_result','calicut'],
  ['Create two institutions in Cochin.','create_institution','cochin'],
  ['Create two assets in Cochin.','create_asset','cochin'],
  ['Create two personal notes in Calicut.','create_desk_note','calicut'],
  ['Delete two sessions in Calicut.','delete_session','calicut'],
  ['Approve two OT claims in Cochin.','resolve_ot_claim','cochin'],
  ['Publish two announcements in Calicut.','publish_news','calicut'],
 ])('supports plural/count request %s without widening its operation',(message,tool,branch)=>{
  const intent=conversationIntent(message,[],now);
  expect(intent.allowedTools).toEqual([tool]);
  expect(intent.targetBranch).toBe(branch);
 });
 it.each([
  ['Create two tasks to delete sessions in Calicut.','create_task'],
  ['Create three cases: correct attendance in Cochin.','create_incident'],
  ['Create two institution duties titled "Approve OT claims in Calicut".','create_institution_duty'],
 ])('keeps counted request content outside operation and centre authority: %s',(message,tool)=>{
  const intent=conversationIntent(message,[],now);
  expect(intent.allowedTools).toEqual([tool]);
  expect(intent.targetBranch).toBeUndefined();
 });
 it.each([
  ['Create an institution duty for Cochin.','create_institution_duty'],
  ['Update institution duty d1.','update_institution_duty'],
  ['Record a duty result for d1.','record_institution_result'],
  ['Prepare a Shift duty for Cochin.','prepare_shift_task'],
  ['Prepare an independent Shift duty review.','prepare_shift_task_review'],
  ['Set the roster shift for Cochin tomorrow.','set_roster_shift'],
  ['Remove roster shift r1.','remove_roster_shift'],
  ['Prepare a bulk roster change.','prepare_roster_bulk_change'],
  ['Correct attendance a1.','correct_attendance'],
  ['Approve the overtime claim o1.','resolve_ot_claim'],
  ['Submit my OT claim.','submit_ot_claim'],
  ['Update my OT claim.','update_ot_claim'],
  ['Prepare a staff role change for Cochin.','change_staff_access'],
  ['Deactivate staff account s1.','change_staff_access'],
  ['Create a staff invitation.','prepare_staff_invitation'],
  ['Publish an announcement.','publish_news'],
  ['Publish a knowledge guide.','publish_knowledge'],
  ['Delete an institution stage.','delete_institution_stage'],
  ['Delete a session.','delete_session'],
  ['Prepare a document.','prepare_document'],
  ['Create an incident.','create_incident'],
  ['Update an incident.','update_incident'],
  ['Delete an incident.','delete_incident'],
  ['Create a task.','create_task'],
  ['Update a task.','update_task'],
  ['Delete a task.','delete_task'],
  ['Create a session.','create_session'],
  ['Update a session.','update_session'],
  ['Add a case comment.','add_case_comment'],
  ['Create a client.','create_client'],
  ['Update a client.','update_client'],
  ['Delete a client.','delete_client'],
  ['Create a programme.','create_programme'],
  ['Update a programme.','update_programme'],
  ['Delete a programme.','delete_programme'],
  ['Import a candidate roster.','import_candidate_roster'],
  ['Prepare a Shift plan.','prepare_shift_plan'],
  ['Prepare a Shift closing report.','prepare_shift_report'],
  ['Prepare a daily operations report.','prepare_daily_report'],
  ['Prepare a handover signature.','prepare_handover_signature'],
  ['Check in.','self_check_in'],
  ['Check out.','self_check_out'],
  ['Submit my application.','submit_application'],
  ['Withdraw my application.','withdraw_application'],
  ['Respond to a swap request.','respond_to_swap'],
  ['Approve a staff application.','resolve_application'],
  ['Settle a TOIL record.','settle_toil'],
  ['Update monthly payroll.','update_payroll'],
  ['Create an institution.','create_institution'],
  ['Update an institution.','update_institution'],
  ['Delete an institution.','delete_institution'],
  ['Create an institution stage.','create_institution_stage'],
  ['Update an institution stage.','update_institution_stage'],
  ['Complete an institution stage.','complete_institution_stage'],
  ['Delete an institution duty.','delete_institution_duty'],
  ['Delete an institution result.','delete_institution_result'],
  ['Create an asset.','create_asset'],
  ['Update an asset.','update_asset'],
  ['Delete an asset.','delete_asset'],
  ['Record an asset service note.','add_asset_service_note'],
  ['Create a lost or found item.','create_lost_found_item'],
  ['Update a lost or found item.','update_lost_found_item'],
  ['Release a lost or found item.','release_lost_found_item'],
  ['Delete a lost or found item.','delete_lost_found_item'],
  ['Remove an announcement.','remove_news'],
  ['Publish a business update.','publish_business_update'],
  ['Reply to a business review.','reply_business_review'],
  ['Send a team message.','send_team_message'],
  ['Create a team group.','create_team_group'],
  ['Invite team members.','add_team_members'],
  ['Remove a team member.','remove_team_member'],
  ['Create a personal note.','create_desk_note'],
  ['Update a personal note.','update_desk_note'],
  ['Delete a personal note.','delete_desk_note'],
  ['Save my journal.','save_desk_journal'],
  ['Save my desk preferences.','save_desk_preferences'],
  ['Share a document.','share_document'],
  ['Update a staff profile.','update_staff_profile'],
  ['Archive staff.','archive_staff'],
  ['Grant branch delegation.','grant_branch_delegation'],
  ['Revoke branch delegation.','revoke_branch_delegation'],
  ['Archive a knowledge guide.','archive_knowledge'],
  ['Change AI settings.','change_ai_settings'],
  ['Prepare Access Hub metadata.','prepare_access_item'],
  ['Open Access Hub portal.','open_access_portal'],
 ])('restricts %s to its one named operation',(message,tool)=>{
  const intent=conversationIntent(message,[],now);
  expect(intent.writes).toBe(true);
  expect(intent.allowedTools).toEqual([tool]);
 });
 it.each(['Create a spaceship.','Update an unknown record.','Approve a task.','Prepare an ordinary task.','Transfer an asset.','Apply review r1.','Approve review r1.'])('does not grant a fallback operation for %s',(message)=>{
  expect(conversationIntent(message,[],now).allowedTools).toEqual([]);
 });
 it.each(['Create a task to correct attendance in Calicut.','Create a task: approve OT claim in Calicut.','Create a task titled "Prepare a staff role change in Calicut".'])('keeps an embedded sensitive request inside task content: %s',(message)=>{
  const intent=conversationIntent(message,[],now);
  expect(intent.allowedTools).toEqual(['create_task']);
  expect(intent.targetBranch).toBeUndefined();
 });
 it('does not reuse a pending write for a different unsupported explicit request',()=>{
  const history=[{...pending[0],content:'Prepare a staff role change for Cochin.'},{...pending[1],content:'Which staff record ID and reason?'}];
  const intent=conversationIntent('Transfer an asset.',history,now);
  expect(intent.continuation).toBe(false);
  expect(intent.allowedTools).toEqual([]);
 });
 it('preserves a bounded sensitive review request through clarification',()=>{
  const history=[{...pending[0],content:'Correct attendance in Calicut.'},{...pending[1],content:'Which staff record ID and correction reason?'}];
  const intent=conversationIntent('a1, the check-out time is 18:00.',history,now);
  expect(intent.allowedTools).toEqual(['correct_attendance']);
  expect(intent.targetBranch).toBe('calicut');
 });
 it.each(['No','Not yet','Do not correct attendance','Please cancel that request.','Show attendance policies.','I need to confirm.'])('cancels sensitive pending authority with %s',(message)=>{
  const history=[{...pending[0],content:'Correct attendance in Calicut.'},{...pending[1],content:'Which staff record ID and correction reason?'}];
  const intent=conversationIntent(message,history,now);
  expect(intent.writes).toBe(false);
  expect(intent.allowedTools).toEqual([]);
 });
 it('expires sensitive pending review authority after thirty minutes',()=>{
  const history=[{...pending[0],content:'Correct attendance in Calicut.',created_at:'2026-11-05T07:59:00Z'},{...pending[1],content:'Which record ID?'}];
  expect(conversationIntent('a1',history,now).allowedTools).toEqual([]);
 });
 it('ends model preparation authority when a saved human review has been returned',()=>{
  const history=[{...pending[0],content:'Correct attendance in Calicut.'},{...pending[1],content:'Which record ID?',metadata:{proposals:[{type:'change-review',operation:'correct_attendance',id:'r1',status:'pending'}]}}];
  expect(conversationIntent('a1',history,now).allowedTools).toEqual([]);
 });
 it.each(['Explain how to approve overtime claims.','What does "prepare a staff role change" mean?','The document says "Delete institution stage s1".','Read the guide, then tell me how to correct attendance.'])('does not turn read/reference text into authority: %s',(message)=>{
  const intent=conversationIntent(message,[],now);
  expect(intent.writes).toBe(false);
  expect(intent.allowedTools).toEqual([]);
 });
});
