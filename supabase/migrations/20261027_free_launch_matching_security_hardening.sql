-- Snapshot migration generated from the verified live Madkhal database state on 2026-10-27.
-- Includes the free-launch matching gate, external-score safeguards, and table write restrictions.
CREATE OR REPLACE FUNCTION public.prevent_profile_admin_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Preserve legitimate role selection (for example, employer onboarding),
  -- while preventing a client from assigning itself the privileged admin role.
  IF lower(coalesce(NEW.role, '')) = 'admin' THEN
    IF lower(coalesce((
      SELECT p.role
      FROM public.profiles p
      WHERE p.id = NEW.id
        AND p.auth_user_id = auth.uid()
    ), '')) <> 'admin' THEN
      RAISE EXCEPTION 'admin_role_not_client_assignable';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.process_my_employer_matches(p_vacancy_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 100)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_profile uuid;
  r record;
  professional_score numeric;
  inserted_count integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
BEGIN
  IF v_auth IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  SELECT p.id INTO v_profile
  FROM public.profiles p
  WHERE p.auth_user_id = v_auth AND p.role = 'employer'
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_profile IS NULL THEN RAISE EXCEPTION 'employer_profile_required'; END IF;

  FOR r IN
    SELECT v.id AS vacancy_id, wp.id AS worker_profile_id
    FROM public.employer_vacancies v
    CROSS JOIN public.worker_profiles wp
    WHERE v.employer_id = v_profile
      AND v.status IN ('open', 'matching')
      AND v.confirmation_at IS NOT NULL
      AND (p_vacancy_id IS NULL OR v.id = p_vacancy_id)
      AND (v.expires_at IS NULL OR v.expires_at > now())
      AND wp.confirmation_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.match_requests mr
        WHERE mr.vacancy_id = v.id
          AND mr.worker_profile_id = wp.id
      )
    ORDER BY v.created_at DESC, wp.created_at DESC
    LIMIT v_limit
  LOOP
    PERFORM public.calculate_professional_match(r.vacancy_id, r.worker_profile_id);

    SELECT pms.overall_score INTO professional_score
    FROM public.professional_match_scores pms
    WHERE pms.vacancy_id = r.vacancy_id
      AND pms.worker_profile_id = r.worker_profile_id
      AND pms.scoring_version = 'v3'
    ORDER BY pms.updated_at DESC
    LIMIT 1;

    IF coalesce(professional_score, 0) >= 35 THEN
      INSERT INTO public.match_requests(
        vacancy_id, worker_profile_id, match_score, explainable_match_score,
        status, created_at, updated_at
      )
      VALUES (
        r.vacancy_id, r.worker_profile_id, professional_score, professional_score,
        'matched', now(), now()
      )
      ON CONFLICT(vacancy_id, worker_profile_id) DO NOTHING;
      IF found THEN inserted_count := inserted_count + 1; END IF;
    END IF;
  END LOOP;

  RETURN inserted_count;
END;
$function$

CREATE OR REPLACE FUNCTION public.calculate_external_opportunity_match(p_job_id uuid, p_worker_profile_id uuid)
 RETURNS opportunity_match_scores
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  j public.jobs%rowtype;
  w public.worker_profiles%rowtype;
  result public.opportunity_match_scores;
  worker_text text;
  opportunity_text text;
  worker_tokens text[];
  opp_tokens text[];
  matched text[] := '{}';
  missing text[] := '{}';
  token text;
  skill_score numeric := 0;
  occupation_score numeric := 0;
  professional_score numeric := 0;
  evidence_score numeric := 0;
  overall numeric := 0;
  eval_count integer := 0;
  hire_count integer := 0;
  avg_rating numeric;
  profile_occ text;
  qualification_text text;
  skills_text text;
  job_head text;
  teacher_profile boolean := false;
  teacher_job boolean := false;
  english_profile boolean := false;
  english_job boolean := false;
  teaching_skill boolean := false;
begin
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.worker_profiles wp
      WHERE wp.id=p_worker_profile_id AND wp.user_id=auth.uid()
    ) THEN
      RAISE EXCEPTION 'worker_profile_not_owned';
    END IF;
  ELSE
    IF coalesce(auth.role(),'') <> 'service_role'
       AND session_user NOT IN ('postgres','supabase_admin') THEN
      RAISE EXCEPTION 'authentication_required';
    END IF;
  END IF;

  select * into j from public.jobs where id = p_job_id;
  if not found then raise exception 'External job not found'; end if;

  select * into w from public.worker_profiles where id = p_worker_profile_id;
  if not found then raise exception 'Worker profile not found'; end if;

  profile_occ := lower(coalesce(nullif(w.occupation_label,''), nullif(w.profession,''), ''));
  qualification_text := lower(coalesce(w.qualification,''));
  skills_text := lower(coalesce(w.skills,''));
  job_head := lower(coalesce(j.title,'') || ' ' || coalesce(j.category,''));

  worker_text := lower(coalesce(nullif(w.occupation_label,''), nullif(w.profession,''),'') || ' ' || coalesce(w.skills,'') || ' ' || coalesce(w.qualification,''));
  opportunity_text := lower(coalesce(j.title,'') || ' ' || coalesce(j.category,'') || ' ' || coalesce(j.description,''));

  worker_tokens := regexp_split_to_array(regexp_replace(worker_text, '[^[:alnum:]؀-ۿ]+', ' ', 'g'), '[[:space:]]+');
  opp_tokens := regexp_split_to_array(regexp_replace(opportunity_text, '[^[:alnum:]؀-ۿ]+', ' ', 'g'), '[[:space:]]+');

  foreach token in array worker_tokens loop
    if length(token) >= 3 and token = any(opp_tokens) then
      matched := array_append(matched, token);
    end if;
  end loop;
  matched := array(select distinct x from unnest(matched) x order by x);

  if coalesce(array_length(worker_tokens,1),0) > 0 then
    skill_score := least(100, round(100.0 * coalesce(array_length(matched,1),0) / greatest(1, (select count(*) from unnest(worker_tokens) x where length(x)>=3)), 2));
  end if;

  teacher_profile := profile_occ ~ '(مدرس|معلم|تدريس|تعليم|teacher|teaching|instructor)';
  teacher_job := job_head ~ '(مدرس|معلم|تدريس|تعليم|teacher|teaching|instructor)';
  english_profile := profile_occ ~ '(انجليزي|إنجليزي|انكليزي|إنكليزي|اللغة الانجليزية|اللغة الإنجليزية|اللغة الانكليزية|اللغة الإنكليزية|english)'
                     or qualification_text ~ '(انجليزي|إنجليزي|انكليزي|إنكليزي|اللغة الانجليزية|اللغة الإنجليزية|اللغة الانكليزية|اللغة الإنكليزية|english)';
  english_job := job_head ~ '(انجليزي|إنجليزي|انكليزي|إنكليزي|اللغة الانجليزية|اللغة الإنجليزية|اللغة الانكليزية|اللغة الإنكليزية|english)';
  teaching_skill := skills_text ~ '(تدريس|التدريس|تعليم|التعليم|teacher|teaching|instructor)';

  if teacher_profile then
    if not teacher_job then
      occupation_score := 0;
    elsif profile_occ ~ '(أدب|ادب|literature)' and english_profile then
      if job_head ~ '(أدب|ادب|literature|عربي|العربية|لغة عربية|arabic)' or english_job then occupation_score := 90; end if;
    elsif profile_occ ~ '(أدب|ادب|literature)' then
      if job_head ~ '(أدب|ادب|literature|عربي|العربية|لغة عربية|arabic)' then occupation_score := 90; end if;
    elsif profile_occ ~ '(عربي|العربية|لغة عربية|arabic)' then
      if job_head ~ '(عربي|العربية|لغة عربية|arabic)' then occupation_score := 90; end if;
    elsif english_profile then
      if english_job then occupation_score := 90; end if;
    elsif profile_occ ~ '(رياضيات|math|mathematics)' then
      if job_head ~ '(رياضيات|math|mathematics)' then occupation_score := 90; end if;
    else
      occupation_score := 60;
    end if;

  elsif profile_occ ~ '(طبيب|طبيبه|طبيبة|دكتور|doctor|physician|medical|medicine)' then
    if job_head ~ '(طبيب|طبيبه|طبيبة|دكتور|doctor|physician|medical|medicine)' then occupation_score := 90; end if;

  elsif profile_occ ~ '(محاسب|محاسبة|accountant|accounting)' then
    if lower(coalesce(j.title,'')) ~ '(محاسب|محاسبة|accountant|accounting|bookkeeper|bookkeeping|accounts payable|accounts receivable|financial accountant|general ledger)' then
      occupation_score := 90;
    end if;

  elsif profile_occ ~ '(مهندس|مهندسة|engineer|engineering)' then
    if job_head ~ '(مهندس|مهندسة|engineer|engineering)' then
      occupation_score := 90;
      if profile_occ ~ '(مدني|civil)' and job_head !~ '(مدني|civil)' then occupation_score := 0; end if;
      if profile_occ ~ '(كهرباء|كهربائي|electrical)' and job_head !~ '(كهرباء|كهربائي|electrical)' then occupation_score := 0; end if;
      if profile_occ ~ '(بتروكيمي|petrochemical)' and job_head !~ '(بتروكيمي|petrochemical|chemical)' then occupation_score := 0; end if;
    end if;

  elsif profile_occ ~ '(تصوير|مصور|فوتوغرافي|فيديوغرافي|camera|photograph|photographer|cinematography|cinematographer|videograph|director of photography|film production)' then
    if lower(coalesce(j.title,'')) ~ '(مصور|فوتوغرافي|فوتوغرافية|فيديوغرافي|فيديو|كاميرا|سينمائي|photograph|photographer|cinematography|cinematographer|videograph|video production|video editor|camera operator|director of photography|film production|filmmaker)'
       and lower(coalesce(j.title,'')) !~ '(تصوير طبي|medical imaging|radiology|radiologic|radiologist|ultrasound|x-ray|mammograph)' then
      occupation_score := 95;
    end if;

  elsif profile_occ ~ '(تكنولوجيا المعلومات|تقنية المعلومات|إعداد أنظمة|أنظمة المعلومات|نظم المعلومات|الاتصالات|تغيير الإعدادات|ict|information technology|it systems|system administrator|network administrator)' then
    if lower(coalesce(j.title,'')) ~ '(تكنولوجيا المعلومات|تقنية المعلومات|نظم المعلومات|أنظمة المعلومات|information technology|it manager|system administrator|systems administrator|network administrator|networking|technical support|help desk|software|cybersecurity|cyber security|ict|telecom|telecommunications|شبكات|برمجيات|دعم فني|دعم تقني|مسؤول أنظمة|مدير تقنية|الاتصالات|تطوير الأنظمة|أنظمة الحاسوب|دعم نظم)' then
      occupation_score := 90;
    end if;

  elsif profile_occ ~ '(مدير|إدارة|ادارة|manager|management|director|مسؤول|موارد بشرية|human resources|hr)' then
    if job_head ~ '(مدير|إدارة|ادارة|manager|management|director|مسؤول|موارد بشرية|human resources|hr|operations|تشغيل|مبيعات|sales|أعمال|business)' then
      occupation_score := 65;
    end if;

  elsif profile_occ ~ '(سمسار|سمسرة|وساطة|وسيط|broker|brokerage)' then
    if job_head ~ '(سمسار|سمسرة|وساطة|وسيط|broker|brokerage|مبيعات|sales|عقارات|real estate)' then
      occupation_score := 65;
    end if;

  elsif length(profile_occ) >= 3 and position(profile_occ in job_head) > 0 then
    occupation_score := 100;

  elsif length(profile_occ) >= 3 then
    -- Unknown professions require meaningful token overlap; do not award a generic score.
    declare
      occ_tokens text[];
      occ_hits integer := 0;
    begin
      occ_tokens := regexp_split_to_array(regexp_replace(profile_occ, '[^[:alnum:]؀-ۿ]+', ' ', 'g'), '[[:space:]]+');
      select count(*) into occ_hits
      from unnest(occ_tokens) x
      where length(x) >= 4 and x = any(regexp_split_to_array(regexp_replace(job_head, '[^[:alnum:]؀-ۿ]+', ' ', 'g'), '[[:space:]]+'));
      if occ_hits >= 2 then occupation_score := 55;
      elsif occ_hits = 1 and array_length(occ_tokens,1)=1 then occupation_score := 45;
      else occupation_score := 0;
      end if;
    end;
  else
    occupation_score := 0;
  end if;

  if occupation_score > 0 and teacher_profile and teacher_job and teaching_skill then
    skill_score := greatest(skill_score, 70);
  end if;
  if occupation_score > 0 and teacher_profile and teacher_job and english_profile and english_job then
    skill_score := greatest(skill_score, 70);
  end if;

  -- Strong occupation-specific matches should not be hidden by sparse skill text.
  if occupation_score >= 90 and skill_score < 50 then
    skill_score := 50;
  end if;

  if occupation_score <= 0 then
    professional_score := 0; evidence_score := 0; overall := 0;
  else
    select count(*) filter(where pe.id is not null), count(*) filter(where mr.hired_at is not null), avg(pe.overall_rating)
      into eval_count, hire_count, avg_rating
    from public.worker_profiles wp
    left join public.profiles pr on pr.auth_user_id = wp.user_id
    left join public.professional_evaluations pe on pe.evaluatee_profile_id = pr.id
    left join public.match_requests mr on mr.id = pe.match_request_id
    where wp.id = p_worker_profile_id and (mr.hired_at is not null or mr.id is null);

    if hire_count > 0 and avg_rating is not null then
      professional_score := least(100, round(avg_rating * 20,2));
      evidence_score := least(100, hire_count * 20);
    else
      professional_score := 50;
      evidence_score := 50;
    end if;

    overall := round(skill_score*0.45 + occupation_score*0.25 + professional_score*0.20 + evidence_score*0.10,2);
  end if;

  select array_agg(x) into missing from (
    select distinct x from unnest(opp_tokens) x
    where length(x)>=4 and x <> all(matched)
    limit 20
  ) s;
  missing := coalesce(missing, '{}');

  insert into public.opportunity_match_scores(
    opportunity_type, opportunity_id, worker_profile_id,
    skill_match_score, occupation_match_score, professional_record_score, evidence_score, overall_score,
    matched_skills, missing_skills, evidence, scoring_version, generated_at, updated_at
  ) values (
    'external', p_job_id, p_worker_profile_id,
    skill_score, occupation_score, professional_score, evidence_score, overall,
    to_jsonb(matched), to_jsonb(missing),
    jsonb_build_object(
      'algorithm_revision', 'occupation-relevance-v5',
      'source', j.source,
      'job_status', j.status,
      'evaluation_count', eval_count,
      'completed_hire_count', hire_count,
      'average_verified_rating', avg_rating,
      'professional_record_policy', 'verified history contributes positively; no-history workers receive neutral 50/50 values',
      'scoring_basis', 'strict occupation gate; unrelated occupations do not receive a generic match score'
    ),
    'external-v3', now(), now()
  )
  on conflict(opportunity_type, opportunity_id, worker_profile_id, scoring_version)
  do update set
    skill_match_score=excluded.skill_match_score,
    occupation_match_score=excluded.occupation_match_score,
    professional_record_score=excluded.professional_record_score,
    evidence_score=excluded.evidence_score,
    overall_score=excluded.overall_score,
    matched_skills=excluded.matched_skills,
    missing_skills=excluded.missing_skills,
    evidence=excluded.evidence,
    updated_at=now()
  returning * into result;

  return result;
end;
$function$

CREATE OR REPLACE FUNCTION public.process_external_opportunity_matches(p_limit integer DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  r record;
  w record;
  n integer := 0;
  v_free_launch boolean := coalesce((SELECT lc.free_launch FROM public.madkhal_launch_config lc WHERE lc.id=true),false);
  v_limit integer := least(greatest(coalesce(p_limit,500),1),1000);
BEGIN
  FOR r IN
    SELECT j.id AS job_id,wp.id AS worker_profile_id
    FROM public.jobs j
    JOIN public.worker_profiles wp ON wp.confirmation_at IS NOT NULL
    LEFT JOIN public.profiles p ON p.auth_user_id=wp.user_id
    WHERE j.status='active'
      AND (j.expires_at IS NULL OR j.expires_at>=now())
      AND (
        j.geo_class IN ('MENA','SYRIA')
        OR j.geo_region IN ('middle_east','Middle East & North Africa','Syria')
        OR lower(coalesce(j.country,'')) IN (
          'syria','jordan','lebanon','palestine','iraq','qatar','oman',
          'saudi arabia','united arab emirates','uae','kuwait','bahrain',
          'yemen','egypt','sudan','libya','tunisia','algeria','morocco','mauritania',
          'سوريا','الأردن','الاردن','لبنان','فلسطين','العراق','قطر','عمان',
          'السعودية','السعوديه','الإمارات العربية المتحدة','الامارات العربية المتحدة',
          'الكويت','البحرين','اليمن','مصر','السودان','ليبيا','تونس','الجزائر','المغرب','موريتانيا'
        )
      )
      AND (
        v_free_launch
        OR EXISTS (
          SELECT 1 FROM public.subscriptions s
          WHERE (s.user_id=p.id OR s.user_id=wp.user_id)
            AND s.audience='worker' AND s.status='active'
            AND (s.ends_at IS NULL OR s.ends_at>=now())
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.opportunity_match_scores oms
        WHERE oms.opportunity_type='external'
          AND oms.opportunity_id=j.id
          AND oms.worker_profile_id=wp.id
          AND oms.scoring_version='external-v3'
          AND oms.evidence->>'algorithm_revision'='occupation-relevance-v5'
          AND oms.updated_at >= greatest(coalesce(j.updated_at,j.created_at),coalesce(wp.updated_at,wp.created_at))
      )
    ORDER BY coalesce(j.updated_at,j.created_at) DESC NULLS LAST, wp.updated_at DESC,
             j.id,wp.id
    LIMIT v_limit
  LOOP
    PERFORM public.calculate_external_opportunity_match(r.job_id,r.worker_profile_id);
    n:=n+1;
  END LOOP;
  RETURN n;
END;
$function$

CREATE OR REPLACE FUNCTION public.process_my_worker_matches(p_limit integer DEFAULT 100)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_auth uuid := (SELECT auth.uid());
  v_worker uuid;
  r record;
  existing_match public.match_requests%rowtype;
  professional_score numeric;
  processed_count integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit,100),1),1000);
  v_free_launch boolean := coalesce((SELECT lc.free_launch FROM public.madkhal_launch_config lc WHERE lc.id = true),false);
BEGIN
  IF v_auth IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  IF NOT v_free_launch AND NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.profiles pr ON pr.id=s.user_id
    WHERE pr.auth_user_id=v_auth
      AND s.audience='worker' AND s.plan='monthly' AND s.status='active'
      AND (s.ends_at IS NULL OR s.ends_at>now())
  ) THEN
    DELETE FROM public.notifications n
    WHERE n.user_id=v_auth AND n.opportunity_type='match_request';
    RETURN 0;
  END IF;

  SELECT wp.id INTO v_worker
  FROM public.worker_profiles wp
  WHERE wp.user_id=v_auth AND wp.confirmation_at IS NOT NULL
  ORDER BY wp.updated_at DESC
  LIMIT 1;

  IF v_worker IS NULL THEN RAISE EXCEPTION 'worker_profile_required'; END IF;

  UPDATE public.match_requests mr
  SET status='closed',updated_at=now()
  FROM public.employer_vacancies ev
  WHERE mr.id IN (
    SELECT x.id
    FROM public.match_requests x
    JOIN public.employer_vacancies vx ON vx.id=x.vacancy_id
    WHERE x.worker_profile_id=v_worker AND x.status='matched'
      AND (vx.status NOT IN ('open','matching') OR vx.confirmation_at IS NULL OR (vx.expires_at IS NOT NULL AND vx.expires_at<=now()))
  )
  AND mr.vacancy_id=ev.id;

  FOR r IN
    SELECT v.id AS vacancy_id
    FROM public.employer_vacancies v
    WHERE v.status IN ('open','matching') AND v.confirmation_at IS NOT NULL
      AND (v.expires_at IS NULL OR v.expires_at>now())
    ORDER BY v.created_at DESC
    LIMIT v_limit
  LOOP
    PERFORM public.calculate_professional_match(r.vacancy_id,v_worker);

    SELECT pms.overall_score INTO professional_score
    FROM public.professional_match_scores pms
    WHERE pms.vacancy_id=r.vacancy_id AND pms.worker_profile_id=v_worker AND pms.scoring_version='v3'
    ORDER BY pms.updated_at DESC
    LIMIT 1;

    SELECT * INTO existing_match
    FROM public.match_requests mr
    WHERE mr.vacancy_id=r.vacancy_id AND mr.worker_profile_id=v_worker
    ORDER BY mr.created_at DESC
    LIMIT 1;

    IF existing_match.id IS NULL THEN
      IF coalesce(professional_score,0)>=35 THEN
        INSERT INTO public.match_requests(vacancy_id,worker_profile_id,match_score,explainable_match_score,status,created_at,updated_at)
        VALUES(r.vacancy_id,v_worker,professional_score,professional_score,'matched',now(),now())
        ON CONFLICT(vacancy_id,worker_profile_id) DO NOTHING;
        IF found THEN processed_count:=processed_count+1; END IF;
      END IF;
    ELSIF existing_match.status='matched' THEN
      IF coalesce(professional_score,0)>=35 THEN
        UPDATE public.match_requests
        SET match_score=professional_score,explainable_match_score=professional_score,updated_at=now()
        WHERE id=existing_match.id;
        processed_count:=processed_count+1;
      ELSE
        UPDATE public.match_requests
        SET status='closed',match_score=coalesce(professional_score,0),explainable_match_score=coalesce(professional_score,0),updated_at=now()
        WHERE id=existing_match.id;
        DELETE FROM public.notifications n
        WHERE n.user_id=v_auth AND n.opportunity_type='match_request' AND n.opportunity_id=existing_match.id;
        processed_count:=processed_count+1;
      END IF;
    ELSIF existing_match.status NOT IN ('declined','closed','hired') THEN
      UPDATE public.match_requests
      SET match_score=coalesce(professional_score,match_score),explainable_match_score=coalesce(professional_score,explainable_match_score),updated_at=now()
      WHERE id=existing_match.id;
      processed_count:=processed_count+1;
    END IF;
  END LOOP;

  DELETE FROM public.notifications n
  WHERE n.user_id=v_auth AND n.opportunity_type='match_request'
    AND NOT EXISTS (
      SELECT 1 FROM public.match_requests mr
      WHERE mr.id=n.opportunity_id AND mr.worker_profile_id=v_worker AND mr.status='matched'
    );
  RETURN processed_count;
END;
$function$

CREATE OR REPLACE FUNCTION public.create_worker_match_notifications(p_limit integer DEFAULT 50)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  r record;
  n integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit,50),1),200);
  v_free_launch boolean := coalesce((SELECT lc.free_launch FROM public.madkhal_launch_config lc WHERE lc.id = true),false);
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  IF NOT v_free_launch AND NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.profiles p ON p.id=s.user_id
    WHERE p.auth_user_id=(SELECT auth.uid())
      AND s.audience='worker' AND s.plan='monthly' AND s.status='active'
      AND (s.ends_at IS NULL OR s.ends_at>now())
  ) THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT mr.id,mr.vacancy_id,wp.user_id,ev.title,ev.company_name,mr.match_score
    FROM public.match_requests mr
    JOIN public.worker_profiles wp ON wp.id=mr.worker_profile_id
    JOIN public.employer_vacancies ev ON ev.id=mr.vacancy_id
    WHERE wp.user_id=(SELECT auth.uid()) AND mr.status='matched'
    ORDER BY mr.updated_at DESC
    LIMIT v_limit
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications x
      WHERE x.user_id=r.user_id AND x.opportunity_type='match_request' AND x.opportunity_id=r.id
    ) THEN
      INSERT INTO public.notifications(user_id,job_id,channel,title,body,opportunity_type,opportunity_id,delivery_status,created_at)
      VALUES(r.user_id,NULL,'in_app','🎯 فرصة مناسبة لك',
        coalesce(r.title,'فرصة عمل')||' لدى '||coalesce(r.company_name,'جهة عمل')||' — مطابقة '||round(coalesce(r.match_score,0))||'%. افتح قسم المطابقات لمراجعة الفرصة.',
        'match_request',r.id,'pending',now());
      n:=n+1;
    END IF;
  END LOOP;
  RETURN n;
END;
$function$

CREATE OR REPLACE FUNCTION public.get_my_opportunity_recommendations(p_limit integer DEFAULT 20)
 RETURNS TABLE(opportunity_id uuid, opportunity_type text, title text, organization text, location text, country text, job_type text, category text, source_url text, canonical_url text, posted_at timestamp with time zone, expires_at timestamp with time zone, overall_score numeric, skill_match_score numeric, occupation_match_score numeric, professional_record_score numeric, evidence_score numeric, matched_skills jsonb, missing_skills jsonb, evidence jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT r.opportunity_id,r.opportunity_type,r.title,r.organization,r.location,
         r.country,r.job_type,r.category,r.source_url,r.canonical_url,r.posted_at,
         r.expires_at,r.overall_score,r.skill_match_score,r.occupation_match_score,
         r.professional_record_score,r.evidence_score,r.matched_skills,
         r.missing_skills,r.evidence
  FROM public.worker_opportunity_recommendations r
  JOIN public.worker_profiles wp ON wp.id=r.worker_profile_id
  LEFT JOIN public.profiles p ON p.auth_user_id=wp.user_id
  WHERE wp.user_id=auth.uid()
    AND auth.uid() IS NOT NULL
    AND r.status='active'
    AND r.scoring_version='external-v3'
    AND (r.expires_at IS NULL OR r.expires_at>=now())
    AND (
      coalesce((SELECT lc.free_launch FROM public.madkhal_launch_config lc WHERE lc.id=true),false)
      OR EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.user_id=p.id AND s.audience='worker' AND s.status='active'
          AND (s.ends_at IS NULL OR s.ends_at>=now())
      )
    )
  ORDER BY r.overall_score DESC,r.posted_at DESC NULLS LAST,r.opportunity_id
  LIMIT greatest(1,least(coalesce(p_limit,20),100));
$function$

CREATE OR REPLACE FUNCTION public.process_madkhal_matches(p_limit integer DEFAULT 200)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r record;
  legacy_score numeric;
  professional_score numeric;
  composite_score numeric;
  inserted_count integer := 0;
  v_free_launch boolean := coalesce((SELECT lc.free_launch FROM public.madkhal_launch_config lc WHERE lc.id=true),false);
  v_limit integer := least(greatest(coalesce(p_limit,200),1),1000);
BEGIN
  FOR r IN
    SELECT v.id AS vacancy_id,wp.id AS worker_profile_id
    FROM public.employer_vacancies v
    CROSS JOIN public.worker_profiles wp
    LEFT JOIN public.profiles p ON p.auth_user_id=wp.user_id
    WHERE v.status='open'
      AND v.confirmation_at IS NOT NULL
      AND (v.expires_at IS NULL OR v.expires_at>now())
      AND wp.confirmation_at IS NOT NULL
      AND (
        v_free_launch
        OR EXISTS (
          SELECT 1 FROM public.subscriptions s
          WHERE s.user_id=p.id AND s.audience='worker' AND s.status='active'
            AND (s.ends_at IS NULL OR s.ends_at>=now())
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.match_requests mr
        WHERE mr.vacancy_id=v.id AND mr.worker_profile_id=wp.id
      )
    ORDER BY v.created_at DESC,wp.created_at DESC
    LIMIT v_limit
  LOOP
    legacy_score:=public.calculate_worker_vacancy_match_score(r.worker_profile_id,r.vacancy_id);
    IF coalesce(legacy_score,0)>=35 THEN
      PERFORM public.calculate_professional_match(r.vacancy_id,r.worker_profile_id);
      SELECT overall_score INTO professional_score
      FROM public.professional_match_scores
      WHERE vacancy_id=r.vacancy_id AND worker_profile_id=r.worker_profile_id AND scoring_version='v3'
      ORDER BY updated_at DESC LIMIT 1;
      IF coalesce(professional_score,0)>=35 THEN
        composite_score:=round(legacy_score*0.75+professional_score*0.25,2);
        INSERT INTO public.match_requests(vacancy_id,worker_profile_id,match_score,explainable_match_score,status,created_at,updated_at)
        VALUES(r.vacancy_id,r.worker_profile_id,composite_score,professional_score,'matched',now(),now())
        ON CONFLICT(vacancy_id,worker_profile_id) DO NOTHING;
        IF found THEN inserted_count:=inserted_count+1; END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN inserted_count;
END;
$function$

CREATE OR REPLACE FUNCTION public.generate_job_match_notifications(p_limit integer DEFAULT 100)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.notifications(
    user_id,job_id,channel,sent_at,title,body,opportunity_type,
    opportunity_id,delivery_status,created_at
  )
  SELECT wp.user_id,
         CASE WHEN r.opportunity_type='external' THEN r.opportunity_id ELSE NULL END,
         'in_app',now(),'فرصة عمل مناسبة لك',
         coalesce(r.title,'فرصة عمل جديدة') || ' — تطابق مهني ' || round(r.overall_score,0)::text || '%',
         r.opportunity_type,r.opportunity_id,'pending',now()
  FROM public.worker_opportunity_recommendations r
  JOIN public.worker_profiles wp ON wp.id=r.worker_profile_id
  LEFT JOIN public.profiles p ON p.auth_user_id=wp.user_id
  WHERE coalesce((SELECT np.enabled FROM public.notification_preferences np WHERE np.user_id=wp.user_id),true)
    AND coalesce((SELECT np.job_matches FROM public.notification_preferences np WHERE np.user_id=wp.user_id),true)
    AND (
      coalesce((SELECT lc.free_launch FROM public.madkhal_launch_config lc WHERE lc.id=true),false)
      OR EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.user_id=p.id AND s.audience='worker' AND s.status='active'
          AND (s.ends_at IS NULL OR s.ends_at>=now())
      )
    )
    AND r.status='active'
    AND (r.expires_at IS NULL OR r.expires_at>=now())
    AND r.recommendation_rank<=10
    AND r.overall_score>=60
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id=wp.user_id
        AND n.opportunity_type=r.opportunity_type
        AND n.opportunity_id=r.opportunity_id
        AND n.channel='in_app'
    )
  ORDER BY r.overall_score DESC
  LIMIT least(greatest(coalesce(p_limit,100),1),500)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$function$


REVOKE ALL PRIVILEGES ON TABLE public.match_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.match_requests TO authenticated;
DROP POLICY IF EXISTS match_requests_employer_insert ON public.match_requests;
DROP POLICY IF EXISTS match_requests_employer_update ON public.match_requests;
DROP POLICY IF EXISTS match_requests_worker_update ON public.match_requests;

REVOKE ALL PRIVILEGES ON TABLE public.professional_evaluations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.professional_evaluations TO authenticated;
DROP POLICY IF EXISTS professional_evaluations_party_insert ON public.professional_evaluations;
DROP POLICY IF EXISTS professional_evaluations_party_update ON public.professional_evaluations;

REVOKE EXECUTE ON FUNCTION public.prevent_profile_admin_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_external_opportunity_match(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_external_opportunity_match(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.process_external_opportunity_matches(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_madkhal_matches(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_job_match_notifications(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_my_worker_matches(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_my_worker_matches(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_worker_match_notifications(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_worker_match_notifications(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_opportunity_recommendations(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_opportunity_recommendations(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.process_my_employer_matches(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_my_employer_matches(uuid, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_worker_vacancy_match_score(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_worker_vacancy_match_score(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.sync_madkhal_application_from_match_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_match_request_into_madkhal_application() FROM PUBLIC, anon, authenticated;
