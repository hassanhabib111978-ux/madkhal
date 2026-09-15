/* MADKHAL_WORKER_SAVE_FIX_V2 */
(function(){"use strict";
  const FLAG="madkhal_worker_completion_requested";
  const LOCK="madkhal_worker_completion_lock";
  const SCREEN="madkhalWorkerCompletionScreen";
  const PAYMENT="madkhalWorkerPaymentScreen";

  function mark(e){
    const t=e.target&&e.target.closest?t.closest("button,[onclick]"):null;
    if(!t)return;
    const code=t.getAttribute("onclick")||"";
    const isSave=t.id==="saveWorkerButton"||/saveWorker\s*\(/.test(code)||/^\s*💾?\s*حفظ/.test((t.innerText||"").trim());
    if(!isSave)return;
    e.preventDefault();
    if(t.tagName==="BUTTON")t.type="button";
    try{
      sessionStorage.setItem(FLAG,"1");
      sessionStorage.setItem(LOCK,"1");
    }catch(_){ }
  }

  function ensureCompletion(){
    let s=document.getElementById(SCREEN);
    if(s)return s;
    const main=document.querySelector("main");
    if(!main)return null;
    s=document.createElement("section");
    s.id=SCREEN;
    s.className="screen";
    s.innerHTML='<div class="card" style="text-align:center;padding:28px 20px;margin-top:20px"><div style="font-size:46px;margin-bottom:10px">✅</div><h2 style="margin:0 0 12px;color:#0f766e">تم حفظ بياناتك بنجاح</h2><p style="margin:0 0 12px;line-height:1.9;color:#596666">تم حفظ ملفك المهني في مَدخَل، وأصبح جاهزًا للاستفادة من المطابقة مع الفرص المناسبة.</p><p style="margin:0 0 22px;line-height:1.9;color:#596666">يمكنك المتابعة مجانًا، أو تفعيل الاشتراك الشهري بقيمة <strong>$1</strong> للحصول على المتابعة المستمرة والمطابقة التلقائية والتنبيهات والترتيب.</p><button type="button" class="primary-btn" id="madkhalWorkerCompletionSubscribe" style="width:100%">⭐ الاشتراك الشهري — $1</button></div>';
    main.appendChild(s);
    const b=s.querySelector("#madkhalWorkerCompletionSubscribe");
    if(b)b.addEventListener("click",function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      const target=document.getElementById(PAYMENT);
      if(typeof window.showScreen==="function"&&target)window.showScreen(PAYMENT);
      else if(target){document.querySelectorAll(".screen").forEach(x=>{x.classList.remove("active");x.style.display="none";});target.classList.add("active");target.style.display="block";}
    },true);
    return s;
  }

  function showCompletion(){
    const s=ensureCompletion();
    if(!s)return;
    document.querySelectorAll(".screen").forEach(function(x){
      x.classList.remove("active");
      x.style.display="none";
    });
    s.style.display="block";
    s.classList.add("active");
    try{localStorage.setItem("madkhal_worker_confirmed","1");}catch(_){ }
  }

  async function verifySaved(){
    try{
      const db=window.supabaseClient;
      if(!db)return false;
      const session=(await db.auth.getSession()).data.session;
      const uid=session&&session.user&&session.user.id;
      if(!uid)return false;
      const r=await db.from("worker_profiles").select("id,user_id,full_name,profession,location").eq("user_id",uid).maybeSingle();
      return !!r.data&&!r.error;
    }catch(_){return false;}
  }

  function wrap(){
    const original=window.saveWorker;
    if(typeof original!=="function"||original.__madkhalWorkerSaveFix)return;
    const wrapped=async function(){
      try{sessionStorage.setItem(FLAG,"1");sessionStorage.setItem(LOCK,"1");}catch(_){ }
      const result=await original.apply(this,arguments);
      setTimeout(async function(){
        if(await verifySaved())showCompletion();
      },850);
      return result;
    };
    wrapped.__madkhalWorkerSaveFix=true;
    window.saveWorker=wrapped;
  }

  document.addEventListener("click",mark,true);
  wrap();
  setTimeout(wrap,100);
  setTimeout(wrap,500);
  setTimeout(wrap,1000);
})();
