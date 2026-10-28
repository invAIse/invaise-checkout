(function () {
  'use strict';

  // ── GA4 (invAIse card #391) ─────────────────────────────────────────────────────────────────
  // Purchases are NOT counted here: invAIse sends them to GA4 from its server once Stripe has
  // confirmed the payment. This file only passes the visitor's GA4 ids along (with consent), so
  // that server-side purchase is attributed to the visit, and pushes two non-revenue dataLayer
  // events for GTM. Pure functions first, so they can be unit-tested in Node.

  // _ga cookie "GA1.1.<random>.<timestamp>" (the second number is the domain depth) -> "<random>.<timestamp>".
  function parseGaClientId(cookieValue) {
    var m = /^GA\d+\.\d+\.(\d{1,20})\.(\d{1,20})$/.exec(typeof cookieValue === 'string' ? cookieValue : '');
    return m ? m[1] + '.' + m[2] : null;
  }

  // _ga_<container> cookie: GS1 "GS1.1.<session_id>.<n>.<…>" or GS2 "GS2.1.s<session_id>$o<n>$g…".
  // Anything else -> null: better no session id than a wrong one.
  function parseGaSessionId(cookieValue) {
    var v = typeof cookieValue === 'string' ? cookieValue : '';
    var m = /^GS1\.\d+\.(\d{1,20})\./.exec(v) || /^GS2\.\d+\.s(\d{1,20})(?:\$|$)/.exec(v);
    return m ? m[1] : null;
  }

  // "G-ABC123" -> "_ga_ABC123", the cookie gtag keeps the session in.
  function sessionCookieName(measurementId) {
    var m = /^G-([A-Z0-9]{4,20})$/.exec(typeof measurementId === 'string' ? measurementId : '');
    return m ? '_ga_' + m[1] : null;
  }

  function readCookie(cookieString, name) {
    var parts = (cookieString || '').split(';');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].replace(/^\s+/, '');
      if (p.indexOf(name + '=') === 0) {
        try { return decodeURIComponent(p.slice(name.length + 1)); } catch (e) { return null; }
      }
    }
    return null;
  }

  // { ga_client_id, ga_session_id? } from a cookie string, or {} when there is no valid client id.
  function gaIdsFromCookies(cookieString, measurementId) {
    var clientId = parseGaClientId(readCookie(cookieString, '_ga'));
    if (!clientId) return {};
    var ids = { ga_client_id: clientId };
    var name = sessionCookieName(measurementId);
    var sessionId = name ? parseGaSessionId(readCookie(cookieString, name)) : null;
    if (sessionId) ids.ga_session_id = sessionId;
    return ids;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { parseGaClientId: parseGaClientId, parseGaSessionId: parseGaSessionId,
      sessionCookieName: sessionCookieName, readCookie: readCookie, gaIdsFromCookies: gaIdsFromCookies };
  }
  if (typeof document === 'undefined' || typeof invaiseCheckout === 'undefined') return;

  // ===== CONSENT HOOK: wire this to the cookie banner =====================================
  // Returns true only when the visitor has granted ANALYTICS consent; until then the GA4 ids
  // are not read and not sent (default: false). The banner sets the flag below, e.g. in its
  // "consent given/changed" callback:  window.invaiseCheckoutAnalyticsConsent = true;
  // (with Google Consent Mode that is the moment analytics_storage becomes 'granted').
  // It is read at the moment "Order now" is clicked, so a later change still counts.
  function analyticsConsentGranted() {
    return window.invaiseCheckoutAnalyticsConsent === true;
  }

  function pushDataLayer(obj) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(obj);
  }

  // GTM event, not revenue: the visitor started a checkout.
  function pushBeginCheckout(container, quantity) {
    var item = { item_id: String(container.dataset.activityId), quantity: Number(quantity) || 1 };
    if (container.dataset.itemName) item.item_name = container.dataset.itemName;
    var price = parseFloat(container.dataset.price);
    if (!isNaN(price)) item.price = price;
    var ecommerce = { items: [item] };
    if (container.dataset.currency) ecommerce.currency = container.dataset.currency;
    if (!isNaN(price)) ecommerce.value = Math.round(price * item.quantity * 100) / 100;
    pushDataLayer({ ecommerce: null }); // clear the previous ecommerce object (GTM convention)
    pushDataLayer({ event: 'begin_checkout', ecommerce: ecommerce });
  }

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
    pushBeginCheckout(container, qtyInput ? qtyInput.value : 1);
    btn.disabled = true;
    btn.textContent = strings.starting;
    var restore = function () { btn.disabled = false; btn.textContent = label; };

    // 1.3.3 (card #342): fetch a fresh nonce first; the one printed in a cached page may be stale.
    fetch(invaiseCheckout.ajaxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'action=invaise_checkout_nonce',
      credentials: 'same-origin',
    })
      .then(function (res) { return res.json(); })
      .then(function (data) { return (data && data.success && data.data && data.data.nonce) || invaiseCheckout.nonce; })
      .catch(function () { return invaiseCheckout.nonce; })
      .then(function (nonce) { submitCheckout(container, qtyInput, nonce, restore); });
  }

  function submitCheckout(container, qtyInput, nonce, restore) {
    var body = new URLSearchParams({
      action: 'invaise_checkout_submit',
      nonce: nonce,
      activity_id: container.dataset.activityId,
      quantity: qtyInput ? qtyInput.value : 1,
      success_url: container.dataset.successUrl,
      cancel_url: container.dataset.cancelUrl,
    });
    // Card #391: the GA4 ids only with analytics consent, and only when they parse cleanly.
    if (analyticsConsentGranted()) {
      var ga = gaIdsFromCookies(document.cookie, invaiseCheckout.ga4MeasurementId);
      if (ga.ga_client_id) body.append('ga_client_id', ga.ga_client_id);
      if (ga.ga_session_id) body.append('ga_session_id', ga.ga_session_id);
    }

    fetch(invaiseCheckout.ajaxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      credentials: 'same-origin',
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
    // Card #391: for GTM, before the parameter is removed below. NOT a purchase: this page can be
    // opened without paying, and free trials land here too. invAIse sends the real purchase.
    pushDataLayer({
      event: ok ? 'checkout_return' : 'checkout_cancelled',
      checkout_status: ok ? 'returned from payment, not a confirmed purchase' : 'cancelled at payment',
    });
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
