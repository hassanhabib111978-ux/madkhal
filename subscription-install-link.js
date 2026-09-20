(function(){
  function showSubscriptionAfterInstall(){
    if(typeof showScreen === "function") showScreen("subscriptionScreen","subscriptionScreen");
  }
  window.openSubscription=function(){
    if(typeof installPromptEvent !== "undefined" && installPromptEvent){
      try{
        const promptEvent=installPromptEvent;
        installPromptEvent=null;
        promptEvent.prompt();
        Promise.resolve(promptEvent.userChoice).then(function(){
          var bar=document.getElementById("installBar");
          if(bar)bar.classList.add("hidden");
          showSubscriptionAfterInstall();
        }).catch(function(){showSubscriptionAfterInstall();});
        return;
      }catch(e){installPromptEvent=null;}
    }
    showSubscriptionAfterInstall();
    setTimeout(function(){
      var bar=document.getElementById("installBar");
      if(bar && bar.classList.contains("hidden") && typeof showToast === "function"){
        showToast("📱 لإضافة مَدخَل إلى الشاشة الرئيسية: افتح قائمة المتصفح واختر «إضافة إلى الشاشة الرئيسية».");
      }
    },250);
  };
})();
