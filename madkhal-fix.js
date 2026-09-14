/* MADKHAL_RUNTIME_FIX_V4 */
(function () {
  "use strict";

  const ID_KEYS={first:"madkhal_profile_first_name",father:"madkhal_profile_father_name",family:"madkhal_profile_family_name",mother:"madkhal_profile_mother_name",birth:"madkhal_profile_birth_date"};
  function val(id){return document.getElementById(id)?.value?.trim()||"";}

  let navigationFixInstalled=false;
  function installNavigationFix(){
    if(navigationFixInstalled||typeof window.showScreen!=="function")return navigationFixInstalled;
    const originalShowScreen=window.showScreen;
    window.showScreen=function(screenId,focusTargetId){
      const result=originalShowScreen.apply(this,arguments);
      const move=function(){
        const screen=document.getElementById(screenId);if(!screen)return;
        const header=document.querySelector(".header");
        const installBar=document.querySelector(".madkhal-install-bar");
        const headerHeight=header?header.getBoundingClientRect().height:0;
        const installHeight=installBar&&getComputedStyle(installBar).display!=="none"?installBar.getBoundingClientRect().height+10:0;
        const offset=Math.max(0,headerHeight+installHeight+8);
        const top=Math.max(0,window.scrollY+screen.getBoundingClientRect().top-offset);
        window.scrollTo({top:top,left:0,behavior:"auto"});
        document.documentElement.scrollTop=top;document.body.scrollTop=top;
        if(focusTargetId){
          const target=document.getElementById(focusTargetId);
          if(target&&typeof target.focus==="function")setTimeout(function(){try{target.focus({preventScroll:true});}catch(_){target.focus();}},80);
        }
      };
      requestAnimationFrame(move);setTimeout(move,100);return result;
    };
    navigationFixInstalled=true;return true;
  }
  function startNavigationFix(){
    if(installNavigationFix())return;
    let tries=0;const timer=setInterval(function(){tries++;if(installNavigationFix()||tries>=40)clearInterval(timer);},100);
  }

  async function realJobs(force){
    if(madkhalRealJobsLoading&&!force)return madkhalRealJobsLoading;
    if(madkhalRealJobsLoaded&&!force)return madkhalRealJobs;
    if(!supabaseClient)return [];
    madkhalRealJobsLoading=(async function(){
      try{
        const nowIso=new Date().toISOString();
        const {data,error}=await supabaseClient.from("jobs").select("id,source,source_job_id,title,company,description,location,country,job_type,category,salary_min,salary_max,salary_currency,source_url,canonical_url,posted_at,updated_at,expires_at,status,geo_scope,geo_region,geo_class,geo_reason").eq("status","active").or("expires_at.is.null,expires_at.gt."+nowIso).order("created_at",{ascending:false}).range(0,59);
        if(error)throw error;
        const rows=Array.isArray(data)?data:[],seen=new Set();
        madkhalRealJobs=rows.map(madkhalNormalizeDbJob).filter(function(job){if(!job||seen.has(job.id))return false;if(job.expires_at&&new Date(job.expires_at).getTime()<=Date.now())return false;seen.add(job.id);return true;});
        madkhalRealJobsLoaded=true;return madkhalRealJobs;
      }catch(e){console.warn("Madkhal runtime jobs validity filter:",e);madkhalRealJobsLoaded=false;return [];}finally{madkhalRealJobsLoading=null;}
    })();return madkhalRealJobsLoading;
  }
  window.loadMadkhalRealJobs=realJobs;

  window.getAllVisibleOpportunities=function(){
    const localVacancies=getLocalArray(LOCAL_KEYS.vacancies).filter(v=>v.status==="open").map(function(v){return{id:v.id,icon:"🏢",title:v.title,company:v.employer_name,location:v.location,type:formatWorkType(v.work_type),category:guessOpportunityCategory((v.title||"")+" "+(v.required_skills||"")),salary:v.salary||"حسب الاتفاق",description:v.description,employerVacancy:true,source:"employer",source_name:"صاحب العمل",remote_id:v.remote_id||null};});
    return localVacancies.concat(getMadkhalRealOpportunities());
  };

  function addIdentityFields(){
    const name=document.getElementById("workerName");if(!name||document.getElementById("madkhalIdentityFields"))return;
    const box=document.createElement("div");box.id="madkhalIdentityFields";
    box.innerHTML='<div class="info-strip" style="margin:12px 0">🪪 بيانات الهوية الأساسية لتمييز المتقدمين المتشابهة أسماؤهم.</div><div class="form-group"><label>الاسم الأول *</label><input id="workerFirstName" type="text" placeholder="الاسم الأول"></div><div class="form-group"><label>اسم الأب *</label><input id="workerFatherName" type="text" placeholder="اسم الأب"></div><div class="form-group"><label>اسم العائلة / الكنية *</label><input id="workerFamilyName" type="text" placeholder="اسم العائلة / الكنية"></div><div class="form-group"><label>اسم الأم *</label><input id="workerMotherName" type="text" placeholder="اسم الأم"></div><div class="form-group"><label>تاريخ التولد *</label><input id="workerBirthDate" type="date"></div>';
    name.parentNode.insertAdjacentElement("afterend",box);
    [["workerFirstName",ID_KEYS.first],["workerFatherName",ID_KEYS.father],["workerFamilyName",ID_KEYS.family],["workerMotherName",ID_KEYS.mother],["workerBirthDate",ID_KEYS.birth]].forEach(function(pair){const el=document.getElementById(pair[0]);if(el)el.value=localStorage.getItem(pair[1])||"";});
  }

  function wrapProfileSave(){
    if(typeof window.saveWorker!=="function"||window.saveWorker.__madkhalIdentityWrapped)return;
    const original=window.saveWorker;
    window.saveWorker=async function(){
      const first=val("workerFirstName"),father=val("workerFatherName"),family=val("workerFamilyName"),mother=val("workerMotherName"),birth=val("workerBirthDate");
      if(!first||!father||!family||!mother||!birth){showToast("⚠️ أكمل بيانات الاسم الأول والأب والعائلة والأم وتاريخ التولد.");return;}
      localStorage.setItem(ID_KEYS.first,first);localStorage.setItem(ID_KEYS.father,father);localStorage.setItem(ID_KEYS.family,family);localStorage.setItem(ID_KEYS.mother,mother);localStorage.setItem(ID_KEYS.birth,birth);
      const main=document.getElementById("workerName");if(main)main.value=[first,father,family].join(" ");
      return original.apply(this,arguments);
    };window.saveWorker.__madkhalIdentityWrapped=true;
  }

  window.openOpportunities=async function(){
    showScreen("opportunitiesScreen","jobSearch");currentCategory="الكل";madkhalJobDisplayLimit=60;
    const container=document.getElementById("opportunitiesList");if(container)container.innerHTML='<div class="card"><div class="empty-state">⏳ جارٍ تحميل 60 فرصة حقيقية صالحة للمنطقة...</div></div>';
    requestAnimationFrame(function(){window.scrollTo({top:0,left:0,behavior:"auto"});document.documentElement.scrollTop=0;document.body.scrollTop=0;});
    await realJobs(false);renderCategories();renderOpportunities();
    requestAnimationFrame(function(){window.scrollTo({top:0,left:0,behavior:"auto"});document.documentElement.scrollTop=0;document.body.scrollTop=0;});
  };

  let refreshStarted=false;
  function startTenMinuteRefresh(){if(refreshStarted)return;refreshStarted=true;setInterval(async function(){try{await realJobs(true);if(document.getElementById("opportunitiesScreen")?.classList.contains("active")){madkhalJobDisplayLimit=60;renderCategories();renderOpportunities();}}catch(e){console.warn("Madkhal 10-minute refresh:",e);}},10*60*1000);}

  window.applyOpportunity=async function(id){
    const opportunity=findOpportunityById(id);if(!opportunity){showToast("❌ لم يتم العثور على الفرصة.");return;}
    const modal=document.createElement("div");modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:12px";
    modal.innerHTML='<div style="background:#fff;border-radius:22px;padding:18px;width:min(700px,100%);max-height:92vh;overflow:auto;direction:rtl"><h3>📩 بيانات المتقدم</h3><p style="color:#657070;font-size:13px;line-height:1.7">هذه البيانات تمنع الخلط بين المتقدمين الذين يحملون الاسم نفسه.</p><div class="form-group"><label>الاسم الأول *</label><input id="applyFirstName" value="'+escapeHtml(localStorage.getItem(ID_KEYS.first)||"")+'"></div><div class="form-group"><label>اسم الأب *</label><input id="applyFatherName" value="'+escapeHtml(localStorage.getItem(ID_KEYS.father)||"")+'"></div><div class="form-group"><label>اسم العائلة / الكنية *</label><input id="applyFamilyName" value="'+escapeHtml(localStorage.getItem(ID_KEYS.family)||"")+'"></div><div class="form-group"><label>اسم الأم *</label><input id="applyMotherName" value="'+escapeHtml(localStorage.getItem(ID_KEYS.mother)||"")+'"></div><div class="form-group"><label>تاريخ التولد *</label><input id="applyBirthDate" type="date" value="'+escapeHtml(localStorage.getItem(ID_KEYS.birth)||"")+'"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button id="applyConfirm" class="primary-btn" type="button">تأكيد التقديم</button><button id="applyCancel" class="secondary-btn" type="button">إلغاء</button></div></div>';
    document.body.appendChild(modal);modal.querySelector("#applyCancel").onclick=function(){modal.remove();};
    modal.querySelector("#applyConfirm").onclick=async function(){
      const first=val("applyFirstName"),father=val("applyFatherName"),family=val("applyFamilyName"),mother=val("applyMotherName"),birth=val("applyBirthDate");
      if(!first||!father||!family||!mother||!birth){showToast("⚠️ أكمل بيانات المتقدم الخمسة.");return;}
      localStorage.setItem(ID_KEYS.first,first);localStorage.setItem(ID_KEYS.father,father);localStorage.setItem(ID_KEYS.family,family);localStorage.setItem(ID_KEYS.mother,mother);localStorage.setItem(ID_KEYS.birth,birth);
      const apps=getLocalArray(LOCAL_KEYS.applications);if(apps.some(a=>String(a.job_id)===String(opportunity.id))){modal.remove();showToast("ℹ️ سبق أن سجلت طلب تقديم على هذه الفرصة.");return;}
      const source=opportunity.employerVacancy?"employer":(opportunity.source||"external"),created=new Date().toISOString();
      const application={id:createId(),job_id:opportunity.id,remote_job_id:opportunity.source_id||opportunity.remote_id||null,title:opportunity.title,company:opportunity.company||"",location:opportunity.location||"",source:source,status:"submitted",applicant_first_name:first,applicant_father_name:father,applicant_family_name:family,applicant_mother_name:mother,applicant_birth_date:birth,created_at:created};
      apps.push(application);setLocalArray(LOCAL_KEYS.applications,apps);
      try{const user=await madkhalSessionUser();if(user){const payload={user_id:user.id,job_id:opportunity.source_id||opportunity.remote_id||(opportunity.employerVacancy?opportunity.id:null),job_title:opportunity.title,company:opportunity.company||"",location:opportunity.location||null,source:source,status:"submitted",applicant_first_name:first,applicant_father_name:father,applicant_family_name:family,applicant_mother_name:mother,applicant_birth_date:birth,created_at:created};const res=await supabaseClient.from("applications").insert(payload).select().maybeSingle();if(res.error)throw res.error;if(res.data)application.remote_id=res.data.id;}}catch(e){console.warn("Madkhal application identity sync:",e);}
      modal.remove();showToast("📩 تم تسجيل طلبك على: "+opportunity.title);loadAccount();
      if(opportunity.external_link&&/^https?:\/\//i.test(String(opportunity.external_link)))setTimeout(function(){window.open(String(opportunity.external_link),"_blank","noopener,noreferrer");},350);
    };
  };

  document.addEventListener("DOMContentLoaded",function(){startNavigationFix();addIdentityFields();wrapProfileSave();startTenMinuteRefresh();setTimeout(function(){realJobs(false).then(function(){renderCategories();renderOpportunities();});},200);});
  startNavigationFix();
})();
