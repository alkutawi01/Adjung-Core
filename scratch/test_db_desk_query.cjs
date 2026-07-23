const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('C:/Users/alkut/Downloads/Adjung Mini/adjung.db');

db.all('SELECT category, COUNT(*) as cnt FROM rss_ticker_items GROUP BY category ORDER BY cnt DESC', (err, rows) => {
  console.log('DESK DISTRIBUTION AFTER V2 ENGINE:', rows);
});

db.all('SELECT title, category, deskBreakdown FROM rss_ticker_items WHERE title LIKE "%polis%" OR title LIKE "%mahkamah%" OR title LIKE "%pasport%" LIMIT 5', (err, rows) => {
  console.log('LEGAL / POLICE / PASSPORT NEWS SAMPLES:', rows);
});
