-- Madkhal internal matching v4: one canonical score
-- Keep legacy score function available for audit/backward compatibility,
-- but do not combine it with professional v3 for active match_requests.

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
  professional_score numeric;
  inserted_count integer := 0;
begin
  if v_auth is null then
    raise exception 'authentication_required';
  end if;

  select wp.id into v_worker
  from public.worker_profiles wp
  where wp.user_id = v_auth
    and wp.confirmation_at is not null
  order by wp.updated_at desc
  limit 1;

  if v_worker is null then
    raise exception 'worker_profile_required';
  end if;

  for r in
    select v.id as vacancy_id
    from public.employer_vacancies v
    where v.status in ('open','matching')
      and v.confirmation_at is not null
      and (v.expires_at is null or v.expires_at > now())
      and not exists (
        select 1
        from public.match_requests mr
        where mr.vacancy_id = v.id
          and mr.worker_profile_id = v_worker
      )
    order by v.created_at desc
    limit greatest(coalesce(p_limit,100),1)
  loop
    perform public.calculate_professional_match(r.vacancy_id, v_worker);

    select pms.overall_score
      into professional_score
    from public.professional_match_scores pms
    where pms.vacancy_id = r.vacancy_id
      and pms.worker_profile_id = v_worker
      and pms.scoring_version = 'v3'
    order by pms.updated_at desc
    limit 1;

    if coalesce(professional_score,0) >= 35 then
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
        r.vacancy_id,
        v_worker,
        professional_score,
        professional_score,
        'matched',
        now(),
        now()
      )
      on conflict(vacancy_id,worker_profile_id) do nothing;

      if found then
        inserted_count := inserted_count + 1;
      end if;
    end if;
  end loop;

  return inserted_count;
end;
$function$;

create or replace function public.process_my_employer_matches(
  p_vacancy_id uuid default null,
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_auth uuid := auth.uid();
  v_profile uuid;
  r record;
  professional_score numeric;
  inserted_count integer := 0;
begin
  if v_auth is null then
    raise exception 'authentication_required';
  end if;

  select p.id into v_profile
  from public.profiles p
  where p.auth_user_id = v_auth
    and p.role = 'employer'
  order by p.created_at asc
  limit 1;

  if v_profile is null then
    raise exception 'employer_profile_required';
  end if;

  for r in
    select v.id as vacancy_id, wp.id as worker_profile_id
    from public.employer_vacancies v
    cross join public.worker_profiles wp
    where v.employer_id = v_profile
      and v.status in ('open','matching')
      and v.confirmation_at is not null
      and (p_vacancy_id is null or v.id = p_vacancy_id)
      and (v.expires_at is null or v.expires_at > now())
      and wp.confirmation_at is not null
      and not exists (
        select 1
        from public.match_requests mr
        where mr.vacancy_id = v.id
          and mr.worker_profile_id = wp.id
      )
    order by v.created_at desc, wp.created_at desc
    limit greatest(coalesce(p_limit,100),1)
  loop
    perform public.calculate_professional_match(r.vacancy_id, r.worker_profile_id);

    select pms.overall_score
      into professional_score
    from public.professional_match_scores pms
    where pms.vacancy_id = r.vacancy_id
      and pms.worker_profile_id = r.worker_profile_id
      and pms.scoring_version = 'v3'
    order by pms.updated_at desc
    limit 1;

    if coalesce(professional_score,0) >= 35 then
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
        r.vacancy_id,
        r.worker_profile_id,
        professional_score,
        professional_score,
        'matched',
        now(),
        now()
      )
      on conflict(vacancy_id,worker_profile_id) do nothing;

      if found then
        inserted_count := inserted_count + 1;
      end if;
    end if;
  end loop;

  return inserted_count;
end;
$function$;
