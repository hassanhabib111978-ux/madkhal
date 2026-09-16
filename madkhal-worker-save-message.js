/* MADKHAL_WORKER_SAVE_MESSAGE_V1 */
(function () {
  'use strict';
  if (window.__MADKHAL_WORKER_SAVE_MESSAGE__) return;
  window.__MADKHAL_WORKER_SAVE_MESSAGE__ = true;

  function render() {
    var screen = document.getElementById('madkhalFreeSaveConfirmation');
    if (!screen || screen.dataset.madkhalMessageV1 === '1') return;
    var card = screen.querySelector('.card');
    if (!card) return;

    card.innerHTML = `
      <div style="text-align:center;padding:4px 0;">
        <div style="font-size:46px;margin-bottom:10px;">✅</div>
        <h2 style="margin:0 0 14px;color:#0f766e;">تم حفظ طلبك بنجاح</h2>
        <p style="margin:0 0 14px;line-height:1.95;color:#596666;">
          كل ما قمت به حتى الآن <strong>مجاني</strong>، وهذا هو أساس مَدخَل.
        </p>
        <p style="margin:0 0 16px;line-height:1.95;color:#596666;">
          يمكنك متابعة البحث عن الفرص، والتدقيق في تفاصيلها، والمطابقة مع مهاراتك
          <strong>مجانًا بنفسك</strong>، والاستفادة من الخدمات الأساسية في مَدخَل دون اشتراك.
        </p>
        <div style="height:1px;background:#e3ecea;margin:18px 0;"></div>
        <h3 style="margin:0 0 10px;color:#172121;">🔔 هل تريد أن نريحك من هذا العمل؟</h3>
        <p style="margin:0 0 12px;line-height:1.95;color:#596666;">
          يمكنك بدلًا من البحث والتدقيق والمطابقة بنفسك أن تترك هذه المهمة لـ<strong>مَدخَل</strong>.
          سنقوم بالبحث المستمر عن الفرص الجديدة، والتدقيق، والمطابقة مع ملفك ومهاراتك،
          وإرسال تنبيه لك عند ظهور فرصة مناسبة.
        </p>
        <p style="margin:0 0 20px;line-height:1.9;color:#596666;">
          هذه الميزة <strong>اختيارية وغير ملزمة</strong>، وقيمتها <strong>دولار واحد شهريًا</strong>.
        </p>
        <button type="button" id="madkhalFreeSaveSubscribeV1" class="primary-btn" style="width:100%;">
          ⭐ اشترك الآن — 1 دولار شهريًا
        </button>
        <button type="button" id="madkhalFreeSaveContinueV1" class="secondary-btn" style="width:100%;margin-top:10px;">
          🔎 أتابع مجانًا بنفسي
        </button>
      </div>`;

    screen.dataset.madkhalMessageV1 = '1';

    var subscribe = document.getElementById('madkhalFreeSaveSubscribeV1');
    if (subscribe) subscribe.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.openSubscription === 'function') window.openSubscription();
      else if (typeof window.startSubscriptionRequest === 'function') window.startSubscriptionRequest();
    });

    var continueButton = document.getElementById('madkhalFreeSaveContinueV1');
    if (continueButton) continueButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.openOpportunities === 'function') window.openOpportunities();
      else if (typeof window.showScreen === 'function') window.showScreen('opportunitiesScreen');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
  new MutationObserver(render).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(render, 300);
  setTimeout(render, 1000);
})();
