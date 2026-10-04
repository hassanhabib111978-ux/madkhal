-- Madkhal internal application v4: canonical professional score

create or replace function public.apply_to_employer_vacancy(p_vacancy_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_auth uuid := auth.uid();
  v_worker uuid;
  v_employer uuid;
  v_score numeric := 0;
  v_request uuid;
begin
  if v_auth is null then
    raise exception 'authentication_required';
  end if;

  select wp.id into v_worker
  from public.worker_profiles wp
  where wp.user_id=v_auth
  order by wp.updated_at desc
  limit 1;

  if v_worker is null then
    raise exception 'worker_profile_required';
  end if;

  select ev.employer_id into v_employer
  from public.employer_vacancies ev
  where ev.id=p_vacancy_id
    and ev.status='open'
    and (ev.expires_at is null or ev.expires_at>now())
  for update;

  if v_employer is null then
    raise exception 'vacancy_not_open';
  end if;

  if exists(
    select 1
    from public.match_requests mr
    where mr.vacancy_id=p_vacancy_id
      and mr.worker_profile_id=v_worker
      and mr.status not in ('declined','closed')
  ) then
    select mr.id into v_request
    from public.match_requests mr
    where mr.vacancy_id=p_vacancy_id
      and mr.worker_profile_id=v_worker
    order by mr.created_at desc
    limit 1;
    return v_request;
  end if;

  perform public.calculate_professional_match(p_vacancy_id,v_worker);

  select pms.overall_score into v_score
  from public.professional_match_scores pms
  where pms.vacancy_id=p_vacancy_id
    and pms.worker_profile_id=v_worker
    and pms.scoring_version='v3'
  order by pms.updated_at desc
  limit 1;

  insert into public.match_requests(
    vacancy_id,
    worker_profile_id,
    match_score,
    explainable_match_score,
    status,
    created_at,
    updated_at
  )
  values(
    p_vacancy_id,
    v_worker,
    coalesce(v_score,0),
    coalesce(v_score,0),
    'worker_pending',
    now(),
    now()
  )
  returning id into v_request;

  insert into public.notifications(
    user_id,title,body,opportunity_type,opportunity_id,sent_at,created_at,delivery_status
  )
  select p.auth_user_id,
         'طلب تقديم جديد',
         'يوجد باحث عن عمل تقدم على فرصتك.',
         'employer_vacancy',
         p_vacancy_id,
         now(),
         now(),
         'pending'
  from public.profiles p
  where p.id=v_employer
    and p.auth_user_id is not null;

  return v_request;
end;
$function$;