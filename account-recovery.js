/* Madkhal account continuity and sign-in panels for seeker, employer and account screens. */
(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const roots = [];
  let authListenerBound = false;

  function field(root, name) {
    return root ? root.querySelector('[data-field="' + name + '"]') : null;
  }

  function panel(root, name, visible) {
    const node = root && root.querySelector('[data-panel="' + name + '"]');
    if (node) node.classList.toggle("hidden", !visible);
  }

  function setStatus(root, message, kind) {
    const box = field(root, "status");
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

  function isConfirmed(user) {
    return !!(user && (user.email_confirmed_at || user.confirmed_at));
  }

  function hasMeaningfulValue(value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some(hasMeaningfulValue);
    if (typeof value === "object") return Object.values(value).some(hasMeaningfulValue);
    return String(value).trim() !== "";
  }

  // Guard only: never deletes or overwrites local values from a previous identity.
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
      return true;
    }
  }

  function recoveryRedirectUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function lockButton(button, locked, waitText) {
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

  function friendlyAuthError(error, action) {
    const message = String(error && error.message || "").toLowerCase();
    if (/manual linking|identity linking|linking is disabled|not allowed to link/.test(message)) {
      return "إعداد ربط الهويات غير مفعّل في Supabase. لم نغيّر بياناتك؛ يجب تفعيل Allow manual linking ثم المحاولة مجددًا.";
    }
    if (/already registered|already been registered|already exists|duplicate|identity.*exists|email.*taken/.test(message)) {
      return "هذا البريد مرتبط بحساب موجود. لم ندمج بيانات الحسابين تلقائيًا؛ سجّل الدخول من جهاز لا يحتوي ملفًا محليًا غير مربوط.";
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
      ? "تعذر إرسال تأكيد البريد الآن. تحقق من البريد وإعدادات المصادقة والبريد الصادر؛ بقي ملفك كما هو."
      : "تعذر إكمال العملية الآن. لم نحذف بيانات الملف المحلي؛ تحقق من الاتصال وإعدادات المصادقة ثم أعد المحاولة.";
  }

  function renderPanel(root, user, customMessage) {
    const isAnonymous = !user || user.is_anonymous === true;
    const confirmed = isConfirmed(user);
    const permanentWithEmail = !!user && !isAnonymous && !!user.email;

    panel(root, "link", !user || isAnonymous || !user.email);
    panel(root, "login", isAnonymous);
    panel(root, "password", permanentWithEmail && confirmed);
    panel(root, "signed", permanentWithEmail && confirmed);

    if (customMessage) return;
    if (!user) {
      setStatus(root, "لا توجد جلسة نشطة بعد. اربط بريدك بالحساب الحالي أو سجّل الدخول إلى حساب محفوظ.");
    } else if (isAnonymous) {
      setStatus(root, "أنت تستخدم جلسة مؤقتة. ثبّت هذا الحساب ببريد تملكه حتى يبقى ملفك وطلباتك مرتبطين بك عند تغيير الجهاز.");
    } else if (user.email && !confirmed) {
      setStatus(root, "أرسلنا طلب تأكيد البريد إلى " + user.email + ". افتح رسالة التأكيد ثم ارجع إلى مَدخَل لتعيين كلمة المرور.");
    } else if (user.email && confirmed) {
      setStatus(root, "حسابك مثبت ببريد مؤكد: " + user.email + ". يمكنك الآن تعيين كلمة مرور أو تحديثها وتسجيل الدخول من جهاز آخر.", "success");
    } else {
      setStatus(root, "اربط بريدًا تملكه بالحساب الحالي لتمكين الاستعادة.");
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

  async function refreshAfterLogin() {
    try {
      if (typeof loadProfileRemote === "function") await loadProfileRemote();
      if (typeof loadAccount === "function") await loadAccount();
      if (typeof renderNotifications === "function") await renderNotifications();
      if (typeof loadMyEmployerVacancies === "function") await loadMyEmployerVacancies();
    } catch (error) {
      console.warn("Madkhal account refresh", error);
    }
  }

  async function linkCurrentEmail(root) {
    const email = String(field(root, "link-email")?.value || "").trim().toLowerCase();
    const button = field(root, "link-button");
    if (!validEmail(email)) {
      setStatus(root, "أدخل بريدًا إلكترونيًا صحيحًا تملكه.", "warning");
      return;
    }
    lockButton(button, true, "جارٍ إرسال طلب التأكيد…");
    try {
      if (typeof supabaseClient === "undefined" || !supabaseClient) throw new Error("client unavailable");
      const user = await ensureSessionUser();
      if (!user) {
        setStatus(root, "تعذّر إنشاء جلسة للمستخدم. أعد تحميل الصفحة بعد التحقق من الاتصال.", "warning");
        return;
      }
      if (!user.is_anonymous && user.email && isConfirmed(user)) {
        setStatus(root, "هذا الحساب مثبت بالفعل ببريد مؤكد. استخدم قسم كلمة المرور أدناه.", "success");
        renderPanel(root, user, "keep");
        return;
      }
      const { data, error } = await supabaseClient.auth.updateUser(
        { email },
        { emailRedirectTo: recoveryRedirectUrl() }
      );
      if (error) throw error;
      const updatedUser = data && data.user ? data.user : user;
      renderPanel(root, updatedUser, "keep");
      setStatus(root, "أرسلنا رسالة تأكيد إلى " + email + ". افتحها من صندوق الوارد، ثم ارجع إلى مَدخَل واحفظ كلمة المرور. إذا لم تصل، افحص الرسائل غير المرغوب فيها.", "success");
    } catch (error) {
      setStatus(root, friendlyAuthError(error, "link"), "warning");
    } finally {
      lockButton(button, false);
    }
  }

  async function setCurrentPassword(root) {
    const password = String(field(root, "new-password")?.value || "");
    const confirm = String(field(root, "confirm-password")?.value || "");
    if (password.length < 8) {
      setStatus(root, "استخدم كلمة مرور لا تقل عن 8 أحرف.", "warning");
      return;
    }
    if (password !== confirm) {
      setStatus(root, "كلمتا المرور غير متطابقتين.", "warning");
      return;
    }
    const button = field(root, "password-button");
    lockButton(button, true, "جارٍ حفظ كلمة المرور…");
    try {
      const user = await readSessionUser();
      if (!user || user.is_anonymous || !user.email || !isConfirmed(user)) {
        setStatus(root, "أكد البريد الإلكتروني أولًا ثم أعد المحاولة. لا يمكن حفظ كلمة المرور لحساب مجهول أو غير مؤكد.", "warning");
        return;
      }
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      field(root, "new-password").value = "";
      field(root, "confirm-password").value = "";
      setStatus(root, "تم حفظ كلمة المرور بأمان لدى نظام الحسابات. لا تُحفظ في المتصفح.", "success");
    } catch (error) {
      setStatus(root, friendlyAuthError(error, "password"), "warning");
    } finally {
      lockButton(button, false);
    }
  }

  async function signInExistingAccount(root) {
    const email = String(field(root, "login-email")?.value || "").trim().toLowerCase();
    const password = String(field(root, "login-password")?.value || "");
    if (!validEmail(email) || !password) {
      setStatus(root, "أدخل البريد الإلكتروني وكلمة المرور.", "warning");
      return;
    }
    const button = field(root, "login-button");
    lockButton(button, true, "جارٍ تسجيل الدخول…");
    try {
      const user = await readSessionUser();
      if ((!user || user.is_anonymous) && madkhalHasLocalRecoveryData()) {
        setStatus(root, "أوقفنا تسجيل الدخول لأن هذا المتصفح يحتوي بيانات محلية من جلسة مؤقتة. لم نحذفها ولم نخلطها بحساب آخر. اربط البريد بالحساب الحالي أو استخدم جهازًا لا يحتوي بيانات محلية غير مربوطة.", "warning");
        return;
      }
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      field(root, "login-password").value = "";
      renderPanel(root, data && data.user ? data.user : null, "keep");
      setStatus(root, "تم تسجيل الدخول. جارٍ استرجاع ملفك وطلباتك المرتبطة بهذا الحساب…", "success");
      await refreshAfterLogin();
      renderPanel(root, await readSessionUser());
    } catch (error) {
      setStatus(root, friendlyAuthError(error, "login"), "warning");
    } finally {
      lockButton(button, false);
    }
  }

  async function sendPasswordRecovery(root) {
    const email = String(field(root, "login-email")?.value || "").trim().toLowerCase();
    if (!validEmail(email)) {
      setStatus(root, "أدخل البريد المرتبط بحسابك أولًا.", "warning");
      return;
    }
    const button = field(root, "forgot-button");
    lockButton(button, true, "جارٍ إرسال رابط الاستعادة…");
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirectUrl()
      });
      if (error) throw error;
      setStatus(root, "إن كان البريد مرتبطًا بحساب، فستصلك رسالة استعادة. افتحها للعودة إلى مَدخَل ثم احفظ كلمة مرور جديدة.", "success");
    } catch (error) {
      setStatus(root, friendlyAuthError(error, "reset"), "warning");
    } finally {
      lockButton(button, false);
    }
  }

  function mountCard(containerId, prefix, heading, description) {
    const container = byId(containerId);
    if (!container || byId(prefix + "AccountCard")) return;
    const card = document.createElement("div");
    card.className = "card madkhal-account-card";
    card.id = prefix + "AccountCard";
    card.innerHTML = [
      "<h3>" + heading + "</h3>",
      "<p>" + description + "</p>",
      '<div data-field="status" class="notice" role="status" aria-live="polite">جارٍ التحقق من حالة الحساب…</div>',
      '<div data-panel="link" class="hidden">',
        '<div class="form-group"><label>البريد الإلكتروني لتثبيت الحساب والتواصل</label>',
        '<input data-field="link-email" type="email" autocomplete="email" inputmode="email" placeholder="name@example.com"></div>',
        '<button data-field="link-button" type="button" class="primary-btn" style="width:100%">تثبيت حسابي بهذا البريد</button>',
        '<p class="notice">سنرسل رسالة تأكيد إلى بريدك. بعد تأكيده ستتمكن من تعيين كلمة المرور. هذا البريد لا يظهر تلقائيًا في بطاقات الفرص العامة.</p>',
      "</div>",
      '<div data-panel="password" class="hidden">',
        '<div class="form-group"><label>كلمة المرور الجديدة (8 أحرف على الأقل)</label>',
        '<input data-field="new-password" type="password" autocomplete="new-password" minlength="8" placeholder="كلمة مرور قوية"></div>',
        '<div class="form-group"><label>تأكيد كلمة المرور</label>',
        '<input data-field="confirm-password" type="password" autocomplete="new-password" minlength="8" placeholder="أعد كتابة كلمة المرور"></div>',
        '<button data-field="password-button" type="button" class="primary-btn" style="width:100%">حفظ كلمة المرور</button>',
      "</div>",
      '<div data-panel="login" class="hidden">',
        '<hr style="border:0;border-top:1px solid var(--line);margin:16px 0">',
        '<h4 style="margin:0 0 10px">لديك حساب مثبت مسبقًا؟</h4>',
        '<div class="form-group"><label>البريد الإلكتروني</label>',
        '<input data-field="login-email" type="email" autocomplete="username" inputmode="email" placeholder="name@example.com"></div>',
        '<div class="form-group"><label>كلمة المرور</label>',
        '<input data-field="login-password" type="password" autocomplete="current-password" placeholder="كلمة المرور"></div>',
        '<button data-field="login-button" type="button" class="secondary-btn" style="width:100%">تسجيل الدخول واستعادة ملفي</button>',
        '<button data-field="forgot-button" type="button" class="secondary-btn" style="width:100%;margin-top:8px">نسيت كلمة المرور؟ أرسل رابط استعادة</button>',
        '<p class="notice">لن نخلط بيانات جلسة مؤقتة بحساب آخر. إذا كان هذا الجهاز يحتوي ملفًا غير مربوط، سنوقف تسجيل الدخول بدلًا من نقل بياناته تلقائيًا.</p>',
      "</div>"
    ].join("");

    const anchor = container.querySelector(".card");
    if (anchor) anchor.insertAdjacentElement("afterend", card);
    else container.prepend(card);
    roots.push(card);

    field(card, "link-button").addEventListener("click", () => linkCurrentEmail(card));
    field(card, "password-button").addEventListener("click", () => setCurrentPassword(card));
    field(card, "login-button").addEventListener("click", () => signInExistingAccount(card));
    field(card, "forgot-button").addEventListener("click", () => sendPasswordRecovery(card));
    readSessionUser().then((user) => renderPanel(card, user)).catch(() => renderPanel(card, null));
  }

  function renderAll(user) {
    roots.forEach((root) => renderPanel(root, user));
  }

  function init() {
    // Keep account identity/recovery tooling in the repository for the paid phase,
    // but do not expose email or password fields during the free-launch workflow.
    if (window.MADKHAL_ACCOUNT_EMAIL_UI_ENABLED !== true) return;

    mountCard(
      "workerScreen",
      "worker",
      "🔐 تثبيت حساب الباحث",
      "أضف بريدك الإلكتروني وكلمة مرور لتثبيت حسابك، والعودة إلى ملفك وطلباتك من أي جهاز. البريد مخصص لهوية الدخول والتواصل المرتبط بحسابك."
    );
    mountCard(
      "employerScreen",
      "employer",
      "🔐 تثبيت حساب صاحب الفرصة",
      "أضف بريدك الإلكتروني وثبّت حسابك حتى تتمكن من الدخول مجددًا وإدارة فرصك والرد على الباحثين من أي جهاز."
    );
    mountCard(
      "accountScreen",
      "accountRecovery",
      "🔐 حفظ حسابك واستعادته",
      "اربط بريدك بالحساب الحالي كي يبقى ملفك وطلباتك مرتبطين بك عند تبديل الجهاز."
    );

    if (typeof supabaseClient === "undefined" || !supabaseClient || !supabaseClient.auth) {
      renderAll(null);
      roots.forEach((root) => setStatus(root, "تعذّر الاتصال بنظام الحسابات حاليًا. بقي ملفك المحلي كما هو.", "warning"));
      return;
    }

    supabaseClient.auth.getSession().then(({ data, error }) => {
      if (error) {
        roots.forEach((root) => setStatus(root, "تعذّر قراءة جلسة الحساب. لم نغيّر الملف المحلي.", "warning"));
      }
      renderAll(data && data.session ? data.session.user : null);
    }).catch(() => renderAll(null));

    if (!authListenerBound) {
      try {
        supabaseClient.auth.onAuthStateChange((_event, session) => {
          renderAll(session ? session.user : null);
        });
        authListenerBound = true;
      } catch (_) {}
    }

    window.addEventListener("pageshow", () => {
      readSessionUser().then(renderAll).catch(() => {});
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();