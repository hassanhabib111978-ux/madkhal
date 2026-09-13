/* MADKHAL_HOME_SUBSCRIPTION_CLEANUP_V1 */
(function(){
  "use strict";
  function cleanup(){
    var home=document.getElementById("homeScreen");
    if(!home) return;
    var cards=home.querySelectorAll(".premium-offer");
    cards.forEach(function(card){
      var text=(card.innerText||card.textContent||"").trim();
      var button=card.querySelector('button[onclick*="openSubscription"]');
      if(button && text.includes("اشترك، ونحن نجد ما تبحث عنه.") && text.includes("دولار ونصف شهريًا")){
        card.remove();
      }
    });
  }
  function start(){
    cleanup();
    var home=document.getElementById("homeScreen");
    if(!home) return;
    new MutationObserver(function(){cleanup();}).observe(home,{childList:true,subtree:true});
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
