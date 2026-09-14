/* MADKHAL_NAVIGATION_FIX_V3 */
(function(){"use strict";
  function offset(){
    const header=document.querySelector(".header");
    const install=document.querySelector(".madkhal-install-bar");
    return (header?header.getBoundingClientRect().height:0)+(install&&getComputedStyle(install).display!=="none"?install.getBoundingClientRect().height+10:0)+12;
  }
  function scrollTarget(target){
    if(!target)return;
    const y=target.getBoundingClientRect().top+window.pageYOffset-offset();
    window.scrollTo({top:Math.max(0,y),left:0,behavior:"auto"});
  }
  function installShow(){
    const base=window.showScreen;
    if(typeof base!=="function"||base.__madkhalNavV3)return false;
    const wrapped=function(id,anchorId){
      const result=base.apply(this,arguments);
      setTimeout(function(){
        const active=document.querySelector(".screen.active");
        if(!active)return;
        const anchor=anchorId?document.getElementById(anchorId):null;
        if(anchor&&active.contains(anchor))scrollTarget(anchor);else if(active.id===id)scrollTarget(active);
      },120);
      return result;
    };
    wrapped.__madkhalNavV3=true;
    window.showScreen=wrapped;
    return true;
  }
  function start(){installShow();setTimeout(installShow,100);setTimeout(installShow,500);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
