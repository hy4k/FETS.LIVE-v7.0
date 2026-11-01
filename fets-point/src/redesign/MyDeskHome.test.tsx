import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyDeskHome from './MyDeskHome';

const makeProps = () => ({
  user: { id: 'staff-one', profileId: 'prof-one', name: 'Alex Thomas', role: 'Staff', branch: 'Calicut' },
  people: [
    { id: 'staff-two', full_name: 'Sam Joseph', role: 'Admin', position: 'TCA', branch_assigned: 'calicut' },
    { id: 'staff-three', full_name: 'Naima MM', role: 'Admin', position: 'TCA', branch_assigned: 'cochin' },
  ],
  pendingHandovers: 2,
  navigate: vi.fn(),
  openDrawer: vi.fn(),
  openChat: vi.fn(),
  renderPanel: vi.fn(panel => <div>{panel} content</div>),
});

describe('Social Collective My Desk', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('removes legacy desk widgets and "My profile" link, keeping only All Members, Leave Application, My Time, and My Growth', () => {
    render(<MyDeskHome {...makeProps()} />);

    expect(screen.getByRole('button', { name: /All Members/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Leave Application/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /My Time/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /My Growth/i })).toBeInTheDocument();

    for (const removed of [
      'My profile',
      'My day',
      'Checklist',
      'Start focus',
      'Ask FETS AI',
      'Cockpit',
      'Actionables',
      'My Tasks',
      'Living Board',
      'Readiness',
      'Handovers',
    ]) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${removed}`, 'i') })).not.toBeInTheDocument();
    }
  });

  it('renders all FETS.Live members in the social wall and story rail, allowing spotlighting and direct chat', () => {
    const props = makeProps();
    render(<MyDeskHome {...props} />);

    // Both colleagues and signed-in member appear on the social wall
    expect(screen.getAllByText('Alex Thomas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sam Joseph').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Naima MM').length).toBeGreaterThan(0);

    // Chatting with a colleague triggers openChat
    fireEvent.click(screen.getByRole('button', { name: 'Chat with Sam Joseph' }));
    expect(props.openChat).toHaveBeenCalledWith(props.people[0]);

    // Spotlighting Naima MM updates the top hero passport
    fireEvent.click(screen.getByTitle('Spotlight Naima MM'));
    expect(screen.getByRole('button', { name: /Back to my card/i })).toBeInTheDocument();
  });

  it('switches cleanly between Leave Application, My Time, My Growth, and All Members', () => {
    const props = makeProps();
    render(<MyDeskHome {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Leave Application/i }));
    expect(screen.getByText('requests content')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /My Time/i }));
    expect(screen.getByText('time content')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /My Growth/i }));
    expect(screen.getByText('growth content')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Back to All Members/i }));
    expect(screen.getByText(/Meet the Collective/i)).toBeInTheDocument();
  });

  it('provides top-of-page image upload controls for banner and portrait photos', async () => {
    render(<MyDeskHome {...makeProps()} />);

    const bannerLabel = screen.getByText('Upload Banner Photo');
    expect(bannerLabel).toBeInTheDocument();

    const bannerInput = bannerLabel.closest('label')?.querySelector('input[type="file"]') as HTMLInputElement;
    expect(bannerInput).toBeTruthy();

    const fakeFile = new File(['image-bytes'], 'cover.png', { type: 'image/png' });
    fireEvent.change(bannerInput, { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(screen.getByText('Change Banner Photo')).toBeInTheDocument();
    });
  });

  it('gracefully handles empty colleague list while still displaying the signed-in member card', () => {
    render(<MyDeskHome {...makeProps()} people={[]} pendingHandovers={null} />);
    expect(
      screen.getByText(/Your team will appear here when staff details are available/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText('Alex Thomas').length).toBeGreaterThan(0);
  });
});
