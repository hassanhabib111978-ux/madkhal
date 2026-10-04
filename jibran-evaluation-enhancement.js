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
  // المطابقة المهنية ليست وظيفة محلية في جبران. المصدر الرسمي هو مسار مَدخَل الموحد في Supabase.\n  // نحافظ هنا فقط على عرض سياق التقييم، ولا نعيد تعريف matchScore أو askJibranUser.\n  window.renderJibranContext=async function(){\n    const p=profile(), el=document.getElementById("jibranContext");\n    if(!el)return;\n    if(!p.full_name){\n      el.innerHTML="<h3>السياق الحالي</h3><p>لا يوجد ملف محفوظ بعد. أكمل الملف أولًا حتى يستطيع جبران ربط تقييمك بالمسار الرسمي.</p>";\n      return;\n    }\n    const a=calculateAutomaticAssessment(p);\n    let official=null;\n    try{\n      if(typeof window.loadCanonicalWorkerMatchData==="function") official=await window.loadCanonicalWorkerMatchData(p);\n    }catch(e){console.warn("jibran official match context",e)}\n    const direct=official?.directMatches||[];\n    const publicMatches=official?.publicMatches||[];\n    let matchHtml="لا توجد مطابقة مهنية جديدة حاليًا.";\n    if(direct.length){\n      matchHtml="أقرب مطابقة مباشرة: <strong>"+escapeHtml(direct[0].title||"فرصة مباشرة")+"</strong> — "+Math.round(Number(direct[0].match_score)||0)+"%";\n    }else if(publicMatches.length){\n      matchHtml="أقرب فرصة منشورة: <strong>"+escapeHtml(publicMatches[0].j?.title||"فرصة منشورة")+"</strong> — "+Math.round(Number(publicMatches[0].s)||0)+"%";\n    }\n    el.innerHTML="<h3>السياق الحالي</h3><p><strong>"+escapeHtml(p.full_name)+"</strong> · "+escapeHtml(p.occupation_label||p.profession||"مهنة غير محددة")+" · 📍 "+escapeHtml(p.location||"غير محدد")+"</p>"+\n      "<div class='notice'>📊 التقييم المهني الحالي: <strong>"+escapeHtml(a.score)+" / 100</strong> — "+escapeHtml(a.level)+"</div>"+\n      "<div class='notice'>🎯 "+matchHtml+"</div>";\n  };\n\n  window.renderAutomaticAssessment=function(result){
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