/* مَدخَل — طبقة الدفع المرنة v1
   المسار: شام كاش → سيرياتيل كاش → مزود دفع مرخص → بطاقات.
   لا يحتوي هذا الملف على أرقام محافظ أو مفاتيح API حقيقية.
*/
(function(){
  "use strict";

  const METHODS = {
    sham_cash: {
      label: "شام كاش",
      icon: "🟠",
      state: "primary",
      note: "الوسيلة الأساسية في الإصدار التجريبي."
    },
    syriatel_cash: {
      label: "سيرياتيل كاش",
      icon: "🟢",
      state: "fallback",
      note: "البديل الأول إذا تعذر تشغيل شام كاش."
    },
    licensed_provider: {
      label: "مزود دفع مرخّص",
      icon: "🏦",
      state: "future",
      note: "مسار قابل للإضافة لاحقًا دون تغيير نظام الاشتراك."
    },
    mtn_cash: {
      label: "MTN كاش",
      icon: "🔵",
      state: "future",
      note: "يُفعّل لاحقًا بعد التحقق من قناة تجارية/API مناسبة."
    },
    cards: {
      label: "بطاقة دفع",
      icon: "💳",
      state: "future",
      note: "خيار مستقبلي بعد توفر قناة مناسبة لمَدخَل."
    }
  };

  function esc(v){
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function savePaymentState(method, status, reference){
    const state = {
      method: method || "",
      status: status || "pending",
      reference: reference || "",
      updated_at: new Date().toISOString()
    };
    try{ localStorage.setItem("madkhal_payment_request_v2", JSON.stringify(state)); }catch(e){}
    return state;
  }

  function getPaymentState(){
    try{
      return JSON.parse(localStorage.getItem("madkhal_payment_request_v2") || "null");
    }catch(e){ return null; }
  }

  function renderPaymentPanel(){
    const old = document.getElementById("madkhalPaymentMethods");
    if(!old) return;

    const selected = getPaymentState()?.method || "";
    old.innerHTML =
      '<h3>💳 اختر طريقة الدفع</h3>' +
      '<p>الاشتراك <strong>$1 شهريًا</strong>. نبدأ بالمسار المحلي، ويمكن تبديل مزود الدفع لاحقًا دون تغيير اشتراكك.</p>' +
      '<div class="payment-methods" id="madkhalPaymentChoices">' +
      Object.entries(METHODS).map(([key,m]) =>
        '<button type="button" class="secondary-btn payment-method '+(selected===key?"selected":"")+'" data-payment-method="'+key+'">'+
        esc(m.icon+" "+m.label) +
        '<small>'+esc(m.state==="future"?"لاحقًا":m.note)+'</small></button>'
      ).join("") +
      '</div>' +
      '<div id="paymentMethodStatus" class="notice">'+
      (selected && METHODS[selected] ? "✓ تم اختيار "+esc(METHODS[selected].label) : "اختر وسيلة الدفع للمتابعة.")+
      '</div>' +
      '<div id="paymentReferenceBox" class="form-group hidden" style="margin-top:10px">' +
        '<label>رقم العملية / المرجع</label>' +
        '<input id="paymentReference" inputmode="numeric" autocomplete="off" placeholder="أدخله بعد تنفيذ التحويل">' +
        '<div class="notice">لن نفعّل الاشتراك بمجرد إدخال الرقم. يبقى الطلب قيد التحقق حتى تأكيد عملية الدفع.</div>' +
      '</div>' +
      '<button id="paymentContinueButton" type="button" class="primary-btn" style="width:100%;margin-top:10px">💳 متابعة الدفع — $1</button>' +
      '<div id="paymentSafetyNote" class="notice">لا تدخل كلمة مرور محفظتك هنا. مَدخَل سيحتاج لاحقًا إلى رقم المحفظة/QR التجاري الخاص به فقط.</div>';

    old.querySelectorAll("[data-payment-method]").forEach(btn=>{
      btn.addEventListener("click", function(){
        window.selectPaymentMethod(this.getAttribute("data-payment-method"));
      });
    });
    const cont = document.getElementById("paymentContinueButton");
    if(cont) cont.addEventListener("click", window.startLocalPayment);
    if(selected) window.selectPaymentMethod(selected, true);
  }

  window.selectPaymentMethod = function(method, silent){
    const m = METHODS[method];
    if(!m) return;
    try{ localStorage.setItem("madkhal_payment_method", method); }catch(e){}
    const state = savePaymentState(method, "pending", getPaymentState()?.reference || "");
    document.querySelectorAll("#madkhalPaymentChoices .payment-method").forEach(b=>{
      b.classList.toggle("selected", b.getAttribute("data-payment-method")===method);
    });
    const status = document.getElementById("paymentMethodStatus");
    const refBox = document.getElementById("paymentReferenceBox");
    const ref = document.getElementById("paymentReference");
    if(status){
      if(m.state==="future"){
        status.textContent = m.label+" محفوظ كخيار مستقبلي. في الإصدار الحالي نستخدم شام كاش ثم سيرياتيل كاش.";
      }else{
        status.textContent = "✓ "+m.label+" — "+m.note;
      }
    }
    if(refBox) refBox.classList.toggle("hidden", m.state==="future");
    if(ref) ref.value = state.reference || "";
    if(!silent && typeof showToast==="function"){
      showToast(m.state==="future" ? "ℹ️ هذا المسار سيُفعّل لاحقًا." : "✓ تم اختيار "+m.label);
    }
  };

  window.startLocalPayment = async function(){
    const method = getPaymentState()?.method || localStorage.getItem("madkhal_payment_method") || "";
    const m = METHODS[method];
    if(!m){
      if(typeof showToast==="function") showToast("اختر طريقة الدفع أولًا.");
      return;
    }
    if(m.state==="future"){
      if(typeof showToast==="function") showToast("ℹ️ هذا الخيار محفوظ للمرحلة اللاحقة.");
      return;
    }

    const reference = (document.getElementById("paymentReference")?.value || "").trim();
    savePaymentState(method, "pending", reference);

    // نستخدم مسار الاشتراك الموجود أصلًا لتسجيل طلب الاشتراك،
    // لكن لا نغيّر حالته إلى active ولا ندّعي نجاح الدفع.
    try{
      if(typeof startSubscriptionRequest==="function"){
        await startSubscriptionRequest();
      }
    }catch(e){}

    const label = m.label;
    if(reference){
      savePaymentState(method, "awaiting_verification", reference);
      if(typeof addLocalNotification==="function"){
        addLocalNotification("💳 تم إرسال طلب تحقق من دفع اشتراك مَدخَل عبر "+label+" — المرجع: "+reference);
      }
      if(typeof showToast==="function"){
        showToast("✅ تم تسجيل المرجع. الاشتراك ينتظر التحقق من الدفع.");
      }
    }else{
      if(typeof addLocalNotification==="function"){
        addLocalNotification("💳 تم اختيار "+label+" لطلب اشتراك مَدخَل. أضف رقم العملية بعد التحويل.");
      }
      if(typeof showToast==="function"){
        showToast("💳 تم تسجيل وسيلة الدفع. بعد التحويل أضف رقم العملية للتحقق.");
      }
    }
    if(typeof renderSubscription==="function") renderSubscription();
  };

  // نجعل واجهة الدفع مستقلة عن أخطاء علامات الاقتباس القديمة في HTML.
  document.addEventListener("DOMContentLoaded", function(){
    renderPaymentPanel();
  });
})();
