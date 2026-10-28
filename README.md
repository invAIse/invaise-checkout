# invAIse Checkout Connector (WordPress plugin)

Shortcode `[invaise_checkout activity_id="…" label="…"]` renders an order button; a click starts an invAIse
hosted checkout (step 1 on invAIse: details, VAT, voucher, price; step 2 on Stripe: payment method).
API key and secret are entered under Settings and stored in WordPress options; none are in this repository.

## Updates
Sites get new versions through WordPress's own "Update available" (Plugin Update Checker, GitHub mode):
every GitHub Release with the asset `invaise-checkout.zip` (folder `invaise-checkout/` inside) is offered.

## Release (on evive, as root)
1. Commit the change in `/var/www/modules-dev/github-invaise-checkout`.
2. `/var/www/modules-dev/release-wp-plugin.sh invaise-checkout X.Y.Z` (bumps version, tags, builds `/tmp/invaise-checkout.zip`).
3. Push `main` and the tag; create the GitHub Release vX.Y.Z with the asset `invaise-checkout.zip`.
4. Install on staging.managedfreescout.com first (ACC), then managedfreescout.com updates itself.
See the Claude Doc "Module release procedure (GitHub)".

## GA4 (invAIse card #391)
Purchases are reported to GA4 by invAIse's server after Stripe confirms the payment (Measurement Protocol), not by
this plugin: the `?invaise_status=success` landing can be opened without paying, and free trials land there too.
- **Consent hook:** `analyticsConsentGranted()` in `assets/invaise-checkout.js` returns
  `window.invaiseCheckoutAnalyticsConsent === true`. The cookie banner must set that flag when the visitor grants
  analytics consent; until then (default) no GA ids are read or sent.
- **Ids:** with consent, "Order now" passes `ga_client_id` (from `_ga`) and `ga_session_id` (from `_ga_<id>`, GS1 and
  GS2 formats) to invAIse. Set **Settings → invAIse Checkout → GA4 Measurement ID** so the session cookie can be found.
  Set the same ID on the Brand in invAIse.
- **dataLayer (no revenue):** `begin_checkout` on click, using the shortcode's optional `item_name`, `price` and `currency`
  attributes. On return it pushes `checkout_return` or `checkout_cancelled`, "returned from payment, not a confirmed
  purchase".
- **Tests:** `node --test tests/*.test.js`. They are kept out of the release zip by `.gitattributes`.
