/* MADKHAL_STABILITY_FIX_V4 */
(function(){
  "use strict";

  /* Keep only the worker-save completion lock.
     Do NOT wrap showScreen/navigate and do NOT issue global scroll commands. */
  const SAVE_LOCK="madkhal_worker_completion_lock";
  const SAVE_REQUEST="madkhal_worker_completion_requested";

  function markSaveClick(e){
    const t=e.target&&e.target.closest?e.target.closest("button,a,[onclick]"):null;
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

  function start(){
    document.addEventListener("click",markSaveClick,true);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
