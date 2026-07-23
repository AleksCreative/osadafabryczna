<?php

function osadafabryczna_is_english_front_page() {
    return is_page('eng');
}

function osadafabryczna_is_map_page() {
    return is_front_page() || osadafabryczna_is_english_front_page();
}

function osadafabryczna_bump_buildings_cache_version($post_id) {
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return;
    }

    $version = (int) get_option('osadafabryczna_buildings_cache_version', 1);
    update_option('osadafabryczna_buildings_cache_version', $version + 1, false);
}
add_action('save_post_budynek', 'osadafabryczna_bump_buildings_cache_version');

function osadafabryczna_add_pwa_metadata() {
    if (function_exists('osadafabryczna_is_holding_request') && osadafabryczna_is_holding_request()) {
        return;
    }

    $manifest_url = get_theme_file_uri('/manifest.webmanifest');
    $icon_url = get_theme_file_uri('/dist/assets/pwa-icon-192-v2.png');
    ?>
    <link rel="manifest" href="<?php echo esc_url($manifest_url); ?>">
    <meta name="theme-color" content="#f3efe6">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <link rel="apple-touch-icon" href="<?php echo esc_url($icon_url); ?>">
    <?php
}
add_action('wp_head', 'osadafabryczna_add_pwa_metadata', 1);

function osadafabryczna_serve_pwa_service_worker($wp) {
    if ('sw.js' !== trim($wp->request, '/')) {
        return;
    }

    $service_worker = get_theme_file_path('/dist/assets/service-worker.js');

    if (!is_readable($service_worker)) {
        status_header(404);
        exit;
    }

    status_header(200);
    header('Content-Type: application/javascript; charset=UTF-8');
    header('Service-Worker-Allowed: /');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    echo 'const OSADA_PWA_CONFIG = ' . wp_json_encode(
        array(
            'offlineUrl' => get_theme_file_uri('/offline.html'),
            'themeUrl'   => trailingslashit(get_theme_file_uri()),
        )
    ) . ";\n\n";
    readfile($service_worker);
    exit;
}
add_action('parse_request', 'osadafabryczna_serve_pwa_service_worker', 0);

function osadafabryczna_is_english_budynek_archive() {
    return is_post_type_archive('budynek') && 'en' === get_query_var('osada_language_archive');
}

function osadafabryczna_get_post_language($post_id = null) {
    $post_id = $post_id ?: get_queried_object_id();
    $language = $post_id ? get_post_meta($post_id, '_osada_language', true) : '';

    if ('en' === $language) {
        return 'en';
    }

    if (osadafabryczna_is_english_front_page()) {
        return 'en';
    }

    return 'pl';
}

function osadafabryczna_get_current_language() {
    if (is_search() && 'en' === get_query_var('osada_search_language')) {
        return 'en';
    }

    if (is_singular()) {
        return osadafabryczna_get_post_language();
    }

    if (osadafabryczna_is_english_budynek_archive()) {
        return 'en';
    }

    return osadafabryczna_is_english_front_page() ? 'en' : 'pl';
}

function osadafabryczna_get_language_labels($language = null) {
    $language = $language ?: osadafabryczna_get_current_language();

    if ('en' === $language) {
        return array(
            'enableLocation'       => 'Enable location',
            'locationEnabled'      => 'Location: enabled',
            'geolocationUnsupported' => 'Geolocation is not supported in this browser.',
            'changeMap'            => 'Change map',
            'changeMapAria'        => 'Change map layer',
            'readMore'             => 'Read more',
        );
    }

    return array(
        'enableLocation'       => 'Włącz lokalizację',
        'locationEnabled'      => 'Lokalizacja: włączona',
        'geolocationUnsupported' => 'Geolokalizacja nie jest obsługiwana w tej przeglądarce.',
        'changeMap'            => 'Zmień mapę',
        'changeMapAria'        => 'Zmień mapę',
        'readMore'             => 'Czytaj więcej',
    );
}


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

    if (function_exists('osadafabryczna_is_holding_request') && osadafabryczna_is_holding_request()) {
        return;
    }

    wp_enqueue_script(
        'osadafabryczna-site-menu-js',
        get_template_directory_uri() . '/dist/assets/site-menu.js',
        [],
        filemtime(get_template_directory() . '/dist/assets/site-menu.js'),
        true
    );

    wp_enqueue_script(
        'osadafabryczna-pwa-register-js',
        get_template_directory_uri() . '/dist/assets/pwa-register.js',
        [],
        filemtime(get_template_directory() . '/dist/assets/pwa-register.js'),
        true
    );

    wp_localize_script(
        'osadafabryczna-pwa-register-js',
        'OsadaFabrycznaPwa',
        array(
            'serviceWorkerUrl' => home_url('/sw.js'),
            'scope'            => home_url('/'),
            'labels'           => 'en' === osadafabryczna_get_current_language()
                ? array(
                    'install'      => 'Add to home screen',
                    'dialogTitle'  => 'Add Osada Fabryczna',
                    'dialogText'   => 'In Safari, tap Share and then choose “Add to Home Screen”.',
                    'close'        => 'Close',
                )
                : array(
                    'install'      => 'Dodaj do ekranu głównego',
                    'dialogTitle'  => 'Dodaj Osadę Fabryczną',
                    'dialogText'   => 'W Safari stuknij Udostępnij, a następnie wybierz „Do ekranu początkowego”.',
                    'close'        => 'Zamknij',
                ),
        )
    );

    if (is_singular('budynek')) {
        wp_enqueue_script(
            'osadafabryczna-building-carousel-js',
            get_template_directory_uri() . '/dist/assets/building-carousel.js',
            [],
            filemtime(get_template_directory() . '/dist/assets/building-carousel.js'),
            true
        );
    }

    if ( osadafabryczna_is_map_page() ) {
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

        $language = osadafabryczna_get_current_language();
        wp_localize_script(
            'osadafabryczna-main-js',
            'OsadaFabrycznaMap',
            array(
                'language' => $language,
                'restUrl'  => esc_url_raw(add_query_arg(
                    array(
                        'acf_format' => 'standard',
                        '_embed'      => '1',
                        'language'    => $language,
                        'per_page'    => '50',
                        'content_version' => (int) get_option('osadafabryczna_buildings_cache_version', 1),
                    ),
                    rest_url('wp/v2/budynek')
                )),
                'assets'   => array(
                    'mapOverlay'   => esc_url_raw(get_template_directory_uri() . '/dist/assets/mapa2a.jpg'),
                    'userLocation' => esc_url_raw(get_template_directory_uri() . '/dist/assets/user-location.gif'),
                ),
                'labels'   => osadafabryczna_get_language_labels($language),
            )
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
    if (osadafabryczna_is_map_page()) {
        header('Permissions-Policy: geolocation=(self)');
    }
}
add_action('send_headers', 'osadafabryczna_allow_geolocation_policy');

function osadafabryczna_register_menus() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('responsive-embeds');
    add_theme_support('html5', array(
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
        'search-form',
    ));

    register_nav_menus(array(
        'primary' => __('Primary Menu', 'osadafabryczna'),
        'primary_en' => __('Primary Menu English', 'osadafabryczna'),
        'footer'  => __('Footer Menu', 'osadafabryczna'),
        'footer_en'  => __('Footer Menu English', 'osadafabryczna'),
    ));

    add_theme_support('custom-logo', array(
        'height'      => 80,
        'width'       => 240,
        'flex-height' => true,
        'flex-width'  => true,
    ));
}

add_action('after_setup_theme', 'osadafabryczna_register_menus');

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

function osadafabryczna_add_language_meta_boxes() {
    foreach (array('page', 'budynek') as $post_type) {
        add_meta_box(
            'osada-language-settings',
            __('Language settings', 'osadafabryczna'),
            'osadafabryczna_render_language_meta_box',
            $post_type,
            'side',
            'default'
        );
    }
}
add_action('add_meta_boxes', 'osadafabryczna_add_language_meta_boxes');

function osadafabryczna_render_language_meta_box($post) {
    wp_nonce_field('osada_language_settings', 'osada_language_settings_nonce');

    $language = get_post_meta($post->ID, '_osada_language', true) ?: 'pl';
    $translation_id = (int) get_post_meta($post->ID, '_osada_translation_id', true);
    $posts = get_posts(array(
        'post_type'      => $post->post_type,
        'post_status'    => array('publish', 'draft', 'pending', 'private'),
        'posts_per_page' => -1,
        'orderby'        => 'title',
        'order'          => 'ASC',
        'exclude'        => array($post->ID),
    ));
    ?>
    <p>
        <label for="osada_language"><?php esc_html_e('Language', 'osadafabryczna'); ?></label>
        <select id="osada_language" name="osada_language" class="widefat">
            <option value="pl" <?php selected($language, 'pl'); ?>><?php esc_html_e('Polish', 'osadafabryczna'); ?></option>
            <option value="en" <?php selected($language, 'en'); ?>><?php esc_html_e('English', 'osadafabryczna'); ?></option>
        </select>
    </p>
    <p>
        <label for="osada_translation_id"><?php esc_html_e('Paired translation', 'osadafabryczna'); ?></label>
        <select id="osada_translation_id" name="osada_translation_id" class="widefat">
            <option value="0"><?php esc_html_e('None', 'osadafabryczna'); ?></option>
            <?php foreach ($posts as $translation_post) : ?>
                <option value="<?php echo esc_attr($translation_post->ID); ?>" <?php selected($translation_id, $translation_post->ID); ?>>
                    <?php echo esc_html(get_the_title($translation_post)); ?>
                </option>
            <?php endforeach; ?>
        </select>
    </p>
    <?php
}

function osadafabryczna_save_language_meta($post_id) {
    if (!isset($_POST['osada_language_settings_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['osada_language_settings_nonce'])), 'osada_language_settings')) {
        return;
    }

    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }

    if (!current_user_can('edit_post', $post_id)) {
        return;
    }

    $post_type = get_post_type($post_id);
    if (!in_array($post_type, array('page', 'budynek'), true)) {
        return;
    }

    $language = isset($_POST['osada_language']) ? sanitize_key(wp_unslash($_POST['osada_language'])) : 'pl';
    $language = in_array($language, array('pl', 'en'), true) ? $language : 'pl';
    $translation_id = isset($_POST['osada_translation_id']) ? absint($_POST['osada_translation_id']) : 0;

    update_post_meta($post_id, '_osada_language', $language);

    if ($translation_id) {
        update_post_meta($post_id, '_osada_translation_id', $translation_id);
        update_post_meta($translation_id, '_osada_translation_id', $post_id);
    } else {
        delete_post_meta($post_id, '_osada_translation_id');
    }
}
add_action('save_post', 'osadafabryczna_save_language_meta');

function osadafabryczna_add_language_rewrites() {
    add_rewrite_rule('^eng/budynek/([^/]+)/?$', 'index.php?budynek=$matches[1]', 'top');
    add_rewrite_rule('^eng/budynki/page/([0-9]+)/?$', 'index.php?post_type=budynek&osada_language_archive=en&paged=$matches[1]', 'top');
    add_rewrite_rule('^eng/budynki/?$', 'index.php?post_type=budynek&osada_language_archive=en', 'top');
}
add_action('init', 'osadafabryczna_add_language_rewrites');

function osadafabryczna_add_language_query_vars($query_vars) {
    $query_vars[] = 'osada_language_archive';
    $query_vars[] = 'osada_search_language';

    return $query_vars;
}
add_filter('query_vars', 'osadafabryczna_add_language_query_vars');

function osadafabryczna_filter_budynek_archive_query($query) {
    if (is_admin() || !$query->is_main_query()) {
        return;
    }

    $is_english_archive = 'en' === $query->get('osada_language_archive');
    $is_polish_archive = $query->is_post_type_archive('budynek');

    if (!$is_english_archive && !$is_polish_archive) {
        return;
    }

    $language = $is_english_archive ? 'en' : 'pl';
    $query->set('post_type', 'budynek');

    $meta_query = $query->get('meta_query');
    $meta_query = is_array($meta_query) ? $meta_query : array();

    if ('en' === $language) {
        $meta_query[] = array(
            'key'     => '_osada_language',
            'value'   => 'en',
            'compare' => '=',
        );
    } else {
        $meta_query[] = array(
            'relation' => 'OR',
            array(
                'key'     => '_osada_language',
                'value'   => 'pl',
                'compare' => '=',
            ),
            array(
                'key'     => '_osada_language',
                'compare' => 'NOT EXISTS',
            ),
        );
    }

    $query->set('meta_query', $meta_query);
}
add_action('pre_get_posts', 'osadafabryczna_filter_budynek_archive_query');

function osadafabryczna_filter_search_query($query) {
    if (is_admin() || !$query->is_main_query() || !$query->is_search()) {
        return;
    }

    $language = 'en' === $query->get('osada_search_language') ? 'en' : 'pl';
    $query->set('post_type', array('page', 'budynek'));

    $meta_query = $query->get('meta_query');
    $meta_query = is_array($meta_query) ? $meta_query : array();

    if ('en' === $language) {
        $meta_query[] = array(
            'key'     => '_osada_language',
            'value'   => 'en',
            'compare' => '=',
        );
    } else {
        $meta_query[] = array(
            'relation' => 'OR',
            array(
                'key'     => '_osada_language',
                'value'   => 'pl',
                'compare' => '=',
            ),
            array(
                'key'     => '_osada_language',
                'compare' => 'NOT EXISTS',
            ),
        );
    }

    $query->set('meta_query', $meta_query);
}
add_action('pre_get_posts', 'osadafabryczna_filter_search_query');

function osadafabryczna_filter_budynek_rest_query($args, $request) {
    $language = sanitize_key($request->get_param('language'));

    if (!in_array($language, array('pl', 'en'), true)) {
        $language = 'pl';
    }

    $args['meta_query'] = isset($args['meta_query']) && is_array($args['meta_query']) ? $args['meta_query'] : array();
    $language_query = array(
        'relation' => 'OR',
        array(
            'key'     => '_osada_language',
            'value'   => $language,
            'compare' => '=',
        ),
    );

    if ('pl' === $language) {
        $language_query[] = array(
            'key'     => '_osada_language',
            'compare' => 'NOT EXISTS',
        );
    }

    $args['meta_query'][] = $language_query;

    return $args;
}
add_filter('rest_budynek_query', 'osadafabryczna_filter_budynek_rest_query', 10, 2);

function osadafabryczna_filter_english_budynek_link($post_link, $post) {
    if ('budynek' === $post->post_type && 'en' === osadafabryczna_get_post_language($post->ID)) {
        return home_url('/eng/budynek/' . $post->post_name . '/');
    }

    return $post_link;
}
add_filter('post_type_link', 'osadafabryczna_filter_english_budynek_link', 10, 2);

function osadafabryczna_filter_english_budynek_archive_menu_link($items, $args) {
    if (empty($args->theme_location) || 'primary_en' !== $args->theme_location) {
        return $items;
    }

    foreach ($items as $item) {
        if ('post_type_archive' === $item->type && 'budynek' === $item->object) {
            $item->url = home_url('/eng/budynki/');
        }
    }

    return $items;
}
add_filter('wp_nav_menu_objects', 'osadafabryczna_filter_english_budynek_archive_menu_link', 10, 2);

function osadafabryczna_filter_english_budynek_archive_pagination_link($link, $page_number) {
    if (!osadafabryczna_is_english_budynek_archive()) {
        return $link;
    }

    if ($page_number > 1) {
        return home_url('/eng/budynki/page/' . $page_number . '/');
    }

    return home_url('/eng/budynki/');
}
add_filter('get_pagenum_link', 'osadafabryczna_filter_english_budynek_archive_pagination_link', 10, 2);

function osadafabryczna_get_paired_translation_id($post_id = null) {
    $post_id = $post_id ?: get_queried_object_id();
    return $post_id ? (int) get_post_meta($post_id, '_osada_translation_id', true) : 0;
}

function osadafabryczna_get_english_front_page_url() {
    $english_page = get_page_by_path('eng');
    return $english_page ? get_permalink($english_page) : home_url('/eng/');
}

function osadafabryczna_get_language_url($language) {
    if (is_search()) {
        $search_args = array('s' => get_search_query(false));

        if ('en' === $language) {
            $search_args['osada_search_language'] = 'en';
        }

        return add_query_arg($search_args, home_url('/'));
    }

    if (is_singular()) {
        $post_id = get_queried_object_id();
        $current_language = osadafabryczna_get_post_language($post_id);

        if ($language === $current_language) {
            return get_permalink($post_id);
        }

        $translation_id = osadafabryczna_get_paired_translation_id($post_id);
        if ($translation_id) {
            return get_permalink($translation_id);
        }
    }

    if (is_post_type_archive('budynek')) {
        if ('en' === $language) {
            return home_url('/eng/budynki/');
        }

        return get_post_type_archive_link('budynek');
    }

    if ('en' === $language) {
        return osadafabryczna_get_english_front_page_url();
    }

    return home_url('/');
}

function osadafabryczna_language_switcher() {
    $current_language = osadafabryczna_get_current_language();
    ?>
    <nav class="language-switcher" aria-label="<?php esc_attr_e('Language switcher', 'osadafabryczna'); ?>">
        <a class="<?php echo 'pl' === $current_language ? 'is-active' : ''; ?>" href="<?php echo esc_url(osadafabryczna_get_language_url('pl')); ?>" lang="pl">PL</a>
        <a class="<?php echo 'en' === $current_language ? 'is-active' : ''; ?>" href="<?php echo esc_url(osadafabryczna_get_language_url('en')); ?>" lang="en">EN</a>
    </nav>
    <?php
}

function osadafabryczna_language_body_classes($classes) {
    $classes[] = 'site-language-' . osadafabryczna_get_current_language();

    if (osadafabryczna_is_english_front_page()) {
        $classes[] = 'front-page';
    }

    return $classes;
}
add_filter('body_class', 'osadafabryczna_language_body_classes');

/**
 * Temporary password gate and public holding page.
 */
function osadafabryczna_access_is_enabled() {
    return '1' === get_option('osadafabryczna_access_enabled', '0')
        && '' !== get_option('osadafabryczna_access_password', '');
}

function osadafabryczna_access_cookie_name() {
    return 'osadafabryczna_private_access';
}

function osadafabryczna_access_cookie_value() {
    $password_hash = (string) get_option('osadafabryczna_access_password', '');
    return hash_hmac('sha256', $password_hash, wp_salt('auth'));
}

function osadafabryczna_visitor_has_access() {
    if (!osadafabryczna_access_is_enabled() || is_user_logged_in()) {
        return true;
    }

    $cookie_name = osadafabryczna_access_cookie_name();
    $cookie_value = isset($_COOKIE[$cookie_name])
        ? sanitize_text_field(wp_unslash($_COOKIE[$cookie_name]))
        : '';

    return '' !== $cookie_value && hash_equals(osadafabryczna_access_cookie_value(), $cookie_value);
}

function osadafabryczna_is_holding_request() {
    return !empty($GLOBALS['osadafabryczna_show_holding']);
}

function osadafabryczna_set_access_cookie() {
    $expires = time() + MONTH_IN_SECONDS;
    $cookie_options = array(
        'expires'  => $expires,
        'path'     => COOKIEPATH ?: '/',
        'secure'   => is_ssl(),
        'httponly' => true,
        'samesite' => 'Lax',
    );

    setcookie(
        osadafabryczna_access_cookie_name(),
        osadafabryczna_access_cookie_value(),
        $cookie_options
    );
}

function osadafabryczna_handle_access_gate() {
    if (!osadafabryczna_access_is_enabled() || osadafabryczna_visitor_has_access()) {
        return;
    }

    if (isset($_SERVER['REQUEST_METHOD']) && 'POST' === strtoupper(sanitize_text_field(wp_unslash($_SERVER['REQUEST_METHOD'])))) {
        $nonce = isset($_POST['osada_access_nonce'])
            ? sanitize_text_field(wp_unslash($_POST['osada_access_nonce']))
            : '';
        $password = isset($_POST['osada_access_password'])
            ? (string) wp_unslash($_POST['osada_access_password'])
            : '';

        if (wp_verify_nonce($nonce, 'osadafabryczna_unlock') && wp_check_password(
            $password,
            (string) get_option('osadafabryczna_access_password', '')
        )) {
            osadafabryczna_set_access_cookie();
            nocache_headers();

            $request_uri = isset($_SERVER['REQUEST_URI'])
                ? wp_unslash($_SERVER['REQUEST_URI'])
                : '/';
            wp_safe_redirect(home_url($request_uri));
            exit;
        }

        $GLOBALS['osadafabryczna_access_error'] = true;
    }

    $GLOBALS['osadafabryczna_show_holding'] = true;
    status_header(200);
    nocache_headers();
    header('X-Osada-Holding: 1');
}
add_action('template_redirect', 'osadafabryczna_handle_access_gate', 0);

function osadafabryczna_use_holding_template($template) {
    if (!osadafabryczna_is_holding_request()) {
        return $template;
    }

    return get_theme_file_path('/holding-page.php');
}
add_filter('template_include', 'osadafabryczna_use_holding_template', 99);

function osadafabryczna_protect_buildings_rest_api($result) {
    if (!osadafabryczna_access_is_enabled() || osadafabryczna_visitor_has_access()) {
        return $result;
    }

    $rest_route = isset($GLOBALS['wp']->query_vars['rest_route'])
        ? (string) $GLOBALS['wp']->query_vars['rest_route']
        : '';
    $request_uri = isset($_SERVER['REQUEST_URI'])
        ? (string) wp_unslash($_SERVER['REQUEST_URI'])
        : '';

    if (false === strpos($rest_route . $request_uri, '/wp/v2/budynek')) {
        return $result;
    }

    return new WP_Error(
        'osadafabryczna_access_required',
        __('Access password required.', 'osadafabryczna'),
        array('status' => 401)
    );
}
add_filter('rest_authentication_errors', 'osadafabryczna_protect_buildings_rest_api');

function osadafabryczna_register_access_settings_page() {
    add_options_page(
        'Dostęp do strony',
        'Dostęp do strony',
        'manage_options',
        'osadafabryczna-access',
        'osadafabryczna_render_access_settings_page'
    );
}
add_action('admin_menu', 'osadafabryczna_register_access_settings_page');

function osadafabryczna_save_access_settings() {
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('You are not allowed to change these settings.', 'osadafabryczna'));
    }

    check_admin_referer('osadafabryczna_access_settings');

    update_option(
        'osadafabryczna_access_enabled',
        isset($_POST['access_enabled']) ? '1' : '0',
        false
    );
    update_option(
        'osadafabryczna_holding_title',
        isset($_POST['holding_title'])
            ? sanitize_text_field(wp_unslash($_POST['holding_title']))
            : '',
        false
    );
    update_option(
        'osadafabryczna_holding_content',
        isset($_POST['holding_content'])
            ? wp_kses_post(wp_unslash($_POST['holding_content']))
            : '',
        false
    );
    update_option(
        'osadafabryczna_facebook_url',
        isset($_POST['facebook_url'])
            ? esc_url_raw(wp_unslash($_POST['facebook_url']))
            : '',
        false
    );
    update_option(
        'osadafabryczna_instagram_url',
        isset($_POST['instagram_url'])
            ? esc_url_raw(wp_unslash($_POST['instagram_url']))
            : '',
        false
    );

    $new_password = isset($_POST['access_password'])
        ? (string) wp_unslash($_POST['access_password'])
        : '';

    if ('' !== $new_password) {
        update_option(
            'osadafabryczna_access_password',
            wp_hash_password($new_password),
            false
        );
    }

    wp_safe_redirect(add_query_arg(
        array(
            'page'    => 'osadafabryczna-access',
            'updated' => '1',
        ),
        admin_url('options-general.php')
    ));
    exit;
}
add_action('admin_post_osadafabryczna_save_access_settings', 'osadafabryczna_save_access_settings');

function osadafabryczna_render_access_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $has_password = '' !== get_option('osadafabryczna_access_password', '');
    ?>
    <div class="wrap">
        <h1>Dostęp do strony</h1>
        <?php if (isset($_GET['updated'])) : ?>
            <div class="notice notice-success is-dismissible"><p>Ustawienia zostały zapisane.</p></div>
        <?php endif; ?>
        <?php if (!$has_password) : ?>
            <div class="notice notice-warning"><p>Ustaw hasło przed włączeniem ochrony.</p></div>
        <?php endif; ?>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="osadafabryczna_save_access_settings">
            <?php wp_nonce_field('osadafabryczna_access_settings'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">Ochrona strony</th>
                    <td>
                        <label>
                            <input type="checkbox" name="access_enabled" value="1" <?php checked('1', get_option('osadafabryczna_access_enabled', '0')); ?>>
                            Włącz holding page i wymagaj hasła
                        </label>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="holding-title">Nagłówek</label></th>
                    <td><input id="holding-title" class="regular-text" type="text" name="holding_title" value="<?php echo esc_attr(get_option('osadafabryczna_holding_title', 'Osada Fabryczna')); ?>"></td>
                </tr>
                <tr>
                    <th scope="row"><label for="holding-content">Informacja o projekcie</label></th>
                    <td>
                        <?php
                        wp_editor(
                            get_option(
                                'osadafabryczna_holding_content',
                                '<p>Tworzymy cyfrową mapę Osady Fabrycznej. Projekt jest obecnie w fazie testów terenowych.</p>'
                            ),
                            'holding_content',
                            array(
                                'textarea_rows' => 8,
                                'media_buttons' => true,
                            )
                        );
                        ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="access-password">Hasło dla testerów</label></th>
                    <td>
                        <input id="access-password" class="regular-text" type="password" name="access_password" autocomplete="new-password">
                        <p class="description"><?php echo $has_password ? 'Pozostaw puste, aby zachować obecne hasło.' : 'Wpisz hasło wymagane do wejścia na stronę.'; ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="facebook-url">Facebook</label></th>
                    <td>
                        <input id="facebook-url" class="regular-text" type="url" name="facebook_url" value="<?php echo esc_attr(get_option('osadafabryczna_facebook_url', '')); ?>" placeholder="https://www.facebook.com/...">
                        <p class="description">Adres profilu lub strony projektu na Facebooku.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="instagram-url">Instagram</label></th>
                    <td>
                        <input id="instagram-url" class="regular-text" type="url" name="instagram_url" value="<?php echo esc_attr(get_option('osadafabryczna_instagram_url', '')); ?>" placeholder="https://www.instagram.com/...">
                        <p class="description">Adres profilu projektu na Instagramie.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Zapisz ustawienia'); ?>
        </form>
    </div>
    <?php
}
