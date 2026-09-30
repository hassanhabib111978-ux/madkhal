(function(){
'use strict';
function byId(id){return document.getElementById(id)}
function parseSalary(v){const s=String(v||'').trim();if(!s)return {min:null,max:null,currency:null};const nums=(s.match(/\d+(?:[.,]\d+)?/g)||[]).map(x=>Number(x.replace(',','.'))).filter(Number.isFinite);const cur=(s.match(/\b(USD|EUR|AED|SAR|QAR|KWD|BHD|OMR|SYP|TRY)\b/i)||[])[1]||null;return {min:nums[0]??null,max:nums.length>1?nums[1]:nums[0]??null,currency:cur?cur.toUpperCase():null}}
async function initEmployerOccupationChoice(){
 const input=byId('employerOccupationSearch'),uri=byId('employerOccupationUri'),label=byId('employerOccupationLabel');
 if(!input||!uri||!label)return;
 if(byId('employerOccupationSelect'))return;
 input.readOnly=true;input.placeholder='اختر المهنة المطلوبة من القائمة';input.style.display='none';
 const box=input.closest('.occupation-box');if(!box)return;
 const wrap=document.createElement('div');wrap.className='employer-occupation-choice';
 wrap.innerHTML='<label style="display:block;font-size:13px;font-weight:900;margin-bottom:6px">المهنة المطلوبة — اختر من القائمة</label><select id="employerOccupationSelect"><option value="">⏳ جارٍ تحميل المهن...</option></select><div id="employerOccupationStatus" class="occupation-status">اختر مهنة من القائمة؛ سيتم حفظ المهنة المعتمدة مع الفرصة.</div>';
 box.insertBefore(wrap,input);
 const select=wrap.querySelector('select');
 try{
  const terms=['محاسب','مدرس','معلم','مهندس','مبرمج','مصمم','مبيعات','سائق','ممرض','طبيب','مدير','سكرتير','فني','كهربائي','ميكانيكي','عامل'];
  const opts=[];
  const add=(o,fallback)=>{
    const ur=o?.concept_uri||o?.conceptUri||o?.concepturi||o?.uri||'';
    const lab=o?.preferred_label||o?.preferredLabel||o?.preferredlabel||fallback||'';
    if(ur&&lab&&!opts.some(x=>x.uri===ur))opts.push({label:lab,uri:ur});
  };
  for(const term of terms){
    try{
      const r=await supabaseClient.rpc('search_madkhal_occupations',{search_text:term,result_limit:5});
      (r.data||[]).forEach(o=>add(o,term));
    }catch(e){}
    if(opts.length>=35)break;
  }
  if(opts.length<20){
    try{
      const r=await supabaseClient.rpc('search_madkhal_occupations',{search_text:'',result_limit:30});
      (r.data||[]).forEach(o=>add(o,''));
    }catch(e){}
  }
  select._occupationOptions=opts;
  select.innerHTML='<option value="">اختر المهنة المطلوبة</option>'+opts.map((o,i)=>'<option value="'+i+'">'+String(o.label).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</option>').join('');
  if(!opts.length)select.innerHTML='<option value="">تعذر تحميل المهن الآن</option>';
 }catch(e){select.innerHTML='<option value="">تعذر تحميل قائمة المهن</option>'}
 select.onchange=()=>{
  const o=select._occupationOptions?.[Number(select.value)];
  if(!o){uri.value='';label.value='';input.value='';return}
  uri.value=o.uri;label.value=o.label;input.value=o.label;
  const st=byId('employerOccupationStatus');
  if(st){st.textContent='✓ تم اختيار المهنة المعتمدة: '+o.label;st.className='occupation-status'}
  const title=byId('vacancyTitle');if(title&&!title.value.trim())title.value=o.label;
 };
}
function injectEmployerFields(){const form=byId('submitVacancyButton')?.closest('.card');if(!form||byId('employerContactPhone'))return;const desc=byId('vacancyDescription');if(!desc)return;const g=document.createElement('div');g.className='form-group';g.innerHTML='<label>رقم التواصل</label><input id="employerContactPhone" type="tel" inputmode="tel" placeholder="رقم الهاتف للتواصل معك بشأن المرشحين"><div class="occupation-status">لن يظهر للباحثين في مرحلة المطابقة؛ يستخدمه مَدخَل لإدارة تواصل صاحب الفرصة.</div>';desc.parentElement.insertAdjacentElement('afterend',g);const note=byId('employerStatus');if(note)note.textContent='ستُحفظ الفرصة كفرصة خاصة، ثم يبدأ مَدخَل المطابقة مع الباحثين المؤهلين.';const b=byId('submitVacancyButton');if(b)b.textContent='📩 نشر الفرصة وبدء المطابقة'}
async function fixedEmployerProfileId(user,fullName){if(!user)return null;try{const q=await supabaseClient.from('profiles').select('id,full_name,role').eq('auth_user_id',user.id).maybeSingle();if(q.error)throw q.error;if(q.data){const patch={};if(fullName&&q.data.full_name!==fullName)patch.full_name=fullName;if(q.data.role!=='employer')patch.role='employer';if(Object.keys(patch).length){const u=await supabaseClient.from('profiles').update(patch).eq('id',q.data.id).eq('auth_user_id',user.id);if(u.error)throw u.error}return q.data.id}const id=(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)}));const ins=await supabaseClient.from('profiles').insert({id,full_name:fullName||'مستخدم مَدخَل',role:'employer',auth_user_id:user.id}).select('id').maybeSingle();if(ins.error)throw ins.error;return ins.data?.id||id}catch(e){console.error('Madkhal employer profile error',e);throw e}}
async function submitEmployerVacancyEnhanced(){const company=byId('employerName')?.value.trim()||'';const occUri=byId('employerOccupationUri')?.value.trim()||'';const occLabel=byId('employerOccupationLabel')?.value.trim()||'';const title=byId('vacancyTitle')?.value.trim()||'';const country=byId('vacancyCountry')?.value.trim()||'';const location=byId('vacancyLocation')?.value.trim()||'';const work=byId('vacancyWorkType')?.value||'';const skills=byId('vacancySkills')?.value.trim()||'';const qualification=byId('vacancyQualification')?.value.trim()||'';const number=Number(byId('vacancyNumber')?.value||1);const salaryText=byId('vacancySalary')?.value.trim()||'';const description=byId('vacancyDescription')?.value.trim()||'';const phone=byId('employerContactPhone')?.value.trim()||'';if(!company||!occUri||!title||!country||!location||!work||!skills||!description||!phone){showToast('⚠️ أكمل بيانات الفرصة ورقم التواصل واختر المهنة.');return}if(number<1){showToast('⚠️ العدد يجب أن يكون واحدًا على الأقل.');return}const btn=byId('submitVacancyButton');if(btn){btn.disabled=true;btn.textContent='⏳ جارٍ نشر الفرصة وبدء المطابقة...'}try{const user=await sessionUser();if(!user)throw new Error('NO_USER');const pid=await fixedEmployerProfileId(user,company);if(!pid)throw new Error('NO_PROFILE');await supabaseClient.from('profiles').update({phone,full_name:company,role:'employer'}).eq('id',pid).eq('auth_user_id',user.id);const sal=parseSalary(salaryText);const ins=await supabaseClient.from('employer_vacancies').insert({employer_id:pid,title,company_name:company,description,location,country,job_type:work,category:occLabel,required_skills:skills,required_qualification:qualification||null,salary_min:sal.min,salary_max:sal.max,salary_currency:sal.currency,number_needed:number,status:'open',visibility:'private_match_only',expires_at:null,occupation_uri:occUri,occupation_label:occLabel,confirmation_at:new Date().toISOString(),confirmation_version:'employer-flow-v2',updated_at:new Date().toISOString()}).select('id,confirmation_at,confirmation_version').maybeSingle();if(ins.error)throw ins.error;const vacancyId=ins.data?.id;if(!vacancyId)throw new Error('NO_VACANCY_ID');const confirmationAt=ins.data?.confirmation_at||new Date().toISOString();if(!ins.data?.confirmation_at){const cu=await supabaseClient.from('employer_vacancies').update({confirmation_at:confirmationAt,confirmation_version:'employer-flow-v2',updated_at:new Date().toISOString()}).eq('id',vacancyId).eq('employer_id',pid).select('id,confirmation_at,confirmation_version').maybeSingle();if(cu.error)throw cu.error;if(!cu.data?.confirmation_at)throw new Error('CONFIRMATION_SAVE_FAILED')}await supabaseClient.from('employer_vacancies').update({status:'matching',updated_at:new Date().toISOString()}).eq('id',vacancyId).eq('employer_id',pid);let matched=0;try{const mr=await supabaseClient.rpc('process_my_employer_matches',{p_vacancy_id:vacancyId,p_limit:200});if(!mr.error)matched=Number(mr.data)||0}catch(e){}const countQ=await supabaseClient.from('match_requests').select('id,match_score,status',{count:'exact',head:true}).eq('vacancy_id',vacancyId);const count=Number(countQ.count||0);const finalCount=Math.max(count,matched);const status=byId('employerStatus');if(status){status.className='notice success';status.innerHTML='✅ تم نشر الفرصة بنجاح.<br>🎯 بدأ مَدخَل المطابقة الآلية مع الباحثين المؤهلين.<br>📊 عدد المطابقات المسجلة حتى الآن: <strong>'+finalCount+'</strong><br><small>الفرصة خاصة ولا تظهر كإعلان عام؛ تُستخدم لإيجاد المرشحين الأقرب.</small>'}localStorage.setItem('madkhal_last_employer_vacancy',vacancyId);showToast('🎉 تم نشر الفرصة وبدء المطابقة.')}catch(e){const status=byId('employerStatus');if(status){status.className='notice';status.textContent='⚠️ تعذر حفظ الفرصة الآن. تحقق من الاتصال ثم أعد المحاولة'}console.error('Madkhal vacancy publish error',e);showToast('❌ لم تُحفظ الفرصة. '+(e?.message||''))}finally{if(btn){btn.disabled=false;btn.textContent='📩 نشر الفرصة وبدء المطابقة'}}}
window.submitEmployerVacancy=submitEmployerVacancyEnhanced;
document.addEventListener('DOMContentLoaded',()=>{injectEmployerFields();initEmployerOccupationChoice();});
})();
async function loadEmployerMatchCenter(){
 const box=byId('employerMatchCenter'); if(!box)return;
 const user=await sessionUser(); if(!user){box.innerHTML='<div class="notice">🔐 سجّل الدخول لمراجعة المطابقات.</div>';return}
 box.innerHTML='<div class="notice">⏳ جارٍ تحميل المطابقات...</div>';
 try{
  const v=await supabaseClient.from('employer_vacancies').select('id,title,company_name,status,created_at').in('status',['open','matching']).order('created_at',{ascending:false}).limit(20);
  if(v.error)throw v.error;
  const vacancies=v.data||[];
  if(!vacancies.length){box.innerHTML='<div class="notice">لا توجد فرص منشورة للمطابقة حاليًا.</div>';return}
  const ids=vacancies.map(x=>x.id);
  const m=await supabaseClient.from('match_requests').select('id,vacancy_id,match_score,status,employer_note,created_at,updated_at').in('vacancy_id',ids).order('updated_at',{ascending:false}).limit(100);
  if(m.error)throw m.error;
  const rows=m.data||[];
  const byVac=new Map(vacancies.map(x=>[x.id,x]));
  box.innerHTML='<div class="match-center-head"><div><h3>🎯 المطابقات ومسار التوظيف</h3><p>هذه النتائج تخص فرصك فقط. لا تظهر بيانات الباحث الشخصية قبل اكتمال الموافقة وفتح التواصل.</p></div></div><div id="employerMatchList"></div>';
  const list=byId('employerMatchList');
  if(!rows.length){list.innerHTML='<div class="notice">لم تُسجّل مطابقات مؤهلة بعد. سيستمر مَدخَل في فحص الباحثين المؤكدين.</div>';return}
  rows.forEach((r,i)=>{
   const v=byVac.get(r.vacancy_id)||{};
   const card=document.createElement('div');card.className='worker-match-card';
   card.innerHTML='<div class="candidate-top"><strong>'+esc(v.title||'فرصة')+'</strong><span class="match-score">'+Math.round(Number(r.match_score)||0)+'% مطابقة</span></div>'+
    '<div class="candidate-meta">👤 مرشح مؤهل · حالة المسار: <strong>'+esc(r.status)+'</strong></div>'+
    '<div class="candidate-meta">آخر تحديث: '+new Date(r.updated_at||r.created_at||Date.now()).toLocaleString('ar')+'</div><div class="worker-match-actions"></div>';
   const actions=card.querySelector('.worker-match-actions');
   const advance=async(next,label)=>{
    const b=document.createElement('button');b.className='primary-btn';b.textContent=label;
    b.onclick=async()=>{b.disabled=true;const x=await supabaseClient.rpc('advance_match_request',{p_request_id:r.id,p_next_status:next,p_note:null});if(x.error){b.disabled=false;showToast('⚠️ تعذر تحديث مسار المطابقة.');return}showToast('✅ تم تحديث مسار المطابقة.');loadEmployerMatchCenter()};
    actions.appendChild(b);
   };
   if(r.status==='matched')advance('employer_interested','📩 إبداء الاهتمام بالمرشح');
   else if(r.status==='accepted')advance('contact_opened','📞 فتح مرحلة التواصل');
   else if(r.status==='employer_interested'){const n=document.createElement('div');n.className='notice';n.textContent='⏳ تم إرسال الاهتمام. بانتظار رد الباحث.';actions.appendChild(n)}
   else if(r.status==='declined'){const n=document.createElement('div');n.className='notice';n.textContent='↩️ الباحث رفض المتابعة.';actions.appendChild(n)}
   else if(r.status==='contact_opened'){const n=document.createElement('div');n.className='notice success';n.textContent='📞 تم فتح مرحلة التواصل. تفاصيل الاتصال المباشر ستُربط في المرحلة التالية دون كشفها قبل هذه الحالة.';actions.appendChild(n)}
   else if(['interview','offer','hired','closed'].includes(r.status)){
    const labels={interview:'🗣️ مقابلة',offer:'📄 عرض',hired:'🎉 تم التوظيف',closed:'🔒 مغلقة'};
    const n=document.createElement('div');n.className='notice';n.textContent='الحالة الحالية: '+labels[r.status];actions.appendChild(n);
   }
   list.appendChild(card);
  });
 }catch(e){console.error('Madkhal employer match center',e);box.innerHTML='<div class="notice">⚠️ تعذر تحميل المطابقات الآن.</div>'}
}
function injectEmployerMatchCenter(){
 const screen=byId('employerScreen'); if(!screen||byId('employerMatchCenter'))return;
 const panel=document.createElement('div');panel.id='employerMatchCenter';panel.className='card';panel.style.marginTop='14px';
 panel.innerHTML='<h3>🎯 مركز المطابقات</h3><p>بعد نشر الفرصة، ستظهر هنا المطابقات المسجلة ومسار التفاعل مع الباحث.</p><button id="openEmployerMatches" class="secondary-btn" style="width:100%">عرض المطابقات</button><div id="employerMatchCenterBody" style="margin-top:10px"></div>';
 screen.appendChild(panel);
 const body=panel.querySelector('#employerMatchCenterBody'); body.id='employerMatchCenter';
 panel.querySelector('#openEmployerMatches').onclick=loadEmployerMatchCenter;
}
document.addEventListener('DOMContentLoaded',injectEmployerMatchCenter);
