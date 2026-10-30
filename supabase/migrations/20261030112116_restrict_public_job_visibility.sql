-- Restrict public REST reads to currently active opportunities only.
-- Historical and expired rows remain available to trusted server-side jobs.
DROP POLICY IF EXISTS jobs_public_read ON public.jobs;

CREATE POLICY jobs_public_read_active
ON public.jobs
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  AND (expires_at IS NULL OR expires_at > now())
);
