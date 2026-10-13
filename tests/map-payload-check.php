<?php
// Read-only integration check: wp eval-file wp-content/themes/osadafabryczna/tests/map-payload-check.php
if (!defined('WP_CLI') || !WP_CLI) {
    exit;
}
$fields = osadafabryczna_get_map_rest_fields();
$server = rest_get_server();
foreach (array('pl', 'en') as $language) {
    $responses = array();
    foreach (array('full', 'map') as $mode) {
        $request = new WP_REST_Request('GET', '/wp/v2/budynek');
        $params = array('acf_format' => 'standard', 'language' => $language, 'per_page' => 70);
        if ('map' === $mode) {
            $params['_fields'] = $fields;
        } else {
            $params['_embed'] = '1';
        }
        $request->set_query_params($params);
        $response = rest_do_request($request);
        if (200 !== $response->get_status()) {
            WP_CLI::error('REST request failed: ' . $response->get_status());
        }
        $response = apply_filters('rest_post_dispatch', $response, $server, $request);
        $responses[$mode] = $server->response_to_data($response, 'full' === $mode);
        $headers = $response->get_headers();
        WP_CLI::log(wp_json_encode(array(
            'language' => $language,
            'mode' => $mode,
            'count' => count($responses[$mode]),
            'total' => $headers['X-WP-Total'] ?? null,
            'bytes' => strlen(wp_json_encode($responses[$mode])),
            'fields' => array_keys($responses[$mode][0] ?? array()),
            'acf_fields' => array_keys($responses[$mode][0]['acf'] ?? array()),
        )));
    }
    if (array_column($responses['full'], 'id') !== array_column($responses['map'], 'id')) {
        WP_CLI::error('Building IDs changed.');
    }
    foreach ($responses['map'] as $index => $building) {
        $full = $responses['full'][$index];
        foreach (array('id', 'link', 'marker_icon_width') as $field) {
            if (($building[$field] ?? null) !== ($full[$field] ?? null)) WP_CLI::error('Changed field: ' . $field);
        }
        if (($building['title']['rendered'] ?? null) !== ($full['title']['rendered'] ?? null)) WP_CLI::error('Title changed.');
        foreach (array('latitude', 'longitude', 'marker_icon', 'subtitle', 'short_description') as $field) {
            if (($building['acf'][$field] ?? null) !== ($full['acf'][$field] ?? null)) WP_CLI::error('Changed ACF field: ' . $field);
        }
        if (isset($building['content']) || isset($building['_embedded'])) WP_CLI::error('Unnecessary content present.');
        if (array_diff(array_keys($building['acf'] ?? array()), array('latitude', 'longitude', 'marker_icon', 'subtitle', 'short_description'))) {
            WP_CLI::error('Unnecessary ACF fields present.');
        }
    }
}
WP_CLI::success('PL/EN map data preserved; full descriptions excluded.');
