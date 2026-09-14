/* MADKHAL_NATIVE_CONFIRM_FIX_V1 */
(function(){
  "use strict";
  var original=window.confirm;
  if(typeof original!=="function"||original.__madkhalNativeConfirmFix)return;
  var explicitSubscriptionClick=false;
  document.addEventListener("click",function(e){
    var t=e.target&&e.target.closest?e.target.closest("button,a,[onclick]"):null;
    if(!t)return;
    var text=(t.innerText||t.textContent||"").replace(/\s+/g," ");
    var code=t.getAttribute("onclick")||"";
    explicitSubscriptionClick=/(اشتراك|subscription)/i.test(text+" "+code);
    if(explicitSubscriptionClick)setTimeout(function(){explicitSubscriptionClick=false;},1500);
  },true);
  var fixed=function(message,def){
    var m=String(message||"");
    if(/(اشتراك|الاشتراك|subscription)/i.test(m)) return explicitSubscriptionClick;
    if(/هل تؤكد أن بيانات ملفك وبيانات الهوية صحيحة/.test(m)) return true;
    if(/هل تؤكد أن بيانات فرصة العمل صحيحة/.test(m)) return true;
    return original.call(window,message,def);
  };
  fixed.__madkhalNativeConfirmFix=true;
  window.confirm=fixed;
})();
