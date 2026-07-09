<footer class="site-footer site-footer--budynek">
    <div class="footer-inner footer-inner--budynek">
        <?php if (is_active_sidebar('budynek_footer')) : ?>
            <?php dynamic_sidebar('budynek_footer'); ?>
        <?php else : ?>
            <p>© 2026 Osada Fabryczna</p>
        <?php endif; ?>
    </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
