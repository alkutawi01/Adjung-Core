const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('C:/Users/alkut/Downloads/Adjung Mini/adjung.db');

db.all('SELECT * FROM rss_sources_registry', (err, rows) => {
  console.log('RSS SOURCES REGISTRY:', rows);
});
