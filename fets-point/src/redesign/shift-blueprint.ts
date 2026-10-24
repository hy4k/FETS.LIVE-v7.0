/**
 * The Shift: the centre blueprint and the day's task list.
 *
 * The blueprint says who owns every standing job in the centre, from exam
 * delivery to office supplies and business development, with a backup. Each
 * day the jobs due that day become the day's list: the owner does it when they
 * are on the roster, otherwise the backup, otherwise the lead must pick
 * someone. Pure functions only; the page and its tests read the same answers.
 */
export const AREAS = [
  { key: 'exam', title: 'Exam delivery', blurb: 'Opening, provider systems, candidates and closing', color: 'sage' },
  { key: 'infrastructure', title: 'Infrastructure & IT', blurb: 'Test PCs, network, power, CCTV and safety', color: 'sky' },
  { key: 'office', title: 'Office & supplies', blurb: 'Stock, printing, cleanliness and keys', color: 'sand' },
  { key: 'candidates', title: 'Candidates & public relations', blurb: 'Enquiries, results, reviews and social media', color: 'peach' },
  { key: 'reports', title: 'Reports & compliance', blurb: 'Provider reports, records and summaries', color: 'lilac' },
  { key: 'growth', title: 'Business development', blurb: 'Institutions, new exams and bookings', color: 'gold' },
] as const;
export type AreaKey = typeof AREAS[number]['key'];
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'as_needed';
export const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: 'daily', label: 'Every working day' },
  { key: 'weekly', label: 'Once a week' },
  { key: 'monthly', label: 'Once a month' },
  { key: 'as_needed', label: 'When needed' },
];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type Responsibility = {
  id: string; branch: string; area: AreaKey; title: string; details: string;
  frequency: Frequency; weekday: number | null; monthday: number | null;
  owner_id: string | null; backup_id: string | null; position: number; active: boolean;
};
export type TaskStatus = 'open' | 'done' | 'blocked' | 'carried' | 'skipped';
export type DayTask = {
  id: string; branch: string; day: string; responsibility_id: string | null; title: string;
  assigned_to: string | null; status: TaskStatus; note: string; carried_from: string | null;
  done_by: string | null; done_at: string | null; created_at?: string;
  verified_by?: string | null; verified_at?: string | null;
};
/** A task on the day's list: saved, or due from the blueprint and not yet touched. */
export type ListItem = {
  key: string; task: DayTask | null; responsibility: Responsibility | null; title: string;
  area: AreaKey | null; assignee: string | null; status: TaskStatus; note: string;
  /** Why this person: their own job, standing in as backup, or chosen by the lead. */
  reason: 'owner' | 'backup' | 'lead' | 'unassigned';
};
export type ActionableDuty = {
  id: string; title: string; owner_id: string | null; status: string;
  due_date: string | null; due_at: string | null; institution?: { name?: string | null; district?: string | null } | null;
};

/** "frequency" in words, for the blueprint rows. */
export function frequencyLabel(r: Pick<Responsibility, 'frequency' | 'weekday' | 'monthday'>) {
  if (r.frequency === 'weekly') return `Every ${WEEKDAYS[(r.weekday ?? 1) - 1]}`;
  if (r.frequency === 'monthly') return `Monthly · day ${r.monthday ?? 1}`;
  if (r.frequency === 'as_needed') return 'When needed';
  return 'Daily';
}

/** Is this job due on the day? A monthly day past the month's end falls on its last day. */
export function dueOn(r: Pick<Responsibility, 'frequency' | 'weekday' | 'monthday' | 'active'>, day: string) {
  if (!r.active) return false;
  const d = new Date(`${day}T12:00:00Z`);
  if (r.frequency === 'daily') return true;
  if (r.frequency === 'weekly') return ((d.getUTCDay() + 6) % 7) + 1 === r.weekday;
  if (r.frequency === 'monthly') {
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    return d.getUTCDate() === Math.min(r.monthday ?? 1, last);
  }
  return false;
}

/** The owner when they are working, else the backup, else nobody yet. */
export function stand(r: Pick<Responsibility, 'owner_id' | 'backup_id'>, working: Set<string>) {
  if (r.owner_id && working.has(r.owner_id)) return { assignee: r.owner_id, reason: 'owner' as const };
  if (r.backup_id && working.has(r.backup_id)) return { assignee: r.backup_id, reason: 'backup' as const };
  return { assignee: null, reason: 'unassigned' as const };
}

/** The day's list: saved tasks first in their place, then what the blueprint makes due. */
export function dayList(responsibilities: Responsibility[], tasks: DayTask[], day: string, working: Set<string>): ListItem[] {
  const byResp = new Map(tasks.filter(t => t.responsibility_id).map(t => [t.responsibility_id!, t]));
  const items: ListItem[] = [];
  const order = (a: Responsibility, b: Responsibility) =>
    AREAS.findIndex(x => x.key === a.area) - AREAS.findIndex(x => x.key === b.area) || a.position - b.position || a.title.localeCompare(b.title);
  for (const r of [...responsibilities].sort(order)) {
    const saved = byResp.get(r.id);
    if (!saved && !dueOn(r, day)) continue;
    const auto = stand(r, working);
    const assignee = saved ? saved.assigned_to : auto.assignee;
    const reason = !assignee ? 'unassigned' : saved && saved.assigned_to !== auto.assignee ? 'lead' : auto.reason === 'unassigned' ? 'lead' : auto.reason;
    items.push({ key: `r:${r.id}`, task: saved ?? null, responsibility: r, title: r.title, area: r.area, assignee, status: saved?.status ?? 'open', note: saved?.note ?? '', reason });
  }
  for (const t of tasks.filter(t => !t.responsibility_id || !responsibilities.some(r => r.id === t.responsibility_id))) {
    items.push({ key: `t:${t.id}`, task: t, responsibility: null, title: t.title, area: null, assignee: t.assigned_to, status: t.status, note: t.note, reason: t.assigned_to ? 'lead' : 'unassigned' });
  }
  return items;
}

/** How far each person has got with the day's list. */
export function progress(items: ListItem[], person?: string) {
  const mine = items.filter(i => i.status !== 'carried' && i.status !== 'skipped' && (person === undefined || i.assignee === person));
  return { done: mine.filter(i => i.status === 'done').length, total: mine.length, blocked: mine.filter(i => i.status === 'blocked').length };
}

/** Actionables duties still open and due by the day, oldest first. */
export function actionablesDue(duties: ActionableDuty[], day: string) {
  return duties
    .filter(d => d.status !== 'done' && d.due_date && d.due_date <= day)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
}

export function nextDay(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * A first draft of the lead's report from what was recorded. The lead reads
 * it, corrects it after talking to the team, and submits.
 */
export function draftReport(input: {
  items: ListItem[]; names: (id: string | null) => string;
  checks: { recorded: number; expected: number; missed: number };
  actionables: ActionableDuty[];
}) {
  const { items, names, checks, actionables } = input;
  const all = progress(items);
  const reviewEnabled = items.some(i => i.task?.verified_at !== undefined);
  const awaitingReview = items.filter(i => i.status === 'done' && !i.task?.verified_at);
  const people = [...new Set(items.map(i => i.assignee).filter((x): x is string => Boolean(x)))];
  const done = people.map(p => {
    const list = items.filter(i => i.assignee === p && i.status === 'done').map(i => i.title);
    return list.length ? `${names(p)}: ${list.join('; ')}` : '';
  }).filter(Boolean);
  const summary = [
    `Tasks: ${all.done} of ${all.total} done.`,
    ...(reviewEnabled ? [`Reviews: ${all.done - awaitingReview.length} verified; ${awaitingReview.length} awaiting review.`] : []),
    `Exam floor checks: ${checks.recorded} of ${checks.expected} recorded${checks.missed ? `, ${checks.missed} missed` : ''}.`,
    ...done,
  ].join('\n');
  const open = items.filter(i => i.status === 'open' || i.status === 'blocked' || i.status === 'carried')
    .map(i => `${i.title} · ${names(i.assignee)}${i.status === 'blocked' ? ` · blocked: ${i.note}` : i.status === 'carried' ? ' · moved to tomorrow' : ''}`);
  const overdue = actionables.map(a => `Actionables: ${a.title}${a.institution?.name ? ` (${a.institution.name})` : ''} · ${names(a.owner_id)} · due ${a.due_date}`);
  const reviews = reviewEnabled ? awaitingReview.map(i => `${i.title} · ${names(i.assignee)} · awaiting review`) : [];
  const followups = [...open, ...reviews, ...overdue].join('\n') || 'None';
  return { summary, followups };
}

/** The report as plain text, to send on WhatsApp or by email. */
export function reportText(r: { branch: string; day: string; lead: string; summary: string; followups: string; recognition: string }) {
  const centre = r.branch.charAt(0).toUpperCase() + r.branch.slice(1);
  return [
    `FETS ${centre} · daily report · ${r.day}`,
    `Lead: ${r.lead}`,
    '', 'TODAY', r.summary,
    '', 'CARRY INTO TOMORROW', r.followups,
    ...(r.recognition.trim() ? ['', 'THANK YOU, TEAM', r.recognition] : []),
  ].join('\n');
}

/** A starting blueprint for a FETS centre. Owners are left for the lead to choose. */
export const TEMPLATE: Omit<Responsibility, 'id' | 'branch' | 'owner_id' | 'backup_id' | 'position' | 'active'>[] = [
  { area: 'exam', title: 'Open the centre', details: 'Systems on, lab ready, CCTV and DVR recording, today’s schedule printed.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'exam', title: 'Provider schedules checked', details: 'Prometric, Pearson VUE, PSI, CELPIP and ITTS rosters match the fets.live calendar.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'exam', title: 'CELPIP downloads and RMA', details: 'Download the day’s tests; raise any RMA before candidates arrive.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'exam', title: 'Database update · morning and noon', details: 'Candidate records updated twice a day.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'exam', title: 'Calendar update in fets.live', details: 'Upload or correct the coming days so fets.online pulls the right list.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'exam', title: 'Tomorrow’s candidates called', details: 'Reminder calls or WhatsApp: time, ID and what to bring.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'exam', title: 'Center Problem Reports filed', details: 'Any CPR raised the same day, with the provider reference saved.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'exam', title: 'Close the centre', details: 'Systems shut down, locker keys counted, lab and office locked.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'infrastructure', title: 'Internet and backup line', details: 'Main and backup connections tested before the first exam.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'infrastructure', title: 'Windows updates on test PCs', details: 'Status checked; updates scheduled outside exam hours.', frequency: 'weekly', weekday: 1, monthday: null },
  { area: 'infrastructure', title: 'UPS, inverter and generator', details: 'Battery health, fuel and a short switchover test.', frequency: 'weekly', weekday: 3, monthday: null },
  { area: 'infrastructure', title: 'CCTV and DVR retention', details: 'Every camera recording; footage kept for the required period.', frequency: 'weekly', weekday: 5, monthday: null },
  { area: 'infrastructure', title: 'AC, lighting and fire safety', details: 'Air conditioning, lights, extinguishers and exits checked.', frequency: 'monthly', weekday: null, monthday: 1 },
  { area: 'infrastructure', title: 'Workstation faults followed up', details: 'Faulty seats logged and chased until fixed.', frequency: 'as_needed', weekday: null, monthday: null },
  { area: 'office', title: 'Cleanliness', details: 'Lab, waiting area and washroom ready before candidates arrive.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'office', title: 'Locker key check', details: 'Every key accounted for at opening and closing.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'office', title: 'Print, recheck and inventory', details: 'Scratch paper, forms and consumables counted.', frequency: 'weekly', weekday: 6, monthday: null },
  { area: 'office', title: 'Office supplies reorder', details: 'Stationery, printer ink, water and cleaning items.', frequency: 'weekly', weekday: 5, monthday: null },
  { area: 'office', title: 'Petty cash and expenses', details: 'Receipts filed and the expense log balanced.', frequency: 'weekly', weekday: 6, monthday: null },
  { area: 'candidates', title: 'Enquiries answered', details: 'Walk-ins, calls and WhatsApp answered the same day.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'candidates', title: 'Results and score report calls', details: 'Candidates told how and when to find results.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'candidates', title: 'Google reviews replied', details: 'Thank every reviewer; follow up any concern.', frequency: 'weekly', weekday: 2, monthday: null },
  { area: 'candidates', title: 'Social media post', details: 'One helpful post: exam dates, tips or a centre moment.', frequency: 'weekly', weekday: 4, monthday: null },
  { area: 'candidates', title: 'Complaints and feedback', details: 'Every complaint answered and closed.', frequency: 'as_needed', weekday: null, monthday: null },
  { area: 'reports', title: 'Lead’s daily report', details: 'Sent to the super admin from The Shift after 17:00.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'reports', title: 'Roster and attendance up to date', details: 'Leave, swaps and next week’s shifts in the fets.live roster.', frequency: 'weekly', weekday: 1, monthday: null },
  { area: 'reports', title: 'Monthly centre summary', details: 'Sessions, candidates, incidents and supplies for the month.', frequency: 'monthly', weekday: null, monthday: 1 },
  { area: 'reports', title: 'Provider incident reports', details: 'Irregularities reported to the provider as required.', frequency: 'as_needed', weekday: null, monthday: null },
  { area: 'growth', title: 'Actionables duties', details: 'Institution outreach in the Actionables page: results and follow-ups recorded there.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'growth', title: 'Mock test and fets.in bookings', details: 'New bookings confirmed and slots kept current.', frequency: 'daily', weekday: null, monthday: null },
  { area: 'growth', title: 'New exams and clients', details: 'Leads for new providers, exams or institutional partners followed up.', frequency: 'weekly', weekday: 3, monthday: null },
];
