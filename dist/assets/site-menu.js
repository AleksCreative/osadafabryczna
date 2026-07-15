document.addEventListener('DOMContentLoaded', function () {
  const toggleBtn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const mobileQuery = window.matchMedia('(max-width: 767px)');

  if (!toggleBtn || !nav) return;

  function setMenuOpen(isOpen) {
    const isMobile = mobileQuery.matches;
    const shouldOpen = isMobile && isOpen;

    nav.classList.toggle('active', shouldOpen);
    toggleBtn.setAttribute('aria-expanded', String(shouldOpen));
    toggleBtn.setAttribute('aria-label', shouldOpen ? 'Zamknij menu' : 'Otwórz menu');
    nav.setAttribute('aria-hidden', String(isMobile && !shouldOpen));
  }

  toggleBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    setMenuOpen(!nav.classList.contains('active'));
  });

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      if (mobileQuery.matches) {
        setMenuOpen(false);
      }
    });
  });

  document.addEventListener('click', function (event) {
    if (mobileQuery.matches && !nav.contains(event.target) && !toggleBtn.contains(event.target)) {
      setMenuOpen(false);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (mobileQuery.matches && event.key === 'Escape') {
      setMenuOpen(false);
    }
  });

  mobileQuery.addEventListener('change', function () {
    setMenuOpen(false);
  });

  setMenuOpen(false);
});
