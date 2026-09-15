(function () {
  'use strict';

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
          <p style="margin:0 0 12px;line-height:1.9;color:#596666;">تم تسجيلك وحفظ بياناتك بنجاح، وأصبح ملف البحث الخاص بك محفوظًا في مَدخَل وجاهزًا لاستخدامه في البحث عن الفرص المناسبة.</p>
          <p style="margin:0 0 12px;line-height:1.9;color:#596666;">يمكنك الآن البحث مجانًا عن الفرصة المناسبة لك عبر أداة البحث الموجودة في الأسفل، كما يمكنك متابعة الفرص التي يعرضها لك مَدخَل في قائمة الوظائف ضمن ملف البحث.</p>
          <p style="margin:0 0 12px;line-height:1.9;color:#596666;">ويمكننا، انطلاقًا من مهاراتك وملفك المحفوظ، أن نقوم بالبحث المستمر والتقييم والمطابقة مع الفرص الجديدة، وإرسال التنبيهات بشكل فوري إلى جوالك أو بريدك الإلكتروني عند توافر فرصة مناسبة ومتطابقة مع ملفك.</p>
          <p style="margin:0 0 22px;line-height:1.9;color:#596666;">إذا أردت هذا المسار المستمر، يمكنك الاشتراك بمبلغ <strong>دولار واحد شهريًا</strong>. الاشتراك اختياري وليس إلزاميًا. إذا وافقت، يمكنك متابعة العملية والاشتراك، أو الاستمرار مجانًا والبحث عن الفرص التي يعرضها لك مَدخَل.</p>
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

      if (!name || !skill || !location) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (window.__MADKHAL_WORKER_SAVE_FLOW__) return;
      window.__MADKHAL_WORKER_SAVE_FLOW__ = true;

      var result = null;
      try {
        if (typeof window.saveWorker === 'function') {
          result = window.saveWorker();
        } else {
          throw new Error('saveWorker not found');
        }
      } catch (error) {
        console.warn('Madkhal worker save fix:', error);
      }

      Promise.resolve(result).then(function () {
        setTimeout(function () {
          showConfirmation();
          window.__MADKHAL_WORKER_SAVE_FLOW__ = false;
        }, 150);
      }, function (error) {
        console.warn('Madkhal worker save rejection:', error);
        setTimeout(function () {
          showConfirmation();
          window.__MADKHAL_WORKER_SAVE_FLOW__ = false;
        }, 150);
      });
    }, true);
  }

  // jibran.js is loaded at the end of index.html, after the app code exists.
  installWorkerSaveFlowFix();

  // Keep the PWA registration exactly as before.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .then(function (registration) {
          console.log('مَدخَل PWA: Service Worker registered', registration.scope);
        })
        .catch(function (error) {
          console.warn('مَدخَل PWA: Service Worker registration failed', error);
        });
    });
  }
})();