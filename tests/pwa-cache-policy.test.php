<?php
// Run with PHP CLI. Isolated WordPress stubs; no database or HTTP writes.
if (PHP_SAPI !== 'cli') {
    exit;
}

function add_action(...$args) {}
function add_filter(...$args) {}
function is_user_logged_in() { return $GLOBALS['logged_in']; }
function get_option($name, $default = false) { return $GLOBALS['options'][$name] ?? $default; }

require dirname(__DIR__) . '/functions.php';

class PwaPolicyRequest {
    public $method = 'GET';
    public $route = '/wp/v2/budynek';
    public $params = array();
    public $headers = array();
    public function get_method() { return $this->method; }
    public function get_route() { return $this->route; }
    public function get_param($name) { return $this->params[$name] ?? null; }
    public function get_header($name) { return $this->headers[$name] ?? ''; }
}

class PwaPolicyResponse {
    public $headers = array();
    public function header($name, $value) { $this->headers[$name] = $value; }
}

$cases = array(
    'anonymous public buildings' => array('public', array()),
    'WordPress normalized defaults' => array('public', array('params' => array('context' => 'view', 'status' => array('publish')))),
    'authenticated user' => array('private', array('logged_in' => true)),
    'temporary password gate' => array('private', array('gate' => true)),
    'other REST resource' => array('private', array('route' => '/wp/v2/users/me')),
    'individual building' => array('private', array('route' => '/wp/v2/budynek/123')),
    'write request' => array('private', array('method' => 'POST')),
    'editing context' => array('private', array('params' => array('context' => 'edit'))),
    'draft status' => array('private', array('params' => array('status' => array('draft')))),
    'password protected request' => array('private', array('params' => array('password' => 'test'))),
    'query nonce' => array('private', array('params' => array('_wpnonce' => 'test'))),
    'nonce header' => array('private', array('headers' => array('X-WP-Nonce' => 'test'))),
    'authorization header' => array('private', array('headers' => array('Authorization' => 'test'))),
);

foreach ($cases as $label => [$expected, $settings]) {
    $GLOBALS['logged_in'] = $settings['logged_in'] ?? false;
    $GLOBALS['options'] = !empty($settings['gate']) ? array(
        'osadafabryczna_access_enabled' => '1',
        'osadafabryczna_access_password' => 'test-hash',
    ) : array();
    $request = new PwaPolicyRequest();
    foreach (array('method', 'route', 'params', 'headers') as $key) {
        if (isset($settings[$key])) $request->$key = $settings[$key];
    }
    $response = osadafabryczna_pwa_rest_cache_header(new PwaPolicyResponse(), null, $request);
    if (($response->headers['X-Osada-PWA-Cache'] ?? null) !== $expected) {
        fwrite(STDERR, "FAIL: $label\n");
        exit(1);
    }
}
echo count($cases) . " PWA REST policy checks passed.\n";
