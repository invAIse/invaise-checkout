<?php
if (!defined('ABSPATH')) exit;

// 1.3.0 (invAIse card #292): the email popup is gone. "Order now" asks invAIse to start a
// checkout (POST /api/v1/checkout/start, server-to-server, credentials stay here) and sends the
// visitor to invAIse's hosted checkout page, which asks for the email, address, VAT number and
// voucher and shows the final price incl. VAT before Stripe. History of the 1.2.0 popup below.
//
// Card #174: replaces the old self-contained inline form (email + quantity + submit) with
// quantity + "Order Now" only on the page itself, plus a single shared popup (email + Continue)
// triggered by whichever button was clicked. Multiple [invaise_checkout] buttons on one page
// (e.g. a 3-tier pricing page) no longer produce duplicate visible "Email address" fields --
// there's exactly one popup in the DOM, populated per-click from that button's own data
// attributes. No email/quantity/business logic moved into the browser: the popup still only
// ever talks to THIS plugin's own AJAX endpoint below, which makes the same server-to-server
// call to invAIse the old admin-post handler made -- the Brand's api_key:api_secret still never
// reaches the browser, same non-negotiable design principle as before this card.

// [invaise_checkout activity_id="1" label="Order now" quantity_field="true"
//                    quantity_label="Number of users" quantity_default="1"
//                    success_url="..." cancel_url="..."]
// product="..." (1.2.0) is still accepted but no longer shown (1.3.0: the checkout page shows the product).
add_shortcode('invaise_checkout', function ($atts) {
    static $instance_count = 0;
    $instance_count++;

    $atts = shortcode_atts([
        'activity_id'      => '',
        'product'           => '',
        'label'             => 'Order now',
        'quantity_field'    => 'false',
        'quantity_label'    => 'Quantity',
        'quantity_default'  => '1',
        'success_url'       => '',
        'cancel_url'        => '',
    ], $atts, 'invaise_checkout');

    if (empty($atts['activity_id']) || !ctype_digit((string) $atts['activity_id'])) {
        return '<p><em>invAIse Checkout: activity_id is required.</em></p>';
    }

    // Assets + the shared popup markup are only added to the page once, and only when the
    // shortcode is actually used -- registered here (not unconditionally on every page load)
    // even though the actual print happens later in wp_footer/wp_print_scripts.
    invaise_checkout_enqueue_assets();

    $show_quantity = filter_var($atts['quantity_field'], FILTER_VALIDATE_BOOLEAN);
    $qty_default   = max(1, (int) $atts['quantity_default']);
    $instance_id   = 'invaise-checkout-' . $instance_count;

    $current_url = home_url(add_query_arg(null, null));
    $success_url = $atts['success_url'] ?: add_query_arg('invaise_status', 'success', $current_url);
    $cancel_url  = $atts['cancel_url']  ?: add_query_arg('invaise_status', 'cancelled', $current_url);

    ob_start();
    ?>
    <div class="invaise-checkout" id="<?php echo esc_attr($instance_id); ?>"
         data-activity-id="<?php echo esc_attr($atts['activity_id']); ?>"
         data-product="<?php echo esc_attr($atts['product']); ?>"
         data-success-url="<?php echo esc_attr($success_url); ?>"
         data-cancel-url="<?php echo esc_attr($cancel_url); ?>">
        <?php if ($show_quantity): ?>
        <p class="invaise-checkout-quantity-row">
            <label>
                <?php echo esc_html($atts['quantity_label']); ?><br />
                <input type="number" class="invaise-checkout-quantity" min="1" step="1"
                       value="<?php echo esc_attr($qty_default); ?>" style="width:80px" />
            </label>
        </p>
        <?php endif; ?>
        <button type="button" class="invaise-checkout-order-btn"><?php echo esc_html($atts['label']); ?></button>
    </div>
    <?php
    return ob_get_clean();
});

// The shared notice popup (return from payment, or a checkout that could not start), printed
// once -- hooked to wp_footer so it always lands after every shortcode instance in the DOM.
function invaise_checkout_print_popup_once() {
    static $printed = false;
    if ($printed) return;
    $printed = true;
    ?>
    <div id="invaise-checkout-notice" class="invaise-checkout-popup-backdrop" hidden>
        <div class="invaise-checkout-popup invaise-checkout-notice" role="dialog" aria-modal="true" aria-labelledby="invaise-checkout-notice-title">
            <button type="button" class="invaise-checkout-popup-close" aria-label="Close">&times;</button>
            <div class="invaise-checkout-notice-icon" aria-hidden="true"></div>
            <h3 id="invaise-checkout-notice-title" class="invaise-checkout-popup-title"></h3>
            <p class="invaise-checkout-popup-intro invaise-checkout-notice-text"></p>
            <button type="button" class="invaise-checkout-popup-continue invaise-checkout-notice-ok">OK</button>
        </div>
    </div>
    <?php
}
add_action('wp_footer', 'invaise_checkout_print_popup_once');

function invaise_checkout_enqueue_assets() {
    static $enqueued = false;
    if ($enqueued) return;
    $enqueued = true;

    wp_enqueue_style(
        'invaise-checkout',
        plugins_url('assets/invaise-checkout.css', INVAISE_CHECKOUT_PLUGIN_DIR . 'invaise-checkout.php'),
        [],
        INVAISE_CHECKOUT_VERSION
    );
    wp_enqueue_script(
        'invaise-checkout',
        plugins_url('assets/invaise-checkout.js', INVAISE_CHECKOUT_PLUGIN_DIR . 'invaise-checkout.php'),
        [],
        INVAISE_CHECKOUT_VERSION,
        true
    );
    wp_localize_script('invaise-checkout', 'invaiseCheckout', [
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce'   => wp_create_nonce('invaise_checkout_submit'),
        'strings' => [
            'genericError'  => 'Something went wrong -- please try again.',
            'starting'      => 'One moment…',
            'errorTitle'    => 'Checkout could not start',
            'successTitle'  => 'Thank you for your order!',
            'successText'   => "Your payment went through. Within a few minutes you'll receive an email with your invoice and a link to your customer account, where you'll find your licence key and downloads. Nothing in your inbox? Check your spam folder or contact us.",
            'cancelTitle'   => 'Payment cancelled',
            'cancelText'    => "No problem, nothing has been charged. You can order again whenever you're ready.",
        ],
    ]);
}

// AJAX endpoint the button's JS calls (1.3.0): asks invAIse to start a hosted checkout and returns
// its URL. Server-to-server, so the Brand's api_key:api_secret never reach the browser.
function invaise_checkout_ajax_submit() {
    // 1.3.3: a JSON error instead of WordPress's bare -1, so the visitor sees what to do.
    if (!check_ajax_referer('invaise_checkout_submit', 'nonce', false)) {
        wp_send_json_error(['error' => 'Your session expired -- please reload the page and try again.'], 403);
    }

    $activity_id = isset($_POST['activity_id']) ? (int) $_POST['activity_id'] : 0;
    $quantity    = isset($_POST['quantity']) ? max(1, min(1000, (int) $_POST['quantity'])) : 1;
    $success_url = isset($_POST['success_url']) ? esc_url_raw($_POST['success_url']) : home_url('/');
    $cancel_url  = isset($_POST['cancel_url'])  ? esc_url_raw($_POST['cancel_url'])  : home_url('/');

    if (!$activity_id) {
        wp_send_json_error(['error' => 'activity_id is required.'], 400);
    }

    $api_key    = get_option('invaise_checkout_api_key', '');
    $api_secret = get_option('invaise_checkout_api_secret', '');
    $base_url   = rtrim(get_option('invaise_checkout_base_url', INVAISE_CHECKOUT_DEFAULT_BASE_URL), '/');

    if (!$api_key || !$api_secret) {
        wp_send_json_error(['error' => 'invAIse Checkout is not configured yet -- add API credentials under Settings → invAIse Checkout.'], 500);
    }

    $response = wp_remote_post($base_url . '/api/v1/checkout/start', [
        'timeout' => 15,
        'headers' => [
            'Content-Type'  => 'application/json',
            'Authorization' => 'Bearer ' . $api_key . ':' . $api_secret,
        ],
        'body' => wp_json_encode([
            'activity_id' => $activity_id,
            'quantity'    => $quantity,
            'success_url' => $success_url,
            'cancel_url'  => $cancel_url,
        ]),
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error(['error' => 'Could not reach invAIse: ' . $response->get_error_message()], 502);
    }

    $code = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);

    if ($code !== 200 || empty($body['checkout_url'])) {
        wp_send_json_error(['error' => 'invAIse Checkout error: ' . ($body['error'] ?? ('HTTP ' . $code))], 502);
    }

    wp_send_json_success(['checkout_url' => $body['checkout_url']]);
}
add_action('wp_ajax_invaise_checkout_submit', 'invaise_checkout_ajax_submit');
add_action('wp_ajax_nopriv_invaise_checkout_submit', 'invaise_checkout_ajax_submit');

// 1.3.3 (invAIse card #342): the nonce printed in the page goes stale when a page cache
// (LiteSpeed: 7 days) serves the page longer than a nonce lives (max 24 h); admin-ajax then
// answered -1 and the button showed "Checkout could not start". The JS now asks for a fresh
// nonce right before every submit. admin-ajax POSTs are never page-cached, and nocache_headers()
// keeps proxies from storing the answer. The printed nonce stays as a fallback.
function invaise_checkout_ajax_nonce() {
    nocache_headers();
    wp_send_json_success(['nonce' => wp_create_nonce('invaise_checkout_submit')]);
}
add_action('wp_ajax_invaise_checkout_nonce', 'invaise_checkout_ajax_nonce');
add_action('wp_ajax_nopriv_invaise_checkout_nonce', 'invaise_checkout_ajax_nonce');
