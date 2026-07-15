<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php
$osada_header_language = function_exists('osadafabryczna_get_current_language') ? osadafabryczna_get_current_language() : 'pl';
$osada_search_label = 'en' === $osada_header_language ? 'Search' : 'Szukaj';
?>
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
    <nav id="primary-menu" class="main-nav" aria-label="<?php esc_attr_e('Primary navigation', 'osadafabryczna'); ?>">
      <?php
        wp_nav_menu([
          'theme_location' => function_exists('osadafabryczna_get_current_language') && 'en' === osadafabryczna_get_current_language() ? 'primary_en' : 'primary',
          'container' => false,
          'menu_class' => 'menu',
          'fallback_cb' => false
        ]);
      ?>
    </nav>

    <div class="header-actions">
    <button class="search-toggle" type="button" aria-expanded="false" aria-controls="site-search" aria-label="<?php echo esc_attr($osada_search_label); ?>">
      <span aria-hidden="true">⌕</span>
    </button>

    <?php if (function_exists('osadafabryczna_language_switcher')) : ?>
      <?php osadafabryczna_language_switcher(); ?>
    <?php endif; ?>

    <!-- Mobile menu toggle -->
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-menu" aria-label="Otwórz menu">
      &#9776;
    </button>
    </div>

    <div id="site-search" class="site-search" aria-hidden="true">
      <?php get_search_form(); ?>
    </div>
  </div>
</header>
