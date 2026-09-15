/* MADKHAL_ASSESSMENT_BUTTON_FIX_V1 */
(function(){
  "use strict";

  function handle(e){
    const t=e.target&&e.target.closest
      ? e.target.closest('button.option[onclick="openAssessmentScreen()"]')
      : null;
    if(!t)return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const target=Array.from(document.querySelectorAll(".screen")).find(function(x){
      return x.id==="assessmentSection";
    });
    if(!target)return;

    document.querySelectorAll(".screen").forEach(function(x){
      x.classList.remove("active");
      x.style.display="none";
    });

    target.style.display="block";
    target.classList.add("active");

    const intro=target.querySelector("#assessmentIntro")||document.getElementById("assessmentIntro");
    if(intro)intro.classList.remove("hidden");
  }

  document.addEventListener("click",handle,true);
})();
