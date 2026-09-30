import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyDeskHome from './MyDeskHome';

const makeProps = () => ({
  user: { id: 'staff-one', name: 'Alex Thomas', role: 'Staff', branch: 'Calicut' },
  people: [{ id: 'staff-two', full_name: 'Sam Joseph', branch_assigned: 'calicut' }],
  pendingHandovers: 2,
  navigate: vi.fn(), openDrawer: vi.fn(), openChat: vi.fn(),
  renderPanel: vi.fn(panel => <div>{panel} content</div>),
});

describe('personal My Desk', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 29, 10));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('keeps the timer accurate after remounting, pausing, and completing a session', () => {
    const props = makeProps();
    const view = render(<MyDeskHome {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    act(() => vi.advanceTimersByTime(61000));
    expect(screen.getByRole('timer')).toHaveAccessibleName('23 minutes 59 seconds remaining');
    view.unmount();
    act(() => vi.advanceTimersByTime(60000));
    render(<MyDeskHome {...props} />);
    expect(screen.getByRole('timer')).toHaveAccessibleName('22 minutes 59 seconds remaining');
    fireEvent.click(screen.getByRole('button', { name: 'Pause focus' }));
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByRole('timer')).toHaveAccessibleName('22 minutes 59 seconds remaining');
    fireEvent.click(screen.getByRole('button', { name: 'Resume focus' }));
    act(() => vi.advanceTimersByTime(23 * 60000));
    expect(screen.getByRole('button', { name: 'Start again' })).toBeInTheDocument();
    expect(screen.getByText('Session complete. Time to recharge.')).toBeInTheDocument();
  });

  it('isolates notes and moods when the signed-in person changes', () => {
    const props = makeProps();
    const view = render(<MyDeskHome {...props} />);
    fireEvent.change(screen.getByLabelText('Today’s personal note'), { target: { value: 'A private idea' } });
    fireEvent.click(screen.getByRole('button', { name: 'Feeling bright' }));
    view.rerender(<MyDeskHome {...props} user={{ ...props.user, id: 'staff-two', name: 'Sam Joseph' }} />);
    expect(screen.getByLabelText('Today’s personal note')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Feeling bright' })).toHaveAttribute('aria-pressed', 'false');
    view.rerender(<MyDeskHome {...props} />);
    expect(screen.getByLabelText('Today’s personal note')).toHaveValue('A private idea');
  });

  it('opens existing staff tools and a real colleague chat', () => {
    const props = makeProps();
    render(<MyDeskHome {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /My schedule/ }));
    expect(props.navigate).toHaveBeenCalledWith('roster');
    fireEvent.click(screen.getByRole('button', { name: 'Chat with Sam Joseph' }));
    expect(props.openChat).toHaveBeenCalledWith(props.people[0]);
    fireEvent.click(screen.getByRole('button', { name: /Plan some time off/ }));
    expect(screen.getByText('requests content')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to my day' }));
    expect(screen.getByRole('button', { name: 'Start focus' })).toBeInTheDocument();
    for (const removed of ['Cockpit', 'Actionables', 'My Tasks', 'Living Board', 'Readiness']) {
      expect(screen.queryByRole('button', { name: removed })).not.toBeInTheDocument();
    }
  });

  it('opens the persistent AI companion directly instead of the old drawer', () => {
    const props = makeProps();
    const dispatched = vi.spyOn(window, 'dispatchEvent');
    render(<MyDeskHome {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Ask FETS AI/ }));
    expect(dispatched.mock.calls.some(([event]) => event.type === 'fets-open-ai')).toBe(true);
    expect(props.openDrawer).not.toHaveBeenCalled();
  });

  it('does not invent colleagues or a pending handover count when data is unavailable', () => {
    render(<MyDeskHome {...makeProps()} people={[]} pendingHandovers={null} />);
    expect(screen.getByText('Your team will appear here when staff details are available.')).toBeInTheDocument();
    expect(screen.getByText('Review your handovers')).toBeInTheDocument();
    expect(screen.queryByText('No handovers waiting')).not.toBeInTheDocument();
  });

  it('keeps controls usable and explains unsaved notes when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    render(<MyDeskHome {...makeProps()} />);
    fireEvent.change(screen.getByLabelText('Today’s personal note'), { target: { value: 'Keep a copy' } });
    expect(screen.getByLabelText('Today’s personal note')).toHaveValue('Keep a copy');
    expect(screen.getByText('Couldn’t save. Keep a copy before leaving.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    expect(screen.getByRole('button', { name: 'Pause focus' })).toBeInTheDocument();
  });
});
