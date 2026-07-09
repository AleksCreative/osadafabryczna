document.addEventListener('DOMContentLoaded', function () {
  const toggleBtn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');

  if (!toggleBtn || !nav) return;

  function setMenuOpen(isOpen) {
    nav.classList.toggle('active', isOpen);
    toggleBtn.setAttribute('aria-expanded', isOpen);
    toggleBtn.setAttribute('aria-label', isOpen ? 'Zamknij menu' : 'Otwórz menu');
    nav.setAttribute('aria-hidden', !isOpen);
  }

  toggleBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    setMenuOpen(!nav.classList.contains('active'));
  });

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      setMenuOpen(false);
    });
  });

  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target) && !toggleBtn.contains(e.target)) {
      setMenuOpen(false);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      setMenuOpen(false);
    }
  });
});
