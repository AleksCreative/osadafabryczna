<?php
get_header(); 
?>

<main>
    <!-- Map container -->
    <div id="map"></div>
    <button id="geolocation-toggle" class="geolocation-toggle" type="button" aria-pressed="false">
        <span class="geolocation-toggle__label">Włącz lokalizację</span>
    </button>

    <!-- Slide-up panel (hidden by default) -->
    <div id="slide-panel" class="slide-panel">
        <div class="panel-handle"></div>
        <button id="panel-close" class="panel-close" aria-label="Zamknij panel">×</button>
        <div id="panel-content"></div>
    </div>
</main>

<?php
get_footer();
