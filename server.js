const crypto = require('crypto');
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const {
  PACKAGES,
  WORKING_HOURS,
  SLOT_STEP_MINUTES,
  RESERVATION_MINUTES,
  TIME_ZONE,
} = require('./config/booking');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
const LIQPAY_PUBLIC_KEY = process.env.LIQPAY_PUBLIC_KEY || '';
const LIQPAY_PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const PAYMENT_CONFIGURED = Boolean(PUBLIC_URL && LIQPAY_PUBLIC_KEY && LIQPAY_PRIVATE_KEY);

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.DB_PATH || path.join(dataDir, 'bookings.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run(`
    CREATE TABLE IF NOT EXISTS booking_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      package_id TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price_uah INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      booking_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      start_minutes INTEGER NOT NULL,
      end_minutes INTEGER NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      payment_id TEXT,
      expires_at TEXT NOT NULL,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_booking_slot ON booking_orders (booking_date, start_minutes, end_minutes, status)');
  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_date TEXT NOT NULL,
      start_minutes INTEGER NOT NULL,
      end_minutes INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
});

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "frame-src https://maps.google.com",
      "connect-src 'self'",
      "form-action 'self' https://www.liqpay.ua",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  });
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
});
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function callback(error) {
    if (error) reject(error);
    else resolve({ changes: this.changes, lastID: this.lastID });
  });
});

function minutesFromTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function timeFromMinutes(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function currentKyivDate() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dayOfWeek(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function isDateWithinBookingWindow(value) {
  if (!isValidDate(value) || value < currentKyivDate()) return false;
  const max = new Date();
  max.setUTCDate(max.getUTCDate() + 365);
  return value <= max.toISOString().slice(0, 10);
}

function safeTokenEqual(received, expected) {
  const left = Buffer.from(String(received || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ error: 'Адмін-доступ ще не налаштовано.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!safeTokenEqual(token, ADMIN_TOKEN)) return res.status(401).json({ error: 'Невірний ключ доступу.' });
  return next();
}

async function getReservedRanges(date) {
  const orders = await dbAll(
    `SELECT start_minutes, end_minutes
     FROM booking_orders
     WHERE booking_date = ?
       AND (status = 'paid' OR (status = 'pending_payment' AND expires_at > datetime('now')))`,
    [date]
  );
  const blocks = await dbAll(
    'SELECT start_minutes, end_minutes FROM blocked_slots WHERE booking_date = ?',
    [date]
  );
  return [...orders, ...blocks];
}

async function expireReservations() {
  await dbRun(
    `UPDATE booking_orders SET status = 'expired'
     WHERE status = 'pending_payment' AND expires_at <= datetime('now')`
  );
}

async function getAvailableSlots(date, durationMinutes) {
  const hours = WORKING_HOURS[dayOfWeek(date)];
  if (!hours) return [];
  const opening = minutesFromTime(hours.start);
  const closing = minutesFromTime(hours.end);
  const reserved = await getReservedRanges(date);
  const slots = [];

  for (let start = opening; start + durationMinutes <= closing; start += SLOT_STEP_MINUTES) {
    const end = start + durationMinutes;
    const overlaps = reserved.some((range) => start < range.end_minutes && end > range.start_minutes);
    if (!overlaps) slots.push(timeFromMinutes(start));
  }
  return slots;
}

function liqPaySignature(data) {
  return crypto
    .createHash('sha1')
    .update(`${LIQPAY_PRIVATE_KEY}${data}${LIQPAY_PRIVATE_KEY}`)
    .digest('base64');
}

function createLiqPayCheckout(order) {
  const payload = {
    version: 3,
    public_key: LIQPAY_PUBLIC_KEY,
    action: 'pay',
    amount: order.priceUah,
    currency: 'UAH',
    description: `Бронювання Pava Photostudio: ${order.date} ${order.time}, ${order.packageLabel}`,
    order_id: order.publicId,
    language: 'uk',
    result_url: `${PUBLIC_URL}/?payment=return&order=${order.publicId}`,
    server_url: `${PUBLIC_URL}/api/payments/liqpay/callback`,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  return {
    url: 'https://www.liqpay.ua/api/3/checkout',
    data,
    signature: liqPaySignature(data),
  };
}

const requestLog = new Map();
function bookingRateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((time) => now - time < 10 * 60 * 1000);
  if (recent.length >= 10) return res.status(429).json({ error: 'Забагато спроб. Спробуйте трохи пізніше.' });
  recent.push(now);
  requestLog.set(key, recent);
  return next();
}

app.get('/api/booking/config', (_, res) => {
  res.json({
    packages: Object.values(PACKAGES),
    reservationMinutes: RESERVATION_MINUTES,
    paymentConfigured: PAYMENT_CONFIGURED,
  });
});

app.get('/api/booking/availability', async (req, res) => {
  const date = String(req.query.date || '');
  const packageItem = PACKAGES[String(req.query.package || '')];
  if (!isDateWithinBookingWindow(date) || !packageItem) {
    return res.status(400).json({ error: 'Оберіть коректну майбутню дату і тариф.' });
  }
  try {
    await expireReservations();
    return res.json({ date, slots: await getAvailableSlots(date, packageItem.durationMinutes) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Не вдалося отримати доступні години.' });
  }
});

app.post('/api/booking/orders', bookingRateLimit, async (req, res) => {
  const packageItem = PACKAGES[String(req.body.packageId || '')];
  const name = String(req.body.name || '').trim().slice(0, 100);
  const phone = String(req.body.phone || '').trim().slice(0, 30);
  const email = String(req.body.email || '').trim().slice(0, 150);
  const date = String(req.body.date || '');
  const time = String(req.body.time || '');
  const notes = String(req.body.notes || '').trim().slice(0, 500);
  const startMinutes = minutesFromTime(time);

  if (!packageItem || !name || name.length < 2 || !/^\+?[\d\s()\-]{7,20}$/.test(phone) || !isDateWithinBookingWindow(date) || startMinutes === null) {
    return res.status(400).json({ error: 'Перевірте тариф, імʼя, телефон, дату та час.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Перевірте адресу електронної пошти.' });
  }

  const hours = WORKING_HOURS[dayOfWeek(date)];
  const endMinutes = startMinutes + packageItem.durationMinutes;
  if (!hours || startMinutes < minutesFromTime(hours.start) || endMinutes > minutesFromTime(hours.end) || startMinutes % SLOT_STEP_MINUTES !== 0) {
    return res.status(400).json({ error: 'Цей час не входить у графік роботи студії.' });
  }

  const publicId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  try {
    await expireReservations();
    await dbRun('BEGIN IMMEDIATE');
    const conflict = await dbGet(
      `SELECT id FROM booking_orders
       WHERE booking_date = ? AND start_minutes < ? AND end_minutes > ?
         AND (status = 'paid' OR (status = 'pending_payment' AND expires_at > datetime('now')))
       LIMIT 1`,
      [date, endMinutes, startMinutes]
    );
    if (conflict) {
      await dbRun('ROLLBACK');
      return res.status(409).json({ error: 'Цей час щойно зайняли. Оберіть інший слот.' });
    }
    await dbRun(
      `INSERT INTO booking_orders
       (public_id, package_id, duration_minutes, price_uah, name, phone, email, booking_date, start_time, start_minutes, end_minutes, notes, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [publicId, packageItem.id, packageItem.durationMinutes, packageItem.priceUah, name, phone, email, date, time, startMinutes, endMinutes, notes, expiresAt]
    );
    await dbRun('COMMIT');

    const order = {
      publicId,
      date,
      time,
      packageLabel: packageItem.label,
      priceUah: packageItem.priceUah,
    };
    return res.status(201).json({
      order,
      expiresAt,
      payment: PAYMENT_CONFIGURED
        ? { mode: 'liqpay', ...createLiqPayCheckout(order) }
        : { mode: 'setup_required' },
    });
  } catch (error) {
    try { await dbRun('ROLLBACK'); } catch (_) { /* transaction already closed */ }
    console.error(error);
    return res.status(500).json({ error: 'Не вдалося зарезервувати слот.' });
  }
});

app.post('/api/payments/liqpay/callback', async (req, res) => {
  if (!PAYMENT_CONFIGURED) return res.status(503).send('payment is not configured');
  const data = String(req.body.data || '');
  const signature = String(req.body.signature || '');
  const expected = liqPaySignature(data);
  const valid = signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return res.status(400).send('invalid signature');

  try {
    const payment = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    if (payment.status === 'success' || payment.status === 'sandbox') {
      await dbRun(
        `UPDATE booking_orders
         SET status = 'paid', payment_id = ?, paid_at = datetime('now')
         WHERE public_id = ? AND price_uah = ? AND status = 'pending_payment'`,
        [String(payment.payment_id || ''), String(payment.order_id || ''), Number(payment.amount)]
      );
    }
    return res.send('ok');
  } catch (error) {
    console.error(error);
    return res.status(400).send('invalid payload');
  }
});

app.get('/api/booking/orders/:publicId/status', async (req, res) => {
  try {
    const order = await dbGet(
      `SELECT public_id, booking_date, start_time, package_id, price_uah, status, expires_at
       FROM booking_orders WHERE public_id = ?`,
      [req.params.publicId]
    );
    if (!order) return res.status(404).json({ error: 'Бронювання не знайдено.' });
    return res.json({
      id: order.public_id,
      date: order.booking_date,
      time: order.start_time,
      packageId: order.package_id,
      priceUah: order.price_uah,
      status: order.status,
      expiresAt: order.expires_at,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Не вдалося перевірити оплату.' });
  }
});

app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
  const from = isValidDate(String(req.query.from || '')) ? String(req.query.from) : currentKyivDate();
  try {
    await expireReservations();
    const rows = await dbAll(
      `SELECT public_id, package_id, duration_minutes, price_uah, name, phone, email,
              booking_date, start_time, notes, status, payment_id, expires_at, paid_at, created_at
       FROM booking_orders WHERE booking_date >= ?
       ORDER BY booking_date, start_minutes LIMIT 500`,
      [from]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'Не вдалося завантажити записи.' });
  }
});

app.get('/api/admin/blocks', requireAdmin, async (_, res) => {
  try {
    return res.json(await dbAll('SELECT * FROM blocked_slots ORDER BY booking_date, start_minutes'));
  } catch (error) {
    return res.status(500).json({ error: 'Не вдалося завантажити блокування.' });
  }
});

app.post('/api/admin/blocks', requireAdmin, async (req, res) => {
  const date = String(req.body.date || '');
  const start = minutesFromTime(String(req.body.start || ''));
  const end = minutesFromTime(String(req.body.end || ''));
  const reason = String(req.body.reason || '').trim().slice(0, 200);
  if (!isValidDate(date) || start === null || end === null || start >= end) {
    return res.status(400).json({ error: 'Перевірте дату та часовий інтервал.' });
  }
  try {
    const result = await dbRun(
      'INSERT INTO blocked_slots (booking_date, start_minutes, end_minutes, reason) VALUES (?, ?, ?, ?)',
      [date, start, end, reason]
    );
    return res.status(201).json({ id: result.lastID });
  } catch (error) {
    return res.status(500).json({ error: 'Не вдалося заблокувати час.' });
  }
});

app.delete('/api/admin/blocks/:id', requireAdmin, async (req, res) => {
  const result = await dbRun('DELETE FROM blocked_slots WHERE id = ?', [Number(req.params.id)]);
  return result.changes ? res.status(204).end() : res.status(404).json({ error: 'Блокування не знайдено.' });
});

app.patch('/api/admin/bookings/:publicId/status', requireAdmin, async (req, res) => {
  const status = String(req.body.status || '');
  if (!['cancelled', 'paid'].includes(status)) return res.status(400).json({ error: 'Недопустимий статус.' });
  const result = await dbRun('UPDATE booking_orders SET status = ? WHERE public_id = ?', [status, req.params.publicId]);
  return result.changes ? res.json({ status }) : res.status(404).json({ error: 'Запис не знайдено.' });
});

app.get('/health', async (_, res) => {
  try {
    await dbGet('SELECT 1 AS ok');
    return res.json({ status: 'ok', paymentConfigured: PAYMENT_CONFIGURED, adminConfigured: Boolean(ADMIN_TOKEN) });
  } catch (error) {
    return res.status(503).json({ status: 'error' });
  }
});

app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get('/rules', (_, res) => res.sendFile(path.join(__dirname, 'public', 'rules.html')));
app.use('/api', (_, res) => res.status(404).json({ error: 'API endpoint не знайдено.' }));
app.use((_, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

const server = app.listen(PORT, () => {
  console.log(`Pava Photostudio is running on http://localhost:${PORT}`);
  if (!PAYMENT_CONFIGURED) console.log('LiqPay scaffold mode: add PUBLIC_URL and LIQPAY keys to enable checkout.');
});

function shutdown() {
  server.close(() => db.close(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
