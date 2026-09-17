(() => {
  'use strict';
  // Single compatibility/co-ordination layer. It keeps index.html stable and
  // loads only the small runtime components that are already part of Madkhal.
  if (window.__MADKHAL_UI_BRIDGE_READY__) return;
  window.__MADKHAL_UI_BRIDGE_READY__ = true;

  const SUPABASE_URL = 'https://qbufsdpdobuicpljnssr.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mcPmNU2CGJkiSbfgOD6gOg_9RNMNlEY';

  // jibran.js and the runtime bridges use window.supabaseClient, while the
  // original page keeps its own lexical client. Both use the same publishable key.
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

  // One controlled post-startup integrity pass. It never observes the DOM,
  // never intercepts clicks, and never changes job/source data.
  async function verifyJobsAndRefresh() {
    try {
      if (typeof window.loadMadkhalRealJobs !== 'function') return;
      let jobs = await window.loadMadkhalRealJobs(false);
      if (!Array.isArray(jobs) || jobs.length === 0) {
        jobs = await window.loadMadkhalRealJobs(true);
      }
      if (typeof window.renderCategories === 'function') window.renderCategories();
      if (typeof window.renderOpportunities === 'function') window.renderOpportunities();
      if (typeof window.renderMadkhalJobCounter === 'function') window.renderMadkhalJobCounter();
      console.log('مَدخَل: jobs integrity check', Array.isArray(jobs) ? jobs.length : 0);
    } catch (error) {
      console.warn('Madkhal jobs integrity check:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(verifyJobsAndRefresh, 450);
  }, { once: true });
})();
