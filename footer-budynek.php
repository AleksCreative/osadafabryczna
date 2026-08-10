<footer class="site-footer site-footer--budynek">
    <div class="footer-inner footer-inner--budynek">
        <?php osadafabryczna_render_scholarship_footer(); ?>
        <?php if (is_active_sidebar('budynek_footer')) : ?>
            <?php dynamic_sidebar('budynek_footer'); ?>
        <?php else : ?>
            <p>© <?php echo esc_html(wp_date('Y')); ?> <?php echo esc_html(get_bloginfo('name')); ?></p>
        <?php endif; ?>
        <p class="site-footer__credit">
            Stworzona z <span aria-label="miłością">♥</span> i hektolitrami <span aria-label="kawy">☕</span> przez
            <a href="https://alekscreative.com/">Aleks Creative</a>
        </p>
    </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
