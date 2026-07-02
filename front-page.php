<?php
get_header(); 
?>

<main>
    <!-- Map container -->
    <div id="map"></div>

    <!-- Slide-up panel (hidden by default) -->
    <div id="slide-panel" class="slide-panel">
        <div class="panel-handle"></div>
        <button id="panel-close" class="panel-close" aria-label="Zamknij panel">×</button>
        <div id="panel-content"></div>
    </div>
</main>

<?php
get_footer();
