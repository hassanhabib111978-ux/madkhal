/* جبران — مرافق مَدخَل */
(function () {
  'use strict';

  const STYLE = `
    #jibran-assistant {
      position: fixed;
      top: 76px;
      right: 14px;
      z-index: 9999;
      direction: rtl;
      font-family: Arial, Tahoma, sans-serif;
    }
    #jibran-button {
      display: flex;
      align-items: center;
      gap: 7px;
      border: 1px solid #cfe4e1;
      border-radius: 999px;
      padding: 9px 12px;
      background: rgba(255,255,255,.96);
      color: #0f766e;
      box-shadow: 0 7px 20px rgba(20,40,40,.12);
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
      transition: transform .15s, box-shadow .15s;
    }
    #jibran-button:hover { box-shadow: 0 9px 24px rgba(20,40,40,.16); }
    #jibran-button:active { transform: scale(.97); }
    #jibran-panel {
      display: none;
      width: min(300px, calc(100vw - 28px));
      margin-top: 8px;
      padding: 14px;
      border: 1px solid #dbe8e6;
      border-radius: 18px;
      background: rgba(255,255,255,.98);
      box-shadow: 0 12px 35px rgba(20,40,40,.16);
    }
    #jibran-panel.open { display: block; }
    #jibran-panel strong { color:#0f766e; display:block; margin-bottom:5px; }
    #jibran-panel p { margin:0; color:#536161; line-height:1.7; font-size:13px; }
    @media (max-width: 430px) {
      #jibran-assistant { top: 70px; right: 10px; }
      #jibran-button { padding: 8px 10px; font-size: 12px; }
    }
  `;

  function injectStyle() {
    if (document.getElementById('jibran-style')) return;
    const style = document.createElement('style');
    style.id = 'jibran-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      alert('الصوت غير مدعوم في هذا المتصفح. جرّب Chrome على الهاتف.');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ar-SA';
    u.rate = 0.9;
    u.pitch = 1;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  }

  function mount() {
    if (document.getElementById('jibran-assistant')) return;
    injectStyle();

    const root = document.createElement('div');
    root.id = 'jibran-assistant';
    root.innerHTML = `
      <div id="jibran-panel" aria-live="polite">
        <strong>جبران — مرافقك في مَدخَل</strong>
        <p>أنا هنا عندما تحتاج إلى مساعدة، وسأبقى هادئًا عندما تسير الأمور بشكل صحيح.</p>
      </div>
      <button id="jibran-button" type="button" aria-label="تحدث مع جبران">
        <span aria-hidden="true">🎙️</span><span>جبران</span>
      </button>
    `;
    document.body.appendChild(root);

    const button = document.getElementById('jibran-button');
    const panel = document.getElementById('jibran-panel');
    button.addEventListener('click', function () {
      panel.classList.toggle('open');
      speak('مرحبًا بك، أنا جبران. سأرافقك بهدوء في رحلتك للبحث عن فرصة مناسبة لك. لن أتدخل إلا عندما تحتاج إلى مساعدتي.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  window.MadkhalJibran = {
    speak,
    version: '0.2.0',
    role: 'مرافق ودليل ذكي — صلاحيات محدودة'
  };
})();
