const loadMoreButton = document.getElementById('load-more-gallery');
const collapseButton = document.getElementById('collapse-gallery');
const hiddenTiles = Array.from(document.querySelectorAll('#studio-gallery .tile-hidden'));
const galleryTiles = Array.from(document.querySelectorAll('#studio-gallery .tile'));

const lightbox = document.createElement('div');
lightbox.className = 'gallery-lightbox';
lightbox.innerHTML = `
  <div class="gallery-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Перегляд фото">
    <button class="gallery-lightbox-close" type="button" aria-label="Закрити">×</button>
    <div class="gallery-lightbox-preview" id="gallery-lightbox-preview">
      <img class="gallery-lightbox-image" id="gallery-lightbox-image" alt="" />
    </div>
  </div>
`;
document.body.appendChild(lightbox);

const lightboxPreview = document.getElementById('gallery-lightbox-preview');
const lightboxImage = document.getElementById('gallery-lightbox-image');
const lightboxClose = lightbox.querySelector('.gallery-lightbox-close');

const closeLightbox = () => {
  lightbox.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
};

const openLightbox = (tile) => {
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

  lightbox.classList.add('is-open');
  document.body.classList.add('no-scroll');
};

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
  if (event.key === 'Escape' && lightbox.classList.contains('is-open')) {
    closeLightbox();
  }
});
