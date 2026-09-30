import type { HandoverProposal } from './fets-ai-api';

let pending:HandoverProposal|null=null;
export function offerHandoverDraft(draft:HandoverProposal){ pending=draft; }
export function peekHandoverDraft(branch:string,day:string){return pending?.branch===branch&&pending.day===day?pending:null;}
export function takeHandoverDraft(branch:string,day:string){const draft=peekHandoverDraft(branch,day);if(draft)pending=null;return draft;}
export function pendingHandoverDay(branch:string){return pending?.branch===branch?pending.day:null;}
