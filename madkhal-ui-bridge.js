(() => {
  'use strict';
  // Kept at the original path for compatibility with index.html.
  // Navigation is intentionally handled by the main application only.
  if (window.__MADKHAL_UI_BRIDGE_READY__) return;
  window.__MADKHAL_UI_BRIDGE_READY__ = true;
  const script = document.createElement('script');
  script.src = './madkhal-live-bridge.js';
  script.defer = true;
  document.head.appendChild(script);
})();
