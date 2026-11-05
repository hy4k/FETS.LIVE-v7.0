import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MyDeskHome from './MyDeskHome';

beforeEach(() => { localStorage.clear(); });
afterEach(cleanup);

it('opens an overtime application directly while preserving the social profile workspace', () => {
  render(<MyDeskHome
    user={{ id: 'auth-one', profileId: 'profile-one', name: 'Sample Staff', role: 'Staff', branch: 'Calicut' }}
    people={[]}
    pendingHandovers={0}
    navigate={vi.fn()}
    openDrawer={vi.fn()}
    openChat={vi.fn()}
    renderPanel={(panel, kind) => <div>{panel === 'requests' && kind === 'ot' ? 'Overtime application selected' : 'Choose an application'}</div>}
  />);
  fireEvent.click(screen.getByRole('button', { name: /Leave Application/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Overtime / TOIL Pay' }));
  expect(screen.getByText('Overtime application selected')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^All Members/i })).toBeInTheDocument();
  expect(screen.getByText(/THE PEOPLE WHO MAKE/i)).toBeInTheDocument();
});
