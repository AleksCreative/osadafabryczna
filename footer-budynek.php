<footer class="site-footer site-footer--budynek">
    <div class="footer-inner footer-inner--budynek">
        <?php if (is_active_sidebar('budynek_footer')) : ?>
            <?php dynamic_sidebar('budynek_footer'); ?>
        <?php else : ?>
            <p>© <?php echo esc_html(wp_date('Y')); ?> <?php echo esc_html(get_bloginfo('name')); ?></p>
        <?php endif; ?>
    </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
