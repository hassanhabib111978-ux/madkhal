-- Synchronize Tamara's public Greenhouse Job Board feed.
-- Only reconcile old rows after a complete, non-empty, validated public feed has been received.

CREATE OR REPLACE FUNCTION public.fetch_tamara_feed()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'net'
AS $function$
DECLARE
  v_request_id bigint;
BEGIN
  SELECT net.http_get('https://boards-api.greenhouse.io/v1/boards/tamara/jobs?content=true') INTO v_request_id;
  IF v_request_id IS NULL THEN RAISE EXCEPTION 'tamara_feed_request_not_created'; END IF;
  INSERT INTO public.madkhal_external_feed_requests(source, request_id) VALUES ('tamara', v_request_id);
  RETURN v_request_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.import_tamara_feed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'net'
AS $function$
DECLARE
  q record;
  j jsonb;
  v_feed jsonb;
  v_expected_count integer;
  v_array_count integer;
  v_valid_count integer;
  v_unique_count integer;
  v_imported integer := 0;
  v_feed_ids text[];
  v_job_id text;
  v_title text;
  v_url text;
  v_location text;
  v_country text;
  v_category text;
  v_posted_at timestamptz;
  v_deadline timestamptz;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('madkhal.tamara-greenhouse-import', 0));
  FOR q IN
    SELECT r.id, h.status_code, h.content, h.error_msg
    FROM public.madkhal_external_feed_requests r
    LEFT JOIN net._http_response h ON h.id = r.request_id
    WHERE r.source = 'tamara' AND r.status = 'pending'
    ORDER BY r.created_at, r.id
    LIMIT 5
  LOOP
    IF q.status_code IS NULL THEN CONTINUE; END IF;
    IF q.status_code <> 200 OR q.content IS NULL THEN
      UPDATE public.madkhal_external_feed_requests
      SET status = 'failed', processed_at = now(),
          error = left(coalesce(q.error_msg, 'Greenhouse HTTP status ' || q.status_code::text), 500)
      WHERE id = q.id;
      CONTINUE;
    END IF;
    BEGIN
      v_feed := q.content::jsonb;
    EXCEPTION WHEN others THEN
      UPDATE public.madkhal_external_feed_requests
      SET status = 'failed', processed_at = now(), error = 'Greenhouse response was not valid JSON'
      WHERE id = q.id;
      CONTINUE;
    END;
    IF jsonb_typeof(v_feed->'jobs') IS DISTINCT FROM 'array' THEN
      UPDATE public.madkhal_external_feed_requests
      SET status = 'failed', processed_at = now(), error = 'Greenhouse response did not contain a jobs array'
      WHERE id = q.id;
      CONTINUE;
    END IF;
    v_expected_count := NULLIF(v_feed->'meta'->>'total', '')::integer;
    SELECT count(*),
           count(*) FILTER (WHERE nullif(trim(value->>'id'), '') IS NOT NULL
                              AND nullif(trim(value->>'title'), '') IS NOT NULL
                              AND nullif(trim(value->>'absolute_url'), '') IS NOT NULL),
           count(DISTINCT nullif(trim(value->>'id'), ''))
      INTO v_array_count, v_valid_count, v_unique_count
    FROM jsonb_array_elements(v_feed->'jobs') AS feed_item(value);
    IF v_expected_count IS NULL OR v_expected_count <= 0
       OR v_array_count <> v_expected_count
       OR v_valid_count <> v_expected_count
       OR v_unique_count <> v_expected_count THEN
      UPDATE public.madkhal_external_feed_requests
      SET status = 'failed', processed_at = now(),
          error = 'Greenhouse feed was incomplete or contained invalid/duplicate job records'
      WHERE id = q.id;
      CONTINUE;
    END IF;
    v_feed_ids := ARRAY[]::text[];
    FOR j IN SELECT value FROM jsonb_array_elements(v_feed->'jobs') AS feed_item(value)
    LOOP
      v_job_id := trim(j->>'id');
      v_title := trim(j->>'title');
      v_url := trim(j->>'absolute_url');
      v_location := nullif(trim(j->'location'->>'name'), '');
      v_country := CASE
        WHEN v_location ILIKE '%united arab emirates%' THEN 'United Arab Emirates'
        WHEN v_location ILIKE '%saudi arabia%' THEN 'Saudi Arabia'
        WHEN v_location ILIKE '%egypt%' THEN 'Egypt'
        WHEN v_location ILIKE '%jordan%' THEN 'Jordan'
        WHEN v_location ILIKE '%kuwait%' THEN 'Kuwait'
        WHEN v_location ILIKE '%qatar%' THEN 'Qatar'
        WHEN v_location ILIKE '%bahrain%' THEN 'Bahrain'
        WHEN v_location ILIKE '%oman%' THEN 'Oman'
        WHEN v_location ILIKE '%iraq%' THEN 'Iraq'
        WHEN v_location ILIKE '%lebanon%' THEN 'Lebanon'
        WHEN position(',' IN coalesce(v_location, '')) > 0
          THEN btrim(split_part(v_location, ',', array_length(string_to_array(v_location, ','), 1)))
        ELSE NULL
      END;
      SELECT coalesce(
        (SELECT nullif(trim(m->>'value'), '')
         FROM jsonb_array_elements(coalesce(j->'metadata', '[]'::jsonb)) AS metadata_item(m)
         WHERE m->>'name' = 'Website Mapping' LIMIT 1),
        (SELECT nullif(trim(d->>'name'), '')
         FROM jsonb_array_elements(coalesce(j->'departments', '[]'::jsonb)) AS department_item(d)
         LIMIT 1)
      ) INTO v_category;
      v_posted_at := coalesce(nullif(j->>'first_published', '')::timestamptz, nullif(j->>'updated_at', '')::timestamptz, now());
      v_deadline := nullif(j->>'application_deadline', '')::timestamptz;
      INSERT INTO public.jobs (
        source, source_job_id, title, company, description, location, country,
        category, source_url, canonical_url, posted_at, expires_at, status,
        confidence, dedupe_hash, last_checked_at, updated_at
      ) VALUES (
        'tamara', v_job_id, v_title, coalesce(nullif(trim(j->>'company_name'), ''), 'Tamara'),
        nullif(j->>'content', ''), v_location, v_country, v_category,
        v_url, v_url, v_posted_at, v_deadline,
        CASE WHEN v_deadline IS NOT NULL AND v_deadline <= now() THEN 'inactive' ELSE 'active' END,
        0.98, md5('tamara|' || v_job_id), now(), now()
      )
      ON CONFLICT (source, source_job_id) DO UPDATE SET
        title = excluded.title, company = excluded.company, description = excluded.description,
        location = excluded.location, country = excluded.country, category = excluded.category,
        source_url = excluded.source_url, canonical_url = excluded.canonical_url,
        posted_at = excluded.posted_at, expires_at = excluded.expires_at, status = excluded.status,
        confidence = excluded.confidence, dedupe_hash = excluded.dedupe_hash,
        last_checked_at = now(), updated_at = now();
      v_feed_ids := array_append(v_feed_ids, v_job_id);
      v_imported := v_imported + 1;
    END LOOP;
    UPDATE public.jobs
    SET status = 'inactive', last_checked_at = now(), updated_at = now()
    WHERE source = 'tamara' AND status = 'active' AND source_job_id IS NOT NULL
      AND NOT (source_job_id = ANY(v_feed_ids));
    UPDATE public.madkhal_external_feed_requests
    SET status = 'imported', processed_at = now(), error = NULL
    WHERE id = q.id;
  END LOOP;
  RETURN v_imported;
END;
$function$;

REVOKE ALL ON FUNCTION public.fetch_tamara_feed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.import_tamara_feed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_tamara_feed() TO service_role;
GRANT EXECUTE ON FUNCTION public.import_tamara_feed() TO service_role;

DO $schedule$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname IN ('madkhal-tamara-fetch', 'madkhal-tamara-import')
  LOOP PERFORM cron.unschedule(r.jobid); END LOOP;
  PERFORM cron.schedule('madkhal-tamara-fetch', '0 * * * *', 'SELECT public.fetch_tamara_feed();');
  PERFORM cron.schedule('madkhal-tamara-import', '5 * * * *', 'SELECT public.import_tamara_feed();');
END;
$schedule$;
