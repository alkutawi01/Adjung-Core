// Inserts researched editorial items into adjung.db, matching the schema/pattern used by
// POST /api/system/content/all's manual-item creation path in server.js (editorial_objects +
// editorial_revisions + editorial_attribute_values), including CategoryRegistry registration.
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join('C:', 'Users', 'manus', 'Claude', 'Adjung-Core', 'adjung.db');
const db = new sqlite3.Database(dbPath);

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}

// --- minimal inline CategoryRegistry color assignment (mirrors core/category/CategoryRegistry.js) ---
const COLOR_PALETTE = [
  '#DC2626','#E11D48','#DB2777','#9333EA','#7C3AED','#4F46E5','#2563EB','#0284C7','#0891B2','#0D9488',
  '#059669','#16A34A','#65A30D','#CA8A04','#D97706','#EA580C','#B45309','#C2410C','#B91C1C','#BE123C',
  '#A21CAF','#701A75','#6D28D9','#4338CA','#1D4ED8','#0369A1','#0E7490','#0F766E','#047857','#15803D',
  '#4D7C0F','#A16207','#9A3412','#9F1239','#86198F','#5B21B6','#3730A3','#1E40AF','#075985','#115E59',
  '#065F46','#166534'
];
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}
function generateColorBeyondPalette(index) {
  const GOLDEN_ANGLE = 137.508;
  return hslToHex((index * GOLDEN_ANGLE) % 360, 65, 42);
}
function getSlug(name) {
  return (name || 'umum').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
async function registerCategory(category) {
  const name = (category || 'UMUM').trim();
  const slug = getSlug(name);
  const existing = await dbGet("SELECT * FROM CategoryRegistry WHERE slug = ?", [slug]);
  if (existing) {
    await dbRun("UPDATE CategoryRegistry SET usageCount = usageCount + 1, updatedAt = ? WHERE slug = ?", [new Date().toISOString(), slug]);
    return existing;
  }
  const allRegistered = await dbAll("SELECT color FROM CategoryRegistry");
  const assignedColors = allRegistered.map(r => r.color.toUpperCase());
  let chosenColor = COLOR_PALETTE.find(c => !assignedColors.includes(c.toUpperCase()));
  if (!chosenColor) {
    chosenColor = generateColorBeyondPalette(allRegistered.length);
    while (assignedColors.includes(chosenColor.toUpperCase())) {
      chosenColor = generateColorBeyondPalette(allRegistered.length + assignedColors.length + Math.random());
    }
  }
  const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO CategoryRegistry (id, slug, name, color, usageCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [id, slug, name, chosenColor, now, now]
  );
  return { id, slug, name, color: chosenColor };
}

async function insertItem(item) {
  const { slotIndex, title, brief, desk, source, url, publishedAt } = item;
  const finalCategory = (desk || 'UMUM').trim().toUpperCase();
  await registerCategory(finalCategory);

  const createdAt = publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString();
  const now = new Date().toISOString();
  const objectId = `object-research-slot${slotIndex}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  await dbRun(
    `INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt) VALUES (?, 'Brief', ?, 'Medium', ?, ?, ?)`,
    [objectId, finalCategory, slotIndex, createdAt, now]
  );
  const rev = await dbRun(
    `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt) VALUES (?, 1.0, 'ms', ?, ?, 'approved', 'content-review', ?, ?)`,
    [objectId, title.trim(), (brief || '').trim(), createdAt, now]
  );
  const revisionId = rev.lastID;

  const attrs = [
    { key: 'desk', val: finalCategory },
    { key: 'url', val: url || '#' },
    { key: 'source', val: source || '' },
  ];
  for (const a of attrs) {
    await dbRun(
      "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
      [objectId, revisionId, a.key, a.val]
    );
  }
  return objectId;
}

async function main() {
  const itemsPath = process.argv[2];
  if (!itemsPath) { console.error('Usage: node insert_items.js <items.json>'); process.exit(1); }
  const items = JSON.parse(require('fs').readFileSync(itemsPath, 'utf-8'));
  const results = [];
  for (const item of items) {
    try {
      const id = await insertItem(item);
      results.push({ slotIndex: item.slotIndex, title: item.title.slice(0, 40), id, status: 'OK' });
    } catch (e) {
      results.push({ slotIndex: item.slotIndex, title: item.title ? item.title.slice(0, 40) : '?', status: 'FAILED', error: e.message });
    }
  }
  console.log(JSON.stringify(results, null, 1));
  db.close();
}

main();
