/* MADKHAL_CONFIRM_REPEAT_FIX_V2 */
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
      requestAnimationFrame(function(){
        window.scrollTo({top:0,left:0,behavior:"auto"});
        document.documentElement.scrollTop=0;
        document.body.scrollTop=0;
      });
    }catch(e){console.warn("Madkhal repeat confirmation:",e);}
  }
  function install(){
    const base=window.saveWorker;
    if(typeof base!=="function"||base.__madkhalRepeatWrapped) return;
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
