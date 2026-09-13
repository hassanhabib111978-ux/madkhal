/* MADKHAL_STARTUP_HOME_GUARD_V4 */
(function(){"use strict";
  const FLAG="madkhal_worker_completion_requested";
  const COMPLETION="madkhalWorkerCompletionScreen";
  function markCompletionRequest(e){
    const t=e.target&&e.target.closest?t.closest("button,[onclick]"):null;
    if(!t)return;
    const code=t.getAttribute("onclick")||"";
    if(/confirmWorker\s*\(/.test(code)) sessionStorage.setItem(FLAG,"1");
  }
  function suppressCompletion(){
    try{
      const s=document.getElementById(COMPLETION);
      if(!s)return;
      s.classList.remove("active");
      s.style.display="none";
    }catch(e){}
  }
  function guardShowScreen(){
    const original=window.showScreen;
    if(typeof original!=="function"||original.__madkhalStartupGuard)return;
    const guarded=function(id){
      if(id===COMPLETION){
        if(sessionStorage.getItem(FLAG)!=="1"){
          suppressCompletion();
          return;
        }
        sessionStorage.removeItem(FLAG);
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
      if(sessionStorage.getItem(FLAG)==="1")return;
      suppressCompletion();
    },1400);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
