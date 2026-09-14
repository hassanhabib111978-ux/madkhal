/* MADKHAL_EXTERNAL_APPLICATION_FIX_V2 */
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
        const u=uuid(v);if(u&&!out.jobId)out.jobId=u;
        if(/^https?:\/\//i.test(v)&&!out.url)out.url=v;
      }else if(typeof v==='object'){
        for(const k of ['id','job_id','jobId','opportunity_id','opportunityId']){const u=uuid(v[k]);if(u&&!out.jobId)out.jobId=u;}
        for(const k of ['canonical_url','source_url','url','sourceUrl','link']){if(typeof v[k]==='string'&&/^https?:\/\//i.test(v[k])&&!out.url)out.url=v[k];}
      }
    };
    args.forEach(walk);
    const el=document.activeElement?.closest?.('[data-job-id],[data-id],[data-source-url],[data-url]');
    if(el){out.jobId=out.jobId||uuid(el.dataset.jobId||el.dataset.id);out.url=out.url||el.dataset.sourceUrl||el.dataset.url||null;}
    return out;
  }
  async function resolveByUrl(url){
    if(!url)return null;const s=supa();if(!s)return null;
    let q=await s.from('jobs').select('id').eq('canonical_url',url).eq('status','active').limit(2);
    if(q.error)return null;
    if(q.data?.length===1)return q.data[0].id;
    q=await s.from('jobs').select('id').eq('source_url',url).eq('status','active').limit(2);
    return q.data?.length===1?q.data[0].id:null;
  }
  async function save(args){
    const s=supa();if(!s)return false;
    const x=collect(args);x.jobId=x.jobId||await resolveByUrl(x.url);
    if(!x.jobId){console.warn('Madkhal external application: job id unresolved');return false;}
    const r=await s.rpc('save_external_job_application',{p_job_id:x.jobId,p_status:'applied',p_notes:null});
    if(r.error){console.warn('Madkhal external application persistence',r.error);return false;}
    return true;
  }
  function wrap(){
    const fn=window.applyOpportunity;
    if(typeof fn!=='function'||fn.__madkhalExternalV2)return;
    const original=fn;
    const wrapped=async function(){
      const args=Array.from(arguments);
      let result;
      try{result=await original.apply(this,args);}catch(e){console.warn('Madkhal application UI',e);}
      const ok=await save(args);
      if(ok)toast('✅ تم حفظ التقديم ضمن متابعة طلباتك.');
      return result;
    };
    wrapped.__madkhalExternalV2=true;
    window.applyOpportunity=wrapped;
  }
  window.madkhalSaveExternalApplication=save;
  function start(){wrap();setInterval(wrap,2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
