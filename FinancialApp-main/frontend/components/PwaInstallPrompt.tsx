import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
};

const DISMISS_KEY = 'altx.pwa.prompt.dismissed';

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    setShowIosHint(isIosDevice() && !isStandaloneMode());

    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };

    window.addEventListener('load', registerServiceWorker, { once: true });
    return () => {
      window.removeEventListener('load', registerServiceWorker);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    };

    const handleAppInstalled = () => {
      window.localStorage.removeItem(DISMISS_KEY);
      setDeferredPrompt(null);
      setShowIosHint(false);
      setIsDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const visible = useMemo(() => {
    if (isDismissed || isStandaloneMode()) return false;
    return Boolean(deferredPrompt || showIosHint);
  }, [deferredPrompt, isDismissed, showIosHint]);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1');
    }
    setIsDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        dismiss();
      }
    } finally {
      setDeferredPrompt(null);
      setIsInstalling(false);
    }
  };

  return (
    <div className="safe-area-bottom fixed inset-x-0 bottom-0 z-[70] px-4 pb-4 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="pwa-banner rounded-[28px] border border-brand-primary/20 bg-brand-secondary px-5 py-4 text-white shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="tag bg-white/10 text-white/70">Mobile App</p>
            <h2 className="mt-3 text-lg font-semibold">Install ALTX Finance</h2>
            <p className="mt-2 text-sm text-white/70">
              {deferredPrompt
                ? 'Add the app to your home screen for a full-screen mobile experience.'
                : 'On iPhone, tap Share and then Add to Home Screen to install this app.'}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70 transition hover:bg-white/10"
            aria-label="Dismiss install prompt"
          >
            Later
          </button>
        </div>
        {deferredPrompt ? (
          <button
            type="button"
            onClick={install}
            disabled={isInstalling}
            className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isInstalling ? 'Preparing install...' : 'Install app'}
          </button>
        ) : (
          <p className="mt-4 rounded-2xl bg-white/8 px-4 py-3 text-xs text-white/80">
            Best results: open this page in Safari, then save it to the home screen.
          </p>
        )}
      </div>
    </div>
  );
}
