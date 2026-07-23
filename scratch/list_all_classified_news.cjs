const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('C:/Users/alkut/Downloads/Adjung Mini/adjung.db');

db.all('SELECT title, source, category, score, deskBreakdown FROM rss_ticker_items ORDER BY category ASC, score DESC', (err, rows) => {
  console.log('TOTAL_ITEMS:', rows.length);
  console.log(JSON.stringify(rows, null, 2));
});
