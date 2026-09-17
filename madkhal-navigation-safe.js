(() => {
  'use strict';
  if (window.__MADKHAL_NAVIGATION_SAFE__) return;
  window.__MADKHAL_NAVIGATION_SAFE__ = true;

  function stickyOffset() {
    let offset = 10;
    const header = document.querySelector('.header');
    if (header) offset += header.getBoundingClientRect().height;
    const bar = document.getElementById('madkhalInstallBar');
    if (bar && !bar.classList.contains('hidden')) {
      offset += bar.getBoundingClientRect().height + 8;
    }
    return offset;
  }

  function place(target) {
    if (!target) return;
    const top = window.pageYOffset + target.getBoundingClientRect().top - stickyOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }

  function settle(id, anchorId) {
    const active = document.getElementById(id) || document.querySelector('.screen.active');
    if (!active) return;
    const anchor = anchorId ? document.getElementById(anchorId) : null;
    place(anchor || active);
    requestAnimationFrame(() => place(anchor || active));
  }

  function install() {
    const original = window.showScreen;
    if (typeof original !== 'function' || original.__madkhalNavigationSafeWrapped) return;

    function wrappedShowScreen(id, anchorId) {
      const result = original.apply(this, arguments);
      if (id !== 'homeScreen') {
        setTimeout(() => settle(id, anchorId), 35);
      } else {
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 35);
      }
      return result;
    }

    wrappedShowScreen.__madkhalNavigationSafeWrapped = true;
    window.showScreen = wrappedShowScreen;
  }

  // This file is loaded after the page's own scripts so it becomes the
  // final navigation layer. It does not intercept clicks, monitor scrolling,
  // or use MutationObserver.
  install();
  setTimeout(install, 0);
  setTimeout(install, 250);
})();
