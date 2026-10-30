-- Reduce the unauthenticated SQL role to the small public discovery surface.
-- Anonymous Supabase Auth sessions use the authenticated role, so their own
-- owner-scoped policies and authenticated RPCs remain available.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- Public discovery: current jobs and the ESCO occupation/skill reference catalog.
GRANT SELECT ON TABLE
  public.jobs,
  public.esco_occupations,
  public.esco_skills,
  public.esco_occupation_skill_relations,
  public.esco_occupation_picker
TO anon;

-- Public catalog RPCs return only ESCO labels/skills or a coarse occupation
-- availability boolean. Personal matching and account functions stay authenticated.
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

-- Preserve the existing authenticated app RPC surface and service-role jobs.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Migration-created objects are owned by postgres. Do not reintroduce broad
-- anon grants on future tables, sequences, or functions created by that role.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $verify$
BEGIN
  IF NOT has_table_privilege('anon', 'public.jobs', 'SELECT') THEN
    RAISE EXCEPTION 'public_job_discovery_grant_missing';
  END IF;
  IF NOT has_table_privilege('anon', 'public.esco_occupation_picker', 'SELECT') THEN
    RAISE EXCEPTION 'public_esco_catalog_grant_missing';
  END IF;
  IF has_table_privilege('anon', 'public.customers_v2', 'SELECT')
     OR has_table_privilege('anon', 'public.madkhal_applications', 'INSERT')
     OR has_table_privilege('anon', 'public.madkhal_source_registry', 'UPDATE') THEN
    RAISE EXCEPTION 'unneeded_anon_table_privilege_remains';
  END IF;
  IF has_function_privilege('anon', 'public.calculate_professional_match(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'private_match_rpc_still_callable_by_anon';
  END IF;
  IF NOT has_function_privilege('anon', 'public.search_esco_occupations(text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'public_esco_search_rpc_missing';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_my_madkhal_dashboard()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated_dashboard_rpc_missing';
  END IF;
END;
$verify$;
