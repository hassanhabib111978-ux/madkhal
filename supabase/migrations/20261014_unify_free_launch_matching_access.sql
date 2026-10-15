-- Reconcile matching and alert gates with the platform's explicit launch flag.
-- Prioritize unscored active jobs for confirmed workers, then rotate by oldest scoring time.
-- Historical jobs, applications, and match requests are preserved; obsolete current-alert rows may be pruned.
-- Setting madkhal_launch_config.free_launch=false restores monthly plan requirements.
-- Centralize the existing free-launch policy without exposing the config to public clients.
CREATE OR REPLACE FUNCTION public.madkhal_free_launch_enabled()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT COALESCE((SELECT c.free_launch FROM public.madkhal_launch_config AS c WHERE c.id IS TRUE LIMIT 1), FALSE);
$function$;
REVOKE ALL ON FUNCTION public.madkhal_free_launch_enabled() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.madkhal_worker_matching_access()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT (SELECT auth.uid()) IS NOT NULL
    AND (
      public.madkhal_free_launch_enabled()
      OR EXISTS (
        SELECT 1 FROM public.subscriptions AS s
        JOIN public.profiles AS p ON p.id=s.user_id
        WHERE p.auth_user_id=(SELECT auth.uid())
          AND s.audience='worker' AND s.plan='monthly' AND s.status='active'
          AND (s.ends_at IS NULL OR s.ends_at>now())
      )
    );
$function$;
REVOKE ALL ON FUNCTION public.madkhal_worker_matching_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.madkhal_worker_matching_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_worker_match_notifications(p_limit integer DEFAULT 50)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
  n integer:=0;
  v_limit integer:=least(greatest(coalesce(p_limit,50),1),200);
begin
  if (select auth.uid()) is null then raise exception 'auth_required'; end if;
  if not public.madkhal_worker_matching_access() then return 0; end if;
  for r in
    select mr.id,mr.vacancy_id,wp.user_id,ev.title,ev.company_name,mr.match_score
    from public.match_requests mr
    join public.worker_profiles wp on wp.id=mr.worker_profile_id
    join public.employer_vacancies ev on ev.id=mr.vacancy_id
    where wp.user_id=(select auth.uid())
      and mr.status='matched'
      and ev.status IN ('open','matching')
      and ev.confirmation_at IS NOT NULL
      and (ev.expires_at IS NULL OR ev.expires_at>now())
    order by mr.updated_at desc limit v_limit
  loop
    if not exists(select 1 from public.notifications x where x.user_id=r.user_id and x.opportunity_type='match_request' and x.opportunity_id=r.id) then
      insert into public.notifications(user_id,job_id,channel,title,body,opportunity_type,opportunity_id,delivery_status,created_at)
      values(r.user_id,null,'in_app','🎯 فرصة مناسبة لك',
             coalesce(r.title,'فرصة عمل')||' لدى '||coalesce(r.company_name,'جهة عمل')||' — مطابقة '||round(coalesce(r.match_score,0))||'%. افتح قسم المطابقات لمراجعة الفرصة.',
             'match_request',r.id,'pending',now());
      n:=n+1;
    end if;
  end loop;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_job_match_notifications(p_limit integer DEFAULT 100)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer:=0;
begin
  insert into public.notifications(
    user_id,job_id,channel,sent_at,title,body,opportunity_type,
    opportunity_id,delivery_status,created_at
  )
  select wp.user_id,
         case when r.opportunity_type='external' then r.opportunity_id else null end,
         'in_app',now(),'فرصة عمل مناسبة لك',
         coalesce(r.title,'فرصة عمل جديدة') || ' — تطابق مهني ' ||
         round(r.overall_score,0)::text || '%',
         r.opportunity_type,r.opportunity_id,'pending',now()
  from public.worker_opportunity_recommendations r
  join public.worker_profiles wp on wp.id=r.worker_profile_id
  join public.profiles p on p.auth_user_id=wp.user_id
  where coalesce((select np.enabled from public.notification_preferences np
                  where np.user_id=wp.user_id),true)
    and coalesce((select np.job_matches from public.notification_preferences np
                  where np.user_id=wp.user_id),true)
    and (
      public.madkhal_free_launch_enabled()
      OR EXISTS (
        SELECT 1 FROM public.subscriptions AS s
         WHERE s.user_id=p.id AND s.audience='worker'
           AND s.plan='monthly' AND s.status='active'
           AND (s.ends_at IS NULL OR s.ends_at>=now())
      )
    )
    and r.status='active'
    and (r.expires_at is null or r.expires_at>=now())
    and r.recommendation_rank<=10
    and r.overall_score>=60
    and (
      r.opportunity_type <> 'external'
      OR EXISTS (
        SELECT 1 FROM public.jobs AS j
        WHERE j.id=r.opportunity_id AND j.status='active'
          AND (j.expires_at IS NULL OR j.expires_at>=now())
      )
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id=wp.user_id
        and n.opportunity_type=r.opportunity_type
        and n.opportunity_id=r.opportunity_id
        and n.channel='in_app'
    )
  order by r.overall_score desc
  limit greatest(coalesce(p_limit,100),1)
  on conflict do nothing;

  get diagnostics v_count=row_count;
  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_opportunity_recommendations(p_limit integer DEFAULT 20)
 RETURNS TABLE(opportunity_id uuid, opportunity_type text, title text, organization text, location text, country text, job_type text, category text, source_url text, canonical_url text, posted_at timestamp with time zone, expires_at timestamp with time zone, overall_score numeric, skill_match_score numeric, occupation_match_score numeric, professional_record_score numeric, evidence_score numeric, matched_skills jsonb, missing_skills jsonb, evidence jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select r.opportunity_id,r.opportunity_type,r.title,r.organization,r.location,
         r.country,r.job_type,r.category,r.source_url,r.canonical_url,r.posted_at,
         r.expires_at,r.overall_score,r.skill_match_score,r.occupation_match_score,
         r.professional_record_score,r.evidence_score,r.matched_skills,
         r.missing_skills,r.evidence
  from public.worker_opportunity_recommendations r
  join public.worker_profiles wp on wp.id=r.worker_profile_id
  join public.profiles p on p.auth_user_id=wp.user_id
  where wp.user_id=auth.uid()
    and auth.uid() is not null
    and r.status='active'
    and r.scoring_version='external-v3'
    and (r.expires_at is null or r.expires_at>=now())
    and public.madkhal_worker_matching_access()
  order by r.overall_score desc,r.posted_at desc nulls last,r.opportunity_id
  limit greatest(1,least(coalesce(p_limit,20),100));
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_worker_matches()
 RETURNS TABLE(request_id uuid, vacancy_id uuid, title text, company_name text, location text, country text, job_type text, match_score numeric, status text, employer_note text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null then raise exception 'auth_required'; end if;
 return query
 select mr.id,mr.vacancy_id,ev.title,ev.company_name,ev.location,ev.country,ev.job_type,mr.match_score,mr.status,mr.employer_note,mr.created_at,mr.updated_at
 from public.match_requests mr join public.employer_vacancies ev on ev.id=mr.vacancy_id join public.worker_profiles wp on wp.id=mr.worker_profile_id
 where wp.user_id=auth.uid()
   and auth.uid() is not null
   and public.madkhal_worker_matching_access()
   and ev.status in ('open','matching')
   and ev.confirmation_at is not null
   and (ev.expires_at is null or ev.expires_at>now())
 order by mr.updated_at desc nulls last,mr.created_at desc;
end $function$
;

CREATE OR REPLACE FUNCTION public.process_external_opportunity_matches(p_limit integer DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  w record;
  n integer := 0;
begin
  -- Avoid scanning job batches when no worker currently has matching access.
  IF NOT public.madkhal_free_launch_enabled()
     AND NOT EXISTS (
       SELECT 1
         FROM public.worker_profiles AS wp
         JOIN public.profiles AS p ON p.auth_user_id=wp.user_id
        WHERE wp.confirmation_at IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.subscriptions AS sub
             WHERE (sub.user_id=p.id OR sub.user_id=wp.user_id)
               AND sub.audience='worker' AND sub.plan='monthly' AND sub.status='active'
               AND (sub.ends_at IS NULL OR sub.ends_at>=now())
          )
     ) THEN
    RETURN 0;
  END IF;
  for r in
    select j.id
    from public.jobs j
    where j.status='active'
      and (j.expires_at is null or j.expires_at>=now())
      and (
        j.geo_class in ('MENA','SYRIA')
        or j.geo_region in ('middle_east','Middle East & North Africa','Syria')
        or lower(coalesce(j.country,'')) in (
          'syria','jordan','lebanon','palestine','iraq','qatar','oman',
          'saudi arabia','united arab emirates','uae','kuwait','bahrain',
          'yemen','egypt','sudan','libya','tunisia','algeria','morocco','mauritania',
          'سوريا','الأردن','الاردن','لبنان','فلسطين','العراق','قطر','عمان',
          'السعودية','السعوديه','الإمارات العربية المتحدة','الامارات العربية المتحدة',
          'الكويت','البحرين','اليمن','مصر','السودان','ليبيا','تونس','الجزائر','المغرب','موريتانيا'
        )
      )
    ORDER BY
      EXISTS (
        SELECT 1
          FROM public.worker_profiles AS pending_wp
          JOIN public.profiles AS pending_p ON pending_p.auth_user_id=pending_wp.user_id
         WHERE pending_wp.confirmation_at IS NOT NULL
           AND (
             public.madkhal_free_launch_enabled()
             OR EXISTS (
               SELECT 1 FROM public.subscriptions AS pending_sub
                WHERE (pending_sub.user_id=pending_p.id OR pending_sub.user_id=pending_wp.user_id)
                  AND pending_sub.audience='worker' AND pending_sub.plan='monthly' AND pending_sub.status='active'
                  AND (pending_sub.ends_at IS NULL OR pending_sub.ends_at>=now())
             )
           )
           AND NOT EXISTS (
             SELECT 1 FROM public.opportunity_match_scores AS oms
              WHERE oms.opportunity_type='external'
                AND oms.opportunity_id=j.id
                AND oms.worker_profile_id=pending_wp.id
                AND oms.scoring_version='external-v3'
           )
      ) DESC,
      (
        SELECT min(oms.updated_at)
          FROM public.opportunity_match_scores AS oms
          JOIN public.worker_profiles AS scored_wp ON scored_wp.id=oms.worker_profile_id
          JOIN public.profiles AS scored_p ON scored_p.auth_user_id=scored_wp.user_id
         WHERE oms.opportunity_type='external'
           AND oms.opportunity_id=j.id
           AND oms.scoring_version='external-v3'
           AND scored_wp.confirmation_at IS NOT NULL
           AND (
             public.madkhal_free_launch_enabled()
             OR EXISTS (
               SELECT 1 FROM public.subscriptions AS scored_sub
                WHERE (scored_sub.user_id=scored_p.id OR scored_sub.user_id=scored_wp.user_id)
                  AND scored_sub.audience='worker' AND scored_sub.plan='monthly' AND scored_sub.status='active'
                  AND (scored_sub.ends_at IS NULL OR scored_sub.ends_at>=now())
             )
           )
      ) ASC NULLS FIRST,
      coalesce(j.updated_at,j.created_at) DESC NULLS LAST
    limit greatest(1,p_limit)
  loop
    for w in
      select wp.id
      from public.worker_profiles wp
      join public.profiles p on p.auth_user_id=wp.user_id
      where wp.confirmation_at is not null
        and (
          public.madkhal_free_launch_enabled()
          OR EXISTS (
            SELECT 1 FROM public.subscriptions AS s
             WHERE (s.user_id=p.id OR s.user_id=wp.user_id)
               AND s.audience='worker' AND s.plan='monthly' AND s.status='active'
               AND (s.ends_at IS NULL OR s.ends_at>=now())
          )
        )
    loop
      perform public.calculate_external_opportunity_match(r.id,w.id);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_madkhal_matches(p_limit integer DEFAULT 200)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r record;
  legacy_score numeric;
  professional_score numeric;
  composite_score numeric;
  inserted_count integer:=0;
begin
  for r in
    select v.id vacancy_id,wp.id worker_profile_id
    from public.employer_vacancies v
    cross join public.worker_profiles wp
    join public.profiles p on p.auth_user_id=wp.user_id
    where v.status='open'
      and v.confirmation_at is not null
      and (v.expires_at is null or v.expires_at>now())
      and wp.confirmation_at is not null
      and (
        public.madkhal_free_launch_enabled()
        OR EXISTS (
          SELECT 1 FROM public.subscriptions AS s
           WHERE s.user_id=p.id AND s.audience='worker'
             AND s.plan='monthly' AND s.status='active'
             AND (s.ends_at IS NULL OR s.ends_at>=now())
        )
      )
      and not exists (
        select 1 from public.match_requests mr
        where mr.vacancy_id=v.id and mr.worker_profile_id=wp.id
      )
    order by v.created_at desc,wp.created_at desc
    limit greatest(coalesce(p_limit,200),1)
  loop
    legacy_score:=public.calculate_worker_vacancy_match_score(r.worker_profile_id,r.vacancy_id);
    if coalesce(legacy_score,0)>=35 then
      perform public.calculate_professional_match(r.vacancy_id,r.worker_profile_id);
      select overall_score into professional_score
      from public.professional_match_scores
      where vacancy_id=r.vacancy_id
        and worker_profile_id=r.worker_profile_id
        and scoring_version='v3'
      order by updated_at desc limit 1;
      if coalesce(professional_score,0)>=35 then
        composite_score:=round(legacy_score*0.75+professional_score*0.25,2);
        insert into public.match_requests(
          vacancy_id,worker_profile_id,match_score,explainable_match_score,status,created_at,updated_at
        )
        values(r.vacancy_id,r.worker_profile_id,composite_score,professional_score,'matched',now(),now())
        on conflict(vacancy_id,worker_profile_id) do nothing;
        if found then inserted_count:=inserted_count+1; end if;
      end if;
    end if;
  end loop;
  return inserted_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_my_worker_matches(p_limit integer DEFAULT 100)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_auth uuid := (select auth.uid());
  v_worker uuid;
  r record;
  existing_match public.match_requests%rowtype;
  professional_score numeric;
  processed_count integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit,100),1),1000);
begin
  if v_auth is null then raise exception 'authentication_required'; end if;
  if not public.madkhal_worker_matching_access() then
    -- Keep prior alerts as history; current matches stay hidden by the read RPC gate.
    return 0;
  end if;
  select wp.id into v_worker from public.worker_profiles wp
  where wp.user_id=v_auth and wp.confirmation_at is not null
  order by wp.updated_at desc limit 1;
  if v_worker is null then raise exception 'worker_profile_required'; end if;
  update public.match_requests mr set status='closed',updated_at=now()
  from public.employer_vacancies ev
  where mr.id in (
    select x.id from public.match_requests x join public.employer_vacancies vx on vx.id=x.vacancy_id
    where x.worker_profile_id=v_worker and x.status='matched'
      and (vx.status not in ('open','matching') or vx.confirmation_at is null or (vx.expires_at is not null and vx.expires_at<=now()))
  ) and mr.vacancy_id=ev.id;
  for r in
    select v.id as vacancy_id from public.employer_vacancies v
    where v.status in ('open','matching') and v.confirmation_at is not null and (v.expires_at is null or v.expires_at>now())
    order by v.created_at desc limit v_limit
  loop
    perform public.calculate_professional_match(r.vacancy_id,v_worker);
    select pms.overall_score into professional_score from public.professional_match_scores pms
    where pms.vacancy_id=r.vacancy_id and pms.worker_profile_id=v_worker and pms.scoring_version='v3'
    order by pms.updated_at desc limit 1;
    select * into existing_match from public.match_requests mr
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
        update public.match_requests set match_score=professional_score,explainable_match_score=professional_score,updated_at=now()
        where id=existing_match.id;
        processed_count:=processed_count+1;
      else
        update public.match_requests set status='closed',match_score=coalesce(professional_score,0),explainable_match_score=coalesce(professional_score,0),updated_at=now()
        where id=existing_match.id;
        delete from public.notifications n where n.user_id=v_auth and n.opportunity_type='match_request' and n.opportunity_id=existing_match.id;
        processed_count:=processed_count+1;
      end if;
    elsif existing_match.status not in ('declined','closed','hired') then
      update public.match_requests set match_score=coalesce(professional_score,match_score),explainable_match_score=coalesce(professional_score,explainable_match_score),updated_at=now()
      where id=existing_match.id;
      processed_count:=processed_count+1;
    end if;
  end loop;
  delete from public.notifications n where n.user_id=v_auth and n.opportunity_type='match_request'
    and not exists(select 1 from public.match_requests mr where mr.id=n.opportunity_id and mr.worker_profile_id=v_worker and mr.status='matched');
  return processed_count;
end;
$function$
;
