/* MADKHAL_TRANSLATE_V1 */
(function () {
  "use strict";

  const ROOT_ID = "opportunitiesList";
  const BUTTON_CLASS = "madkhal-translate-btn";
  const CACHE_PREFIX = "madkhal_ar_translation_v1:";

  function hasEnoughEnglish(text) {
    const s = String(text || "").trim();
    if (!s) return false;
    const latin = (s.match(/[A-Za-z]/g) || []).length;
    const arabic = (s.match(/[\u0600-\u06FF]/g) || []).length;
    return latin >= 8 && latin > arabic;
  }

  function key(text) {
    let h = 2166136261;
    const s = String(text || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return CACHE_PREFIX + (h >>> 0).toString(16);
  }

  function clean(text) {
    return String(text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  async function translateChunk(text) {
    const source = clean(text);
    if (!source || !hasEnoughEnglish(source)) return source;

    const cacheKey = key(source);
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return cached;
    } catch (_) {}

    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=" + encodeURIComponent(source);
    const response = await fetch(url, { method: "GET", mode: "cors" });
    if (!response.ok) throw new Error("translation_http_" + response.status);
    const data = await response.json();
    const result = Array.isArray(data) && Array.isArray(data[0])
      ? data[0].map(function (part) { return part && part[0] ? part[0] : ""; }).join("")
      : "";
    if (!result.trim()) throw new Error("empty_translation");

    try { sessionStorage.setItem(cacheKey, result); } catch (_) {}
    return result;
  }

  async function translateText(text) {
    const source = clean(text);
    if (!hasEnoughEnglish(source)) return source;
    const parts = [];
    let rest = source;
    while (rest.length > 1800) {
      let cut = rest.lastIndexOf("\n", 1800);
      if (cut < 900) cut = rest.lastIndexOf(". ", 1800);
      if (cut < 900) cut = 1800;
      parts.push(rest.slice(0, cut));
      rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    const translated = [];
    for (const part of parts) translated.push(await translateChunk(part));
    return translated.join("\n");
  }

  function findTextTargets(card) {
    const targets = [];
    const title = card.querySelector("h1,h2,h3,h4,h5,.title,.job-title,.opportunity-title");
    if (title && hasEnoughEnglish(title.textContent)) targets.push(title);

    const candidates = Array.from(card.querySelectorAll("p,.description,.job-description,.opportunity-description,.details,.job-details"));
    candidates.forEach(function (el) {
      if (!targets.includes(el) && hasEnoughEnglish(el.textContent)) targets.push(el);
    });

    return targets;
  }

  async function translateCard(card, button) {
    if (button.dataset.busy === "1") return;
    const targets = findTextTargets(card);
    if (!targets.length) {
      button.textContent = "العربية ✓";
      button.disabled = true;
      return;
    }

    button.dataset.busy = "1";
    button.disabled = true;
    const originals = targets.map(function (el) { return el.textContent; });
    try {
      button.textContent = "⏳ ترجمة...";
      for (let i = 0; i < targets.length; i++) {
        const translated = await translateText(originals[i]);
        if (translated && translated !== originals[i]) targets[i].textContent = translated;
      }
      button.textContent = "العربية ✓";
      button.title = "تمت الترجمة للعربية على هذا الجهاز فقط";
    } catch (e) {
      console.warn("Madkhal translation:", e);
      button.textContent = "تعذر الترجمة";
      setTimeout(function () {
        button.textContent = "🇸🇦 ترجمة للعربية";
        button.disabled = false;
        button.dataset.busy = "0";
      }, 1800);
      return;
    }
    button.dataset.busy = "0";
  }

  function styleButton(button) {
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = "🇸🇦 ترجمة للعربية";
    button.style.cssText = "display:block;width:100%;margin:10px 0 4px;padding:9px 12px;border:1px solid rgba(0,120,140,.25);border-radius:12px;background:#f5fbfc;color:#075e6d;font-weight:700;font-size:14px;cursor:pointer;";
  }

  function enhance() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.querySelectorAll(".opportunity").forEach(function (card) {
      if (card.querySelector("." + BUTTON_CLASS)) return;
      const targets = findTextTargets(card);
      if (!targets.length) return;
      const button = document.createElement("button");
      styleButton(button);
      button.addEventListener("click", function () { translateCard(card, button); });
      const anchor = card.querySelector(".opportunity-actions,.actions,.buttons") || card.lastElementChild;
      if (anchor) anchor.insertAdjacentElement("beforebegin", button);
      else card.appendChild(button);
    });
  }

  function start() {
    enhance();
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const observer = new MutationObserver(enhance);
    observer.observe(root, { childList: true, subtree: true });
    setInterval(enhance, 2000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
