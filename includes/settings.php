<?php
if (!defined('ABSPATH')) exit;

// Standing rule for this project: default to invAIse's ACC environment, never PROD, unless a
// human deliberately changes this setting. Never a shortcode attribute or environment-variable
// toggle -- a real settings-page edit is the only way this ever points at PROD.
define('INVAISE_CHECKOUT_DEFAULT_BASE_URL', 'https://acc.invaise.com');

add_action('admin_menu', function () {
    add_options_page(
        'invAIse Checkout',
        'invAIse Checkout',
        'manage_options',
        'invaise-checkout',
        'invaise_checkout_render_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('invaise_checkout_settings', 'invaise_checkout_api_key');
    register_setting('invaise_checkout_settings', 'invaise_checkout_api_secret');
    register_setting('invaise_checkout_settings', 'invaise_checkout_base_url', [
        'default' => INVAISE_CHECKOUT_DEFAULT_BASE_URL,
    ]);
});

function invaise_checkout_render_settings_page() {
    if (!current_user_can('manage_options')) return;
    $api_key    = get_option('invaise_checkout_api_key', '');
    $has_secret = (bool) get_option('invaise_checkout_api_secret', '');
    $base_url   = get_option('invaise_checkout_base_url', INVAISE_CHECKOUT_DEFAULT_BASE_URL);
    ?>
    <div class="wrap">
        <h1>invAIse Checkout</h1>
        <p>Paste this Brand's Checkout API credentials (generated in invAIse's Brand edit screen).
        The secret is only ever shown once at generation time on invAIse's side -- if you don't
        have it, regenerate it there first.</p>
        <form method="post" action="options.php">
            <?php settings_fields('invaise_checkout_settings'); ?>
            <table class="form-table">
                <tr>
                    <th scope="row"><label for="invaise_checkout_base_url">invAIse base URL</label></th>
                    <td>
                        <input type="url" id="invaise_checkout_base_url" name="invaise_checkout_base_url"
                               value="<?php echo esc_attr($base_url); ?>" class="regular-text" />
                        <p class="description">
                            <strong>Defaults to ACC (<?php echo esc_html(INVAISE_CHECKOUT_DEFAULT_BASE_URL); ?>).</strong>
                            Only change this to invAIse's PROD URL deliberately, after real testing on ACC is confirmed working.
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="invaise_checkout_api_key">Checkout API key</label></th>
                    <td><input type="text" id="invaise_checkout_api_key" name="invaise_checkout_api_key"
                               value="<?php echo esc_attr($api_key); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th scope="row"><label for="invaise_checkout_api_secret">Checkout API secret</label></th>
                    <td>
                        <input type="password" id="invaise_checkout_api_secret" name="invaise_checkout_api_secret"
                               value="" class="regular-text" placeholder="<?php echo $has_secret ? 'Already set — leave blank to keep it' : 'Not set'; ?>" />
                        <p class="description">Leave blank to keep the currently saved secret.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
        <h2>Usage</h2>
        <p>Add a button to any page or post:</p>
        <code>[invaise_checkout activity_id="1" label="Order now"]</code>
        <p>With a seat-quantity input (for per-seat products):</p>
        <code>[invaise_checkout activity_id="1" label="Order now" quantity_field="true" quantity_label="Number of users" quantity_default="2"]</code>
    </div>
    <?php
}

// Don't overwrite a saved secret with a blank resubmit of the settings form.
add_filter('pre_update_option_invaise_checkout_api_secret', function ($new_value, $old_value) {
    if ($new_value === '' || $new_value === null) return $old_value;
    return $new_value;
}, 10, 2);
