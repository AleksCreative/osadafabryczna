<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<header class="site-header">
  <div class="header-inner">
    
    <!-- Logo -->
    <div class="site-logo">
      <?php if (has_custom_logo()) : ?>
        <?php the_custom_logo(); ?>
      <?php else : ?>
        <a href="<?php echo esc_url(home_url('/')); ?>">
          <?php bloginfo('name'); ?>
        </a>
      <?php endif; ?>
    </div>

    <!-- Primary Navigation -->
    <nav id="primary-menu" class="main-nav" aria-hidden="true">
      <?php
        wp_nav_menu([
          'theme_location' => function_exists('osadafabryczna_get_current_language') && 'en' === osadafabryczna_get_current_language() ? 'primary_en' : 'primary',
          'container' => false,
          'menu_class' => 'menu',
          'fallback_cb' => false
        ]);
      ?>
    </nav>

    <?php if (function_exists('osadafabryczna_language_switcher')) : ?>
      <?php osadafabryczna_language_switcher(); ?>
    <?php endif; ?>

    <!-- Menu toggle -->
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-menu" aria-label="Otwórz menu">
      &#9776;
    </button>
  </div>
</header>
