/* MADKHAL_JIBRAN_EVALUATION_ENHANCEMENT_2026-09-21 */
(function(){
  "use strict";

  function txt(v){return String(v??"").trim()}
  function norm(v){
    try{return typeof normalizeText==="function"?normalizeText(txt(v)):txt(v).toLowerCase()}
    catch(e){return txt(v).toLowerCase()}
  }
  function toks(v){
    try{return typeof tokens==="function"?tokens(norm(v)):norm(v).split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1)}
    catch(e){return norm(v).split(/\s+/).filter(x=>x.length>1)}
  }
  function has(v){return txt(v).length>0}
  function profile(){try{return typeof localProfile==="function"?localProfile():{}}catch(e){return {}}}
  function assessment(){try{return typeof getLS==="function"?getLS(LS.assessment,null):null}catch(e){return null}}
  function aliases(occupation){
    let a=[];
    try{if(typeof aliasTermsFor==="function")a=aliasTermsFor(occupation)||[]}catch(e){}
    if(!Array.isArray(a))a=[a];
    return [occupation].concat(a).map(norm).filter(Boolean);
  }
  const skillMap={
    "محاسب":["محاسبة","حسابات","مالية","excel","اكسل","تدقيق","دفاتر","تقارير مالية"],
    "accountant":["accounting","finance","excel","audit","bookkeeping"],
    "مهندس برمجيات":["برمجة","python","javascript","java","sql","git","برمجيات","تطوير"],
    "مبرمج":["برمجة","python","javascript","java","sql","git","تطوير"],
    "مطور":["برمجة","python","javascript","java","sql","git","تطوير"],
    "مصمم جرافيك":["تصميم","photoshop","illustrator","figma","canva","هوية بصرية"],
    "تسويق":["تسويق","مبيعات","محتوى","إعلانات","seo","سوشال ميديا"],
    "موارد بشرية":["موارد بشرية","توظيف","recruitment","hr","رواتب"],
    "مدرس":["تدريس","تعليم","مناهج","شرح","تقييم","classroom"],
    "ممرض":["تمريض","رعاية","patient","مرضى","إسعاف"],
    "مبيعات":["مبيعات","تفاوض","عملاء","تسويق","crm"],
    "سكرتير":["تنظيم","مراسلات","office","excel","إدارة","سكرتارية"]
  };
  function expectedSkills(occ){
    const o=norm(occ), out=[];
    Object.keys(skillMap).forEach(k=>{
      const nk=norm(k);
      if(o.includes(nk)||nk.includes(o))out.push(...skillMap[k]);
    });
    return Array.from(new Set(out.map(norm).filter(Boolean)));
  }
  function skillRelevance(p){
    const skills=txt(p.skills).split(/[,،\n]+/).map(norm).filter(Boolean);
    if(!skills.length)return 0;
    const occTerms=aliases(p.occupation_label||p.profession||"");
    const expected=expectedSkills(p.occupation_label||p.profession||"");
    let hits=0;
    skills.forEach(s=>{
      const direct=occTerms.some(o=>toks(o).some(w=>w.length>2&&(s.includes(w)||w.includes(s))));
      const known=expected.some(e=>s.includes(e)||e.includes(s));
      if(direct||known)hits++;
    });
    const coverage=Math.min(1,hits/Math.max(1,Math.min(6,skills.length)));
    const quantity=Math.min(1,skills.length/5);
    return Math.round((coverage*.75+quantity*.25)*100);
  }
  function qualificationRelevance(p){
    if(!has(p.qualification))return 0;
    const q=norm(p.qualification), occ=norm(p.occupation_label||p.profession||"");
    const words=toks(occ).filter(w=>w.length>2);
    if(words.some(w=>q.includes(w)))return 100;
    const qWords=toks(q);
    const related=["محاس","مال","هندس","برمج","حاسوب","إدارة","اقتصاد","تسويق","تمريض","تعليم","آداب","علوم","تقني","تقنية","مالية","حقوق","قانون","موارد"];
    if(related.some(w=>qWords.some(x=>x.includes(w))))return 70;
    return 55;
  }
  function experienceScore(v){
    if(v===""||v==null||Number.isNaN(Number(v)))return 0;
    const n=Math.max(0,Number(v));
    if(n>=8)return 100;
    if(n>=5)return 90;
    if(n>=3)return 80;
    if(n>=2)return 70;
    if(n>=1)return 58;
    return 45;
  }
  function completeness(p){
    const fields=[p.first_name,p.mother_name,p.birth_date,p.qualification,p.occupation_label,p.location,p.work_type,p.skills,p.professional_summary];
    return Math.round(fields.filter(has).length/fields.length*100);
  }
  function calculateAutomaticAssessment(p){
    p=p||profile();
    const occupation=has(p.occupation_label||p.profession);
    const occScore=occupation?100:0;
    const skillScore=skillRelevance(p);
    const expScore=experienceScore(p.experience_years);
    const qualScore=qualificationRelevance(p);
    const summary=norm(p.professional_summary);
    const summaryScore=summary.length>=180?100:summary.length>=100?85:summary.length>=50?65:summary.length>=25?45:0;
    const complete=completeness(p);
    const work=has(p.work_type)?100:0;
    const factors=[
      {name:"الملاءمة للمهنة",score:occScore,weight:20},
      {name:"المهارات المرتبطة بالمهنة",score:skillScore,weight:30},
      {name:"الخبرة المهنية",score:expScore,weight:20},
      {name:"المؤهل ومدى ارتباطه",score:qualScore,weight:10},
      {name:"النبذة المهنية",score:summaryScore,weight:10},
      {name:"اكتمال البيانات الأساسية",score:complete,weight:5},
      {name:"نوع العمل المطلوب",score:work,weight:5}
    ];
    const score=Math.round(factors.reduce((s,f)=>s+f.score*f.weight/100,0));
    const level=score>=85?"ملف قوي":score>=70?"ملف جيد":score>=50?"ملف قابل للتحسين":"يحتاج تطويرًا";
    return {
      score,level,skill:p.occupation_label||p.profession||"الملف المهني",
      date:(typeof now==="function"?now():new Date().toISOString()),
      factors,
      strengths:factors.filter(f=>f.score>=75).map(f=>f.name),
      improvements:factors.filter(f=>f.score<70).map(f=>f.name),
      method:"تقييم مهني متعدد العوامل يركز على الملاءمة والمهارات والخبرة والمؤهل"
    };
  }
  window.calculateAutomaticAssessment=calculateAutomaticAssessment;

  function jobText(j){
    return norm([j.title,j.company,j.description,j.location,j.country,j.category,j.job_type,j.required_skills].filter(Boolean).join(" "));
  }
  function matchScoreEnhanced(job){
    const p=profile();
    if(!has(p.occupation_label)&&!has(p.profession))return 20;
    const text=jobText(job);
    const occTerms=aliases(p.occupation_label||p.profession||"");
    let occ=0;
    occTerms.forEach(o=>{
      const words=toks(o).filter(w=>w.length>2);
      if(!words.length)return;
      if(words.some(w=>text.includes(w)))occ=Math.max(occ,100);
    });
    const skills=txt(p.skills).split(/[,،\n]+/).map(norm).filter(Boolean);
    let skillHits=0;
    skills.forEach(s=>{if(s&&text.includes(s))skillHits++});
    const skill=skills.length?Math.min(100,Math.round(skillHits/Math.min(6,skills.length)*100)):0;
    const loc=has(p.location)&&text.includes(norm(p.location))?100:(has(p.location)?35:0);
    const wt=has(p.work_type)&&text.includes(norm(p.work_type))?100:(has(p.work_type)?45:0);
    const exp=experienceScore(p.experience_years);
    const a=assessment();
    const as= a&&Number(a.score)>0?Math.min(100,Number(a.score)):calculateAutomaticAssessment(p).score;
    let score=occ*.40+skill*.25+loc*.10+wt*.10+exp*.10+as*.05;
    if(occ===0)score-=15;
    return Math.max(0,Math.min(99,Math.round(score)));
  }
  window.matchScore=matchScoreEnhanced;

  function topJobs(){
    try{
      const arr=Array.isArray(allVisibleJobs)?allVisibleJobs:[];
      return arr.map(x=>typeof visibleJob==="function"?visibleJob(x):x)
        .map(j=>({j,s:matchScoreEnhanced(j)}))
        .sort((a,b)=>b.s-a.s).slice(0,3);
    }catch(e){return []}
  }

  window.renderJibranContext=function(){
    const p=profile(), el=document.getElementById("jibranContext");
    if(!el)return;
    if(!p.full_name){
      el.innerHTML="<h3>السياق الحالي</h3><p>لا يوجد ملف محفوظ بعد. أكمل الملف أولًا حتى يستطيع جبران ربط تقييمك بالفرص.</p>";
      return;
    }
    const a=calculateAutomaticAssessment(p);
    const top=topJobs();
    el.innerHTML="<h3>السياق الحالي</h3><p><strong>"+escapeHtml(p.full_name)+"</strong> · "+escapeHtml(p.occupation_label||p.profession||"مهنة غير محددة")+" · 📍 "+escapeHtml(p.location||"غير محدد")+"</p>"+
      "<div class='notice'>📊 التقييم المهني الحالي: <strong>"+a.score+"/100</strong> — "+escapeHtml(a.level)+"</div>"+
      (top.length?"<div class='notice'>🎯 أقرب فرصة حاليًا: <strong>"+escapeHtml(top[0].j.title||"—")+"</strong> — مطابقة أولية "+top[0].s+"%</div>":"");
  };

  window.askJibranUser=function(){
    const input=document.getElementById("jibranInput");
    const q=norm(input&&input.value);
    if(!q){showToast("✍️ اكتب سؤالك.");return}
    const p=profile(), a=calculateAutomaticAssessment(p);
    let ans="";
    const asksBest=["مناسبة","مناسب","الفرصة المناسبة","حسب ملفي","حسب تقييمي","تقييمي","ملفي"].some(x=>q.includes(norm(x)));
    if(q.includes("اشتراك")||q.includes("دولار")){
      ans="الاشتراك دولار واحد شهريًا للمتابعة المستمرة والمطابقة والتنبيهات. البحث الأساسي والتقديم على الفرص المتاحة مجانيان.";
    }else if(asksBest){
      if(!p.full_name||!p.occupation_label){
        ans="أكمل ملفك المهني واختر المهنة أولًا، وبعدها أربط تقييمك بالفرص المناسبة.";
      }else{
        const top=topJobs();
        if(!top.length)ans="لا توجد فرص متاحة حاليًا أستطيع مطابقتها مع ملفك.";
        else{
          ans="بحسب ملفك وتقييمك المهني الحالي "+a.score+"/100، أقرب فرصة حاليًا هي: "+top[0].j.title+" لدى "+(top[0].j.company||"—")+" — مطابقة أولية "+top[0].s+"%.";
          if(top.length>1)ans+=" وهناك أيضًا: "+top.slice(1).map(x=>x.j.title+" ("+x.s+"%)").join("، ")+"。";
          ans+=" هذه المطابقة أولية وتعتمد على بيانات الفرصة وبيانات ملفك المتاحة حاليًا.";
        }
      }
    }else if(q.includes("وظيفة")||q.includes("فرصة"))askJibran("jobs");
    else if(q.includes("مطابق"))askJibran("match");
    else if(q.includes("خطوة"))askJibran("next");
    else if(q.includes("ملف"))askJibran("profile");
    else ans=p.full_name?"أستطيع مساعدتك في تقييم ملفك، مطابقة الفرص، التقديم، والمتابعة.":"ابدأ بملفك المهني، ثم أساعدك في فهم تقييمك والفرص الأقرب.";
    if(ans)document.getElementById("jibranMainText").textContent=ans;
    if(input)input.value="";
  };

  window.renderAutomaticAssessment=function(result){
    const box=document.getElementById("automaticAssessment");
    if(!box||!result)return;
    box.innerHTML="<div class='auto-score'><div class='auto-score-number'>"+escapeHtml(result.score)+"</div><div><h3>"+escapeHtml(result.level)+"</h3><p>التقييم لا يعتمد على اكتمال الحقول وحده؛ بل يوازن بين المهنة والمهارات والخبرة والمؤهل والنبذة ونوع العمل.</p></div></div>"+
      "<div class='score-bars'>"+result.factors.map(f=>"<div class='score-bar'><span>"+escapeHtml(f.name)+"</span><i>"+f.score+"/100</i></div>").join("")+"</div>"+
      (result.improvements.length?"<div class='notice'>📚 الأولوية للتحسين: "+result.improvements.slice(0,3).map(escapeHtml).join("، ")+"</div>":"");
  };

  document.addEventListener("DOMContentLoaded",function(){
    try{renderJibranContext()}catch(e){}
  });
})();