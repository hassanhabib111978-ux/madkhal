#!/usr/bin/env python3
"""Conservative regression guardrails for Madkhal's connected seeker journey."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
index = (ROOT / "index.html").read_text(encoding="utf-8")
agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
lifecycle = (ROOT / "worker-match-lifecycle.js").read_text(encoding="utf-8")
jibran = (ROOT / "employer-flow-enhancement.js").read_text(encoding="utf-8")
migration = (ROOT / "supabase/migrations/20261014_unify_free_launch_matching_access.sql").read_text(encoding="utf-8")

checks = [
    ("one occupation-search implementation", index.count("async function searchOccupations(") == 1),
    ("no old local matchScore implementation", "function matchScore(" not in index),
    ("one canonical worker match loader is present", "loadCanonicalWorkerMatchData" in lifecycle),
    ("old conflicting Jibran save/occupation overlay is not loaded", 'src="./jibran.js"' not in index),
    ("occupation picker clears hidden canonical values on input", 'document.getElementById("occupationUri").value=""' in index),
    ("occupation picker stays linked to live opportunities", "allVisibleJobs" in index and "search_madkhal_occupations" in index),
    ("worker match refresh calls the official internal engine", "process_my_worker_matches" in lifecycle and "create_worker_match_notifications" in lifecycle),
    ("official external recommendations are read from Supabase", "get_my_opportunity_recommendations" in lifecycle),
    ("zero-score rows are not presented as professional recommendations", "Number(x.overall_score)>=35" in lifecycle),
    ("terminal match states are excluded from current match center", "ACTIVE_MATCH_STATUSES" in lifecycle and "'declined'" not in lifecycle.split("const ACTIVE_MATCH_STATUSES", 1)[1].split(";", 1)[0]),
    ("current alert verification is enabled", "verifyCurrentOpportunityNotifications" in index),
    ("verified remote match alerts are not blanket-hidden", 'if(msg.startsWith("🎯 فرصة مناسبة لك:"))return false;' not in index),
    ("Jibran reports official and estimated results separately", "summarizeMatches" in jibran and "d?.recommendations" in jibran and "تقديري" in jibran),
    ("migration centralizes free-launch access in a DB flag", "madkhal_free_launch_enabled" in migration and "madkhal_launch_config" in migration),
    ("free-launch access still requires an authenticated user", "(SELECT auth.uid()) IS NOT NULL" in migration),
    ("paid mode requires a currently active monthly worker plan", "s.audience='worker'" in migration and "s.plan='monthly'" in migration and "s.status='active'" in migration),
    ("external notification eligibility checks active unexpired jobs", "j.status='active'" in migration and "j.expires_at IS NULL OR j.expires_at>=now()" in migration),
    ("external matching prioritizes jobs not yet scored for eligible seekers", "pending_wp" in migration and "pending_sub.audience='worker'" in migration and "oms.scoring_version='external-v3'" in migration),
    ("external matcher skips cron work when no worker currently has access", "Avoid scanning job batches" in migration and "RETURN 0;" in migration),
    ("current employer vacancies only are returned as active matches", "ev.status in ('open','matching')" in migration and "ev.confirmation_at is not null" in migration),
    ("migration preserves imported jobs and application history", "DELETE FROM public.jobs" not in migration.upper() and "DELETE FROM PUBLIC.MADKHAL_APPLICATIONS" not in migration.upper()),
    ("engineering constitution is present", "Codex is the engineering agent for مَدخَل" in agents),
]

failed = [name for name, ok in checks if not ok]
if failed:
    print("FAILED:")
    for name in failed:
        print(f"- {name}")
    raise SystemExit(1)

print(f"PASS: {len(checks)} Madkhal connected-seeker regression guardrails")
