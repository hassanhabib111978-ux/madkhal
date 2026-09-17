(() => {
  'use strict';
  // Compatibility loader: keeps index.html unchanged while loading
  // the non-conflicting live, stability, occupation, and navigation layers.
  if (window.__MADKHAL_UI_BRIDGE_READY__) return;
  window.__MADKHAL_UI_BRIDGE_READY__ = true;

  // jibran.js reads window.supabaseClient, while index.html keeps its
  // main client in a lexical let. Expose the same publishable client
  // immediately so the occupation picker can query RPCs reliably.
  const SUPABASE_URL = 'https://qbufsdpdobuicpljnssr.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mcPmNU2CGJkiSbfgOD6gOg_9RNMNlEY';

  if (!window.supabaseClient && window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (error) {
      console.warn('Madkhal UI bridge Supabase init:', error);
    }
  }

  ['./madkhal-live-bridge.js', './madkhal-stability-bridge.js', './madkhal-occupation-connection-fix.js'].forEach(src => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  });

  // Load the final navigation layer after the page's own bottom scripts have
  // finished installing their wrappers. No click interception or observers.
  setTimeout(() => {
    const script = document.createElement('script');
    script.src = './madkhal-navigation-safe.js';
    document.head.appendChild(script);
  }, 0);
})();
