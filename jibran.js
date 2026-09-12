/* جُهينة — المساعد الذكي في مَدخَل */
(function () {
  'use strict';

  const STYLE = `
    #jibran-assistant { position: fixed !important; top: 78px !important; left: 14px !important; right: auto !important; z-index: 9999; direction: rtl; font-family: Arial, Tahoma, sans-serif; pointer-events: none; }
    #jibran-button { pointer-events: auto; display: flex; align-items: center; gap: 7px; border: 1px solid #cfe4e1; border-radius: 999px; padding: 9px 13px; background: rgba(255,255,255,.97); color: #0f766e; box-shadow: 0 7px 20px rgba(20,40,40,.12); font-weight: 800; font-size: 13px; cursor: pointer; transition: transform .15s, box-shadow .15s; }
    #jibran-button:hover { box-shadow: 0 9px 24px rgba(20,40,40,.16); }
    #jibran-button:active { transform: scale(.97); }
    #jibran-button[aria-pressed="true"] { box-shadow: 0 9px 24px rgba(20,40,40,.18); }
    @media (max-width: 430px) { #jibran-assistant { top: 70px !important; left: 10px !important; right: auto !important; } #jibran-button { padding: 8px 11px; font-size: 12px; } }
  `;

  const WELCOME = 'مرحبًا بك. أنا جُهينة، المساعدة الذكية في مَدْخَلْ.';
  const ERROR_WORDS = /(خطأ|فشل|تعذر|تعذّر|غير صالح|غير صحيح|مطلوب|يجب|لا يمكن|حدث خطأ|حدثت مشكلة|يرجى|اختر|أدخل|أكمِل|اكمل)/i;
  const ERROR_SELECTORS = '[role="alert"], [aria-live="assertive"], [aria-live="polite"], .error, .error-message, .field-error, .validation-error, .invalid-feedback, .form-error, .text-danger';

  const CONTEXTS = {
    profile: /(ملف الباحث|الاسم|الاسم الكامل|المعلومات الشخصية|الخبرة|السيرة)/i,
    skills: /(المهارات|مهارة|التخصص|الخبرات|قدراتك)/i,
    preferences: /(ما تبحث|أبحث عن عمل|نوع العمل|الوظيفة المطلوبة|التفضيلات|الموقع|الراتب)/i,
    matching: /(المطابقة|مطابقة|فرص مناسبة|نبحث لك|البحث عن فرصة)/i,
    jobs: /(الوظائف|الفرص|فرصة عمل|تفاصيل الوظيفة|الشواغر)/i,
    followup: /(المتابعة|التنبيهات|إشعار|إشعارات|متابعة الفرص)/i,
    employer: /(صاحب العمل|لدي فرصة عمل|نشر فرصة|إضافة وظيفة|بيانات الشركة)/i,
    subscription: /(الاشتراك|دولار ونصف|محفظة مَدخَل|المحفظة)/i
  };

  const GUIDANCE = {
    profile: 'أكملي ملفك أولًا، ثم ننتقل للخطوة التالية.',
    skills: 'أضيفي مهاراتك الأساسية، فهذا يساعد على دقة المطابقة.',
    preferences: 'حددي ما تبحثين عنه، وسأساعد في تضييق الفرص المناسبة.',
    matching: 'ملفك هو أساس المطابقة. اتركي مَدخَل يقارن الفرص المناسبة لك.',
    jobs: 'راجعي الفرصة ومتطلباتها، ثم اختاري الإجراء المناسب.',
    followup: 'المتابعة المستمرة والتنبيهات تساعدك على عدم تفويت الفرص الجديدة.',
    employer: 'أكملي بيانات الفرصة بوضوح حتى تصل للباحث المناسب.',
    subscription: 'الاشتراك مخصص للمتابعة المستمرة والتنبيهات.'
  };

  let lastMessage = '';
  let lastMessageAt = 0;
  let activeGuidance = '';
  let activeGuidanceAt = 0;
  let currentContext = 'idle';
  let lastContextAt = 0;
  let lastInterventionAt = 0;
  let userRequestedHelp = false;
  let observerStarted = false;

  function injectStyle() {
    if (document.getElementById('jibran-style')) return;
    const style = document.createElement('style');
    style.id = 'jibran-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function chooseArabicFemaleVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const arabic = voices.filter(v => /^ar(-|$)/i.test(v.lang || ''));
    if (!arabic.length) return null;
    const femaleHints = /(female|woman|zira|laila|نورا|هدى|ليلى|أنثى|انثى|امرأة|امراة)/i;
    return arabic.find(v => femaleHints.test(v.name || '')) || arabic[0];
  }

  function speak(text, options) {
    if (!('speechSynthesis' in window)) return false;
    const value = String(text || '').trim();
    if (!value) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(value);
    const voice = chooseArabicFemaleVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang || 'ar-SA'; }
    else u.lang = 'ar-SA';
    u.rate = options && options.rate ? options.rate : 0.9;
    u.pitch = 1.08;
    u.volume = 1;
    window.speechSynthesis.speak(u);
    return true;
  }

  function textOf(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 140) return '';
    return text;
  }

  function detectContext() {
    const active = document.activeElement;
    const parts = [];
    if (active) {
      parts.push(active.getAttribute && active.getAttribute('placeholder'));
      parts.push(active.getAttribute && active.getAttribute('aria-label'));
      parts.push(active.name);
    }
    const visible = Array.from(document.querySelectorAll('h1,h2,h3,h4,label,button')).filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).slice(0, 80);
    visible.forEach(el => parts.push(textOf(el)));
    const haystack = parts.filter(Boolean).join(' ');
    for (const key of Object.keys(CONTEXTS)) if (CONTEXTS[key].test(haystack)) return key;
    return currentContext;
  }

  function setContext(context) {
    if (!context || !Object.prototype.hasOwnProperty.call(CONTEXTS, context)) return false;
    currentContext = context;
    lastContextAt = Date.now();
    return true;
  }

  function rememberGuidance(message, type) {
    const raw = String(message || '').replace(/\s+/g, ' ').trim();
    if (!raw) return false;
    const now = Date.now();
    const isError = type === 'error' || ERROR_WORDS.test(raw);
    if (isError) {
      if (raw === lastMessage && now - lastMessageAt < 2500) return false;
      lastMessage = raw;
      lastMessageAt = now;
      activeGuidance = raw.length > 90 ? 'حدث خطأ. راجعي البيانات وحاولي مرة أخرى.' : (/مطلوب|يجب|أدخل|أكمِل|اكمل|اختر/i.test(raw) ? raw : 'حدث خطأ. حاولي مرة أخرى.');
      activeGuidanceAt = now;
      if (now - lastInterventionAt > 1800) { lastInterventionAt = now; speak(activeGuidance, {rate: 0.92}); }
      return true;
    }
    activeGuidance = raw;
    activeGuidanceAt = now;
    return true;
  }

  function intervene(reason, message, force) {
    const now = Date.now();
    if (!force && now - lastInterventionAt < 2500) return false;
    const value = String(message || '').trim();
    if (!value) return false;
    lastInterventionAt = now;
    activeGuidance = value;
    activeGuidanceAt = now;
    return speak(value, {rate: 0.9});
  }

  function decide(event, detail) {
    const data = detail || {};
    if (event === 'error') return {priority: 100, action: 'speak', message: data.message || 'حدث خطأ. حاولي مرة أخرى.'};
    if (event === 'invalid') return {priority: 90, action: 'speak', message: data.message || 'أكملي الحقل المطلوب.'};
    if (event === 'help') return {priority: 80, action: 'speak', message: data.message || GUIDANCE[currentContext] || WELCOME};
    if (event === 'success') return {priority: 40, action: 'speak', message: data.message || 'تمت الخطوة بنجاح.'};
    if (event === 'stalled') return {priority: 30, action: 'speak', message: data.message || GUIDANCE[currentContext]};
    return {priority: 0, action: 'silent', message: ''};
  }

  function handleEvent(event, detail) {
    const decision = decide(event, detail);
    if (decision.action === 'silent' || !decision.message) return false;
    if (event === 'error' || event === 'invalid') return rememberGuidance(decision.message, 'error');
    if (event === 'help') userRequestedHelp = true;
    return intervene(event, decision.message, event === 'help');
  }

  function inspectElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (el.id === 'jibran-assistant' || (el.closest && el.closest('#jibran-assistant'))) return false;
    const direct = textOf(el);
    if (el.matches && el.matches(ERROR_SELECTORS) && direct) return handleEvent('error', {message: direct});
    if (el.querySelectorAll) {
      const matches = el.querySelectorAll(ERROR_SELECTORS);
      for (const child of matches) { const text = textOf(child); if (text && handleEvent('error', {message: text})) return true; }
    }
    return false;
  }

  function inspectMutationTarget(target) {
    if (!target) return false;
    const el = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
    if (!el) return false;
    if (inspectElement(el)) return true;
    const text = textOf(el);
    if (text && text.length <= 100 && ERROR_WORDS.test(text)) {
      const children = el.children ? Array.from(el.children) : [];
      if (!children.length || children.length <= 2) return handleEvent('error', {message: text});
    }
    return false;
  }

  function watchVisibleErrors() {
    if (observerStarted || !('MutationObserver' in window) || !document.body) return;
    observerStarted = true;
    const observer = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') { if (inspectMutationTarget(mutation.target)) break; }
        else {
          let found = false;
          if (mutation.addedNodes) mutation.addedNodes.forEach(node => { if (!found && node.nodeType === Node.ELEMENT_NODE) found = inspectElement(node); if (!found && node.nodeType === Node.TEXT_NODE) found = inspectMutationTarget(node); });
          if (!found) found = inspectMutationTarget(mutation.target);
          if (found) break;
        }
      }
    });
    observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['class','aria-invalid','role','aria-live']});
  }

  function watchErrors() {
    document.addEventListener('invalid', function (event) { handleEvent('invalid', {message: 'أكملي الحقل المطلوب.'}); }, true);
    const originalAlert = window.alert;
    window.alert = function (message) { handleEvent('error', {message}); return originalAlert.apply(window, arguments); };
    window.addEventListener('error', function () { handleEvent('error', {message:'حدث خطأ. حاولي مرة أخرى.'}); });
    window.addEventListener('unhandledrejection', function () { handleEvent('error', {message:'تعذر إكمال الخطوة. حاولي مرة أخرى.'}); });
    watchVisibleErrors();
  }

  function watchContext() {
    document.addEventListener('focusin', function () { currentContext = detectContext(); });
    document.addEventListener('click', function (event) {
      const target = event.target && event.target.closest ? event.target.closest('button,a') : null;
      if (!target) return;
      currentContext = detectContext();
    }, true);
  }

  function mount() {
    if (document.getElementById('jibran-assistant')) return;
    injectStyle();
    watchErrors();
    watchContext();
    const root = document.createElement('div');
    root.id = 'jibran-assistant';
    root.innerHTML = `<button id="jibran-button" type="button" aria-label="المساعد الذكي" aria-pressed="false"><span aria-hidden="true">🧠</span><span>المساعد الذكي</span></button>`;
    document.body.appendChild(root);
    const button = document.getElementById('jibran-button');
    button.addEventListener('click', function () {
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); button.setAttribute('aria-pressed','false'); return; }
      currentContext = detectContext();
      const now = Date.now();
      const recentGuidance = activeGuidance && now - activeGuidanceAt < 15000;
      const started = recentGuidance ? speak(activeGuidance) : handleEvent('help', {message: GUIDANCE[currentContext] || WELCOME});
      button.setAttribute('aria-pressed', started ? 'true' : 'false');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  window.MadkhalJibran = {
    speak,
    setContext,
    decide,
    handleEvent,
    guide: function(message) { return handleEvent('help', {message}); },
    notifySuccess: function(message) { return handleEvent('success', {message}); },
    notifyError: function(message) { return handleEvent('error', {message}); },
    version: '0.7.0',
    role: 'المساعد الذكي — جُهينة — مرافقة مختصرة لمسار مَدخَل'
  };
})();
