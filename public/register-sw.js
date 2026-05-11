// ============================================================
// GSO Booking Management – Service Worker Registration
// Handles: SW registration, update detection, install prompt
// ============================================================

(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  // ── Register Service Worker ──────────────────────────────────
  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(function (registration) {
        console.log('[SW] Registered, scope:', registration.scope);

        // ── Detect SW updates ──────────────────────────────────
        registration.addEventListener('updatefound', function () {
          var installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', function () {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New SW is installed but waiting – notify the page
              console.log('[SW] New version available – will update on next load.');

              // Send SKIP_WAITING so new SW activates immediately
              installingWorker.postMessage({ type: 'SKIP_WAITING' });

              // Reload all clients once the new SW takes control
              navigator.serviceWorker.addEventListener('controllerchange', function () {
                window.location.reload();
              });
            }
          });
        });
      })
      .catch(function (error) {
        console.error('[SW] Registration failed:', error);
      });
  });
})();
