/* MADKHAL_JOBS_DATA_FIX_V3 */
(function(){
  "use strict";
  async function loadAll(force=false){
    if(typeof madkhalRealJobsLoaded!=="undefined"&&madkhalRealJobsLoaded&&!force)return madkhalRealJobs;
    if(typeof supabaseClient==="undefined"||!supabaseClient)return [];
    if(typeof madkhalRealJobsLoading!=="undefined"&&madkhalRealJobsLoading&&!force)return madkhalRealJobsLoading;
    madkhalRealJobsLoading=(async function(){
      try{
        const nowIso=new Date().toISOString();
        const rows=[];let from=0;const pageSize=1000;
        const scope="geo_class.in.(MENA,SYRIA),geo_region.in.(middle_east,Middle East & North Africa,Syria)";
        while(true){
          const q=await supabaseClient.from("jobs")
            .select("id,source,source_job_id,title,company,description,location,country,job_type,category,salary_min,salary_max,salary_currency,source_url,canonical_url,posted_at,updated_at,expires_at,status,geo_scope,geo_region,geo_class")
            .eq("status","active")
            .or("expires_at.is.null,expires_at.gt."+nowIso)
            .or(scope)
            .order("id",{ascending:true})
            .range(from,from+pageSize-1);
          if(q.error)throw q.error;
          const page=Array.isArray(q.data)?q.data:[];
          rows.push(...page);
          if(page.length<pageSize)break;
          from+=pageSize;
        }
        const seen=new Set();
        madkhalRealJobs=rows.map(typeof madkhalNormalizeDbJob==="function"?madkhalNormalizeDbJob:x=>x).filter(function(job){
          if(!job||seen.has(job.id))return false;
          seen.add(job.id);return true;
        });
        madkhalRealJobsLoaded=true;
        console.info("Madkhal MENA jobs loaded:",madkhalRealJobs.length);
        return madkhalRealJobs;
      }catch(e){
        console.warn("Madkhal jobs data fix:",e);
        madkhalRealJobsLoaded=false;
        return [];
      }finally{
        madkhalRealJobsLoading=null;
      }
    })();
    return madkhalRealJobsLoading;
  }
  window.loadMadkhalRealJobs=loadAll;
  window.madkhalReloadJobs=()=>loadAll(true);
})();
