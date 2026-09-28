<?php
/** Illustration/photo comparison, shown only for a complete pair of images. */
if (!defined('ABSPATH')) {
    exit;
}

$comparison_photo_id = absint($args['photo_id'] ?? 0);
if (!$comparison_photo_id || !wp_attachment_is_image($comparison_photo_id)) {
    return;
}

$comparison_english = 'en' === ($args['language'] ?? 'pl');
$comparison_labels = $comparison_english
    ? array(
        'open' => 'Compare with photo',
        'title' => 'Illustration and photo',
        'illustration' => 'Illustration',
        'photo' => 'Photo',
        'today' => 'Photo',
        'choose' => 'Choose an image',
        'close' => 'Close comparison',
    )
    : array(
        'open' => 'Porównaj ze zdjęciem',
        'title' => 'Ilustracja i zdjęcie',
        'illustration' => 'Ilustracja',
        'photo' => 'Zdjęcie',
        'today' => 'Zdjęcie',
        'choose' => 'Wybierz obraz',
        'close' => 'Zamknij porównanie',
    );

$comparison_title = wp_strip_all_tags($args['building_title'] ?? '');
$comparison_illustration_alt = ($args['illustration_alt'] ?? '') ?: $comparison_labels['illustration'] . ': ' . $comparison_title;
$comparison_photo_alt = get_post_meta($comparison_photo_id, '_wp_attachment_image_alt', true)
    ?: $comparison_labels['today'] . ': ' . $comparison_title;
$comparison_image_attributes = array(
    'loading' => 'eager',
    'decoding' => 'async',
    'fetchpriority' => 'auto',
    'sizes' => '(max-width: 767px) 90vw, 45vw',
);
$comparison_illustration = !empty($args['illustration_id'])
    ? wp_get_attachment_image(absint($args['illustration_id']), 'full', false, array_merge(
        $comparison_image_attributes,
        array('alt' => $comparison_illustration_alt)
    ))
    : '';

if (!$comparison_illustration && !empty($args['illustration_url'])) {
    $comparison_illustration = sprintf(
        '<img src="%s" alt="%s" decoding="async">',
        esc_url($args['illustration_url']),
        esc_attr($comparison_illustration_alt)
    );
}

$comparison_photo = wp_get_attachment_image($comparison_photo_id, 'full', false, array_merge(
    $comparison_image_attributes,
    array('alt' => $comparison_photo_alt)
));
if (!$comparison_illustration || !$comparison_photo) {
    return;
}
?>
<div data-building-comparison>
    <button class="building-comparison-trigger" type="button" data-comparison-open aria-haspopup="dialog" aria-controls="building-comparison-dialog" hidden>
        <?php echo esc_html($comparison_labels['open']); ?>
    </button>
    <dialog id="building-comparison-dialog" class="building-comparison" aria-label="<?php echo esc_attr($comparison_labels['title']); ?>">
        <div class="building-comparison__header">
            <button class="building-comparison__close" type="button" data-comparison-close aria-label="<?php echo esc_attr($comparison_labels['close']); ?>">×</button>
        </div>
        <div class="building-comparison__switch" data-comparison-switch role="group" aria-label="<?php echo esc_attr($comparison_labels['choose']); ?>" hidden>
            <button type="button" data-comparison-select="illustration" aria-pressed="true" aria-controls="building-comparison-illustration"><?php echo esc_html($comparison_labels['illustration']); ?></button>
            <button type="button" data-comparison-select="photo" aria-pressed="false" aria-controls="building-comparison-photo"><?php echo esc_html($comparison_labels['photo']); ?></button>
        </div>
        <div class="building-comparison__panels" data-comparison-panels></div>
        <template data-comparison-template>
            <figure id="building-comparison-illustration" class="building-comparison__figure" data-comparison-view="illustration">
                <figcaption><?php echo esc_html($comparison_labels['illustration']); ?></figcaption>
                <div class="building-comparison__frame">
                    <?php echo $comparison_illustration; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- WordPress image markup or escaped fallback. ?>
                </div>
            </figure>
            <figure id="building-comparison-photo" class="building-comparison__figure" data-comparison-view="photo">
                <figcaption><?php echo esc_html($comparison_labels['today']); ?></figcaption>
                <div class="building-comparison__frame">
                    <?php echo $comparison_photo; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- WordPress image markup. ?>
                </div>
            </figure>
        </template>
    </dialog>
</div>
