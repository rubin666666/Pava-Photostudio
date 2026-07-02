const PACKAGES = Object.freeze({
  '30': { id: '30', label: '30 хв', durationMinutes: 30, priceUah: 959 },
  '60': { id: '60', label: '60 хв', durationMinutes: 60, priceUah: 1499 },
  '90': { id: '90', label: '90 хв', durationMinutes: 90, priceUah: 1999 },
  '120': { id: '120', label: '120 хв', durationMinutes: 120, priceUah: 2299 },
});

// Тимчасовий графік. Перед запуском його можна змінити без правок у формі.
const WORKING_HOURS = Object.freeze({
  1: { start: '10:00', end: '20:00' },
  2: { start: '10:00', end: '20:00' },
  3: { start: '10:00', end: '20:00' },
  4: { start: '10:00', end: '20:00' },
  5: { start: '10:00', end: '20:00' },
  6: { start: '10:00', end: '20:00' },
  7: { start: '10:00', end: '20:00' },
});

module.exports = {
  PACKAGES,
  WORKING_HOURS,
  SLOT_STEP_MINUTES: 30,
  RESERVATION_MINUTES: 15,
  TIME_ZONE: 'Europe/Kyiv',
};
