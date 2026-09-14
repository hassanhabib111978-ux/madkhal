/* MADKHAL_STABILITY_FIX_V2 */
(function(){
  "use strict";

  const COMPLETION="madkhalWorkerCompletionScreen";
  const SAVE_LOCK="madkhal_worker_completion_lock";
  const SAVE_REQUEST="madkhal_worker_completion_requested";
  const BLOCKED_AFTER_SAVE=new Set(["accountScreen","homeScreen","workerScreen"]);

  function activeScreen(){ return document.querySelector(".screen.active"); }

  function stickyOffset(){
    const h=document.querySelector(".header");
    const b=document.querySelector(".madkhal-install-bar");
    return (h?h.getBoundingClientRect().height:0)
      +(b&&getComputedStyle(b).display!=="none"?b.getBoundingClientRect().height+10:0)+12;
  }

  function scrollElement(el,behavior="auto"){
    if(!el)return;
    const top=el.getBoundingClientRect().top+window.pageYOffset-stickyOffset();
    window.scrollTo({top:Math.max(0,top),left:0,behavior});
  }

  function forceCompletion(){
    const s=document.getElementById(COMPLETION);
    if(!s)return false;
    document.querySelectorAll(".screen").forEach(x=>{
      if(x!==s){x.classList.remove("active");x.style.display="none";}
    });
    s.classList.add("active");
    s.style.display="block";
    return true;
  }

  function stabilize(id,anchorId){
    requestAnimationFrame(function(){
      setTimeout(function(){
        const lock=sessionStorage.getItem(SAVE_LOCK)==="1"||sessionStorage.getItem(SAVE_REQUEST)==="1";
        if(lock&&id!==COMPLETION&&BLOCKED_AFTER_SAVE.has(id)){
          if(forceCompletion())scrollElement(document.getElementById(COMPLETION),"auto");
          return;
        }
        const active=activeScreen();
        if(!active)return;
        const anchor=anchorId?document.getElementById(anchorId):null;
        scrollElement(anchor||active,"auto");
      },90);
    });
  }

  function wrapShowScreen(){
    const base=window.showScreen;
    if(typeof base!=="function"||base.__madkhalStability)return false;
    const wrapped=function(id,anchorId){
      const lock=sessionStorage.getItem(SAVE_LOCK)==="1"||sessionStorage.getItem(SAVE_REQUEST)==="1";
      if(lock&&BLOCKED_AFTER_SAVE.has(id)){
        if(forceCompletion())stabilize(COMPLETION,null);
        return;
      }
      const result=base.apply(this,arguments);
      stabilize(id,anchorId);
      return result;
    };
    wrapped.__madkhalStability=true;
    window.showScreen=wrapped;
    return true;
  }

  function wrapNavigate(){
    const base=window.navigate;
    if(typeof base!=="function"||base.__madkhalStability)return false;
    const wrapped=function(id,button){
      const lock=sessionStorage.getItem(SAVE_LOCK)==="1"||sessionStorage.getItem(SAVE_REQUEST)==="1";
      if(lock&&BLOCKED_AFTER_SAVE.has(id)){
        if(forceCompletion())stabilize(COMPLETION,null);
        return;
      }
      const result=base.apply(this,arguments);
      stabilize(id,null);
      return result;
    };
    wrapped.__madkhalStability=true;
    window.navigate=wrapped;
    return true;
  }

  function markSaveClick(e){
    const t=e.target&&e.target.closest?t.closest("button,a,[onclick]"):null;
    if(!t)return;
    const code=t.getAttribute("onclick")||"";
    const isSave=t.id==="saveWorkerButton"||/saveWorker\s*\(/.test(code);
    if(!isSave)return;
    e.preventDefault();
    if(t.tagName==="BUTTON")t.type="button";
    try{
      sessionStorage.setItem(SAVE_REQUEST,"1");
      sessionStorage.setItem(SAVE_LOCK,"1");
    }catch(_){ }
  }

  function finalPass(){
    try{
      const lock=sessionStorage.getItem(SAVE_LOCK)==="1"||sessionStorage.getItem(SAVE_REQUEST)==="1";
      if(lock&&document.getElementById(COMPLETION)){
        const s=document.getElementById(COMPLETION);
        if(s.classList.contains("active")){
          requestAnimationFrame(function(){scrollElement(s,"auto");});
        }
      }
    }catch(_){ }
  }

  function start(){
    document.addEventListener("click",markSaveClick,true);
    wrapShowScreen();
    wrapNavigate();
    setTimeout(wrapShowScreen,100);
    setTimeout(wrapNavigate,100);
    setTimeout(wrapShowScreen,500);
    setTimeout(wrapNavigate,500);
    setTimeout(finalPass,900);
    setTimeout(finalPass,1500);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
