const form = document.getElementById('booking-form');
const statusEl = document.getElementById('form-status');
const bookingsList = document.getElementById('bookings-list');
const bookingModal = document.getElementById('booking-modal');
const closeBookingModalButton = document.getElementById('close-booking-modal');
const bookingOpeners = Array.from(document.querySelectorAll('[data-open-booking]'));
const BOOKING_HASH = '#booking';

function isAnyOverlayOpen() {
  const galleryLightboxOpen = document.querySelector('.gallery-lightbox.is-open');
  const bookingModalOpen = bookingModal && bookingModal.classList.contains('is-open');
  return Boolean(galleryLightboxOpen || bookingModalOpen);
}

function updateBodyScrollState() {
  if (isAnyOverlayOpen()) {
    document.body.classList.add('no-scroll');
    return;
  }

  document.body.classList.remove('no-scroll');
}

function closeBookingModal() {
  if (!bookingModal) return;

  bookingModal.classList.remove('is-open');
  bookingModal.setAttribute('aria-hidden', 'true');

  if (window.location.hash === BOOKING_HASH) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  updateBodyScrollState();
}

function openBookingModal() {
  if (!bookingModal) return;

  bookingModal.classList.add('is-open');
  bookingModal.setAttribute('aria-hidden', 'false');
  updateBodyScrollState();

  if (form) {
    const firstInput = form.querySelector('input, textarea, button');
    if (firstInput) firstInput.focus();
  }

  if (bookingsList) {
    loadBookings();
  }
}

function formatBooking(item) {
  return `${item.date} ${item.time} — ${item.name} (${item.phone})`;
}

async function loadBookings() {
  if (!bookingsList) return;

  try {
    const response = await fetch('/api/bookings?limit=15');
    if (!response.ok) throw new Error('Помилка завантаження');

    const bookings = await response.json();
    bookingsList.innerHTML = '';

    if (!bookings.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Поки що немає жодного запису.';
      bookingsList.appendChild(li);
      return;
    }

    bookings.forEach((booking) => {
      const li = document.createElement('li');
      li.textContent = formatBooking(booking);
      bookingsList.appendChild(li);
    });
  } catch (error) {
    bookingsList.innerHTML = '<li class="empty">Не вдалося завантажити записи.</li>';
  }
}

if (form && statusEl) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      name: formData.get('name')?.toString().trim(),
      phone: formData.get('phone')?.toString().trim(),
      date: formData.get('date')?.toString(),
      time: formData.get('time')?.toString(),
      notes: formData.get('notes')?.toString().trim(),
    };

    if (!payload.name || !payload.phone || !payload.date || !payload.time) {
      statusEl.textContent = 'Будь ласка, заповніть всі обовʼязкові поля.';
      return;
    }

    statusEl.textContent = 'Зберігаємо запис...';

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        statusEl.textContent = result.error || 'Не вдалося створити запис.';
        return;
      }

      statusEl.textContent = 'Запис створено успішно.';
      form.reset();
      loadBookings();
    } catch (error) {
      statusEl.textContent = 'Помилка мережі. Спробуйте ще раз.';
    }
  });

  loadBookings();
}

if (bookingModal) {
  bookingOpeners.forEach((opener) => {
    opener.addEventListener('click', (event) => {
      event.preventDefault();

      if (window.location.hash === BOOKING_HASH) {
        openBookingModal();
        return;
      }

      window.location.hash = BOOKING_HASH;
    });
  });

  if (closeBookingModalButton) {
    closeBookingModalButton.addEventListener('click', closeBookingModal);
  }

  bookingModal.addEventListener('click', (event) => {
    if (event.target === bookingModal) {
      closeBookingModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && bookingModal.classList.contains('is-open')) {
      closeBookingModal();
    }
  });

  const syncBookingModalWithHash = () => {
    if (window.location.hash === BOOKING_HASH) {
      openBookingModal();
      return;
    }

    if (bookingModal.classList.contains('is-open')) {
      closeBookingModal();
    }
  };

  window.addEventListener('hashchange', syncBookingModalWithHash);
  syncBookingModalWithHash();
}
