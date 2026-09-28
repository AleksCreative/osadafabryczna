document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-building-comparison]').forEach(function (comparison) {
    const dialog = comparison.querySelector('dialog');
    const trigger = comparison.querySelector('[data-comparison-open]');
    const closeButton = comparison.querySelector('[data-comparison-close]');
    const switcher = comparison.querySelector('[data-comparison-switch]');
    const buttons = Array.from(comparison.querySelectorAll('[data-comparison-select]'));
    const panels = comparison.querySelector('[data-comparison-panels]');
    const template = comparison.querySelector('[data-comparison-template]');
    const mobile = window.matchMedia('(max-width: 767px)');
    let activeView = 'illustration';
    let loaded = false;
    let pointerStartedOutside = false;

    if (!dialog || typeof dialog.showModal !== 'function'
      || !trigger || !closeButton || !switcher || !panels || !template) return;

    function updateView() {
      if (!mobile.matches && switcher.contains(document.activeElement)) closeButton.focus();
      switcher.hidden = !mobile.matches;
      buttons.forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.comparisonSelect === activeView));
      });
      panels.querySelectorAll('[data-comparison-view]').forEach(function (panel) {
        panel.hidden = mobile.matches && panel.dataset.comparisonView !== activeView;
      });
    }

    function isOutside(event) {
      const bounds = dialog.getBoundingClientRect();
      return event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom;
    }

    trigger.addEventListener('click', function () {
      if (!loaded) {
        // Images in the template are fetched only when the comparison is opened.
        panels.append(template.content.cloneNode(true));
        loaded = true;
      }
      activeView = 'illustration';
      updateView();
      dialog.showModal();
      document.documentElement.classList.add('has-building-comparison');
      closeButton.focus();
    });

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        activeView = button.dataset.comparisonSelect;
        updateView();
      });
    });

    closeButton.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('pointerdown', function (event) {
      pointerStartedOutside = event.target === dialog && isOutside(event);
    });
    dialog.addEventListener('click', function (event) {
      if (pointerStartedOutside && event.target === dialog && isOutside(event)) dialog.close();
      pointerStartedOutside = false;
    });
    // Native dialog also handles Escape, focus trapping and an inert background.
    dialog.addEventListener('close', function () {
      document.documentElement.classList.remove('has-building-comparison');
      trigger.focus({ preventScroll: true });
    });
    mobile.addEventListener('change', updateView);
    trigger.hidden = false;
  });
});
