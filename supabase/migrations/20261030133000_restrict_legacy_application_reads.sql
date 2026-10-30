-- Legacy applications contains applicant mother name and birth date.
-- Employers receive the minimized candidate data through get_my_vacancy_candidates(),
-- not direct access to the full applications row.
DROP POLICY IF EXISTS applications_select_allowed ON public.applications;
DROP POLICY IF EXISTS applications_select_own_seeker ON public.applications;

CREATE POLICY applications_select_own_seeker
ON public.applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = applications.seeker_id
      AND p.auth_user_id = (SELECT auth.uid())
  )
);

DO $verify$
DECLARE
  v_qual text;
BEGIN
  SELECT qual INTO v_qual
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename='applications'
    AND policyname='applications_select_own_seeker'
    AND cmd='SELECT';

  IF v_qual IS NULL OR v_qual NOT ILIKE '%auth.uid%' OR v_qual ILIKE '%employer_vacancies%' THEN
    RAISE EXCEPTION 'legacy_applications_select_policy_not_owner_only';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='applications'
      AND policyname='applications_select_allowed'
  ) THEN
    RAISE EXCEPTION 'legacy_employer_application_read_policy_still_exists';
  END IF;
END;
$verify$;
