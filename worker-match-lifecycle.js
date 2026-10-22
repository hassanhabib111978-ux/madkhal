(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function canonicalClean(v){return String(v??'').toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/&nbsp;|&#160;/gi,' ').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim()}
function canonicalWords(s){return canonicalClean(s).split(/\s+/).filter(x=>x.length>=3)}
function canonicalOccupationScore(occ,title){
 const o=canonicalClean(occ),t=canonicalClean(title); if(!o||!t)return 0;
 // ICT / telecommunications systems and configuration-management occupations.
 // Treat close technical roles as related when the selected occupation explicitly belongs to this family.
 const ictProfile=/(تكنولوجيا المعلومات|تقنيه المعلومات|المعلومات والاتصالات|الاتصالات|information technology|information and communications|telecommunications|telecom|\bict\b|it systems|configuration manager)/.test(o);
 const ictJob=/(تكنولوجيا المعلومات|تقنيه المعلومات|المعلومات والاتصالات|الاتصالات|مهندس شبكات|مهندس اتصالات|مسؤول شبكات|مدير الشبكات|مسؤول انظمه|مسؤول نظم|اداره الانظمه|اداره نظم|تهيئه الانظمه|اعداد الانظمه|الدعم الفني|دعم فني|تقني المعلومات|information technology|information systems|\bict\b|\btelecommunications?\b|\btelecom\b|\bnetwork (engineer|administrator|admin|manager|specialist)\b|\bsystems? (administrator|admin|engineer|manager|configuration|config)\b|\bconfiguration (manager|analyst|specialist|engineer)\b|\bit support\b|\btechnical support\b|\bsysadmin\b)/.test(t);
 if(ictProfile&&ictJob)return 42;
 const groups=[
  ['مدرس أدب','مدرس الادب','معلم أدب','معلم الادب','literature teacher','arabic literature teacher'],
  ['مدرس لغه عربيه','معلم لغه عربيه','معلم عربي','مدرس عربي','arabic teacher','arabic language teacher'],
  ['مدرس لغه انجليزيه','معلم لغه انجليزيه','مدرس انجليزي','معلم انجليزي','english teacher','english language teacher','english instructor','language instructor','english tutor'],
  ['مدرس رياضيات','معلم رياضيات','math teacher','mathematics teacher'],
  ['محاسب','accountant','accounting']
 ];
 for(const g of groups){
   if(g.some(k=>o.includes(canonicalClean(k)))){
     if(g.some(k=>t.includes(canonicalClean(k))))return 45;
     // Allow equivalent job titles (e.g. English Language Instructor) instead of
     // returning zero merely because the wording differs from the profile label.
     if(g.includes('english teacher')&&/(english|language).*(teacher|instructor|tutor)|(teacher|instructor|tutor).*(english|language)/.test(t))return 42;
     if(g.includes('arabic teacher')&&/(arabic|العربيه|عربي).*(teacher|instructor|معلم|مدرس)|(teacher|instructor|معلم|مدرس).*(arabic|العربيه|عربي)/.test(t))return 42;
     if(g.includes('math teacher')&&/(math|mathematics|رياضيات).*(teacher|instructor)|(teacher|instructor).*(math|mathematics)/.test(t))return 42;
     continue;
   }
 }
 const teacherProfile=['مدرس','معلم','تدريس','تعليم','teacher','teaching'].some(k=>o.includes(canonicalClean(k)));
 const teacherJob=['مدرس','معلم','تدريس','تعليم','teacher','teaching'].some(k=>t.includes(canonicalClean(k)));
 if(teacherProfile&&teacherJob)return 20;
 if(t.includes(o)||o.includes(t))return 45;
 const stop=new Set(['مهندس','مهندسه','مهندسون','مدير','مديره','مسؤول','مسئول','مساعد','متخصص','اخصائي','اختصاصي','فني','موظف','عمل','وظيفه','فرصه','اعلان','شركة','شركه','the','and','for','with','from','job','jobs','senior','junior','assistant','specialist','officer','engineer','manager','professional']);
 const ow=canonicalWords(o).filter(w=>!stop.has(w));
 const hits=ow.filter(w=>t.includes(w)).length;
 // Weak word overlap alone must not create a misleading 35% match.
 return ow.length?Math.min(25,Math.round(hits/Math.min(ow.length,3)*25)):0;
}
function calculateCanonicalPublicJobMatchScore(job,p){
 const profile=p||{};
 const title=[job?.title,job?.category].filter(Boolean).join(' ');
 const text=[job?.title,job?.category,job?.description].filter(Boolean).join(' ');
 const profileOcc=profile.occupation_label||profile.profession||'';
 if(!canonicalClean(profileOcc)||!canonicalClean(title))return 0;
 const profileSkills=canonicalClean(profile.skills||'');
 const specialtyTerms=['أدب','ادب','literature','عربي','لغة عربية','arabic','انجليزي','لغة انجليزية','english','رياضيات','math','mathematics'];
 const explicitSpecialty=specialtyTerms.some(k=>canonicalClean(title).includes(canonicalClean(k)));
 const profileHasSpecialty=specialtyTerms.some(k=>profileOcc&&canonicalClean(profileOcc).includes(canonicalClean(k)))||specialtyTerms.some(k=>profileSkills.includes(canonicalClean(k)));
 const occ=canonicalOccupationScore(profileOcc,title);
 let score=occ;
 if(explicitSpecialty&&!profileHasSpecialty)score=Math.min(15,occ);
 const sk=canonicalWords(profile.skills||'');
 if(sk.length)score+=Math.min(30,Math.round(sk.filter(w=>canonicalClean(text).includes(w)).length/Math.min(sk.length,5)*30));
 // Education is supporting evidence only: it can strengthen an occupation-related result, never make an unrelated job look like a match.
 const qualification=canonicalClean(profile.qualification||'');
 const qualificationTerms=canonicalWords(qualification).filter(w=>w.length>=4&&!['degree','bachelor','master','diploma','university','college','علوم','علمي','جامعي','بكالوريوس','ماجستير','دبلوم'].includes(w));
 const qualificationHits=qualificationTerms.filter(w=>canonicalClean(text).includes(w)).length;
 if(occ>=15&&qualificationHits)score+=Math.min(15,Math.round(qualificationHits/Math.min(qualificationTerms.length,3)*15));
 const loc=canonicalClean(profile.location||'');
 const jobLoc=canonicalClean(job?.location||job?.country||'');
 if(loc&&jobLoc.includes(loc))score+=10;
 const wt=canonicalClean(profile.work_type||'');
 const jt=canonicalClean(job?.job_type||job?.type||'');
 if(wt&&wt!=='any'&&((wt==='remote'&&jt.includes('remote'))||jt.includes(wt)))score+=10;
 return Math.max(0,Math.min(100,Math.round(score)));
}
function publicOpportunityKey(job){
 const url=canonicalClean(job?.canonical_url||job?.source_url||job?.canonical_link||job?.external_link||'');
 if(url)return 'url|'+url;
 return 'meta|'+canonicalClean([job?.source,job?.title,job?.company,job?.location,job?.country].join('|'));
}
function getCanonicalWorkerPublicMatches(jobs,p,limit=10){
 const profile=p||localProfile();
 const seen=new Set(),ranked=[];
 (Array.isArray(jobs)?jobs:[]).forEach(job=>{
   if(!job||!String(job.title||'').trim())return;
   const key=publicOpportunityKey(job);if(seen.has(key))return;seen.add(key);
   const score=calculateCanonicalPublicJobMatchScore(job,profile);
   ranked.push({j:job,s:score});
 });
 ranked.sort((a,b)=>b.s-a.s);
 const matched=ranked.filter(x=>x.s>=35);
 // Never hide all published opportunities solely because the stricter score falls below the professional-match threshold.
 // If there are no qualified matches, show a separate general-opportunities fallback without presenting it as a confirmed match.
 const result=matched.length?matched:ranked.map(x=>({...x,general:true}));
 return result.slice(0,Math.max(1,Number(limit)||10));
}
window.calculateCanonicalPublicJobMatchScore=calculateCanonicalPublicJobMatchScore;
window.getCanonicalWorkerPublicMatches=getCanonicalWorkerPublicMatches;

async function subscriptionIsActive(){
 // مَدخَل في مرحلة الإطلاق المجاني: المطابقة الأساسية متاحة للجميع.
 return true;
}

async function loadCanonicalWorkerMatchData(profile){
 // Canonical matching always refreshes the persisted worker profile first, so callers such as Jibran or the account screen cannot calculate from stale local data.
 let p=profile||localProfile();
 try{
  if(typeof window.loadProfileRemote==='function'){
   await window.loadProfileRemote();
   p=localProfile()||p;
  }
 }catch(e){console.warn('canonical profile refresh',e)}
 let directMatches=[],directError=null;
 const paid=await subscriptionIsActive();
 // الإطلاق المجاني: لا نستدعي دوال المعالجة/التنبيهات المقيدة بالاشتراك.
 // نقرأ فقط المطابقات المهنية الموثقة التي أنشأها مسار صاحب الفرصة، ثم نعرض الفرص العامة مجانًا.
 try{
  const r=await supabaseClient.rpc('get_my_worker_matches');
  if(r?.error)directError=r.error;else directMatches=r.data||[];
 }catch(e){directError=e}
 let publicJobs=[];
 try{if(typeof loadJobs==='function')publicJobs=await loadJobs(false)}catch(e){console.warn('worker public jobs',e)}
 const publicMatches=window.getCanonicalWorkerPublicMatches?window.getCanonicalWorkerPublicMatches(publicJobs,p,10):[];
 return {directMatches,publicMatches,directError,paid};
}
window.loadCanonicalWorkerMatchData=loadCanonicalWorkerMatchData;

function revealWorkerMatchPanel(panel){
 try{
  window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
   panel.scrollIntoView({behavior:'smooth',block:'start'});
  }));
 }catch(e){console.warn('worker match scroll',e)}
}
async function loadWorkerMatchCenter(){
 const u=await sessionUser();if(!u){showToast('⚠️ سجّل الدخول أولًا.');return}
 const panel=$('workerMatchCenter');if(!panel)return;
 // Keep the match center aligned with the saved worker profile before calculating public matches.
 try{if(typeof window.loadProfileRemote==='function')await window.loadProfileRemote()}catch(e){console.warn('canonical worker profile refresh',e)}
 const p=localProfile();
 panel.classList.remove('hidden');
 panel.style.scrollMarginTop='90px';
 panel.innerHTML='<div class="notice">⏳ جارٍ تحديث مسار مَدخَل الموحد...</div>';
 revealWorkerMatchPanel(panel);
 const data=await loadCanonicalWorkerMatchData(p);
 const allDirectMatches=data.directMatches||[];
 // لا نعرض الحالات النهائية القديمة داخل مركز المطابقات الحالي؛ تبقى محفوظة في السجل.
 const activeStatuses=new Set(['matched','employer_interested','accepted','contact_opened','interview','offer']);
 const rows=allDirectMatches.filter(x=>activeStatuses.has(String(x.status||'')));
 const publicMatches=data.publicMatches||[];
 if(data.directError&&!publicMatches.length){
  panel.innerHTML='<div class="notice">⚠️ تعذر تحميل مسار المطابقات.</div>';revealWorkerMatchPanel(panel);return
 }
 if(!rows.length&&!publicMatches.length){
  panel.innerHTML='<div class="notice">لا توجد مطابقة مهنية جديدة حاليًا. سيظهر المسار هنا عند العثور على فرصة مناسبة.</div>';revealWorkerMatchPanel(panel);return
 }
 panel.innerHTML='<div class="match-center-head"><div><h3>🎯 المطابقات ومسار التوظيف</h3><p>المطابقة المباشرة والبحث عن الفرص متاحان مجانًا خلال مرحلة الإطلاق. الاشتراك مؤجل حاليًا.</p></div><button class="secondary-btn" id="closeWorkerMatches">إغلاق</button></div><div id="workerMatchList"></div>';
 $('closeWorkerMatches').onclick=()=>panel.classList.add('hidden');
 const list=$('workerMatchList');
 if(rows.length){
  const h=document.createElement('div');h.className='notice success';h.textContent='📩 مطابقات مباشرة مع أصحاب الفرص';list.appendChild(h);
  rows.forEach(c=>{
   const card=document.createElement('div');card.className='worker-match-card';
   card.innerHTML='<div class="candidate-top"><strong>'+esc(c.title)+'</strong><span class="match-score">'+Math.round(Number(c.match_score)||0)+'% مطابقة</span></div>'+
    '<div class="candidate-meta">🏢 '+esc(c.company_name||'جهة عمل')+(c.location?' · 📍 '+esc(c.location):'')+(c.job_type?' · ⏱️ '+esc(c.job_type):'')+'</div>'+
    '<div class="candidate-status">الحالة: <strong>'+esc(c.status)+'</strong></div>'+
    (c.employer_note?'<div class="candidate-meta">📝 '+esc(c.employer_note)+'</div>':'')+
    '<div class="worker-match-actions"></div>';
   const actBox=card.querySelector('.worker-match-actions');
   if(c.status==='employer_interested'){
    const accept=document.createElement('button');accept.className='primary-btn';accept.textContent='✅ أوافق على المتابعة';
    const decline=document.createElement('button');decline.className='secondary-btn';decline.textContent='↩️ لا أرغب';
    const act=async(next,btn)=>{btn.disabled=true;const x=await supabaseClient.rpc('advance_match_request',{p_request_id:c.request_id,p_next_status:next,p_note:null});if(x.error){btn.disabled=false;showToast('⚠️ تعذر تحديث الرد.');return}showToast(next==='accepted'?'✅ تم قبول المتابعة.':'تم رفض المطابقة.');loadWorkerMatchCenter()};
    accept.onclick=()=>act('accepted',accept);decline.onclick=()=>act('declined',decline);actBox.append(accept,decline);
   }else if(c.status==='accepted'){const n=document.createElement('div');n.className='notice';n.textContent='✅ تم قبولك للمطابقة. بانتظار صاحب الفرصة لفتح التواصل.';actBox.appendChild(n)}
   else if(c.status==='contact_opened'){const n=document.createElement('div');n.className='notice';n.textContent='📞 تم فتح مرحلة التواصل. تابع تعليمات جهة العمل للتنسيق.';actBox.appendChild(n)}
   else if(['interview','offer','hired'].includes(c.status)){const labels={interview:'🗣️ تم الانتقال إلى المقابلة',offer:'📄 تم تقديم عرض',hired:'🎉 تم تسجيل التوظيف'};const n=document.createElement('div');n.className='notice';n.textContent=labels[c.status];actBox.appendChild(n)}
   list.appendChild(card);
  });
 }
 if(publicMatches.length){
  const generalFallback=publicMatches.every(x=>x.general);
  const h=document.createElement('div');h.className='notice success';h.style.marginTop='14px';h.textContent=generalFallback?'📋 لم تظهر مطابقة مهنية فوق الحد المطلوب؛ هذه فرص منشورة عامة يمكنك مراجعتها يدويًا.':'🔎 أقرب الفرص المنشورة حاليًا — متاحة مجانًا';list.appendChild(h);
  publicMatches.forEach(x=>{
   const j=x.j,score=x.s;const card=document.createElement('div');card.className='worker-match-card';
   card.innerHTML='<div class="candidate-top"><strong>'+esc(j.title)+'</strong><span class="match-score">'+(x.general?'فرصة عامة':score+'% ملاءمة')+'</span></div>'+
    '<div class="candidate-meta">🏢 '+esc(j.company||'—')+(j.location?' · 📍 '+esc(j.location):'')+(j.country?' · '+esc(j.country):'')+'</div>'+
    '<div class="candidate-meta">المصدر: '+esc(j.source_name||j.source||'مَدخَل')+'</div>'+
    (x.general?'<div class="notice">هذه فرصة منشورة وليست مطابقة مهنية مؤكدة؛ راجع شروط الإعلان قبل التقديم.</div>':'<div class="notice">درجة الملاءمة تقديرية من بيانات الملف والفرصة، وليست وعدًا بالتوظيف.</div>')+
    '<div class="worker-match-actions"></div>';
   const ab=card.querySelector('.worker-match-actions');
   if(j.source_url){const link=document.createElement('a');link.href=j.source_url;link.target='_blank';link.rel='noopener noreferrer';link.className='primary-btn';link.style.textAlign='center';link.style.textDecoration='none';link.textContent='🔗 فتح الإعلان';ab.appendChild(link)}
   else{const btn=document.createElement('button');btn.className='secondary-btn';btn.textContent='🔎 عرض الفرص';btn.onclick=()=>openOpportunities();ab.appendChild(btn)}
   list.appendChild(card);
  });
 }
 revealWorkerMatchPanel(panel);
}
function injectWorkerMatchCenter(){
 const worker=$('workerScreen');
 if(!worker||$('workerMatchCenter'))return;
 const panel=document.createElement('div');
 panel.id='workerMatchCenter';
 panel.className='card hidden';
 panel.style.marginTop='14px';
 worker.appendChild(panel);

 // Reuse the existing button instead of injecting a duplicate with the same label.
 const matchButtons=[...worker.querySelectorAll('button')].filter(b=>
  String(b.textContent||'').includes('المطابقات ومسار التوظيف')
 );
 const existing=matchButtons.shift();
 // Keep one authoritative match button only; remove stale duplicate buttons.
 matchButtons.forEach(b=>b.remove());
 if(existing){
  existing.removeAttribute('onclick');
  existing.onclick=loadWorkerMatchCenter;
  existing.setAttribute('aria-label','فتح المطابقات المهنية ومسار التوظيف');
 }else{
  const action=worker.querySelector('[onclick*="openAccount"]');
  if(action){
   const b=document.createElement('button');
   b.className='secondary-btn action-btn';
   b.textContent='🎯 المطابقات ومسار التوظيف';
   b.onclick=loadWorkerMatchCenter;
   action.parentElement.insertBefore(b,action.nextSibling);
  }
 }
 const st=document.createElement('style');
 st.textContent='.match-center-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.worker-match-card{border:1px solid var(--line);border-radius:14px;padding:14px;margin-top:12px;background:var(--card)}.worker-match-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.worker-match-actions button{flex:1;min-width:150px}.worker-match-actions .notice{width:100%}';
 document.head.appendChild(st);
}
document.addEventListener('DOMContentLoaded',injectWorkerMatchCenter);
window.openWorkerMatchCenter=loadWorkerMatchCenter;
})();