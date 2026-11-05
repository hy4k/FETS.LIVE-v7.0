import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RosterWorkspace from './RosterWorkspace';
import type { RosterRepository } from './repository';
import type { Snapshot } from './model';

afterEach(cleanup);

it('shows D1 and D2 against saved custom hours in the staff roster and its legend', async () => {
  const data: Snapshot = {
    people: [{ id: 'staff-one', user_id: 'auth-one', full_name: 'Sample Staff', branch_assigned: 'calicut', is_active: true }],
    types: [], attendance: [],
    schedules: [
      { id: 'early', profile_id: 'staff-one', date: '2026-11-05', branch_location: 'calicut', shift_code: 'D', shift_label: 'Early shift', shift_start: '06:00', shift_end: '15:00', grace_minutes: 0, overtime_hours: 0, version: 1 },
      { id: 'late', profile_id: 'staff-one', date: '2026-11-06', branch_location: 'calicut', shift_code: 'D', shift_label: 'Late shift', shift_start: '11:30', shift_end: '20:30', grace_minutes: 0, overtime_hours: 0, version: 1 },
    ],
  };
  const repo = { load: vi.fn().mockResolvedValue(data) } as unknown as RosterRepository;
  render(<RosterWorkspace branch="calicut" meId="staff-one" canEdit={false} repo={repo} now={new Date('2026-11-05T12:00:00+05:30')} />);
  const early = await screen.findByRole('button', { name: /Sample Staff, 5 Nov, Early shift 6:00 AM – 3:00 PM/ });
  const late = screen.getByRole('button', { name: /Sample Staff, 6 Nov, Late shift 11:30 AM – 8:30 PM/ });
  expect(within(early).getByText('D1')).toBeInTheDocument();
  expect(within(late).getByText('D2')).toBeInTheDocument();
  expect(early).toBeDisabled();
  const legend = screen.getByLabelText('Roster codes and shift hours');
  expect(within(legend).getByText('D1')).toBeInTheDocument();
  expect(within(legend).getByText('D2')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Quick Add' })).not.toBeInTheDocument();
});
