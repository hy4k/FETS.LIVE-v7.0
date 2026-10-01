import { describe, it, expect } from 'vitest';
import { missionSummary, MISSION_DISTRICTS, MISSION_DEADLINE } from './MissionWorkspace';
describe('shared mission reporting',()=>{
 it('counts approved institutions separately from work completed',()=>{expect(missionSummary([{stage:'identified'},{stage:'pearson_approved'}],[{status:'done'},{status:'blocked'},{status:'in_progress'}])).toEqual({shortlisted:2,approved:1,active:2,blocked:1,done:1});});
 it('does not seed progress or allocate invented district quotas',()=>{expect(missionSummary([],[])).toEqual({shortlisted:0,approved:0,active:0,blocked:0,done:0});expect(MISSION_DISTRICTS).toEqual(['Kottayam','Ernakulam','Thrissur','Calicut','Kannur']);expect(MISSION_DEADLINE).toBe('2026-11-30');});
});
