-- Madkhal external matching v3 guardrail
-- Prevent unrelated occupations from receiving positive matches.

create or replace function public.calculate_external_opportunity_match(p_job_id uuid, p_worker_profile_id uuid)
returns public.opportunity_match_scores
language plpgsql
set search_path to 'public'
as $function$
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
    skill_score := least(100, round(100.0 * coalesce(array_length(matched,1),0) /
      greatest(1, (select count(*) from unnest(worker_tokens) x where length(x)>=3)), 2));
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
    if job_head ~ '(طبيب|طبيبه|طبيبة|دكتور|doctor|physician|medical|medicine)' then occupation_score := 70; end if;

  elsif profile_occ ~ '(محاسب|محاسبة|accountant|accounting)' then
    if job_head ~ '(محاسب|محاسبة|accountant|accounting)' then occupation_score := 70; end if;

  elsif profile_occ ~ '(مهندس|مهندسة|engineer|engineering)' then
    if job_head ~ '(مهندس|مهندسة|engineer|engineering)' then
      occupation_score := 70;
      if profile_occ ~ '(مدني|civil)' and job_head !~ '(مدني|civil)' then occupation_score := 0; end if;
      if profile_occ ~ '(كهرباء|كهربائي|electrical)' and job_head !~ '(كهرباء|كهربائي|electrical)' then occupation_score := 0; end if;
      if profile_occ ~ '(بتروكيمي|petrochemical)' and job_head !~ '(بتروكيمي|petrochemical|chemical)' then occupation_score := 0; end if;
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
    declare
      occ_tokens text[];
      occ_hits integer := 0;
    begin
      occ_tokens := regexp_split_to_array(regexp_replace(profile_occ, '[^[:alnum:]؀-ۿ]+', ' ', 'g'), '[[:space:]]+');
      select count(*) into occ_hits
      from unnest(occ_tokens) x
      where length(x) >= 4
        and x = any(regexp_split_to_array(regexp_replace(job_head, '[^[:alnum:]؀-ۿ]+', ' ', 'g'), '[[:space:]]+'));
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

  if occupation_score <= 0 then
    professional_score := 0; evidence_score := 0; overall := 0;
  else
    select count(*) filter(where pe.id is not null),
           count(*) filter(where mr.hired_at is not null),
           avg(pe.overall_rating)
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
$function$;