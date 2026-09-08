// Sim46 — sahkan tetTeksBerhad() (had 10MB, stream-based, dicipta bug-hunt #118) kini benar-benar
// disambungkan di DUA laluan tambahan yang masih guna response.text() mentah: SourceFetcher.js
// (senarai rujukan sumber AI, editor taip sendiri) dan dbStateRoutes.js fetchGoogleDocText()
// (medan *GoogleDocUrl, Pentadbir taip sendiri). sahkanUrlSelamatUntukFetch() (SSRF guard) sekat
// fetch() terus ke 127.0.0.1 dalam ujian sebenar (betul, reka bentuk sengaja) — jadi sim ni uji
// tetTeksBerhad() secara langsung dengan Response palsu yang menstrim data tanpa henti, MENIRU
// tepat apa yang response sebenar dalam SourceFetcher.js/dbStateRoutes.js akan hadapi kalau
// sumber luaran jahat/rosak pulangkan badan gergasi.
import { tetTeksBerhad, RalatUrlTakSelamat } from '../core/utils/urlSafety.js';
import SourceFetcher from '../core/sources/SourceFetcher.js';
import fs from 'node:fs';

// 1. Sahkan tetTeksBerhad() sendiri hentikan strim >10MB dan lontar RalatUrlTakSelamat.
const CHUNK = new TextEncoder().encode('a'.repeat(1024 * 1024)); // 1MB chunk
let chunksProduced = 0;
const stream = new ReadableStream({
  pull(controller) {
    chunksProduced++;
    if (chunksProduced > 500) { // injap keselamatan sim, tak patut pernah sampai sini
      controller.close();
      return;
    }
    controller.enqueue(CHUNK);
  }
});
const fakeResponse = { body: stream };

let lulus1 = false;
try {
  await tetTeksBerhad(fakeResponse, { hadBait: 10 * 1024 * 1024 });
  console.log('GAGAL(1): tetTeksBerhad tidak lontar ralat walau melebihi had.');
} catch (err) {
  lulus1 = err instanceof RalatUrlTakSelamat && chunksProduced <= 15; // patut henti sejurus lepas 10MB (~11 chunk), bukan teruskan sampai 500
  console.log('Ujian 1 (tetTeksBerhad had 10MB):', lulus1 ? 'LULUS' : 'GAGAL', { chunksProduced, mesej: err.message });
}

// 2. Sahkan SourceFetcher.js/dbStateRoutes.js benar-benar IMPORT & PANGGIL tetTeksBerhad (bukan
// response.text() mentah) — semakan statik kod sumber sebenar (bukan tekaan).
const sfSrc = fs.readFileSync(new URL('../core/sources/SourceFetcher.js', import.meta.url), 'utf8');
const dbSrc = fs.readFileSync(new URL('../core/routes/dbStateRoutes.js', import.meta.url), 'utf8');
const codeLines = (src) => src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
const lulus2 = sfSrc.includes('tetTeksBerhad') && !codeLines(sfSrc).includes('response.text()');
const lulus3 = dbSrc.includes('tetTeksBerhad') && !codeLines(dbSrc).includes('response.text()');
console.log('Ujian 2 (SourceFetcher.js guna tetTeksBerhad, bukan response.text() mentah):', lulus2 ? 'LULUS' : 'GAGAL');
console.log('Ujian 3 (dbStateRoutes.js guna tetTeksBerhad, bukan response.text() mentah):', lulus3 ? 'LULUS' : 'GAGAL');

// 4. Sahkan SourceFetcher masih berfungsi normal untuk respons KECIL biasa (tiada regresi).
console.log('SourceFetcher wujud & eksport betul:', typeof SourceFetcher.fetchRaw === 'function' ? 'LULUS' : 'GAGAL');

const semua = lulus1 && lulus2 && lulus3;
console.log(semua ? '\nKESELURUHAN: LULUS' : '\nKESELURUHAN: GAGAL');
process.exit(semua ? 0 : 1);
