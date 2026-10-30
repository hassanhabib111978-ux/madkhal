-- Parse GulfJobs Atom/RSS fields as text values rather than storing XML element markup.
-- Suppress only clear promotional/scam content; ordinary housemaid and other job posts remain eligible.
DO $migration$
DECLARE
  v_definition text;
  rec record;
  v_old_filter text := $old$
    FROM parsed
    WHERE source_job_id ~ '^[0-9]+$'
  ),
$old$;
  v_new_filter text := $new$
    FROM parsed
    WHERE source_job_id ~ '^[0-9]+$'
      AND lower(coalesce(title,'') || ' ' || coalesce(description,'')) !~
        '(occult|money ritual|lottery luck prayers|lottery.*prayer|spiritual guidance.*lottery|i want to join occult|many have seek for wealth|doubtful of the true source|مكتب تأجير شغالات|مكتب تاجير شغالات|مكتب شغالات بالشهر|مكتب شغلات بالشهر|شغالات بالشهر|شغلات بالشهر|تأجير شغالات بالشهر)'
  ),
$new$;
BEGIN
  SELECT pg_get_functiondef('public.import_one_gulfjobs_request()'::regprocedure)
    INTO v_definition;

  FOR rec IN
    SELECT * FROM (VALUES
      (
        $old$'//*[local-name()="item"][' || n || ']/*[local-name()="title"]'$old$,
        $new$'string(//*[local-name()="item"][' || n || ']/*[local-name()="title"])'$new$
      ),
      (
        $old$'//*[local-name()="item"][' || n || ']/*[local-name()="description"]'$old$,
        $new$'string(//*[local-name()="item"][' || n || ']/*[local-name()="description"])'$new$
      ),
      (
        $old$'//*[local-name()="item"][' || n || ']/*[local-name()="country"]'$old$,
        $new$'string(//*[local-name()="item"][' || n || ']/*[local-name()="country"])'$new$
      ),
      (
        $old$'//*[local-name()="item"][' || n || ']/*[local-name()="city"]'$old$,
        $new$'string(//*[local-name()="item"][' || n || ']/*[local-name()="city"])'$new$
      ),
      (
        $old$'//*[local-name()="item"][' || n || ']/*[local-name()="industry"]'$old$,
        $new$'string(//*[local-name()="item"][' || n || ']/*[local-name()="industry"])'$new$
      ),
      (
        $old$'//*[local-name()="item"][' || n || ']/*[local-name()="job_type"]'$old$,
        $new$'string(//*[local-name()="item"][' || n || ']/*[local-name()="job_type"])'$new$
      ),
      (
        $old$'//*[local-name()="item"][' || n || ']/*[local-name()="salary_from"]'$old$,
        $new$'string(//*[local-name()="item"][' || n || ']/*[local-name()="salary_from"])'$new$
      ),
      (
        $old$'//*[local-name()="item"][' || n || ']/*[local-name()="salary_to"]'$old$,
        $new$'string(//*[local-name()="item"][' || n || ']/*[local-name()="salary_to"])'$new$
      ),
      (
        $old$'//*[local-name()="item"][' || n || ']/*[local-name()="salary_currency"]'$old$,
        $new$'string(//*[local-name()="item"][' || n || ']/*[local-name()="salary_currency"])'$new$
      )
    ) AS patches(old_expr,new_expr)
  LOOP
    IF position(rec.old_expr IN v_definition)=0 THEN
      RAISE EXCEPTION 'gulfjobs_text_extraction_anchor_missing: %', rec.old_expr;
    END IF;
    v_definition := replace(v_definition,rec.old_expr,rec.new_expr);
  END LOOP;

  IF position(v_old_filter IN v_definition)=0 THEN
    RAISE EXCEPTION 'gulfjobs_spam_filter_anchor_missing';
  END IF;
  v_definition := replace(v_definition,v_old_filter,v_new_filter);
  EXECUTE v_definition;
END;
$migration$;

-- Keep historical rows for audit, but remove known non-job promotional content from public listings.
UPDATE public.jobs
SET status='inactive',updated_at=now()
WHERE source='gulfjobs'
  AND status='active'
  AND lower(coalesce(title,'')) ~
    '(occult|money ritual|lottery luck prayers|lottery.*prayer|spiritual guidance.*lottery|i want to join occult|many have seek for wealth|doubtful of the true source|مكتب تأجير شغالات|مكتب تاجير شغالات|مكتب شغالات بالشهر|مكتب شغلات بالشهر|شغالات بالشهر|شغلات بالشهر|تأجير شغالات بالشهر)';

DO $verify$
DECLARE
  v_body text;
BEGIN
  SELECT p.prosrc INTO v_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='import_one_gulfjobs_request';

  IF v_body IS NULL
     OR position('string(//*[local-name()="item"]' in v_body)=0
     OR position('occult' in v_body)=0
     OR position('مكتب تأجير شغالات' in v_body)=0
     OR position('مكتب شغلات بالشهر' in v_body)=0 THEN
    RAISE EXCEPTION 'gulfjobs_feed_sanitization_not_installed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.jobs
    WHERE source='gulfjobs' AND status='active'
      AND lower(coalesce(title,'')) ~
        '(occult|money ritual|lottery luck prayers|lottery.*prayer|spiritual guidance.*lottery|i want to join occult|many have seek for wealth|doubtful of the true source|مكتب تأجير شغالات|مكتب تاجير شغالات|مكتب شغالات بالشهر|مكتب شغلات بالشهر|شغالات بالشهر|شغلات بالشهر|تأجير شغالات بالشهر)'
  ) THEN
    RAISE EXCEPTION 'known_gulfjobs_promotional_records_still_active';
  END IF;
END;
$verify$;
