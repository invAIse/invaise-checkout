(function () {
  'use strict';

  // 1.3.0 (invAIse card #292): "Order now" asks this site's own AJAX endpoint to start an invAIse
  // checkout and sends the visitor to invAIse's hosted checkout page (details, VAT number,
  // voucher, final price), which then hands over to Stripe for the payment itself.
  var strings = invaiseCheckout.strings;

  function showNotice(kind, title, text) {
    var notice = document.getElementById('invaise-checkout-notice');
    if (!notice) { window.alert(text); return; }
    var box = notice.querySelector('.invaise-checkout-notice');
    box.classList.remove('is-success', 'is-cancelled');
    box.classList.add(kind === 'success' ? 'is-success' : 'is-cancelled');
    notice.querySelector('.invaise-checkout-notice-icon').textContent = kind === 'success' ? '✓' : '×';
    notice.querySelector('.invaise-checkout-popup-title').textContent = title;
    notice.querySelector('.invaise-checkout-notice-text').textContent = text;
    notice.hidden = false;
    notice.querySelector('.invaise-checkout-notice-ok').focus();
  }

  function startCheckout(btn) {
    var container = btn.closest('.invaise-checkout');
    var qtyInput = container.querySelector('.invaise-checkout-quantity');
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = strings.starting;
    var restore = function () { btn.disabled = false; btn.textContent = label; };

    var body = new URLSearchParams({
      action: 'invaise_checkout_submit',
      nonce: invaiseCheckout.nonce,
      activity_id: container.dataset.activityId,
      quantity: qtyInput ? qtyInput.value : 1,
      success_url: container.dataset.successUrl,
      cancel_url: container.dataset.cancelUrl,
    });

    fetch(invaiseCheckout.ajaxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success && data.data && data.data.checkout_url) {
          window.location.href = data.data.checkout_url;
          // Back button (bfcache) must not show a stuck "One moment…" button.
          window.addEventListener('pageshow', restore, { once: true });
          return;
        }
        restore();
        showNotice('error', strings.errorTitle, (data.data && data.data.error) || strings.genericError);
      })
      .catch(function () {
        restore();
        showNotice('error', strings.errorTitle, strings.genericError);
      });
  }

  // 1.2.0: Stripe sends the buyer back with ?invaise_status=success|cancelled (the shortcode's
  // default success/cancel URLs). Show what happens next, then drop the parameter from the
  // address bar so a reload or a shared link doesn't show the message again.
  function showReturnNotice() {
    var status = new URLSearchParams(window.location.search).get('invaise_status');
    if (status !== 'success' && status !== 'cancelled') return;
    var ok = status === 'success';
    showNotice(ok ? 'success' : 'cancelled', ok ? strings.successTitle : strings.cancelTitle, ok ? strings.successText : strings.cancelText);
    if (window.history && window.history.replaceState) {
      var url = new URL(window.location.href);
      url.searchParams.delete('invaise_status');
      window.history.replaceState(null, '', url.toString());
    }
  }

  function closeBackdrop(backdrop) { if (backdrop) backdrop.hidden = true; }

  document.addEventListener('click', function (e) {
    var orderBtn = e.target.closest('.invaise-checkout-order-btn');
    if (orderBtn) {
      if (!orderBtn.disabled) startCheckout(orderBtn);
      return;
    }
    if (e.target.closest('.invaise-checkout-notice-ok') || e.target.closest('.invaise-checkout-popup-close')) {
      closeBackdrop(e.target.closest('.invaise-checkout-popup-backdrop'));
      return;
    }
    if (e.target.classList && e.target.classList.contains('invaise-checkout-popup-backdrop')) {
      closeBackdrop(e.target);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.invaise-checkout-popup-backdrop:not([hidden])').forEach(closeBackdrop);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showReturnNotice);
  } else {
    showReturnNotice();
  }
})();
