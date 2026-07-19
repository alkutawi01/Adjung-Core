const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve('adjung.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Connected to:', dbPath);
  }
});

db.serialize(() => {
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) {
      console.error(err);
    } else {
      console.log('Users in DB:');
      console.log(rows);
    }
  });
});
db.close();
