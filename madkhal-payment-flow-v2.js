/* MADKHAL_PAYMENT_FLOW_V4 */
(function(){"use strict";
const $=id=>document.getElementById(id);
const supa=()=>window.supabaseClient||null;
async function profileId(){try{const s=supa();if(!s)return null;const u=(await s.auth.getSession())?.data?.session?.user;if(!u)return null;const r=await s.from("profiles").select("id").eq("auth_user_id",u.id).maybeSingle();return r?.data?.id||null;}catch(e){return null;}}
function statusText(t){const el=$("madkhalPaymentStatus");if(el){el.style.display="block";el.textContent=t;}}
function navigate(id){if(typeof window.showScreen==="function")window.showScreen(id);}
async function createPayment(){
  const s=supa();
  const chosen=document.querySelector('input[name="madkhalPaymentProvider"]:checked');
  if(!chosen){statusText("⚠️ اختر وسيلة الدفع أولاً.");return;}
  const pid=await profileId();
  if(!pid){statusText("⚠️ يجب تسجيل الدخول أولاً حتى نربط الاشتراك بحسابك.");return;}
  const btn=$("madkhalConfirmPayment");
  if(btn){btn.disabled=true;btn.dataset.madkhalPaymentBound="1";}
  try{
    // Payment creation is server-authorized through the protected RPC.
    // The DB remains the authority for amount, purpose and provider verification.
    const r=await s.rpc("create_subscription_payment_intent");
    if(r.error)throw r.error;
    const row=Array.isArray(r.data)?r.data[0]:r.data;
    const id=row?.payment_intent_id||"";
    if(!id)throw new Error("payment_intent_missing");
    localStorage.setItem("madkhal_worker_payment_intent",id);
    localStorage.setItem("madkhal_worker_payment_provider",row?.provider||chosen.value||"shamcash");
    statusText("✅ تم تسجيل طلب الدفع بقيمة الاشتراك الشهرية. بانتظار التحقق الفعلي؛ لن نعرض نجاح الاشتراك قبل التأكيد.");
    if(btn)btn.disabled=false;
    watchPayment(id,pid);
  }catch(e){console.warn("payment flow",e);statusText("⚠️ تعذر تسجيل عملية الدفع الآن. حاول مرة أخرى.");if(btn)btn.disabled=false;}
}
let timer=null;
async function watchPayment(id,pid){
  if(!id||!pid)return;
  if(timer)clearInterval(timer);
  const check=async()=>{
    try{
      const s=supa();if(!s)return;
      const p=await s.from("payment_intents").select("status,paid_at,verified_at").eq("id",id).maybeSingle();
      if(p.data?.status==="paid"&&p.data.verified_at){if(timer)clearInterval(timer);navigate("madkhalWorkerSubscriptionSuccessScreen");return;}
      const sub=await s.from("subscriptions").select("status,starts_at,ends_at").eq("user_id",pid).eq("audience","worker").maybeSingle();
      if(sub.data?.status==="active"){if(timer)clearInterval(timer);navigate("madkhalWorkerSubscriptionSuccessScreen");}
    }catch(e){console.warn("payment verification check",e);}
  };
  await check();
  timer=setInterval(check,5000);
}
function bind(){
  const b=$("madkhalConfirmPayment");
  if(b){b.onclick=createPayment;b.__madkhalV4=true;}
  const intent=localStorage.getItem("madkhal_worker_payment_intent");
  if(intent)profileId().then(pid=>{if(pid)watchPayment(intent,pid);});
}
window.madkhalCreatePayment=createPayment;
window.madkhalWatchPayment=watchPayment;
function start(){setTimeout(bind,700);setTimeout(bind,1800);setInterval(bind,2500);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
