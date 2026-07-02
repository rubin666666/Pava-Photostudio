const form = document.getElementById('booking-form');
const statusEl = document.getElementById('form-status');
const packageSelect = document.getElementById('booking-package');
const dateInput = document.getElementById('booking-date');
const timeSelect = document.getElementById('booking-time');
const submitButton = document.getElementById('booking-submit');
const summaryTitle = document.getElementById('booking-summary-title');
const summaryPrice = document.getElementById('booking-summary-price');
const setupNote = document.getElementById('booking-setup-note');
const bookingModal = document.getElementById('booking-modal');
const closeBookingModalButton = document.getElementById('close-booking-modal');
const bookingOpeners = Array.from(document.querySelectorAll('[data-open-booking]'));
const BOOKING_HASH = '#booking';

const rulesModal = document.getElementById('rules-modal');
const closeRulesModalButton = document.getElementById('close-rules-modal');
const rulesOpeners = Array.from(document.querySelectorAll('[data-open-rules]'));
let packages = [];
let lastFocusedElement = null;

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function trapModalFocus(modal, event) {
  if (event.key !== 'Tab' || !modal?.classList.contains('is-open')) return;
  const focusable = Array.from(modal.querySelectorAll(focusableSelector)).filter((item) => item.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function isAnyOverlayOpen() {
  return Boolean(
    document.querySelector('.gallery-lightbox.is-open')
    || bookingModal?.classList.contains('is-open')
    || rulesModal?.classList.contains('is-open')
  );
}

function updateBodyScrollState() {
  document.body.classList.toggle('no-scroll', isAnyOverlayOpen());
}

function localIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function updatePackageSummary() {
  const selected = packages.find((item) => item.id === packageSelect?.value);
  if (!selected) {
    if (summaryTitle) summaryTitle.textContent = 'Оберіть тариф';
    if (summaryPrice) summaryPrice.textContent = '—';
    return;
  }
  if (summaryTitle) summaryTitle.textContent = selected.label;
  if (summaryPrice) summaryPrice.textContent = `${selected.priceUah.toLocaleString('uk-UA')} грн`;
}

async function loadBookingConfig() {
  if (!packageSelect) return;
  try {
    const response = await fetch('api/booking/config');
    if (!response.ok) throw new Error('config');
    const config = await response.json();
    packages = config.packages;
    packages.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.label} — ${item.priceUah.toLocaleString('uk-UA')} грн`;
      packageSelect.appendChild(option);
    });
    if (setupNote) setupNote.hidden = config.paymentConfigured;
  } catch (_) {
    statusEl.textContent = 'Не вдалося завантажити тарифи. Оновіть сторінку.';
  }
}

async function loadAvailability() {
  if (!timeSelect || !packageSelect?.value || !dateInput?.value) {
    timeSelect.disabled = true;
    timeSelect.innerHTML = '<option value="">Спочатку оберіть тариф і дату</option>';
    return;
  }
  timeSelect.disabled = true;
  timeSelect.innerHTML = '<option value="">Завантажуємо вільні години…</option>';
  try {
    const query = new URLSearchParams({ date: dateInput.value, package: packageSelect.value });
    const response = await fetch(`api/booking/availability?${query}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    timeSelect.innerHTML = '<option value="">Оберіть час</option>';
    result.slots.forEach((slot) => {
      const option = document.createElement('option');
      option.value = slot;
      option.textContent = slot;
      timeSelect.appendChild(option);
    });
    if (!result.slots.length) timeSelect.innerHTML = '<option value="">На цю дату вільних слотів немає</option>';
    timeSelect.disabled = !result.slots.length;
  } catch (error) {
    timeSelect.innerHTML = '<option value="">Не вдалося завантажити години</option>';
    statusEl.textContent = error.message || 'Помилка завантаження вільних годин.';
  }
}

function submitToLiqPay(payment) {
  const paymentForm = document.createElement('form');
  paymentForm.method = 'POST';
  paymentForm.action = payment.url;
  paymentForm.innerHTML = `
    <input type="hidden" name="data" value="${payment.data}">
    <input type="hidden" name="signature" value="${payment.signature}">
  `;
  document.body.appendChild(paymentForm);
  paymentForm.submit();
}

if (dateInput) dateInput.min = localIsoDate();
packageSelect?.addEventListener('change', () => {
  updatePackageSummary();
  loadAvailability();
});
dateInput?.addEventListener('change', loadAvailability);

if (form && statusEl) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    statusEl.textContent = 'Резервуємо слот…';
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch('api/booking/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не вдалося створити бронювання.');
      if (result.payment.mode === 'liqpay') {
        statusEl.textContent = 'Переходимо до безпечної оплати…';
        submitToLiqPay(result.payment);
        return;
      }
      statusEl.textContent = 'Каркас працює: слот зарезервовано. Для реальної оплати залишилось додати ключі LiqPay.';
      await loadAvailability();
    } catch (error) {
      statusEl.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
  loadBookingConfig();
}

function closeBookingModal() {
  if (!bookingModal) return;
  bookingModal.classList.remove('is-open');
  bookingModal.setAttribute('aria-hidden', 'true');
  bookingModal.setAttribute('inert', '');
  if (window.location.hash === BOOKING_HASH) history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  updateBodyScrollState();
  lastFocusedElement?.focus();
}

function openBookingModal() {
  if (!bookingModal) return;
  lastFocusedElement = document.activeElement;
  bookingModal.classList.add('is-open');
  bookingModal.setAttribute('aria-hidden', 'false');
  bookingModal.removeAttribute('inert');
  updateBodyScrollState();
  form?.querySelector('select, input, textarea, button')?.focus();
}

if (bookingModal) {
  bookingOpeners.forEach((opener) => opener.addEventListener('click', (event) => {
    event.preventDefault();
    if (window.location.hash === BOOKING_HASH) openBookingModal();
    else window.location.hash = BOOKING_HASH;
  }));
  closeBookingModalButton?.addEventListener('click', closeBookingModal);
  bookingModal.addEventListener('click', (event) => {
    if (event.target === bookingModal) closeBookingModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && bookingModal.classList.contains('is-open')) closeBookingModal();
    trapModalFocus(bookingModal, event);
  });
  const syncBookingModalWithHash = () => {
    if (window.location.hash === BOOKING_HASH) openBookingModal();
    else if (bookingModal.classList.contains('is-open')) closeBookingModal();
  };
  window.addEventListener('hashchange', syncBookingModalWithHash);
  syncBookingModalWithHash();
}

if (rulesModal) {
  const openRulesModal = () => {
    lastFocusedElement = document.activeElement;
    rulesModal.classList.add('is-open');
    rulesModal.setAttribute('aria-hidden', 'false');
    rulesModal.removeAttribute('inert');
    updateBodyScrollState();
    rulesModal.querySelector('button')?.focus();
  };
  const closeRulesModal = () => {
    rulesModal.classList.remove('is-open');
    rulesModal.setAttribute('aria-hidden', 'true');
    rulesModal.setAttribute('inert', '');
    updateBodyScrollState();
    lastFocusedElement?.focus();
  };
  rulesOpeners.forEach((opener) => opener.addEventListener('click', (event) => {
    event.preventDefault();
    openRulesModal();
  }));
  closeRulesModalButton?.addEventListener('click', closeRulesModal);
  rulesModal.addEventListener('click', (event) => {
    if (event.target === rulesModal) closeRulesModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && rulesModal.classList.contains('is-open')) closeRulesModal();
    trapModalFocus(rulesModal, event);
  });
}
