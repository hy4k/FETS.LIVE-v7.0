import { describe, expect, it } from 'vitest';
import { createDayPlan } from './shift-plan';
import { currentDuty, personChecks, shortDutyTitle } from './shift-board';

const plan = createDayPlan(['a', 'b', 'c'].map(id => ({ id, userId: id, name: id, code: 'D' })));
plan.breaks = [];
describe('the simple board uses the published rotation', () => {
  it('changes roles at the 90-minute boundary without moving the ending check to the new owner', () => {
    expect(currentDuty(plan, [], 569, 'a').lanes).toEqual(['front']);
    expect(currentDuty(plan, [], 570, 'a').lanes).toEqual(['control']);
    expect(personChecks(plan, [], [], 570, 'c')).toContainEqual(expect.objectContaining({ block: 0, kind: 'dvr', due: 570, state: 'due' }));
    expect(personChecks(plan, [], [], 570, 'a').some(c => c.due === 570)).toBe(false);
  });
  it('shows six-minute DVR and ten-minute walks without backfilling missed checks', () => {
    expect(personChecks(plan, [], [], 490, 'b')[0]).toMatchObject({ kind: 'walk', due: 490, state: 'due' });
    expect(personChecks(plan, [], [], 490, 'c')[0]).toMatchObject({ kind: 'dvr', due: 486, state: 'due' });
    expect(personChecks(plan, [], [], 492, 'c')[0].state).toBe('missed');
    const event = { block: 0, lane: 'control', kind: 'dvr', due: 486 } as any;
    expect(personChecks(plan, [], [event], 490, 'c').some(c => c.due === 486)).toBe(false);
  });
  it('uses temporary cover and returns to the original owner', () => {
    const changes = [{ kind: 'coverage', block: 0, lane: 'floor', staff_id: 'a', starts: 490, ends: 510 }] as any;
    expect(currentDuty(plan, changes, 500, 'a').lanes).toEqual(['front', 'floor']);
    expect(personChecks(plan, changes, [], 500, 'a')).toContainEqual(expect.objectContaining({ kind: 'walk', due: 500, state: 'due' }));
    expect(currentDuty(plan, changes, 510, 'b').lanes).toEqual(['floor']);
  });
  it('does not invent a current post outside operating hours or rewrite custom jobs', () => {
    expect(currentDuty(plan, [], 1020, 'a').lanes).toEqual([]);
    expect(shortDutyTitle('Tomorrow’s candidates called')).toBe('Call tomorrow’s candidates');
    expect(shortDutyTitle('Custom equipment inspection')).toBe('Custom equipment inspection');
  });
});
