<?php
get_header();

$osada_language = function_exists('osadafabryczna_get_current_language') ? osadafabryczna_get_current_language() : 'pl';
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
    </section>

    <?php if ( have_posts() ) : ?>
        <div class="buildings-grid">
            <?php while ( have_posts() ) : the_post(); ?>
                <?php
                $osada_subtitle = function_exists('get_field') ? get_field('subtitle') : '';
                $osada_marker_icon = function_exists('get_field') ? get_field('marker_icon') : '';

                if (is_array($osada_marker_icon)) {
                    $osada_marker_icon = $osada_marker_icon['url'] ?? '';
                }
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
