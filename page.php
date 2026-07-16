<?php
get_header();
?>

<main class="site-fallback standard-page">
    <?php if (have_posts()) : ?>
        <?php while (have_posts()) : the_post(); ?>
            <article id="post-<?php the_ID(); ?>" <?php post_class('standard-page-article'); ?>>
                <header class="standard-page-header">
                    <h1 class="site-fallback-title"><?php the_title(); ?></h1>
                </header>

                <div class="site-fallback-content standard-page-content">
                    <?php the_content(); ?>
                </div>
            </article>
        <?php endwhile; ?>
    <?php endif; ?>
</main>

<?php
get_footer();
