(function(){
'use strict';
function E(id){return document.getElementById(id)}
function esc2(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
async function loadEmployerDashboardPolished(){
  const user=await sessionUser(); if(!user){showToast('⚠️ سجّل الدخول أولًا.');return}
  const {data:profile,error:pe}=await supabaseClient.from('profiles').select('id').eq('auth_user_id',user.id).eq('role','employer').maybeSingle();
  if(pe||!profile){showToast('⚠️ لم يتم العثور على ملف صاحب الفرصة.');return}
  const {data:vacancies,error}=await supabaseClient.from('employer_vacancies').select('id,title,company_name,location,country,status,number_needed,created_at,expires_at').eq('employer_id',profile.id).order('created_at',{ascending:false}).limit(30);
  if(error){showToast('❌ تعذر تحميل لوحة صاحب الفرصة.');return}
  const panel=E('employerDashboardPanel'); if(!panel)return;
  const vs=vacancies||[];
  let total=0,highest=0,interviews=0,offers=0;
  const counts=[];
  for(const v of vs){
    const r=await supabaseClient.rpc('get_my_vacancy_candidates',{p_vacancy_id:v.id});
    const rows=r.error?[]:(r.data||[]);
    total+=rows.length;
    highest=Math.max(highest,...rows.map(x=>Number(x.match_score)||0));
    interviews+=rows.filter(x=>['interview','offer','hired'].includes(x.match_status)).length;
    offers+=rows.filter(x=>['offer','hired'].includes(x.match_status)).length;
    counts.push({v,rows});
  }
  panel.innerHTML='<div class="dashboard-head"><div><h3>📊 لوحة صاحب الفرصة</h3><p>ملخص فرصك، المطابقات، ومسار المرشحين.</p></div><button class="secondary-btn" id="closeEmployerDashboard">إغلاق</button></div>'+
    '<div class="employer-metrics">'+
    '<div class="metric-box"><strong>'+vs.length+'</strong><span>الفرص</span></div>'+
    '<div class="metric-box"><strong>'+total+'</strong><span>المطابقات</span></div>'+
    '<div class="metric-box"><strong>'+Math.round(highest)+'%</strong><span>أعلى مطابقة</span></div>'+
    '<div class="metric-box"><strong>'+interviews+'</strong><span>مقابلات+مسار</span></div>'+
    '<div class="metric-box"><strong>'+offers+'</strong><span>عروض+توظيف</span></div></div>'+
    (vs.length?'<div id="employerVacanciesList"></div>':'<div class="notice">لا توجد فرص منشورة بعد.</div>');
  panel.classList.remove('hidden');
  E('closeEmployerDashboard').onclick=()=>panel.classList.add('hidden');
  const list=E('employerVacanciesList');
  for(const item of counts){
    const v=item.v, rows=item.rows;
    const box=document.createElement('div');box.className='dashboard-vacancy';
    box.innerHTML='<div class="vacancy-summary"><div><strong>'+esc2(v.title)+'</strong><div class="muted">'+esc2(v.company_name)+' · '+esc2(v.location||v.country||'')+'</div></div><span class="status-pill">'+esc2(v.status)+'</span></div>'+
      '<div class="vacancy-mini">المطلوب: '+(Number(v.number_needed)||1)+' · المطابقات: '+rows.length+'</div>'+
      '<div class="vacancy-actions"><button class="primary-btn" data-v="'+v.id+'">👥 المرشحون والمطابقات</button></div><div class="candidate-list hidden" id="cand2-'+v.id+'"></div>';
    list.appendChild(box);
    box.querySelector('[data-v]').onclick=()=>loadCandidatesPolished(v.id,box.querySelector('.candidate-list'));
  }
}
async function loadCandidatesPolished(vacancyId,container){
  container.classList.remove('hidden');container.innerHTML='<div class="notice">⏳ جارٍ تحميل المطابقات...</div>';
  const {data,error}=await supabaseClient.rpc('get_my_vacancy_candidates',{p_vacancy_id:vacancyId});
  if(error){container.innerHTML='<div class="notice">⚠️ تعذر تحميل المرشحين.</div>';return}
  if(!data?.length){container.innerHTML='<div class="notice">لا توجد مطابقات مسجلة لهذه الفرصة حتى الآن.</div>';return}
  container.innerHTML='<div class="candidate-count">عدد المطابقات: <strong>'+data.length+'</strong></div>';
  data.forEach(c=>{
    const card=document.createElement('div');card.className='candidate-card';
    card.innerHTML='<div class="candidate-top"><strong>'+esc2(c.first_name||'باحث عن عمل')+'</strong><span class="match-score">'+Math.round(Number(c.match_score)||0)+'% مطابقة</span></div>'+
      '<div class="candidate-meta">'+(c.profession?'💼 '+esc2(c.profession)+' · ':'')+(c.location?'📍 '+esc2(c.location)+' · ':'')+(c.experience_years!=null?'🧭 '+esc2(c.experience_years)+' سنة خبرة':'')+'</div>'+
      '<div class="candidate-meta">'+(c.qualification?'🎓 '+esc2(c.qualification):'')+(c.work_type?' · ⏱️ '+esc2(c.work_type):'')+'</div>'+
      '<div class="candidate-skills">'+(c.skills?'🛠️ '+esc2(c.skills):'')+'</div>'+
      '<div class="candidate-status">الحالة: <strong>'+esc2(c.match_status)+'</strong></div><div class="candidate-actions"></div>';
    const actions=card.querySelector('.candidate-actions');
    const next={matched:['employer_interested','إبداء الاهتمام'],employer_interested:['accepted','طلب القبول'],accepted:['contact_opened','فتح التواصل'],contact_opened:['interview','تحديد مقابلة'],interview:['offer','تقديم عرض'],offer:['hired','تسجيل التوظيف']}[c.match_status];
    if(next){
      const b=document.createElement('button');b.className='secondary-btn';b.textContent='➡️ '+next[1];
      b.onclick=async()=>{b.disabled=true;const r=await supabaseClient.rpc('advance_match_request',{p_request_id:c.request_id,p_next_status:next[0],p_note:null});if(r.error){b.disabled=false;showToast('⚠️ تعذر تحديث الحالة.');return}showToast('✅ تم تحديث حالة المطابقة إلى '+next[1]+'。');loadCandidatesPolished(vacancyId,container)};
      actions.appendChild(b);
    }
    container.appendChild(card);
  });
}
window.openEmployerDashboard=loadEmployerDashboardPolished;
document.addEventListener('DOMContentLoaded',()=>{
  const st=document.createElement('style');st.textContent='.employer-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.metric-box{border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center;background:var(--card)}.metric-box strong{display:block;font-size:24px;font-weight:900}.metric-box span{display:block;margin-top:4px;color:var(--muted);font-size:13px}.vacancy-mini{margin-top:8px;color:var(--muted);font-size:13px}@media(min-width:600px){.employer-metrics{grid-template-columns:repeat(5,minmax(0,1fr))}}';document.head.appendChild(st);
  const old=E('employerDashboardButton'); if(old) old.onclick=loadEmployerDashboardPolished;
});
})();