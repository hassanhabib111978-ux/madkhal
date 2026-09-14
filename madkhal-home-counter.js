/* MADKHAL_HOME_COUNTER_V2 */
(function(){"use strict";
  const REGION="geo_class.in.(MENA,SYRIA),geo_region.in.(middle_east,Middle East & North Africa,Syria)";
  function counterNodes(){return Array.from(document.querySelectorAll(".job-counter-number"));}
  function render(n){counterNodes().forEach(function(el){el.textContent=Number.isFinite(n)?n.toLocaleString("ar-EG"):"…";});}
  async function load(){
    if(!window.supabaseClient)return;
    try{
      const now=new Date().toISOString();
      const r=await supabaseClient.from("jobs").select("id",{count:"exact",head:true}).eq("status","active").or("expires_at.is.null,expires_at.gt."+now).or(REGION);
      if(r.error)throw r.error;
      render(Number(r.count||0));
    }catch(e){console.warn("Madkhal home counter:",e);}
  }
  function start(){load();setInterval(load,10*60*1000);document.addEventListener("visibilitychange",function(){if(!document.hidden)load();});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
