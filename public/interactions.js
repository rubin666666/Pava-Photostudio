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
// Animated stat counters
{
  const statNums = Array.from(document.querySelectorAll('.stat-num[data-target]'));
  if (statNums.length) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.target, 10);
        const duration = 1400;
        const startTime = performance.now();
        const tick = (now) => {
          const progress = Math.min((now - startTime) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(ease * target);
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        counterObserver.unobserve(el);
      });
    }, { threshold: 0.5 });
    statNums.forEach(el => counterObserver.observe(el));
  }
}

// =====================================================
// PARALLAX HERO BACKGROUND
// =====================================================
{
  const heroEl = document.querySelector('.hero');
  if (heroEl && !prefersReducedMotion) {
    const onScroll = () => {
      const y = window.scrollY;
      heroEl.style.setProperty('--parallax-y', `${(y * 0.28).toFixed(1)}px`);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
}

// =====================================================
// STICKY BOOK BUTTON
// =====================================================
{
  const stickyBtn = document.getElementById('sticky-book');
  const heroEl = document.querySelector('.hero');
  if (stickyBtn && heroEl) {
    const obs = new IntersectionObserver(
      ([entry]) => stickyBtn.classList.toggle('visible', !entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(heroEl);
  }
}

// =====================================================
// HIDE HERO-SCROLL WHEN PAST HERO
// =====================================================
{
  const scrollBtn = document.querySelector('.hero-scroll');
  const heroEl = document.querySelector('.hero');
  if (scrollBtn && heroEl) {
    const obs = new IntersectionObserver(
      ([entry]) => scrollBtn.classList.toggle('hidden', !entry.isIntersecting),
      { threshold: 0.05 }
    );
    obs.observe(heroEl);
  }
}

// =====================================================
// CUSTOM CURSOR
// =====================================================
{
  const cursor = document.getElementById('custom-cursor');
  if (cursor && !prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
    let visible = false;

    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
      if (!visible) {
        cursor.style.opacity = '1';
        visible = true;
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      cursor.style.opacity = '0';
      visible = false;
    });

    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('a, button, [data-open-booking], [data-open-rules], .cta-btn, label, [role="button"]');
      cursor.classList.toggle('cursor-hover', !!el);
    });
  }
}

// =====================================================
// TYPED / ROTATING TEXT
// =====================================================
{
  const typedEl = document.getElementById('typed-word');
  if (typedEl && !prefersReducedMotion) {
    const words = ['\u0441\u0432\u043e\u0431\u043e\u0434\u0430', '\u043c\u0430\u0433\u0456\u044f', '\u0435\u043c\u043e\u0446\u0456\u044f', '\u0456\u0441\u0442\u043e\u0440\u0456\u044f'];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    const tick = () => {
      const current = words[wordIndex];
      if (isDeleting) {
        typedEl.textContent = current.slice(0, charIndex - 1);
        charIndex--;
      } else {
        typedEl.textContent = current.slice(0, charIndex + 1);
        charIndex++;
      }

      let delay = isDeleting ? 55 : 95;
      if (!isDeleting && charIndex === current.length) {
        delay = 1800;
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        delay = 320;
      }
      setTimeout(tick, delay);
    };

    setTimeout(tick, 900);
  }
}
