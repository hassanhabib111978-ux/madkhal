-- Madkhal unified external matching guardrails
-- 2026-10-04
-- Reversible by restoring the previous definitions from Git history.

create or replace function public.get_my_opportunity_recommendations(p_limit integer default 20)
returns table(
  opportunity_id uuid, opportunity_type text, title text, organization text, location text, country text,
  job_type text, category text, source_url text, canonical_url text, posted_at timestamptz,
  expires_at timestamptz, overall_score numeric, skill_match_score numeric, occupation_match_score numeric,
  professional_record_score numeric, evidence_score numeric, matched_skills jsonb, missing_skills jsonb, evidence jsonb
)
language sql stable security definer
set search_path to 'public','pg_temp'
as $function$
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
    and exists (
      select 1 from public.subscriptions s
      where s.user_id=p.id
        and s.audience='worker'
        and s.status='active'
        and (s.ends_at is null or s.ends_at>=now())
    )
  order by r.overall_score desc,r.posted_at desc nulls last,r.opportunity_id
  limit greatest(1,least(coalesce(p_limit,20),100));
$function$;

create or replace function public.generate_job_match_notifications(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    and exists (
      select 1 from public.subscriptions s
      where s.user_id=p.id
        and s.audience='worker'
        and s.status='active'
        and (s.ends_at is null or s.ends_at>=now())
    )
    and r.status='active'
    and r.scoring_version='external-v3'
    and (r.expires_at is null or r.expires_at>=now())
    and r.recommendation_rank<=10
    and r.overall_score>=60
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
$function$;