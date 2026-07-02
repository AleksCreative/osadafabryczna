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
      <a href="<?php echo esc_url(home_url('/')); ?>">
        <?php bloginfo('name'); ?>
      </a>
    </div>

    <!-- Primary Navigation -->
    <nav class="main-nav">
      <?php
        wp_nav_menu([
          'theme_location' => 'primary',
          'container' => false,
          'menu_class' => 'menu',
          'fallback_cb' => false
        ]);
      ?>
    </nav>

    <!-- Mobile menu toggle -->
    <button class="menu-toggle" aria-expanded="false" aria-controls="primary-menu">
      &#9776;
    </button>
  </div>
</header>