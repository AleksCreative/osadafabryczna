<?php
// Isolated CLI checks; no WordPress bootstrap or database writes.
if (PHP_SAPI !== 'cli') exit;
function add_action(...$args) {}
function add_filter(...$args) {}
function get_option($key, $default = false) { return $GLOBALS['options'][$key] ?? $default; }
function is_user_logged_in() { return $GLOBALS['logged_in']; }
function wp_salt($scheme) { return 'test-only-salt'; }
function sanitize_text_field($value) { return $value; }
function wp_unslash($value) { return $value; }
function __($value, $domain) { return $value; }
class WP_Error {
    public function __construct(public $code, public $message, public $data) {}
}
function is_wp_error($value) { return $value instanceof WP_Error; }
require dirname(__DIR__) . '/functions.php';

$options = array('osadafabryczna_access_enabled' => '1', 'osadafabryczna_access_password' => 'hash');
$logged_in = false;
$_COOKIE = array();
$checks = 0;
function check_gate($condition, $label) {
    if (!$condition) { fwrite(STDERR, "FAIL: $label\n"); exit(1); }
    $GLOBALS['checks']++;
}
foreach (array('/wp/v2/budynek', '/wp/v2/pages', '/wp/v2/search', '/wp/v2/media', '/oembed/1.0/embed', '/') as $route) {
    $GLOBALS['wp'] = (object) array('query_vars' => array('rest_route' => $route));
    $result = osadafabryczna_protect_public_rest_api(null);
    check_gate(is_wp_error($result) && 401 === $result->data['status'], "anonymous access: $route");
}
$_COOKIE[osadafabryczna_access_cookie_name()] = 'invalid';
check_gate(is_wp_error(osadafabryczna_protect_public_rest_api(null)), 'invalid cookie');
$_COOKIE[osadafabryczna_access_cookie_name()] = osadafabryczna_access_cookie_value();
check_gate(null === osadafabryczna_protect_public_rest_api(null), 'valid tester cookie');
$existing_error = new WP_Error('invalid_nonce', 'Invalid nonce', array('status' => 403));
check_gate($existing_error === osadafabryczna_protect_public_rest_api($existing_error), 'preserve authentication error');
$_COOKIE = array();
$logged_in = true;
check_gate(true === osadafabryczna_protect_public_rest_api(true), 'authenticated editor');
$logged_in = false;
$options['osadafabryczna_access_enabled'] = '0';
check_gate(null === osadafabryczna_protect_public_rest_api(null), 'public site after launch');

// Exercise the installed WordPress cookie-authentication function before our filter.
// No WordPress bootstrap, real accounts, session cookies or database writes are used.
function wp_set_current_user($id) { $GLOBALS['logged_in'] = $id > 0; }
function wp_verify_nonce($nonce, $action) { return 'valid-rest-nonce' === $nonce && 'wp_rest' === $action; }
function wp_create_nonce($action) { return 'valid-rest-nonce'; }
function rest_get_server() { return new class { public function send_header(...$args) {} }; }
$core_path = dirname(__DIR__, 4) . '/wp-includes/rest-api.php';
if (is_file($core_path)) {
    $core = file_get_contents($core_path);
    $start = strpos($core, 'function rest_cookie_check_errors(');
    $end = strpos($core, '/**', $start);
    if (false === $start || false === $end) throw new RuntimeException('WordPress authentication function not found.');
    eval(substr($core, $start, $end - $start));
    $options['osadafabryczna_access_enabled'] = '1';
    $wp_rest_auth_cookie = true;
    $logged_in = true;
    $_REQUEST = array();
    unset($_SERVER['HTTP_X_WP_NONCE']);
    $result = osadafabryczna_protect_public_rest_api(rest_cookie_check_errors(null));
    check_gate(is_wp_error($result) && 401 === $result->data['status'], 'WordPress removes cookie authentication without nonce');
    $logged_in = true;
    $_SERVER['HTTP_X_WP_NONCE'] = 'valid-rest-nonce';
    check_gate(true === osadafabryczna_protect_public_rest_api(rest_cookie_check_errors(null)), 'logged-in map with nonce passes WordPress and gate');
} else {
    echo "Installed WordPress integration check skipped (core file absent).\n";
}
echo "$checks access gate checks passed.\n";
