<?php
$osada_show_standard_footer = is_post_type_archive('budynek')
    || (is_page() && !is_front_page() && !osadafabryczna_is_english_front_page());
?>

<?php if ($osada_show_standard_footer) : ?>
    <footer class="site-footer">
        <div class="footer-inner">
            <p class="site-footer__copyright">
                &copy; <?php echo esc_html(wp_date('Y')); ?> Osada Fabryczna Żyrardowa
            </p>
            <p class="site-footer__credit">
                Stworzona z <span aria-label="miłością">♥</span> i hektolitrami <span aria-label="kawy">☕</span> przez
                <a href="https://alekscreative.com/">Aleks Creative</a>
            </p>
        </div>
    </footer>
<?php endif; ?>

<?php wp_footer(); ?>
</body>
</html>
