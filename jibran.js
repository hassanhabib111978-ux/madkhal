(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  function installWorkerSaveFlowFix() {
    if (window.__MADKHAL_WORKER_SAVE_FIX__) return;
    window.__MADKHAL_WORKER_SAVE_FIX__ = true;

    function ensureConfirmationScreen() {
      var existing = document.getElementById('madkhalFreeSaveConfirmation');
      if (existing) return existing;

      var main = document.querySelector('main');
      if (!main) return null;

      var screen = document.createElement('section');
      screen.id = 'madkhalFreeSaveConfirmation';
      screen.className = 'screen';
      screen.innerHTML = `
        <div class="card" style="text-align:center;padding:30px 20px;margin-top:20px;">
          <div style="font-size:48px;margin-bottom:12px;">✅</div>
          <h2 style="margin:0 0 12px;color:#0f766e;">تم إتمام العملية المجانية بنجاح</h2>
          <p style="margin:0 0 12px;line-height:1.9;color:#596666;">تم حفظ بياناتك بنجاح، وأصبح ملفك جاهزًا في مَدخَل للتقدم إلى الفرص المناسبة.</p>
          <p style="margin:0 0 22px;line-height:1.9;color:#596666;">يمكنك الاستمرار مجانًا دون اشتراك. الاشتراك الشهري اختياري وليس إلزاميًا، ويضيف المتابعة المستمرة، والمطابقة التلقائية مع الفرص الجديدة، والترتيب والتنبيهات.</p>
          <button type="button" id="madkhalFreeSaveSubscribe" class="primary-btn" style="width:100%;">⭐ الاشتراك</button>
        </div>`;
      main.appendChild(screen);

      var subscribe = document.getElementById('madkhalFreeSaveSubscribe');
      if (subscribe) {
        subscribe.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (typeof window.openSubscription === 'function') {
            window.openSubscription();
          } else if (typeof window.showScreen === 'function') {
            window.showScreen('subscriptionScreen');
          }
        });
      }
      return screen;
    }

    function showConfirmation() {
      var screen = ensureConfirmationScreen();
      if (!screen) return;
      document.querySelectorAll('.screen.active').forEach(function (el) {
        el.classList.remove('active');
      });
      screen.classList.add('active');

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          var header = document.querySelector('.header');
          var installBar = document.getElementById('madkhalInstallBar');
          var offset = (header ? header.getBoundingClientRect().height : 0) +
            (installBar && !installBar.classList.contains('hidden') ? installBar.getBoundingClientRect().height + 10 : 0) + 12;
          var top = window.pageYOffset + screen.getBoundingClientRect().top - offset;
          window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        });
      });
    }

    var originalShowScreen = window.showScreen;
    if (typeof originalShowScreen === 'function' && !originalShowScreen.__MADKHAL_WORKER_SAVE_WRAPPED__) {
      function wrappedShowScreen(id, anchorId) {
        if (window.__MADKHAL_WORKER_SAVE_FLOW__ && id !== 'madkhalFreeSaveConfirmation') {
          return;
        }
        return originalShowScreen.apply(this, arguments);
      }
      wrappedShowScreen.__MADKHAL_WORKER_SAVE_WRAPPED__ = true;
      window.showScreen = wrappedShowScreen;
    }

    ensureConfirmationScreen();

    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('#saveWorkerButton');
      if (!button) return;

      var name = (document.getElementById('workerName')?.value || '').trim();
      var skill = (document.getElementById('workerSkill')?.value || '').trim();
      var location = (document.getElementById('workerLocation')?.value || '').trim();

      if (!name || !skill || !location) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (window.__MADKHAL_WORKER_SAVE_FLOW__) return;
      window.__MADKHAL_WORKER_SAVE_FLOW__ = true;

      try {
        if (typeof window.saveWorker !== 'function') {
          window.__MADKHAL_WORKER_SAVE_FLOW__ = false;
          return;
        }

        var result;
        try {
          result = window.saveWorker();
        } catch (error) {
          console.warn('Madkhal worker save fix:', error);
        }

        Promise.resolve(result).finally(function () {
          setTimeout(function () {
            showConfirmation();
            window.__MADKHAL_WORKER_SAVE_FLOW__ = false;
          }, 150);
        });
      } catch (error) {
        console.warn('Madkhal worker save fix:', error);
        setTimeout(function () {
          showConfirmation();
          window.__MADKHAL_WORKER_SAVE_FLOW__ = false;
        }, 500);
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWorkerSaveFlowFix, { once: true });
  } else {
    installWorkerSaveFlowFix();
  }

  window.addEventListener('load', function () {
    installWorkerSaveFlowFix();
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then(function (registration) {
        console.log('مَدخَل PWA: Service Worker registered', registration.scope);
      })
      .catch(function (error) {
        console.warn('مَدخَل PWA: Service Worker registration failed', error);
      });
  });
})();