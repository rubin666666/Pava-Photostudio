/* ── Burger menu ───────────────────────────────────────────── */
(function () {
  const nav    = document.querySelector('.top-nav');
  const burger = document.querySelector('.nav-burger');
  const links  = document.querySelector('.nav-links');
  if (!nav || !burger || !links) return;

  function openMenu() {
    nav.classList.add('nav-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Закрити меню');
  }
  function closeMenu() {
    nav.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Відкрити меню');
  }

  burger.addEventListener('click', () => {
    nav.classList.contains('nav-open') ? closeMenu() : openMenu();
  });

  // Close on nav link click
  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('nav-open') && !nav.contains(e.target)) closeMenu();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
})();

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
  if (scrollBtn) {
    const onScroll = () => {
      scrollBtn.classList.toggle('hidden', window.scrollY > 80);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    scrollBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector('#about');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }
}

// =====================================================
// TYPED / ROTATING TEXT
// =====================================================
{
  const typedEl = document.getElementById('typed-word');
  const typedMobileEl = document.getElementById('typed-word-mobile');
  const typedElements = [typedEl, typedMobileEl].filter(Boolean);
  const setTypedText = (text) => {
    typedElements.forEach((element) => {
      element.textContent = text;
    });
  };

  if (typedElements.length) {
    setTypedText('свобода');
  }

  if (typedElements.length && !prefersReducedMotion) {
    const words = ['\u0441\u0432\u043e\u0431\u043e\u0434\u0430', '\u043c\u0430\u0433\u0456\u044f', '\u0435\u043c\u043e\u0446\u0456\u044f', '\u0456\u0441\u0442\u043e\u0440\u0456\u044f'];
    let wordIndex = 0;
    let charIndex = words[wordIndex].length;
    let isDeleting = false;

    const tick = () => {
      const current = words[wordIndex];
      let delay = isDeleting ? 55 : 95;

      if (!isDeleting && charIndex < current.length) {
        setTypedText(current.slice(0, charIndex + 1));
        charIndex++;
      } else if (!isDeleting) {
        delay = 1800;
        isDeleting = true;
      } else if (charIndex > 0) {
        setTypedText(current.slice(0, charIndex - 1));
        charIndex--;
      } else {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        delay = 320;
      }
      setTimeout(tick, delay);
    };

    setTimeout(tick, 1800);
  }
}
