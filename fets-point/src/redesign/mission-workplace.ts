export const CENTRE_STAGES = ['identified', 'contacted', 'audit_in_progress', 'mou_review', 'pearson_approved'];
export const CENTRE_STAGE_LABELS: Record<string, string> = { identified: 'Shortlisted', contacted: 'In conversation', audit_in_progress: 'Site review', mou_review: 'Agreement review', pearson_approved: 'Pearson approved' };
export function istToday(now = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function myNextSteps(tasks: any[], profileId?: string) {
  if (!profileId) return [];
  return tasks.filter(t => t.owner_id === profileId && t.status !== 'done').sort((a,b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || a.created_at.localeCompare(b.created_at));
}
export function closestCentres(institutions: any[], tasks: any[]) {
  return institutions.map(i => ({...i, stageIndex:CENTRE_STAGES.indexOf(i.stage), remaining: tasks.filter(t=>t.institution_id===i.id&&t.status!=='done'), wins:tasks.filter(t=>t.institution_id===i.id&&t.status==='done').length}))
    .sort((a,b)=> b.stageIndex-a.stageIndex || a.name.localeCompare(b.name));
}
export function changesSince(posts: any[], since?: string | null) { return since ? posts.filter(p=>!p.parent_id && Date.parse(p.last_activity_at || p.created_at)>Date.parse(since)) : []; }
