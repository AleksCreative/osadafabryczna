document.addEventListener('DOMContentLoaded', function () {
  const toggleBtn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const searchToggle = document.querySelector('.search-toggle');
  const searchPanel = document.querySelector('.site-search');
  const searchInput = document.querySelector('.search-form__field');
  const mobileQuery = window.matchMedia('(max-width: 767px)');

  if (!toggleBtn || !nav) return;

  const submenuItems = Array.from(nav.querySelectorAll('.menu-item-has-children'));
  const isEnglish = document.documentElement.lang.toLowerCase().startsWith('en');
  const expandLabel = isEnglish ? 'Expand submenu' : 'Rozwiń podmenu';
  const collapseLabel = isEnglish ? 'Collapse submenu' : 'Zwiń podmenu';

  function closeAllSubmenus(exceptItem = null) {
    submenuItems.forEach(function (item) {
      if (item === exceptItem) return;

      item.classList.remove('is-submenu-open');
      const button = item.querySelector('.submenu-toggle');

      if (button) {
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', `${expandLabel}: ${button.dataset.submenuLabel}`);
      }
    });
  }

  function setMenuOpen(isOpen) {
    const isMobile = mobileQuery.matches;
    const shouldOpen = isMobile && isOpen;

    nav.classList.toggle('active', shouldOpen);
    toggleBtn.setAttribute('aria-expanded', String(shouldOpen));
    toggleBtn.setAttribute('aria-label', shouldOpen ? 'Zamknij menu' : 'Otwórz menu');
    nav.setAttribute('aria-hidden', String(isMobile && !shouldOpen));

    if (!shouldOpen) {
      closeAllSubmenus();
    }
  }

  function setSearchOpen(isOpen) {
    if (!searchToggle || !searchPanel) return;

    searchPanel.classList.toggle('is-open', isOpen);
    searchToggle.setAttribute('aria-expanded', String(isOpen));
    searchPanel.setAttribute('aria-hidden', String(!isOpen));

    if (isOpen) {
      setMenuOpen(false);

      if (searchInput) {
        searchInput.focus();
      }
    }
  }

  submenuItems.forEach(function (item, index) {
    const submenu = item.querySelector(':scope > .sub-menu');
    const link = item.querySelector(':scope > a');

    if (!submenu || !link) return;

    const button = document.createElement('button');
    const submenuId = submenu.id || `submenu-${index + 1}`;
    const label = link.textContent.trim();

    submenu.id = submenuId;
    button.type = 'button';
    button.className = 'submenu-toggle';
    button.dataset.submenuLabel = label;
    button.setAttribute('aria-controls', submenuId);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `${expandLabel}: ${label}`);
    item.insertBefore(button, submenu);

    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      const isOpen = item.classList.toggle('is-submenu-open');
      button.setAttribute('aria-expanded', String(isOpen));
      button.setAttribute('aria-label', `${isOpen ? collapseLabel : expandLabel}: ${label}`);

      if (isOpen) {
        closeAllSubmenus(item);
      }
    });
  });

  toggleBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    setSearchOpen(false);
    setMenuOpen(!nav.classList.contains('active'));
  });

  if (searchToggle && searchPanel) {
    searchToggle.addEventListener('click', function (event) {
      event.stopPropagation();
      setSearchOpen(!searchPanel.classList.contains('is-open'));
    });
  }

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      if (mobileQuery.matches) {
        setMenuOpen(false);
      }
    });
  });

  document.addEventListener('click', function (event) {
    if (!nav.contains(event.target) && !toggleBtn.contains(event.target)) {
      closeAllSubmenus();

      if (mobileQuery.matches) {
        setMenuOpen(false);
      }
    }

    if (searchToggle && searchPanel && !searchPanel.contains(event.target) && !searchToggle.contains(event.target)) {
      setSearchOpen(false);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    closeAllSubmenus();

    if (mobileQuery.matches) {
      setMenuOpen(false);
      toggleBtn.focus();
    }

    if (searchPanel && searchPanel.classList.contains('is-open')) {
      setSearchOpen(false);
      searchToggle.focus();
    }
  });

  mobileQuery.addEventListener('change', function () {
    setMenuOpen(false);
    setSearchOpen(false);
  });

  setMenuOpen(false);
  setSearchOpen(false);
});
