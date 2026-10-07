import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';

/** Android back dismisses an open sheet before leaving the current page. */
export function useNativeNavigation(active: string, navigate: (page: string) => void) {
  const current = useRef({ active, navigate });
  current.current = { active, navigate };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let listener: PluginListenerHandle | undefined;
    App.addListener('backButton', ({ canGoBack }) => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
      if (dialog) {
        const event = new Event('cancel', { cancelable: true });
        if (dialog.dispatchEvent(event)) dialog.close();
      } else if (document.querySelector('.drawer.open')) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      } else if (canGoBack) window.history.back();
      else if (current.current.active !== 'command-center') current.current.navigate('command-center');
      else App.minimizeApp();
    }).then(handle => { if (disposed) handle.remove(); else listener = handle; });
    return () => { disposed = true; listener?.remove(); };
  }, []);
}
