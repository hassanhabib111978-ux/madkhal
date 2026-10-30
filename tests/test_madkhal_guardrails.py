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
