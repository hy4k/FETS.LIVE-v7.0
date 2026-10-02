import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OperationsHome from './OperationsHome';
import { centreDate, summariseOperations, type OperationsSnapshot } from './operations-data';
afterEach(cleanup);
const snapshot: OperationsSnapshot = { sessions: [{ id: 's1', candidate_count: 5, status: 'scheduled' }, { id: 's2', candidate_count: 100, status: 'cancelled' }], roster: [{ profile_id: 'p1', shift_code: 'M' }, { profile_id: 'p1', shift_code: 'M' }, { profile_id: 'p2', shift_code: 'OFF' }], attendance: [{ staff_id: 'p1', check_in: '09:00', check_out: '17:00' }], handovers: null, failures: ['Handovers'], updatedAt: new Date().toISOString() };
describe('operations home', () => {
  it('uses India’s centre date, excludes cancelled sessions and checked-out staff, and does not invent unavailable totals', () => {
    expect(centreDate(new Date('2026-09-29T20:00:00Z'))).toBe('2026-09-30');
    expect(summariseOperations(snapshot)).toMatchObject({ candidates: 5, sessions: 1, rostered: 1, checkedIn: 0, pendingHandovers: null });
  });
  it('shows source failures and opens the existing handover route', async () => {
    const navigate = vi.fn();
    render(<OperationsHome branch="calicut" navigate={navigate} openDrawer={vi.fn()} load={vi.fn().mockResolvedValue(snapshot)} />);
    await screen.findByText(/Handovers could not be loaded/);
    fireEvent.click(screen.getByRole('button', { name: 'Open The Shift' }));
    expect(navigate).toHaveBeenCalledWith('handover');
  });
  it('ignores stale results from a previously selected branch', async () => {
    let finishFirst: (data: OperationsSnapshot) => void = () => {};
    const load = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; })).mockResolvedValue({ ...snapshot, sessions: [{ id: 'new', client_name: 'Cochin session' }] });
    const props = { navigate: vi.fn(), openDrawer: vi.fn(), load };
    const view = render(<OperationsHome branch="calicut" {...props} />);
    view.rerender(<OperationsHome branch="cochin" {...props} />);
    await screen.findByText('Cochin session');
    finishFirst({ ...snapshot, sessions: [{ id: 'old', client_name: 'Old branch session' }] });
    await waitFor(() => expect(screen.queryByText('Old branch session')).not.toBeInTheDocument());
  });
});
