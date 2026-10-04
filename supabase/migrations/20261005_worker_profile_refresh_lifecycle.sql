-- Madkhal worker profile refresh v6: invalidate stale active matches

create or replace function public.process_my_worker_matches(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_auth uuid := auth.uid();
  v_worker uuid;
  r record;
  existing_match public.match_requests%rowtype;
  professional_score numeric;
  processed_count integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit,100),1),1000);
begin
  if v_auth is null then raise exception 'authentication_required'; end if;

  select wp.id into v_worker
  from public.worker_profiles wp
  where wp.user_id=v_auth and wp.confirmation_at is not null
  order by wp.updated_at desc limit 1;
  if v_worker is null then raise exception 'worker_profile_required'; end if;

  update public.match_requests mr
  set status='closed', updated_at=now()
  from public.employer_vacancies ev
  where mr.id in (
    select x.id
    from public.match_requests x
    join public.employer_vacancies vx on vx.id=x.vacancy_id
    where x.worker_profile_id=v_worker and x.status='matched'
      and (vx.status not in ('open','matching') or vx.confirmation_at is null
           or (vx.expires_at is not null and vx.expires_at<=now()))
  ) and mr.vacancy_id=ev.id;

  for r in
    select v.id as vacancy_id
    from public.employer_vacancies v
    where v.status in ('open','matching') and v.confirmation_at is not null
      and (v.expires_at is null or v.expires_at>now())
    order by v.created_at desc limit v_limit
  loop
    perform public.calculate_professional_match(r.vacancy_id,v_worker);
    select pms.overall_score into professional_score
    from public.professional_match_scores pms
    where pms.vacancy_id=r.vacancy_id and pms.worker_profile_id=v_worker
      and pms.scoring_version='v3'
    order by pms.updated_at desc limit 1;

    select * into existing_match
    from public.match_requests mr
    where mr.vacancy_id=r.vacancy_id and mr.worker_profile_id=v_worker
    order by mr.created_at desc limit 1;

    if existing_match.id is null then
      if coalesce(professional_score,0)>=35 then
        insert into public.match_requests(vacancy_id,worker_profile_id,match_score,explainable_match_score,status,created_at,updated_at)
        values(r.vacancy_id,v_worker,professional_score,professional_score,'matched',now(),now())
        on conflict(vacancy_id,worker_profile_id) do nothing;
        if found then processed_count:=processed_count+1; end if;
      end if;
    elsif existing_match.status='matched' then
      if coalesce(professional_score,0)>=35 then
        update public.match_requests set match_score=professional_score,
          explainable_match_score=professional_score,updated_at=now() where id=existing_match.id;
        processed_count:=processed_count+1;
      else
        update public.match_requests set status='closed',match_score=coalesce(professional_score,0),
          explainable_match_score=coalesce(professional_score,0),updated_at=now() where id=existing_match.id;
        delete from public.notifications n where n.user_id=v_auth
          and n.opportunity_type='match_request' and n.opportunity_id=existing_match.id;
        processed_count:=processed_count+1;
      end if;
    elsif existing_match.status not in ('declined','closed','hired') then
      update public.match_requests set match_score=coalesce(professional_score,match_score),
        explainable_match_score=coalesce(professional_score,explainable_match_score),updated_at=now()
        where id=existing_match.id;
      processed_count:=processed_count+1;
    end if;
  end loop;

  delete from public.notifications n
  where n.user_id=v_auth and n.opportunity_type='match_request'
    and not exists (
      select 1 from public.match_requests mr
      where mr.id=n.opportunity_id and mr.worker_profile_id=v_worker and mr.status='matched'
    );

  return processed_count;
end;
$function$;