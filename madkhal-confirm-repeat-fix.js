/* MADKHAL_CONFIRM_REPEAT_FIX_V3 */
(function(){
  "use strict";
  const FLAG="madkhal_worker_confirmed";
  const SCREEN="madkhalWorkerCompletionScreen";
  function hideOtherScreens(){
    document.querySelectorAll(".screen").forEach(function(el){
      if(el.id!==SCREEN){
        el.classList.remove("active");
        el.style.display="none";
      }
    });
  }
  function showCompletionAgain(){
    try{
      if(localStorage.getItem(FLAG)!=="1") return;
      if(typeof window.madkhalEnsureWorkerScreens==="function") window.madkhalEnsureWorkerScreens();
      hideOtherScreens();
      const s=document.getElementById(SCREEN);
      if(!s) return;
      s.style.display="block";
      s.classList.add("active");
      if(typeof window.madkhalStabilizeNavigation==="function") window.madkhalStabilizeNavigation(SCREEN,null);
    }catch(e){console.warn("Madkhal repeat confirmation:",e);}
  }
  function install(){
    const base=window.saveWorker;
    if(typeof base!=="function"||base.__madkhalRepeatWrapped)return;
    const wrapped=async function(){
      const result=await base.apply(this,arguments);
      if(localStorage.getItem(FLAG)==="1") setTimeout(showCompletionAgain,320);
      return result;
    };
    wrapped.__madkhalRepeatWrapped=true;
    window.saveWorker=wrapped;
  }
  function start(){install();setTimeout(install,100);setTimeout(install,500);}
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start); else start();
})();
