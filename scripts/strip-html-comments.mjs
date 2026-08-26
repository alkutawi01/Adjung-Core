// Buang komen HTML (<!-- ... -->) daripada dist/index.html selepas build produksi.
// Punca: index.html sumber (root projek) ada komen dalaman panjang (sejarah pepijat, nama
// pembangun, rujukan fail CLAUDE.md/FocusView.tsx/dll) — berguna untuk kerja dalaman, tapi
// Vite TIDAK strip komen HTML secara lalai, jadi ia terus dihantar kepada sesiapa yang buka
// "View Source" di https://brief.adjung.com/. Skrip ni jalan SELEPAS `vite build` (lihat
// package.json "build"), cuma ubah SALINAN dist/ — index.html SUMBER (root) kekal seperti
// asal, komen dalaman kekal berguna untuk kerja Claude/Izzat seterusnya.
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');

const html = readFileSync(distIndexPath, 'utf8');
const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
writeFileSync(distIndexPath, stripped);

console.log(`[strip-html-comments] Komen HTML dibuang daripada ${distIndexPath}`);
