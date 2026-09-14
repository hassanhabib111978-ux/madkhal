/* جُهينة — تم إيقاف المساعد الذكي في مَدخَل.
   هذا الملف محفوظ فقط لتجنب كسر أي مرجع قديم من المنصة.
   لا يتم إنشاء واجهة أو مراقبة أخطاء أو تشغيل صوت أو تنفيذ أي منطق.

   PWA bootstrap: تسجيل Service Worker من ملف موجود أصلًا في الصفحة.
*/
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then(function (registration) {
        console.log('مَدخَل PWA: Service Worker registered', registration.scope);
      })
      .catch(function (error) {
        console.warn('مَدخَل PWA: Service Worker registration failed', error);
      });
  });
})();
