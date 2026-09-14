/* MADKHAL_EXTERNAL_APPLICATION_FIX_V1 */
(function(){
  "use strict";
  const supa=()=>window.supabaseClient||null;
  function toast(t){if(typeof showToast==='function')showToast(t);else alert(t);}
  function uuid(v){return typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)?v:null;}
  function collect(args){
    const out={jobId:null,url:null};
    const walk=v=>{
      if(!v)return;
      if(typeof v==='string'){
        const u=uuid(v); if(u&&!out.jobId)out.jobId=u;
        if(/^https?:\/\//i.test(v)&&!out.url)out.url=v;
        return;
      }
      if(typeof v==='object'){
        for(const k of ['id','job_id','jobId','opportunity_id','opportunityId']){const u=uuid(v[k]);if(u&&!out.jobId)out.jobId=u;}
        for(const k of ['canonical_url','source_url','url','sourceUrl','link']){if(typeof v[k]==='string'&&/^https?:\/\//i.test(v[k])&&!out.url)out.url=v[k];}
      }
    };
    args.forEach(walk);
    const el=document.activeElement?.closest?.('[data-job-id],[data-id],[data-source-url],[data-url]');
    if(el){out.jobId=out.jobId||uuid(el.dataset.jobId||el.dataset.id);out.url=out.url||el.dataset.sourceUrl||el.dataset.url||null;}
    const card=document.querySelector('.opportunity-card.active,.job-card.active,[data-active-job="true"]');
    if(card){out.jobId=out.jobId||uuid(card.dataset.jobId||card.dataset.id);out.url=out.url||card.dataset.sourceUrl||card.dataset.url||null;}
    return out;
  }
  async function resolveByUrl(url){
    if(!url)return null; const s=supa(); if(!s)return null;
    const a=await s.from('jobs').select('id').or('canonical_url.eq.'+url+',source_url.eq.'+url).eq('status','active').limit(2);
    return a.data?.length===1?a.data[0].id:null;
  }
  async function save(args){
    const s=supa(); if(!s){toast('تعذر الاتصال بالخدمة حالياً.');return false;}
    const x=collect(args); x.jobId=x.jobId||await resolveByUrl(x.url);
    if(!x.jobId){toast('تعذر تحديد الوظيفة. افتح بطاقة الوظيفة ثم حاول مرة أخرى.');return false;}
    const r=await s.rpc('save_external_job_application',{p_job_id:x.jobId,p_status:'applied',p_notes:null});
    if(r.error){console.warn('Madkhal external application',r.error);toast(r.error.message==='profile_required'?'أكمل تسجيل الدخول والملف الشخصي أولاً.':'تعذر حفظ متابعة التقديم الآن.');return false;}
    toast('✅ تم تسجيل التقديم وحفظه في متابعة طلباتك.');
    return true;
  }
  function wrap(){
    const fn=window.applyOpportunity;
    if(typeof fn==='function'&&!fn.__madkhalExternalV1){
      const wrapped=async function(){return save(Array.from(arguments));};
      wrapped.__madkhalExternalV1=true;
      window.applyOpportunity=wrapped;
    }
    document.querySelectorAll('[onclick*="applyOpportunity"]').forEach(el=>{
      if(el.dataset.madkhalExternalBound==='1')return;
      el.dataset.madkhalExternalBound='1';
      el.addEventListener('click',async function(ev){
        const attr=el.getAttribute('onclick')||'';
        if(attr.includes('applyOpportunity')){ev.preventDefault();ev.stopImmediatePropagation();await save([el.dataset.jobId,el.dataset.id,el.dataset.sourceUrl,el.dataset.url]);}
      },true);
    });
  }
  window.madkhalSaveExternalApplication=save;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{wrap();setInterval(wrap,2000);});else{wrap();setInterval(wrap,2000);}
})();
