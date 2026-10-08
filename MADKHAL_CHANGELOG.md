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

## 2026-10-08 — Accepted match state
- Corrected employer candidate review to recognize the authoritative `accepted` state returned after worker approval.
- Restored the next employer action: opening contact after worker acceptance.
- 2026-10-08: employer flow now refreshes the authoritative candidate panel immediately after a vacancy is published and matching starts, keeping employer review connected to the created vacancy.
- 2026-10-08: added the Madkhal automated-engineer operating charter, permissions policy, and inspection/repair protocol; these define inspect-first, least-change, source-preserving, auditable repair rules.
- 2026-10-08: hardened paid matching so a localStorage `active` flag can never activate paid matching when the authoritative Supabase subscription check is unavailable; failure now falls back to free behavior.
- 2026-10-08: Jibran matching requests now verify the authoritative Supabase subscription before loading direct matches, closing the client-side timing gap before the subscription runtime guard initializes.
- 2026-10-08: corrected the Jibran async function declaration introduced during the subscription-boundary hardening; verified the declaration is syntactically singular (`async function`).
- 2026-10-08: unified employer match lifecycle with existing application history via safe Supabase triggers. Match transitions now update an existing vacancy application (`follow_up/interview/offer/hired/withdrawn/closed`) without creating applications from matches; application insertion also respects an already-existing match state. Job-source tables were untouched.
- 2026-10-08: aligned the worker match center with the saved worker profile by refreshing the remote profile before calculating public opportunities; no job-source data or source integrations were changed.
- 2026-10-08: made the canonical worker matching entry point refresh the persisted worker profile before calculating matches, covering account, match-center, and Jibran callers without touching job-source data.

- 2026-10-08: fixed `loadProfileRemote()` field precedence so persisted Supabase values, including intentional empty/null values, are not masked by stale local profile values; job-source data and matching algorithms were not changed.
- 2026-10-08: tightened remote profile authority further by removing local-value fallback for ordinary profile fields when the authenticated `worker_profiles` row exists; matching now receives the persisted profile state as the canonical baseline.
- 2026-10-08: hardened external application duplicate protection by checking authoritative `madkhal_applications` history before recording a new application; localStorage is no longer the sole duplicate guard. No job-source data changed.
- 2026-10-08: audit found the employer candidate panel declared a non-async function while using `await`, which could prevent the employer lifecycle script from parsing/executing. Fixed the declaration to `async` without changing matching logic or job sources.
- 2026-10-08: repaired runtime wiring by loading `subscription-runtime.js` and `jibran.js` explicitly from the main page before employer/worker lifecycle scripts. This removes reliance on the employer script's dynamic subscription loading and ensures Jibran's occupation/PWA runtime is actually loaded. Job-source data and matching logic were not changed.


## 2026-10-08 — Mobile UI responsiveness guard
- تم تشخيص خلل محتمل يوقف تنفيذ JavaScript بالكامل عند تعذر تحميل مكتبة Supabase الخارجية؛ كان إنشاء العميل يتم مباشرة عند بدء الصفحة.
- تم جعل إنشاء عميل Supabase آمنًا وغير قاتل للواجهة: إذا تعذر تحميل المكتبة تبقى مسارات الواجهة المحلية والأزرار والتنقل قابلة للعمل بدل توقف الصفحة بالكامل.
- لم يتم تعديل مصادر الوظائف أو بيانات Supabase أو منطق المطابقة.
