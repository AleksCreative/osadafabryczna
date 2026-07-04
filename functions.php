<?php


function osadafabryczna_enqueue_assets() {

    // Theme CSS (always)
    wp_enqueue_style(
        'theme-style',
        get_stylesheet_directory_uri() . '/style.css',
        [],
        filemtime(get_stylesheet_directory() . '/style.css')
    );

    wp_enqueue_script(
        'osadafabryczna-site-menu-js',
        get_template_directory_uri() . '/dist/assets/site-menu.js',
        [],
        filemtime(get_template_directory() . '/dist/assets/site-menu.js'),
        true
    );

    if ( is_front_page() ) {
        // Leaflet CSS
        wp_enqueue_style(
            'leaflet-css',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
            [],
            '1.9.4'
        );

        // Leaflet JS
        wp_enqueue_script(
            'leaflet-js',
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
            [],
            '1.9.4',
            true
        );

        // Marker clustering for dense maps
        wp_enqueue_style(
            'leaflet-markercluster-css',
            'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
            [],
            '1.5.3'
        );
        wp_enqueue_style(
            'leaflet-markercluster-default-css',
            'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
            [],
            '1.5.3'
        );
        wp_enqueue_script(
            'leaflet-markercluster-js',
            'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
            ['leaflet-js'],
            '1.5.3',
            true
        );

        // Map JS
        wp_enqueue_script(
            'osadafabryczna-main-js',
            get_template_directory_uri() . '/dist/assets/main.js',
            ['leaflet-js', 'leaflet-markercluster-js'],
            filemtime(get_template_directory() . '/dist/assets/main.js'),
            true
        );
    }
}
add_action('wp_enqueue_scripts', 'osadafabryczna_enqueue_assets');

function osadafabryczna_allow_geolocation_policy() {
    header('Permissions-Policy: geolocation=(self)');
}
add_action('send_headers', 'osadafabryczna_allow_geolocation_policy');

function osadafabryczna_register_menus() {
    register_nav_menus(array(
        'primary' => __('Primary Menu', 'osadafabryczna'),
        'footer'  => __('Footer Menu', 'osadafabryczna'),
    ));
}

add_action('after_setup_theme', 'osadafabryczna_register_menus');

add_theme_support('menus');
