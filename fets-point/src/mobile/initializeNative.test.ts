import { beforeEach, expect, it, vi } from 'vitest';
import { initializeNative } from './initializeNative';
const mocks = vi.hoisted(() => ({
  getInfo: vi.fn(), setStyle: vi.fn(), setBackgroundColor: vi.fn(),
  checkPermissions: vi.fn(), requestPermissions: vi.fn(), register: vi.fn(),
}));
vi.mock('@capacitor/device', () => ({ Device: { getInfo: mocks.getInfo } }));
vi.mock('@capacitor/status-bar', () => ({ StatusBar: { setStyle: mocks.setStyle, setBackgroundColor: mocks.setBackgroundColor }, Style: { Dark: 'DARK' } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: { checkPermissions: mocks.checkPermissions, requestPermissions: mocks.requestPermissions, register: mocks.register } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getInfo.mockResolvedValue({ platform: 'android' });
  mocks.checkPermissions.mockResolvedValue({ receive: 'prompt' });
  mocks.requestPermissions.mockResolvedValue({ receive: 'granted' });
});
it('initializes Android chrome without touching Firebase when configuration is absent', async () => {
  await initializeNative(false);
  expect(mocks.setStyle).toHaveBeenCalled();
  expect(mocks.checkPermissions).not.toHaveBeenCalled();
  expect(mocks.requestPermissions).not.toHaveBeenCalled();
  expect(mocks.register).not.toHaveBeenCalled();
});
it('retains Android push registration when Firebase is configured and permission is granted', async () => {
  await initializeNative(true);
  expect(mocks.requestPermissions).toHaveBeenCalled();
  expect(mocks.register).toHaveBeenCalledOnce();
});
it('does not register when notification permission is denied', async () => {
  mocks.requestPermissions.mockResolvedValue({ receive: 'denied' });
  await initializeNative(true);
  expect(mocks.register).not.toHaveBeenCalled();
});
it('does not call native status or notification APIs in a browser', async () => {
  mocks.getInfo.mockResolvedValue({ platform: 'web' });
  await initializeNative(false);
  expect(mocks.setStyle).not.toHaveBeenCalled();
  expect(mocks.checkPermissions).not.toHaveBeenCalled();
});
