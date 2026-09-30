/** Centre duty planning. All minutes are India-local minutes since midnight. */
export const LANES = ['front', 'floor', 'control'] as const;
export type Lane = typeof LANES[number];
export const laneInfo = {
  front: { title: 'Front office', purpose: 'A calm, clear welcome for every candidate.', tasks: 'ID checks · instructions · lockers · candidate calling', color: 'peach' },
  floor: { title: 'Scanning & lab', purpose: 'Keep the exam floor supported and observed.', tasks: 'Frisking · scanning · seat allocation · lab walk every 10 min', color: 'sage' },
  control: { title: 'Check-in & DVR', purpose: 'Keep test delivery and monitoring on track.', tasks: 'Candidate verification · launch exam · DVR check every 6 min', color: 'lilac' },
};
export type TeamMember = { id: string; name: string; userId: string; code: string };
export type Availability = { staff: string; start: number; end: number; confirmed: boolean };
export type DutyBlock = { start: number; end: number; owners: Record<Lane, string>; duties: Record<Lane, string> };
export type BreakCover = { staff: string; start: number; end: number; cover: string; note: string };
export type DayPlan = { availability: Availability[]; blocks: DutyBlock[]; breaks: BreakCover[]; actingLead: string };
export type PlanRecord = { id: string; branch: string; day: string; lead_id: string; plan: DayPlan; status: 'draft' | 'published'; version: number };
export type DutyEvent = { id: string; plan_id: string; block: number; lane: Lane; kind: 'walk' | 'dvr' | 'submit' | 'verify' | 'return' | 'support'; due: number; actor_id: string; note: string; created_at: string };
export type LeadWeek = { branch: string; week_start: string; lead_id: string; version: number };
export type CoverageChange = { id:string; plan_id:string; kind:'coverage'|'lead'; block:number|null; lane:Lane|null; staff_id:string; starts:number; ends:number; shift_start:number; shift_end:number; reason:string; actor_id:string; created_at:string };
export function resolvedOwner(plan:DayPlan, block:number, lane:Lane, time:number, changes:CoverageChange[]=[]) {
  const matches=changes.filter(c=>c.kind==='coverage'&&c.block===block&&c.lane===lane&&c.starts<=time&&c.ends>time);
  return matches[matches.length-1]?.staff_id || ownerAt(plan,plan.blocks[block],lane,time);
}
export function ownedBlock(plan:DayPlan,block:number,lane:Lane,staff:string,changes:CoverageChange[]=[]) {
  for(let t=plan.blocks[block].start;t<plan.blocks[block].end;t++)if(resolvedOwner(plan,block,lane,t,changes)===staff)return true;
  return false;
}
export type DutyReport = { id: string; branch: string; day: string; plan_id: string; summary: string; followups: string; recognition: string; created_at: string; acknowledged_at: string | null; snapshot: { events: DutyEvent[]; plan: DayPlan; changes?:CoverageChange[] } };
export const REST = new Set(['RD','OFF','WO','L','LEAVE','LV','H','HOLIDAY','TO','TOIL','TR','TP','T','PH','TRD']);
export const working = (code: string) => Boolean(code) && !REST.has(code.toUpperCase());
export const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
export const minutes = (time: string) => { const [h,m] = time.split(':').map(Number); return h * 60 + m; };
export const monday = (day: string) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0,10); };
export const monthWeeks = (month: string) => {
  const start = new Date(`${month}-01T12:00:00Z`); const weeks = new Set<string>();
  while (start.toISOString().startsWith(month)) { weeks.add(monday(start.toISOString().slice(0,10))); start.setUTCDate(start.getUTCDate()+1); }
  return [...weeks];
};
export function createDayPlan(team: TeamMember[]): DayPlan {
  const ids = team.slice(0,3).map(p=>p.id);
  // The final block follows the supplied centre timetable, including its repeated floor owner.
  const order = [[0,1,2],[1,2,0],[2,0,1],[0,1,2],[1,2,0],[2,0,1]];
  const extras = [
    ['Database · morning','','CELPIP download / RMA'],
    ['Calendar update','','Candidate calling'],
    ['CPR','',''],
    ['Database · noon','','CELPIP download'],
    ['Print & recheck · inventory','',''],
    ['CPR · locker key check','Windows update status','Calling · RMA / results'],
  ];
  return { actingLead: '', availability: team.map(p=>({staff:p.id,start:480,end:1020,confirmed:false})), blocks: order.map((o,i)=>({ start:480+i*90,end:570+i*90,owners:{front:ids[o[0]]||'',floor:ids[o[1]]||'',control:ids[o[2]]||''},duties:{front:extras[i][0],floor:extras[i][1],control:extras[i][2]}})), breaks:ids.flatMap((staff,i)=>[600+i*30,840+i*30].map(start=>({staff,start,end:start+30,cover:'',note:''}))).sort((a,b)=>a.start-b.start) };
}
export const available = (plan: DayPlan, id: string, start: number, end = start+1) => plan.availability.some(a=>a.staff===id && a.confirmed && a.start<=start && a.end>=end);
export function ownerAt(plan: DayPlan, block: DutyBlock, lane: Lane, time: number) {
  const owner = block.owners[lane]; const pause = plan.breaks.find(b=>b.staff===owner && b.start<=time && time<b.end);
  return pause ? pause.cover : owner;
}
export function validatePlan(plan: DayPlan, roster: TeamMember[], lead: string): string[] {
  const issues = new Set<string>(); const names = new Map(roster.map(p=>[p.id,p.name]));
  if (!lead || !names.has(lead)) issues.add('Choose a rostered lead or an acting lead for this day.');
  if (plan.blocks.length !== 6) issues.add('The day needs all six 90-minute blocks.');
  if (new Set(plan.availability.map(a=>a.staff)).size !== plan.availability.length) issues.add('Each person needs one availability window.');
  for (const a of plan.availability) if (!names.has(a.staff) || !a.confirmed || a.start>=a.end) issues.add(`${names.get(a.staff)||'A team member'}: confirm actual shift hours from the roster.`);
  for (const [i,b] of plan.blocks.entries()) {
    if (b.start!==480+i*90 || b.end!==570+i*90) issues.add('Rotation blocks must cover 08:00–17:00 without gaps.');
    if (new Set(Object.values(b.owners)).size!==3) issues.add(`${clock(b.start)}: assign three different primary owners.`);
    for (const lane of LANES) {
      const id = b.owners[lane];
      if (!names.has(id) || !available(plan,id,b.start,b.end)) issues.add(`${clock(b.start)} · ${laneInfo[lane].title}: owner is missing or outside confirmed shift hours.`);
    }
  }
  for (const pause of plan.breaks) {
    if (pause.end-pause.start!==30 || !available(plan,pause.staff,pause.start,pause.end)) issues.add('Each break must fit the person’s confirmed shift and last 30 minutes.');
    if (!names.has(pause.cover) || pause.cover===pause.staff || !available(plan,pause.cover,pause.start,pause.end)) issues.add(`${names.get(pause.staff)||'Staff'} · ${clock(pause.start)}: name an available break cover.`);
    if (plan.breaks.some(other=>other!==pause && [pause.staff,pause.cover].includes(other.staff) && other.start<pause.end && other.end>pause.start)) issues.add(`${clock(pause.start)}: a break overlaps another break or the cover person’s break.`);
    if (!pause.note.trim()) issues.add(`${clock(pause.start)}: explain how the cover person will balance both duties.`);
  }
  for (const id of new Set(plan.blocks.flatMap(b=>Object.values(b.owners)))) if (id && plan.breaks.filter(b=>b.staff===id).length!==2) issues.add(`${names.get(id)||'Staff'}: plan both breaks.`);
  return [...issues];
}
export function checkpoints(plan: DayPlan, changes:CoverageChange[]=[]) {
  return plan.blocks.flatMap((b,block)=>(['floor','control'] as const).flatMap(lane=>{
    const interval = lane==='floor'?10:6;
    return Array.from({length:90/interval},(_,i)=>{ const due=b.start+(i+1)*interval; return {block,lane,kind:lane==='floor'?'walk' as const:'dvr' as const,due,owner:resolvedOwner(plan,block,lane,due-1,changes)}; });
  }));
}
export function blockReview(events: DutyEvent[], block: number, lane: Lane) {
  const rows = events.filter(e=>e.block===block && e.lane===lane && ['submit','verify','return'].includes(e.kind));
  return rows[rows.length-1]?.kind || 'pending';
}
/** Published plans are historical agreements. Validate remaining coverage after amendments. */
export function validateRemainingCoverage(plan:DayPlan,team:TeamMember[],changes:CoverageChange[],lead:string,from=480):string[] {
  if(from>=1020)return [];
  const issues=new Set<string>();const ids=new Set(team.map(p=>p.id));
  if(!ids.has(lead))issues.add('The current lead is not on this day’s working roster. Arrange an acting lead.');
  plan.blocks.forEach((b,block)=>LANES.forEach(lane=>{
    for(let t=Math.max(from,b.start);t<b.end;t++){
      const id=resolvedOwner(plan,block,lane,t,changes);
      const updates=changes.filter(c=>c.kind==='coverage'&&c.block===block&&c.lane===lane&&c.starts<=t&&c.ends>t);
      const c=updates[updates.length-1];const present=c?c.shift_start<=t&&c.shift_end>t:available(plan,id,t,t+1);
      if(!ids.has(id)||!present){issues.add(`Block ${block+1} · ${laneInfo[lane].title}: coverage needs attention from ${clock(t)}.`);break;}
    }
  }));
  return [...issues];
}
