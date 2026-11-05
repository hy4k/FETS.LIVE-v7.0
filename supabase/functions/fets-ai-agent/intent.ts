import { WRITE_TOOLS } from './catalog.ts';
import { OPERATION_DEFINITIONS } from './operation-definitions.ts';

type Message={role:string;content:string;created_at?:string;metadata?:Record<string,any>};
type Pending={tools:string[];centre?:string;ambiguous:boolean;directive:string;startedAt:number;awaiting:boolean};
const question=/^\s*(?:please\s+)?(?:how|why|what|who|when|where|explain|summari[sz]e|show|list|read|find|compare|tell me)\b/i;
const verbs='create|add|log|record|file|raise|schedule|book|save|update|change|edit|modify|assign|reschedule|move|cancel|close|mark|set|delete|remove|approve|reject|resolve|correct|publish|transfer|deactivate|prepare|submit|withdraw|respond|settle|complete|release|reply|send|invite|share|archive|grant|revoke|import|open|apply';
const commandStart=new RegExp(`^(${verbs})\\b`,'i');
const cancellation=new RegExp(`\\b(?:never mind|nevermind|forget (?:that|it)|cancel (?:that|this|it|the request)|stop (?:that|this|it)|not now|not yet|hold off|hold on|need to (?:check|confirm|ask)|check with|already (?:created|scheduled|done|saved))\\b|\\b(?:don['’]?t|do not|never)\\s+(?:${verbs})\\b`,'i');
// Quoted reference text cannot introduce a record operation or its target.
const withoutReferences=(message:string)=>message.replace(/```[\s\S]*?```|`[^`]*`|"[^"]*"|“[^”]*”|‘[^’]*’/g,' ').replace(/(^|[\s(:,])'[^'\n]*'(?=$|[\s.,;:!?)])/g,'$1 ').trim();
function commandText(message:string){
 let text=withoutReferences(message);
 for(let i=0;i<4;i++)text=text.replace(/^(?:(?:hi|hello|hey)[,!]?\s+|fets(?:\s+ai)?[,!:]?\s+|please\s+|(?:can|could|would|will)\s+you\s+(?:please\s+)?|i\s+(?:want|need|would like)(?:\s+you)?\s+to\s+|(?:for|in|at)\s+(?:calicut|cochin|kochi|kozhikode)[,:]?\s+)/i,'');
 return text;
}
function cancelled(message:string){
 const text=commandText(message);
 return /^(?:no(?:\s+thanks)?|thanks|thank you|stop|cancel|wait|not now|hold off|cool|okay|ok|great|got it)[.!]?$/i.test(text)
  ||/^(?:cancel|stop|forget)\s+(?:that(?: request)?|this(?: request)?|it|the request)[.!]?$/i.test(text)
  ||/\bbut\s+(?:please\s+)?(?:wait|hold off|not now|I need to (?:check|confirm|ask))\b/i.test(text)
  ||(!command(message)&&(cancellation.test(text)||cancellation.test(withoutReferences(message))));
}
function command(message:string){
 let text=commandText(message);
 const check=text.match(/^(?:check|clock)\s+(?:me\s+)?(in|out)\b/i);
 if(check)return {mode:`check-${check[1].toLowerCase()}`,body:text.slice(check[0].length),verb:`check-${check[1].toLowerCase()}`};
 let match=text.match(commandStart);
 if(!match&&question.test(text)){
  const follow=text.match(new RegExp(`\\b(?:and|then|also)\\s+(?:please\\s+)?((?:${verbs})\\b[\\s\\S]*)`,'i'));
  if(follow){text=follow[1];match=text.match(/^(\w+)\b/);}
 }
 if(!match){
  const malayalam=text.match(/(സൃഷ്ടിക്ക(?:ുക)?|ചേർക്ക(?:ുക)?|രേഖപ്പെടുത്ത(?:ുക)?|മാറ്റുക|അപ്ഡേറ്റ്(?:\s+ചെയ്യുക)?)[.!]?$/);
  return malayalam?{mode:/മാറ്റുക|അപ്ഡേറ്റ്/.test(malayalam[1])?'update':'create',body:text.slice(0,malayalam.index)}:null;
 }
 const verb=match[1].toLowerCase(),body=text.slice(match[0].length);
 const mode=/^(?:update|change|edit|modify|assign|reschedule|move|cancel|close|mark|set)$/.test(verb)?'update':/^(?:create|add|log|record|file|raise|schedule|book|save)$/.test(verb)?'create':verb;
 return {mode,body,verb};
}
export function requestIntent(message:string){
 return {writes:!cancelled(message)&&Boolean(command(message)),memory:/\b(remember|memorise|memorize|save.{0,30}(?:memory|preference|instruction)|update.{0,30}memory)\b|ഓർമ്മ|ഓർക്ക/i.test(message)};
}
function centres(message:string){
 message=authorityText(message);
 return [/(?:\b(?:cochin|kochi|ernakulam)\b|കൊച്ചി|എറണാകുളം)/i.test(message)?'cochin':null,/(?:\b(?:calicut|kozhikode)\b|കോഴിക്കോട്|കാലിക്കറ്റ്)/i.test(message)?'calicut':null].filter((v):v is string=>Boolean(v));
}
// Descriptions and embedded instructions are record content, not authority for
// another operation or another centre. Keep clock times such as 10:00 intact.
function authorityText(message:string){
 const text=withoutReferences(message);
 if(!command(message))return text;
 return text.split(new RegExp(`:(?!\\d{2}\\b)|\\n|\\b(?:titled|named|description|content)\\b|\\bto\\s+(?:${verbs}|notify|review|check|contact|discuss)\\b`,'i'),1)[0];
}
type Target={pattern:RegExp;operations:Record<string,string>};
const crud=(kind:string,extra:Record<string,string>={})=>({create:`create_${kind}`,update:`update_${kind}`,delete:`delete_${kind}`,remove:`delete_${kind}`,...extra});
const targets:Target[]=[
 {pattern:/\b(?:case|incident)\s+comment\b|\bcomment\s+(?:to|on|for)\s+(?:the\s+)?(?:case|incident)\b/i,operations:{create:'add_case_comment'}},
 {pattern:/\b(?:case|incident)\b/i,operations:crud('incident')},
 {pattern:/\b(?:task|todo|to-do|reminder|actionable)\b/i,operations:crud('task')},
 {pattern:/\b(?:session|exam|calendar|booking)\b/i,operations:crud('session')},
 {pattern:/\bclient\b/i,operations:crud('client')},
 {pattern:/\b(?:client\s+(?:exam|programme|program)|exam\s+catalogue(?:\s+item)?|programme|program)\b/i,operations:crud('programme')},
 {pattern:/\bcandidate\s+roster(?:\s+import)?\b/i,operations:{import:'import_candidate_roster',prepare:'import_candidate_roster'}},
 {pattern:/\b(?:bulk\s+roster(?:\s+change)?|roster\s+bulk\s+change)\b/i,operations:{prepare:'prepare_roster_bulk_change',update:'prepare_roster_bulk_change'}},
 {pattern:/\b(?:roster(?:\s+shift)?|shift)\b/i,operations:{create:'set_roster_shift',update:'set_roster_shift',remove:'remove_roster_shift',delete:'remove_roster_shift'}},
 {pattern:/\b(?:independent\s+)?shift\s+(?:task|duty)\s+review\b/i,operations:{prepare:'prepare_shift_task_review'}},
 {pattern:/\bshift\s+(?:task|duty)\b/i,operations:{prepare:'prepare_shift_task',create:'prepare_shift_task',update:'prepare_shift_task'}},
 {pattern:/\bshift\s+plan\b/i,operations:{prepare:'prepare_shift_plan',create:'prepare_shift_plan',update:'prepare_shift_plan'}},
 {pattern:/\b(?:shift\s+(?:closing\s+)?report|closing\s+report)\b/i,operations:{prepare:'prepare_shift_report',create:'prepare_shift_report'}},
 {pattern:/\bdaily\s+(?:operations\s+)?report\b/i,operations:{prepare:'prepare_daily_report',create:'prepare_daily_report'}},
 {pattern:/\bhandover(?:\s+signature)?\b/i,operations:{prepare:'prepare_handover_signature'}},
 {pattern:/\bmy\s+check[- ]?in\b/i,operations:{create:'self_check_in'}},
 {pattern:/\bmy\s+check[- ]?out\b/i,operations:{create:'self_check_out'}},
 {pattern:/\battendance\b/i,operations:{correct:'correct_attendance',update:'correct_attendance',prepare:'correct_attendance'}},
 {pattern:/\b(?:(?:staff|leave|my)\s+)?application\b/i,operations:{submit:'submit_application',withdraw:'withdraw_application',approve:'resolve_application',reject:'resolve_application',resolve:'resolve_application'}},
 {pattern:/\bswap(?:\s+(?:request|response))?\b/i,operations:{respond:'respond_to_swap',approve:'respond_to_swap',reject:'respond_to_swap'}},
 {pattern:/\b(?:ot|overtime)\s+claim\b/i,operations:{submit:'submit_ot_claim',create:'submit_ot_claim',update:'update_ot_claim',approve:'resolve_ot_claim',reject:'resolve_ot_claim',resolve:'resolve_ot_claim'}},
 {pattern:/\btoil(?:\s+record)?\b/i,operations:{settle:'settle_toil'}},
 {pattern:/\b(?:monthly\s+)?payroll\b/i,operations:{update:'update_payroll',prepare:'update_payroll'}},
 {pattern:/\b(?:institution\s+)?stage\b/i,operations:crud('institution_stage',{complete:'complete_institution_stage'})},
 {pattern:/\b(?:institution\s+)?duty\s+result\b|\binstitution\s+result\b/i,operations:{create:'record_institution_result',delete:'delete_institution_result',remove:'delete_institution_result'}},
 {pattern:/\b(?:institution\s+)?duty\b/i,operations:crud('institution_duty')},
 {pattern:/\binstitution\b/i,operations:crud('institution')},
 {pattern:/\basset\s+service\s+note\b|\bservice\s+note\s+(?:for|on)\s+(?:the\s+)?asset\b/i,operations:{create:'add_asset_service_note'}},
 {pattern:/\basset\b/i,operations:crud('asset')},
 {pattern:/\b(?:lost(?:\s+or|\s+and|[- ])?\s*found(?:\s+item)?|lost\s+item|found\s+item|property\s+release)\b/i,operations:crud('lost_found_item',{release:'release_lost_found_item',prepare:'release_lost_found_item'})},
 {pattern:/\b(?:announcement|broadcast|news)\b/i,operations:{publish:'publish_news',remove:'remove_news',delete:'remove_news'}},
 {pattern:/\b(?:business\s+(?:profile\s+)?review(?:\s+reply)?|google\s+review)\b/i,operations:{reply:'reply_business_review',prepare:'reply_business_review'}},
 {pattern:/\b(?:business\s+(?:profile\s+)?update|business\s+profile|google\s+business)\b/i,operations:{publish:'publish_business_update',prepare:'publish_business_update'}},
 {pattern:/\bteam\s+message\b/i,operations:{send:'send_team_message',prepare:'send_team_message'}},
 {pattern:/\bteam\s+group\b/i,operations:{create:'create_team_group',prepare:'create_team_group'}},
 {pattern:/\bteam\s+members?\b/i,operations:{create:'add_team_members',invite:'add_team_members',remove:'remove_team_member'}},
 {pattern:/\b(?:personal|desk|my)\s+note\b|\bnote(?=\s*(?:[.!:]|$))/i,operations:crud('desk_note')},
 {pattern:/\b(?:desk\s+)?journal\b/i,operations:{create:'save_desk_journal',update:'save_desk_journal'}},
 {pattern:/\bdesk\s+preferences\b/i,operations:{create:'save_desk_preferences',update:'save_desk_preferences'}},
 {pattern:/\bdocument\b/i,operations:{prepare:'prepare_document',share:'share_document'}},
 {pattern:/\b(?:staff|employee)\s+(?:profile|details)\b/i,operations:{update:'update_staff_profile'}},
 {pattern:/\b(?:staff|user|account)(?:\s+profile)?\s+(?:role|access|permissions?)(?:\s+change)?\b|\b(?:staff|user)\s+account\b|\baccount\s+role\s+change\b/i,operations:{update:'change_staff_access',prepare:'change_staff_access',deactivate:'change_staff_access',create:'prepare_staff_invitation',archive:'archive_staff'}},
 {pattern:/\bstaff\s+invitation\b|\bnew\s+staff\s+account\b/i,operations:{create:'prepare_staff_invitation',prepare:'prepare_staff_invitation',invite:'prepare_staff_invitation'}},
 {pattern:/\bstaff(?:\s+archival)?\b/i,operations:{archive:'archive_staff'}},
 {pattern:/\b(?:branch\s+)?delegation\b/i,operations:{grant:'grant_branch_delegation',revoke:'revoke_branch_delegation',prepare:'grant_branch_delegation'}},
 {pattern:/\b(?:knowledge(?:\s+(?:guide|document))?|verified\s+guide|guide)\b/i,operations:{publish:'publish_knowledge',archive:'archive_knowledge'}},
 {pattern:/\b(?:ai|assistant)\s+(?:settings|configuration)\b/i,operations:{update:'change_ai_settings',prepare:'change_ai_settings'}},
 {pattern:/\b(?:access\s+hub\s+(?:metadata|item)|access\s+item)\b/i,operations:{prepare:'prepare_access_item'}},
 {pattern:/\baccess(?:\s+hub)?\s+portal\b/i,operations:{open:'open_access_portal',prepare:'open_access_portal'}},
];
const operations=new Map(OPERATION_DEFINITIONS.map(operation=>[operation.name,operation]));
// Canonicalise only the closed target vocabulary. Counts stay in the request;
// each call still resolves to one named operation and its original first target.
const singularTargets:Record<string,string>={
 cases:'case',incidents:'incident',tasks:'task',todos:'todo',reminders:'reminder',actionables:'actionable',
 sessions:'session',exams:'exam',calendars:'calendar',bookings:'booking',clients:'client',programmes:'programme',programs:'program',
 rosters:'roster',shifts:'shift',plans:'plan',reports:'report',signatures:'signature',comments:'comment',
 applications:'application',swaps:'swap',requests:'request',responses:'response',claims:'claim',records:'record',
 institutions:'institution',stages:'stage',duties:'duty',results:'result',assets:'asset',notes:'note',items:'item',
 announcements:'announcement',broadcasts:'broadcast',reviews:'review',replies:'reply',updates:'update',messages:'message',groups:'group',
 journals:'journal',documents:'document',profiles:'profile',roles:'role',accounts:'account',invitations:'invitation',delegations:'delegation',guides:'guide',portals:'portal',
};
const targetText=(text:string)=>text.replace(/\b[a-z]+\b/gi,word=>Object.prototype.hasOwnProperty.call(singularTargets,word.toLowerCase())?singularTargets[word.toLowerCase()]:word);
function toolsFor(message:string,_typedOnly=false){
 const action=command(message);if(!action||cancelled(message))return [];
 if(/^check-(?:in|out)$/.test(action.mode))return /^\s*(?:now|today|please|myself|for me)?[.!]?\s*$/i.test(action.body)?[action.mode==='check-in'?'self_check_in':'self_check_out']:[];
 const body=targetText(command(authorityText(message))?.body||'');
 const matches=targets.map(target=>{const match=target.pattern.exec(body);return {target,index:match?.index??-1,length:match?.[0].length||0};}).filter(match=>match.index>=0).sort((a,b)=>a.index-b.index||b.length-a.length);
 const first=matches[0];if(!first)return [];
 const object=body.slice(0,first.index+first.length);
 const legacy=['create_incident','create_task','create_session'].includes(first.target.operations.create);
 const existing=/\bexisting\b/i.test(object)||(legacy&&/\b(?:note|comment)\b/i.test(object));
 const mode=('verb' in action&&/^(?:add|record|save)$/.test(action.verb)&&existing)?'update':action.mode;
 const name=first.target.operations[('verb' in action&&action.verb)||mode]||first.target.operations[mode];
 const operation=operations.get(name);
 if(!operation)return [];
 // These words request a review draft, never a looser ordinary write and
 // never the human review-decide endpoint.
 if('verb' in action&&/^(?:delete|approve|correct|publish|transfer|deactivate|prepare)$/.test(action.verb)&&!operation.review)return [];
 return [operation.name];
}
function asksForDetails(text:string){
 return /\b(?:what|which|who|when|where|how many|provide|specify|tell me|enter|need|missing|confirm|supply)\b/i.test(text)
  &&/\b(?:exam|programme|program|name|centre|center|client|date|day|time|candidates?|count|title|description|detail|severity|category|priority|assignee|assign|status|record|session|happened|ID|staff|role|permission|reason|amount|hours|shift|duty|document)\b/i.test(text);
}

/** Reconstruct only an unfinished command in this caller's owned conversation.
 * A clarification is bounded to its original tool/centre and expires after 30
 * minutes. Assistant text can ask for details, but can never start authority.
 */
export function conversationIntent(message:string,history:Message[]=[],now=Date.now()){
 let pending:Pending|null=null;
 const active=()=>pending&&now-pending.startedAt<=30*60000&&pending.startedAt<=now+5000;
 const accept=(text:string,time:number)=>{
  if(!active())pending=null;
  const intent=requestIntent(text),named=centres(text),typed=toolsFor(text,true);
  const readOnly=question.test(commandText(text))||/[?？]/.test(text)||/\b(?:show|explain|summari[sz]e|list|read|find|search|look up|tell me|compare|see|understand|learn|know)\b/i.test(text)||/^(?:can|could|would|will|may|do|does|did|is|are|has|have)\s+(?:you|we|I|the|this|it|there)\b/i.test(text.trim());
  if(cancelled(text)||intent.memory||(readOnly&&!intent.writes)){pending=null;return false;}
  if(intent.writes&&typed.length){
   const prior=pending&&pending.tools.some(tool=>typed.includes(tool))?pending:null;
   pending={tools:typed,centre:named.length===1?named[0]:named.length===0?prior?.centre:undefined,ambiguous:named.length>1||(named.length===0&&Boolean(prior?.ambiguous)),directive:text,startedAt:time,awaiting:false};
   return false;
  }
  if(intent.writes){pending=null;return false;}
  if(pending?.awaiting&&text.trim()&&text.length<=1000){
   if(named.length){pending.centre=named.length===1?named[0]:undefined;pending.ambiguous=named.length>1;}
   pending.awaiting=false;return true;
  }
  pending=null;return false;
 };
 for(const entry of history){
  if(entry.role==='user'){
   const time=Date.parse(entry.created_at||'');
   if(!Number.isFinite(time)||now-time>30*60000){pending=null;continue;}
   accept(entry.content,time);
  }else if(entry.role==='assistant'&&active()){
   const actions=entry.metadata?.actions||entry.metadata?.reply?.actions||[];
   const proposals=entry.metadata?.proposals||entry.metadata?.reply?.proposals||[];
   if(actions.some((action:any)=>(WRITE_TOOLS.includes(action.tool)||operations.has(action.tool))&&action.status==='succeeded')||[...actions,...proposals].some((proposal:any)=>proposal.type==='change-review'&&pending?.tools.includes(proposal.operation)))pending=null;
   else if(pending)pending.awaiting=asksForDetails(entry.content)||actions.some((action:any)=>pending?.tools.includes(action.tool)&&action.status==='blocked');
  }
 }
 const direct=requestIntent(message),continuation=accept(message,now),named=centres(message);
 return {...direct,writes:direct.writes||continuation,allowedTools:pending?.tools||toolsFor(message),targetBranch:pending?.centre||(named.length===1?named[0]:undefined),ambiguousCentre:pending?.ambiguous||named.length>1,continuation,directive:pending?.directive};
}
