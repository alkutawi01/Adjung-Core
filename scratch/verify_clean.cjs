const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('adjung.db');

db.get("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'", (err, row) => {
  if (err || !row) return;
  const lines = row.inTheNewsText.split('\n');
  const copyrightLines = lines.filter(l => l.includes('©') || l.includes('&copy;'));
  const commaEllipsisLines = lines.filter(l => l.includes(',...') || l.includes(', ...') || l.includes(',…'));
  const fourDotLines = lines.filter(l => l.match(/\.{4,}/));

  console.log("=== VERIFICATION RESULTS ===");
  console.log("Copyright symbol lines:", copyrightLines.length);
  console.log("Comma + Ellipsis lines:", commaEllipsisLines.length);
  console.log("Four dot lines:", fourDotLines.length);
  if (copyrightLines.length > 0) console.log("Copyright lines:", copyrightLines);
  if (commaEllipsisLines.length > 0) console.log("Comma + Ellipsis lines:", commaEllipsisLines);
  if (fourDotLines.length > 0) console.log("Four dot lines:", fourDotLines);
});
