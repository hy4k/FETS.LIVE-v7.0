import { checkpoints, resolvedOwner, type CoverageChange, type DayPlan, type DutyEvent, type Lane } from './shift-plan';
import type { ListItem } from './shift-blueprint';

/** Keep the board on the same published rota and checkpoint rules as the log. */
export function currentDuty(plan: DayPlan, changes: CoverageChange[], minute: number, person: string) {
  const block = plan.blocks.findIndex(b => minute >= b.start && minute < b.end);
  const lanes = block < 0 ? [] : (['front', 'floor', 'control'] as Lane[])
    .filter(lane => resolvedOwner(plan, block, lane, minute, changes) === person);
  return { block, lanes, ends: block < 0 ? null : plan.blocks[block].end };
}

export function personChecks(plan: DayPlan, changes: CoverageChange[], events: DutyEvent[], minute: number, person: string) {
  return checkpoints(plan, changes).filter(p => p.owner === person)
    .filter(p => !events.some(e => e.block === p.block && e.lane === p.lane && e.kind === p.kind && e.due === p.due))
    .map(p => ({ ...p, state: minute < p.due ? 'upcoming' : minute < p.due + (p.kind === 'walk' ? 10 : 6) ? 'due' : 'missed' } as const));
}

export const isVerified = (item: ListItem) => item.status === 'done' && Boolean(item.task?.verified_at && item.task?.verified_by);

/** Short labels only; saved wording and instructions are never overwritten. */
const SHORT_TITLES: Record<string, string> = {
  'Provider schedules checked': 'Check exam schedules',
  'Database update · morning and noon': 'Update records: morning & noon',
  'Calendar update in fets.live': 'Update calendar',
  'Tomorrow’s candidates called': 'Call tomorrow’s candidates',
  'Center Problem Reports filed': 'File problem reports (CPR)',
  'Internet and backup line': 'Check internet & backup',
  'Windows updates on test PCs': 'Check Windows updates',
  'CCTV and DVR retention': 'Check CCTV & saved footage',
  'Workstation faults followed up': 'Follow up PC faults',
  'Print, recheck and inventory': 'Check printing & stock',
  'Office supplies reorder': 'Order supplies',
  'Enquiries answered': 'Answer enquiries',
  'Results and score report calls': 'Help with results',
  'Google reviews replied': 'Reply to reviews',
  'Roster and attendance up to date': 'Update roster & attendance',
  'Mock test and fets.in bookings': 'Confirm mock-test bookings',
};
export const shortDutyTitle = (title: string) => SHORT_TITLES[title] ?? title;
