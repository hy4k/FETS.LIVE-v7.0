import { describe, expect, it } from 'vitest';
import { closestCentres, myNextSteps, changesSince, istToday } from './mission-workplace';
describe('daily shared workplace', () => {
 it('puts overdue personal work before future or undated work and excludes others and completed work', () => {
  const tasks = [{id:'later',owner_id:'me',status:'open',due_date:'2026-10-05',created_at:'2026-10-01'}, {id:'old',owner_id:'me',status:'blocked',due_date:'2026-09-30',created_at:'2026-09-29'}, {id:'none',owner_id:'me',status:'open',created_at:'2026-09-20'}, {id:'done',owner_id:'me',status:'done',due_date:'2026-09-01'}, {id:'other',owner_id:'other',status:'open',due_date:'2026-09-01'}];
  expect(myNextSteps(tasks,'me').map(t=>t.id)).toEqual(['old','later','none']);expect(myNextSteps(tasks)).toEqual([]);
 });
 it('ranks by recorded centre stage, not task volume or a made-up completion percentage', () => {
  const result=closestCentres([{id:'a',name:'A',stage:'contacted'},{id:'b',name:'B',stage:'pearson_approved'},{id:'c',name:'C',stage:'unknown'}],[{institution_id:'a',status:'done'},{institution_id:'b',status:'blocked'}]);
  expect(result.map(c=>c.id)).toEqual(['b','a','c']);expect(result[0].remaining).toHaveLength(1);expect(result[0]).not.toHaveProperty('delivered');
 });
 it('keeps the visit boundary stable and excludes replies from top-level change counts', () => {
  const since='2026-10-01T06:00:00Z';expect(changesSince([{id:1,created_at:since},{id:2,created_at:'2026-10-01T06:01:00Z'},{id:3,parent_id:'parent',created_at:'2026-10-01T06:02:00Z'},{id:4,created_at:'2026-09-29T06:00:00Z',last_activity_at:'2026-10-01T06:03:00Z'}],since).map(p=>p.id)).toEqual([2,4]);expect(changesSince([{created_at:since}],null)).toEqual([]);
 });
 it('uses the Indian day at the UTC date boundary',()=>{expect(istToday(new Date('2026-10-01T19:00:00Z'))).toBe('2026-10-02');});
});
