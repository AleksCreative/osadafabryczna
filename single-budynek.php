<?php
get_header();
$osada_language = function_exists('osadafabryczna_get_current_language') ? osadafabryczna_get_current_language() : 'pl';
$osada_back_url = 'en' === $osada_language && function_exists('osadafabryczna_get_english_front_page_url')
    ? osadafabryczna_get_english_front_page_url()
    : home_url('/');
$osada_back_label = 'en' === $osada_language ? 'Back to map' : 'Powrót do mapy';

// Start the loop
if ( have_posts() ) :
    while ( have_posts() ) : the_post(); 

        // Avoid fatal errors when ACF is inactive.
        $short_desc = '';
        $marker_icon = '';
        $lat = '';
        $lng = '';
        if ( function_exists('get_field') ) {
            $short_desc = get_field('short_description');
            $marker_icon = get_field('marker_icon');
            $lat = get_field('latitude');
            $lng = get_field('longitude');
        }

        if ( is_array($marker_icon) && isset($marker_icon['url']) ) {
            $marker_icon = $marker_icon['url'];
        }
        ?>

        <main class="building-single">
            <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
                <header class="building-header">
                    <h1><?php the_title(); ?></h1>
                    <!--<?php if ($short_desc) : ?>
                        <p class="building-short"><?php echo esc_html($short_desc); ?></p>
                    <?php endif; ?> -->
                </header>

               <!-- <?php if ($marker_icon) : ?>
                    <div class="building-image">
                        <img src="<?php echo esc_url($marker_icon); ?>" alt="<?php the_title_attribute(); ?>">
                    </div>
                <?php endif; ?>

                <div class="building-content">
                    <?php the_content(); ?>
                </div> -->

                <footer class="building-footer">
                    <a href="<?php echo esc_url($osada_back_url); ?>" class="back-to-map">← <?php echo esc_html($osada_back_label); ?></a>
                </footer>
            </article>
        </main>

    <?php endwhile;
endif;

get_footer('budynek');
