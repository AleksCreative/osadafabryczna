document.addEventListener('DOMContentLoaded', function () {
  const toggleBtn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');

  if (!toggleBtn || !nav) return;

  toggleBtn.addEventListener('click', function (e) {
    e.stopPropagation();

    nav.classList.toggle('active');

    const isOpen = nav.classList.contains('active');
    toggleBtn.setAttribute('aria-expanded', isOpen);
  });

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('active');
      toggleBtn.setAttribute('aria-expanded', false);
    });
  });

  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target) && !toggleBtn.contains(e.target)) {
      nav.classList.remove('active');
      toggleBtn.setAttribute('aria-expanded', false);
    }
  });
});
