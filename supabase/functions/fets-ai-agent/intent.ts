import { WRITE_TOOLS } from './catalog.ts';

type Message={role:string;content:string;created_at?:string;metadata?:Record<string,any>};
type Pending={tools:string[];centre?:string;ambiguous:boolean;directive:string;startedAt:number;awaiting:boolean};
const question=/^\s*(?:please\s+)?(?:how|why|what|who|when|where|explain|summari[sz]e|show|list|read|find|compare|tell me)\b/i;
const cancellation=/\b(?:never mind|nevermind|forget (?:that|it)|cancel (?:that|this|it|the request)|stop (?:that|this|it)|not now|not yet|hold off|hold on|need to (?:check|confirm|ask)|check with|already (?:created|scheduled|done|saved))\b|\b(?:don['’]?t|do not|never)\s+(?:create|add|update|change|schedule|save|record)\b/i;
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
  ||(!command(message)&&cancellation.test(text));
}
function command(message:string){
 let text=commandText(message),match=text.match(/^(create|add|log|record|file|raise|schedule|book|save|update|change|edit|modify|assign|reschedule|move|cancel|close|mark|set)\b/i);
 if(!match&&question.test(text)){
  const follow=text.match(/\b(?:and|then|also)\s+(?:please\s+)?((?:create|add|log|record|raise|update|change|assign|schedule|close|mark|set)\b[\s\S]*)/i);
  if(follow){text=follow[1];match=text.match(/^(\w+)\b/);}
 }
 if(!match){
  const malayalam=text.match(/(സൃഷ്ടിക്ക(?:ുക)?|ചേർക്ക(?:ുക)?|രേഖപ്പെടുത്ത(?:ുക)?|മാറ്റുക|അപ്ഡേറ്റ്(?:\s+ചെയ്യുക)?)[.!]?$/);
  return malayalam?{mode:/മാറ്റുക|അപ്ഡേറ്റ്/.test(malayalam[1])?'update':'create',body:text.slice(0,malayalam.index)}:null;
 }
 const verb=match[1].toLowerCase(),body=text.slice(match[0].length);
 const update=/^(?:update|change|edit|modify|assign|reschedule|move|cancel|close|mark|set)$/.test(verb);
 return {mode:update?'update':'create',body,verb};
}
export function requestIntent(message:string){
 return {writes:!cancelled(message)&&Boolean(command(message)),memory:/\b(remember|memorise|memorize|save.{0,30}(?:memory|preference|instruction)|update.{0,30}memory)\b|ഓർമ്മ|ഓർക്ക/i.test(message)};
}
function centres(message:string){
 message=withoutReferences(message);
 return [/(?:\b(?:cochin|kochi|ernakulam)\b|കൊച്ചി|എറണാകുളം)/i.test(message)?'cochin':null,/(?:\b(?:calicut|kozhikode)\b|കോഴിക്കോട്|കാലിക്കറ്റ്)/i.test(message)?'calicut':null].filter((v):v is string=>Boolean(v));
}
function toolsFor(message:string,typedOnly=false){
 const action=command(message);if(!action)return [];
 const kinds=([{kind:'incident',pattern:/\b(?:case|incident)\b/i},{kind:'task',pattern:/\b(?:task|todo|to-do|reminder|actionable)\b/i},{kind:'session',pattern:/\b(?:session|exam|calendar|programme|program|booking)\b/i}]).map(({kind,pattern})=>{const match=pattern.exec(action.body);return {kind,index:match?.index??-1,end:match?match.index+match[0].length:0};}).filter(item=>item.index>=0).sort((a,b)=>a.index-b.index);
 const target=kinds[0],kind=target?.kind;if(typedOnly&&!kind)return [];
 const object=action.body.slice(0,target?.end);
 const mode=('verb' in action&&/^(?:add|record|save)$/.test(action.verb)&&/\b(?:existing|note|comment)\b/i.test(object))?'update':action.mode;
 return WRITE_TOOLS.filter(tool=>tool.startsWith(mode+'_')&&(!kind||tool.endsWith('_'+kind)));
}
function asksForDetails(text:string){
 return /\b(?:what|which|who|when|where|how many|provide|specify|tell me|enter|need|missing|confirm|supply)\b/i.test(text)
  &&/\b(?:exam|programme|program|name|centre|center|client|date|day|time|candidates?|count|title|description|detail|severity|category|priority|assignee|assign|status|record|session|happened|ID)\b/i.test(text);
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
   if(actions.some((action:any)=>WRITE_TOOLS.includes(action.tool)&&action.status==='succeeded'))pending=null;
   else if(pending)pending.awaiting=asksForDetails(entry.content)||actions.some((action:any)=>pending?.tools.includes(action.tool)&&action.status==='blocked');
  }
 }
 const direct=requestIntent(message),continuation=accept(message,now),named=centres(message);
 return {...direct,writes:direct.writes||continuation,allowedTools:pending?.tools||toolsFor(message),targetBranch:pending?.centre||(named.length===1?named[0]:undefined),ambiguousCentre:pending?.ambiguous||named.length>1,continuation,directive:pending?.directive};
}
