(() => {
  'use strict';

  const READY = '__MADKHAL_UI_BRIDGE_READY__';
  if (window[READY]) return;
  window[READY] = true;

  const SELECTOR = 'button,a,[role="button"],input[type="button"],input[type="submit"]';
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();

  function headerOffset() {
    const h = document.querySelector('.header');
    return (h ? h.getBoundingClientRect().height : 0) + 18;
  }

  function focusAndScroll(el, focus) {
    if (!el) return false;
    const y = Math.max(0, window.scrollY + el.getBoundingClientRect().top - headerOffset());
    window.scrollTo({ top: y, behavior: 'smooth' });
    if (focus) setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (_) {} }, 450);
    return true;
  }

  function targetByHints(hints) {
    const nodes = [...document.querySelectorAll('[id],[data-screen],[data-section],section,.screen,.card,.form-group')];
    const scored = nodes.map(el => {
      const hay = norm([el.id, el.getAttribute('data-screen'), el.getAttribute('data-section'), el.textContent].join(' ')).toLowerCase();
      let score = 0;
      hints.forEach(h => { if (hay.includes(h)) score += h.length; });
      return [score, el];
    }).sort((a,b) => b[0] - a[0]);
    return scored[0] && scored[0][0] > 0 ? scored[0][1] : null;
  }

  function firstNameInput() {
    return document.querySelector('#first_name,[name="first_name"],[name="firstName"],input[placeholder*="الاسم الأول"],input[aria-label*="الاسم الأول"]');
  }

  function navigate(label) {
    const t = norm(label).toLowerCase();
    let target = null;
    let focus = false;

    if (t.includes('أبحث عن عمل') || t.includes('ابحث عن عمل') || t.includes('الوظائف') || t.includes('فرص العمل')) {
      target = targetByHints(['فرص العمل','الوظائف','jobs','opportunities','job']);
    } else if (t.includes('لدي فرصة عمل') || t.includes('فرصة عمل') || t.includes('أضف فرصة')) {
      target = targetByHints(['لدي فرصة عمل','إضافة فرصة','نشر فرصة','فرصة عمل','employer']);
    } else if (t.includes('الاشتراك') || t.includes('اشتراك') || t.includes('محفظة مدخل')) {
      target = targetByHints(['الاشتراك','محفظة مدخل','$1','شهري']);
    } else if (t.includes('تقييم') || t.includes('التقييم')) {
      target = targetByHints(['التقييم','تقييم مهني','evaluation']);
    } else if (t.includes('ملف العامل') || t.includes('الملف المهني') || t.includes('إنشاء ملف') || t.includes('بياناتي')) {
      target = firstNameInput() || targetByHints(['ملف العامل','الملف المهني','بياناتي','worker profile']);
      focus = !!firstNameInput();
    } else if (t.includes('الإشعارات') || t.includes('التنبيهات')) {
      target = targetByHints(['الإشعارات','التنبيهات','notifications']);
    }

    if (!target) return false;
    return focusAndScroll(target, focus);
  }

  document.addEventListener('click', e => {
    const el = e.target.closest(SELECTOR);
    if (!el) return;
    const label = norm(el.innerText || el.value || el.getAttribute('aria-label') || el.title);
    if (!label) return;
    if (navigate(label)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // Correct any programmatic screen change after the existing app handler runs.
  const observer = new MutationObserver(() => {
    const active = document.querySelector('.screen.active');
    if (active) active.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

  function extractSupabaseConfig() {
    const html = document.documentElement.innerHTML;
    const patterns = [
      /createClient\s*\(\s*['\"](https:\/\/[^'\"]+\.supabase\.co)['\"]\s*,\s*['\"]([^'\"]+)['\"]/, 
      /SUPABASE_URL\s*=\s*['\"](https:\/\/[^'\"]+\.supabase\.co)['\"][\s\S]{0,500}?SUPABASE_(?:ANON_KEY|PUBLISHABLE_KEY)\s*=\s*['\"]([^'\"]+)['\"]/i
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) return { url: m[1], key: m[2] };
    }
    return null;
  }

  function ensureStyles() {
    if (document.getElementById('madkhal-ui-bridge-style')) return;
    const s = document.createElement('style');
    s.id = 'madkhal-ui-bridge-style';
    s.textContent = `
      .madkhal-live-panel{margin:14px 0;background:#fff;border:1px solid #e3ecea;border-radius:20px;padding:16px;box-shadow:0 5px 18px rgba(20,40,40,.05)}
      .madkhal-live-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
      .madkhal-live-head h3{margin:0;font-size:17px}.madkhal-live-badge{font-size:10px;background:#e7f6f3;color:#0f766e;padding:5px 8px;border-radius:999px;font-weight:800}
      .madkhal-rec{border:1px solid #edf1f1;border-radius:16px;padding:12px;margin:8px 0;background:#fbfcfc}
      .madkhal-rec strong{display:block;font-size:14px;margin-bottom:5px}.madkhal-rec small{color:#687575;line-height:1.6}
      .madkhal-score{display:inline-block;margin-top:7px;background:#0f766e;color:#fff;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800}
      .madkhal-empty{color:#687575;font-size:12px;line-height:1.7}.madkhal-sub{font-size:12px;color:#536161;line-height:1.7}
    `;
    document.head.appendChild(s);
  }

  function findMount() {
    return document.querySelector('main') || document.querySelector('.app') || document.body;
  }

  function ensurePanel() {
    let panel = document.getElementById('madkhal-live-panel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'madkhal-live-panel';
    panel.className = 'madkhal-live-panel';
    panel.innerHTML = '<div class="madkhal-live-head"><h3>فرص مَدخَل المناسبة لك</h3><span class="madkhal-live-badge">مطابقة مباشرة</span></div><div id="madkhal-live-body" class="madkhal-empty">جارٍ تحميل المطابقات…</div>';
    const mount = findMount();
    const active = document.querySelector('.screen.active');
    (active || mount).appendChild(panel);
    return panel;
  }

  async function loadLiveData() {
    if (!window.supabase || !window.supabase.createClient) return;
    const cfg = extractSupabaseConfig();
    if (!cfg) return;
    ensureStyles();
    const client = window.supabase.createClient(cfg.url, cfg.key);
    const { data: userData } = await client.auth.getUser();
    if (!userData || !userData.user) return;

    const panel = ensurePanel();
    const body = panel.querySelector('#madkhal-live-body');

    const [recRes, dashRes] = await Promise.all([
      client.rpc('get_my_opportunity_recommendations', { p_limit: 12 }),
      client.rpc('get_my_madkhal_dashboard')
    ]);

    if (dashRes.data) {
      const d = dashRes.data;
      const sub = d.subscription || {};
      const wp = d.worker_profile || {};
      const parts = [];
      if (wp.profession) parts.push(`الملف: ${wp.profession}`);
      if (sub.status) parts.push(`الاشتراك: ${sub.status === 'active' ? 'نشط' : sub.status}`);
      if (Number(d.unread_notifications || 0)) parts.push(`إشعارات غير مقروءة: ${d.unread_notifications}`);
      if (parts.length) {
        const meta = document.createElement('div');
        meta.className = 'madkhal-sub';
        meta.textContent = parts.join(' · ');
        body.before(meta);
      }
    }

    const rows = recRes.data || [];
    if (recRes.error) {
      body.textContent = 'تعذر تحميل المطابقات حالياً. ستبقى واجهة مَدخَل وباقي وظائفها تعمل بشكل طبيعي.';
      return;
    }
    if (!rows.length) {
      body.textContent = 'لا توجد مطابقات مؤكدة لهذا الحساب بعد. عند تأكيد الملف ستبدأ طبقة المطابقة بإظهار الفرص المناسبة تلقائياً.';
      return;
    }
    body.className = '';
    body.innerHTML = rows.map(r => {
      const score = Math.round(Number(r.overall_score || 0));
      const skills = Array.isArray(r.matched_skills) ? r.matched_skills.slice(0,4).join('، ') : '';
      return `<article class="madkhal-rec"><strong>${escapeHtml(r.title || 'فرصة عمل')}</strong><small>${escapeHtml(r.organization || '')}${r.location ? ' · ' + escapeHtml(r.location) : ''}${r.country ? ' · ' + escapeHtml(r.country) : ''}</small>${skills ? `<small style="display:block;margin-top:4px">المهارات المطابقة: ${escapeHtml(skills)}</small>` : ''}<span class="madkhal-score">مطابقة ${score}%</span></article>`;
    }).join('');
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function boot() {
    setTimeout(loadLiveData, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
