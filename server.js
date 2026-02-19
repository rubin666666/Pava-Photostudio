const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bookings.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(date, time)
    )
  `);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/bookings', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  db.all(
    `SELECT id, name, phone, date, time, notes, created_at
     FROM bookings
     ORDER BY date ASC, time ASC
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Не вдалося отримати записи.' });
      }
      return res.json(rows);
    }
  );
});

app.post('/api/bookings', (req, res) => {
  const { name, phone, date, time, notes = '' } = req.body;

  if (!name || !phone || !date || !time) {
    return res.status(400).json({ error: 'Заповніть обовʼязкові поля.' });
  }

  const trimmedName = String(name).trim();
  const trimmedPhone = String(phone).trim();
  const trimmedDate = String(date).trim();
  const trimmedTime = String(time).trim();
  const trimmedNotes = String(notes).trim().slice(0, 500);

  if (!trimmedName || !trimmedPhone) {
    return res.status(400).json({ error: 'Імʼя та телефон не можуть бути порожніми.' });
  }

  db.run(
    `INSERT INTO bookings (name, phone, date, time, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [trimmedName, trimmedPhone, trimmedDate, trimmedTime, trimmedNotes],
    function insertCallback(err) {
      if (err) {
        if (String(err.message).includes('UNIQUE')) {
          return res.status(409).json({ error: 'Цей час уже зайнято. Оберіть інший слот.' });
        }
        return res.status(500).json({ error: 'Не вдалося створити запис.' });
      }

      return res.status(201).json({
        id: this.lastID,
        name: trimmedName,
        phone: trimmedPhone,
        date: trimmedDate,
        time: trimmedTime,
        notes: trimmedNotes,
      });
    }
  );
});

app.use((_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Pava Photostudio is running on http://localhost:${PORT}`);
});
