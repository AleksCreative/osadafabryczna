<?php


function osadafabryczna_enqueue_assets() {
    wp_enqueue_style(
        'osadafabryczna-google-fonts',
        'https://fonts.googleapis.com/css2?family=Faculty+Glyphic&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap',
        [],
        null
    );

    // Theme CSS (always)
    wp_enqueue_style(
        'theme-style',
        get_stylesheet_directory_uri() . '/style.css',
        ['osadafabryczna-google-fonts'],
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

function osadafabryczna_google_fonts_resource_hints($urls, $relation_type) {
    if ('preconnect' === $relation_type) {
        $urls[] = 'https://fonts.googleapis.com';
        $urls[] = [
            'href' => 'https://fonts.gstatic.com',
            'crossorigin' => 'anonymous',
        ];
    }

    return $urls;
}
add_filter('wp_resource_hints', 'osadafabryczna_google_fonts_resource_hints', 10, 2);

function osadafabryczna_allow_geolocation_policy() {
    header('Permissions-Policy: geolocation=(self)');
}
add_action('send_headers', 'osadafabryczna_allow_geolocation_policy');

function osadafabryczna_register_menus() {
    register_nav_menus(array(
        'primary' => __('Primary Menu', 'osadafabryczna'),
        'footer'  => __('Footer Menu', 'osadafabryczna'),
    ));

    add_theme_support('custom-logo', array(
        'height'      => 80,
        'width'       => 240,
        'flex-height' => true,
        'flex-width'  => true,
    ));
}

add_action('after_setup_theme', 'osadafabryczna_register_menus');

add_theme_support('menus');

function osadafabryczna_register_sidebars() {
    register_sidebar(array(
        'name'          => __('Building Footer', 'osadafabryczna'),
        'id'            => 'budynek_footer',
        'description'   => __('Footer content shown on single building pages.', 'osadafabryczna'),
        'before_widget' => '<section id="%1$s" class="widget %2$s">',
        'after_widget'  => '</section>',
        'before_title'  => '<h2 class="widget-title">',
        'after_title'   => '</h2>',
    ));
}
add_action('widgets_init', 'osadafabryczna_register_sidebars');
