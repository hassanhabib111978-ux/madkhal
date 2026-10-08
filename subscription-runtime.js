/* MADKHAL_SUBSCRIPTION_RUNTIME_V1 — unified subscription state and safe payment-request UX */
(function(){
  "use strict";

  const LS_KEY="madkhal_subscription_status";
  const PAYMENT_KEY="madkhal_payment_method";
  const PROFILE_CONFIRM_KEY="madkhal_worker_confirmed";

  function lsGet(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}}
  function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  function now(){return new Date().toISOString()}

  async function sessionUser(){
    try{
      const r=await supabaseClient.auth.getSession();
      return r?.data?.session?.user||null;
    }catch(e){return null}
  }

  async function getSubscription(){
    try{
      const r=await supabaseClient.rpc("get_my_subscription");
      if(r.error) return null;
      return Array.isArray(r.data)?(r.data[0]||null):(r.data||null);
    }catch(e){return null}
  }

  function isActive(s){
    if(!s) return false;
    if(s.status!=="active") return false;
    if(s.ends_at && new Date(s.ends_at)<=new Date()) return false;
    return true;
  }

  async function syncSubscriptionRemote(){
    const s=await getSubscription();
    const status=s?.status||"inactive";
    lsSet(LS_KEY,status);
    lsSet("madkhal_subscription_ends_at",s?.ends_at||"");
    renderSubscription(s);
    return s;
  }

  async function syncSubscriptionStatus(){
    return await syncSubscriptionRemote();
  }

  function renderSubscription(remote){
    const screen=document.getElementById("subscriptionScreen");
    const statusBox=document.getElementById("subscriptionStatus");
    const accountBox=document.getElementById("accountSubscriptionStatus");
    const s=remote||null;
    const active=isActive(s);
    const requested=s?.status==="requested";
    const end=s?.ends_at?new Date(s.ends_at).toLocaleDateString("ar-EG"):"";
    const confirmed=lsGet(PROFILE_CONFIRM_KEY,"") === "1" ||
      lsGet("madkhal_worker_confirmation_version","") === "dastoor-v2";

    let message;
    if(active){
      message="✅ المتابعة الذكية مفعّلة حتى "+(end||"إشعار آخر").toString()+".";
    }else if(requested){
      message="⏳ طلب الاشتراك مسجل وينتظر التحقق من الدفع. لا نعتبره اشتراكًا فعالًا قبل التحقق.";
    }else if(!confirmed){
      message="🔒 أكمل ملفك المهني واحفظه ثم أكد صحة بياناتك مجانًا قبل طلب الاشتراك.";
    }else{
      message="الاشتراك غير مفعل. البحث والتصفح والتقديم الأساسي متاح مجانًا.";
    }

    if(statusBox) statusBox.textContent=message;
    if(accountBox) accountBox.textContent=message;

    const pay=document.getElementById("paymentContinueButton");
    if(pay){
      pay.disabled=active||requested||!confirmed;
      pay.textContent=active?"✅ الاشتراك مفعل":requested?"⏳ بانتظار التحقق":"💳 طلب المتابعة — $1";
    }

    if(screen){
      const button=screen.querySelector('[onclick="startSubscriptionRequest()"]');
      if(button){
        button.disabled=active||requested||!confirmed;
        button.textContent=active?"✅ الاشتراك مفعل":requested?"⏳ الطلب قيد التحقق":"🔔 تفعيل المتابعة — $1 شهريًا";
      }
    }
    return active;
  }

  async function startSubscriptionRequest(){
    const confirmed=lsGet(PROFILE_CONFIRM_KEY,"")==="1" ||
      lsGet("madkhal_worker_confirmation_version","")==="dastoor-v2";
    if(!confirmed){
      if(typeof showToast==="function")showToast("⚠️ أكمل الملف ثم أكد بياناتك مجانًا أولًا.");
      return false;
    }

    const existing=await getSubscription();
    if(isActive(existing)){
      lsSet(LS_KEY,"active");renderSubscription(existing);
      if(typeof showToast==="function")showToast("🔔 اشتراكك مفعل بالفعل.");
      return true;
    }

    const user=await sessionUser();
    if(!user){
      if(typeof showToast==="function")showToast("🔐 سجّل الدخول أولًا.");
      return false;
    }

    const provider=lsGet(PAYMENT_KEY,"manual");
    const profileQ=await supabaseClient.from("profiles")
      .select("id").eq("auth_user_id",user.id).maybeSingle();
    if(profileQ.error||!profileQ.data){
      if(typeof showToast==="function")showToast("⚠️ تعذر العثور على ملف الحساب.");
      return false;
    }

    const row={
      user_id:profileQ.data.id,
      plan:"monthly",
      audience:"worker",
      status:"requested",
      requested_at:now(),
      price_usd:1,
      currency:"USD",
      auto_renew:false,
      provider,
      metadata:{payment_method:provider,payment_status:"pending",version:"runtime-v1"},
      updated_at:now()
    };

    const up=await supabaseClient.from("subscriptions")
      .upsert(row,{onConflict:"user_id,audience"});
    if(up.error){
      console.warn("subscription request",up.error);
      if(typeof showToast==="function")showToast("⚠️ تعذر تسجيل طلب الاشتراك.");
      return false;
    }

    lsSet(LS_KEY,"requested");
    lsSet("madkhal_payment_status","pending");
    renderSubscription({status:"requested",plan:"monthly",ends_at:null});

    if(typeof addLocalNotification==="function")
      addLocalNotification("💳 تم تسجيل طلب متابعة مَدخَل — $1 شهريًا. بانتظار التحقق من الدفع.");
    if(typeof showToast==="function")
      showToast("✅ تم تسجيل الطلب. التفعيل بعد التحقق من الدفع.");
    return true;
  }

  async function startLocalPayment(){
    const method=lsGet(PAYMENT_KEY,"");
    if(!method){
      if(typeof showToast==="function")showToast("اختر وسيلة الدفع أولًا.");
      return;
    }
    lsSet(PAYMENT_KEY,method);
    const ok=await startSubscriptionRequest();
    if(!ok)return;

    const ref=(document.getElementById("paymentReference")?.value||"").trim();
    if(ref)lsSet("madkhal_payment_reference",ref);

    if(typeof showToast==="function"){
      showToast(ref
        ?"✅ تم تسجيل المرجع. الاشتراك ينتظر التحقق."
        :"💳 تم تسجيل طلب الاشتراك. بعد التحويل أضف رقم العملية للتحقق.");
    }
  }

  window.syncSubscriptionRemote=syncSubscriptionRemote;
  window.syncSubscriptionStatus=syncSubscriptionStatus;
  window.renderSubscription=renderSubscription;
  window.startSubscriptionRequest=startSubscriptionRequest;
  window.startLocalPayment=startLocalPayment;

  document.addEventListener("DOMContentLoaded",function(){
    setTimeout(function(){
      syncSubscriptionRemote();
      // Jibran must respect the same paid/free boundary as the matching engine.
      if(typeof window.askJibran==="function" && !window.askJibran.__subscriptionGuarded){
        const original=window.askJibran;
        const guarded=function(kind){
          if(kind==="match" && lsGet(LS_KEY,"inactive")!=="active"){
            const el=document.getElementById("jibranHomeText");
            const account=document.getElementById("jibranAccountText");
            const msg="المطابقة المستمرة والتنبيهات من مزايا اشتراك مَدخَل بقيمة 1 دولار شهريًا. يمكنك البحث عن الفرص مجانًا.";
            if(el)el.textContent=msg;
            if(account)account.textContent=msg;
            return;
          }
          return original.apply(this,arguments);
        };
        guarded.__subscriptionGuarded=true;
        window.askJibran=guarded;
      }
      if(typeof window.askJibranUser==="function" && !window.askJibranUser.__subscriptionGuarded){
        const originalUser=window.askJibranUser;
        const guardedUser=function(){
          const q=(document.getElementById("jibranInput")?.value||"").trim();
          const normalized=typeof normalizeText==="function"?normalizeText(q):q.toLowerCase();
          const asksMatch=/مناسبة|مناسب|حسب ملفي|حسب تقييمي|ملفي|تقييمي|مطابق/.test(normalized);
          if(asksMatch && lsGet(LS_KEY,"inactive")!=="active"){
            const el=document.getElementById("jibranMainText");
            if(el)el.textContent="المطابقة المستمرة والتنبيهات من مزايا اشتراك مَدخَل بقيمة 1 دولار شهريًا. البحث عن الفرص والتصفح والتقديم الأساسي متاح مجانًا.";
            const input=document.getElementById("jibranInput"); if(input)input.value="";
            return;
          }
          return originalUser.apply(this,arguments);
        };
        guardedUser.__subscriptionGuarded=true;
        window.askJibranUser=guardedUser;
      }
    },150);
  });
})();