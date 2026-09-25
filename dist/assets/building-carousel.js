document.addEventListener('DOMContentLoaded', function () {
  const carousels = document.querySelectorAll('[data-building-carousel]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isEnglish = document.body.classList.contains('site-language-en')
    || (!document.body.classList.contains('site-language-pl')
      && document.documentElement.lang.toLowerCase().startsWith('en'));

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

  function isDirectImageUrl(url) {
    try {
      return /\.(?:avif|gif|jpe?g|png|webp)$/i.test(new URL(url, window.location.href).pathname);
    } catch (error) {
      return false;
    }
  }

  function getLargestImageSource(image) {
    const candidates = (image.getAttribute('srcset') || '')
      .split(',')
      .map(function (candidate) {
        const parts = candidate.trim().split(/\s+/);
        const width = parts[1] && parts[1].endsWith('w') ? parseInt(parts[1], 10) : 0;

        return {
          source: parts[0] || '',
          width: Number.isFinite(width) ? width : 0
        };
      })
      .filter(function (candidate) {
        return candidate.source;
      })
      .sort(function (first, second) {
        return second.width - first.width;
      });

    const source = candidates[0]?.source || image.currentSrc || image.src;

    if (!/\bwp-image-\d+\b/.test(image.className)) {
      return source;
    }

    // WordPress stores editor thumbnails with a -WIDTHxHEIGHT suffix. Use the
    // original attachment in the lightbox when no explicit full-size link exists.
    return source.replace(
      /-\d+x\d+(?=\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$))/i,
      ''
    );
  }

  function prepareContentImageTriggers() {
    const contentImages = document.querySelectorAll([
      '.building-section img',
      '.building-callout img',
      '.building-legacy-content img'
    ].join(','));
    const openPreviewLabel = isEnglish ? 'Open image preview' : 'Otwórz podgląd zdjęcia';

    contentImages.forEach(function (contentImage) {
      if (contentImage.closest('[data-lightbox-image], [data-building-carousel], .building-fact__icon, .building-callout__title')) {
        return;
      }

      const imageLink = contentImage.closest('a');

      // Preserve links that lead somewhere other than directly to an image.
      if (imageLink && (
        !isDirectImageUrl(imageLink.href)
        || imageLink.querySelectorAll('img').length !== 1
        || imageLink.textContent.trim()
      )) {
        return;
      }

      const trigger = imageLink || contentImage;
      const source = imageLink ? imageLink.href : getLargestImageSource(contentImage);

      if (!source) return;

      trigger.classList.add('building-content-image__trigger');
      trigger.dataset.lightboxImage = '';
      trigger.dataset.lightboxSource = source;
      trigger.dataset.lightboxAlt = contentImage.alt || '';
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute(
        'aria-label',
        contentImage.alt ? `${openPreviewLabel}: ${contentImage.alt}` : openPreviewLabel
      );

      if (trigger === contentImage) {
        trigger.setAttribute('role', 'button');
        trigger.tabIndex = 0;
      }
    });
  }

  prepareContentImageTriggers();

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
    previousButton.hidden = activeTriggers.length <= 1;
    nextButton.hidden = activeTriggers.length <= 1;
    previousButton.disabled = activeIndex === 0;
    nextButton.disabled = activeIndex === activeTriggers.length - 1;
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    image.removeAttribute('src');

    if (lastTrigger) lastTrigger.focus();
  }

  imageTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      const source = trigger.dataset.lightboxSource;

      if (!source) return;

      event.preventDefault();

      const carousel = trigger.closest('[data-building-carousel]');
      const contentGroup = trigger.closest('.building-section, .building-callout, .building-legacy-content');

      activeTriggers = carousel
        ? Array.from(carousel.querySelectorAll('[data-lightbox-image]'))
        : (contentGroup
            ? Array.from(contentGroup.querySelectorAll('[data-lightbox-image]'))
            : [trigger]);
      lastTrigger = trigger;
      showImage(activeTriggers.indexOf(trigger));
      lightbox.classList.add('is-open');
      closeButton.focus();
    });

    if (trigger.matches('img[role="button"]')) {
      trigger.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        trigger.click();
      });
    }
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
