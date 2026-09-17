/* MADKHAL_WORKER_SAVE_FIX_V6 */
(function(){
  "use strict";
  const SCREEN="madkhalWorkerCompletionScreen";
  const ACCOUNT="accountScreen";
  let saving=false;

  function client(){
    return (typeof supabaseClient!=="undefined"&&supabaseClient)||window.supabaseClient||null;
  }

  async function saveWasReallyCompleted(){
    const c=client();
    if(!c)return false;
    try{
      const session=await c.auth.getSession();
      const user=session?.data?.session?.user||null;
      if(!user)return false;
      const q=await c.from("worker_profiles")
        .select("id,full_name,location,occupation_uri,profession")
        .eq("user_id",user.id)
        .maybeSingle();
      if(q.error||!q.data)return false;
      const name=String(q.data.full_name||"").trim();
      const location=String(q.data.location||"").trim();
      const occupation=String(q.data.occupation_uri||q.data.profession||"").trim();
      return !!(name&&location&&occupation);
    }catch(e){
      console.warn("Madkhal worker save verification:",e);
      return false;
    }
  }

  function openSubscriptionSafely(){
    if(typeof window.openSubscription==="function"){
      window.openSubscription();
      return;
    }
    const target=document.getElementById("subscriptionScreen");
    if(target){
      document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));
      target.classList.add("active");
      target.style.display="block";
      try{window.scrollTo({top:0,behavior:"auto"});}catch(_){ }
      if(typeof window.renderSubscriptionStatus==="function")window.renderSubscriptionStatus();
    }
  }

  function returnToOpportunities(){
    if(typeof window.openOpportunities==="function")window.openOpportunities();
    else if(typeof window.showScreen==="function")window.showScreen("opportunitiesScreen");
  }

  function ensureCompletion(){
    let s=document.getElementById(SCREEN);
    if(s)return s;
    const main=document.querySelector("main");
    if(!main)return null;
    s=document.createElement("section");
    s.id=SCREEN;
    s.className="screen";
    s.innerHTML='<div class="card" style="text-align:center;padding:28px 20px;margin-top:20px">'+
      '<div style="font-size:46px;margin-bottom:10px">✅</div>'+
      '<h2 style="margin:0 0 12px;color:#0f766e">تم حفظ ملفك المهني بنجاح</h2>'+
      '<p style="margin:0 0 12px;line-height:1.9;color:#596666">تم حفظ بياناتك في مَدخَل، وأصبح ملفك جاهزًا لاستخدامه في البحث والمطابقة مع الفرص المناسبة.</p>'+
      '<p style="margin:0 0 22px;line-height:1.9;color:#596666">يمكنك الآن متابعة البحث والتقديم مجانًا. وإذا أردت أن يتابع مَدخَل الفرص الجديدة نيابةً عنك، فهناك اشتراك اختياري بقيمة <strong>$1 شهريًا</strong> يشمل المتابعة المستمرة والمطابقة التلقائية والتنبيهات والترتيب.</p>'+
      '<button type="button" class="primary-btn" id="madkhalWorkerCompletionSubscribe" style="width:100%">⭐ الانتقال إلى الاشتراك — $1 شهريًا</button>'+
      '<button type="button" class="secondary-btn" id="madkhalWorkerCompletionContinue" style="width:100%;margin-top:10px">🔎 متابعة البحث عن الفرص</button>'+ 
      '</div>';
    main.appendChild(s);
    const b=s.querySelector("#madkhalWorkerCompletionSubscribe");
    if(b)b.addEventListener("click",function(e){
      e.preventDefault();e.stopImmediatePropagation();
      openSubscriptionSafely();
    },true);
    const c=s.querySelector("#madkhalWorkerCompletionContinue");
    if(c)c.addEventListener("click",function(e){
      e.preventDefault();e.stopImmediatePropagation();
      returnToOpportunities();
    },true);
    return s;
  }

  function showCompletion(){
    const s=ensureCompletion();
    if(!s)return;
    document.querySelectorAll(".screen").forEach(function(x){x.classList.remove("active");x.style.display="none";});
    s.classList.add("active");
    s.style.display="block";
    try{localStorage.setItem("madkhal_worker_confirmed","1");}catch(_){ }
  }

  function protectAccountNavigation(){
    const original=window.showScreen;
    if(typeof original!=="function"||original.__madkhalWorkerSaveGuard)return;
    const guarded=function(id){
      if(saving&&id===ACCOUNT)return;
      return original.apply(this,arguments);
    };
    guarded.__madkhalWorkerSaveGuard=true;
    window.showScreen=guarded;
  }

  function wrap(){
    protectAccountNavigation();
    const original=window.saveWorker;
    if(typeof original!=="function"||original.__madkhalWorkerSaveFix)return;
    const wrapped=async function(){
      saving=true;
      try{
        const result=await original.apply(this,arguments);
        if(await saveWasReallyCompleted())setTimeout(showCompletion,40);
        else console.warn("Madkhal: worker save returned without a verified database profile");
        return result;
      }catch(e){
        console.warn("Madkhal worker save:",e);
        throw e;
      }finally{
        setTimeout(function(){saving=false;},900);
      }
    };
    wrapped.__madkhalWorkerSaveFix=true;
    window.saveWorker=wrapped;
  }

  function bindSaveButton(){
    const b=document.getElementById("saveWorkerButton");
    if(!b||b.__madkhalWorkerSaveButtonBound)return;
    b.__madkhalWorkerSaveButtonBound=true;
    b.addEventListener("click",function(e){
      e.preventDefault();e.stopImmediatePropagation();
      wrap();
      if(typeof window.saveWorker==="function")window.saveWorker().catch(()=>{});
    },true);
  }

  ensureCompletion();
  wrap();
  bindSaveButton();
  setTimeout(function(){wrap();bindSaveButton();ensureCompletion();},100);
  setTimeout(function(){wrap();bindSaveButton();ensureCompletion();},300);
  setTimeout(function(){wrap();bindSaveButton();ensureCompletion();},700);
  setTimeout(function(){wrap();bindSaveButton();ensureCompletion();},1200);
})();
