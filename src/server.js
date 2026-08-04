const express = require('express');
const path = require('path');
const fs = require('fs');

let DatabaseSync;
try {
  // node:sqlite is built into Node.js (>= 22.5). No native compilation,
  // no extra dependency, no platform-specific binaries to go wrong.
  ({ DatabaseSync } = require('node:sqlite'));
} catch (err) {
  console.error(
    'FEHLER: node:sqlite ist in dieser Node.js-Version nicht verfügbar.\n' +
    'Benötigt wird Node.js >= 22.5. Aktuelle Version: ' + process.version + '\n' +
    'Falls Sie Node 22.5–22.x einsetzen und es trotzdem fehlschlägt, versuchen Sie:\n' +
    '  node --experimental-sqlite server.js'
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// PATH PREFIX (deploy under a subpath, e.g. behind a reverse proxy at
// https://example.com/imiq/ instead of the domain root)
// ---------------------------------------------------------------------------
// Set PATH_PREFIX="/imiq" to serve everything under /imiq/...
// Leave unset (or "/") to serve at the domain root as before.
function normalizePrefix(p) {
  if (!p) return '';
  p = p.trim();
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+$/, ''); // strip trailing slash(es)
  return p; // '' if input was just "/" or empty
}
const PATH_PREFIX = normalizePrefix(process.env.PATH_PREFIX);

// ---------------------------------------------------------------------------
// SECRET ADMIN URL
// ---------------------------------------------------------------------------
// The admin area has NO login. Its only protection is that the URL is secret.
// Change this to your own long, random value before deploying — either edit
// the default below or set the ADMIN_SECRET environment variable.
// Example: ADMIN_SECRET=xk92-verwaltung-q8f3 node server.js
// ---------------------------------------------------------------------------
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------
const dataDir = "/data";
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'faqs.db'));
// db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question   TEXT NOT NULL,
    answer     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

app.use(express.json());

const appRouter = express.Router();

appRouter.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// PUBLIC API — used by public/index.html
// ---------------------------------------------------------------------------

// Only answered FAQs are visible to the public
appRouter.get('/api/faqs', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, question, answer FROM faqs
       WHERE answer IS NOT NULL AND TRIM(answer) != ''
       ORDER BY updated_at DESC`
    )
    .all();
  res.json(rows);
});

// Visitors submit a new question (unanswered by default)
appRouter.post('/api/faqs', (req, res) => {
  const question = (req.body && req.body.question ? String(req.body.question) : '').trim();
  if (!question) {
    return res.status(400).json({ error: 'Frage darf nicht leer sein.' });
  }
  if (question.length > 2000) {
    return res.status(400).json({ error: 'Frage ist zu lang.' });
  }
  const info = db.prepare('INSERT INTO faqs (question) VALUES (?)').run(question);
  res.status(201).json({ id: info.lastInsertRowid });
});

// ---------------------------------------------------------------------------
// ADMIN AREA — reachable only under the secret path, no login
// ---------------------------------------------------------------------------
const adminRouter = express.Router();

// Serve the admin panel HTML
adminRouter.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

// List every question (answered + unanswered)
adminRouter.get('/api/faqs', (req, res) => {
  const rows = db.prepare('SELECT * FROM faqs ORDER BY created_at DESC').all();
  console.log(rows)
  res.json(rows);
});

// Edit a question's text and/or answer it
adminRouter.put('/api/faqs/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM faqs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Nicht gefunden.' });

  const question =
    req.body.question !== undefined ? String(req.body.question).trim() : existing.question;
  const answer =
    req.body.answer !== undefined ? String(req.body.answer).trim() : existing.answer;

  if (!question) {
    return res.status(400).json({ error: 'Frage darf nicht leer sein.' });
  }

  db.prepare(
    `UPDATE faqs SET question = ?, answer = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(question, answer, req.params.id);

  res.json(db.prepare('SELECT * FROM faqs WHERE id = ?').get(req.params.id));
});

// Delete a question
adminRouter.delete('/api/faqs/:id', (req, res) => {
  const info = db.prepare('DELETE FROM faqs WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.status(204).end();
});

appRouter.use(`/${ADMIN_SECRET}`, adminRouter);

app.use(PATH_PREFIX, appRouter);

// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  const base = `http://localhost:${PORT}${PATH_PREFIX}`;
  console.log(`IMIQ FAQ Server läuft auf ${base}/`);
  console.log(`Admin-Bereich (geheim, ohne Login): ${base}/${ADMIN_SECRET}/`);
  if (PATH_PREFIX) {
    console.log(`Pfad-Präfix aktiv: ${PATH_PREFIX}`);
  }
});
