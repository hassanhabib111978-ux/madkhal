/* MADKHAL_WORKER_SAVE_MESSAGE_V2 */
(function () {
  'use strict';
  if (window.__MADKHAL_WORKER_SAVE_MESSAGE__) return;
  window.__MADKHAL_WORKER_SAVE_MESSAGE__ = true;

  function render() {
    var screen = document.getElementById('madkhalFreeSaveConfirmation');
    if (!screen || screen.dataset.madkhalMessageV2 === '1') return;
    var card = screen.querySelector('.card');
    if (!card) return;

    card.innerHTML = `
      <div style="text-align:center;padding:4px 0;">
        <div style="font-size:46px;margin-bottom:10px;">✅</div>
        <h2 style="margin:0 0 14px;color:#0f766e;">تم حفظ ملفك وطلبك بنجاح</h2>
        <p style="margin:0 0 14px;line-height:1.95;color:#596666;">
          تم حفظ ملف الباحث الخاص بك في <strong>مَدخَل</strong> بنجاح، ويمكنك الآن استخدام المنصة والاستفادة من خدماتها الأساسية
          <strong>مجانًا ودون رسوم أو قيود على البحث</strong>.
        </p>
        <p style="margin:0 0 8px;line-height:1.95;color:#596666;"><strong>يمكنك بنفسك:</strong></p>
        <div style="text-align:right;margin:0 0 16px;line-height:2;color:#596666;">
          🔎 البحث في <strong>فهرس الوظائف والفرص الموجودة في مَدخَل</strong>.<br>
          📋 مراجعة تفاصيل الفرص والتدقيق فيها.<br>
          🎯 مطابقة الفرص مع مهاراتك وملفك.<br>
          📩 التقديم على الوظائف المناسبة <strong>مجانًا</strong>.<br>
          🔄 متابعة الفرص الجديدة والبحث عنها بنفسك كلما ظهرت.
        </div>
        <div style="height:1px;background:#e3ecea;margin:18px 0;"></div>
        <h3 style="margin:0 0 10px;color:#172121;">🔔 هل تريد أن يقوم مَدخَل بذلك نيابةً عنك؟</h3>
        <p style="margin:0 0 14px;line-height:1.95;color:#596666;">
          إذا رغبت، يمكنك الاشتراك في <strong>خدمة المتابعة المستمرة</strong>، وعندها يقوم مَدخَل بالبحث المستمر عن الفرص الجديدة،
          وتقييم مدى ملاءمتها لملفك ومهاراتك، وإجراء المطابقة، ثم <strong>إرسال تنبيه إليك عند ظهور فرصة مناسبة</strong>.
        </p>
        <p style="margin:0 0 20px;line-height:1.9;color:#596666;">
          هذه الخدمة <strong>اختيارية وغير ملزمة</strong>، أما البحث والتصفح والتقديم الأساسي فيبقى متاحًا لك مجانًا.
        </p>
        <button type="button" id="madkhalFreeSaveSubscribeV2" class="primary-btn" style="width:100%;">
          ⭐ الاشتراك في المتابعة المستمرة — دولار واحد شهريًا
        </button>
      </div>`;

    screen.dataset.madkhalMessageV2 = '1';

    var subscribe = document.getElementById('madkhalFreeSaveSubscribeV2');
    if (subscribe) subscribe.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.openSubscription === 'function') window.openSubscription();
      else if (typeof window.startSubscriptionRequest === 'function') window.startSubscriptionRequest();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
  new MutationObserver(render).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(render, 300);
  setTimeout(render, 1000);
})();
