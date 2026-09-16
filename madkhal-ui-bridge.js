(() => {
  'use strict';
  // Compatibility loader: keeps index.html unchanged while loading
  // the non-conflicting live and stability layers.
  if (window.__MADKHAL_UI_BRIDGE_READY__) return;
  window.__MADKHAL_UI_BRIDGE_READY__ = true;
  ['./madkhal-live-bridge.js', './madkhal-stability-bridge.js'].forEach(src => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  });
})();
