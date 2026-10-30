-- Remove unauthenticated read grants from user-scoped and internal Madkhal data.
-- Anonymous Supabase Auth users receive the authenticated database role, so existing
-- anonymous-session users continue to use their own RLS-protected rows and RPCs.

-- User-scoped tables: keep authenticated ownership policies; remove pre-auth anon grant.
REVOKE SELECT ON TABLE
  public.madkhal_applications,
  public.notification_preferences,
  public.opportunity_match_scores,
  public.worker_skill_assessments,
  public.wallets
FROM anon;

-- Match evidence is consumed by SECURITY DEFINER workflows and owner-scoped RPCs,
-- not by direct client table/view reads.
REVOKE SELECT ON TABLE public.professional_match_scores FROM anon, authenticated;
REVOKE SELECT ON TABLE public.professional_match_results FROM anon, authenticated;
REVOKE SELECT ON TABLE public.worker_opportunity_recommendations FROM anon, authenticated;

-- User-specific views remain available only to authenticated clients and continue
-- to be filtered by their security_invoker underlying RLS / auth.uid() predicates.
REVOKE SELECT ON TABLE
  public.external_opportunity_match_results,
  public.professional_record_summary,
  public.worker_subscription_status,
  public.opportunities_unified
FROM anon;

-- Source registry and investor metrics are operational/admin data, not client APIs.
REVOKE SELECT ON TABLE public.madkhal_source_registry FROM anon, authenticated;
REVOKE SELECT ON TABLE public.madkhal_investor_metrics FROM anon, authenticated;

-- Preserve intentional public ESCO catalog access and active, unexpired job discovery.
DO $verify$
BEGIN
  IF NOT has_table_privilege('anon', 'public.jobs', 'SELECT') THEN
    RAISE EXCEPTION 'public_job_discovery_grant_missing';
  END IF;
  IF NOT has_table_privilege('anon', 'public.esco_occupation_picker', 'SELECT') THEN
    RAISE EXCEPTION 'public_occupation_catalog_grant_missing';
  END IF;
  IF has_table_privilege('anon', 'public.madkhal_investor_metrics', 'SELECT') THEN
    RAISE EXCEPTION 'investor_metrics_still_exposed_to_anon';
  END IF;
  IF has_table_privilege('authenticated', 'public.madkhal_investor_metrics', 'SELECT') THEN
    RAISE EXCEPTION 'investor_metrics_still_exposed_to_authenticated';
  END IF;
  IF has_table_privilege('anon', 'public.worker_opportunity_recommendations', 'SELECT') THEN
    RAISE EXCEPTION 'worker_recommendations_still_exposed_to_anon';
  END IF;
  IF has_table_privilege('authenticated', 'public.worker_opportunity_recommendations', 'SELECT') THEN
    RAISE EXCEPTION 'worker_recommendations_still_exposed_to_authenticated';
  END IF;
  IF has_table_privilege('anon', 'public.worker_subscription_status', 'SELECT') THEN
    RAISE EXCEPTION 'worker_subscription_view_still_exposed_to_anon';
  END IF;
END;
$verify$;
