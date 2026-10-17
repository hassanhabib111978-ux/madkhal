(function () {
  'use strict';

  function installArabicOccupationPicker() {
    if (window.__MADKHAL_ESCO_PICKER__) return;
    window.__MADKHAL_ESCO_PICKER__ = true;

    function addStyles() {
      if (document.getElementById('madkhal-esco-picker-style')) return;
      var style = document.createElement('style');
      style.id = 'madkhal-esco-picker-style';
      style.textContent = `
        #madkhalEscoPicker{position:relative;margin:12px 0 14px}
        #madkhalEscoPicker label{display:block;margin-bottom:7px;font-weight:800;font-size:13px}
        #madkhalOccupationSearch{width:100%;padding:13px 14px;border:1px solid #cfe4e1;border-radius:14px;background:#fff;outline:none}
        #madkhalOccupationSearch:focus{border-color:#0f766e;box-shadow:0 0 0 3px rgba(15,118,110,.08)}
        #madkhalOccupationResults{display:none;position:absolute;z-index:80;left:0;right:0;top:74px;max-height:260px;overflow:auto;background:#fff;border:1px solid #dbe8e6;border-radius:14px;box-shadow:0 12px 28px rgba(20,40,40,.15)}
        .madkhal-esco-option{display:block;width:100%;text-align:right;background:#fff;padding:12px 14px;border-bottom:1px solid #edf2f1;color:#172121}
        .madkhal-esco-option:last-child{border-bottom:0}
        .madkhal-esco-option strong{display:block;color:#0f766e;font-size:13px;margin-bottom:3px}
        .madkhal-esco-option span{font-size:10px;color:#788383}
        #madkhalOccupationStatus{font-size:11px;color:#6b7777;margin-top:5px}
        #madkhalSkillAssessment{margin:12px 0 16px}
        .madkhal-skill-card{background:#fff;border:1px solid #e3ecea;border-radius:15px;padding:12px;margin-top:8px}
        .madkhal-skill-name{font-weight:800;font-size:13px;line-height:1.6;margin-bottom:9px}
        .madkhal-skill-scale{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}
        .madkhal-skill-scale label{font-size:10px;text-align:center;color:#667373}
        .madkhal-skill-scale input{display:block;margin:0 auto 3px;accent-color:#0f766e}
        #madkhalSkillStatus{font-size:11px;color:#6b7777;margin-top:6px;line-height:1.6}
      `;
      document.head.appendChild(style);
    }

    function escapeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>'"]/g, function (c) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c];
      });
    }

    async function loadOccupationSkills(uri) {
      var area = document.getElementById('madkhalSkillAssessment');
      if (!area || !uri || !window.supabaseClient) return;
      var status = document.getElementById('madkhalSkillStatus');
      area.style.display = 'block';
      status.textContent = 'جاري تحميل المهارات العربية المرتبطة بهذه المهنة…';
      var response = await window.supabaseClient.rpc('get_madkhal_occupation_skills', { occupation_uri_input: uri, result_limit: 12 });
      if (response.error) {
        console.warn('ESCO skill load:', response.error);
        status.textContent = 'تعذر تحميل المهارات حاليًا.';
        return;
      }
      var skills = response.data || [];
      var list = document.getElementById('madkhalSkillList');
      list.innerHTML = '';
      skills.forEach(function (skill, index) {
        var card = document.createElement('div');
        card.className = 'madkhal-skill-card';
        var options = '';
        for (var n = 0; n <= 5; n++) {
          options += '<label><input type="radio" name="madkhal_skill_' + index + '" data-skill-uri="' + escapeHtml(skill.skill_uri) + '" data-skill-label="' + escapeHtml(skill.skill_label) + '" value="' + n + '"' + (n === 0 ? ' checked' : '') + '>' + n + '</label>';
        }
        card.innerHTML = '<div class="madkhal-skill-name">' + escapeHtml(skill.skill_label) + '</div><div class="madkhal-skill-scale">' + options + '</div>';
        list.appendChild(card);
      });
      status.textContent = skills.length ? 'قيّم كل مهارة من 0 إلى 5. هذه النتيجة تستخدم لاحقًا في المطابقة.' : 'لا توجد مهارات مرتبطة بهذه المهنة في البيانات الحالية.';
    }

    function buildPicker() {
      var skill = document.getElementById('workerSkill');
      if (!skill || document.getElementById('madkhalEscoPicker')) return;
      addStyles();
      var box = document.createElement('div');
      box.id = 'madkhalEscoPicker';
      box.innerHTML = `
        <label for="madkhalOccupationSearch">المهنة المعتمدة</label>
        <input id="madkhalOccupationSearch" type="search" autocomplete="off" placeholder="ابحث عن مهنتك بالعربية…">
        <input id="madkhalOccupationUri" type="hidden">
        <input id="madkhalOccupationLabel" type="hidden">
        <div id="madkhalOccupationResults"></div>
        <div id="madkhalOccupationStatus">اختر المهنة من قائمة مَدخَل حتى تدخل في التقييم والمطابقة.</div>
        <div id="madkhalSkillAssessment" style="display:none" class="card">
          <h3 style="margin:0 0 4px">تقييم مهارات المهنة</h3>
          <p style="margin:0;color:#657070;font-size:12px;line-height:1.7">قيّم نفسك لكل مهارة: 0 = لا أمتلكها، 5 = متمكن جدًا.</p>
          <div id="madkhalSkillList"></div>
          <div id="madkhalSkillStatus">اختر المهنة أولًا.</div>
        </div>
      `;
      skill.parentNode.insertBefore(box, skill);

      var search = document.getElementById('madkhalOccupationSearch');
      var results = document.getElementById('madkhalOccupationResults');
      var status = document.getElementById('madkhalOccupationStatus');
      var timer = null;

      async function runSearch(text) {
        if (!window.supabaseClient || typeof window.supabaseClient.rpc !== 'function') {
          status.textContent = 'تعذر الاتصال بقائمة المهن حاليًا.'; return;
        }
        status.textContent = 'جاري البحث…';
        var response = await window.supabaseClient.rpc('search_madkhal_occupations', { search_text: text || '', result_limit: 20 });
        if (response.error) {
          console.warn('ESCO occupation search:', response.error);
          status.textContent = 'تعذر تحميل المهن حاليًا.'; return;
        }
        results.innerHTML = '';
        (response.data || []).forEach(function (item) {
          var button = document.createElement('button');
          button.type = 'button'; button.className = 'madkhal-esco-option';
          button.innerHTML = '<strong>' + escapeHtml(item.preferred_label) + '</strong><span>ISCO: ' + escapeHtml(item.isco_group || '') + '</span>';
          button.addEventListener('click', function () {
            search.value = item.preferred_label || '';
            document.getElementById('madkhalOccupationUri').value = item.concept_uri || '';
            document.getElementById('madkhalOccupationLabel').value = item.preferred_label || '';
            status.textContent = '✓ تم اختيار المهنة وستدخل في التقييم والمطابقة.';
            results.style.display = 'none';
            loadOccupationSkills(item.concept_uri || '');
          });
          results.appendChild(button);
        });
        results.style.display = results.children.length ? 'block' : 'none';
        if (results.children.length) status.textContent = 'اختر المهنة المناسبة من النتائج.';
        else status.textContent = 'لم نجد مهنة مطابقة؛ جرّب كلمة أخرى.';
      }

      search.addEventListener('input', function () {
        document.getElementById('madkhalOccupationUri').value = '';
        document.getElementById('madkhalOccupationLabel').value = '';
        document.getElementById('madkhalSkillAssessment').style.display = 'none';
        clearTimeout(timer);
        timer = setTimeout(function () { runSearch(search.value.trim()); }, 180);
      });
      search.addEventListener('focus', function () { runSearch(search.value.trim()); });
      document.addEventListener('click', function (event) { if (!box.contains(event.target)) results.style.display = 'none'; });
      window.__MADKHAL_ESCCO_READY__ = true;
    }

    async function saveSkillAssessment() {
      var uri = (document.getElementById('madkhalOccupationUri')?.value || '').trim();
      if (!uri || !window.supabaseClient) return;
      try {
        var auth = await window.supabaseClient.auth.getUser();
        var user = auth && auth.data && auth.data.user;
        if (!user) return;
        var rows = [];
        document.querySelectorAll('#madkhalSkillList input[type="radio"]:checked').forEach(function (input) {
          rows.push({ user_id:user.id, occupation_uri:uri, skill_uri:input.dataset.skillUri, skill_label:input.dataset.skillLabel, rating:Number(input.value), updated_at:new Date().toISOString() });
        });
        if (rows.length) {
          var saved = await window.supabaseClient.from('worker_skill_assessments').upsert(rows, { onConflict:'user_id,occupation_uri,skill_uri' });
          if (saved.error) console.warn('Madkhal skill assessment save:', saved.error);
        }
      } catch (error) { console.warn('Madkhal skill assessment save:', error); }
    }

    function wrapSaveWorkerForOccupation() {
      if (window.__MADKHAL_ESCO_SAVE_WRAPPED__ || typeof window.saveWorker !== 'function') return;
      window.__MADKHAL_ESCO_SAVE_WRAPPED__ = true;
      var originalSaveWorker = window.saveWorker;
      window.saveWorker = async function () {
        var result = await originalSaveWorker.apply(this, arguments);
        var uri = (document.getElementById('madkhalOccupationUri')?.value || '').trim();
        var label = (document.getElementById('madkhalOccupationLabel')?.value || '').trim();
        if (!uri || !label || !window.supabaseClient) return result;
        try {
          var auth = await window.supabaseClient.auth.getUser();
          var user = auth && auth.data && auth.data.user;
          if (!user) return result;
          var saved = await window.supabaseClient.from('worker_profiles').update({ occupation_uri:uri, occupation_label:label }).eq('user_id', user.id);
          if (saved.error) console.warn('Madkhal ESCO occupation save:', saved.error);
          await saveSkillAssessment();
        } catch (error) { console.warn('Madkhal ESCO occupation save:', error); }
        return result;
      };
    }

    function boot() { buildPicker(); wrapSaveWorkerForOccupation(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
    else boot();
    window.addEventListener('load', boot, { once:true });
    setTimeout(boot, 400);
  }


  installArabicOccupationPicker();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js', { scope:'./' })
        .then(function (registration) { console.log('مَدخَل PWA: Service Worker registered', registration.scope); })
        .catch(function (error) { console.warn('مَدخَل PWA: Service Worker registration failed', error); });
    });
  }
})();