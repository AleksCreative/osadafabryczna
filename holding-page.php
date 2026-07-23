<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <?php wp_head(); ?>
</head>
<body <?php body_class('holding-page'); ?>>
<?php wp_body_open(); ?>
<main class="holding-page__main">
    <section class="holding-card" aria-labelledby="holding-title">
        <div class="holding-card__brand">
            <?php if (has_custom_logo()) : ?>
                <?php the_custom_logo(); ?>
            <?php else : ?>
                <span class="holding-card__site-name"><?php bloginfo('name'); ?></span>
            <?php endif; ?>
        </div>

        <div class="holding-card__content">
            <p class="holding-card__eyebrow">Projekt w przygotowaniu</p>
            <h1 id="holding-title"><?php echo esc_html(get_option('osadafabryczna_holding_title', 'Osada Fabryczna')); ?></h1>
            <div class="holding-card__description">
                <?php
                echo wp_kses_post(wpautop(get_option(
                    'osadafabryczna_holding_content',
                    '<p>Tworzymy cyfrową mapę Osady Fabrycznej. Projekt jest obecnie w fazie testów terenowych.</p>'
                )));
                ?>
            </div>
            <?php
            $facebook_url = get_option('osadafabryczna_facebook_url', '');
            $instagram_url = get_option('osadafabryczna_instagram_url', '');
            ?>
            <?php if ($facebook_url || $instagram_url) : ?>
                <nav class="holding-socials" aria-label="Media społecznościowe">
                    <?php if ($facebook_url) : ?>
                        <a class="holding-socials__button holding-socials__button--facebook" href="<?php echo esc_url($facebook_url); ?>" target="_blank" rel="noopener noreferrer">
                            <span aria-hidden="true">f</span>
                            Obserwuj na Facebooku
                        </a>
                    <?php endif; ?>
                    <?php if ($instagram_url) : ?>
                        <a class="holding-socials__button holding-socials__button--instagram" href="<?php echo esc_url($instagram_url); ?>" target="_blank" rel="noopener noreferrer">
                            <span aria-hidden="true">◎</span>
                            Obserwuj na Instagramie
                        </a>
                    <?php endif; ?>
                </nav>
            <?php endif; ?>
        </div>

        <form class="holding-access-form" method="post">
            <h2>Wejście dla testerów</h2>
            <p>Wpisz otrzymane hasło, aby otworzyć mapę i pozostałe strony projektu.</p>
            <?php if (!empty($GLOBALS['osadafabryczna_access_error'])) : ?>
                <p class="holding-access-form__error" role="alert">Podane hasło jest nieprawidłowe.</p>
            <?php endif; ?>
            <?php wp_nonce_field('osadafabryczna_unlock', 'osada_access_nonce'); ?>
            <div class="holding-access-form__fields">
                <label class="screen-reader-text" for="osada-access-password">Hasło</label>
                <input id="osada-access-password" type="password" name="osada_access_password" placeholder="Hasło" required autocomplete="current-password">
                <button type="submit">Wejdź na stronę</button>
            </div>
        </form>
    </section>
</main>
<?php wp_footer(); ?>
</body>
</html>
