const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'adjung.db');
const db = new sqlite3.Database(dbPath);

db.get("SELECT * FROM system_settings WHERE id = 'settings-main'", (err, row) => {
  if (err) {
    console.error(err);
  } else {
    console.log('inTheNewsGoogleDocUrl:', row.inTheNewsGoogleDocUrl);
    console.log('inTheNewsText length:', row.inTheNewsText ? row.inTheNewsText.length : 0);
  }
  db.close();
});
