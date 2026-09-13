/* MADKHAL_STARTUP_HOME_GUARD_V2 */
(function(){"use strict";
  const FLAG="madkhal_worker_completion_requested";
  const COMPLETION="madkhalWorkerCompletionScreen";
  function markCompletionRequest(e){
    const t=e.target&&e.target.closest?e.target.closest("button,[onclick]"):null;
    if(!t)return;
    const code=(t.getAttribute("onclick")||"");
    if(/confirmWorker\s*\(/.test(code)) sessionStorage.setItem(FLAG,"1");
  }
  function home(){
    try{
      const fn=window.showScreen;
      if(typeof fn==="function") fn("homeScreen");
      else{
        document.querySelectorAll(".screen").forEach(x=>{x.classList.remove("active");x.style.removeProperty("display");});
        const h=document.getElementById("homeScreen");
        if(h){h.classList.add("active");h.style.removeProperty("display");}
      }
      window.scrollTo({top:0,left:0,behavior:"auto"});
      document.documentElement.scrollTop=0;document.body.scrollTop=0;
    }catch(e){}
  }
  function guardShowScreen(){
    const original=window.showScreen;
    if(typeof original!=="function"||original.__madkhalStartupGuard)return;
    const guarded=function(id){
      if(id===COMPLETION && sessionStorage.getItem(FLAG)!== "1"){
        home();
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
      if(sessionStorage.getItem(FLAG)==="1")return;
      const s=document.getElementById(COMPLETION);
      if(s&&getComputedStyle(s).display!=="none" && s.classList.contains("active")) home();
    },1400);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
