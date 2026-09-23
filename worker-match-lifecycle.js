(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function loadWorkerMatchCenter(){
 const u=await sessionUser(); if(!u){showToast('⚠️ سجّل الدخول أولًا.');return}
 const panel=$('workerMatchCenter'); if(!panel)return;
 const p=localProfile();
 panel.classList.remove('hidden');
 panel.innerHTML='<div class="notice">⏳ جارٍ تحديث المطابقة...</div>';
 try{await supabaseClient.rpc('process_my_worker_matches',{p_limit:200})}catch(e){console.warn('worker match processing',e)}
 try{await supabaseClient.rpc('create_worker_match_notifications',{p_limit:50})}catch(e){console.warn('worker notifications',e)}
 const r=await supabaseClient.rpc('get_my_worker_matches');
 if(r.error){panel.innerHTML='<div class="notice">⚠️ تعذر تحميل مسار المطابقات.</div>';return}
 const rows=r.data||[];
 // مطابقة مستقلة للفرص الخارجية: لا تعتمد على قائمة الفرص المعروضة في الصفحة ولا على درجة عامة مخزنة.
 const clean=s=>String(s??'').toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const words=s=>clean(s).split(/\s+/).filter(x=>x.length>=3);
 const occupationScore=(occ,title)=>{
   const o=clean(occ),t=clean(title); if(!o||!t)return 0;
   const groups=[
     {keys:['مدرس لغه عربيه','معلم لغه عربيه','معلم عربي','مدرس عربي','arabic teacher','arabic language teacher'],terms:['مدرس لغه عربيه','معلم لغه عربيه','معلم عربي','مدرس عربي','arabic teacher','arabic language teacher']},
     {keys:['مدرس لغه انجليزيه','معلم لغه انجليزيه','مدرس انجليزي','معلم انجليزي','english teacher','english language teacher'],terms:['مدرس لغه انجليزيه','معلم لغه انجليزيه','مدرس انجليزي','معلم انجليزي','english teacher','english language teacher']},
     {keys:['مدرس رياضيات','معلم رياضيات','math teacher','mathematics teacher'],terms:['مدرس رياضيات','معلم رياضيات','math teacher','mathematics teacher']},
     {keys:['محاسب','accountant','accounting'],terms:['محاسب','accountant','accounting']}
   ];
   for(const g of groups)if(g.keys.some(k=>o.includes(clean(k))))return g.terms.some(k=>t.includes(clean(k)))?45:0;
   const teacherProfile=['مدرس','معلم','تدريس','تعليم','teacher','teaching'].some(k=>o.includes(clean(k)));
   const teacherJob=['مدرس','معلم','تدريس','تعليم','teacher','teaching'].some(k=>t.includes(clean(k)));
   if(teacherProfile&&teacherJob)return 20;
   const direct=t.includes(o)||o.includes(t); if(direct)return 45;
   const ow=words(o),hits=ow.filter(w=>t.includes(w)).length;
   return ow.length?Math.min(35,Math.round(hits/Math.min(ow.length,3)*35)):0;
 };
 const scoreExternal=(j,p)=>{
   const title=[j.title,j.category].filter(Boolean).join(' ');
   const text=[j.title,j.category,j.description].filter(Boolean).join(' ');
   let s=0;
   s+=occupationScore(p.occupation_label||p.profession||'',title);
   const sk=words(p.skills||'');
   if(sk.length)s+=Math.min(25,Math.round(sk.filter(w=>clean(text).includes(w)).length/Math.min(sk.length,5)*25));
   const loc=clean(p.location||'');
   if(loc&&clean(j.location||'').includes(loc))s+=10;
   const wt=clean(p.work_type||'');
   const jt=clean(j.job_type||j.type||'');
   if(wt&&wt!=='any'&&((wt==='remote'&&jt.includes('remote'))||jt.includes(wt)))s+=10;
   return Math.max(0,Math.min(100,Math.round(s)));
 };
 let publicMatches=[];
 try{
   const q=await supabaseClient.from('jobs').select('id,title,company,location,country,job_type,category,description,source,source_url,status,geo_class,expires_at').eq('status','active').in('geo_class',['SYRIA','MENA']).order('created_at',{ascending:false}).limit(500);
   if(!q.error){
     publicMatches=(q.data||[]).map(j=>({j,s:scoreExternal(j,p)})).filter(x=>x.s>=35).sort((a,b)=>b.s-a.s).slice(0,10);
   }else console.warn('external jobs lookup',q.error);
 }catch(e){console.warn('external jobs lookup',e)}
 if(!rows.length&&!publicMatches.length){
   panel.innerHTML='<div class="notice">لا توجد مطابقة مهنية جديدة حاليًا. سيظهر المسار هنا عند العثور على فرصة مناسبة.</div>';return
 }
 panel.innerHTML='<div class="match-center-head"><div><h3>🎯 المطابقات ومسار التوظيف</h3><p>يعرض مَدخَل هنا المطابقات المباشرة مع أصحاب الفرص، وأقرب الفرص المنشورة في مصادر مَدخَل.</p></div><button class="secondary-btn" id="closeWorkerMatches">إغلاق</button></div><div id="workerMatchList"></div>';
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
   const h=document.createElement('div');h.className='notice success';h.style.marginTop='14px';h.textContent='🔎 أقرب الفرص المنشورة حاليًا';list.appendChild(h);
   publicMatches.forEach(x=>{
    const j=x.j;const card=document.createElement('div');card.className='worker-match-card';
    card.innerHTML='<div class="candidate-top"><strong>'+esc(j.title)+'</strong><span class="match-score">'+x.s+'% مطابقة</span></div>'+
      '<div class="candidate-meta">🏢 '+esc(j.company||'—')+(j.location?' · 📍 '+esc(j.location):'')+(j.country?' · '+esc(j.country):'')+'</div>'+
      '<div class="candidate-meta">المصدر: '+esc(j.source_name||j.source||'مَدخَل')+'</div>'+
      '<div class="worker-match-actions"></div>';
    const ab=card.querySelector('.worker-match-actions');
    if(j.source_url){
      const link=document.createElement('a');link.href=j.source_url;link.target='_blank';link.rel='noopener noreferrer';link.className='primary-btn';link.style.textAlign='center';link.style.textDecoration='none';link.textContent='🔗 فتح الإعلان';
      ab.appendChild(link);
    }else{
      const btn=document.createElement('button');btn.className='secondary-btn';btn.textContent='🔎 عرض الفرص';btn.onclick=()=>openOpportunities();ab.appendChild(btn);
    }
    list.appendChild(card);
   });
 }
}
function injectWorkerMatchCenter(){
 const worker=$('workerScreen'); if(!worker||$('workerMatchCenter'))return;
 const panel=document.createElement('div');panel.id='workerMatchCenter';panel.className='card hidden';panel.style.marginTop='14px';worker.appendChild(panel);
 const action=worker.querySelector('[onclick*="openAccount"]');
 if(action){const b=document.createElement('button');b.className='secondary-btn action-btn';b.textContent='🎯 المطابقات ومسار التوظيف';b.onclick=loadWorkerMatchCenter;action.parentElement.insertBefore(b,action.nextSibling)}
 const st=document.createElement('style');st.textContent='.match-center-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.worker-match-card{border:1px solid var(--line);border-radius:14px;padding:14px;margin-top:12px;background:var(--card)}.worker-match-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.worker-match-actions button{flex:1;min-width:150px}.worker-match-actions .notice{width:100%}';document.head.appendChild(st);
}
document.addEventListener('DOMContentLoaded',injectWorkerMatchCenter);
window.openWorkerMatchCenter=loadWorkerMatchCenter;
})();