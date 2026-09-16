(() => {
  'use strict';
  if (window.__MADKHAL_OCCUPATION_CONNECTION_FIX__) return;
  window.__MADKHAL_OCCUPATION_CONNECTION_FIX__ = true;

  const SUPABASE_URL = 'https://qbufsdpdobuicpljnssr.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mcPmNU2CGJkiSbfgOD6gOg_9RNMNlEY';

  function ensureClient() {
    if (window.supabaseClient && typeof window.supabaseClient.rpc === 'function') return true;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return false;
    try {
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return true;
    } catch (error) {
      console.warn('Madkhal occupation client init:', error);
      return false;
    }
  }

  function setStatus(text) {
    const el = document.getElementById('madkhalOccupationStatus');
    if (el) el.textContent = text;
  }

  function repairPicker() {
    if (ensureClient()) return true;
    return false;
  }

  // The occupation picker is installed by jibran.js. On some loads it can
  // initialize before the main Supabase client is exposed globally. Keep the
  // existing picker untouched and make the client available without changing
  // its search/RPC contract.
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (repairPicker() || tries >= 40) clearInterval(timer);
  }, 250);

  document.addEventListener('input', event => {
    if (event.target && event.target.id === 'madkhalOccupationSearch') {
      if (!repairPicker()) setStatus('جاري تهيئة الاتصال بقائمة المهن…');
    }
  }, true);

  window.addEventListener('load', repairPicker, { once: true });
})();
