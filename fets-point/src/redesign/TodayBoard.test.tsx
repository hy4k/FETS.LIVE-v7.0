import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TodayBoard } from './TheShift';
import { createDayPlan } from './shift-plan';
import type { ShiftRepository } from './shift-repository';
import type { BlueprintRepository } from './shift-blueprint-repository';

const day = '2026-10-08';
const team = ['a', 'b', 'c'].map(id => ({ id, userId: id, name: `Staff ${id.toUpperCase()}`, code: 'D' }));
const job = { id: 'j', branch: 'cochin', title: 'Tomorrow’s candidates called', details: 'Confirm time and ID.', area: 'exam', frequency: 'daily', active: true, weekday: null, monthday: null, position: 0, owner_id: 'b', backup_id: 'c' };
const task = { id: 't', branch: 'cochin', day, responsibility_id: 'j', title: job.title, assigned_to: 'b', status: 'done', note: '', done_by: 'b', done_at: '2026-10-08T02:35:00Z', verified_by: null, verified_at: null };
function setup(id = 'a', options: { tasks?: any[]; team?: typeof team; reviewReady?: boolean; closed?: boolean; branch?: string } = {}) {
  const plan = createDayPlan(team); plan.breaks = [];
  const repository = { roster: vi.fn().mockResolvedValue(options.team ?? team), load: vi.fn().mockResolvedValue({ record: { id: 'p', branch: 'cochin', day, status: 'published', plan, lead_id: 'a' }, lead: { lead_id: 'a' }, events: [], changes: [], closed: options.closed ?? false }), event: vi.fn().mockImplementation(async e => ({ ...e, id: 'e' })) };
  let savedTasks = options.tasks ?? [];
  const persist = (row: any) => { savedTasks = [...savedTasks.filter(t => t.id !== row.id), row]; return row; };
  const blueprint = { staff: vi.fn().mockResolvedValue(team), responsibilities: vi.fn().mockResolvedValue([job]), tasks: vi.fn().mockImplementation(async () => savedTasks), actionables: vi.fn().mockResolvedValue([]), setTask: vi.fn().mockImplementation(async () => persist(task)), verifyTask: vi.fn().mockImplementation(async () => persist({ ...task, verified_by: 'a', verified_at: '2026-10-08T02:40:00Z' })) };
  render(<TodayBoard branch={options.branch ?? 'cochin'} day={day} identity={{ id, profileId: id, name: `Staff ${id}`, admin: id === 'admin' }} repository={repository as unknown as ShiftRepository} blueprint={blueprint as unknown as BlueprintRepository} navigate={vi.fn()} reviewReady={options.reviewReady ?? true}><div>Detailed rota</div></TodayBoard>);
  return { repository, blueprint };
}
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-08T02:40:00Z')); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('daily staff board', () => {
  it('shows three cards to the lead, including their own rotation', async () => {
    setup();
    const card = await screen.findByRole('region', { name: 'Staff A duties' });
    expect(within(card).getByText('Front office')).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: /Staff . duties/ })).toHaveLength(3);
    expect(screen.getByText('Full rota, break cover & check log').closest('details')).not.toHaveAttribute('open');
    expect(screen.getAllByText('Call tomorrow’s candidates')).toHaveLength(1);
  });
  it('defaults to own jobs and records an actual due walk for its owner', async () => {
    const { repository, blueprint } = setup('b');
    fireEvent.click(await screen.findByRole('button', { name: 'Record walk at 08:10' }));
    await waitFor(() => expect(repository.event).toHaveBeenCalledWith({ plan_id: 'p', block: 0, lane: 'floor', kind: 'walk', due: 490, note: '' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done: Call tomorrow’s candidates' }));
    await waitFor(() => expect(blueprint.setTask).toHaveBeenCalledWith(expect.objectContaining({ status: 'done', assigned_to: 'b', title: job.title })));
    expect(screen.queryByRole('button', { name: 'Verify: Call tomorrow’s candidates' })).not.toBeInTheDocument();
  });
  it('persists independent review, then collapses completed work', async () => {
    const { blueprint } = setup('a', { tasks: [task] });
    fireEvent.click(await screen.findByRole('button', { name: 'Verify: Call tomorrow’s candidates' }));
    await waitFor(() => expect(blueprint.verifyTask).toHaveBeenCalledWith(task));
    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Finished or moved (1)').closest('details')).not.toHaveAttribute('open');
  });
  it('keeps a failed verification pending', async () => {
    const { blueprint } = setup('a', { tasks: [task] });
    blueprint.verifyTask.mockRejectedValue(new Error('This job changed. Refresh before reviewing it'));
    fireEvent.click(await screen.findByRole('button', { name: 'Verify: Call tomorrow’s candidates' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This job changed');
    expect(screen.getByText('Needs review')).toBeInTheDocument();
  });
  it('never offers self-review or review before database activation', async () => {
    setup('a', { tasks: [{ ...task, assigned_to: 'a', done_by: 'a' }] });
    await screen.findByText('Needs review');
    expect(screen.queryByRole('button', { name: /^Verify:/ })).not.toBeInTheDocument();
    cleanup();
    setup('a', { tasks: [task], reviewReady: false });
    await screen.findByText(/verification is awaiting activation/);
    expect(screen.queryByRole('button', { name: /^Verify:/ })).not.toBeInTheDocument();
  });
  it('retains saved assignments when a person leaves the roster', async () => {
    setup('a', { team: [team[0], team[2]], tasks: [task] });
    const card = await screen.findByRole('region', { name: 'Staff B duties' });
    expect(within(card).getByText(/Not rostered/)).toBeInTheDocument();
    expect(within(card).getByText('Call tomorrow’s candidates')).toBeInTheDocument();
  });
  it('loads only the selected centre and disables closed-day actions', async () => {
    const { repository, blueprint } = setup('b', { branch: 'calicut', closed: true });
    await screen.findByText(/These records are closed/);
    expect(repository.roster).toHaveBeenCalledWith('calicut', day);
    expect(blueprint.responsibilities).toHaveBeenCalledWith('calicut');
    expect(screen.queryByRole('button', { name: /^Done:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Record walk/ })).not.toBeInTheDocument();
  });
});
