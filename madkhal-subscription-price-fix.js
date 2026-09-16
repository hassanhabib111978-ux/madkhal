(() => {
  'use strict';

  const OLD_PRICE = 'دولار ونصف';
  const NEW_PRICE = 'دولار واحد';

  function fixText(root) {
    if (!root) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    const nodes = [];
    let node;

    while ((node = walker.nextNode())) {
      nodes.push(node);
    }

    nodes.forEach(textNode => {
      if (!textNode.nodeValue || !textNode.nodeValue.includes(OLD_PRICE)) return;
      textNode.nodeValue = textNode.nodeValue.replaceAll(OLD_PRICE, NEW_PRICE);
    });
  }

  function fixSubscriptionDescription() {
    const screen = document.getElementById('subscriptionScreen');
    if (!screen) return;

    const paragraphs = screen.querySelectorAll('.premium-offer p');

    paragraphs.forEach(p => {
      if (!p.textContent.includes('البحث الأساسي مجاني')) return;

      p.textContent =
        'البحث الأساسي مجاني. الاشتراك مخصص للمتابعة المستمرة والتنبيهات عند ظهور فرص جديدة تتوافق مع ملفك وتفضيلاتك. قيمة الاشتراك دولار واحد شهريًا، مقابل استمرار المتابعة اللحظية للفرص المناسبة. تعتمد هذه المتابعة، عند الحاجة، على خدمات مدفوعة مثل الاستضافة وقواعد البيانات وخدمات الإشعارات والمعالجة، لضمان استمرار المتابعة والمطابقة والتنبيهات.';
    });
  }

  function apply() {
    fixText(document.body);
    fixSubscriptionDescription();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  const observer = new MutationObserver(() => {
    apply();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
