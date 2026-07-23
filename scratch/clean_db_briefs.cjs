const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('adjung.db');

function cleanBrief(text) {
  if (!text) return '';
  let cleaned = text.trim();

  // 1. Completely strip copyright symbols
  cleaned = cleaned.replace(/&(?:copy);?/gi, '');
  cleaned = cleaned.replace(/©/g, '');
  cleaned = cleaned.replace(/\s+\([cC]\)\s*/g, ' ');

  // 2. Strip copyright & publisher boilerplate at the end of text
  cleaned = cleaned.replace(/(?:\s*[-–—|•]?\s*(?:\bcopyright\b|\bhakcipta\b|\bhak cipta\b|\ball rights reserved\b|new straits times(?: press)?(?: \(m\) bhd)?|bernama|media prima|astro awani|utusan malaysia|kosmo(?: digital)?|sinar harian|berita harian|rtm|the star)\b.*$)/gi, '');

  // 3. Remove comma before 3 dots or ellipsis (e.g. TH,... or TH, ... or TH,...)
  cleaned = cleaned.replace(/,\s*(?:\.{3,}|…)/g, '...');
  cleaned = cleaned.replace(/,\s*\.\.\./g, '...');

  // 4. Remove truncated partial word before ellipsis if 1-5 chars e.g. "Jam...", "hamp..."
  cleaned = cleaned.replace(/\s+[A-Za-z0-9]{1,5}(?:\.\.\.|…)$/, '...');

  // 5. Format 4 dots as ". ..." and cleanup spacing around ellipsis
  cleaned = cleaned.replace(/\.{4,}/g, '. ...');
  cleaned = cleaned.replace(/\.\s*\.\.\./g, '. ...');
  cleaned = cleaned.replace(/,\s*(?:\.\s*\.\.\.|\.\.\.)/g, '...');

  return cleaned.trim();
}

db.get("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'", (err, row) => {
  if (err || !row || !row.inTheNewsText) return;
  const oldText = row.inTheNewsText;
  const lines = oldText.split('\n');
  const cleanedLines = lines.map(line => {
    if (line.toLowerCase().startsWith('brief:')) {
      const val = line.substring(6).trim();
      return `brief: ${cleanBrief(val)}`;
    }
    return line;
  });
  const newText = cleanedLines.join('\n');
  db.run("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [newText], function(updateErr) {
    if (updateErr) console.error("Update error:", updateErr);
    else console.log("Successfully cleaned inTheNewsText in SQLite DB! Changes:", this.changes);
  });
});

db.all("SELECT id, formattedBrief FROM rss_ticker_items", (err, rows) => {
  if (err || !rows) return;
  let updatedCount = 0;
  rows.forEach(r => {
    if (r.formattedBrief) {
      const cleaned = cleanBrief(r.formattedBrief);
      if (cleaned !== r.formattedBrief) {
        db.run("UPDATE rss_ticker_items SET formattedBrief = ? WHERE id = ?", [cleaned, r.id]);
        updatedCount++;
      }
    }
  });
  console.log(`Updated ${updatedCount} RSS ticker items in DB for copyright, comma-ellipsis & 4-dot cleanup.`);
});
