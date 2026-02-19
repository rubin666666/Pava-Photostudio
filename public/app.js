const form = document.getElementById('booking-form');
const statusEl = document.getElementById('form-status');
const bookingsList = document.getElementById('bookings-list');

function formatBooking(item) {
  return `${item.date} ${item.time} — ${item.name} (${item.phone})`;
}

async function loadBookings() {
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
