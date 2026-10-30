-- Restart the WorkLink feed pagination after page 88 instead of reporting no-op success forever.
-- Keep the existing one-page-per-minute cadence and update the existing page slot in place.
CREATE OR REPLACE FUNCTION public.worklink_sync()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_page integer;
  req_id bigint;
  response jsonb;
  response_row_id bigint;
  rows_saved integer := 0;
BEGIN
  -- Continue from the last requested page; wrap to page 1 after page 88.
  SELECT COALESCE(
    (
      SELECT CASE WHEN f.page >= 88 THEN 1 ELSE f.page + 1 END
      FROM public.worklink_feed_requests AS f
      ORDER BY f.requested_at DESC, f.id DESC
      LIMIT 1
    ),
    1
  )
  INTO next_page;

  SELECT net.http_get(
    url := 'https://worklink.sy/api/partner/vacancies?per_page=50&page=' || next_page,
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (
        SELECT ds.decrypted_secret
        FROM vault.decrypted_secrets AS ds
        WHERE ds.name = 'WORKLINK_API_TOKEN'
      ),
      'Accept', 'application/json'
    )
  )
  INTO req_id;

  -- Each page has one durable slot. Refresh the slot on the next pagination cycle.
  INSERT INTO public.worklink_feed_requests(page, request_id, requested_at, processed_at)
  VALUES (next_page, req_id, now(), NULL)
  ON CONFLICT (page) DO UPDATE
    SET request_id = EXCLUDED.request_id,
        requested_at = EXCLUDED.requested_at,
        processed_at = NULL;

  -- Process the oldest successful response that has not yet been imported.
  SELECT f.id, r.content::jsonb
    INTO response_row_id, response
  FROM public.worklink_feed_requests AS f
  JOIN net._http_response AS r ON r.id = f.request_id
  WHERE f.processed_at IS NULL
    AND r.status_code = 200
  ORDER BY f.requested_at, f.id
  LIMIT 1;

  IF response IS NOT NULL THEN
    INSERT INTO public.jobs (
      source,
      source_job_id,
      title,
      company,
      description,
      location,
      country,
      job_type,
      category,
      salary_min,
      salary_max,
      salary_currency,
      source_url,
      canonical_url,
      expires_at,
      status,
      confidence,
      geo_scope,
      geo_region,
      last_checked_at
    )
    SELECT
      'worklink',
      x->>'id',
      x->>'title',
      x->'company'->>'name',
      x->>'description',
      COALESCE(x->'locations'->>0, ''),
      'Syria',
      x->>'type',
      x->'category'->>'name',
      NULLIF(regexp_replace(split_part(x->>'salary', '-', 1), '[^0-9.]', '', 'g'), '')::numeric,
      NULLIF(regexp_replace(split_part(x->>'salary', '-', 2), '[^0-9.]', '', 'g'), '')::numeric,
      NULL,
      x->>'url',
      x->>'url',
      CASE
        WHEN x->>'deadline' IS NULL OR x->>'deadline' = '' THEN NULL
        ELSE (x->>'deadline')::timestamptz
      END,
      'active',
      0.95,
      'country_specific',
      'syria',
      now()
    FROM jsonb_array_elements(COALESCE(response->'data', '[]'::jsonb)) AS x
    ON CONFLICT (source, source_job_id) DO UPDATE SET
      title = EXCLUDED.title,
      company = EXCLUDED.company,
      description = EXCLUDED.description,
      location = EXCLUDED.location,
      country = EXCLUDED.country,
      job_type = EXCLUDED.job_type,
      category = EXCLUDED.category,
      salary_min = EXCLUDED.salary_min,
      salary_max = EXCLUDED.salary_max,
      source_url = EXCLUDED.source_url,
      canonical_url = EXCLUDED.canonical_url,
      expires_at = EXCLUDED.expires_at,
      status = EXCLUDED.status,
      confidence = EXCLUDED.confidence,
      geo_scope = EXCLUDED.geo_scope,
      geo_region = EXCLUDED.geo_region,
      last_checked_at = now();

    GET DIAGNOSTICS rows_saved = ROW_COUNT;

    UPDATE public.worklink_feed_requests
       SET processed_at = now()
     WHERE id = response_row_id;
  END IF;

  RETURN 'WORKLINK_PAGE=' || next_page ||
         ' | SAVED_OR_UPDATED=' || rows_saved;
END;
$function$;
