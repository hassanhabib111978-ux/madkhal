# مَدخَل — مسار الفحص الهندسي الموحد

## الهدف
الفحص لا يتوقف عند إصلاح نقطة ثم يبدأ من الصفر. هذا الملف هو نقطة الاستئناف الثابتة لمسار الفحص والإصلاح.

## المسار الإلزامي
1. الدخول/الجلسة
2. الملف المهني
3. المهنة + المؤهل + المهارات + نوع العمل + المكان
4. التقييم المهني
5. المطابقة الرسمية
6. ترتيب/توصيات الفرص
7. التنبيهات
8. تفاصيل الفرصة
9. التقديم
10. سجل المتابعة
11. إعادة التحقق بعد التقديم
12. فحص أي مسار بديل قد ينتج نتيجة مختلفة

## قاعدة العمل
- لا نعالج العرض فقط؛ نحدد المسار الذي أنتج العرض.
- لا نضيف طبقة إصلاح جديدة إذا كان بالإمكان توحيد المصدر.
- لا نعتبر مرحلة منجزة حتى نعرف مصدر الحقيقة الذي يغذي المرحلة التالية.
- لا نغير مصادر الوظائف أو بياناتها العاملة أثناء إصلاح واجهة/مطابقة إلا بتفويض صريح.
- لا نحذف الطبقات القديمة قبل إثبات أنها لم تعد تؤثر في النتيجة.

## نقاط التقدم الحالية
- [x] دستور هندسي للمشروع.
- [x] خريطة هندسية للمسارات.
- [x] إصلاح خطأ مركز المطابقة الذي كان يستخدم q.data غير معرّف.
- [x] إنشاء نقطة تنسيق موحدة لمركز مطابقة الباحث.
- [x] تشديد external-v3 لمنع المطابقات المهنية غير المنطقية.
- [x] تقييد التوصيات والتنبيهات المهنية إلى external-v3.
- [x] إيقاف إعادة صناعة تنبيهات المطابقة المهنية من localStorage.
- [x] منع التقديم من حفظ درجة محلية مختلفة؛ التقديم يعيد حساب الدرجة الرسمية قبل التسجيل.
- [x] فصل بطاقات الفرص العامة عن درجة المطابقة الرسمية؛ لا تعرض البطاقة درجة محلية مستقلة.
- [ ] فحص مسار التقييم وربطه بالمطابقة دون إعادة حساب متناقض.
- [ ] فحص المطابقات الداخلية وصاحب الفرصة.
- [x] منع سجل المتابعة من إعادة حساب درجة محلية عند إعادة العرض.
- [ ] فحص جميع ملفات fix/enhancement/bridge التي ما زالت قادرة على التأثير.
- [ ] اختبار الرحلة الكاملة من ملف الباحث حتى المتابعة.
- [ ] بعد النجاح فقط: إزالة الطبقات غير المؤثرة تدريجيًا.

## قاعدة الاستئناف
عند الانتقال إلى محادثة أو جلسة جديدة، يبدأ الفحص من أول بند غير مكتمل هنا، مع مراجعة البنود السابقة فقط للتحقق من عدم كسرها. لا نعيد العمل من الصفر.

## حماية
مصادر الوظائف وبياناتها العاملة خارج نطاق الإصلاح الحالي. لا حذف لطلبات التقديم التاريخية. لا تغيير للاشتراك/المحفظة إلا إذا أثبت الفحص أن هناك اعتمادًا مباشرًا يمنع الرحلة الموحدة.

## 2026-10-04 — internal score canonicalization
- Active internal `match_requests.match_score` generation now uses the same `professional_match_scores.scoring_version='v3'` score.
- The previous legacy 75% + professional 25% composite is no longer used for newly generated active matches.
- Legacy scoring functions and historical rows remain intact for audit/backward compatibility; no destructive data rewrite was performed.
- Worker skill ratings are persisted before the unified match refresh in the front-end, so the professional v3 matcher can consume the current assessment state.

## 2026-10-04 — internal application canonicalization
- `apply_to_employer_vacancy` now calculates the same `professional_match_scores` `v3` score used by the active internal matching path.
- The application request stores that score in both `match_score` and `explainable_match_score`.
- No historical application or match rows were rewritten or deleted.

## 2026-10-04 — score refresh trigger consistency
- Evaluation/request refresh triggers now synchronize both `match_score` and `explainable_match_score` from the current professional `v3` score.
- Existing active match requests with a current `v3` record were corrected to that derived score; historical application scores were not changed.
- Final live check: 2/2 match requests have a current v3 score and 0 score mismatches.

## 2026-10-04 — worker re-match v5
- The worker match processor now recalculates existing non-terminal match requests against the current professional `v3` score instead of skipping them.
- New matches still require a v3 score of at least 35; declined, closed, and hired requests are preserved.
- This closes the stale-score path after a worker edits profile, skills, or assessment data.

## 2026-10-04 — live data audit
- `worker_opportunity_recommendations`: 3 stale `external-v2` rows remain for audit, while the active path uses 3 `external-v3` rows; current `external-v3` positive recommendations checked: 0.
- `notifications`: 0 current match/job-match notifications and 1 subscription notification.
- Active `match_requests`: 2/2 have current v3 records and their active score fields match v3 (0 mismatches).

## 2026-10-08 — investable product hardening
- Fixed the paid-product boundary: continuous worker matching and match notifications now require an active monthly worker subscription at the database layer.
- Preserved free search/browsing/application behavior.
- Hardened subscription RLS so a client cannot create or update an active subscription; client-side requests are limited to `requested` state.
- Added a unified subscription runtime to provide the missing `renderSubscription`, `syncSubscriptionStatus`, and `syncSubscriptionRemote` paths and to keep payment requests explicitly pending verification.
- Added indexes for active subscriptions, worker match status, and notification deduplication.
- Preserved existing Middle East source ingestion and historical applications.
- Verification: modified JavaScript files parse successfully; database functions are SECURITY DEFINER and remain ownership-scoped; no production job data was rewritten.
- Remaining before sale/investment readiness: real payment-provider verification/activation, full end-to-end seeker/employer journey test, cleanup/consolidation of legacy fix layers, formal RLS tests, and production release review.
