/* MADKHAL_DESCRIPTION_FIX_V1 */
(function () {
  "use strict";

  function cleanDescription(value) {
    let s = String(value || "");

    // Handle malformed opening tags sometimes present in imported descriptions, e.g. "h3>".
    s = s.replace(/(^|[>\s])(h[1-6]|p|ul|ol|li|div|section|br)(?=>)/gi, "$1");

    // Convert common block/list markup into readable separators and bullets.
    s = s.replace(/<li\b[^>]*>/gi, "\n• ");
    s = s.replace(/<\/?(?:h[1-6]|p|ul|ol|div|section|br)\b[^>]*>/gi, "\n");

    // Keep the visible text of links while removing their HTML wrapper.
    s = s.replace(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi, "$1");

    // Remove any remaining HTML tags.
    s = s.replace(/<[^>]+>/g, " ");

    // Decode HTML entities such as &amp;, &quot;, and numeric entities.
    const ta = document.createElement("textarea");
    ta.innerHTML = s;
    s = ta.value;

    // Clean whitespace without destroying useful bullet lines.
    s = s.replace(/[ \t]+/g, " ");
    s = s.replace(/\n[ \t]+/g, "\n");
    s = s.replace(/\n{3,}/g, "\n\n");
    return s.trim();
  }

  function fixRenderedDescriptions() {
    const root = document.getElementById("opportunitiesList");
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    nodes.forEach(function (textNode) {
      const raw = textNode.nodeValue || "";
      if (!/(?:<\/?(?:p|h[1-6]|ul|ol|li|div|section|a|br)\b|(?:^|\s)h[1-6]>|&(?:amp|lt|gt|quot|#\d+);)/i.test(raw)) return;
      const cleaned = cleanDescription(raw);
      if (cleaned && cleaned !== raw) textNode.nodeValue = cleaned;
    });
  }

  function start() {
    fixRenderedDescriptions();
    const root = document.getElementById("opportunitiesList");
    if (!root) return;
    const observer = new MutationObserver(function () {
      fixRenderedDescriptions();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    setInterval(fixRenderedDescriptions, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
