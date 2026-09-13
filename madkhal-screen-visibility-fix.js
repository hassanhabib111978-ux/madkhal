/* MADKHAL_SCREEN_VISIBILITY_FIX_V1 */
(function(){"use strict";
  const IDS=["madkhalWorkerCompletionScreen","madkhalWorkerPaymentScreen","madkhalWorkerSubscriptionSuccessScreen"];
  function release(){IDS.forEach(function(id){const el=document.getElementById(id);if(el)el.style.removeProperty("display");});}
  function start(){
    release();
    const original=window.showScreen;
    if(typeof original==="function"&&!original.__madkhalVisibilityFixed){
      const fixed=function(id){release();const r=original.apply(this,arguments);requestAnimationFrame(release);setTimeout(release,30);return r;};
      fixed.__madkhalVisibilityFixed=true;
      window.showScreen=fixed;
    }
    setTimeout(release,600);
    setTimeout(release,1200);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
