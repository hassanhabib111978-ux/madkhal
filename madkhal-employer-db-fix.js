/* MADKHAL_EMPLOYER_DB_FIX_V1 */
(function(){
  "use strict";

  function numPair(text){
    const nums=String(text||"").replace(/,/g,"").match(/\d+(?:\.\d+)?/g)||[];
    return {min:nums[0]?Number(nums[0]):null,max:nums[1]?Number(nums[1]):null};
  }
  function currency(text){
    const s=String(text||"").toLowerCase();
    if(/\b(usd|\$|دولار)/i.test(s))return "USD";
    if(/\b(eur|€|يورو)/i.test(s))return "EUR";
    if(/\b(syp|ليرة|ل.س)/i.test(s))return "SYP";
    if(/\b(aed|درهم)/i.test(s))return "AED";
    if(/\b(sar|ريال)/i.test(s))return "SAR";
    return null;
  }
  function values(){
    const get=id=>document.getElementById(id)?.value?.trim()||"";
    return {employerName:get("employerName"),title:get("vacancyTitle"),location:get("vacancyLocation"),workType:document.getElementById("vacancyWorkType")?.value||"",skills:get("vacancySkills"),qualification:get("vacancyQualification"),numberNeeded:Number(document.getElementById("vacancyNumber")?.value||1),salary:get("vacancySalary"),description:get("vacancyDescription")};
  }
  async function syncCorrectVacancy(v){
    const db=window.supabaseClient;if(!db||!v.title)return;
    try{
      let user=null;
      if(typeof window.madkhalSessionUser==="function")user=await window.madkhalSessionUser();
      else user=(await db.auth.getSession())?.data?.session?.user||null;
      if(!user)return;
      let p=(await db.from("profiles").select("id,role").eq("auth_user_id",user.id).maybeSingle()).data||null;
      if(!p){
        const ins=await db.from("profiles").insert({id:crypto.randomUUID(),auth_user_id:user.id,full_name:v.employerName,role:"employer"}).select("id,role").maybeSingle();
        if(ins.error)throw ins.error;
        p=ins.data;
      }
      if(!p||p.role!=="employer"){
        console.warn("Madkhal employer DB fix: current profile is not employer role");
        return;
      }
      const sal=numPair(v.salary);
      const payload={employer_id:p.id,title:v.title,company_name:v.employerName||null,description:v.description||null,location:v.location||null,job_type:v.workType||null,required_skills:v.skills||null,required_qualification:v.qualification||null,salary_min:sal.min,salary_max:sal.max,salary_currency:currency(v.salary),number_needed:Math.max(1,v.numberNeeded||1),status:"open",visibility:"private_match_only",created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      const r=await db.from("employer_vacancies").insert(payload).select("id").maybeSingle();
      if(r.error)throw r.error;
      console.info("Madkhal employer vacancy synced:",r.data?.id||null);
    }catch(e){console.warn("Madkhal employer DB sync:",e);}
  }
  function install(){
    const base=window.submitEmployerVacancy;
    if(typeof base!=="function"||base.__madkhalEmployerDbFix)return false;
    const wrapped=async function(){
      const v=values();
      const result=await base.apply(this,arguments);
      await syncCorrectVacancy(v);
      return result;
    };
    wrapped.__madkhalEmployerDbFix=true;
    window.submitEmployerVacancy=wrapped;
    return true;
  }
  function start(){install();setTimeout(install,100);setTimeout(install,500);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
