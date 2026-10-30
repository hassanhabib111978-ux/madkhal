#!/usr/bin/env python3
"""Static regression guardrails for the legacy Madkhal front end.

This is intentionally conservative: it checks architectural invariants that can
be validated without Supabase credentials or a browser.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
index = (ROOT / "index.html").read_text(encoding="utf-8")
match_lifecycle = (ROOT / "worker-match-lifecycle.js").read_text(encoding="utf-8")
subscription_gate = (ROOT / "supabase/migrations/20261030084600_secure_subscription_checkout_gate.sql").read_text(encoding="utf-8")
account_recovery = (ROOT / "account-recovery.js").read_text(encoding="utf-8")
service_worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
worklink_feed_cycle = (ROOT / "supabase/migrations/20261030113000_restart_worklink_feed_cycle.sql").read_text(encoding="utf-8")
tamara_sync = (ROOT / "supabase/migrations/20261030112557_add_tamara_greenhouse_feed_sync.sql").read_text(encoding="utf-8")
job_visibility = (ROOT / "supabase/migrations/20261030112116_restrict_public_job_visibility.sql").read_text(encoding="utf-8")
agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
private_grants = (ROOT / "supabase/migrations/20261030114500_restrict_sensitive_view_grants.sql").read_text(encoding="utf-8")
anon_api_hardening = (ROOT / "supabase/migrations/20261030125500_harden_anon_api_privileges.sql").read_text(encoding="utf-8")
anon_esco_revoke = (ROOT / "supabase/migrations/20261030130500_revoke_anon_esco_table_reads.sql").read_text(encoding="utf-8")
auth_definer_hardening = (ROOT / "supabase/migrations/20261030131500_limit_authenticated_definer_rpcs.sql").read_text(encoding="utf-8")
legacy_applications_privacy = (ROOT / "supabase/migrations/20261030133000_restrict_legacy_application_reads.sql").read_text(encoding="utf-8")
pharmaceutical_match_gate = (ROOT / "supabase/migrations/20261030134000_pharmaceutical_occupation_match_gate.sql").read_text(encoding="utf-8")

checks = [
    ("one occupation search implementation", index.count("async function searchOccupations(") == 1),
    ("no local matchScore implementation", "function matchScore(" not in index),
    ("unified worker match loader is present", "loadCanonicalWorkerMatchData" in index),
    ("public matches are recalculated from current saved profile", "getCanonicalWorkerPublicMatches(publicJobs,p,10)" in match_lifecycle),
    ("stale persisted recommendation RPC cannot override fresh public scores", "get_my_opportunity_recommendations" not in match_lifecycle and "Do not replace these fresh scores with persisted recommendation rows" in match_lifecycle),
    ("stale match notifications are checked against saved profile timestamp", "function isStaleProfileMatchNotification(" in index and "notificationCreated<profileUpdated" in index),
    ("remote notifications retain opportunity type for freshness filtering", "opportunity_type:x.opportunity_type||\"\"" in index and ".filter(n=>!isStaleProfileMatchNotification(n,currentProfile))" in index),
    ("remote profile merge preserves revision timestamp", "updated_at:prefer(q.data.updated_at,old.updated_at)" in index),
    ("occupation picker clears hidden canonical values on input", 'document.getElementById("occupationUri").value=""' in index),
    ("occupation picker uses live opportunities", "allVisibleJobs" in index and "search_madkhal_occupations" in index),
    ("subscription checkout remains disabled by default on the server", "subscriptions_enabled boolean NOT NULL DEFAULT false" in subscription_gate),
    ("subscription checkout has a backend fail-closed feature gate", "subscription_checkout_disabled" in subscription_gate and "lc.subscriptions_enabled" in subscription_gate),
    ("subscription checkout rejects anonymous Auth identities", "FROM auth.users" in subscription_gate and "is_anonymous" in subscription_gate and "permanent_account_required" in subscription_gate),
    ("subscription checkout gate does not read or change the free-launch matching flag", "SELECT lc.free_launch" not in subscription_gate and "UPDATE public.madkhal_launch_config" not in subscription_gate),
    ("subscription checkout serializes requests per user", "pg_advisory_xact_lock" in subscription_gate and "hashtextextended" in subscription_gate),
    ("subscription checkout reuses an existing unexpired pending intent", "pi.status" in subscription_gate and "pending" in subscription_gate and "pi.expires_at > pg_catalog.now()" in subscription_gate and "FOR UPDATE" in subscription_gate),
    ("subscription checkout blocks duplicate active subscriptions", "subscription_already_active" in subscription_gate and "s.status" in subscription_gate and "active" in subscription_gate),
    ("subscription checkout RPC does not mark payment as paid", "verified_at" not in subscription_gate and "UPDATE public.payment_intents" not in subscription_gate),
    ("subscription checkout function grants exclude public and anon", "FROM PUBLIC, anon" in subscription_gate and "TO authenticated, service_role" in subscription_gate),
    ("subscription checkout operations document provider verification prerequisites", "provider integration" in (ROOT / "docs/operations/subscription-checkout-gate.md").read_text(encoding="utf-8")),
    ("future email rollout documents confirmed-email and explicit-alert-consent requirements", "email_confirmed_at" in (ROOT / "docs/operations/email-notifications-rollout.md").read_text(encoding="utf-8") and "unsubscribe" in (ROOT / "docs/operations/email-notifications-rollout.md").read_text(encoding="utf-8")),

    ("empty worker profile never shows a fabricated assessment", "أنشئ ملفك المهني أولًا ليظهر تقييم مبني على بياناتك الفعلية." in index and "score:52,level:" not in index and "تقييم مبدئي احتياطي" not in index),
    ("temporary anonymous session limitation is disclosed on seeker employer and account screens", index.count("تنبيه حساب المرحلة المجانية") == 3 and "لا تمسح بيانات الموقع" in index and "قد يمنعك من استعادة ملفك وطلباتك" in index),
    ("account email UI remains disabled during free launch", "window.MADKHAL_ACCOUNT_EMAIL_UI_ENABLED = false;" in index and "if (window.MADKHAL_ACCOUNT_EMAIL_UI_ENABLED !== true) return;" in account_recovery),
    ("account recovery module remains versioned and dormant for future paid activation", 'src="./account-recovery.js?v=20261030-email-deferred-v1"' in index and 'id="accountScreen"' in index),
    ("account recovery retains reusable seeker and employer identity panels behind the feature gate", 'mountCard(\n      "workerScreen"' in account_recovery and 'mountCard(\n      "employerScreen"' in account_recovery),
    ("account auth panels support account linking and password login", "auth.updateUser(" in account_recovery and "auth.signInWithPassword({ email, password })" in account_recovery),
    ("account auth panels support password recovery", "auth.resetPasswordForEmail(email" in account_recovery),
    ("account auth panels use separate password fields and never persist passwords", 'data-field="login-password"' in account_recovery and 'data-field="new-password"' in account_recovery and "localStorage.setItem" not in account_recovery and ".setItem(" not in account_recovery),
    ("account recovery links email to current identity", "auth.updateUser(" in account_recovery and "emailRedirectTo: recoveryRedirectUrl()" in account_recovery),
    ("account recovery requires confirmed email before setting password", "if (!user || user.is_anonymous || !user.email || !isConfirmed(user))" in account_recovery and "auth.updateUser({ password })" in account_recovery),
    ("account recovery supports password login and reset", "auth.signInWithPassword({ email, password })" in account_recovery and "auth.resetPasswordForEmail(email" in account_recovery),
    ("account recovery prevents mixing local data between identities", "madkhalHasLocalRecoveryData()" in account_recovery and "لم نحذفها ولم نخلطها بحساب آخر" in account_recovery),
    ("account recovery does not persist passwords in browser storage", "localStorage.setItem" not in account_recovery and ".setItem(" not in account_recovery),
    ("service worker only deletes Madkhal-owned caches", '.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)' in service_worker and 'names.map(name => caches.delete(name))' not in service_worker),
    ("service worker caches successful same-origin navigations for fallback", "await cache.put(request, response.clone())" in service_worker and "await cache.match(request)" in service_worker),
    ("service worker cache failure never blocks successful navigation", "Caching is best-effort" in service_worker),

    ("Tamara feed uses the official public Greenhouse endpoint", "boards-api.greenhouse.io/v1/boards/tamara/jobs?content=true" in tamara_sync and "net.http_get" in tamara_sync),
    ("Tamara feed completeness is verified before deactivating absent jobs", "v_expected_count <= 0" in tamara_sync and "v_array_count <> v_expected_count" in tamara_sync and "v_unique_count <> v_expected_count" in tamara_sync and "NOT (source_job_id = ANY(v_feed_ids))" in tamara_sync),
    ("Tamara feed upserts current jobs and refreshes checked timestamp", "ON CONFLICT (source, source_job_id) DO UPDATE" in tamara_sync and "last_checked_at = now()" in tamara_sync),
    ("Tamara Greenhouse HTML descriptions are converted to readable text before storage", "v_description := regexp_replace" in tamara_sync and "v_description, v_location" in tamara_sync),
    ("Tamara feed cron remains separate from the paused paid subscription", "madkhal-tamara-fetch" in tamara_sync and "madkhal-tamara-import" in tamara_sync and "subscriptions_enabled" not in tamara_sync),
    ("job cards receive source last-checked timestamp for freshness disclosure", "last_checked_at" in index[index.index("async function loadJobs"):index.index("function sourceName")] and "last_checked_at:j.last_checked_at||null" in index),
    ("job listings disclose source publication date and warn when last observation is older than 14 days", "function jobFreshnessLine(job)" in index and "ageDays>14" in index and "تاريخ النشر حسب المصدر" in index and "تحقق من المصدر الأصلي قبل التقديم" in index),
    ("missing source publication dates and undisclosed employers are identified explicitly", "function jobPublishedDateLine(job)" in index and "تاريخ النشر غير متوفر في بيانات المصدر" in index and "جهة العمل غير معلنة في المصدر" in index),
    ("missing source descriptions are disclosed before applying", "description_missing:!cleanJobText(j.description)" in index and "function jobDescriptionLine(job)" in index and "الوصف التفصيلي غير متوفر في بيانات المصدر" in index and "jobDescriptionLine(currentJob)" in index),

    ("job details repeat the source freshness notice", "jobFreshnessLine(currentJob)" in index),
    ("sensitive match and admin views are not directly readable by anon/authenticated roles", "REVOKE SELECT ON TABLE public.worker_opportunity_recommendations FROM anon, authenticated" in private_grants and "REVOKE SELECT ON TABLE public.madkhal_investor_metrics FROM anon, authenticated" in private_grants and "REVOKE SELECT ON TABLE public.professional_match_results FROM anon, authenticated" in private_grants),
    ("personal views lose only the pre-auth anon grant", "public.external_opportunity_match_results" in private_grants and "public.professional_record_summary" in private_grants and "public.worker_subscription_status" in private_grants and "FROM anon;" in private_grants),
    ("public job and ESCO catalog grants remain explicitly verified", "public.jobs" in private_grants and "public.esco_occupation_picker" in private_grants and "public_job_discovery_grant_missing" in private_grants),
    ("unauthenticated table and sequence grants are revoked by default", "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon" in anon_api_hardening and "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon" in anon_api_hardening),
    ("anonymous SQL role retains only the public jobs and ESCO catalog surface", "public.jobs" in anon_api_hardening and "public.esco_occupation_picker" in anon_api_hardening and "unneeded_anon_table_privilege_remains" in anon_api_hardening),
    ("ESCO catalogs are served through bounded public RPCs, not direct anon table reads", "REVOKE SELECT ON TABLE" in anon_esco_revoke and "direct_esco_catalog_read_still_granted_to_anon" in anon_esco_revoke and "bounded_public_esco_catalog_rpcs_missing" in anon_esco_revoke),
    ("authenticated SECURITY DEFINER access is limited to the reviewed allowlist", "v_auth_definer_count <> 23" in auth_definer_hardening and "REVOKE EXECUTE ON FUNCTION %s FROM authenticated" in auth_definer_hardening),
    ("payment activation remains unavailable to client roles", "payment_activation_rpc_must_not_be_client_callable" in auth_definer_hardening),
    ("future postgres-owned privileged functions require explicit authenticated grants", "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public" in auth_definer_hardening and "REVOKE EXECUTE ON FUNCTIONS FROM authenticated" in auth_definer_hardening),
    ("legacy employer application reads cannot expose applicant mother name or birth date", "DROP POLICY IF EXISTS applications_select_allowed" in legacy_applications_privacy and "applications_select_own_seeker" in legacy_applications_privacy and "p.auth_user_id = (SELECT auth.uid())" in legacy_applications_privacy),
    ("pharmaceutical profiles cannot receive generic engineer matches", "pharmaceutical specialty" in pharmaceutical_match_gate and "lower(coalesce(j.title,''))" in pharmaceutical_match_gate and "occupation_score := 90" in pharmaceutical_match_gate),
    ("existing external match rows are reprocessed under the new occupation revision", "occupation-relevance-v6-pharmaceutical-specialty-gate" in pharmaceutical_match_gate and "v_old_batch" in pharmaceutical_match_gate and "external_match_batch_recalculation_marker_not_updated" in pharmaceutical_match_gate),




    ("private match RPCs are not executable by the unauthenticated role", "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon" in anon_api_hardening and "private_match_rpc_still_callable_by_anon" in anon_api_hardening),
    ("authenticated users retain app RPCs after public execute is revoked", "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role" in anon_api_hardening and "authenticated_dashboard_rpc_missing" in anon_api_hardening),
    ("postgres-owned future objects do not inherit anonymous grants", "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public" in anon_api_hardening and "REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC" in anon_api_hardening),

    ("public REST job reads expose only active non-expired opportunities", "DROP POLICY IF EXISTS jobs_public_read" in job_visibility and "CREATE POLICY jobs_public_read_active" in job_visibility and "TO anon, authenticated" in job_visibility and "status =" in job_visibility and "expires_at IS NULL OR expires_at > now()" in job_visibility),
    ("public job visibility hardening does not alter ingestion data", "DELETE FROM public.jobs" not in job_visibility and "UPDATE public.jobs" not in job_visibility and "TRUNCATE" not in job_visibility),
    ("WorkLink feed cursor wraps to page one after page 88", "CASE WHEN f.page >= 88 THEN 1 ELSE f.page + 1 END" in worklink_feed_cycle),
    ("WorkLink feed pagination follows last requested page, not max page", "ORDER BY f.requested_at DESC, f.id DESC" in worklink_feed_cycle),
    ("WorkLink feed refreshes an existing page slot instead of no-op upsert", "ON CONFLICT (page) DO UPDATE" in worklink_feed_cycle and "request_id = EXCLUDED.request_id" in worklink_feed_cycle and "processed_at = NULL" in worklink_feed_cycle),
    ("WorkLink feed keeps source deduplication on source and source job id", "ON CONFLICT (source, source_job_id) DO UPDATE" in worklink_feed_cycle),
    ("WorkLink feed does not delete or bulk-reactivate historical jobs", "DELETE FROM public.jobs" not in worklink_feed_cycle and "UPDATE public.jobs" not in worklink_feed_cycle),
    ("constitution is present", "Codex is the engineering agent for مَدخَل" in agents),
]

failed = [name for name, ok in checks if not ok]
if failed:
    print("FAILED:")
    for name in failed:
        print(f"- {name}")
    raise SystemExit(1)

print(f"PASS: {len(checks)} Madkhal architectural regression checks")
