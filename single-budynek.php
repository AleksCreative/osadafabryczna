<?php
get_header();
$osada_language = function_exists('osadafabryczna_get_current_language') ? osadafabryczna_get_current_language() : 'pl';
$osada_back_url = 'en' === $osada_language && function_exists('osadafabryczna_get_english_front_page_url')
    ? osadafabryczna_get_english_front_page_url()
    : home_url('/');
$osada_back_label = 'en' === $osada_language ? 'Back to map' : 'Powrót do mapy';
$osada_toc_title = 'en' === $osada_language ? 'On this page' : 'Na tej stronie';
$osada_toc_aria = 'en' === $osada_language ? 'Table of contents' : 'Spis treści';
$osada_toc_items = 'en' === $osada_language
    ? array(
        'w-skrocie' => 'Short summary',
        'historia' => 'Discover the history',
        'ciekawostka' => 'Did you know...',        
        'archiwum' => 'Time travel',
        'architektura' => 'Architecture',
        'spojrz-uwazniej' => 'Take a closer look...',
        'galeria' => 'Gallery',
        'w-poblizu' => 'Nearby',
        'zrodla' => 'Sources',
    )
    : array(
        'w-skrocie' => 'W skrócie',
        'historia' => 'Poznaj historię',
        'ciekawostka' => 'Czy wiesz, że...',        
        'archiwum' => 'Podróż w czasie',
        'architektura' => 'Architektura',
        'spojrz-uwazniej' => 'Spójrz uważniej...',
        'galeria' => 'Galeria',        
        'w-poblizu' => 'W pobliżu',
        'zrodla' => 'Źródła',
    );
?>

<?php if (have_posts()) : ?>
    <?php while (have_posts()) : the_post(); ?>
        <?php
        $osada_hero_illustration = function_exists('get_field') ? get_field('hero_illustration') : 0;
        $osada_quick_facts = function_exists('get_field') ? get_field('quick_facts') : array();
        $osada_history = function_exists('get_field') ? get_field('history') : '';
        $osada_did_you_know = function_exists('get_field') ? get_field('did_you_know') : '';
        $osada_time_travel = function_exists('get_field') ? get_field('time_travel') : array();
        $osada_architecture = function_exists('get_field') ? get_field('architecture') : '';
        $osada_take_a_closer_look = function_exists('get_field') ? get_field('take_a_closer_look') : '';
        $osada_gallery = function_exists('get_field') ? get_field('gallery') : array();
        $osada_nearby_buildings = function_exists('get_field') ? get_field('nearby_buildings') : array();
        $osada_sources = function_exists('get_field') ? get_field('sources') : array();
        $osada_fact_labels = 'en' === $osada_language
            ? array(
                'date' => 'Built',
                'style' => 'Architectural style',
                'address' => 'Address',
                'original_use' => 'Original purpose',
                'current_use' => 'Current purpose',
                'visiting' => 'Visiting',
            )
            : array(
                'date' => 'Powstanie:',
                'style' => 'Styl architektoniczny:',
                'address' => 'Adres:',
                'original_use' => 'Pierwotna funkcja:',
                'current_use' => 'Obecna funkcja:',
                'visiting' => 'Zwiedzanie:',
            );
        $osada_get_icon_url = static function ($filename) {
            $relative_path = 'dist/assets/icons/' . $filename;

            return file_exists(get_theme_file_path($relative_path)) ? get_theme_file_uri($relative_path) : '';
        };
        $osada_fact_icons = array(
            'date' => 'fact-date.png',
            'style' => 'fact-style.png',
            'address' => 'fact-address.png',
            'original_use' => 'fact-original-use.png',
            'current_use' => 'fact-current-use.png',
            'visiting' => 'fact-visiting.png',
        );
        $osada_toc_items = array();

        if (!empty($osada_quick_facts)) {
            $osada_toc_items['w-skrocie'] = 'en' === $osada_language ? 'Short summary' : 'W skrócie';
        }

        if (!empty($osada_history)) {
            $osada_toc_items['historia'] = 'en' === $osada_language ? 'Discover the history' : 'Poznaj historię';
        }

        if (!empty($osada_did_you_know)) {
            $osada_toc_items['ciekawostka'] = 'en' === $osada_language ? 'Did you know...' : 'Czy wiesz, że...';
        }

        if (!empty($osada_time_travel)) {
            $osada_toc_items['archiwum'] = 'en' === $osada_language ? 'Time travel' : 'Podróż w czasie';
        }

        if (!empty($osada_architecture)) {
            $osada_toc_items['architektura'] = 'en' === $osada_language ? 'Architecture' : 'Architektura';
        }

        if (!empty($osada_take_a_closer_look)) {
            $osada_toc_items['spojrz-uwazniej'] = 'en' === $osada_language ? 'Take a closer look...' : 'Spójrz uważniej';
        }

        if (!empty($osada_gallery)) {
            $osada_toc_items['galeria'] = 'en' === $osada_language ? 'Gallery' : 'Galeria';
        }

        if (!empty($osada_nearby_buildings)) {
            $osada_toc_items['w-poblizu'] = 'en' === $osada_language ? 'Nearby' : 'W pobliżu';
        }

        if (!empty($osada_sources)) {
            $osada_toc_items['zrodla'] = 'en' === $osada_language ? 'Sources' : 'Źródła';
        }
        ?>
        <main class="building-page">
            <article id="post-<?php the_ID(); ?>" <?php post_class('building-page-article'); ?>>
                <header class="building-page-header">
                    <h1><?php the_title(); ?></h1>
                    <div class="building-hero-row">
                        <?php if (!empty($osada_hero_illustration)) : ?>
                            <div class="building-hero-illustration">
                                <?php echo wp_get_attachment_image($osada_hero_illustration, 'large', false, array('class' => 'building-hero-illustration__image')); ?>
                            </div>
                        <?php endif; ?>

                        <?php if (!empty($osada_toc_items)) : ?>
                            <aside class="building-toc" aria-labelledby="building-toc-title">
                                <h2 id="building-toc-title" class="building-toc-title"><?php echo esc_html($osada_toc_title); ?></h2>
                                <nav class="building-toc-nav" aria-label="<?php echo esc_attr($osada_toc_aria); ?>">
                                    <?php foreach ($osada_toc_items as $anchor => $label) : ?>
                                        <a href="#<?php echo esc_attr($anchor); ?>"><?php echo esc_html($label); ?></a>
                                    <?php endforeach; ?>
                                </nav>
                            </aside>
                        <?php endif; ?>
                    </div>
                </header>

                <div class="building-layout">
                    <div class="building-content">
                        <?php if (!empty($osada_quick_facts)) : ?>
                            <section id="w-skrocie" class="building-section building-summary" aria-labelledby="building-summary-title">
                                <h2 id="building-summary-title"><?php echo esc_html('en' === $osada_language ? 'Short summary' : 'W skrócie'); ?></h2>
                                <div class="building-summary__facts">
                                    <?php foreach ($osada_quick_facts as $osada_fact) : ?>
                                        <?php
                                        $osada_fact_type = isset($osada_fact['fact_type']) ? $osada_fact['fact_type'] : '';
                                        $osada_fact_content = isset($osada_fact['fact_content']) ? $osada_fact['fact_content'] : '';
                                        $osada_fact_icon_url = isset($osada_fact_icons[$osada_fact_type]) ? $osada_get_icon_url($osada_fact_icons[$osada_fact_type]) : '';

                                        if (empty($osada_fact_type) || empty($osada_fact_content) || !isset($osada_fact_labels[$osada_fact_type])) {
                                            continue;
                                        }
                                        ?>
                                        <div class="building-fact">
                                            <span class="building-fact__icon" aria-hidden="true">
                                                <?php if (!empty($osada_fact_icon_url)) : ?>
                                                    <img src="<?php echo esc_url($osada_fact_icon_url); ?>" alt="">
                                                <?php endif; ?>
                                            </span>
                                            <div class="building-fact__content">
                                                <strong><?php echo esc_html($osada_fact_labels[$osada_fact_type]); ?></strong>
                                                <div><?php echo wp_kses_post(wpautop($osada_fact_content)); ?></div>
                                            </div>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </section>
                        <?php endif; ?>

                        <?php if (!empty($osada_history)) : ?>
                            <section id="historia" class="building-section" aria-labelledby="building-history-title">
                                <h2 id="building-history-title"><?php echo esc_html('en' === $osada_language ? 'Discover the history' : 'Poznaj historię'); ?></h2>
                                <?php echo wp_kses_post($osada_history); ?>
                            </section>
                        <?php endif; ?>

                        <?php if (!empty($osada_did_you_know)) : ?>
                            <aside id="ciekawostka" class="building-callout building-callout--fact" aria-labelledby="building-did-you-know-title">
                                <?php $osada_did_you_know_icon_url = $osada_get_icon_url('did-you-know.png'); ?>
                                <h2 id="building-did-you-know-title" class="building-callout__title">
                                    <?php if (!empty($osada_did_you_know_icon_url)) : ?>
                                        <img class="building-callout__icon" src="<?php echo esc_url($osada_did_you_know_icon_url); ?>" alt="">
                                    <?php endif; ?>
                                    <span><?php echo esc_html('en' === $osada_language ? 'Did you know...' : 'Czy wiesz, że...'); ?></span>
                                </h2>
                                <?php echo wp_kses_post($osada_did_you_know); ?>
                            </aside>
                        <?php endif; ?>

                        <?php if (!empty($osada_time_travel)) : ?>
                            <section id="archiwum" class="building-section building-time-travel" aria-labelledby="building-time-travel-title">
                                <h2 id="building-time-travel-title"><?php echo esc_html('en' === $osada_language ? 'Time travel' : 'Podróż w czasie'); ?></h2>
                                <div class="building-carousel" data-building-carousel>
                                    <button class="building-carousel__button building-carousel__button--previous" type="button" data-carousel-prev aria-label="<?php echo esc_attr('en' === $osada_language ? 'Show previous photographs' : 'Pokaż wcześniejsze fotografie'); ?>">‹</button>
                                    <div class="building-carousel__viewport" data-carousel-viewport>
                                        <?php foreach ($osada_time_travel as $osada_time_travel_item) : ?>
                                            <?php
                                            $osada_time_travel_image = isset($osada_time_travel_item['image']) ? $osada_time_travel_item['image'] : 0;
                                            $osada_time_travel_title = isset($osada_time_travel_item['title']) ? $osada_time_travel_item['title'] : '';
                                            $osada_time_travel_caption = isset($osada_time_travel_item['caption']) ? $osada_time_travel_item['caption'] : '';
                                            $osada_time_travel_image_full = $osada_time_travel_image ? wp_get_attachment_image_url($osada_time_travel_image, 'full') : '';
                                            $osada_time_travel_image_alt = $osada_time_travel_image ? get_post_meta($osada_time_travel_image, '_wp_attachment_image_alt', true) : '';

                                            if (empty($osada_time_travel_image)) {
                                                continue;
                                            }
                                            ?>
                                            <figure class="building-carousel__card">
                                                <button class="building-carousel__image-trigger" type="button" data-lightbox-image data-lightbox-source="<?php echo esc_url($osada_time_travel_image_full); ?>" data-lightbox-alt="<?php echo esc_attr($osada_time_travel_image_alt); ?>">
                                                    <?php echo wp_get_attachment_image($osada_time_travel_image, 'medium_large', false, array('class' => 'building-carousel__image')); ?>
                                                </button>
                                                <?php if (!empty($osada_time_travel_title) || !empty($osada_time_travel_caption)) : ?>
                                                    <figcaption class="building-carousel__caption">
                                                        <?php if (!empty($osada_time_travel_title)) : ?>
                                                            <strong><?php echo esc_html($osada_time_travel_title); ?></strong>
                                                        <?php endif; ?>
                                                        <?php if (!empty($osada_time_travel_caption)) : ?>
                                                            <span><?php echo esc_html($osada_time_travel_caption); ?></span>
                                                        <?php endif; ?>
                                                    </figcaption>
                                                <?php endif; ?>
                                            </figure>
                                        <?php endforeach; ?>
                                    </div>
                                    <button class="building-carousel__button building-carousel__button--next" type="button" data-carousel-next aria-label="<?php echo esc_attr('en' === $osada_language ? 'Show next photographs' : 'Pokaż kolejne fotografie'); ?>">›</button>
                                </div>
                            </section>
                        <?php endif; ?>

                        <?php if (!empty($osada_architecture)) : ?>
                            <section id="architektura" class="building-section" aria-labelledby="building-architecture-title">
                                <h2 id="building-architecture-title"><?php echo esc_html('en' === $osada_language ? 'Architecture' : 'Architektura'); ?></h2>
                                <?php echo wp_kses_post($osada_architecture); ?>
                            </section>
                        <?php endif; ?>

                        <?php if (!empty($osada_take_a_closer_look)) : ?>
                            <aside id="spojrz-uwazniej" class="building-callout building-callout--closer-look" aria-labelledby="building-closer-look-title">
                                <?php $osada_closer_look_icon_url = $osada_get_icon_url('take-a-closer-look.png'); ?>
                                <h2 id="building-closer-look-title" class="building-callout__title">
                                    <?php if (!empty($osada_closer_look_icon_url)) : ?>
                                        <img class="building-callout__icon" src="<?php echo esc_url($osada_closer_look_icon_url); ?>" alt="">
                                    <?php endif; ?>
                                    <span><?php echo esc_html('en' === $osada_language ? 'Take a closer look...' : 'Spójrz uważniej'); ?></span>
                                </h2>
                                <?php echo wp_kses_post($osada_take_a_closer_look); ?>
                            </aside>
                        <?php endif; ?>

                        <?php if (!empty($osada_gallery)) : ?>
                            <section id="galeria" class="building-section building-gallery" aria-labelledby="building-gallery-title">
                                <h2 id="building-gallery-title"><?php echo esc_html('en' === $osada_language ? 'Gallery' : 'Galeria'); ?></h2>
                                <div class="building-carousel building-carousel--gallery" data-building-carousel>
                                    <button class="building-carousel__button building-carousel__button--previous" type="button" data-carousel-prev aria-label="<?php echo esc_attr('en' === $osada_language ? 'Show previous photographs' : 'Pokaż wcześniejsze fotografie'); ?>">‹</button>
                                    <div class="building-carousel__viewport" data-carousel-viewport>
                                        <?php foreach ($osada_gallery as $osada_gallery_image) : ?>
                                            <?php
                                            $osada_gallery_image_id = is_array($osada_gallery_image) && isset($osada_gallery_image['ID'])
                                                ? $osada_gallery_image['ID']
                                                : $osada_gallery_image;
                                            $osada_gallery_caption = $osada_gallery_image_id ? wp_get_attachment_caption($osada_gallery_image_id) : '';
                                            $osada_gallery_image_full = $osada_gallery_image_id ? wp_get_attachment_image_url($osada_gallery_image_id, 'full') : '';
                                            $osada_gallery_image_alt = $osada_gallery_image_id ? get_post_meta($osada_gallery_image_id, '_wp_attachment_image_alt', true) : '';

                                            if (empty($osada_gallery_image_id)) {
                                                continue;
                                            }
                                            ?>
                                            <figure class="building-carousel__card">
                                                <button class="building-carousel__image-trigger" type="button" data-lightbox-image data-lightbox-source="<?php echo esc_url($osada_gallery_image_full); ?>" data-lightbox-alt="<?php echo esc_attr($osada_gallery_image_alt); ?>">
                                                    <?php echo wp_get_attachment_image($osada_gallery_image_id, 'medium_large', false, array('class' => 'building-carousel__image')); ?>
                                                </button>
                                                <?php if (!empty($osada_gallery_caption)) : ?>
                                                    <figcaption class="building-carousel__caption">
                                                        <span><?php echo wp_kses_post($osada_gallery_caption); ?></span>
                                                    </figcaption>
                                                <?php endif; ?>
                                            </figure>
                                        <?php endforeach; ?>
                                    </div>
                                    <button class="building-carousel__button building-carousel__button--next" type="button" data-carousel-next aria-label="<?php echo esc_attr('en' === $osada_language ? 'Show next photographs' : 'Pokaż kolejne fotografie'); ?>">›</button>
                                </div>
                            </section>
                        <?php endif; ?>

                        <?php if (!empty($osada_nearby_buildings)) : ?>
                            <section id="w-poblizu" class="building-section building-nearby" aria-labelledby="building-nearby-title">
                                <h2 id="building-nearby-title"><?php echo esc_html('en' === $osada_language ? 'Nearby' : 'W pobliżu'); ?></h2>
                                <div class="building-nearby__list">
                                    <?php foreach ($osada_nearby_buildings as $osada_nearby_item) : ?>
                                        <?php
                                        $osada_nearby_building_id = isset($osada_nearby_item['building']) ? $osada_nearby_item['building'] : 0;
                                        $osada_nearby_building_id = is_object($osada_nearby_building_id) ? $osada_nearby_building_id->ID : $osada_nearby_building_id;
                                        $osada_nearby_distance = isset($osada_nearby_item['distance']) ? $osada_nearby_item['distance'] : '';
                                        $osada_nearby_walking_time = isset($osada_nearby_item['walking_time']) ? $osada_nearby_item['walking_time'] : '';
                                        $osada_nearby_marker_icon = $osada_nearby_building_id && function_exists('get_field') ? get_field('marker_icon', $osada_nearby_building_id) : '';
                                        $osada_nearby_marker_icon_url = is_array($osada_nearby_marker_icon) && isset($osada_nearby_marker_icon['url'])
                                            ? $osada_nearby_marker_icon['url']
                                            : (is_numeric($osada_nearby_marker_icon) ? wp_get_attachment_image_url($osada_nearby_marker_icon, 'thumbnail') : $osada_nearby_marker_icon);

                                        if (empty($osada_nearby_building_id)) {
                                            continue;
                                        }
                                        ?>
                                        <div class="building-nearby__item">
                                            <div class="building-nearby__building">
                                                <?php if (!empty($osada_nearby_marker_icon_url)) : ?>
                                                    <img class="building-nearby__icon" src="<?php echo esc_url($osada_nearby_marker_icon_url); ?>" alt="">
                                                <?php endif; ?>
                                                <a href="<?php echo esc_url(get_permalink($osada_nearby_building_id)); ?>"><?php echo esc_html(get_the_title($osada_nearby_building_id)); ?></a>
                                            </div>
                                            <span class="building-nearby__distance"><?php echo esc_html($osada_nearby_distance); ?></span>
                                            <span class="building-nearby__walking-time"><?php echo esc_html($osada_nearby_walking_time); ?></span>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </section>
                        <?php endif; ?>

                        <?php if (!empty($osada_sources)) : ?>
                            <section id="zrodla" class="building-section building-sources" aria-labelledby="building-sources-title">
                                <h2 id="building-sources-title"><?php echo esc_html('en' === $osada_language ? 'Sources' : 'Źródła'); ?></h2>
                                <ul class="building-sources__list">
                                    <?php foreach ($osada_sources as $osada_source) : ?>
                                        <?php
                                        $osada_source_text = isset($osada_source['source_text']) ? $osada_source['source_text'] : '';
                                        $osada_source_url = isset($osada_source['source_url']) ? $osada_source['source_url'] : '';

                                        if (empty($osada_source_text)) {
                                            continue;
                                        }
                                        ?>
                                        <li>
                                            <?php if (!empty($osada_source_url)) : ?>
                                                <a href="<?php echo esc_url($osada_source_url); ?>"><?php echo esc_html($osada_source_text); ?></a>
                                            <?php else : ?>
                                                <?php echo esc_html($osada_source_text); ?>
                                            <?php endif; ?>
                                        </li>
                                    <?php endforeach; ?>
                                </ul>
                            </section>
                        <?php endif; ?>

                        <?php if ('' !== trim(get_the_content())) : ?>
                            <div class="building-legacy-content">
                                <?php the_content(); ?>
                            </div>
                        <?php endif; ?>
                    </div>

                </div>

                <footer class="building-footer">
                    <a href="<?php echo esc_url($osada_back_url); ?>" class="back-to-map">← <?php echo esc_html($osada_back_label); ?></a>
                </footer>
            </article>
        </main>
    <?php endwhile; ?>
<?php endif; ?>

<?php
get_footer('budynek');
