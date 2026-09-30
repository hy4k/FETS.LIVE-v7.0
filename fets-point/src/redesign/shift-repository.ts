import { supabase } from '../lib/supabase';
import { isStaffRosterVisible } from '../utils/rosterVisibility';
import { monday, working, type TeamMember, type PlanRecord, type LeadWeek, type DutyEvent, type DutyReport, type DayPlan, type CoverageChange } from './shift-plan';
const db = supabase as any;
const checked = (result: any) => { if (result.error) throw new Error(result.error.message); return result.data; };
export const shiftRepository = {
  async roster(branch: string, day: string): Promise<TeamMember[]> {
    const rows = checked(await db.from('roster_schedules').select('profile_id,shift_code,branch_location,staff_profiles(id,user_id,full_name,branch_assigned,permissions,is_active)').eq('date',day));
    const people = new Map<string,TeamMember>();
    for (const row of rows || []) {
      const p = row.staff_profiles;
      if (p && p.is_active!==false && isStaffRosterVisible(p,day.slice(0,7)) && working(row.shift_code) && String(row.branch_location||p.branch_assigned||'').toLowerCase()===branch.toLowerCase()) people.set(p.id,{id:p.id,userId:p.user_id,name:p.full_name,code:row.shift_code});
    }
    return [...people.values()].sort((a,b)=>a.name.localeCompare(b.name));
  },
  async monthRoster(branch: string, month: string): Promise<Record<string,TeamMember[]>> {
    const end = new Date(`${month}-01T12:00:00Z`); end.setUTCMonth(end.getUTCMonth()+1);
    const rows = checked(await db.from('roster_schedules').select('date,profile_id,shift_code,branch_location,staff_profiles(id,user_id,full_name,branch_assigned,permissions,is_active)').gte('date',`${month}-01`).lt('date',end.toISOString().slice(0,10)));
    const result:Record<string,TeamMember[]> = {};
    for (const row of rows||[]) {
      const p=row.staff_profiles;
      if (p && p.is_active!==false && isStaffRosterVisible(p,month) && working(row.shift_code) && String(row.branch_location||p.branch_assigned||'').toLowerCase()===branch.toLowerCase()) {
        result[row.date] ||= [];
        if (!result[row.date].some(x=>x.id===p.id)) result[row.date].push({id:p.id,userId:p.user_id,name:p.full_name,code:row.shift_code});
      }
    }
    return result;
  },
  async load(branch:string,day:string) {
    const [plan,week] = await Promise.all([
      db.from('centre_day_plans').select('*').eq('branch',branch).eq('day',day).maybeSingle(),
      db.from('centre_lead_weeks').select('*').eq('branch',branch).eq('week_start',monday(day)).maybeSingle(),
    ]);
    const record = checked(plan) as PlanRecord|null; const lead = checked(week) as LeadWeek|null;
    if(!record)return {record,lead,events:[] as DutyEvent[],changes:[] as CoverageChange[],closed:false};
    const [eventRows,changeRows,reportRow]=await Promise.all([
      db.from('centre_duty_events').select('*').eq('plan_id',record.id).order('created_at'),
      db.from('centre_duty_changes').select('*').eq('plan_id',record.id).order('created_at').order('id'),
      db.from('centre_duty_reports').select('id').eq('plan_id',record.id).maybeSingle(),
    ]);
    return {record,lead,events:checked(eventRows) as DutyEvent[],changes:checked(changeRows) as CoverageChange[],closed:Boolean(checked(reportRow))};
  },
  async savePlan(branch:string,day:string,leadId:string,plan:DayPlan,previous:PlanRecord|null,publish=false):Promise<PlanRecord> {
    const value = {branch,day,lead_id:leadId||null,plan,status:publish?'published':'draft'};
    const query = previous ? db.from('centre_day_plans').update(value).eq('id',previous.id).eq('version',previous.version) : db.from('centre_day_plans').insert(value);
    const rows=checked(await query.select());
    if (!rows?.[0]) throw new Error('This plan changed elsewhere. Reload before saving.');
    return rows[0];
  },
  async leads(branch:string,from:string,to:string):Promise<LeadWeek[]> { return checked(await db.from('centre_lead_weeks').select('*').eq('branch',branch).gte('week_start',from).lte('week_start',to))||[]; },
  async saveLead(branch:string,week:string,leadId:string,previous?:LeadWeek):Promise<LeadWeek> {
    const value={branch,week_start:week,lead_id:leadId};
    const query=previous?db.from('centre_lead_weeks').update(value).eq('branch',branch).eq('week_start',week).eq('version',previous.version):db.from('centre_lead_weeks').insert(value);
    const rows=checked(await query.select()); if (!rows?.[0]) throw new Error('This lead assignment changed elsewhere. Reload before saving.'); return rows[0];
  },
  async event(input:Pick<DutyEvent,'plan_id'|'block'|'lane'|'kind'|'due'|'note'>) { return checked(await db.from('centre_duty_events').insert(input).select().single()) as DutyEvent; },
  async reports(branch:string,month:string):Promise<DutyReport[]> {
    const end=new Date(`${month}-01T12:00:00Z`);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
    let q=db.from('centre_duty_reports').select('*').gte('day',`${month}-01`).lte('day',end.toISOString().slice(0,10)).order('day',{ascending:false});
    if(branch!=='global')q=q.eq('branch',branch);
    return checked(await q)||[];
  },
  async report(plan:PlanRecord,summary:string,followups:string,recognition:string) { return checked(await db.from('centre_duty_reports').insert({plan_id:plan.id,branch:plan.branch,day:plan.day,summary,followups,recognition}).select().single()) as DutyReport; },
  async change(input:Pick<CoverageChange,'plan_id'|'kind'|'block'|'lane'|'staff_id'|'starts'|'ends'|'shift_start'|'shift_end'|'reason'>):Promise<CoverageChange> { return checked(await db.from('centre_duty_changes').insert(input).select().single()); },
  async acknowledge(id:string) { checked(await db.from('centre_duty_reports').update({acknowledged_at:new Date().toISOString()}).eq('id',id).select().single()); },
};
export type ShiftRepository = typeof shiftRepository;
