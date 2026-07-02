const tokenInput = document.getElementById('admin-token');
const connectButton = document.getElementById('admin-connect');
const statusElement = document.getElementById('admin-status');
const content = document.getElementById('admin-content');
const login = document.getElementById('admin-login');
const fromInput = document.getElementById('admin-from');
const bookingsBody = document.getElementById('admin-bookings');
const countElement = document.getElementById('admin-count');
const blocksHost = document.getElementById('admin-blocks');
const blockForm = document.getElementById('block-form');
let adminToken = sessionStorage.getItem('pavaAdminToken') || '';

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
fromInput.value = today();
blockForm.elements.date.min = today();

async function adminFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}`, ...(options.headers || {}) },
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Помилка запиту.');
  return result;
}

function escapeText(value) {
  const span = document.createElement('span');
  span.textContent = value ?? '';
  return span.innerHTML;
}

function renderBookings(items) {
  countElement.textContent = `${items.length} записів`;
  bookingsBody.innerHTML = items.length ? items.map((item) => `
    <tr>
      <td><strong>${escapeText(item.booking_date)} · ${escapeText(item.start_time)}</strong><small>${item.duration_minutes} хв</small></td>
      <td>${escapeText(item.name)}<small>${escapeText(item.phone)}${item.email ? ` · ${escapeText(item.email)}` : ''}</small><small>${escapeText(item.notes)}</small></td>
      <td>${escapeText(item.package_id)} хв<small>${Number(item.price_uah).toLocaleString('uk-UA')} грн</small></td>
      <td><span class="admin-status-badge">${escapeText(item.status)}</span></td>
      <td><div class="admin-actions">${item.status !== 'cancelled' ? `<button class="admin-action" data-status="cancelled" data-id="${item.public_id}">Скасувати</button>` : ''}</div></td>
    </tr>`).join('') : '<tr><td colspan="5">Записів немає.</td></tr>';
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function renderBlocks(items) {
  blocksHost.innerHTML = items.map((item) => `<div class="admin-block"><strong>${escapeText(item.booking_date)} · ${minutesToTime(item.start_minutes)}–${minutesToTime(item.end_minutes)}</strong><span>${escapeText(item.reason)}</span><button class="admin-action" data-block-id="${item.id}">Видалити</button></div>`).join('') || '<p class="section-text">Заблокованих інтервалів немає.</p>';
}

async function loadAdmin() {
  try {
    const [bookings, blocks] = await Promise.all([
      adminFetch(`api/admin/bookings?from=${encodeURIComponent(fromInput.value)}`),
      adminFetch('api/admin/blocks'),
    ]);
    renderBookings(bookings);
    renderBlocks(blocks);
    login.hidden = true;
    content.hidden = false;
  } catch (error) {
    statusElement.textContent = error.message;
    login.hidden = false;
    content.hidden = true;
  }
}

connectButton.addEventListener('click', () => {
  adminToken = tokenInput.value.trim();
  sessionStorage.setItem('pavaAdminToken', adminToken);
  loadAdmin();
});
document.getElementById('admin-refresh').addEventListener('click', loadAdmin);
document.getElementById('admin-logout').addEventListener('click', () => { sessionStorage.removeItem('pavaAdminToken'); location.reload(); });

bookingsBody.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-status]');
  if (!button) return;
  await adminFetch(`api/admin/bookings/${button.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.status }) });
  loadAdmin();
});

blockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await adminFetch('api/admin/blocks', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(blockForm))) });
  blockForm.reset();
  loadAdmin();
});

blocksHost.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-block-id]');
  if (!button) return;
  await adminFetch(`api/admin/blocks/${button.dataset.blockId}`, { method: 'DELETE' });
  loadAdmin();
});

if (adminToken) loadAdmin();
