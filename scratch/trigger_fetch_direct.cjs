const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('C:/Users/alkut/Downloads/Adjung Mini/adjung.db');

// Set maxNewsAgeHours = 0 (Unlimited) for full demo batch testing
db.run("INSERT OR REPLACE INTO rss_editorial_settings (id, autoLiveThreshold, reviewThreshold, priorityKeywords, blockedKeywords, priorityBonus, blockedPenalty, maxNewsAgeHours, updatedAt) VALUES ('main', 80, 60, 'dasar, belanjawan, ekonomi, pendidikan, menteri, kerajaan', 'gempar, viral, panas, terbongkar', 15, 40, 0, ?)", [new Date().toISOString()], async () => {

  // Clear old items so fetch-direct re-inserts with new DeskClassifier v2 engine and deskBreakdown JSON
  db.run('DELETE FROM rss_ticker_items', async (err) => {
    console.log('Cleared old rss_ticker_items cache and set maxNewsAgeHours = 0.');
    
    const response = await fetch('http://localhost:5000/api/system/ticker/fetch-direct', { method: 'POST' });
    const data = await response.json();
    console.log('FETCH DIRECT RESPONSE:', data);

    db.all('SELECT category, COUNT(*) as cnt FROM rss_ticker_items GROUP BY category ORDER BY cnt DESC', (err, rows) => {
      console.log('NEW DESK DISTRIBUTION WITH V2 ENGINE:', rows);
    });

    db.all('SELECT title, category, deskBreakdown FROM rss_ticker_items WHERE title LIKE "%pasport%" OR title LIKE "%polis%" OR title LIKE "%mahkamah%" LIMIT 5', (err, rows) => {
      console.log('RE-CLASSIFIED LEGAL / POLICE / PASSPORT NEWS SAMPLES:', rows);
    });
  });
});
