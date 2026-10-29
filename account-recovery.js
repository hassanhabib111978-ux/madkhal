/* Madkhal account continuity: link the current anonymous identity, then permit sign-in/recovery. */
(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);
  let cardReady = false;

  function addCard() {
    if (cardReady || !byId("accountScreen")) return;
    const account = byId("accountScreen");
    const card = document.createElement("div");
    card.className = "card";
    card.id = "accountRecoveryCard";
    card.innerHTML = [
      '<h3>🔐 حفظ حسابك واستعادته</h3>',
      '<p>اربط بريدك بالحساب الحالي كي يبقى ملفك وطلباتك مرتبطين بك عند تبديل الجهاز. لا تكتب كلمة المرور إلا في هذه الواجهة الرسمية.</p>',
      '<div id="accountRecoveryStatus" class="notice" role="status" aria-live="polite">جارٍ التحقق من حالة الحساب…</div>',
      '<div id="recoveryLinkPanel" class="hidden">',
        '<div class="form-group"><label for="recoveryLinkEmail">بريد إلكتروني تملكه</label>',
        '<input id="recoveryLinkEmail" type="email" autocomplete="email" inputmode="email" placeholder="name@example.com"></div>',
        '<button id="recoveryLinkButton" type="button" class="primary-btn" style="width:100%">ربط البريد بالحساب الحالي</button>',
        '<p class="notice">سنرسل رسالة تأكيد. افتحها ثم ارجع إلى مَدخَل لتعيين كلمة المرور. يجب أن يكون ربط الهويات اليدوي مفعّلًا في إعدادات Supabase.</p>',
      '</div>',
      '<div id="recoveryPasswordPanel" class="hidden">',
        '<div class="form-group"><label for="recoveryNewPassword">كلمة المرور الجديدة (8 أحرف على الأقل)</label>',
        '<input id="recoveryNewPassword" type="password" autocomplete="new-password" minlength="8" placeholder="كلمة مرور قوية"></div>',
        '<div class="form-group"><label for="recoveryConfirmPassword">تأكيد كلمة المرور</label>',
        '<input id="recoveryConfirmPassword" type="password" autocomplete="new-password" minlength="8" placeholder="أعد كتابة كلمة المرور"></div>',
        '<button id="recoverySetPasswordButton" type="button" class="primary-btn" style="width:100%">حفظ كلمة المرور</button>',
      '</div>',
      '<div id="recoveryLoginPanel" class="hidden">',
        '<hr style="border:0;border-top:1px solid var(--line);margin:16px 0">',
        '<h4 style="margin:0 0 10px">لديك حساب محفوظ مسبقًا؟</h4>',
        '<div class="form-group"><label for="recoveryLoginEmail">البريد الإلكتروني</label>',
        '<input id="recoveryLoginEmail" type="email" autocomplete="username" inputmode="email" placeholder="name@example.com"></div>',
        '<div class="form-group"><label for="recoveryLoginPassword">كلمة المرور</label>',
        '<input id="recoveryLoginPassword" type="password" autocomplete="current-password" placeholder="كلمة المرور"></div>',
        '<button id="recoveryLoginButton" type="button" class="secondary-btn" style="width:100%">تسجيل الدخول إلى حسابي</button>',
        '<button id="recoveryForgotButton" type="button" class="secondary-btn" style="width:100%;margin-top:8px">نسيت كلمة المرور؟ أرسل رابط استعادة</button>',
        '<p class="notice">لن نخلط بيانات جلسة مؤقتة محفوظة على هذا الجهاز مع حساب آخر. إذا كان لديك ملف محلي غير مربوط، سنوقف تسجيل الدخول بدلًا من دمج بيانات قد تخص حسابين مختلفين.</p>',
      '</div>'
    ].join("");
    const anchor = account.querySelector(".card");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else account.prepend(card);
    cardReady = true;

    byId("recoveryLinkButton").addEventListener("click", linkCurrentEmail);
    byId("recoverySetPasswordButton").addEventListener("click", setCurrentPassword);
    byId("recoveryLoginButton").addEventListener("click", signInExistingAccount);
    byId("recoveryForgotButton").addEventListener("click", sendPasswordRecovery);
  }

  function setStatus(message, kind) {
    const box = byId("accountRecoveryStatus");
    if (!box) return;
    box.textContent = message;
    box.className = kind === "success" ? "notice success" : "notice";
    if (kind === "warning") {
      box.style.background = "#fff7e8";
      box.style.border = "1px solid #f0d7a6";
      box.style.color = "#6e4d12";
    } else {
      box.style.removeProperty("background");
      box.style.removeProperty("border");
      box.style.removeProperty("color");
    }
  }

  function toggle(id, visible) {
    const node = byId(id);
    if (node) node.classList.toggle("hidden", !visible);
  }

  function isConfirmed(user) {
    return !!(user && (user.email_confirmed_at || user.confirmed_at));
  }

  function hasMeaningfulValue(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some(hasMeaningfulValue);
    if (typeof value === "object") return Object.values(value).some(hasMeaningfulValue);
    return String(value).trim() !== "";
  }

  // This is a guard only: it never deletes or overwrites local values.
  function madkhalHasLocalRecoveryData() {
    const keys = [
      "madkhal_clean_profile_v1",
      "madkhal_applications_v1",
      "madkhal_notifications_v1",
      "madkhal_selected_skills_v1",
      "madkhal_subscription_v1",
      "madkhal_payment_method"
    ];
    try {
      return keys.some((key) => {
        const raw = window.localStorage.getItem(key);
        if (!raw) return false;
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (_) {
          return true;
        }
        return hasMeaningfulValue(parsed);
      });
    } catch (_) {
      // If storage cannot be inspected, fail closed rather than risk mixing accounts.
      return true;
    }
  }

  function recoveryRedirectUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function renderPanels(user, customMessage) {
    const isAnonymous = !user || user.is_anonymous === true;
    const confirmed = isConfirmed(user);
    toggle("recoveryLinkPanel", !user || isAnonymous || !user.email);
    toggle("recoveryLoginPanel", isAnonymous);
    toggle("recoveryPasswordPanel", !!user && !isAnonymous && !!user.email && confirmed);

    if (customMessage) return;
    if (!user) {
      setStatus("لا توجد جلسة نشطة بعد. يمكنك استعادة حساب محفوظ، أو ربط بريد بعد تهيئة الجلسة الحالية.");
    } else if (isAnonymous) {
      setStatus("أنت تستخدم جلسة مؤقتة. اربط بريدك هنا على هذه الجلسة قبل تبديل الجهاز حتى يبقى الملف المهني وطلبات التقديم مرتبطين بالحساب نفسه.");
    } else if (user.email && !confirmed) {
      setStatus("طلب ربط البريد قيد التأكيد. افتح رسالة التأكيد أولًا؛ لن نسمح بتعيين كلمة مرور قبل تأكيد البريد.");
    } else if (user.email && confirmed) {
      setStatus("حسابك مربوط ببريد مؤكد: " + user.email + ". احفظ كلمة المرور لتتمكن من استعادته على جهاز آخر.", "success");
    } else {
      setStatus("اربط بريدًا تملكه بالحساب الحالي لتمكين الاستعادة.");
    }
  }

  async function readSessionUser() {
    if (typeof supabaseClient === "undefined" || !supabaseClient || !supabaseClient.auth) return null;
    try {
      const result = await supabaseClient.auth.getSession();
      return result && result.data && result.data.session ? result.data.session.user : null;
    } catch (_) {
      return null;
    }
  }

  async function ensureSessionUser() {
    let user = await readSessionUser();
    if (!user && typeof sessionUser === "function") {
      try {
        await sessionUser();
        user = await readSessionUser();
      } catch (_) {}
    }
    return user;
  }

  function friendlyAuthError(error, action) {
    const message = String(error && error.message || "").toLowerCase();
    if (/manual linking|identity linking|linking is disabled|not allowed to link/.test(message)) {
      return "إعداد ربط الهويات غير مفعّل في Supabase. لم نغيّر بياناتك؛ يجب على مدير المشروع تفعيل Allow manual linking ثم المحاولة مجددًا.";
    }
    if (/already registered|already been registered|already exists|duplicate|identity.*exists|email.*taken/.test(message)) {
      return "هذا البريد مرتبط بحساب موجود. لا نحاول دمجه تلقائيًا مع الجلسة الحالية؛ استخدم استعادة الحساب من جهاز أو متصفح لا يحتوي ملفًا محليًا غير مربوط.";
    }
    if (/invalid login credentials|invalid credentials/.test(message)) {
      return "تعذر تسجيل الدخول بهذه البيانات. تحقق من البريد وكلمة المرور أو اطلب رابط استعادة.";
    }
    if (/rate limit|too many requests/.test(message)) {
      return "تم تجاوز حد المحاولات مؤقتًا. انتظر قليلًا ثم أعد المحاولة.";
    }
    if (/redirect.*(allow|url)|url.*not allowed/.test(message)) {
      return "عنوان العودة غير مسموح في إعدادات Supabase. أضف رابط تطبيق مَدخَل إلى قائمة Redirect URLs ثم أعد المحاولة.";
    }
    if (/password/.test(message) && /weak|short|length|characters/.test(message)) {
      return "كلمة المرور ضعيفة أو أقصر من الحد المطلوب. استخدم كلمة مرور أطول.";
    }
    return action === "link"
      ? "تعذر إرسال تأكيد البريد الآن. تحقق من البريد وإعدادات المصادقة والبريد الصادر في Supabase؛ لم نحذف ملفك."
      : "تعذر إكمال العملية الآن. لم نحذف بيانات الملف المحلي؛ تحقق من الاتصال وإعدادات المصادقة ثم أعد المحاولة.";
  }

  function validEmail(email) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(email || "").trim());
  }

  function lockButton(id, locked, waitText) {
    const button = byId(id);
    if (!button) return;
    if (locked) {
      if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = waitText || "جارٍ التنفيذ…";
    } else {
      button.disabled = false;
      if (button.dataset.originalText) button.textContent = button.dataset.originalText;
    }
  }

  async function linkCurrentEmail() {
    const email = String(byId("recoveryLinkEmail").value || "").trim().toLowerCase();
    if (!validEmail(email)) {
      setStatus("أدخل بريدًا إلكترونيًا صحيحًا تملكه.", "warning");
      return;
    }
    lockButton("recoveryLinkButton", true, "جارٍ إرسال طلب التأكيد…");
    try {
      if (typeof supabaseClient === "undefined" || !supabaseClient) throw new Error("client unavailable");
      const user = await ensureSessionUser();
      if (!user) {
        setStatus("تعذّر إنشاء جلسة للمستخدم. أعد تحميل الصفحة بعد التحقق من الاتصال.", "warning");
        return;
      }
      if (!user.is_anonymous && user.email && isConfirmed(user)) {
        setStatus("هذا الحساب مربوط بالفعل ببريد مؤكد. استخدم قسم كلمة المرور أدناه.", "success");
        renderPanels(user, "keep");
        return;
      }
      const { data, error } = await supabaseClient.auth.updateUser(
        { email },
        { emailRedirectTo: recoveryRedirectUrl() }
      );
      if (error) throw error;
      const confirmedUser = data && data.user ? data.user : user;
      renderPanels(confirmedUser, "keep");
      setStatus("أرسلنا طلب تأكيد إلى " + email + ". افتح الرسالة على هذا الجهاز أو ارجع إلى مَدخَل بعد التأكيد، ثم عيّن كلمة المرور. إذا لم تصل، افحص البريد غير المرغوب فيه وإعدادات SMTP.", "success");
    } catch (error) {
      setStatus(friendlyAuthError(error, "link"), "warning");
    } finally {
      lockButton("recoveryLinkButton", false);
    }
  }

  async function setCurrentPassword() {
    const password = String(byId("recoveryNewPassword").value || "");
    const confirm = String(byId("recoveryConfirmPassword").value || "");
    if (password.length < 8) {
      setStatus("استخدم كلمة مرور لا تقل عن 8 أحرف.", "warning");
      return;
    }
    if (password !== confirm) {
      setStatus("كلمتا المرور غير متطابقتين.", "warning");
      return;
    }
    lockButton("recoverySetPasswordButton", true, "جارٍ حفظ كلمة المرور…");
    try {
      const user = await readSessionUser();
      if (!user || user.is_anonymous || !user.email || !isConfirmed(user)) {
        setStatus("أكد البريد الإلكتروني أولًا ثم أعد المحاولة. لا يمكن حفظ كلمة المرور لحساب مجهول أو غير مؤكد.", "warning");
        return;
      }
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      byId("recoveryNewPassword").value = "";
      byId("recoveryConfirmPassword").value = "";
      setStatus("تم حفظ كلمة المرور. احتفظ بها؛ ستحتاجها لاستعادة حسابك من جهاز آخر.", "success");
    } catch (error) {
      setStatus(friendlyAuthError(error, "password"), "warning");
    } finally {
      lockButton("recoverySetPasswordButton", false);
    }
  }

  async function signInExistingAccount() {
    const email = String(byId("recoveryLoginEmail").value || "").trim().toLowerCase();
    const password = String(byId("recoveryLoginPassword").value || "");
    if (!validEmail(email) || !password) {
      setStatus("أدخل البريد الإلكتروني وكلمة المرور.", "warning");
      return;
    }
    lockButton("recoveryLoginButton", true, "جارٍ تسجيل الدخول…");
    try {
      const user = await readSessionUser();
      if ((!user || user.is_anonymous) && madkhalHasLocalRecoveryData()) {
        setStatus("أوقفنا تسجيل الدخول لأن هذا المتصفح يحتوي بيانات محلية من جلسة مؤقتة. لم نحذفها ولم نخلطها بحساب آخر. اربط البريد بالحساب الحالي أو استعد الحساب من متصفح/جهاز لا يحتوي بيانات محلية غير مربوطة.", "warning");
        return;
      }
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      byId("recoveryLoginPassword").value = "";
      renderPanels(data && data.user ? data.user : null, "keep");
      setStatus("تم تسجيل الدخول. جارٍ استرجاع ملفك المهني والبيانات المرتبطة بهذا الحساب…", "success");
      try {
        if (typeof loadProfileRemote === "function") await loadProfileRemote();
        if (typeof loadAccount === "function") await loadAccount();
        if (typeof renderNotifications === "function") await renderNotifications();
      } catch (refreshError) {
        console.warn("Madkhal account recovery refresh", refreshError);
      }
      const current = await readSessionUser();
      renderPanels(current, "keep");
      setStatus("تم تسجيل الدخول. افحص الملف المهني والطلبات بعد استرجاع البيانات.", "success");
    } catch (error) {
      setStatus(friendlyAuthError(error, "login"), "warning");
    } finally {
      lockButton("recoveryLoginButton", false);
    }
  }

  async function sendPasswordRecovery() {
    const email = String(byId("recoveryLoginEmail").value || "").trim().toLowerCase();
    if (!validEmail(email)) {
      setStatus("أدخل البريد المرتبط بحسابك أولًا.", "warning");
      return;
    }
    lockButton("recoveryForgotButton", true, "جارٍ إرسال رابط الاستعادة…");
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirectUrl()
      });
      if (error) throw error;
      setStatus("إن كان البريد مرتبطًا بحساب، فستصلك رسالة استعادة. افتحها للعودة إلى مَدخَل ثم احفظ كلمة مرور جديدة. تحقق من مجلد الرسائل غير المرغوب فيها إن تأخرت.", "success");
    } catch (error) {
      setStatus(friendlyAuthError(error, "reset"), "warning");
    } finally {
      lockButton("recoveryForgotButton", false);
    }
  }

  function init() {
    addCard();
    if (typeof supabaseClient === "undefined" || !supabaseClient || !supabaseClient.auth) {
      renderPanels(null, "keep");
      setStatus("تعذّر الاتصال بنظام الحسابات حاليًا. بقي الملف المحلي كما هو.", "warning");
      return;
    }
    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (error) setStatus("تعذّر قراءة جلسة الحساب. لم نغيّر الملف المحلي.", "warning");
      renderPanels(data && data.session ? data.session.user : null);
    }).catch(() => renderPanels(null));
    try {
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        renderPanels(session ? session.user : null);
      });
    } catch (_) {}
    window.addEventListener("pageshow", () => {
      readSessionUser().then((user) => renderPanels(user)).catch(() => {});
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();