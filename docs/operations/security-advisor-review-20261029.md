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

## Additional function-level review — 2026-10-29

The following checks were made with read-only catalog queries and function-definition inspection. No database writes or permission changes were performed.

### Public occupation RPCs: review indicates limited read-only data

The three `anon`-callable functions were inspected:
- `search_madkhal_occupations(text, integer)` reads the public ESCO occupation labels, alternative labels and ISCO group; its result limit is capped at 50.
- `get_madkhal_occupation_skills(text, integer)` reads ESCO skill labels and occupation-skill relations; its result limit is capped at 30.
- `madkhal_occupation_has_live_opportunity(text)` returns a boolean based on public active jobs and open employer vacancies.

They do not write records or return a user's private profile in the inspected definitions. Their `SECURITY DEFINER` status still merits least-privilege review, but the current evidence does not support an indiscriminate revoke that could break occupation search for public visitors.

### Authenticated mutating RPCs: checks observed in inspected definitions

Ownership or role checks were present in the inspected definitions for core operations including `advance_match_request`, `apply_to_employer_vacancy`, `calculate_external_opportunity_match`, `process_my_worker_matches`, `process_my_employer_matches`, `record_external_job_application`, `save_external_job_application`, and `update_external_job_application`. The admin metrics function checks the caller's `profiles.role` for `admin`. The professional evaluation RPC verifies that the evaluator is a party to a completed/closed match, and the table itself enforces an overall rating range of 1–5.

These observations lower the apparent immediate risk of the inspected functions, but do not substitute for end-to-end authorization tests against each RPC and RLS policy.

### 5. Payment-intent RPC is not gated by the current UI pause

**Observed configuration at review time:** `index.html` sets `window.MADKHAL_MONTHLY_SUBSCRIPTION_ENABLED = false`; the live `public.madkhal_launch_config` row reports `free_launch = true`.

The live definition of `public.create_subscription_payment_intent()`:
- is a `SECURITY DEFINER` function executable by `authenticated`;
- checks only that `auth.uid()` is not null;
- inserts a $1 USD `subscription` payment intent with `pending` status and a 30-minute expiry;
- does not check `madkhal_launch_config.free_launch`, a server-side subscription feature flag, an existing active/requested subscription, or an existing unexpired pending intent.

Because the app enables anonymous sign-in, a visitor with an anonymous authenticated session can call an exposed authenticated RPC directly even when the subscription UI is hidden. This does **not** by itself prove that any payment can be charged or a subscription activated: the inspected function only creates a pending intent and does not mark it paid. It does allow the paused flow to be initiated outside the UI and may permit repeated pending-intent creation.

**Recommended disposition:** before making the payment screen available again, put a server-side feature/launch gate inside this RPC and make pending-intent creation idempotent or rate-limited. Keep provider verification as the only path to a paid status. Do not change `free_launch` merely to silence this finding: it also participates in free-launch matching and notification rules. A narrow, CLI-generated migration should be reviewed and tested before application. No change was applied to production during this audit.

### Related performance advisories

The live advisor also reports 11 unindexed foreign keys, 15 RLS policies that re-evaluate auth/current-setting expressions, 35 unused indexes, and multiple permissive SELECT policies on `match_requests`. These are not all security vulnerabilities. Review query plans and policy semantics first; do not remove unused indexes or combine permissive policies without evidence that behavior remains equivalent.
