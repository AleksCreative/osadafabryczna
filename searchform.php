<?php
$osada_search_language = function_exists('osadafabryczna_get_current_language') ? osadafabryczna_get_current_language() : 'pl';
$osada_search_placeholder = 'en' === $osada_search_language ? 'Search the website' : 'Szukaj na stronie';
$osada_search_submit = 'en' === $osada_search_language ? 'Search' : 'Szukaj';
?>
<form role="search" method="get" class="search-form" action="<?php echo esc_url(home_url('/')); ?>">
    <label class="screen-reader-text" for="site-search-field"><?php echo esc_html($osada_search_placeholder); ?></label>
    <input
        id="site-search-field"
        class="search-form__field"
        type="search"
        name="s"
        value=""
        placeholder="<?php echo esc_attr($osada_search_placeholder); ?>"
    >
    <button class="search-form__submit" type="submit"><?php echo esc_html($osada_search_submit); ?></button>
</form>
