<?php
get_header();
?>

<main class="site-fallback">
    <?php if (have_posts()) : ?>
        <?php while (have_posts()) : the_post(); ?>
            <article id="post-<?php the_ID(); ?>" <?php post_class('site-fallback-article'); ?>>
                <h1 class="site-fallback-title">
                    <?php if (is_singular()) : ?>
                        <?php the_title(); ?>
                    <?php else : ?>
                        <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
                    <?php endif; ?>
                </h1>

                <div class="site-fallback-content">
                    <?php if (is_singular()) : ?>
                        <?php the_content(); ?>
                    <?php else : ?>
                        <?php the_excerpt(); ?>
                    <?php endif; ?>
                </div>
            </article>
        <?php endwhile; ?>
    <?php else : ?>
        <p><?php esc_html_e('No content found.', 'osadafabryczna'); ?></p>
    <?php endif; ?>
</main>

<?php
get_footer();
