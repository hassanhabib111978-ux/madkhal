/* MADKHAL_UI_FIX_V1 */
(function () {
  "use strict";

  const IN_SCOPE = "geo_class.in.(MENA,SYRIA)";
  const IN_SCOPE_REGION = "geo_region.in.(middle_east,Middle East & North Africa,Syria)";

  function lockHorizontalViewport() {
    const style = document.createElement("style");
    style.id = "madkhalUiFixStyle";
    style.textContent = `
      html, body { max-width:100%; overflow-x:hidden !important; }
      .app, main, .screen, .card, .search-box, #opportunitiesList { max-width:100%; min-width:0; }
      .opportunity { width:100%; max-width:100%; min-width:0; overflow:hidden; }
      .opportunity-top { width:100%; max-width:100%; min-width:0; flex-wrap:wrap; }
      .opportunity-top > div:first-child { min-width:0; max-width:100%; overflow-wrap:anywhere; }
      .opportunity h3, .opportunity .source-note { overflow-wrap:anywhere; word-break:break-word; }
      .opportunity .salary { max-width:100%; white-space:normal; overflow-wrap:anywhere; }
      #opportunitiesScreen { width:100%; max-width:100%; overflow-x:hidden; }
      #opportunitiesList { width:100%; overflow-x:hidden; }
    `;
    document.head.appendChild(style);
  }

  function resetHorizontalPosition() {
    try {
      window.scrollTo({ left: 0, top: window.pageYOffset, behavior: "auto" });
    } catch (_) {}
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  }

  async function loadScopedCounter() {
    if (!window.supabaseClient) return;
    try {
      const pageSize = 1000;
      let from = 0;
      let total = 0;
      let fresh = 0;
      let expired = 0;
      const now = Date.now();
      const week = now - 7 * 24 * 60 * 60 * 1000;

      while (true) {
        const { data, error } = await supabaseClient
          .from("jobs")
          .select("id,status,posted_at,expires_at,geo_class,geo_region")
          .or(IN_SCOPE + "," + IN_SCOPE_REGION)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const page = Array.isArray(data) ? data : [];
        for (const row of page) {
          const active = String(row.status || "").toLowerCase() === "active";
          const notExpired = !row.expires_at || new Date(row.expires_at).getTime() > now;
          if (active && notExpired) total++;
          if (row.posted_at) {
            const t = new Date(row.posted_at).getTime();
            if (t >= week && t <= now) fresh++;
          }
          if (row.expires_at && new Date(row.expires_at).getTime() < now) expired++;
        }
        if (page.length < pageSize) break;
        from += pageSize;
      }

      if (typeof madkhalJobStats !== "undefined") {
        madkhalJobStats.total = total;
        madkhalJobStats.fresh = fresh;
        madkhalJobStats.expired = expired;
      }
      if (typeof renderMadkhalJobCounter === "function") renderMadkhalJobCounter();
    } catch (e) {
      console.warn("Madkhal scoped counter:", e);
    }
  }

  window.openOpportunities = async function () {
    // Do not anchor to the search input: the user must land at the top of the jobs screen.
    showScreen("opportunitiesScreen");
    resetHorizontalPosition();
    currentCategory = "الكل";
    madkhalJobDisplayLimit = 60;

    const container = document.getElementById("opportunitiesList");
    if (container) {
      container.innerHTML = '<div class="card"><div class="empty-state">⏳ جارٍ تحميل الفرص المتاحة...</div></div>';
    }

    if (typeof loadMadkhalRealJobs === "function") {
      await loadMadkhalRealJobs(false);
    }
    if (typeof renderCategories === "function") renderCategories();
    if (typeof renderOpportunities === "function") renderOpportunities();

    requestAnimationFrame(function () {
      resetHorizontalPosition();
      const screen = document.getElementById("opportunitiesScreen");
      if (screen) {
        const top = window.pageYOffset + screen.getBoundingClientRect().top - getMadkhalStickyOffset();
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "auto" });
      }
    });
  };

  document.addEventListener("DOMContentLoaded", function () {
    lockHorizontalViewport();
    loadScopedCounter();
  });

  lockHorizontalViewport();
})();
