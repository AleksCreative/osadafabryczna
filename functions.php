<?php

function osadafabryczna_is_english_front_page() {
    return is_page('eng');
}

function osadafabryczna_is_map_page() {
    return is_front_page() || osadafabryczna_is_english_front_page();
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
    if (is_singular()) {
        return osadafabryczna_get_post_language();
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

    wp_enqueue_script(
        'osadafabryczna-site-menu-js',
        get_template_directory_uri() . '/dist/assets/site-menu.js',
        [],
        filemtime(get_template_directory() . '/dist/assets/site-menu.js'),
        true
    );

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
                    ),
                    rest_url('wp/v2/budynek')
                )),
                'assets'   => array(
                    'mapOverlay'   => esc_url_raw(get_template_directory_uri() . '/dist/assets/mapa2a.jpg'),
                    'userLocation' => esc_url_raw(get_template_directory_uri() . '/dist/assets/user-location.png'),
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
    header('Permissions-Policy: geolocation=(self)');
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
}
add_action('init', 'osadafabryczna_add_language_rewrites');

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

function osadafabryczna_get_paired_translation_id($post_id = null) {
    $post_id = $post_id ?: get_queried_object_id();
    return $post_id ? (int) get_post_meta($post_id, '_osada_translation_id', true) : 0;
}

function osadafabryczna_get_english_front_page_url() {
    $english_page = get_page_by_path('eng');
    return $english_page ? get_permalink($english_page) : home_url('/eng/');
}

function osadafabryczna_get_language_url($language) {
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
