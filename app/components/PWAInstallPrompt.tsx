'use client';

import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

type BannerState = 'hidden' | 'android' | 'ios' | 'installed';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as any).standalone === true)
  );
}

export default function PWAInstallPrompt() {
  const [bannerState, setBannerState] = useState<BannerState>('hidden');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed / running standalone
    if (isInStandaloneMode()) {
      setBannerState('installed');
      return;
    }

    // Check if user previously dismissed
    const wasDismissed = sessionStorage.getItem('pwa-prompt-dismissed');
    if (wasDismissed) return;

    // iOS: no beforeinstallprompt, show manual instructions
    if (isIOS()) {
      // Small delay so page loads first
      const timer = setTimeout(() => setBannerState('ios'), 2500);
      return () => clearTimeout(timer);
    }

    // Android/Desktop Chrome/Edge/Samsung: listen for native prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setBannerState('android');
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      setBannerState('installed');
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      setIsInstalling(true);
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setBannerState('installed');
      } else {
        handleDismiss();
      }
    } catch (err) {
      console.error('[PWA] Install prompt error:', err);
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setTimeout(() => setBannerState('hidden'), 300);
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
  }, []);

  // Nothing to show
  if (bannerState === 'hidden' || bannerState === 'installed') return null;

  return (
    <>
      <style>{`
        @keyframes pwa-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes pwa-slide-down {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(100%); opacity: 0; }
        }
        .pwa-banner {
          animation: pwa-slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .pwa-banner.dismissed {
          animation: pwa-slide-down 0.3s ease-in forwards;
        }
      `}</style>

      <div
        className={`pwa-banner${dismissed ? ' dismissed' : ''}`}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          padding: '0 1rem 1rem',
        }}
        role="dialog"
        aria-label="Install GSO Booking App"
      >
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            background: 'linear-gradient(135deg, #1e293b 0%, #1e3a5f 100%)',
            borderRadius: '1.25rem 1.25rem 1rem 1rem',
            border: '1px solid rgba(99,179,237,0.25)',
            boxShadow: '0 -4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,179,237,0.1)',
            padding: '1.25rem 1.25rem 1rem',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem' }}>
            {/* App icon */}
            <img
              src="/icons/icon-96x96.png"
              alt="App icon"
              width={52}
              height={52}
              style={{ borderRadius: '0.875rem', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9', lineHeight: 1.3 }}>
                GSO Booking Management
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                {bannerState === 'ios'
                  ? 'Add to your Home Screen'
                  : 'Install the app for a better experience'}
              </p>
            </div>
            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '50%',
                width: '2rem',
                height: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                color: '#94a3b8',
                fontSize: '1rem',
                transition: 'background 0.2s',
              }}
            >
              ✕
            </button>
          </div>

          {/* Android / Desktop – native install button */}
          {bannerState === 'android' && (
            <button
              id="pwa-install-btn"
              onClick={handleInstall}
              disabled={isInstalling}
              style={{
                width: '100%',
                padding: '0.8rem',
                background: isInstalling
                  ? 'rgba(29,78,216,0.5)'
                  : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.875rem',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: isInstalling ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'opacity 0.2s, transform 0.1s',
                letterSpacing: '0.01em',
              }}
            >
              {isInstalling ? (
                <>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Installing…
                </>
              ) : (
                <>
                  {/* Download icon */}
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Install App
                </>
              )}
            </button>
          )}

          {/* iOS – manual instructions */}
          {bannerState === 'ios' && (
            <div
              style={{
                background: 'rgba(99,179,237,0.08)',
                border: '1px solid rgba(99,179,237,0.2)',
                borderRadius: '0.75rem',
                padding: '0.875rem 1rem',
              }}
            >
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', fontWeight: 600, color: '#7dd3fc' }}>
                How to install on iOS:
              </p>
              <ol style={{ margin: 0, padding: '0 0 0 1.2rem', listStyle: 'decimal' }}>
                {[
                  <>Tap the <strong style={{ color: '#f1f5f9' }}>Share</strong> button <span style={{ fontSize: '1rem' }}>⬆</span> at the bottom of Safari</>,
                  <>Scroll down and tap <strong style={{ color: '#f1f5f9' }}>"Add to Home Screen"</strong></>,
                  <>Tap <strong style={{ color: '#f1f5f9' }}>"Add"</strong> in the top right corner</>,
                ].map((step, i) => (
                  <li key={i} style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem', lineHeight: 1.5 }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Benefits row */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '0.875rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {['Works Offline', 'Fast & Smooth', 'Home Screen Icon'].map((label) => (
              <span
                key={label}
                style={{
                  fontSize: '0.7rem',
                  color: '#7dd3fc',
                  background: 'rgba(99,179,237,0.1)',
                  border: '1px solid rgba(99,179,237,0.2)',
                  borderRadius: '999px',
                  padding: '0.2rem 0.6rem',
                }}
              >
                ✓ {label}
              </span>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </>
  );
}
