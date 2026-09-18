/* MADKHAL_UI_BRIDGE_V2 — one integrated UI authority */
(() => {
  'use strict';
  if (window.__MADKHAL_UI_BRIDGE_V2__) return;
  window.__MADKHAL_UI_BRIDGE_V2__ = true;

  const SUPABASE_URL = 'https://qbufsdpdobuicpljnssr.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mcPmNU2CGJkiSbfgOD6gOg_9RNMNlEY';
  const L = {
    name:'madkhal_profile_name', first:'madkhal_profile_first_name', father:'madkhal_profile_father_name',
    family:'madkhal_profile_family_name', mother:'madkhal_profile_mother_name', birth:'madkhal_profile_birth_date', qualification:'madkhal_profile_qualification',
    skill:'madkhal_profile_skill', field:'madkhal_profile_work_field', years:'madkhal_profile_experience_years',
    summary:'madkhal_profile_summary', location:'madkhal_profile_location', workType:'madkhal_profile_work_type',
    subscription:'madkhal_subscription', applications:'madkhal_applications', notifications:'madkhal_notifications', assessment:'madkhal_writing_assessment'
  };

  function client(){
    if(window.supabaseClient) return window.supabaseClient;
    if(window.supabase && typeof window.supabase.createClient==='function'){
      try{ window.supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY); return window.supabaseClient; }catch(e){ console.warn('Madkhal Supabase init:',e); }
    }
    return null;
  }
  function esc(v){ return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function read(k){ try{return localStorage.getItem(k)||'';}catch(e){return '';} }
  function write(k,v){ try{localStorage.setItem(k,String(v??''));}catch(e){} }
  function arr(k){ try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[];}catch(e){return [];} }
  function setArr(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function now(){return new Date().toISOString();}
  function toast(m){ if(typeof window.showToast==='function') window.showToast(m); else console.info(m); }

  function stickyOffset(){
    let o=10; const h=document.querySelector('.header'); if(h)o+=h.getBoundingClientRect().height;
    const b=document.getElementById('madkhalInstallBar'); if(b&&!b.classList.contains('hidden'))o+=b.getBoundingClientRect().height+8;
    return o;
  }
  function place(target,focusId){
    if(!target)return;
    requestAnimationFrame(()=>{
      const el=focusId?(document.getElementById(focusId)||target):target;
      const top=window.pageYOffset+el.getBoundingClientRect().top-stickyOffset();
      window.scrollTo({top:Math.max(0,top),behavior:'auto'});
      requestAnimationFrame(()=>{
        const top2=window.pageYOffset+el.getBoundingClientRect().top-stickyOffset();
        window.scrollTo({top:Math.max(0,top2),behavior:'auto'});
        if(focusId){const f=document.getElementById(focusId);if(f&&f.focus)f.focus({preventScroll:true});}
      });
    });
  }

  /* One authoritative navigation function. */
  window.showScreen=function(id,anchorId=null){
    const target=document.getElementById(id);
    if(!target){console.warn('Madkhal screen not found:',id);return;}
    document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.display='';});
    target.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    const n=document.querySelector(`.nav-item[data-screen="${id}"]`); if(n)n.classList.add('active');
    if(id==='accountScreen') renderUnifiedAccount();
    place(target,anchorId);
  };
  window.navigate=function(id){
    if(id==='opportunitiesScreen') window.openOpportunities();
    else window.showScreen(id);
  };

  function setHomeButtons(){
    const actions=document.querySelector('.hero-actions');
    const buttons=actions?actions.querySelectorAll('button'):[];
    if(buttons[0]){buttons[0].textContent='🔎 أبحث عن فرصة';buttons[0].className='primary-btn madkhal-home-btn';buttons[0].type='button';buttons[0].onclick=()=>window.openWorker();}
    if(buttons[1]){buttons[1].textContent='🏢 لدي فرصة عمل';buttons[1].className='secondary-btn madkhal-home-btn';buttons[1].type='button';buttons[1].onclick=()=>window.openEmployer();}
  }

  async function user(){
    const c=client(); if(!c)return null;
    try{const r=await c.auth.getSession();if(r.data?.session?.user)return r.data.session.user;}catch(e){console.warn('Madkhal session:',e);}
    try{const r=await c.auth.signInAnonymously();if(r.error)throw r.error;return r.data?.user||null;}catch(e){console.warn('Madkhal anonymous auth:',e);return null;}
  }

  function profileFromForm(){
    const first=document.getElementById('workerFirstName')?.value.trim()||'';
    const father=document.getElementById('workerFatherName')?.value.trim()||'';
    const family=document.getElementById('workerFamilyName')?.value.trim()||'';
    const mother=document.getElementById('workerMotherName')?.value.trim()||'';
    const birth=document.getElementById('workerBirthDate')?.value||'';
    const qualification=document.getElementById('workerQualification')?.value.trim()||'';
    const skill=document.getElementById('workerSkill')?.value.trim()||'';
    const field=document.getElementById('workerWorkField')?.value.trim()||'';
    const years=document.getElementById('workerExperienceYears')?.value.trim()||'';
    const summary=document.getElementById('workerSummary')?.value.trim()||'';
    const location=read(L.location);
    const workType=read(L.workType);
    return {first,father,family,mother,birth,qualification,skill,field,years,summary,location,workType,fullName:[first,father,family].filter(Boolean).join(' ').trim()};
  }
  function storeProfile(p){
    write(L.first,p.first);write(L.father,p.father);write(L.family,p.family);write(L.mother,p.mother);write(L.birth,p.birth);write(L.name,p.fullName);
    write(L.qualification,p.qualification);write(L.skill,p.skill);write(L.field,p.field);write(L.years,p.years);write(L.summary,p.summary);
    if(p.location)write(L.location,p.location); if(p.workType)write(L.workType,p.workType);
  }
  async function saveProfileRemote(p){
    const c=client();if(!c)throw new Error('SUPABASE_NOT_CONNECTED');
    const u=await user();if(!u)throw new Error('AUTH_REQUIRED');
    let pr=await c.from('profiles').select('id').eq('auth_user_id',u.id).limit(1).maybeSingle();
    if(pr.error)throw pr.error;
    if(pr.data){
      const r=await c.from('profiles').update({full_name:p.fullName,role:'seeker',main_skill:p.skill||null,bio:p.summary||null}).eq('id',pr.data.id).eq('auth_user_id',u.id);
      if(r.error)throw r.error;
    }else{
      const r=await c.from('profiles').insert({auth_user_id:u.id,full_name:p.fullName,role:'seeker',main_skill:p.skill||null,bio:p.summary||null}).select('id').maybeSingle();
      if(r.error)throw r.error;
    }
    const wp=await c.from('worker_profiles').select('id').eq('user_id',u.id).limit(1).maybeSingle();
    if(wp.error)throw wp.error;
    const payload={user_id:u.id,full_name:p.fullName,first_name:p.first||null,father_name:p.father||null,family_name:p.family||null,mother_name:p.mother||null,birth_date:p.birth||null,qualification:p.qualification||null,profession:p.field||p.skill||null,skills:p.skill||null,work_field:p.field||null,experience_years:p.years===''?null:Number(p.years),professional_summary:p.summary||null,location:p.location||null,work_type:p.workType||null,updated_at:now()};
    const r=wp.data?.id?await c.from('worker_profiles').update(payload).eq('id',wp.data.id).eq('user_id',u.id).select('id').maybeSingle():await c.from('worker_profiles').insert(payload).select('id').maybeSingle();
    if(r.error)throw r.error;if(!r.data?.id)throw new Error('PROFILE_NOT_SAVED');
    write('madkhal_profile_user_id',u.id);write('madkhal_worker_profile_id',r.data.id);return r.data.id;
  }

  async function hydrateProfile(){
    const map={workerFirstName:read(L.first),workerFatherName:read(L.father),workerFamilyName:read(L.family),workerMotherName:read(L.mother),workerBirthDate:read(L.birth),workerQualification:read(L.qualification),workerSkill:read(L.skill),workerWorkField:read(L.field),workerExperienceYears:read(L.years),workerSummary:read(L.summary)};
    Object.entries(map).forEach(([id,v])=>{const el=document.getElementById(id);if(el&&v)el.value=v;});
    const c=client();if(!c)return;const u=await user();if(!u)return;
    const r=await c.from('worker_profiles').select('first_name,father_name,family_name,mother_name,birth_date,full_name,qualification,profession,skills,work_field,experience_years,professional_summary,location,work_type').eq('user_id',u.id).maybeSingle();
    if(r.error||!r.data)return;const d=r.data;
    write(L.first,d.first_name||'');write(L.father,d.father_name||'');write(L.family,d.family_name||'');write(L.mother,d.mother_name||'');write(L.birth,d.birth_date||'');write(L.name,d.full_name||'');write(L.qualification,d.qualification||'');write(L.skill,d.skills||d.profession||'');write(L.field,d.work_field||d.profession||'');write(L.years,d.experience_years??'');write(L.summary,d.professional_summary||'');write(L.location,d.location||'');write(L.workType,d.work_type||'');
    Object.entries({workerFirstName:d.first_name||'',workerFatherName:d.father_name||'',workerFamilyName:d.family_name||'',workerMotherName:d.mother_name||'',workerBirthDate:d.birth_date||'',workerQualification:d.qualification||'',workerSkill:d.skills||d.profession||'',workerWorkField:d.work_field||d.profession||'',workerExperienceYears:d.experience_years??'',workerSummary:d.professional_summary||''}).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
  }

  function buildWorkerForm(){
    const screen=document.getElementById('profileScreen');if(!screen)return;
    screen.innerHTML=`
      <button class="back" type="button" id="madkhalWorkerBack">↩️ العودة إلى الرئيسية</button>
      <div class="card worker-profile-intro"><h2 style="margin:0 0 8px">👤 ملف الباحث عن فرصة</h2><p style="margin:0;line-height:1.8">املأ بياناتك بالترتيب. هذه البيانات هي أساس المطابقة مع الفرص.</p></div>
      <div class="form-group"><label for="workerFirstName">الاسم</label><input id="workerFirstName" type="text" autocomplete="given-name" placeholder="الاسم الأول"></div>
      <div class="form-group"><label for="workerFatherName">الأب</label><input id="workerFatherName" type="text" placeholder="اسم الأب"></div>
      <div class="form-group"><label for="workerFamilyName">الكنية</label><input id="workerFamilyName" type="text" autocomplete="family-name" placeholder="اسم العائلة"></div><div class="form-group"><label for="workerMotherName">اسم الأم</label><input id="workerMotherName" type="text" placeholder="اسم الأم"></div>
      <div class="form-group"><label for="workerBirthDate">التولد / تاريخ الميلاد</label><input id="workerBirthDate" type="date"></div>
      <div class="form-group"><label for="workerQualification">الشهادة</label><input id="workerQualification" type="text" placeholder="مثال: بكالوريوس أو ثانوية"></div>
      <div class="form-group"><label for="workerSkill">المهارة التي أتقنها</label><input id="workerSkill" type="text" placeholder="مثال: محاسبة، كهرباء، برمجة"></div>
      <div class="form-group"><label for="workerWorkField">المجال الذي عملت فيه إن وجد</label><input id="workerWorkField" type="text" placeholder="مثال: المبيعات أو المقاولات"></div>
      <div class="form-group"><label for="workerExperienceYears">سنوات الخبرة</label><input id="workerExperienceYears" type="number" min="0" max="70" step="0.5" inputmode="decimal" placeholder="مثال: 5"></div>
      <div class="form-group"><label for="workerSummary">نبذة مهنية مختصرة</label><textarea id="workerSummary" maxlength="1200" placeholder="خبرتك وقدراتك وما تتميز به باختصار"></textarea></div>
      <button id="saveWorkerButton" class="primary-btn madkhal-clear-btn" type="button">💾 حفظ الملف</button>
      <div class="info-strip" style="margin-top:12px">🔐 سيتم حفظ ملفك في مَدخَل. البحث الأساسي والتقديم على الفرص مجانيان.</div>`;
    document.getElementById('madkhalWorkerBack')?.addEventListener('click',()=>window.showScreen('homeScreen'));
    document.getElementById('saveWorkerButton')?.addEventListener('click',()=>window.saveWorker());
    hydrateProfile().catch(e=>console.warn('Madkhal profile hydrate:',e));
  }

  async function unifiedSaveWorker(){
    const p=profileFromForm();
    if(!p.first||!p.father||!p.family||!p.birth||!p.qualification||!p.skill){toast('⚠️ أكمل الاسم والأب والكنية والتولد والشهادة والمهارة.');return;}
    if(p.years!==''&&(!Number.isFinite(Number(p.years))||Number(p.years)<0||Number(p.years)>70)){toast('⚠️ أدخل سنوات خبرة صحيحة بين 0 و70.');return;}
    const b=document.getElementById('saveWorkerButton');if(b){b.disabled=true;b.textContent='⏳ جارٍ الحفظ...';}
    try{storeProfile(p);await saveProfileRemote(p);if(typeof window.updateAccountPreview==='function')window.updateAccountPreview(p.fullName,p.skill,p.location);toast('✅ تم حفظ ملفك المهني بنجاح.');showWorkerCompletion();}
    catch(e){console.warn('Madkhal worker save:',e);toast(e?.message==='SUPABASE_NOT_CONNECTED'?'❌ قاعدة البيانات غير متاحة الآن.':'❌ تعذر حفظ الملف في قاعدة البيانات. لم ننتقل للخطوة التالية.');}
    finally{if(b){b.disabled=false;b.textContent='💾 حفظ الملف';}}
  }

  function ensureCompletion(){
    let s=document.getElementById('madkhalWorkerCompletionScreen');if(s)return s;const main=document.querySelector('main');if(!main)return null;
    s=document.createElement('section');s.id='madkhalWorkerCompletionScreen';s.className='screen';
    s.innerHTML=`<div class="card" style="text-align:center;padding:28px 20px"><div style="font-size:48px;margin-bottom:10px">✅</div><h2 style="margin:0 0 12px;color:#0f766e">تم حفظ ملفك المهني بنجاح</h2><p style="margin:0 0 10px;line-height:1.9;color:#596666">ملفك الآن جاهز في مَدخَل لاستخدامه في البحث والمطابقة مع الفرص المناسبة.</p><p style="margin:0 0 18px;line-height:1.9;color:#596666"><strong>البحث في مَدخَل مجاني</strong> ويشمل التصفح والتقديم والمزايا الأساسية. الاشتراك اختياري، ويضيف المطابقة المستمرة مع الفرص الجديدة والتقييمات والتنبيهات وترتيب الفرص ومتابعة الطلبات.</p><div class="card" style="margin:0 0 14px;background:#f7fbfa;border-color:#d8ece8"><strong style="display:block;margin-bottom:5px">🔔 مَدخَل يبحث معك</strong><span style="font-size:13px;line-height:1.8;color:#596666">بدل أن تبحث كل يوم، يتابع مَدخَل الفرص الجديدة التي تناسب ملفك.</span><div style="margin-top:8px;font-size:21px;font-weight:900;color:#0f766e">$1 شهريًا</div></div><div style="display:grid;gap:10px"><button id="madkhalCompletionSearch" class="primary-btn madkhal-clear-btn" type="button">🔎 ابدأ البحث عن فرص</button><button id="madkhalCompletionSubscribe" class="secondary-btn madkhal-clear-btn" type="button">🔔 تفعيل المتابعة — $1 شهريًا</button></div></div>`;
    main.appendChild(s);
    s.querySelector('#madkhalCompletionSearch')?.addEventListener('click',()=>window.openOpportunities());
    s.querySelector('#madkhalCompletionSubscribe')?.addEventListener('click',()=>window.openSubscription());
    return s;
  }
  function showWorkerCompletion(){const s=ensureCompletion();if(s)window.showScreen('madkhalWorkerCompletionScreen');}
  window.openWorker=function(){window.openProfile();};
  window.openProfile=function(){buildWorkerForm();window.showScreen('profileScreen','workerFirstName');};
  window.saveWorker=unifiedSaveWorker;

  function parseSalary(v){
    const m=String(v||'').replace(/,/g,'').match(/(\\d+(?:\\.\\d+)?)/g);return m&&m.length?Number(m[0]):null;
  }
  function employerForm(){return {
    name:document.getElementById('employerName')?.value.trim()||'',
    title:document.getElementById('vacancyTitle')?.value.trim()||'',
    location:document.getElementById('vacancyLocation')?.value.trim()||'',
    type:document.getElementById('vacancyWorkType')?.value||'',
    skills:document.getElementById('vacancySkills')?.value.trim()||'',
    qualification:document.getElementById('vacancyQualification')?.value.trim()||'',
    number:Math.max(1,parseInt(document.getElementById('vacancyNumber')?.value||'1',10)||1),
    salary:document.getElementById('vacancySalary')?.value.trim()||'',
    description:document.getElementById('vacancyDescription')?.value.trim()||''
  };}
  async function unifiedSubmitEmployerVacancy(){
    const p=employerForm();
    if(!p.name||!p.title||!p.location){toast('⚠️ أكمل اسم الشركة والمسمى الوظيفي ومكان العمل.');return;}
    const b=document.querySelector('#employerScreen button[onclick="submitEmployerVacancy()"]');
    if(b){b.disabled=true;b.textContent='⏳ جارٍ حفظ فرصة العمل...';}
    try{
      const c=client();if(!c)throw new Error('SUPABASE_NOT_CONNECTED');
      const u=await user();if(!u)throw new Error('AUTH_REQUIRED');
      const salary=parseSalary(p.salary);
      const r=await c.rpc('create_employer_vacancy',{p_employer_name:p.name,p_title:p.title,p_location:p.location,p_country:'',p_job_type:p.type,p_required_skills:p.skills,p_required_qualification:p.qualification,p_number_needed:p.number,p_salary_min:salary,p_salary_max:salary,p_salary_currency:salary?'USD':'',p_description:p.description});
      if(r.error)throw r.error;
      const vacancyId=Array.isArray(r.data)?r.data[0]:r.data;
      if(!vacancyId)throw new Error('VACANCY_NOT_SAVED');
      toast('✅ تم حفظ فرصة العمل بنجاح وبدأت مَدخَل تجهيز المطابقة.');
      const box=document.createElement('div');box.className='card';box.style.cssText='margin-top:14px;text-align:center';box.innerHTML='<h3 style="color:#0f766e">✅ تم حفظ فرصة العمل</h3><p style="line-height:1.9">ستستخدم مَدخَل الفرصة لمطابقة الباحثين المناسبين.</p><button class="primary-btn" style="width:100%;margin-top:10px" type="button">🏠 العودة إلى الرئيسية</button>';document.getElementById('employerScreen')?.appendChild(box);box.querySelector('button')?.addEventListener('click',()=>window.showScreen('homeScreen'));
    }catch(e){
      console.warn('Madkhal employer save:',e);
      const msg=String(e?.message||e?.error_description||'').toLowerCase();
      if(msg.includes('authentication_required'))toast('❌ لم يتم تسجيل الدخول. أعد المحاولة.');
      else if(msg.includes('required_fields_missing'))toast('❌ أكمل الحقول الأساسية المطلوبة.');
      else if(msg.includes('row-level security')||msg.includes('permission denied'))toast('❌ لا توجد صلاحية لحفظ الفرصة حاليًا.');
      else if(msg.includes('supabase_not_connected'))toast('❌ قاعدة البيانات غير متاحة الآن.');
      else toast('❌ تعذر حفظ فرصة العمل: '+String(e?.message||'خطأ غير معروف').slice(0,120));
    }finally{if(b){b.disabled=false;b.textContent='📩 إرسال فرصة العمل إلى مَدخَل';}}
  }
  window.openEmployer=function(){window.showScreen('employerScreen','employerName');};
  window.submitEmployerVacancy=unifiedSubmitEmployerVacancy;

  let unifiedCategory='الكل';let currentDetailId=null;
  function allJobs(){
    let list=[];try{if(typeof window.getAllVisibleOpportunities==='function')list=window.getAllVisibleOpportunities();}catch(e){console.warn('Madkhal opportunity source:',e);}
    return (Array.isArray(list)?list:[]).filter(j=>j&&!String(j.id||'').startsWith('demo-'));
  }
  function score(job){
    const profile=[read(L.skill),read(L.field),read(L.qualification),read(L.summary)].join(' ').toLowerCase();if(!profile)return 0;
    const text=[job.title,job.company,job.description,job.category].join(' ').toLowerCase();const terms=profile.split(/[,\s،]+/).filter(x=>x.length>=2);let s=25,h=0;
    terms.forEach(t=>{if(text.includes(t)){s+=6;h++;}});const loc=read(L.location).toLowerCase();if(loc&&String(job.location||'').toLowerCase().includes(loc))s+=10;
    const wt=read(L.workType);if(wt&&String(job.job_type||job.type||'').toLowerCase().includes(wt.replace('_',' ')))s+=8;if(h>=3)s+=10;return Math.min(99,s);
  }
  function sourceLabel(job){return job.employerVacancy?'🏢 صاحب فرصة داخل مَدخَل':`🌐 ${job.source_name||job.source||'المصدر الأصلي'}`;}

  window.renderCategories=function(){
    const box=document.getElementById('categoryScroll');if(!box)return;box.innerHTML='';
    const cats=['الكل','💻 البرمجة','✍️ الكتابة','🌐 الترجمة','🎨 التصميم','🎬 الفيديو','📱 التواصل الاجتماعي','📢 التسويق','📊 البيانات','📚 التعليم','📝 التدقيق','🧮 المحاسبة','🤖 الذكاء الاصطناعي','💼 المساعدة الافتراضية','🔧 أخرى'];
    cats.forEach(cat=>{const b=document.createElement('button');b.type='button';b.className='category'+(unifiedCategory===cat?' active':'');b.textContent=cat;b.onclick=()=>{unifiedCategory=cat;window.renderCategories();window.renderOpportunities();};box.appendChild(b);});
  };
  window.renderOpportunities=function(){
    const box=document.getElementById('opportunitiesList');if(!box)return;box.innerHTML='';const q=(document.getElementById('jobSearch')?.value||'').trim().toLowerCase();const loc=(document.getElementById('jobLocation')?.value||'').trim().toLowerCase();let list=allJobs();
    if(unifiedCategory!=='الكل')list=list.filter(j=>String(j.category||'')===unifiedCategory);if(q)list=list.filter(j=>[j.title,j.company,j.description,j.category].join(' ').toLowerCase().includes(q));if(loc)list=list.filter(j=>String(j.location||'').toLowerCase().includes(loc));
    list=list.map(j=>({j,s:score(j)})).sort((a,b)=>b.s-a.s).slice(0,60).map(x=>x.j);
    if(!list.length){box.innerHTML='<div class="card"><div class="empty-state">🔎 لا توجد فرص مطابقة للبحث الحالي.<br>جرّب مهنة أو مكانًا آخر.</div></div>';return;}
    list.forEach(job=>{const card=document.createElement('div');card.className='opportunity';const s=score(job);card.innerHTML=`<div class="opportunity-top"><div><h3>${esc(job.icon||'💼')} ${esc(job.title)}</h3><div style="font-weight:800">${esc(job.company||'حسب المصدر')}</div><div style="margin-top:6px;color:#657070;font-size:12px;line-height:1.7">${esc(String(job.description||'').slice(0,170))}${String(job.description||'').length>170?'…':''}</div><span class="tag">📍 ${esc(job.location||'غير محدد')}</span><span class="tag">💼 ${esc(job.type||job.job_type||'غير محدد')}</span><span class="tag">${esc(job.category||'🔧 أخرى')}</span><div class="match">🎯 مطابقة: ${s}%</div><div class="source-note">${esc(sourceLabel(job))}</div></div><div class="salary">${esc(job.salary||'حسب المصدر')}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px"><button class="primary-btn madkhal-small-btn" type="button" data-detail="1">👁️ التفاصيل</button><button class="secondary-btn madkhal-small-btn" type="button" data-apply="1">📩 التقديم</button></div>`;
      card.querySelector('[data-detail]')?.addEventListener('click',()=>openOpportunityDetails(job.id));card.querySelector('[data-apply]')?.addEventListener('click',()=>applyOpportunityUnified(job.id));box.appendChild(card);});
  };
  window.openOpportunities=async function(){window.showScreen('opportunitiesScreen','jobSearch');unifiedCategory='الكل';window.renderCategories();window.renderOpportunities();try{if(typeof window.loadMadkhalRealJobs==='function')await window.loadMadkhalRealJobs();}catch(e){console.warn('Madkhal jobs:',e);}window.renderCategories();window.renderOpportunities();};

  function ensureDetailScreen(){
    let s=document.getElementById('madkhalOpportunityDetailScreen');if(s)return s;const main=document.querySelector('main');if(!main)return null;s=document.createElement('section');s.id='madkhalOpportunityDetailScreen';s.className='screen';s.innerHTML='<button class="back" type="button" id="madkhalDetailBack">↩️ العودة إلى الفرص</button><div id="madkhalDetailBody"></div>';main.appendChild(s);s.querySelector('#madkhalDetailBack')?.addEventListener('click',()=>window.openOpportunities());return s;
  }
  function openOpportunityDetails(id){
    const job=allJobs().find(j=>String(j.id)===String(id));if(!job){toast('❌ لم يتم العثور على الفرصة.');return;}currentDetailId=job.id;const s=ensureDetailScreen();const body=document.getElementById('madkhalDetailBody');if(!s||!body)return;const sc=score(job);
    body.innerHTML=`<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h2 style="margin:0 0 7px">${esc(job.icon||'💼')} ${esc(job.title)}</h2><div style="font-weight:800">${esc(job.company||'حسب المصدر')}</div></div><div class="salary">${esc(job.salary||'حسب المصدر')}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px"><span class="tag">📍 ${esc(job.location||'غير محدد')}</span><span class="tag">💼 ${esc(job.type||job.job_type||'غير محدد')}</span><span class="tag">${esc(job.category||'🔧 أخرى')}</span></div><div class="match" style="margin-top:12px">🎯 مطابقة ملفك: ${sc}%</div><div class="source-note" style="margin-top:10px">${esc(sourceLabel(job))}</div></div><div class="card"><h3>📋 تفاصيل الفرصة</h3><div style="margin-top:8px;white-space:pre-line;line-height:1.95;color:#4f5d5d;font-size:14px">${esc(job.description||'لا يوجد وصف إضافي من المصدر.')}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button class="primary-btn madkhal-clear-btn" type="button" id="madkhalDetailApply">📩 التقديم على الفرصة</button><button class="secondary-btn madkhal-clear-btn" type="button" id="madkhalDetailBack2">↩️ العودة إلى الفرص</button></div>`;
    body.querySelector('#madkhalDetailApply')?.addEventListener('click',()=>applyOpportunityUnified(job.id));body.querySelector('#madkhalDetailBack2')?.addEventListener('click',()=>window.openOpportunities());window.showScreen('madkhalOpportunityDetailScreen');
  }

  function applicationExists(id){return arr(L.applications).some(a=>String(a.job_id)===String(id));}
  async function applyOpportunityUnified(id){
    if(!read(L.name)){toast('👤 احفظ ملفك المهني أولًا.');window.openProfile();return;}
    const job=allJobs().find(j=>String(j.id)===String(id));
    if(!job){toast('❌ لم يتم العثور على الفرصة.');return;}
    if(applicationExists(job.id)){toast('ℹ️ سبق تسجيل طلبك على هذه الفرصة.');return;}
    try{
      const c=client();if(!c)throw new Error('SUPABASE_NOT_CONNECTED');
      const u=await user();if(!u)throw new Error('AUTH_REQUIRED');
      let remoteId=null;
      if(job.employerVacancy){
        let vacancyId=job.remote_id||job.source_id||job.id;
        if(String(vacancyId).startsWith('remote_'))vacancyId=String(vacancyId).slice(7);
        const r=await c.rpc('apply_to_employer_vacancy',{p_vacancy_id:vacancyId});if(r.error)throw r.error;remoteId=Array.isArray(r.data)?r.data[0]:r.data;
      }else{
        /* jobs.id is the authoritative UUID used by record_external_job_application. */
        const jobId=job.id;
        if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(jobId)))throw new Error('INVALID_JOB_ID');
        const r=await c.rpc('record_external_job_application',{p_job_id:jobId});if(r.error)throw r.error;remoteId=Array.isArray(r.data)?r.data[0]:r.data;
      }
      if(!remoteId)throw new Error('APPLICATION_NOT_SAVED');
      const apps=arr(L.applications);apps.push({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),job_id:job.id,remote_job_id:remoteId,title:job.title,company:job.company||'',location:job.location||'',source:job.employerVacancy?'employer':(job.source||'external'),status:'applied',created_at:now()});setArr(L.applications,apps);
      const ns=arr(L.notifications);ns.push({id:String(Date.now()),type:'application',message:`تم تسجيل طلب التقديم على ${job.title}`,created_at:now()});setArr(L.notifications,ns);
      toast('✅ تم تسجيل طلبك بنجاح.');
      const link=job.external_link||job.source_url||job.canonical_url||'';
      if(!job.employerVacancy&&/^https?:\\/\\//i.test(String(link)))setTimeout(()=>window.open(String(link),'_blank','noopener,noreferrer'),250);
      window.openOpportunities();
    }catch(e){
      console.warn('Madkhal application save:',e);
      const msg=String(e?.message||e?.error_description||'').toLowerCase();
      if(msg.includes('profile_required')||msg.includes('worker_profile_required'))toast('❌ أكمل ملفك المهني أولًا ثم أعد التقديم.');
      else if(msg.includes('job_not_available')||msg.includes('vacancy_not_open'))toast('❌ هذه الفرصة لم تعد متاحة للتقديم.');
      else if(msg.includes('authentication_required'))toast('❌ تعذر تسجيل الدخول. أعد المحاولة.');
      else if(msg.includes('invalid_job_id'))toast('❌ تعذر تحديد رقم الفرصة بشكل صحيح.');
      else if(msg.includes('supabase_not_connected'))toast('❌ قاعدة البيانات غير متاحة الآن.');
      else toast('❌ تعذر حفظ طلب التقديم: '+String(e?.message||'خطأ غير معروف').slice(0,120));
    }
  }
  window.applyOpportunity=applyOpportunityUnified;

  async function ensureSubscription(){
    const c=client();const u=await user();if(!c||!u)throw new Error('AUTH_REQUIRED');
    const p=await c.from('profiles').select('id').eq('auth_user_id',u.id).maybeSingle();if(p.error)throw p.error;if(!p.data?.id)throw new Error('PROFILE_REQUIRED');
    const existing=await c.from('subscriptions').select('id').eq('user_id',p.data.id).eq('audience','worker').maybeSingle();if(existing.error)throw existing.error;
    const payload={user_id:p.data.id,plan:'monthly',status:'requested',starts_at:null,ends_at:null,audience:'worker',requested_at:now(),price_usd:1,provider:'shamcash',external_reference:null,auto_renew:false,currency:'USD',metadata:{product:'madkhal_worker_monthly',price_usd:1,provider:'shamcash'},updated_at:now()};
    if(existing.data?.id){const r=await c.from('subscriptions').update(payload).eq('id',existing.data.id).eq('user_id',p.data.id);if(r.error)throw r.error;}else{const r=await c.from('subscriptions').insert(payload);if(r.error)throw r.error;}
  }
  window.startSubscriptionRequest=async function(){
    const b=document.getElementById('madkhalSubscriptionButton');if(b){b.disabled=true;b.textContent='⏳ جارٍ تجهيز الاشتراك...';}
    try{const c=client();const u=await user();if(!c||!u)throw new Error('AUTH_REQUIRED');await ensureSubscription();const r=await c.rpc('create_subscription_payment_intent');if(r.error)throw r.error;const row=Array.isArray(r.data)?r.data[0]:r.data;write(L.subscription,'requested');const box=document.getElementById('subscriptionStatusBox');if(box)box.innerHTML=`<div class="card"><h3 style="margin:0 0 8px">✅ تم إنشاء طلب الاشتراك</h3><p style="margin:0;line-height:1.8">القيمة <strong>$1 شهريًا</strong>. تم إنشاء طلب الدفع لدى <strong>Sham Cash</strong>. لا يعتبر الاشتراك مدفوعًا أو مفعلًا حتى يتم التحقق من الدفع.</p>${row?.payment_intent_id?`<div class="info-strip" style="margin-top:10px">رقم طلب الدفع: <strong>${esc(row.payment_intent_id)}</strong></div>`:''}</div>`;toast('✅ تم إنشاء طلب الاشتراك بقيمة $1.');renderUnifiedAccount();}
    catch(e){console.warn('Madkhal subscription:',e);toast('❌ تعذر إنشاء طلب الاشتراك الآن.');}
    finally{if(b){b.disabled=false;b.textContent='🔔 متابعة الاشتراك — $1 شهريًا';}}
  };
  window.openSubscription=function(){buildSubscription();window.showScreen('subscriptionScreen');};
  function buildSubscription(){
    const s=document.getElementById('subscriptionScreen');if(!s)return;s.innerHTML='<button class="back" type="button" id="madkhalSubscriptionBack">↩️ العودة</button><div class="premium-offer"><div class="premium-badge">🔔 مَدخَل يبحث معك</div><h2 style="margin:0 0 8px">المتابعة المستمرة</h2><p style="margin:0;line-height:1.9">البحث الأساسي والتصفح والتقديم مجاني. الاشتراك اختياري لمن يريد أن يتابع مَدخَل الفرص الجديدة، يطابقها مع ملفه، ويرسل التنبيهات ويرتب النتائج ويتابع الطلبات.</p><div class="premium-price">$1 شهريًا</div><ul class="premium-features"><li>🎯 مطابقة مستمرة</li><li>🔔 تنبيهات عن الفرص الجديدة</li><li>📋 متابعة طلبات التقديم</li><li>📊 الاستفادة من التقييمات</li><li>💾 حفظ البحث والتفضيلات</li></ul><button id="madkhalSubscriptionButton" class="primary-btn madkhal-clear-btn" type="button">🔔 متابعة الاشتراك — $1 شهريًا</button></div><div id="subscriptionStatusBox"></div>';s.querySelector('#madkhalSubscriptionBack')?.addEventListener('click',()=>window.showScreen('madkhalWorkerCompletionScreen'));s.querySelector('#madkhalSubscriptionButton')?.addEventListener('click',window.startSubscriptionRequest);const status=read(L.subscription);if(status==='requested'){const box=document.getElementById('subscriptionStatusBox');if(box)box.innerHTML='<div class="card"><h3>🔔 طلب الاشتراك مسجل</h3><p>تم تسجيل طلبك. التفعيل النهائي يعتمد على التحقق من الدفع.</p></div>';}}

  function renderUnifiedAccount(){
    const s=document.getElementById('accountScreen');if(!s)return;const apps=arr(L.applications).slice().reverse();const notifications=arr(L.notifications).slice().reverse();const saved=read(L.assessment);const status=read(L.subscription);const jobs=allJobs().map(j=>({j,s:score(j)})).sort((a,b)=>b.s-a.s).filter(x=>x.s>=45).slice(0,5).map(x=>x.j);
    s.innerHTML=`<div class="card"><h2 style="margin:0 0 8px">👤 حسابي</h2><p style="margin:0;line-height:1.8">${esc(read(L.name)||'لم يتم إنشاء الملف بعد.')}</p></div><div class="card"><h3>📋 ملفي المهني</h3><p>بياناتك الأساسية ومهاراتك وخبرتك.</p><button class="secondary-btn madkhal-clear-btn" style="width:100%;margin-top:12px" type="button" id="madkhalAccountProfile">✏️ تعديل الملف</button></div><div class="card"><h3>📩 طلبات التقديم</h3>${apps.length?apps.slice(0,6).map(a=>`<div class="list-row"><strong>${esc(a.title||'فرصة')}</strong><br>🏢 ${esc(a.company||'')}<br>📍 ${esc(a.location||'')}<br><span class="status-review">🟡 ${esc(a.status==='applied'?'تم التقديم':'قيد المتابعة')}</span></div>`).join(''):'<div class="empty-state">لا توجد طلبات تقديم حتى الآن.</div>'}</div><div class="card"><h3>🎯 فرص مطابقة</h3>${jobs.length?jobs.map(j=>`<div class="list-row"><strong>${esc(j.title)}</strong><br>🏢 ${esc(j.company||'')}<br>🎯 مطابقة ${score(j)}%<br><button class="secondary-btn madkhal-small-btn" style="width:100%;margin-top:8px" data-open-job="${esc(j.id)}" type="button">👁️ عرض الفرصة</button></div>`).join(''):'<div class="empty-state">لا توجد فرص مطابقة كافية حاليًا.</div>'}</div><div class="card"><h3>📊 تقييماتي</h3><p>${saved?esc((()=>{try{const r=JSON.parse(saved);return `آخر تقييم: ${r.score}/100 — ${r.level}`;}catch(e){return 'يوجد تقييم محفوظ.';}})()):'لا توجد تقييمات محفوظة بعد.'}</p></div><div class="card"><h3>🔔 التنبيهات</h3>${notifications.length?notifications.slice(0,6).map(n=>`<div class="list-row">🔔 ${esc(n.message)}<br><small>${esc(n.created_at||'')}</small></div>`).join(''):'<div class="empty-state">لا توجد تنبيهات بعد.</div>'}</div><div class="card"><h3>💳 اشتراكي</h3><p>${status==='active'?'✅ الاشتراك مفعل.':status==='requested'?'🟡 طلب الاشتراك قيد التحقق.':'الاشتراك غير مفعل.'}</p><button class="primary-btn madkhal-clear-btn" style="width:100%;margin-top:10px" type="button" id="madkhalAccountSubscription">${status==='active'?'⚙️ إدارة الاشتراك':'🔔 تفعيل المتابعة — $1 شهريًا'}</button></div>`;
    s.querySelector('#madkhalAccountProfile')?.addEventListener('click',()=>window.openProfile());s.querySelector('#madkhalAccountSubscription')?.addEventListener('click',()=>window.openSubscription());s.querySelectorAll('[data-open-job]').forEach(b=>b.addEventListener('click',()=>openOpportunityDetails(b.getAttribute('data-open-job'))));
  }

  function installStyles(){
    if(document.getElementById('madkhal-unified-style'))return;const st=document.createElement('style');st.id='madkhal-unified-style';st.textContent='.madkhal-home-btn{min-height:54px;font-size:15px}.madkhal-clear-btn{min-height:52px;font-size:14px;font-weight:900;box-shadow:0 7px 18px rgba(20,40,40,.08)}.madkhal-small-btn{min-height:45px;padding:9px 8px;font-size:12px}.worker-profile-intro{background:linear-gradient(145deg,#eaf8f5,#fff)}#madkhalWorkerCompletionScreen .secondary-btn{background:#fffdf3;border-color:#eadb9a;color:#665100}';document.head.appendChild(st);
  }

  function install(){
    client();installStyles();setHomeButtons();buildWorkerForm();ensureCompletion();ensureDetailScreen();buildSubscription();
    /* Existing native behavioral layers are deliberately not loaded here. */
  }

  /* Keep the existing live data synchronizer, but not the old behavioral bridges. */
  if(!document.querySelector('script[src^="./madkhal-live-bridge.js"]')){const sc=document.createElement('script');sc.src='./madkhal-live-bridge.js';sc.defer=true;document.head.appendChild(sc);}

  document.addEventListener('DOMContentLoaded',()=>{install();setTimeout(()=>{try{window.renderCategories();window.renderOpportunities();}catch(e){console.warn('Madkhal unified startup:',e);}},150);},{once:true});
})();
