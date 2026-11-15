/*
 * "Install app": keeps the browser's install prompt (Chromium) so a button can offer it.
 * Safari installs through Share › Add to Home Screen and never fires the event.
 */
import { useEffect, useState } from 'react';

interface PromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as PromptEvent; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}

export function useInstall(): { canInstall: boolean; install: () => void } {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return {
    canInstall: !!deferred,
    install: () => {
      const d = deferred;
      if (!d) return;
      d.prompt().catch(() => undefined);
      d.userChoice.finally(() => { deferred = null; listeners.forEach((f) => f()); });
    },
  };
}
