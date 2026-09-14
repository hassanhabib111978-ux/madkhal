/* MADKHAL_SCREEN_VISIBILITY_FIX_V2 */
(function(){"use strict";
  function enforce(){
    const active=document.querySelector(".screen.active");
    if(!active)return;
    document.querySelectorAll(".screen").forEach(function(el){
      if(el===active){el.style.display="block";}
      else{el.classList.remove("active");el.style.display="none";}
    });
  }
  function start(){
    enforce();
    const original=window.showScreen;
    if(typeof original==="function"&&!original.__madkhalVisibilityFixed){
      const fixed=function(id){
        const r=original.apply(this,arguments);
        requestAnimationFrame(enforce);
        setTimeout(enforce,40);
        return r;
      };
      fixed.__madkhalVisibilityFixed=true;
      window.showScreen=fixed;
    }
    setTimeout(enforce,250);
    setTimeout(enforce,800);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
