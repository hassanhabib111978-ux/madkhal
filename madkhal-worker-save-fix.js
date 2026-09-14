/* MADKHAL_WORKER_SAVE_FIX_V1 */
(function(){"use strict";
  const FLAG="madkhal_worker_completion_requested";
  const LOCK="madkhal_worker_completion_lock";
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
  function wrap(){
    const original=window.saveWorker;
    if(typeof original!=="function"||original.__madkhalWorkerSaveFix)return;
    const wrapped=async function(){
      try{
        sessionStorage.setItem(FLAG,"1");
        sessionStorage.setItem(LOCK,"1");
      }catch(_){ }
      return original.apply(this,arguments);
    };
    wrapped.__madkhalWorkerSaveFix=true;
    window.saveWorker=wrapped;
  }
  document.addEventListener("click",mark,true);
  wrap();
  setTimeout(wrap,100);
  setTimeout(wrap,500);
})();
