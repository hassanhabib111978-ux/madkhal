#!/usr/bin/env python3
"""Static regression guardrails for the legacy Madkhal front end.

This is intentionally conservative: it checks architectural invariants that can
be validated without Supabase credentials or a browser.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
index = (ROOT / "index.html").read_text(encoding="utf-8")
match_lifecycle = (ROOT / "worker-match-lifecycle.js").read_text(encoding="utf-8")
account_recovery = (ROOT / "account-recovery.js").read_text(encoding="utf-8")
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
    ("account recovery module is loaded from the account screen", 'src="./account-recovery.js?v=20261029-1"' in index and 'id="accountScreen"' in index),
    ("account recovery links email to the current identity", "auth.updateUser(" in account_recovery and "emailRedirectTo: recoveryRedirectUrl()" in account_recovery),
    ("account recovery requires a confirmed email before setting a password", "user.email || !isConfirmed(user)" in account_recovery and "auth.updateUser({ password })" in account_recovery),
    ("account recovery supports sign-in and password reset", "auth.signInWithPassword({ email, password })" in account_recovery and "auth.resetPasswordForEmail(email" in account_recovery),
    ("account recovery blocks cross-account local-data mixing", "madkhalHasLocalRecoveryData()" in account_recovery and "لم نحذفها ولم نخلطها بحساب آخر" in account_recovery),
    ("account recovery never stores passwords in browser storage", "localStorage.setItem" not in account_recovery and ".setItem(" not in account_recovery),
    ("constitution is present", "Codex is the engineering agent for مَدخَل" in agents),
]

failed = [name for name, ok in checks if not ok]
if failed:
    print("FAILED:")
    for name in failed:
        print(f"- {name}")
    raise SystemExit(1)

print(f"PASS: {len(checks)} Madkhal architectural regression checks")
