/* MADKHAL_SUBSCRIPTION_BASE_CLEANUP_V1 */
(function(){
  "use strict";
  const MARKERS = [
    "دولار ونصف شهريًا",
    "نحن نجد ما تبحث عنه",
    "لا تحتاج إلى البحث كل يوم"
  ];
  function hasMarker(el){
    const text=(el.innerText||el.textContent||"").trim();
    return MARKERS.some(m=>text.includes(m));
  }
  function cleanup(root=document){
    const all=root.querySelectorAll ? root.querySelectorAll("div,section,article,aside") : [];
    all.forEach(el=>{
      if(!hasMarker(el)) return;
      const parent=el.parentElement;
      const parentText=parent ? (parent.innerText||parent.textContent||"") : "";
      if(parent && parent!==document.body && MARKERS.some(m=>parentText.includes(m)) && parent.children.length<=3){
        el=parent;
      }
      if(el.dataset.madkhalSubscriptionBaseRemoved==="1") return;
      el.dataset.madkhalSubscriptionBaseRemoved="1";
      el.remove();
    });
  }
  function start(){
    cleanup();
    const target=document.body;
    if(!target) return;
    new MutationObserver(mutations=>{
      mutations.forEach(m=>m.addedNodes.forEach(n=>{
        if(n.nodeType===1) cleanup(n);
      }));
    }).observe(target,{childList:true,subtree:true});
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
