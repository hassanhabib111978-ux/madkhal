# خريطة عقد قاعدة بيانات مَدخَل — 2026-09-27

## الحالة
قراءة فقط من مشروع Supabase `qbufsdpdobuicpljnssr`، دون أي كتابة أو DDL.

## 1. الجداول الأساسية ومسؤوليتها

- `profiles`: هوية الحساب العامة وربط `auth_user_id` والدور.
- `worker_profiles`: الملف المهني للعامل، ويرتبط بالمستخدم عبر `user_id`.
- `profile_skills`: مهارات الملف العام.
- `worker_skill_assessments`: تقييم مهارات مهنة محددة للمستخدم.
- `job_preferences`: تفضيلات البحث المرتبطة بـ `profiles.id`.
- `jobs`: مصدر الفرص الخارجية، للقراءة العامة.
- `employer_vacancies`: فرص أصحاب العمل الخاصة بالمطابقة.
- `match_requests`: نتيجة المطابقة ومسار التواصل.
- `madkhal_applications`: سجل تقديم العامل على فرصة.
- `subscriptions`: طلب/حالة الاشتراك.
- `notifications`: التنبيهات.
- `applications`: جدول آخر للمسار المرتبط بالفرص الداخلية؛ ليس هو نفس `madkhal_applications`.

## 2. تطابق الواجهة مع قاعدة البيانات

### العامل
الواجهة تحفظ الملف في:
`worker_profiles`

وتنشئ/تحدث:
`profiles`
`job_preferences`
`worker_skill_assessments`

ثم تشغّل:
`process_my_worker_matches(p_limit)`

### صاحب العمل
الواجهة تحفظ:
`profiles`
ثم:
`employer_vacancies`

ثم تشغّل:
`process_my_employer_matches(p_vacancy_id,p_limit)`

### المطابقة
`match_requests` هو مركز دورة المطابقة.

الدالة:
`process_my_worker_matches`
تبحث عن الفرص `open/matching` المؤكدة وغير المنتهية، ثم تحسب:
- legacy score
- professional score v3
- composite = 75% legacy + 25% professional

وتنشئ الحالة الأولية:
`matched`

المسار المقابل لصاحب العمل يعمل بالمنطق نفسه.

### التواصل
`advance_match_request` يسمح بالانتقالات المحددة:
- matched → employer_interested
- employer_interested → accepted / declined
- accepted → contact_opened
- contact_opened/interview/offer → interview / offer / hired / closed

والتحقق يعتمد على هوية صاحب العمل أو العامل، وليس مجرد قيمة الدور المرسلة من الواجهة.

## 3. نقاط إيجابية مؤكدة
- RLS مفعّل على الجداول الأساسية التي فُحصت.
- `jobs` لديه سياسة قراءة عامة فقط.
- بيانات العامل في `worker_profiles` مقيدة بـ `auth.uid() = user_id`.
- `madkhal_applications` مقيدة بـ `auth.uid() = user_id`.
- `match_requests` لديها سياسات منفصلة لصاحب الفرصة والعامل.
- `subscriptions` مرتبطة بملف `profiles` صاحب الحساب.

## 4. نقطة أمنية تحتاج مرحلة منفصلة
الدوال المركزية الخاصة بالمطابقة والتواصل كلها حاليًا `SECURITY DEFINER`.

هذا ليس تعديلًا يجب تنفيذه الآن؛ بل نقطة تدقيق. بعضها يحتوي تحققًا صريحًا من `auth.uid()` وملكية السجل، وهذا مهم. لكن وجود SECURITY DEFINER بحد ذاته يفسر جزءًا من تنبيهات Supabase الأمنية السابقة.

القاعدة: لا نغيّرها في مرحلة البناء الأولى لأن تغييرها قد يكسر المطابقة أو RLS.

## 5. نقطة يجب أن يعرفها الوكيل
يوجد جدولان لمسارات التقديم:
- `madkhal_applications`
- `applications`

يجب عدم دمجهما أو حذف أحدهما لمجرد تشابه الاسم. قبل أي إصلاح في التقديم يجب تحديد أي مسار يستخدمه كل نوع من الفرص.

## 6. عقد لا يجوز كسره
- `worker_profiles.user_id` = مستخدم العامل.
- `profiles.auth_user_id` = مستخدم الحساب.
- `job_preferences.profile_id` = `profiles.id`.
- `match_requests.worker_profile_id` = `worker_profiles.id`.
- `match_requests.vacancy_id` = `employer_vacancies.id`.
- `subscriptions.user_id` في السياسة الحالية يرتبط بـ `profiles.id`، وليس مباشرة بـ `auth.users.id`.

## 7. الخلاصة
العقد بين الواجهة وSupabase متماسك مبدئيًا، لكن المطابقة تعتمد على طبقتين من التقييم:
`calculate_worker_vacancy_match_score`
ثم
`calculate_professional_match`
ثم دمجهما داخل دوال المطابقة.

لذلك أي مشكلة في نتيجة المطابقة لا ينبغي علاجها بتعديل زر أو UI قبل فحص هاتين الدالتين.
