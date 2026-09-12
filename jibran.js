/* جُهينة — المساعد الذكي في مَدخَل */
(function () {
  'use strict';

  const STYLE = `
    #jibran-assistant {
      position: fixed !important;
      top: 78px !important;
      left: 14px !important;
      right: auto !important;
      z-index: 9999;
      direction: rtl;
      font-family: Arial, Tahoma, sans-serif;
      pointer-events: none;
    }
    #jibran-button {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 7px;
      border: 1px solid #cfe4e1;
      border-radius: 999px;
      padding: 9px 13px;
      background: rgba(255,255,255,.97);
      color: #0f766e;
      box-shadow: 0 7px 20px rgba(20,40,40,.12);
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
      transition: transform .15s, box-shadow .15s;
    }
    #jibran-button:hover { box-shadow: 0 9px 24px rgba(20,40,40,.16); }
    #jibran-button:active { transform: scale(.97); }
    #jibran-button[aria-pressed="true"] { box-shadow: 0 9px 24px rgba(20,40,40,.18); }
    @media (max-width: 430px) {
      #jibran-assistant { top: 70px !important; left: 10px !important; right: auto !important; }
      #jibran-button { padding: 8px 11px; font-size: 12px; }
    }
  `;

  const WELCOME = 'مرحبًا بك. أنا جُهينة، المساعدة الذكية في مَدْخَلْ.';
  const ERROR_WORDS = /(خطأ|فشل|تعذر|تعذّر|غير صالح|غير صحيح|مطلوب|يجب|لا يمكن|حدث خطأ|حدثت مشكلة|يرجى|اختر|أدخل|أكمِل|اكمل)/i;
  let lastMessage = '';
  let lastMessageAt = 0;

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
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'ar-SA';
    } else {
      u.lang = 'ar-SA';
    }
    u.rate = options && options.rate ? options.rate : 0.9;
    u.pitch = 1.08;
    u.volume = 1;
    window.speechSynthesis.speak(u);
    return true;
  }

  function speakError(message) {
    const raw = String(message || '').replace(/\s+/g, ' ').trim();
    if (!raw || !ERROR_WORDS.test(raw)) return;
    const now = Date.now();
    if (raw === lastMessage && now - lastMessageAt < 2500) return;
    lastMessage = raw;
    lastMessageAt = now;
    let short = raw;
    if (raw.length > 90) short = 'حدث خطأ. راجعي البيانات وحاولي مرة أخرى.';
    else if (/مطلوب|يجب|أدخل|أكمِل|اكمل|اختر/i.test(raw)) short = raw;
    else if (/فشل|تعذر|تعذّر|لا يمكن|حدث خطأ|حدثت مشكلة/i.test(raw)) short = 'حدث خطأ. حاولي مرة أخرى.';
    speak(short, {rate: 0.92});
  }

  function watchErrors() {
    document.addEventListener('invalid', function () {
      speak('أكملي الحقل المطلوب.', {rate: 0.92});
    }, true);

    const originalAlert = window.alert;
    window.alert = function (message) {
      speakError(message);
      return originalAlert.apply(window, arguments);
    };

    window.addEventListener('error', function () {
      speak('حدث خطأ. حاولي مرة أخرى.', {rate: 0.92});
    });

    window.addEventListener('unhandledrejection', function () {
      speak('تعذر إكمال الخطوة. حاولي مرة أخرى.', {rate: 0.92});
    });
  }

  function mount() {
    if (document.getElementById('jibran-assistant')) return;
    injectStyle();
    watchErrors();

    const root = document.createElement('div');
    root.id = 'jibran-assistant';
    root.innerHTML = `
      <button id="jibran-button" type="button" aria-label="المساعد الذكي" aria-pressed="false">
        <span aria-hidden="true">🧠</span><span>المساعد الذكي</span>
      </button>
    `;
    document.body.appendChild(root);

    const button = document.getElementById('jibran-button');
    button.addEventListener('click', function () {
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        button.setAttribute('aria-pressed', 'false');
        return;
      }
      const started = speak(WELCOME);
      button.setAttribute('aria-pressed', started ? 'true' : 'false');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  window.MadkhalJibran = {
    speak,
    version: '0.4.0',
    role: 'المساعد الذكي — جُهينة — مرافق مختصر لمسار مَدخَل'
  };
})();
