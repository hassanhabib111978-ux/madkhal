-- Madkhal: read-only audit for inactive external job retention.
-- Safe to run against production: every statement is SELECT-only.
-- Do NOT add DELETE/UPDATE here. Review retention and legal/business requirements first.

-- 1) Overall status distribution.
SELECT lower(trim(status)) AS normalized_status, count(*) AS rows
FROM public.jobs
GROUP BY lower(trim(status))
ORDER BY rows DESC;

-- 2) Inactive rows by source, age, and metadata completeness.
SELECT
  source,
  count(*) AS inactive_rows,
  count(*) FILTER (WHERE canonical_url IS NULL OR btrim(canonical_url) = '') AS missing_canonical_url,
  count(*) FILTER (WHERE source_job_id IS NULL OR btrim(source_job_id) = '') AS missing_source_job_id,
  count(*) FILTER (WHERE title IS NULL OR btrim(title) = '') AS missing_title,
  min(created_at) AS oldest_created_at,
  max(created_at) AS newest_created_at,
  min(last_checked_at) AS oldest_last_checked_at,
  max(last_checked_at) AS newest_last_checked_at,
  count(*) FILTER (WHERE created_at < now() - interval '30 days') AS older_than_30_days,
  count(*) FILTER (WHERE created_at < now() - interval '60 days') AS older_than_60_days,
  count(*) FILTER (WHERE created_at < now() - interval '90 days') AS older_than_90_days
FROM public.jobs
WHERE lower(trim(status)) = 'inactive'
GROUP BY source
ORDER BY inactive_rows DESC;

-- 3) Duplicate source labels after normalization; this is diagnostic only.
SELECT
  lower(trim(source)) AS normalized_source,
  array_agg(DISTINCT source ORDER BY source) AS stored_labels,
  count(*) AS total_rows,
  count(*) FILTER (WHERE lower(trim(status)) = 'active') AS active_rows,
  count(*) FILTER (WHERE lower(trim(status)) = 'expired') AS expired_rows,
  count(*) FILTER (WHERE lower(trim(status)) = 'inactive') AS inactive_rows
FROM public.jobs
GROUP BY lower(trim(source))
HAVING count(DISTINCT source) > 1
ORDER BY total_rows DESC;

-- 4) Linkage counts by source, calculated independently to avoid join multiplication.
WITH inactive AS (
  SELECT id, source FROM public.jobs
  WHERE lower(trim(status)) = 'inactive'
)
SELECT
  i.source,
  count(*) AS inactive_jobs,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.notifications n WHERE n.job_id = i.id
  )) AS jobs_with_notifications,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.external_job_applications e WHERE e.job_id = i.id
  )) AS jobs_with_external_applications,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.madkhal_applications m WHERE m.job_id = i.id
  )) AS jobs_with_madkhal_applications
FROM inactive i
GROUP BY i.source
ORDER BY inactive_jobs DESC;

-- 5) Count all child records referencing inactive jobs (independent totals).
SELECT 'notifications' AS child_table, count(*) AS child_rows
FROM public.notifications n
JOIN public.jobs j ON j.id = n.job_id
WHERE lower(trim(j.status)) = 'inactive'
UNION ALL
SELECT 'external_job_applications', count(*)
FROM public.external_job_applications e
JOIN public.jobs j ON j.id = e.job_id
WHERE lower(trim(j.status)) = 'inactive'
UNION ALL
SELECT 'madkhal_applications', count(*)
FROM public.madkhal_applications m
JOIN public.jobs j ON j.id = m.job_id
WHERE lower(trim(j.status)) = 'inactive';

-- Retention guardrails:
-- * Never archive/delete rows based on status alone; verify source freshness and business rules.
-- * Preserve job IDs and all required fields so archived rows can be restored.
-- * Before deletion, inspect every FK referencing public.jobs and its ON DELETE behavior.
-- * Test export -> checksum/count validation -> restore on a non-production target first.
-- * An archive table in the same database separates workloads but does not necessarily reduce
--   total database storage. External export plus verified deletion is required to reclaim it.
-- * Do not normalize source labels until importer upsert/deduplication behavior is reviewed.


-- 6) Active rows whose source freshness may need attention.
-- A stale last_checked_at does not prove a job is closed; it flags it for verification.
SELECT
  source,
  count(*) AS active_rows,
  count(*) FILTER (WHERE last_checked_at IS NULL) AS never_checked,
  count(*) FILTER (WHERE last_checked_at < now() - interval '7 days' OR last_checked_at IS NULL) AS not_checked_7d,
  count(*) FILTER (WHERE last_checked_at < now() - interval '30 days' OR last_checked_at IS NULL) AS not_checked_30d,
  min(last_checked_at) AS oldest_check,
  max(last_checked_at) AS newest_check
FROM public.jobs
WHERE lower(trim(status)) = 'active'
GROUP BY source
ORDER BY not_checked_7d DESC, active_rows DESC;
