(function(){
'use strict';
function el(id){return document.getElementById(id)}
function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
function score(v){return Number.isFinite(Number(v))?Math.round(Number(v)):0}
async function loadEmployerDashboard(){
  const user=await sessionUser(); if(!user){showToast('⚠️ سجّل الدخول أولًا.');return}
  const {data:profile,error:pe}=await supabaseClient.from('profiles').select('id').eq('auth_user_id',user.id).eq('role','employer').maybeSingle();
  if(pe||!profile){showToast('⚠️ لم يتم العثور على ملف صاحب الفرصة.');return}
  const {data:vacancies,error}=await supabaseClient.from('employer_vacancies').select('id,title,company_name,location,country,status,number_needed,created_at,expires_at').eq('employer_id',profile.id).order('created_at',{ascending:false}).limit(30);
  if(error){showToast('❌ تعذر تحميل لوحة صاحب الفرصة.');return}
  const panel=el('employerDashboardPanel'); if(!panel)return;
  panel.innerHTML='<div class="dashboard-head"><div><h3>📊 لوحة صاحب الفرصة</h3><p>تابع فرصك والمرشحين ومسار كل مطابقة.</p></div><button class="secondary-btn" id="closeEmployerDashboard">إغلاق</button></div>'+
    ((vacancies||[]).length?'<div id="employerVacanciesList"></div>':'<div class="notice">لا توجد فرص منشورة بعد.</div>');
  panel.classList.remove('hidden');
  el('closeEmployerDashboard').onclick=()=>panel.classList.add('hidden');
  const list=el('employerVacanciesList');
  for(const v of (vacancies||[])){
    const box=document.createElement('div');box.className='dashboard-vacancy';
    box.innerHTML='<div class="vacancy-summary"><div><strong>'+esc(v.title)+'</strong><div class="muted">'+esc(v.company_name)+' · '+esc(v.location||v.country||'')+'</div></div><span class="status-pill">'+esc(v.status)+'</span></div><div class="vacancy-actions"><button class="primary-btn" data-v="'+v.id+'">👥 المرشحون والمطابقات</button></div><div class="candidate-list hidden" id="cand-'+v.id+'"></div>';
    list.appendChild(box);
    box.querySelector('[data-v]').onclick=()=>loadCandidates(v.id,box.querySelector('.candidate-list'));
  }
}
async function loadCandidates(vacancyId,container){
  container.classList.remove('hidden');container.innerHTML='<div class="notice">⏳ جارٍ تحميل المطابقات...</div>';
  const {data,error}=await supabaseClient.rpc('get_my_vacancy_candidates',{p_vacancy_id:vacancyId});
  if(error){container.innerHTML='<div class="notice">⚠️ تعذر تحميل المرشحين.</div>';return}
  if(!data||!data.length){container.innerHTML='<div class="notice">لا توجد مطابقات مسجلة لهذه الفرصة حتى الآن.</div>';return}
  container.innerHTML='<div class="candidate-count">عدد المطابقات: <strong>'+data.length+'</strong></div>';
  data.forEach(c=>{
    const card=document.createElement('div');card.className='candidate-card';
    const name=c.first_name?esc(c.first_name):'باحث عن عمل';
    card.innerHTML='<div class="candidate-top"><strong>'+name+'</strong><span class="match-score">'+score(c.match_score)+'% مطابقة</span></div>'+
      '<div class="candidate-meta">'+(c.profession?'💼 '+esc(c.profession)+' · ':'')+(c.location?'📍 '+esc(c.location)+' · ':'')+(c.experience_years!=null?'🧭 '+esc(c.experience_years)+' سنة خبرة':'')+'</div>'+
      '<div class="candidate-meta">'+(c.qualification?'🎓 '+esc(c.qualification):'')+(c.work_type?' · ⏱️ '+esc(c.work_type):'')+'</div>'+
      '<div class="candidate-skills">'+(c.skills?'🛠️ '+esc(c.skills):'')+'</div>'+
      '<div class="candidate-status">الحالة: <strong>'+esc(c.match_status)+'</strong></div>'+
      '<div class="candidate-actions"></div>';
    const actions=card.querySelector('.candidate-actions');
    const next={matched:['employer_interested','إبداء الاهتمام'],employer_interested:['accepted','طلب القبول'],accepted:['contact_opened','فتح التواصل'],contact_opened:['interview','تحديد مقابلة'],interview:['offer','تقديم عرض'],offer:['hired','تسجيل التوظيف']};
    const n=next[c.match_status];
    if(n){
      const b=document.createElement('button');b.className='secondary-btn';b.textContent='➡️ '+n[1];
      b.onclick=async()=>{
        b.disabled=true;
        const r=await supabaseClient.rpc('advance_match_request',{p_request_id:c.request_id,p_next_status:n[0],p_note:null});
        if(r.error){b.disabled=false;showToast('⚠️ تعذر تحديث الحالة.');return}
        c.match_status=n[0];card.querySelector('.candidate-status').innerHTML='الحالة: <strong>'+esc(n[0])+'</strong>';
        b.remove();showToast('✅ تم تحديث حالة المطابقة.');
        if(n[0]==='contact_opened')showToast('📞 أصبح التواصل متاحًا ضمن مسار المطابقة.');
      };
      actions.appendChild(b);
    }
    container.appendChild(card);
  });
}
function injectDashboard(){
  const form=el('submitVacancyButton')?.closest('.card'); if(!form||el('employerDashboardButton'))return;
  const btn=document.createElement('button');btn.type='button';btn.id='employerDashboardButton';btn.className='secondary-btn action-btn';btn.textContent='📊 لوحة صاحب الفرصة';btn.onclick=async()=>{await loadEmployerDashboard();document.getElementById('employerDashboardPanel')?.scrollIntoView({behavior:'smooth',block:'start'});};
  const panel=document.createElement('div');panel.id='employerDashboardPanel';panel.className='card hidden';
  panel.style.marginTop='14px';
  form.parentElement.insertBefore(panel,form.nextSibling);
  form.appendChild(btn);
  const style=document.createElement('style');style.textContent='.dashboard-head,.vacancy-summary,.candidate-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.dashboard-head{align-items:center}.dashboard-vacancy,.candidate-card{border:1px solid var(--line);border-radius:14px;padding:14px;margin-top:12px;background:var(--card)}.vacancy-actions,.candidate-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.candidate-card{background:#fbfdfd}.match-score{font-weight:900;color:var(--teal)}.candidate-meta,.candidate-skills,.candidate-status{margin-top:7px;line-height:1.6}.candidate-count{margin-top:10px}.status-pill{padding:5px 9px;border-radius:999px;background:var(--teal2);font-weight:800}.muted{color:var(--muted);margin-top:5px}.hidden{display:none!important}';
  document.head.appendChild(style);
}
document.addEventListener('DOMContentLoaded',injectDashboard);
window.openEmployerDashboard=loadEmployerDashboard;
})();