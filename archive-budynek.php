<?php
get_header();

$osada_language = function_exists('osada_core_get_current_language') ? osada_core_get_current_language() : 'pl';
$osada_archive_labels = 'en' === $osada_language
    ? array(
        'title'       => 'Buildings',
        'read_more'   => 'View details',
        'previous'    => 'Previous',
        'next'        => 'Next',
        'no_results'  => 'No buildings to display.',
    )
    : array(
        'title'       => post_type_archive_title('', false),
        'read_more'   => 'Zobacz szczegóły',
        'previous'    => 'Poprzednia',
        'next'        => 'Następna',
        'no_results'  => 'Brak budynków do wyświetlenia.',
    );
$osada_museum_name = 'en' === $osada_language
    ? 'Museum of Western Mazovia in Żyrardów'
    : 'Muzeum Mazowsza Zachodniego w Żyrardowie';
$osada_museum_link_label = $osada_museum_name . ('en' === $osada_language ? ' (opens in a new tab)' : ' (otwiera się w nowej karcie)');
?>

<main class="buildings-archive">
    <section class="archive-header">
        <h1><?php echo esc_html($osada_archive_labels['title']); ?></h1>
        <?php
        $desc = get_the_archive_description();
        if ( $desc ) :
            ?>
            <div class="archive-description"><?php echo wp_kses_post( $desc ); ?></div>
        <?php endif; ?>
        <!--<div class="building-consultation">
            <a class="building-consultation__logo" href="https://www.muzeumzyrardow.pl/" target="_blank" rel="noopener noreferrer" aria-label="<?php echo esc_attr($osada_museum_link_label); ?>">
                <img
                    src="<?php echo esc_url(get_theme_file_uri('/dist/assets/' . rawurlencode('logo muzeum mazowsza zachodniego3.png'))); ?>"
                    alt="<?php echo esc_attr($osada_museum_name); ?>"
                    width="648"
                    height="506"
                    decoding="async"
                >
            </a>
            <p>
                <?php echo esc_html('en' === $osada_language
                    ? 'The building descriptions were prepared in consultation with the staff of the'
                    : 'Opisy budynków skonsultowano merytorycznie z pracownikami'); ?>
                <a href="https://www.muzeumzyrardow.pl/" target="_blank" rel="noopener noreferrer" aria-label="<?php echo esc_attr($osada_museum_link_label); ?>"><?php echo esc_html($osada_museum_name); ?></a>.
            </p>
        </div>-->
    </section>

    <?php if ( have_posts() ) : ?>
        <div class="buildings-grid">
            <?php while ( have_posts() ) : the_post(); ?>
                <?php
                $osada_subtitle = function_exists('get_field') ? get_field('subtitle') : '';
                $osada_marker_icon = osadafabryczna_get_building_marker_url(get_the_ID());
                ?>
                <article id="post-<?php the_ID(); ?>" <?php post_class( 'building-card' ); ?>>
                    <?php if ($osada_marker_icon) : ?>
                        <a href="<?php the_permalink(); ?>" class="building-card-icon" aria-hidden="true" tabindex="-1">
                            <img src="<?php echo esc_url($osada_marker_icon); ?>" alt="">
                        </a>
                    <?php endif; ?>

                    <h2 class="building-card-title">
                        <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
                    </h2>

                    <?php if ($osada_subtitle) : ?>
                        <h3 class="building-card-subtitle"><?php echo esc_html(wp_strip_all_tags($osada_subtitle)); ?></h3>
                    <?php endif; ?>

                    <a class="building-card-link" href="<?php the_permalink(); ?>">
                        <?php echo esc_html($osada_archive_labels['read_more']); ?>
                    </a>
                </article>
            <?php endwhile; ?>
        </div>

        <nav class="archive-pagination">
            <?php
            the_posts_pagination(
                [
                    'mid_size'  => 1,
                    'prev_text' => esc_html($osada_archive_labels['previous']),
                    'next_text' => esc_html($osada_archive_labels['next']),
                ]
            );
            ?>
        </nav>
    <?php else : ?>
        <p><?php echo esc_html($osada_archive_labels['no_results']); ?></p>
    <?php endif; ?>
</main>

<?php
get_footer();
