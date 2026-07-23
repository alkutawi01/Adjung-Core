const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('C:/Users/alkut/Downloads/Adjung Mini/adjung.db');

db.all('SELECT title, source, category, score, deskBreakdown FROM rss_ticker_items ORDER BY category ASC, score DESC', (err, rows) => {
  const grouped = {};
  rows.forEach(r => {
    const cat = r.category || 'BELUM DIKELASKAN';
    if (!grouped[cat]) grouped[cat] = [];
    
    let dbd = null;
    try {
      dbd = typeof r.deskBreakdown === 'string' ? JSON.parse(r.deskBreakdown) : r.deskBreakdown;
    } catch (e) {}

    grouped[cat].push({
      title: r.title,
      source: r.source,
      score: r.score,
      confidence: dbd ? dbd.confidence : 'N/A',
      explanation: dbd ? (dbd.explanation || dbd.reason) : ''
    });
  });

  console.log('MARKDOWN_START');
  Object.keys(grouped).forEach(desk => {
    console.log(`\n### 🏷️ DESK: ${desk.toUpperCase()} (${grouped[desk].length} Berita)`);
    console.log('| No. | Tajuk Berita | Sumber | Keyakinan | Nota Padanan / Trace |');
    console.log('| --- | ------------ | ------ | --------- | -------------------- |');
    grouped[desk].forEach((item, idx) => {
      const cleanTitle = item.title.replace(/\|/g, '-');
      const cleanTrace = (item.explanation || '').replace(/\|/g, '-');
      console.log(`| ${idx + 1} | ${cleanTitle} | ${item.source} | ${item.confidence} | ${cleanTrace} |`);
    });
  });
  console.log('MARKDOWN_END');
});
