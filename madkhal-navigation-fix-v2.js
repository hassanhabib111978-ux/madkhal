/* MADKHAL_NAVIGATION_FIX_V2 */
(function(){"use strict";
  function scrollToTarget(target){
    if(!target)return;
    setTimeout(function(){
      const header=document.querySelector(".header");
      const install=document.querySelector(".madkhal-install-bar");
      const offset=(header?header.getBoundingClientRect().height:0)+(install?install.getBoundingClientRect().height:0)+12;
      const y=target.getBoundingClientRect().top+window.pageYOffset-offset;
      window.scrollTo({top:Math.max(0,y),left:0,behavior:"smooth"});
    },60);
  }
  function activeTarget(id){
    if(id){const el=document.getElementById(id);if(el)return el;}
    return document.querySelector(".screen.active");
  }
  function installShow(){
    const base=window.showScreen;
    if(typeof base!=="function"||base.__madkhalNavV2)return;
    const wrapped=function(id){
      const r=base.apply(this,arguments);
      requestAnimationFrame(function(){scrollToTarget(activeTarget(id));});
      return r;
    };
    wrapped.__madkhalNavV2=true;
    window.showScreen=wrapped;
  }
  function installOpen(name){
    const base=window[name];
    if(typeof base!=="function"||base.__madkhalNavV2)return;
    const wrapped=function(){
      const r=base.apply(this,arguments);
      requestAnimationFrame(function(){scrollToTarget(document.querySelector(".screen.active"));});
      return r;
    };
    wrapped.__madkhalNavV2=true;
    window[name]=wrapped;
  }
  function clickNav(e){
    const el=e.target&&e.target.closest?e.target.closest("button,a,[onclick]"):null;
    if(!el)return;
    setTimeout(function(){
      const active=document.querySelector(".screen.active");
      if(active)scrollToTarget(active);
      const focused=document.activeElement;
      if(focused&&/^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName))scrollToTarget(focused);
    },120);
  }
  function start(){
    ["openProfile","openSubscription","openEvaluation","openEmployer","openWorker"].forEach(installOpen);
    installShow();
    setTimeout(installShow,100);setTimeout(installShow,500);
    document.addEventListener("click",clickNav,true);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
