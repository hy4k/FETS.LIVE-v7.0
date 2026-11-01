import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MobileHeader, MobileNavigation, appToMobile, mobileMenuItems, mobileToApp } from './MobileWorkspace';
// jsdom has no responsive layout engine; visibility is checked in Chromium.
vi.mock('./mobile-workspace.css', () => ({}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ profile: { role: 'staff', email: 'staff@example.invalid', permissions: {} } }) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
describe('mobile workspace feature access', () => {
  it('preserves shared feature permissions and personal overrides', () => {
    const staff = mobileMenuItems(false).map(item => item.id);
    expect(staff).toEqual(expect.arrayContaining(['actionables', 'handover', 'fets-chat', 'candidate-tracker', 'profile']));
    expect(staff).not.toContain('user-management');
    expect(mobileMenuItems(false, { 'ws_user-management': true }).map(item => item.id)).toContain('user-management');
    expect(mobileMenuItems(true, { 'ws_user-management': false }).map(item => item.id)).not.toContain('user-management');
  });
  it.each(['live', 'calendar', 'roster', 'desk', 'case', 'handover', 'fets-chat', 'profile'])('round-trips the %s route', id => {
    expect(appToMobile(mobileToApp(id))).toBe(id);
  });
  it('offers five destinations, identifies the current page, and opens searchable tools', () => {
    const navigate = vi.fn();
    render(<MobileNavigation active="calendar" navigate={navigate} />);
    expect(screen.getByRole('navigation', { name: 'Mobile workspace' }).querySelectorAll('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Calendar', exact: true })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'More workspace tools' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a page or a tool' }), { target: { value: 'team' } });
    fireEvent.click(screen.getByRole('button', { name: /Team space/ }));
    expect(navigate).toHaveBeenCalledWith('fets-chat');
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
  });
  it('switches centres without changing the current route', () => {
    const onBranchChange = vi.fn(); const navigate = vi.fn();
    render(<MobileHeader branch="calicut" onBranchChange={onBranchChange} navigate={navigate} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Active centre' }), { target: { value: 'cochin' } });
    expect(onBranchChange).toHaveBeenCalledWith('cochin');
    expect(navigate).not.toHaveBeenCalled();
  });
  it('shows offline guidance when connectivity changes', () => {
    render(<MobileHeader branch="calicut" onBranchChange={vi.fn()} navigate={vi.fn()} />);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('status')).toHaveTextContent('Reconnect before saving changes');
    vi.restoreAllMocks();
  });
});
