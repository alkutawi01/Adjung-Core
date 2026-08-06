// Pelari kesemua simulasi. Setiap simulasi hidupkan pelayan SEBENAR terhadap DB BUANGAN
// (ADJUNG_DB_PATH) — adjung.db sebenar tidak pernah disentuh.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const SIM = fs.readdirSync(path.dirname(fileURLToPath(import.meta.url)))
  .filter(f => /^sim\d+-.*\.mjs$/.test(f))
  .sort();

const jalan = (f) => new Promise((res) => {
  const p = spawn('node', [`.simulasi/${f}`], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', d => { out += d; });
  p.stderr.on('data', d => { out += d; });
  p.on('close', (kod) => res({ f, kod, out }));
});

console.log(`Menjalankan ${SIM.length} simulasi...\n`);
const hasil = [];
for (const f of SIM) {
  process.stdout.write(`-> ${f} ... `);
  const r = await jalan(f);
  const ringkas = r.out.trim().split('\n').find(b => b.includes('penemuan ===')) || '';

  // Bilangan penemuan yang DILAPORKAN ialah sumber kebenaran, bukan kod keluar. Pada Windows,
  // sqlite3 kadangkala melemparkan penegasan libuv semasa penutupan proses (menutup pemegang DB
  // sambil proses pelayan dibunuh) — itu ranap rangka SELEPAS keputusan dicetak, bukan penemuan.
  const padanan = ringkas.match(/:\s*(\d+)\s+penemuan/);
  const bilPenemuan = padanan ? Number(padanan[1]) : (r.kod === 0 ? 0 : null);
  const ranapPenutupan = bilPenemuan === 0 && r.kod !== 0;

  console.log(bilPenemuan === 0 ? (ranapPenutupan ? 'BERSIH (ranap penutupan rangka diabaikan)' : 'BERSIH')
    : bilPenemuan === null ? 'RANAP SEBELUM KEPUTUSAN' : 'ADA PENEMUAN');
  if (bilPenemuan) console.log(r.out.split('=== ').slice(-1)[0].trimEnd().split('\n').map(b => '     ' + b).join('\n'));
  if (bilPenemuan === null) console.log(r.out.trim().split('\n').slice(-6).map(b => '     ' + b).join('\n'));
  hasil.push({ ...r, ringkas, bilPenemuan });
}

const gagal = hasil.filter(h => h.bilPenemuan !== 0);
console.log('\n==================================================');
console.log(`KEPUTUSAN: ${hasil.length - gagal.length}/${hasil.length} simulasi BERSIH`);
if (gagal.length) {
  console.log('Simulasi dengan penemuan:');
  gagal.forEach(g => console.log('  - ' + g.f));
}
console.log('==================================================');
process.exit(gagal.length ? 1 : 0);
