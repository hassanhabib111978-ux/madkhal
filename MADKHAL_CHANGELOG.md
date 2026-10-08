# مَدخَل — سجل التغييرات

## 2026-10-08 — Product integrity batch
- Updated `worker-match-lifecycle.js` so subscription state is refreshed from the authoritative Supabase subscription record before continuous matching is processed.
- Kept public opportunity browsing free and separated it visually from paid continuous matching.
- Added explicit estimated-fit scoring for public opportunities and clarified that it is not a hiring promise.
- Added `MADKHAL_DASTOOR.md` as the repository-level product constitution.
- Added a database uniqueness guard for a user's employer-vacancy application record.
- Updated `apply_to_employer_vacancy` so a direct employer application is also recorded in `madkhal_applications`, connecting matching and application tracking into one lifecycle.
- Preserved existing public job-source tables and ingestion paths.

## Guardrail
No source ingestion was rebuilt or deleted in this batch. Payment activation remains server-authoritative and is not declared live until the payment provider integration is verified.

## 2026-10-08 — Employer lifecycle
- Connected employer opportunity review to `get_my_vacancy_candidates`.
- Added candidate lifecycle actions through the existing `advance_match_request`: employer interest, contact, interview, offer, hired.
- Added an explicit candidate panel after opportunity publishing.
- Preserved private-match-only employer vacancies and job-source ingestion.
