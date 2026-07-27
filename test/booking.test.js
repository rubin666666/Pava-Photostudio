const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { before, after, test } = require('node:test');

const port = 31991;
const baseUrl = `http://127.0.0.1:${port}`;
const privateKey = 'test_private_key';
const adminToken = 'test_admin_token_123';
const dbPath = path.join(__dirname, '..', 'data', 'automated-test.db');
let server;
let orderId;

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('json') ? await response.json() : await response.text();
  return { response, body };
}

before(async () => {
  fs.rmSync(dbPath, { force: true });
  fs.rmSync(`${dbPath}-wal`, { force: true });
  fs.rmSync(`${dbPath}-shm`, { force: true });
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      PUBLIC_URL: baseUrl,
      LIQPAY_PUBLIC_KEY: 'test_public_key',
      LIQPAY_PRIVATE_KEY: privateKey,
      ADMIN_TOKEN: adminToken,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server start timeout')), 8000);
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('is running')) { clearTimeout(timer); resolve(); }
    });
    server.once('exit', (code) => reject(new Error(`Server exited with ${code}`)));
  });
});

after(async () => {
  if (server && !server.killed) server.kill('SIGTERM');
  await new Promise((resolve) => server?.once('exit', resolve) || resolve());
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
});

test('health endpoint and security headers are available', async () => {
  const { response, body } = await request('/health');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
});

test('public, admin and error pages serve their required assets', async () => {
  for (const route of ['/', '/styles.css', '/legacy.css', '/admin.css', '/admin.js']) {
    assert.equal((await request(route)).response.status, 200, route);
  }
  const admin = await request('/admin');
  assert.equal(admin.response.status, 200);
  assert.match(admin.body, /Керування записами/);
  assert.equal((await request('/missing-page')).response.status, 404);
});

test('public API does not expose the old customer list', async () => {
  const { response } = await request('/api/bookings');
  assert.equal(response.status, 404);
});

test('invalid and past booking data is rejected', async () => {
  const { response } = await request('/api/booking/orders', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ packageId: '60', name: 'A', phone: '123', date: '2020-01-01', time: '10:00' }),
  });
  assert.equal(response.status, 400);
});

test('booking reserves its complete duration and prevents overlap', async () => {
  const first = await request('/api/booking/orders', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ packageId: '60', name: 'Test Client', phone: '+380501234567', date: '2027-01-15', time: '10:00' }),
  });
  assert.equal(first.response.status, 201);
  assert.equal(first.body.payment.mode, 'liqpay');
  orderId = first.body.order.publicId;

  const overlap = await request('/api/booking/orders', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ packageId: '30', name: 'Second Client', phone: '+380671234567', date: '2027-01-15', time: '10:30' }),
  });
  assert.equal(overlap.response.status, 409);
});

test('signed LiqPay callback is idempotent and confirms payment', async () => {
  const payload = { order_id: orderId, payment_id: 777, amount: 1599, status: 'sandbox' };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto.createHash('sha1').update(`${privateKey}${data}${privateKey}`).digest('base64');
  const form = new URLSearchParams({ data, signature });
  for (let index = 0; index < 2; index += 1) {
    const result = await request('/api/payments/liqpay/callback', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form,
    });
    assert.equal(result.response.status, 200);
  }
  const status = await request(`/api/booking/orders/${orderId}/status`);
  assert.equal(status.body.status, 'paid');
});

test('admin API requires a token and blocks availability', async () => {
  assert.equal((await request('/api/admin/bookings')).response.status, 401);
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` };
  const block = await request('/api/admin/blocks', {
    method: 'POST', headers,
    body: JSON.stringify({ date: '2027-01-16', start: '12:00', end: '13:00', reason: 'Test block' }),
  });
  assert.equal(block.response.status, 201);
  const availability = await request('/api/booking/availability?date=2027-01-16&package=30');
  assert.equal(availability.body.slots.includes('12:00'), false);
  assert.equal(availability.body.slots.includes('12:30'), false);
});
