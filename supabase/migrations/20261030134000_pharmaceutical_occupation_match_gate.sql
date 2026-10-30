-- A pharmaceutical engineer/pharmacy profile must not match every generic engineer
-- role. Require an explicit pharmacy/pharmaceutical signal in the job title itself;
-- source categories can contain polluted XML and must not establish specialty.
DO $migration$
DECLARE
  v_definition text;
  v_old text := $old$
  elsif profile_occ ~ '(مهندس|مهندسة|engineer|engineering)' then
$old$;
  v_new text := $new$
  elsif profile_occ ~ '(صيدلاني|صيدلانية|صيدلة|pharmaceutical|pharmacist|pharmacy)'
     OR qualification_text ~ '(صيدلة|pharmacy|pharmaceutical)'
     OR skills_text ~ '(صناعة الادوية|صناعة الأدوية|تصنيع الادوية|تصنيع الأدوية|drug manufacturing|pharmaceutical manufacturing)' then
    -- A relevant occupation must be stated in the job title, not only its category.
    IF lower(coalesce(j.title,'')) ~
       '(صيدلاني|صيدلانية|صيدلة|pharmaceutical|pharma|pharmacist|pharmacy|drug manufacturing|drug production|medicine manufacturing|medicines production|pharmacovigilance|pharmaceutical production|pharmaceutical manufacturing|pharmaceutical quality|pharmaceutical sales|drug safety|medicinal products|formulation scientist|formulation engineer)' THEN
      occupation_score := 90;
    END IF;

  elsif profile_occ ~ '(مهندس|مهندسة|engineer|engineering)' then
$new$;
  v_old_revision text := $old$'algorithm_revision', 'occupation-relevance-v5'$old$;
  v_new_revision text := $new$'algorithm_revision', 'occupation-relevance-v6-pharmaceutical-specialty-gate'$new$;
  v_old_batch text := $old$AND oms.evidence->>'algorithm_revision'='occupation-relevance-v5'$old$;
  v_new_batch text := $new$AND oms.evidence->>'algorithm_revision'='occupation-relevance-v6-pharmaceutical-specialty-gate'$new$;
BEGIN
  SELECT pg_get_functiondef('public.calculate_external_opportunity_match(uuid,uuid)'::regprocedure)
    INTO v_definition;

  IF position(v_old IN v_definition)=0 THEN
    RAISE EXCEPTION 'external_match_engineer_branch_anchor_not_found';
  END IF;
  IF position(v_old_revision IN v_definition)=0 THEN
    RAISE EXCEPTION 'external_match_engineer_revision_anchor_not_found';
  END IF;

  v_definition := replace(v_definition,v_old,v_new);
  v_definition := replace(v_definition,v_old_revision,v_new_revision);
  EXECUTE v_definition;

  -- The scheduled batch runner used to skip rows already scored with v5.
  -- Move its freshness marker so existing rows are safely recalculated in batches.
  SELECT pg_get_functiondef('public.process_external_opportunity_matches(integer)'::regprocedure)
    INTO v_definition;

  IF position(v_old_batch IN v_definition)=0 THEN
    RAISE EXCEPTION 'external_match_batch_revision_anchor_not_found';
  END IF;

  v_definition := replace(v_definition,v_old_batch,v_new_batch);
  EXECUTE v_definition;
END;
$migration$;

DO $verify$
DECLARE
  v_calculator text;
  v_batch text;
BEGIN
  SELECT p.prosrc INTO v_calculator
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='calculate_external_opportunity_match';

  SELECT p.prosrc INTO v_batch
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='process_external_opportunity_matches';

  IF v_calculator IS NULL
     OR position('pharmaceutical specialty' in lower(v_calculator))=0
     OR position('occupation-relevance-v6-pharmaceutical-specialty-gate' in v_calculator)=0 THEN
    RAISE EXCEPTION 'pharmaceutical_occupation_gate_not_installed';
  END IF;
  IF v_batch IS NULL
     OR position('occupation-relevance-v6-pharmaceutical-specialty-gate' in v_batch)=0
     OR position('occupation-relevance-v5' in v_batch)>0 THEN
    RAISE EXCEPTION 'external_match_batch_recalculation_marker_not_updated';
  END IF;
END;
$verify$;
