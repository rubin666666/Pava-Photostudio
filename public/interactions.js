const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const revealTargets = Array.from(
  document.querySelectorAll('.main-page > section, .gallery-full, .footer-extended, .gallery .tile')
);

if (!prefersReducedMotion && revealTargets.length) {
  revealTargets.forEach((element) => element.classList.add('reveal-on-scroll'));

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  revealTargets.forEach((element) => revealObserver.observe(element));
}

const tiltTargets = Array.from(document.querySelectorAll('.tile, .price-item, .hall-item, .review-card, .cta-strip'));

if (!prefersReducedMotion) {
  tiltTargets.forEach((element) => {
    element.classList.add('interactive-tilt');

    element.addEventListener('mousemove', (event) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const rotateX = (0.5 - y) * 7;
      const rotateY = (x - 0.5) * 7;

      element.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
      element.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
    });

    element.addEventListener('mouseleave', () => {
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
    });
  });
}

const hero = document.querySelector('.hero');
if (hero && !prefersReducedMotion) {
  hero.addEventListener('mousemove', (event) => {
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    hero.style.setProperty('--hero-shift-x', `${(x - 0.5) * 24}px`);
    hero.style.setProperty('--hero-shift-y', `${(y - 0.5) * 18}px`);
  });

  hero.addEventListener('mouseleave', () => {
    hero.style.setProperty('--hero-shift-x', '0px');
    hero.style.setProperty('--hero-shift-y', '0px');
  });
}

const reviewsCarousel = document.querySelector('[data-reviews-carousel]');

if (reviewsCarousel) {
  const reviewsTrack = reviewsCarousel.querySelector('[data-reviews-track]');
  const prevButton = reviewsCarousel.querySelector('[data-reviews-prev]');
  const nextButton = reviewsCarousel.querySelector('[data-reviews-next]');
  const dotsHost = document.querySelector('[data-reviews-dots]');
  const slides = reviewsTrack ? Array.from(reviewsTrack.querySelectorAll('.review-card')) : [];

  if (reviewsTrack && slides.length > 1 && dotsHost) {
    let currentIndex = 0;
    let autoplayId = null;

    const dots = slides.map((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'reviews-dot';
      dot.setAttribute('aria-label', `Відгук ${index + 1}`);
      dot.addEventListener('click', () => {
        currentIndex = index;
        renderSlide();
        restartAutoplay();
      });
      dotsHost.appendChild(dot);
      return dot;
    });

    const renderSlide = () => {
      reviewsTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
      dots.forEach((dot, index) => {
        dot.classList.toggle('is-active', index === currentIndex);
      });
    };

    const nextSlide = () => {
      currentIndex = (currentIndex + 1) % slides.length;
      renderSlide();
    };

    const previousSlide = () => {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      renderSlide();
    };

    const stopAutoplay = () => {
      if (!autoplayId) return;
      clearInterval(autoplayId);
      autoplayId = null;
    };

    const startAutoplay = () => {
      if (prefersReducedMotion || autoplayId) return;
      autoplayId = window.setInterval(nextSlide, 4200);
    };

    const restartAutoplay = () => {
      stopAutoplay();
      startAutoplay();
    };

    if (prevButton) {
      prevButton.addEventListener('click', () => {
        previousSlide();
        restartAutoplay();
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        nextSlide();
        restartAutoplay();
      });
    }

    reviewsCarousel.addEventListener('mouseenter', stopAutoplay);
    reviewsCarousel.addEventListener('mouseleave', startAutoplay);
    reviewsCarousel.addEventListener('focusin', stopAutoplay);
    reviewsCarousel.addEventListener('focusout', startAutoplay);

    renderSlide();
    startAutoplay();
  }
}
