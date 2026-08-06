// LAPORAN LIPUTAN — laluan tulis mana yang BELUM disentuh mana-mana simulasi.
// Menjawab soalan sebenar: "berapa banyak yang kita betul-betul dah periksa?"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');

// 1. Kumpul SEMUA laluan tulis daripada kod.
const laluanTulis = [];
for (const f of fs.readdirSync(path.join(REPO, 'core', 'routes'))) {
  if (!f.endsWith('.js')) continue;
  const s = fs.readFileSync(path.join(REPO, 'core', 'routes', f), 'utf8');
  const re = /router\.(post|patch|put|delete)\('([^']+)'/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    laluanTulis.push({ kaedah: m[1].toUpperCase(), laluan: m[2], fail: f });
  }
}

// 2. Kumpul teks SEMUA simulasi.
const teksSim = fs.readdirSync(HERE)
  .filter(f => /^sim\d+-.*\.mjs$/.test(f))
  .map(f => fs.readFileSync(path.join(HERE, f), 'utf8'))
  .join('\n');

// 3. Padankan. Laluan berparameter dipadan ikut segmen tetapnya.
const disentuh = [];
const tidak = [];
// Laluan berparameter (cth /content/:id/revisions/:revisionId/restore) tidak pernah muncul
// sebagai rentetan utuh dalam simulasi — nilai sebenar disisipkan di tengah. Jadi padanan dibuat
// pada SETIAP segmen tetap: laluan dikira disentuh hanya kalau KESEMUA segmen bukan-parameternya
// hadir dalam teks simulasi. Tanpa ini, laluan yang MEMANG diuji dilaporkan sebagai tidak diuji,
// dan angka liputan jadi menipu ke arah pesimis.
for (const r of laluanTulis) {
  const segmen = r.laluan.split('/').filter(p => p && !p.startsWith(':'));
  if (!segmen.length) { tidak.push(r); continue; }
  const semuaHadir = segmen.every(s => teksSim.includes(s));
  if (semuaHadir) disentuh.push(r); else tidak.push(r);
}

console.log('=== LIPUTAN SIMULASI: LALUAN TULIS ===');
console.log(`jumlah laluan tulis : ${laluanTulis.length}`);
console.log(`disentuh simulasi   : ${disentuh.length}`);
console.log(`BELUM disentuh      : ${tidak.length}`);
console.log(`peratus liputan     : ${Math.round((disentuh.length / laluanTulis.length) * 100)}%`);

if (tidak.length) {
  console.log('\n--- BELUM disentuh (ikut fail) ---');
  const ikutFail = {};
  for (const r of tidak) (ikutFail[r.fail] ||= []).push(`${r.kaedah} ${r.laluan}`);
  for (const [f, senarai] of Object.entries(ikutFail).sort()) {
    console.log(`  ${f}`);
    for (const l of senarai) console.log(`    ${l}`);
  }
}
