-- Madkhal score consistency: refresh both score fields after evaluation/request changes

create or replace function public.refresh_professional_match_from_evaluation()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  r record;
  v_score numeric;
begin
  for r in
    select mr.id,mr.vacancy_id,mr.worker_profile_id
    from public.match_requests mr
    where mr.id=new.match_request_id
  loop
    perform public.calculate_professional_match(r.vacancy_id,r.worker_profile_id);

    select pms.overall_score into v_score
    from public.professional_match_scores pms
    where pms.vacancy_id=r.vacancy_id
      and pms.worker_profile_id=r.worker_profile_id
      and pms.scoring_version='v3'
    order by pms.updated_at desc
    limit 1;

    update public.match_requests
    set match_score=coalesce(v_score,match_score),
        explainable_match_score=coalesce(v_score,explainable_match_score),
        updated_at=now()
    where id=r.id;
  end loop;
  return new;
end;
$function$;

create or replace function public.refresh_professional_match_from_request()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_score numeric;
begin
  perform public.calculate_professional_match(new.vacancy_id,new.worker_profile_id);

  select pms.overall_score into v_score
  from public.professional_match_scores pms
  where pms.vacancy_id=new.vacancy_id
    and pms.worker_profile_id=new.worker_profile_id
    and pms.scoring_version='v3'
  order by pms.updated_at desc
  limit 1;

  update public.match_requests
  set match_score=coalesce(v_score,match_score),
      explainable_match_score=coalesce(v_score,explainable_match_score),
      updated_at=now()
  where id=new.id;

  return new;
end;
$function$;

-- Correct only currently active derived match scores where a current v3 score exists.
-- Historical application scores and job-source data are untouched.
with latest_v3 as (
  select distinct on (vacancy_id,worker_profile_id)
    vacancy_id,
    worker_profile_id,
    overall_score
  from public.professional_match_scores
  where scoring_version='v3'
  order by vacancy_id,worker_profile_id,updated_at desc
)
update public.match_requests mr
set match_score=lv3.overall_score,
    explainable_match_score=lv3.overall_score,
    updated_at=now()
from latest_v3 lv3
where lv3.vacancy_id=mr.vacancy_id
  and lv3.worker_profile_id=mr.worker_profile_id
  and mr.status in ('matched','employer_interested','accepted','contact_opened','interview','offer')
  and abs(coalesce(mr.match_score,0)-lv3.overall_score)>0.01;