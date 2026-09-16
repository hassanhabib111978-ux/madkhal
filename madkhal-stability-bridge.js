(() => {
  'use strict';
  if (window.__MADKHAL_STABILITY_BRIDGE_READY__) return;
  window.__MADKHAL_STABILITY_BRIDGE_READY__ = true;

  const client = () => window.supabaseClient || null;
  const now = () => new Date().toISOString();

  async function sessionUser() {
    const c = client();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    if (data?.session?.user) return data.session.user;
    const { data: anon } = await c.auth.signInAnonymously();
    return anon?.user || null;
  }

  async function ownProfile(user) {
    const c = client();
    if (!c || !user) return null;
    const { data, error } = await c.from('profiles').select('id,auth_user_id,full_name,role,phone,main_skill,bio').eq('auth_user_id', user.id).maybeSingle();
    if (error) throw error;
    if (data) return data;
    const { data: created, error: createError } = await c.from('profiles').insert({ auth_user_id:user.id, full_name:'', role:'seeker', created_at:now() }).select().maybeSingle();
    if (createError) throw createError;
    return created;
  }

  function patchPriceText() {
    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length === 0 && el.textContent && el.textContent.includes('دولار ونصف')) {
        el.textContent = el.textContent.replace(/دولار ونصف/g, 'دولار واحد');
      }
    });
  }

  function showApplicationSuccessMessage() {
    const message = 'تم تسجيل طلبك بنجاح وبشكل مجاني.\n\nيمكنك الاستفادة من كل المزايا الأساسية والتقديم على الوظيفة مجانًا.\n\nوإذا رغبت في الحصول على ميزة المطابقة المستمرة والتقييمات والتنبيهات عند توافر فرص تناسب مهاراتك، يمكنك الاشتراك بقيمة دولار واحد شهريًا، وهو اشتراك غير ملزم.';
    if (window.confirm(message + '\n\nهل ترغب في تسجيل طلب الاشتراك الآن؟')) {
      if (typeof window.startSubscriptionRequest === 'function') window.startSubscriptionRequest();
    }
  }

  window.submitEmployerVacancy = async function () {
    const c = client();
    const user = await sessionUser();
    if (!c || !user) { showToast('⚠️ تعذر الاتصال بالحساب.'); return; }
    const employerName = document.getElementById('employerName')?.value.trim() || '';
    const title = document.getElementById('vacancyTitle')?.value.trim() || '';
    const location = document.getElementById('vacancyLocation')?.value.trim() || '';
    const workType = document.getElementById('vacancyWorkType')?.value || '';
    const skills = document.getElementById('vacancySkills')?.value.trim() || '';
    const qualification = document.getElementById('vacancyQualification')?.value.trim() || '';
    const numberNeeded = Number(document.getElementById('vacancyNumber')?.value || 1);
    const salary = document.getElementById('vacancySalary')?.value.trim() || '';
    const description = document.getElementById('vacancyDescription')?.value.trim() || '';
    if (!employerName || !title || !location || !workType || !skills || !description) { showToast('⚠️ أكمل بيانات فرصة العمل الأساسية.'); return; }
    if (numberNeeded < 1) { showToast('⚠️ عدد الأشخاص يجب أن يكون واحدًا على الأقل.'); return; }
    try {
      const { data: existing, error: pe } = await c.from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle();
      if (pe) throw pe;
      let profileId = existing?.id;
      if (!profileId) {
        const { data: created, error: ce } = await c.from('profiles').insert({ auth_user_id:user.id, full_name:employerName, role:'employer', created_at:now() }).select('id').maybeSingle();
        if (ce) throw ce;
        profileId = created.id;
      } else {
        const { error: ue } = await c.from('profiles').update({ full_name:employerName, role:'employer' }).eq('id',profileId).eq('auth_user_id',user.id);
        if (ue) throw ue;
      }
      const { data, error } = await c.from('employer_vacancies').insert({
        employer_id:profileId, title, company_name:employerName, description, location, country:null,
        job_type:workType, category:null, required_skills:skills, required_qualification:qualification || null,
        salary_min:null, salary_max:null, salary_currency:null, number_needed:numberNeeded,
        status:'open', visibility:'private_match_only', created_at:now(), updated_at:now()
      }).select('id').maybeSingle();
      if (error) throw error;
      const local = JSON.parse(localStorage.getItem('madkhal_demo_vacancies') || '[]');
      local.push({ id:'remote_'+data.id, remote_id:data.id, employerVacancy:true, title, company:employerName, employer_name:employerName, location, work_type:workType, required_skills:skills, required_qualification:qualification, number_needed:numberNeeded, salary, description, status:'open', created_at:now() });
      localStorage.setItem('madkhal_demo_vacancies', JSON.stringify(local));
      if (typeof clearEmployerForm === 'function') clearEmployerForm();
      if (typeof renderOpportunities === 'function') renderOpportunities();
      showToast('🎉 تم تسجيل فرصة العمل في مَدخَل.');
      setTimeout(() => showScreen('opportunitiesScreen'), 500);
    } catch (e) {
      console.warn('Madkhal employer vacancy:', e);
      showToast('❌ تعذر حفظ فرصة العمل في قاعدة البيانات.');
    }
  };

  window.applyOpportunity = async function (id) {
    const c = client();
    const name = localStorage.getItem('madkhal_profile_name');
    if (!name) { showToast('👤 أنشئ ملفك المهني أولًا حتى تستطيع التقديم.'); setTimeout(() => openProfile(), 700); return; }
    const opportunity = typeof findOpportunityById === 'function' ? findOpportunityById(id) : null;
    if (!opportunity) { showToast('❌ لم يتم العثور على الفرصة.'); return; }
    try {
      const user = await sessionUser();
      if (!user || !c) throw new Error('authentication_required');
      let result;
      if (opportunity.employerVacancy) {
        const remoteId = opportunity.remote_id || id;
        result = await c.rpc('apply_to_employer_vacancy', { p_vacancy_id:remoteId });
      } else {
        const remoteId = opportunity.source_id || opportunity.remote_id;
        if (!remoteId || String(remoteId).startsWith('demo-')) { showToast('ℹ️ هذه فرصة تجريبية وليست وظيفة حقيقية.'); return; }
        result = await c.rpc('record_external_job_application', { p_job_id:remoteId });
      }
      if (result.error) throw result.error;
      const applications = JSON.parse(localStorage.getItem('madkhal_applications') || '[]');
      if (!applications.some(a => String(a.job_id) === String(opportunity.id))) {
        applications.push({ id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), job_id:opportunity.id, remote_id:result.data, title:opportunity.title, company:opportunity.company || 'صاحب فرصة', location:opportunity.location || '', source:opportunity.employerVacancy ? 'employer' : 'external', status:opportunity.employerVacancy ? 'worker_pending' : 'applied', created_at:now() });
        localStorage.setItem('madkhal_applications', JSON.stringify(applications));
      }
      showApplicationSuccessMessage();
      if (opportunity.external_link && /^https?:\/\//i.test(String(opportunity.external_link))) setTimeout(() => window.open(String(opportunity.external_link),'_blank','noopener,noreferrer'),350);
      if (typeof loadAccount === 'function') loadAccount();
    } catch (e) {
      console.warn('Madkhal application:', e);
      showToast('❌ تعذر تسجيل التقديم.');
    }
  };

  window.startSubscriptionRequest = async function () {
    const c = client();
    if (!c) { showToast('⚠️ اتصال قاعدة البيانات غير متاح.'); return; }
    try {
      const user = await sessionUser();
      if (!user) throw new Error('authentication_required');
      const profile = await ownProfile(user);
      const { error } = await c.from('subscriptions').upsert({
        user_id:profile.id, plan:'monthly', status:'requested', starts_at:null, ends_at:null,
        audience:'worker', requested_at:now(), price_usd:1, provider:null, external_reference:null,
        auto_renew:false, currency:'USD', metadata:{ product:'madkhal_worker_monthly', price_usd:1 }, updated_at:now()
      }, { onConflict:'user_id,audience' });
      if (error) throw error;
      localStorage.setItem('madkhal_subscription','requested');
      if (typeof renderSubscriptionStatus === 'function') renderSubscriptionStatus();
      showToast('🔔 تم تسجيل رغبتك بالاشتراك بقيمة دولار واحد شهريًا.');
    } catch (e) {
      console.warn('Madkhal subscription:', e);
      showToast('❌ تعذر تسجيل الاشتراك الآن.');
    }
  };

  document.addEventListener('DOMContentLoaded', () => setTimeout(patchPriceText, 50), { once:true });
})();
