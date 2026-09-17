/* MADKHAL_WORKER_SAVE_MESSAGE_V5 */
(function () {
  'use strict';
  if (window.__MADKHAL_WORKER_SAVE_MESSAGE_V5__) return;
  window.__MADKHAL_WORKER_SAVE_MESSAGE_V5__ = true;

  function getClient() {
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        window.supabaseClient = window.supabase.createClient(
          'https://qbufsdpdobuicpljnssr.supabase.co',
          'sb_publishable_mcPmNU2CGJkiSbfgOD6gOg_9RNMNlEY'
        );
        return window.supabaseClient;
      } catch (_) {}
    }
    return null;
  }

  async function saveWasReallyCompleted() {
    var client = getClient();
    if (!client) return false;
    var sessionResult = await client.auth.getSession();
    var user = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.user;
    if (!user) return false;
    var result = await client.from('worker_profiles')
      .select('id,full_name,location,occupation_uri,profession')
      .eq('user_id', user.id)
      .maybeSingle();
    if (result.error || !result.data) return false;
    var p = result.data;
    return !!(String(p.full_name || '').trim() && String(p.location || '').trim() &&
      (String(p.occupation_uri || '').trim() || String(p.profession || '').trim()));
  }

  function restoreWorkerScreen() {
    var confirmation = document.getElementById('madkhalFreeSaveConfirmation');
    if (confirmation) confirmation.classList.remove('active');
    var worker = document.getElementById('workerScreen') || document.getElementById('workerProfileScreen');
    if (worker) worker.classList.add('active');
    window.__MADKHAL_WORKER_SAVE_FLOW__ = false;
  }

  async function verifyConfirmation() {
    var screen = document.getElementById('madkhalFreeSaveConfirmation');
    if (!screen || !screen.classList.contains('active') || screen.dataset.madkhalVerified === '1' || screen.dataset.madkhalVerifying === '1') return;
    screen.dataset.madkhalVerifying = '1';
    try {
      var ok = await saveWasReallyCompleted();
      if (ok) {
        screen.dataset.madkhalVerified = '1';
      } else {
        screen.dataset.madkhalVerified = '0';
        restoreWorkerScreen();
        var status = document.getElementById('madkhalOccupationStatus');
        if (status) status.textContent = 'لم يتم حفظ ملف الباحث بنجاح. راجع البيانات وحاول الحفظ مرة أخرى.';
        alert('لم يتم تأكيد حفظ ملف الباحث في قاعدة البيانات. لم نعتبر العملية ناجحة.');
      }
    } catch (error) {
      console.warn('Madkhal save verification:', error);
    } finally {
      screen.dataset.madkhalVerifying = '0';
    }
  }

  function render() {
    var screen = document.getElementById('madkhalFreeSaveConfirmation');
    if (!screen) return;
    var card = screen.querySelector('.card');
    if (!card || screen.dataset.madkhalMessageV5 === '1') return;

    card.innerHTML = `
      <div style="text-align:center;padding:4px 0;">
        <div style="font-size:46px;margin-bottom:10px;">✅</div>
        <h2 style="margin:0 0 14px;color:#0f766e;">تم حفظ ملفك وطلبك بنجاح</h2>
        <p style="margin:0 0 14px;line-height:1.95;color:#596666;">
          تم حفظ ملف الباحث الخاص بك في <strong>مَدخَل</strong> بنجاح، ويمكنك الآن استخدام المنصة والاستفادة من خدماتها الأساسية مجانًا ودون رسوم أو قيود على البحث.
        </p>
        <p style="margin:0 0 8px;line-height:1.95;color:#596666;"><strong>يمكنك بنفسك:</strong></p>
        <div style="text-align:right;margin:0 0 16px;line-height:2;color:#596666;">
          🔎 البحث في فهرس الوظائف والفرص الموجودة في مَدخَل.<br>
          📋 مراجعة تفاصيل الفرص والتدقيق فيها.<br>
          🎯 مطابقة الفرص مع مهاراتك وملفك.<br>
          📩 التقديم على الوظائف المناسبة مجانًا.<br>
          🔄 متابعة الفرص الجديدة والبحث عنها بنفسك كلما ظهرت.
        </div>
        <div style="height:1px;background:#e3ecea;margin:18px 0;"></div>
        <h3 style="margin:0 0 10px;color:#172121;">🔔 هل تريد أن يقوم مَدخَل بذلك نيابةً عنك؟</h3>
        <p style="margin:0 0 20px;line-height:1.95;color:#596666;">
          إذا رغبت، يمكنك الاشتراك في خدمة المتابعة المستمرة، وعندها يقوم مَدخَل بالبحث المستمر عن الفرص الجديدة، وتقييم مدى ملاءمتها لملفك ومهاراتك، وإجراء المطابقة، ثم إرسال تنبيه إليك عند ظهور فرصة مناسبة.
        </p>
        <button type="button" id="madkhalFreeSaveSubscribeV5" class="primary-btn" style="width:100%;">
          ⭐ الاشتراك في المتابعة المستمرة — دولار واحد شهريًا
        </button>
      </div>`;

    screen.dataset.madkhalMessageV5 = '1';
    var subscribe = document.getElementById('madkhalFreeSaveSubscribeV5');
    if (subscribe) subscribe.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.openSubscription === 'function') window.openSubscription();
      else if (typeof window.startSubscriptionRequest === 'function') window.startSubscriptionRequest();
    });
  }

  render();
  setTimeout(render, 300);
  setTimeout(render, 1000);
  setTimeout(verifyConfirmation, 700);
  setTimeout(verifyConfirmation, 1800);
})();
