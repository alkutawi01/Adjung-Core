const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('adjung.db');

db.get("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'", (err, row) => {
  if (err) console.error(err);
  else console.log("--- IN THE NEWS TEXT --- \n", row ? row.inTheNewsText : "None");
});

db.all("SELECT id, title, formattedBrief FROM rss_ticker_items LIMIT 10", (err, rows) => {
  if (err) console.error(err);
  else console.log("\n--- RSS TICKER ITEMS --- \n", rows);
});
