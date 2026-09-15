/* MADKHAL_WORKER_SAVE_FIX_V4 */
(function(){
  "use strict";
  const SCREEN="madkhalWorkerCompletionScreen";
  const PAYMENT="madkhalWorkerPaymentScreen";
  const ACCOUNT="accountScreen";
  let saving=false;

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
      else if(target){
        document.querySelectorAll(".screen").forEach(x=>{x.classList.remove("active");x.style.display="none";});
        target.classList.add("active");
        target.style.display="block";
      }
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
        setTimeout(function(){showCompletion();},40);
        return result;
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
      e.preventDefault();
      e.stopImmediatePropagation();
      wrap();
      if(typeof window.saveWorker==="function")window.saveWorker();
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