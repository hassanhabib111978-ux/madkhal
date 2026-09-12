/* جُهينة — المساعد الذكي في مَدخَل */
(function () {
  'use strict';

  const STYLE = `
    #jibran-assistant {
      position: fixed;
      top: 78px;
      left: 14px;
      right: auto;
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
      #jibran-assistant { top: 70px; left: 10px; right: auto; }
      #jibran-button { padding: 8px 11px; font-size: 12px; }
    }
  `;

  const WELCOME = 'مرحبًا بك. أنا جُهينة، المساعدة الذكية في مَدْخَلْ. سأرافقك بهدوء ووضوح في رحلتك للعثور على فرصة العمل المناسبة لك.';

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

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      alert('الصوت غير مدعوم في هذا المتصفح. جرّبي Chrome على الهاتف.');
      return false;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = chooseArabicFemaleVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'ar-SA';
    } else {
      u.lang = 'ar-SA';
    }
    u.rate = 0.9;
    u.pitch = 1.08;
    u.volume = 1;
    window.speechSynthesis.speak(u);
    return true;
  }

  function mount() {
    if (document.getElementById('jibran-assistant')) return;
    injectStyle();

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
    version: '0.3.2',
    role: 'المساعد الذكي — جُهينة — مرافق ودليل بصوت أنثوي هادئ'
  };
})();
