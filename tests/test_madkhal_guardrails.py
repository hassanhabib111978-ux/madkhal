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
    ("subscription checkout gate is independent of free-launch matching", "free_launch" not in subscription_gate),
    ("subscription checkout serializes requests per user", "pg_advisory_xact_lock" in subscription_gate and "hashtextextended" in subscription_gate),
    ("subscription checkout reuses an existing unexpired pending intent", "pi.status" in subscription_gate and "pending" in subscription_gate and "pi.expires_at > pg_catalog.now()" in subscription_gate and "FOR UPDATE" in subscription_gate),
    ("subscription checkout blocks duplicate active subscriptions", "subscription_already_active" in subscription_gate and "s.status" in subscription_gate and "active" in subscription_gate),
    ("subscription checkout RPC does not mark payment as paid", "verified_at" not in subscription_gate and "UPDATE public.payment_intents" not in subscription_gate),
    ("subscription checkout function grants exclude public and anon", "FROM PUBLIC, anon" in subscription_gate and "TO authenticated, service_role" in subscription_gate),
    ("subscription checkout operations document provider verification prerequisites", "provider integration" in (ROOT / "docs/operations/subscription-checkout-gate.md").read_text(encoding="utf-8")),
    ("constitution is present", "Codex is the engineering agent for مَدخَل" in agents),
]

failed = [name for name, ok in checks if not ok]
if failed:
    print("FAILED:")
    for name in failed:
        print(f"- {name}")
    raise SystemExit(1)

print(f"PASS: {len(checks)} Madkhal architectural regression checks")
