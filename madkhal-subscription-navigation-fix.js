/* MADKHAL_SUBSCRIPTION_NAVIGATION_FIX_V1 */
(function(){
  "use strict";
  const TARGET="madkhalWorkerSubscribeFinal";
  const SCREEN="madkhalWorkerPaymentScreen";
  let busy=false;
  function offset(){
    const h=document.querySelector('.header');
    const b=document.querySelector('.madkhal-install-bar');
    return (h?h.getBoundingClientRect().height:0)+(b&&getComputedStyle(b).display!=='none'?b.getBoundingClientRect().height+10:0)+12;
  }
  function go(){
    if(busy)return;
    busy=true;
    try{
      const s=document.getElementById(SCREEN);
      if(typeof window.showScreen==='function') window.showScreen(SCREEN);
      else if(s){document.querySelectorAll('.screen').forEach(x=>{x.classList.remove('active');x.style.display='none';});s.classList.add('active');s.style.display='block';}
      const settle=()=>{
        const target=document.getElementById(SCREEN);
        if(!target)return;
        const top=target.getBoundingClientRect().top+window.pageYOffset-offset();
        window.scrollTo({top:Math.max(0,top),left:0,behavior:'auto'});
        document.documentElement.scrollTop=Math.max(0,top);
        document.body.scrollTop=Math.max(0,top);
      };
      requestAnimationFrame(settle);
      setTimeout(settle,80);
      setTimeout(settle,220);
    }finally{setTimeout(()=>{busy=false;},300);}
  }
  function bind(){
    const b=document.getElementById(TARGET);
    if(!b||b.dataset.madkhalSubNav==='1')return;
    b.dataset.madkhalSubNav='1';
    b.type='button';
    b.addEventListener('click',function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      go();
    },true);
  }
  document.addEventListener('click',function(e){
    const b=e.target&&e.target.closest?e.target.closest('#'+TARGET):null;
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    go();
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
  setInterval(bind,500);
})();
