<?php
get_header();
$osada_language = function_exists('osadafabryczna_get_current_language') ? osadafabryczna_get_current_language() : 'pl';
$osada_back_url = 'en' === $osada_language && function_exists('osadafabryczna_get_english_front_page_url')
    ? osadafabryczna_get_english_front_page_url()
    : home_url('/');
$osada_back_label = 'en' === $osada_language ? 'Back to map' : 'Powrót do mapy';
$osada_toc_title = 'en' === $osada_language ? 'On this page' : 'Na tej stronie';
$osada_toc_aria = 'en' === $osada_language ? 'Table of contents' : 'Spis treści';
$osada_toc_items = 'en' === $osada_language
    ? array(
        'w-skrocie' => 'Short summary',
        'historia' => 'Discover the history',
        'ciekawostka' => 'Did you know that...',        
        'archiwum' => 'Time travel',
        'architektura' => 'Architecture',
        'spojrz-uwazniej' => 'Take a closer look at...',
        'galeria' => 'Gallery',
        'w-poblizu' => 'Nearby',
        'zrodla' => 'Sources',
    )
    : array(
        'w-skrocie' => 'W skrócie',
        'historia' => 'Poznaj historię',
        'ciekawostka' => 'Czy wiesz, że...',        
        'archiwum' => 'Podróż w czasie',
        'architektura' => 'Architektura',
        'spojrz-uwazniej' => 'Spójrz uważniej na...',
        'galeria' => 'Galeria',        
        'w-poblizu' => 'W pobliżu',
        'zrodla' => 'Źródła',
    );
?>

<?php if (have_posts()) : ?>
    <?php while (have_posts()) : the_post(); ?>
        <main class="building-page">
            <article id="post-<?php the_ID(); ?>" <?php post_class('building-page-article'); ?>>
                <header class="building-page-header">
                    <h1><?php the_title(); ?></h1>
                </header>

                <div class="building-layout">
                    <div class="building-content">
                        <?php the_content(); ?>
                    </div>

                    <aside class="building-toc" aria-labelledby="building-toc-title">
                        <h2 id="building-toc-title" class="building-toc-title"><?php echo esc_html($osada_toc_title); ?></h2>
                        <nav class="building-toc-nav" aria-label="<?php echo esc_attr($osada_toc_aria); ?>">
                            <?php foreach ($osada_toc_items as $anchor => $label) : ?>
                                <a href="#<?php echo esc_attr($anchor); ?>"><?php echo esc_html($label); ?></a>
                            <?php endforeach; ?>
                        </nav>
                    </aside>
                </div>

                <footer class="building-footer">
                    <a href="<?php echo esc_url($osada_back_url); ?>" class="back-to-map">← <?php echo esc_html($osada_back_label); ?></a>
                </footer>
            </article>
        </main>
    <?php endwhile; ?>
<?php endif; ?>

<?php
get_footer('budynek');
