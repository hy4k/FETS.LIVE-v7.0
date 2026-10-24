import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useNativeNavigation } from './useNativeNavigation';
const native = vi.hoisted(() => ({ callback: undefined as any, remove: vi.fn(), minimize: vi.fn(), enabled: true }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.enabled } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async (_: string, callback: any) => { native.callback = callback; return { remove: native.remove }; }), minimizeApp: native.minimize } }));
beforeEach(() => { native.enabled = true; native.remove.mockClear(); native.minimize.mockClear(); document.body.innerHTML = ''; });
afterEach(() => vi.restoreAllMocks());
it('dismisses a dialog before navigating back', async () => {
  const navigate = vi.fn(); const back = vi.spyOn(window.history, 'back');
  const { unmount } = renderHook(() => useNativeNavigation('my-desk', navigate));
  const dialog = document.createElement('dialog'); dialog.setAttribute('open', '');
  dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.removeAttribute('open'); });
  document.body.append(dialog);
  act(() => native.callback({ canGoBack: true }));
  expect(dialog.hasAttribute('open')).toBe(false); expect(back).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
  await act(async () => {}); unmount(); expect(native.remove).toHaveBeenCalled();
});
it('dismisses a legacy drawer before leaving the page', () => {
  renderHook(() => useNativeNavigation('command-center', vi.fn()));
  const drawer = document.createElement('aside'); drawer.className = 'drawer open'; document.body.append(drawer);
  const escape = vi.fn(); window.addEventListener('keydown', escape);
  act(() => native.callback({ canGoBack: false }));
  expect(escape).toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' })); expect(native.minimize).not.toHaveBeenCalled();
  window.removeEventListener('keydown', escape);
});
it('returns to Home from a direct route, then minimizes from Home', () => {
  const navigate = vi.fn(); const { rerender } = renderHook(({ active }) => useNativeNavigation(active, navigate), { initialProps: { active: 'profile' } });
  act(() => native.callback({ canGoBack: false })); expect(navigate).toHaveBeenCalledWith('command-center');
  rerender({ active: 'command-center' }); act(() => native.callback({ canGoBack: false })); expect(native.minimize).toHaveBeenCalled();
});
it('keeps the native handler out of a normal browser', () => {
  native.enabled = false; native.callback = undefined; renderHook(() => useNativeNavigation('profile', vi.fn())); expect(native.callback).toBeUndefined();
});
