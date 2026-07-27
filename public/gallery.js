const loadMoreButton = document.getElementById('load-more-gallery');
const collapseButton = document.getElementById('collapse-gallery');
const hiddenTiles = Array.from(document.querySelectorAll('#studio-gallery .tile-hidden'));
const galleryTiles = Array.from(document.querySelectorAll('#studio-gallery .tile'));

const lightbox = document.createElement('div');
lightbox.className = 'gallery-lightbox';
lightbox.setAttribute('aria-hidden', 'true');
lightbox.innerHTML = `
  <div class="gallery-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Перегляд фото">
    <button class="gallery-lightbox-close" type="button" aria-label="Закрити">×</button>
    <button class="gallery-lightbox-prev" type="button" aria-label="Попереднє фото">&#8249;</button>
    <button class="gallery-lightbox-next" type="button" aria-label="Наступне фото">&#8250;</button>
    <div class="gallery-lightbox-preview" id="gallery-lightbox-preview">
      <img class="gallery-lightbox-image" id="gallery-lightbox-image" alt="" />
    </div>
  </div>
`;
document.body.appendChild(lightbox);

const lightboxPreview = document.getElementById('gallery-lightbox-preview');
const lightboxImage = document.getElementById('gallery-lightbox-image');
const lightboxClose = lightbox.querySelector('.gallery-lightbox-close');
const lightboxPrev = lightbox.querySelector('.gallery-lightbox-prev');
const lightboxNext = lightbox.querySelector('.gallery-lightbox-next');

let currentIndex = 0;
let lastFocusedTile = null;
let lightboxTransitionTimer = null;

const getVisibleTiles = () => Array.from(document.querySelectorAll('#studio-gallery .tile:not(.tile-hidden)'));

const closeLightbox = () => {
  lightbox.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
  lightbox.setAttribute('aria-hidden', 'true');
  lastFocusedTile?.focus();
};

const renderLightboxTile = (tile) => {
  const tileVariantClass = Array.from(tile.classList).find((className) => /^tile-\d+$/.test(className));
  const isPhotoTile = tile.classList.contains('photo-tile');
  const tileImageElement = tile.querySelector('img');
  const tileImageUrl = tileImageElement?.currentSrc || tileImageElement?.getAttribute('src') || '';
  lightboxPreview.className = 'gallery-lightbox-preview';
  lightboxPreview.style.backgroundImage = 'none';

  if (tileVariantClass && !isPhotoTile) {
    lightboxPreview.classList.add(tileVariantClass);
  }

  if (isPhotoTile && tileImageUrl && lightboxImage) {
    lightboxImage.src = tileImageUrl;
    lightboxImage.alt = tile.querySelector('span')?.textContent?.trim() || 'Фото галереї';
    lightboxImage.style.display = 'block';
  } else if (lightboxImage) {
    lightboxImage.removeAttribute('src');
    lightboxImage.alt = '';
    lightboxImage.style.display = 'none';
  }

  lightboxPreview.style.backgroundImage = tileImageUrl
    ? `url("${tileImageUrl}")`
    : window.getComputedStyle(tile).backgroundImage;

  if (isPhotoTile) {
    lightboxPreview.style.backgroundImage = 'none';
  }
};

const openLightbox = (tile) => {
  lastFocusedTile = tile;
  currentIndex = getVisibleTiles().indexOf(tile);
  renderLightboxTile(tile);

  lightbox.classList.add('is-open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  lightboxClose.focus();
};

const navigateLightbox = (dir) => {
  const tiles = getVisibleTiles();
  currentIndex = (currentIndex + dir + tiles.length) % tiles.length;
  const nextTile = tiles[currentIndex];

  window.clearTimeout(lightboxTransitionTimer);
  lightboxPreview.classList.add('is-switching');

  lightboxTransitionTimer = window.setTimeout(() => {
    renderLightboxTile(nextTile);
    lightboxPreview.classList.add('is-switching');

    window.requestAnimationFrame(() => {
      lightboxPreview.classList.remove('is-switching');
    });
  }, 140);
};

lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(-1); });
lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(1); });

// Touch swipe
let touchStartX = 0;
lightbox.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
lightbox.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) navigateLightbox(dx < 0 ? 1 : -1);
});

if (loadMoreButton && collapseButton) {
  if (!hiddenTiles.length) {
    loadMoreButton.style.display = 'none';
    collapseButton.style.display = 'none';
  }

  loadMoreButton.addEventListener('click', () => {
    hiddenTiles.forEach((tile) => tile.classList.remove('tile-hidden'));
    loadMoreButton.style.display = 'none';
    collapseButton.style.display = 'inline-flex';
  });

  collapseButton.addEventListener('click', () => {
    hiddenTiles.forEach((tile) => tile.classList.add('tile-hidden'));
    collapseButton.style.display = 'none';
    loadMoreButton.style.display = 'inline-flex';
  });
}

galleryTiles.forEach((tile) => {
  tile.setAttribute('role', 'button');
  tile.setAttribute('tabindex', '0');
  tile.setAttribute('aria-label', tile.querySelector('img')?.alt || 'Відкрити фото галереї');

  tile.addEventListener('click', () => openLightbox(tile));
  tile.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openLightbox(tile);
    }
  });
});

lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

if (lightboxClose) {
  lightboxClose.addEventListener('click', closeLightbox);
}

document.addEventListener('keydown', (event) => {
  if (!lightbox.classList.contains('is-open')) return;
  if (event.key === 'Escape') closeLightbox();
  if (event.key === 'ArrowLeft') navigateLightbox(-1);
  if (event.key === 'ArrowRight') navigateLightbox(1);
});
