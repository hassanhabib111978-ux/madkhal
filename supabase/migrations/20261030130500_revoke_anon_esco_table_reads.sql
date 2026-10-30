-- ESCO occupation and skill catalogs are consumed through bounded RPCs.
-- The underlying tables have no anon RLS policy; direct table grants were redundant.
REVOKE SELECT ON TABLE
  public.esco_occupations,
  public.esco_skills,
  public.esco_occupation_skill_relations,
  public.esco_occupation_picker
FROM anon;

DO $verify$
BEGIN
  IF has_table_privilege('anon', 'public.jobs', 'SELECT') IS NOT TRUE THEN
    RAISE EXCEPTION 'public_job_discovery_grant_missing';
  END IF;
  IF has_table_privilege('anon', 'public.esco_occupations', 'SELECT')
     OR has_table_privilege('anon', 'public.esco_skills', 'SELECT')
     OR has_table_privilege('anon', 'public.esco_occupation_skill_relations', 'SELECT')
     OR has_table_privilege('anon', 'public.esco_occupation_picker', 'SELECT') THEN
    RAISE EXCEPTION 'direct_esco_catalog_read_still_granted_to_anon';
  END IF;
  IF NOT has_function_privilege('anon', 'public.search_madkhal_occupations(text,integer)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.get_madkhal_occupation_skills(text,integer)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.madkhal_occupation_has_live_opportunity(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'bounded_public_esco_catalog_rpcs_missing';
  END IF;
END;
$verify$;
