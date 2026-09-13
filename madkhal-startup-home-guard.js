/* MADKHAL_STARTUP_HOME_GUARD_V5 */
(function(){"use strict";
  const FLAG="madkhal_worker_completion_requested";
  const LOCK="madkhal_worker_completion_lock";
  const COMPLETION="madkhalWorkerCompletionScreen";
  const BLOCKED_AFTER_SAVE=["accountScreen","homeScreen","workerScreen"];
  function markCompletionRequest(e){
    const t=e.target&&e.target.closest?t.closest("button,[onclick]"):null;
    if(!t)return;
    const code=t.getAttribute("onclick")||"";
    if(/confirmWorker\s*\(/.test(code)){
      sessionStorage.setItem(FLAG,"1");
      sessionStorage.setItem(LOCK,"1");
    }
  }
  function suppress(id){
    try{const s=document.getElementById(id);if(!s)return;s.classList.remove("active");s.style.display="none";}catch(e){}
  }
  function guardShowScreen(){
    const original=window.showScreen;
    if(typeof original!=="function"||original.__madkhalStartupGuard)return;
    const guarded=function(id){
      if(id===COMPLETION){
        if(sessionStorage.getItem(FLAG)!=="1" && sessionStorage.getItem(LOCK)!=="1"){
          suppress(COMPLETION);
          return;
        }
        sessionStorage.removeItem(FLAG);
        sessionStorage.setItem(LOCK,"1");
        return original.apply(this,arguments);
      }
      if(sessionStorage.getItem(LOCK)==="1" && BLOCKED_AFTER_SAVE.indexOf(id)>=0){
        suppress(id);
        return;
      }
      return original.apply(this,arguments);
    };
    guarded.__madkhalStartupGuard=true;
    window.showScreen=guarded;
  }
  function start(){
    document.addEventListener("click",markCompletionRequest,true);
    guardShowScreen();
    setTimeout(guardShowScreen,100);
    setTimeout(guardShowScreen,500);
    setTimeout(function(){
      if(sessionStorage.getItem(FLAG)==="1"||sessionStorage.getItem(LOCK)==="1")return;
      suppress(COMPLETION);
    },1400);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
