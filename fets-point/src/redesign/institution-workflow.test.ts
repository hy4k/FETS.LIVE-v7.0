import {describe,it,expect} from 'vitest';
import {dueInIST,localIST,dueLabel,DISTRICTS,DEFAULT_STAGES} from './institution-workflow';
describe('institution duty dates and starting workflow',()=>{
 it('stores Indian wall time independently of the browser timezone',()=>{expect(dueInIST('2026-10-03','09:30')).toBe('2026-10-03T04:00:00.000Z');expect(localIST('2026-10-02T20:45:00Z')).toEqual({date:'2026-10-03',time:'02:15'});});
 it('keeps date-only duties free of an invented due time',()=>{expect(dueInIST('2026-10-03','')).toBeNull();expect(dueLabel('2026-10-03',null)).not.toContain('IST');});
 it('rejects impossible dates and times without a date',()=>{expect(()=>dueInIST('2026-02-30','10:00')).toThrow();expect(()=>dueInIST('','10:00')).toThrow();expect(()=>dueInIST('2026-10-03','24:01')).toThrow();});
 it('does not mistake approval for the final handover stage',()=>{expect(DEFAULT_STAGES.findIndex(s=>s.stage_key==='approval')).toBeLessThan(DEFAULT_STAGES.findIndex(s=>s.stage_key==='handover'));expect(DEFAULT_STAGES.at(-1)?.instructions).toContain('final sign-off');expect(DISTRICTS).toHaveLength(5);});
});
