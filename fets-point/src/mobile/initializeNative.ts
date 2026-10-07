import { Device } from '@capacitor/device';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushNotifications } from '@capacitor/push-notifications';

export async function initializeNative(androidPushConfigured: boolean) {
  const { platform } = await Device.getInfo();
  if (platform === 'web') return;
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: '#f8f9f4' });
  // Firebase is optional for the Android app. Never request permission or
  // register with an unconfigured native Firebase instance.
  if (platform === 'android' && !androidPushConfigured) return;
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive !== 'granted') permission = await PushNotifications.requestPermissions();
  if (permission.receive === 'granted') await PushNotifications.register();
}
