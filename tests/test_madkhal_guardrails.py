#!/usr/bin/env python3
"""Static regression guardrails for the legacy Madkhal front end.

This is intentionally conservative: it checks architectural invariants that can
be validated without Supabase credentials or a browser.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
index = (ROOT / "index.html").read_text(encoding="utf-8")
agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")

checks = [
    ("one occupation search implementation", index.count("async function searchOccupations(") == 1),
    ("no local matchScore implementation", "function matchScore(" not in index),
    ("unified worker match loader is present", "loadCanonicalWorkerMatchData" in index),
    ("occupation picker clears hidden canonical values on input", 'document.getElementById("occupationUri").value=""' in index),
    ("occupation picker uses live opportunities", "allVisibleJobs" in index and "search_madkhal_occupations" in index),
    ("constitution is present", "Codex is the engineering agent for مَدخَل" in agents),
]

failed = [name for name, ok in checks if not ok]
if failed:
    print("FAILED:")
    for name in failed:
        print(f"- {name}")
    raise SystemExit(1)

print(f"PASS: {len(checks)} Madkhal architectural regression checks")
