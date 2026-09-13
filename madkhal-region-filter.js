/* MADKHAL_MENA_FILTER_V1 */
(function () {
  "use strict";

  // Madkhal serves Syria + MENA opportunities. English is allowed when the job is geographically eligible.
  // The database geo fields are the source of truth; this filter prevents unrelated worldwide jobs.
  const MENA_CLASSES = "MENA,SYRIA";
  const MENA_REGIONS = "middle_east,Middle East & North Africa,Syria";

  function patchClient() {
    if (!window.supabaseClient || window.supabaseClient.__madkhalMenaFilter) return !!window.supabaseClient;

    const client = window.supabaseClient;
    const originalFrom = client.from.bind(client);

    client.from = function (table) {
      const builder = originalFrom(table);
      if (table !== "jobs") return builder;

      let filtered = false;
      const proxy = new Proxy(builder, {
        get(target, prop, receiver) {
          const value = target[prop];
          if (typeof value !== "function") return value;
          return function () {
            const args = Array.prototype.slice.call(arguments);
            if (prop === "range" && !filtered) {
              filtered = true;
              target.or("geo_class.in.(MENA,SYRIA),geo_region.in.(middle_east,Middle East & North Africa,Syria)");
            }
            const result = value.apply(target, args);
            return result === target ? receiver : result;
          };
        }
      });
      return proxy;
    };

    window.supabaseClient.__madkhalMenaFilter = true;
    return true;
  }

  function start() {
    if (patchClient()) return;
    const timer = setInterval(function () {
      if (patchClient()) clearInterval(timer);
    }, 100);
    setTimeout(function () { clearInterval(timer); }, 15000);
  }

  start();
})();
