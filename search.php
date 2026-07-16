<?php
get_header();

$osada_search_language = function_exists('osadafabryczna_get_current_language') ? osadafabryczna_get_current_language() : 'pl';
$osada_search_labels = 'en' === $osada_search_language
    ? array(
        'title'       => 'Search results',
        'for'         => 'Search results for',
        'building'    => 'Building',
        'page'        => 'Page',
        'read_more'   => 'View page',
        'previous'    => 'Previous',
        'next'        => 'Next',
        'no_results'  => 'No results found. Try a different phrase.',
    )
    : array(
        'title'       => 'Wyniki wyszukiwania',
        'for'         => 'Wyniki wyszukiwania dla',
        'building'    => 'Budynek',
        'page'        => 'Strona',
        'read_more'   => 'Zobacz stronę',
        'previous'    => 'Poprzednia',
        'next'        => 'Następna',
        'no_results'  => 'Brak wyników. Spróbuj wpisać inne hasło.',
    );
$osada_search_query = get_search_query();
?>

<main class="search-results">
    <header class="search-results__header">
        <h1>
            <?php if ($osada_search_query) : ?>
                <?php echo esc_html($osada_search_labels['for']); ?>: „<?php echo esc_html($osada_search_query); ?>”
            <?php else : ?>
                <?php echo esc_html($osada_search_labels['title']); ?>
            <?php endif; ?>
        </h1>
    </header>

    <?php if (have_posts()) : ?>
        <div class="search-results__list">
            <?php while (have_posts()) : the_post(); ?>
                <?php
                $osada_result_type = 'budynek' === get_post_type() ? $osada_search_labels['building'] : $osada_search_labels['page'];
                $osada_result_subtitle = 'budynek' === get_post_type() && function_exists('get_field') ? get_field('subtitle') : '';
                $osada_result_excerpt = get_the_excerpt();
                ?>
                <article id="post-<?php the_ID(); ?>" <?php post_class('search-result'); ?>>
                    <p class="search-result__type"><?php echo esc_html($osada_result_type); ?></p>
                    <h2 class="search-result__title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>

                    <?php if (!empty($osada_result_subtitle)) : ?>
                        <p class="search-result__subtitle"><?php echo esc_html(wp_strip_all_tags($osada_result_subtitle)); ?></p>
                    <?php endif; ?>

                    <?php if (!empty($osada_result_excerpt)) : ?>
                        <div class="search-result__excerpt"><?php echo wp_kses_post(wpautop(wp_trim_words(wp_strip_all_tags($osada_result_excerpt), 34))); ?></div>
                    <?php endif; ?>

                    <a class="search-result__link" href="<?php the_permalink(); ?>"><?php echo esc_html($osada_search_labels['read_more']); ?></a>
                </article>
            <?php endwhile; ?>
        </div>

        <nav class="search-results__pagination" aria-label="<?php echo esc_attr($osada_search_labels['title']); ?>">
            <?php
            the_posts_pagination(array(
                'mid_size'  => 1,
                'prev_text' => esc_html($osada_search_labels['previous']),
                'next_text' => esc_html($osada_search_labels['next']),
            ));
            ?>
        </nav>
    <?php else : ?>
        <p class="search-results__empty"><?php echo esc_html($osada_search_labels['no_results']); ?></p>
    <?php endif; ?>
</main>

<?php
get_footer();
