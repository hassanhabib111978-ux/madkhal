-- Keep SECURITY DEFINER RPC execution to the reviewed, owner-scoped application
-- allowlist. All other privileged functions remain service-role-only.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- Public ESCO catalog functions are intentionally callable without an account.
GRANT EXECUTE ON FUNCTION
  public.get_madkhal_occupation_skills(text, integer),
  public.search_madkhal_occupations(text, integer),
  public.madkhal_occupation_has_live_opportunity(text),
  public.find_esco_occupations_by_skill(text, integer),
  public.find_esco_occupations_by_skills(text[], integer),
  public.find_esco_skill_matches(text, integer),
  public.get_occupation_evaluation_matrix(text),
  public.search_esco_occupations(text, integer)
TO anon;

DO $hardening$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname NOT IN (
        'advance_match_request',
        'apply_to_employer_vacancy',
        'calculate_external_opportunity_match',
        'create_subscription_payment_intent',
        'create_worker_match_notifications',
        'ensure_my_wallet',
        'get_madkhal_admin_metrics',
        'get_madkhal_occupation_skills',
        'get_my_madkhal_dashboard',
        'get_my_opportunity_recommendations',
        'get_my_subscription',
        'get_my_vacancy_candidates',
        'get_my_wallet',
        'get_my_worker_matches',
        'get_professional_evaluation_summary',
        'madkhal_occupation_has_live_opportunity',
        'process_my_employer_matches',
        'process_my_worker_matches',
        'record_external_job_application',
        'save_external_job_application',
        'search_madkhal_occupations',
        'submit_professional_evaluation',
        'update_external_job_application'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.signature);
  END LOOP;
END;
$hardening$;

-- Future SECURITY DEFINER functions created by the postgres migration role
-- require an explicit per-function grant instead of inheriting authenticated access.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

DO $verify$
DECLARE
  v_auth_definer_count integer;
  v_anon_definer_count integer;
BEGIN
  SELECT count(*) FILTER (
           WHERE p.prosecdef AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
         ),
         count(*) FILTER (
           WHERE p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')
         )
    INTO v_auth_definer_count, v_anon_definer_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public';

  IF v_auth_definer_count <> 23 THEN
    RAISE EXCEPTION 'unexpected_authenticated_security_definer_count: %', v_auth_definer_count;
  END IF;
  IF v_anon_definer_count <> 3 THEN
    RAISE EXCEPTION 'unexpected_anon_security_definer_count: %', v_anon_definer_count;
  END IF;
  IF has_function_privilege('authenticated', 'public.activate_worker_subscription_from_payment()', 'EXECUTE') THEN
    RAISE EXCEPTION 'payment_activation_rpc_must_not_be_client_callable';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_my_madkhal_dashboard()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_dashboard_rpc_missing';
  END IF;
  IF NOT has_function_privilege('anon', 'public.search_madkhal_occupations(text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'public_occupation_search_rpc_missing';
  END IF;
END;
$verify$;
