<?php
get_header(); 
$osada_language = function_exists('osadafabryczna_get_current_language') ? osadafabryczna_get_current_language() : 'pl';
$osada_labels = function_exists('osadafabryczna_get_language_labels') ? osadafabryczna_get_language_labels($osada_language) : array();
$osada_info_label = 'en' === $osada_language ? 'Information panel' : 'Panel informacyjny';
$osada_info_close = 'en' === $osada_language ? 'Close information panel' : 'Zamknij panel informacyjny';
$osada_info_open = 'en' === $osada_language ? 'Open information panel' : 'Otwórz panel informacyjny';
$osada_building_close = 'en' === $osada_language ? 'Close panel' : 'Zamknij panel';
?>

<main>
    <!-- Map container -->
    <div id="map"></div>
    <img
        class="map-compass"
        src="<?php echo esc_url(get_template_directory_uri() . '/dist/assets/roza-wiatrow.png'); ?>"
        alt=""
        aria-hidden="true"
    >
    <button id="geolocation-toggle" class="geolocation-toggle" type="button" aria-pressed="false">
        <span class="geolocation-toggle__label"><?php echo esc_html($osada_labels['enableLocation'] ?? 'Włącz lokalizację'); ?></span>
    </button>

    <!-- Existing map popup panel remains unchanged -->
    <div id="slide-panel" class="slide-panel">
        <div class="panel-handle"></div>
        <span class="slide-panel-edge slide-panel-edge--left" aria-hidden="true"></span>
        <span class="slide-panel-edge slide-panel-edge--right" aria-hidden="true"></span>
        <span class="slide-panel-edge slide-panel-edge--top" aria-hidden="true"></span>
        <span class="slide-panel-edge slide-panel-edge--bottom" aria-hidden="true"></span>
        <button id="panel-close" class="panel-close" aria-label="<?php echo esc_attr($osada_building_close); ?>">×</button>
        <div id="panel-content"></div>
    </div>

    <aside id="info-panel" class="info-panel" aria-label="<?php echo esc_attr($osada_info_label); ?>">
        <span class="info-panel-edge info-panel-edge--left" aria-hidden="true"></span>
        <span class="info-panel-edge info-panel-edge--right" aria-hidden="true"></span>
        <span class="info-panel-edge info-panel-edge--top" aria-hidden="true"></span>
        <span class="info-panel-edge info-panel-edge--bottom" aria-hidden="true"></span>
        <button id="info-panel-close" class="info-panel-close" aria-label="<?php echo esc_attr($osada_info_close); ?>">×</button>
        <div id="info-panel-content" class="info-panel-content">
            <?php if ( have_posts() ) : while ( have_posts() ) : the_post(); the_content(); endwhile; endif; ?>
        </div>
        <footer class="info-panel-footer">
            <p>© <?php echo esc_html(wp_date('Y')); ?> <?php echo esc_html(get_bloginfo('name')); ?></p>
        </footer>
    </aside>

    <button id="info-panel-toggle" class="info-panel-toggle" type="button" aria-label="<?php echo esc_attr($osada_info_open); ?>">
        <span>INFO</span>
    </button>
</main>

<?php
get_footer();
