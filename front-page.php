<?php
get_header(); 
?>

<main>
    <!-- Map container -->
    <div id="map"></div>
    <button id="geolocation-toggle" class="geolocation-toggle" type="button" aria-pressed="false">
        <span class="geolocation-toggle__label">Włącz lokalizację</span>
    </button>

    <!-- Existing map popup panel remains unchanged -->
    <div id="slide-panel" class="slide-panel">
        <div class="panel-handle"></div>
        <button id="panel-close" class="panel-close" aria-label="Zamknij panel">×</button>
        <div id="panel-content"></div>
    </div>

    <aside id="info-panel" class="info-panel" aria-label="Panel informacyjny">
        <span class="info-panel-edge info-panel-edge--left" aria-hidden="true"></span>
        <span class="info-panel-edge info-panel-edge--right" aria-hidden="true"></span>
        <span class="info-panel-edge info-panel-edge--top" aria-hidden="true"></span>
        <span class="info-panel-edge info-panel-edge--bottom" aria-hidden="true"></span>
        <button id="info-panel-close" class="info-panel-close" aria-label="Zamknij panel informacyjny">×</button>
        <div id="info-panel-content" class="info-panel-content">
            <?php if ( have_posts() ) : while ( have_posts() ) : the_post(); the_content(); endwhile; endif; ?>
        </div>
    </aside>

    <button id="info-panel-toggle" class="info-panel-toggle" type="button" aria-label="Otwórz panel informacyjny">
        <span>INFO</span>
    </button>
</main>

<?php
get_footer();
