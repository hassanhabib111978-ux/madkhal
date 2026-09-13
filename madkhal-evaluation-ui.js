/* MADKHAL_EVALUATION_UI_V3 */
(function(){"use strict";
const $=id=>document.getElementById(id);
function s(){return window.supabaseClient||null;}
async function me(){try{const db=s();if(!db)return null;const u=(await db.auth.getSession()).data.session?.user;if(!u)return null;return (await db.from('profiles').select('id,role').eq('auth_user_id',u.id).maybeSingle()).data||null;}catch(e){return null;}}
function toast(t){if(typeof showToast==='function')showToast(t);else alert(t);}
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
async function occupationMatrix(db,title){
  if(!title)return null;
  let q=await db.from('esco_occupations').select('conceptUri,preferredLabel,altLabels,iscoGroup').or('preferredLabel.ilike.%'+title+'%,altLabels.ilike.%'+title+'%').limit(1);
  const occ=q.data?.[0];
  if(occ?.conceptUri){const m=await db.rpc('get_occupation_evaluation_matrix',{p_occupation_uri:occ.conceptUri});if(!m.error)return m.data?.matrix||m.data||null;}
  const m=await db.rpc('get_occupation_evaluation_matrix',{p_occupation_uri:title});
  return m.error?null:(m.data?.matrix||m.data||null);
}
async function enrichRow(db,r,p,workerMode){
  const vq=await db.from('employer_vacancies').select('id,title,category,job_type,location,employer_id').eq('id',r.vacancy_id).maybeSingle();
  const vac=vq.data||{};
  let evaluatee=null;
  if(workerMode){evaluatee=vac.employer_id||null;}else{
    const wq=await db.from('worker_profiles').select('id,user_id,profession').eq('id',r.worker_profile_id).maybeSingle();
    if(wq.data?.user_id){const pq=await db.from('profiles').select('id').eq('auth_user_id',wq.data.user_id).maybeSingle();evaluatee=pq.data?.id||null;}
  }
  const matrix=await occupationMatrix(db,vac.title||vac.category||'');
  return {...r,vacancy:vac,evaluatee,matrix};
}
function select(id,name){return '<select id="'+id+'" data-score="'+name+'" style="width:100%;padding:8px;margin-top:6px"><option value="5">5 — ممتاز</option><option value="4">4 — جيد جداً</option><option value="3" selected>3 — جيد</option><option value="2">2 — يحتاج تحسين</option><option value="1">1 — ضعيف</option></select>';}
function evaluationCard(r){
 const m=r.matrix||{}; const cs=Array.isArray(m.criteria)&&m.criteria.length?m.criteria:[]; const skills=Array.isArray(m.esco_skills)?m.esco_skills:[];
 const criteriaHtml=cs.map((c,i)=>'<div style="margin:10px 0;padding:10px;border:1px solid rgba(128,128,128,.25);border-radius:10px"><strong>'+esc(c.label_ar||c.code)+'</strong><small style="display:block;opacity:.75">وزن المعيار: '+Number(c.weight||1).toFixed(1)+' · نطاق: '+esc(c.applies_to||'all')+'</small>'+select('c_'+r.id+'_'+i,r.id+':c:'+i)+'</div>').join('');
 const skillHtml=skills.slice(0,12).map((x,i)=>{const label=typeof x==='string'?x:(x.preferredLabel||x.label_ar||x.label||x.skill||'');return label?'<div style="margin:8px 0;padding:8px;border-radius:8px;background:rgba(128,128,128,.08)"><strong>'+esc(label)+'</strong>'+select('s_'+r.id+'_'+i,r.id+':s:'+i)+'</div>':'';}).join('');
 return '<div class="card" style="margin:12px 0;padding:16px"><h4>تقييم المهنة: '+esc(r.vacancy.title||r.vacancy.category||'الفرصة')+'</h4><p>هذا التقييم ليس عبارة عامة. يتم احتساب النتيجة من <strong>معايير مهنية موزونة</strong> مع ربطها بالمهنة ومهاراتها وفق إطار ESCO. ESCO مرجع تصنيفي أوروبي للمهارات والمهن، وليس شهادة أو حكماً رسمياً على الشخص.</p><div style="padding:10px;border-radius:10px;background:rgba(128,128,128,.08);margin-bottom:12px"><strong>المهنة:</strong> '+esc(m.occupation_label||r.vacancy.title||r.vacancy.category||'غير محددة')+'<br><strong>مجموعة ISCO:</strong> '+esc(m.isco_group||'غير محددة')+'</div><h4>أولاً: المعايير المهنية الموزونة</h4>'+criteriaHtml+(skillHtml?'<h4>ثانياً: مهارات المهنة المرتبطة بـ ESCO</h4>'+skillHtml:'')+'<div style="margin-top:14px"><label><strong>ملاحظة مهنية</strong></label><textarea data-note="'+r.id+'" rows="3" style="width:100%;margin-top:6px" placeholder="اكتب ملاحظة مرتبطة بالأداء الفعلي"></textarea></div><button class="primary-btn" data-eval="'+r.id+'" style="width:100%;margin-top:12px">إرسال التقييم المهني</button></div>';
}
async function render(){const db=s();if(!db)return;const p=await me();if(!p)return;let rows=[],workerMode=p.role==='worker';const u=(await db.auth.getSession()).data.session?.user;
 if(workerMode){const w=await db.from('worker_profiles').select('id').eq('user_id',u.id).maybeSingle();if(!w.data)return;const q=await db.from('match_requests').select('id,vacancy_id,status,worker_profile_id').eq('worker_profile_id',w.data.id).in('status',['hired','closed']).order('updated_at',{ascending:false}).limit(20);rows=q.data||[];}
 else{const v=await db.from('employer_vacancies').select('id').eq('employer_id',p.id);if(!v.data?.length)return;const q=await db.from('match_requests').select('id,vacancy_id,status,worker_profile_id').in('vacancy_id',v.data.map(x=>x.id)).in('status',['hired','closed']).order('updated_at',{ascending:false}).limit(20);rows=q.data||[];}
 const enriched=await Promise.all(rows.map(r=>enrichRow(db,r,p,workerMode))); let box=$(workerMode?'madkhalWorkerEvaluationsBox':'madkhalEmployerEvaluationsBox');if(!box){const target=$(workerMode?'workerScreen':'employerScreen')||document.body;box=document.createElement('div');box.id=workerMode?'madkhalWorkerEvaluationsBox':'madkhalEmployerEvaluationsBox';box.className='card';target.appendChild(box);}if(!enriched.length){box.innerHTML='<h3>⭐ التقييم المهني</h3><p>سيظهر التقييم بعد اكتمال عملية التوظيف أو إغلاق المطابقة.</p>';return;}
 const ids=enriched.map(r=>r.id);const existing=await db.from('professional_evaluations').select('match_request_id,evaluator_profile_id').in('match_request_id',ids);const done=new Set((existing.data||[]).filter(x=>x.evaluator_profile_id===p.id).map(x=>x.match_request_id));box.innerHTML='<h3>⭐ التقييم المهني</h3><p>كل بند يُقيّم منفصلاً، وتُستخدم أوزان المعايير بدل تكرار علامة واحدة على جميع البنود.</p>'+enriched.map(r=>done.has(r.id)?'<div class="card" style="margin:10px 0"><strong>تم إرسال تقييمك</strong><p>تم حفظ مساهمتك في السجل المهني.</p></div>':evaluationCard(r)).join('');
 box.querySelectorAll('[data-eval]').forEach(b=>b.onclick=async()=>{const id=b.dataset.eval,r=enriched.find(x=>x.id===id),m=r?.matrix||{},cs=Array.isArray(m.criteria)?m.criteria:[];if(!r?.evaluatee){toast('تعذر تحديد الطرف الذي سيُقيّم.');return;}const scores=cs.map((c,i)=>({code:c.code,label_ar:c.label_ar,weight:Number(c.weight||1),score:Number(box.querySelector('[data-score="'+id+':c:'+i+'"]').value)}));const weighted=scores.reduce((a,x)=>a+x.score*x.weight,0)/Math.max(0.01,scores.reduce((a,x)=>a+x.weight,0));const skillScores=(Array.isArray(m.esco_skills)?m.esco_skills:[]).slice(0,12).map((x,i)=>({label:typeof x==='string'?x:(x.preferredLabel||x.label_ar||x.label||x.skill||''),score:Number(box.querySelector('[data-score="'+id+':s:'+i+'"]')?.value||0)}));const note=box.querySelector('[data-note="'+id+'"]').value.trim();const rr=await db.rpc('submit_professional_evaluation',{p_match_request_id:id,p_evaluatee_profile_id:r.evaluatee,p_overall_rating:Number(weighted.toFixed(2)),p_criteria_scores:{framework:'ESCO-aligned',isco_group:m.isco_group||null,occupation_uri:m.occupation_uri||null,occupation_label:m.occupation_label||r.vacancy.title||null,criteria:scores,esco_skills:skillScores,weighted_overall:Number(weighted.toFixed(2))},p_occupation_uri:m.occupation_uri||null,p_occupation_label:m.occupation_label||r.vacancy.title||null,p_note:note||null});if(rr.error){toast('تعذر إرسال التقييم الآن.');console.warn(rr.error);return;}toast('⭐ تم حفظ التقييم المهني الموزون بنجاح.');render();});
}
window.madkhalLoadEvaluations=render;document.addEventListener('DOMContentLoaded',()=>setTimeout(render,1300));})();
