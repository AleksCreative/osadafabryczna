document.addEventListener('DOMContentLoaded', function () {
  const carousels = document.querySelectorAll('[data-building-carousel]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  carousels.forEach(function (carousel) {
    const viewport = carousel.querySelector('[data-carousel-viewport]');
    const previousButton = carousel.querySelector('[data-carousel-prev]');
    const nextButton = carousel.querySelector('[data-carousel-next]');

    if (!viewport || !previousButton || !nextButton) return;

    function updateButtons() {
      const maximumScroll = viewport.scrollWidth - viewport.clientWidth;
      const canScroll = maximumScroll > 1;

      previousButton.disabled = !canScroll || viewport.scrollLeft <= 1;
      nextButton.disabled = !canScroll || viewport.scrollLeft >= maximumScroll - 1;
    }

    function scrollCarousel(direction) {
      const firstCard = viewport.querySelector('.building-carousel__card');
      const gap = parseFloat(window.getComputedStyle(viewport).gap) || 0;
      const amount = firstCard ? firstCard.getBoundingClientRect().width + gap : viewport.clientWidth;

      viewport.scrollBy({
        left: direction * amount,
        behavior: prefersReducedMotion.matches ? 'auto' : 'smooth'
      });
    }

    previousButton.addEventListener('click', function () {
      scrollCarousel(-1);
    });

    nextButton.addEventListener('click', function () {
      scrollCarousel(1);
    });

    viewport.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    updateButtons();
  });

  const imageTriggers = document.querySelectorAll('[data-lightbox-image]');

  if (!imageTriggers.length) return;

  const lightbox = document.createElement('div');
  const previousButton = document.createElement('button');
  const nextButton = document.createElement('button');
  const closeButton = document.createElement('button');
  const image = document.createElement('img');
  let lastTrigger = null;
  let activeTriggers = [];
  let activeIndex = 0;
  const isEnglish = document.documentElement.lang.toLowerCase().startsWith('en');

  lightbox.className = 'building-lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', isEnglish ? 'Image preview' : 'Podgląd zdjęcia');

  previousButton.className = 'building-lightbox__navigation building-lightbox__navigation--previous';
  previousButton.type = 'button';
  previousButton.setAttribute('aria-label', isEnglish ? 'Show previous image' : 'Pokaż poprzednie zdjęcie');
  previousButton.textContent = '‹';

  nextButton.className = 'building-lightbox__navigation building-lightbox__navigation--next';
  nextButton.type = 'button';
  nextButton.setAttribute('aria-label', isEnglish ? 'Show next image' : 'Pokaż kolejne zdjęcie');
  nextButton.textContent = '›';

  closeButton.className = 'building-lightbox__close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', isEnglish ? 'Close image preview' : 'Zamknij podgląd zdjęcia');
  closeButton.textContent = '×';

  image.className = 'building-lightbox__image';
  lightbox.append(previousButton, image, nextButton, closeButton);
  document.body.append(lightbox);

  function showImage(index) {
    const trigger = activeTriggers[index];

    if (!trigger) return;

    activeIndex = index;
    image.src = trigger.dataset.lightboxSource;
    image.alt = trigger.dataset.lightboxAlt || '';
    previousButton.disabled = activeIndex === 0;
    nextButton.disabled = activeIndex === activeTriggers.length - 1;
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    image.removeAttribute('src');

    if (lastTrigger) lastTrigger.focus();
  }

  imageTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      const source = trigger.dataset.lightboxSource;

      if (!source) return;

      const carousel = trigger.closest('[data-building-carousel]');

      activeTriggers = carousel
        ? Array.from(carousel.querySelectorAll('[data-lightbox-image]'))
        : [trigger];
      lastTrigger = trigger;
      showImage(activeTriggers.indexOf(trigger));
      lightbox.classList.add('is-open');
      closeButton.focus();
    });
  });

  previousButton.addEventListener('click', function () {
    showImage(activeIndex - 1);
  });

  nextButton.addEventListener('click', function () {
    showImage(activeIndex + 1);
  });

  closeButton.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', function (event) {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && lightbox.classList.contains('is-open')) {
      closeLightbox();
    }

    if (event.key === 'ArrowLeft' && lightbox.classList.contains('is-open')) {
      showImage(activeIndex - 1);
    }

    if (event.key === 'ArrowRight' && lightbox.classList.contains('is-open')) {
      showImage(activeIndex + 1);
    }
  });
});
