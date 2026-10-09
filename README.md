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
