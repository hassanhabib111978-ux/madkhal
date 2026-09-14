const CACHE_NAME = "madkhal-v9";

const BASE_URL = new URL("./", self.registration.scope);
const INDEX_URL = new URL("index.html", BASE_URL).href;
const MANIFEST_URL = new URL("manifest.json", BASE_URL).href;
const ICON_192_URL = new URL("icon-192.png", BASE_URL).href;
const ICON_512_URL = new URL("icon-512.svg", BASE_URL).href;

const FILES_TO_CACHE = [BASE_URL.href, INDEX_URL, MANIFEST_URL, ICON_192_URL, ICON_512_URL];

const NAVIGATION_PATCH = `
<script id="madkhal-navigation-patch">
(function(){
  if (window.__MADKHAL_NAV_PATCH__) return;
  window.__MADKHAL_NAV_PATCH__ = true;

  function offset(){
    var n = 8;
    var h = document.querySelector('.header');
    if (h) n += h.getBoundingClientRect().height;
    var b = document.getElementById('madkhalInstallBar');
    if (b && !b.classList.contains('hidden')) n += b.getBoundingClientRect().height + 10;
    return n;
  }

  function settle(id, anchorId){
    var target = anchorId ? document.getElementById(anchorId) : document.getElementById(id);
    if (!target) return;
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        var top = window.pageYOffset + target.getBoundingClientRect().top - offset();
        window.scrollTo({top: Math.max(0, top), behavior:'auto'});
        if (id === 'profileScreen' && target.id === 'workerName') {
          try { target.focus({preventScroll:true}); } catch(e) { try { target.focus(); } catch(_){} }
        }
      });
    });
  }

  function cleanupFakeXTree(){
    try {
      var keys = ['madkhal_demo_vacancies','madkhal_vacancies','madkhalVacancies','vacancies'];
      keys.forEach(function(key){
        var raw = localStorage.getItem(key);
        if (!raw) return;
        var arr;
        try { arr = JSON.parse(raw); } catch(e) { return; }
        if (!Array.isArray(arr)) return;
        var before = arr.length;
        arr = arr.filter(function(v){
          var t = String((v && (v.title || v.job_title || v.name)) || '').trim().toLowerCase();
          return t !== 'اكس تري' && t !== 'x tree' && t !== 'x-tree' && t !== 'x  tree';
        });
        if (arr.length !== before) localStorage.setItem(key, JSON.stringify(arr));
      });
    } catch(e) {}
  }

  function ensureFreeSaveConfirmation(){
    if (document.getElementById('madkhalFreeSaveConfirmation')) return;
    var main = document.querySelector('main');
    if (!main) return;
    var screen = document.createElement('section');
    screen.id = 'madkhalFreeSaveConfirmation';
    screen.className = 'screen';
    screen.innerHTML = `
      <div class="card" style="text-align:center;padding:28px 20px;margin-top:20px;">
        <div style="font-size:46px;margin-bottom:10px;">✅</div>
        <h2 style="margin:0 0 12px;color:#0f766e;">تم إتمام العملية المجانية بنجاح</h2>
        <p style="margin:0 0 12px;line-height:1.9;color:#596666;">تم حفظ بياناتك بنجاح، وأصبحت جاهزًا لطلب الفرص المناسبة.</p>
        <p style="margin:0 0 22px;line-height:1.9;color:#596666;">يمكنك الاستمرار مجانًا. الاشتراك الشهري اختياري وليس إلزاميًا، ويمنحك مزايا إضافية مثل المتابعة المستمرة، المطابقة التلقائية مع الفرص الجديدة، الترتيب والتنبيهات.</p>
        <button type="button" class="primary-btn" id="madkhalFreeSaveSubscribe" style="width:100%;">⭐ الاشتراك</button>
      </div>`;
    main.appendChild(screen);
    var btn = document.getElementById('madkhalFreeSaveSubscribe');
    if (btn) btn.addEventListener('click', function(){
      if (typeof window.openSubscription === 'function') window.openSubscription();
      else if (typeof window.showScreen === 'function') window.showScreen('subscriptionScreen');
    });
  }

  function showFreeSaveConfirmation(){
    ensureFreeSaveConfirmation();
    var screen = document.getElementById('madkhalFreeSaveConfirmation');
    if (!screen) return;
    document.querySelectorAll('.screen.active').forEach(function(el){ el.classList.remove('active'); });
    screen.classList.add('active');
    setTimeout(function(){ settle('madkhalFreeSaveConfirmation'); }, 30);
  }

  cleanupFakeXTree();
  ensureFreeSaveConfirmation();

  if (typeof window.showScreen === 'function') {
    var originalShowScreen = window.showScreen;
    window.showScreen = function(id, anchorId){
      var result = originalShowScreen.apply(this, arguments);
      setTimeout(function(){ settle(id, anchorId); }, 60);
      setTimeout(function(){ settle(id, anchorId); }, 280);
      return result;
    };
  }

  document.addEventListener('click', function(event){
    var button = event.target.closest && event.target.closest('button');
    if (!button) return;

    var text = String(button.textContent || '').replace(/\s+/g, ' ').trim();

    if (text.indexOf('لدي فرصة عمل') !== -1) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (typeof window.openEmployer === 'function') window.openEmployer();
      else if (typeof window.showScreen === 'function') window.showScreen('employerScreen', 'employerName');
      setTimeout(function(){ settle('employerScreen', 'employerName'); }, 60);
      setTimeout(function(){ settle('employerScreen', 'employerName'); }, 280);
      return;
    }

    if (text.indexOf('حفظ البيانات لطلب الوظيفة') !== -1) {
      setTimeout(function(){
        showFreeSaveConfirmation();
      }, 650);
      return;
    }

    setTimeout(function(){
      var active = document.querySelector('.screen.active');
      if (!active) return;
      var anchor = active.id === 'profileScreen' ? document.getElementById('workerName') : active;
      if (!anchor) return;
      var top = window.pageYOffset + anchor.getBoundingClientRect().top - offset();
      window.scrollTo({top:Math.max(0, top), behavior:'auto'});
      if (active.id === 'profileScreen' && anchor.id === 'workerName') {
        try { anchor.focus({preventScroll:true}); } catch(e) {}
      }
    }, 120);
  }, true);
})();
</script>`;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))));
  self.clients.claim();
});

async function networkIndex(request) {
  const response = await fetch(request, {cache: "no-store"});
  if (!response || !response.ok) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  const html = await response.text();
  const patched = html.includes('</body>') ? html.replace('</body>', NAVIGATION_PATCH + '</body>') : html;
  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

self.addEventListener("fetch", event => {
  if (event.request.mode === "navigate") {
    event.respondWith(networkIndex(event.request).catch(() => caches.match(INDEX_URL)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});