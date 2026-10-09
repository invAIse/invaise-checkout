<?php
/**
 * Plugin Name: invAIse Checkout Connector
 * Description: Thin connector for invAIse's Checkout API. Renders "Order now" buttons via a
 *              shortcode; on click, one server-to-server call to invAIse starts a checkout and the
 *              visitor goes to invAIse's hosted checkout page (step 1: details, VAT number,
 *              voucher, final price; step 2: Stripe, payment method only; card #292). No Stripe keys, no invAIse
 *              database access, and no business logic live in this plugin -- same philosophy as
 *              MSTeamsFS's own lightweight module design. See
 *              invAIse_ManagedFreeScout_Checkout_Cutover_Spec_v1.md and card #174.
 * Version: 1.3.0
 * Author: StackPros
 * Author URI: https://stackpros.io
 */

if (!defined('ABSPATH')) exit;

define('INVAISE_CHECKOUT_VERSION', '1.3.0');
define('INVAISE_CHECKOUT_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once INVAISE_CHECKOUT_PLUGIN_DIR . 'includes/settings.php';
require_once INVAISE_CHECKOUT_PLUGIN_DIR . 'includes/shortcode.php';
