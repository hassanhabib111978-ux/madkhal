# Supabase Security Advisor Triage — 2026-10-29

## Scope

Read-only Supabase Security Advisor snapshot. No policies, grants, functions, extensions, or Auth settings were changed. Advisor findings are triage signals; confirm intended access before changing permissions.

## Findings requiring review

### 1. SECURITY DEFINER RPCs callable by client roles

The advisor reports:
- 3 functions executable by `anon` as SECURITY DEFINER:
  - `public.get_madkhal_occupation_skills(text, integer)`
  - `public.madkhal_occupation_has_live_opportunity(text)`
  - `public.search_madkhal_occupations(text, integer)`
- 23 functions executable by `authenticated` as SECURITY DEFINER, including state-changing and user-data functions such as `advance_match_request`, `apply_to_employer_vacancy`, `save_external_job_application`, and `update_external_job_application`.

This is not automatically a vulnerability: some RPCs may intentionally be callable. But each function must validate caller identity, ownership, role, and input parameters internally. Do not blindly revoke all grants because the app may depend on legitimate RPC access. Review function definitions and intended client call paths, then revoke unnecessary grants or add authorization checks in a tested migration.

Remediation guidance: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

### 2. RLS enabled but no policies

The advisor reports 33 public tables with RLS enabled and no policies. Several names look like internal feed/import tracking, source registry, or backup tables (for example `madkhal_external_feed_requests`, `onjob_fetch_requests`, and ESCO backup tables).

RLS enabled with no policies generally blocks ordinary client-role access, which can be intentional for server-only tables. Verify that the service-role/server-side workflows are the only intended access path; do not add broad public policies merely to silence the warning.

Remediation guidance: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

### 3. Extension in exposed `public` schema

The advisor reports `pg_net` installed in `public`. Moving an extension may affect existing function references and scheduled HTTP jobs. Inventory its functions and dependent jobs first; plan a migration only after confirming compatibility.

Remediation guidance: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

### 4. Leaked-password protection disabled

The advisor reports Supabase Auth leaked-password protection is disabled. Enable it in Auth password/security settings after considering the expected sign-up and password-reset flows, then test the user-facing flow.

Guidance: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Recommended triage order

1. Inspect the 3 anon-callable SECURITY DEFINER functions first, including grants and whether their results are intentionally public.
2. Review state-changing SECURITY DEFINER RPCs for ownership checks and parameter validation; prioritize functions that mutate applications, match requests, subscriptions, wallets, or profiles.
3. Confirm each no-policy table is intentionally server-only and that required jobs/functions use the intended privileged credentials.
4. Plan, test, and only then migrate any extension or grant changes.
5. Enable leaked-password protection and test registration/reset behavior.

This snapshot does not certify the whole platform as secure; it records advisor findings requiring a controlled review.
