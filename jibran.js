(function () {
  'use strict';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js', { scope:'./' })
        .then(function (registration) { console.log('مَدخَل PWA: Service Worker registered', registration.scope); })
        .catch(function (error) { console.warn('مَدخَل PWA: Service Worker registration failed', error); });
    });
  }
})();