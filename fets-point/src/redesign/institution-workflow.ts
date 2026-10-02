export const DISTRICTS = ['Kottayam', 'Ernakulam', 'Thrissur', 'Calicut', 'Kannur'] as const;
export const PEARSON_REQUIREMENTS_URL = 'https://www.pearsonvue.com/us/en/test-centers/become-a-test-center.html';
export const DEFAULT_STAGES = [
  {stage_key:'identify',title:'Identify an institution',instructions:'Search within the selected district and nearby towns. Try “engineering college computer lab {district} Kerala”, “polytechnic college {district} placement officer contact”, or “training institute computer lab {district}”. Check the institution’s own website and map listing. Record the full postal address, website, office phone/email and a named contact or the office to approach. Do not assume a lab is suitable from a listing. Update the institution details here; record the source links and what still needs checking in your duty result.',contact_script:''},
  {stage_key:'approach',title:'Contact and approach',instructions:'Start with the principal, director, administrator, placement officer or facilities decision-maker. Call the published office number to identify the correct person. Introduce FETS, explain that this is an exploratory discussion, and ask about interest and an introductory meeting. Record the person’s name, role, preferred contact method, response and agreed follow-up date here. Inform the reporting person named on your duty after saving the result.',contact_script:'Hello, I’m [name] from FETS. We are exploring potential institutions in [district] for a Pearson VUE test-centre project. May I speak with the person responsible for partnerships or computer-lab facilities? We would like to understand your interest and arrange an introductory discussion. Any proposal would depend on the site review, agreed responsibilities and Pearson VUE approval. What would be a convenient time, and which email should we use?'},
  {stage_key:'assess',title:'Visit and assess the site',instructions:'Arrange a visit with the institution’s decision-maker and IT contact. Review the current Pearson VUE facility and technical requirements using the official link below. Record the available space, lab access, equipment, connectivity, power, security arrangements and staffing. Capture evidence links with permission, list gaps, and assign a named owner and due date for each follow-up. Save the findings here and report the recommendation to the person assigned on your duty.',contact_script:''},
  {stage_key:'agree',title:'Agree responsibilities',instructions:'Review the findings with FETS management and the institution. Document who would provide the space, equipment, connectivity, staffing and ongoing support. Record open questions, proposed costs and who can approve the arrangement. Obtain the required FETS management review before making commitments. Save the approved discussion notes or document link here; do not treat a discussion or draft as an agreement.',contact_script:''},
  {stage_key:'approval',title:'Submit and follow up on approval',instructions:'With the FETS project owner, confirm the appropriate Pearson VUE application route and the current required documents. Submit accurate details through the agreed official channel. Record the application reference, submission date, responsible contact, requested corrections and next follow-up. Save approval evidence when it is received. A submitted application is not an approval.',contact_script:''},
  {stage_key:'setup',title:'Set up and validate',instructions:'After the necessary approvals and agreements, assign the remaining setup work to named staff. Follow current Pearson VUE installation, facility and administrator guidance; coordinate validation with the relevant support contact. Record training, trial/validation results and unresolved issues. Save evidence and next actions here. Do not mark this stage complete while required setup or validation work remains open.',contact_script:''},
  {stage_key:'handover',title:'Hand over and confirm delivery',instructions:'Ask the FETS project owner to review the approval evidence, agreed responsibilities, completed setup, staff readiness and validation results. Record the operating contact, handover date, support arrangements and any agreed follow-ups. Save the owner’s final sign-off evidence in the stage completion note. Count this centre as delivered only after that confirmation; Pearson approval alone does not confirm delivery.',contact_script:''},
];
export function localIST(value?: string | null) {
  if (!value) return {date:'',time:''};
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return {date:'',time:''};
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const get = (type:string) => parts.find(p=>p.type===type)?.value || '';
  return {date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`};
}
export function dueInIST(date:string,time:string) {
  if (!date) { if(time) throw new Error('Choose a date for the time.'); return null; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('Enter a valid date and time.');
  const parsed = new Date(`${date}T${time || '00:00'}:00+05:30`);
  if (!Number.isFinite(parsed.getTime()) || localIST(parsed.toISOString()).date !== date) throw new Error('Enter a valid calendar date.');
  return time ? parsed.toISOString() : null;
}
export function dueLabel(date?:string|null,at?:string|null) {
  const parts = localIST(at); const day = parts.date || date;
  if (!day) return 'No due date';
  return `${new Date(`${day}T12:00:00+05:30`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})}${parts.time ? ` · ${parts.time} IST` : ''}`;
}
export const STAGE_GUIDE_NOTE = 'FETS working guide. Check current Pearson VUE requirements before technical decisions or submissions.';
