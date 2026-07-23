const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('C:/Users/alkut/Downloads/Adjung Mini/adjung.db');

db.all('SELECT title, source, category, decision FROM rss_ticker_items WHERE status = "blocked_category" LIMIT 10', (err, rows) => {
  console.log('BLOCKED ITEMS IN DATABASE AUDIT TRAIL:', rows);
});
