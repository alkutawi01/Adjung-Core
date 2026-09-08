// Loader ESM khusus SIM 18 SAHAJA — gantikan urlSafety.js (gerbang SSRF) dengan versi lulus-semua
// semasa executeDirectRssFetch() diuji terus (bukan melalui laluan HTTP/Express). Gerbang SSRF
// SEBENAR (core/utils/urlSafety.js) sengaja menyekat localhost/IP peribadi — sekatan itu SUDAH
// disahkan betul dalam audit keselamatan lepas (2026-08-08/09-03), bukan skop ujian ni. Loader ni
// membolehkan ambilan RSS diuji hujung-ke-hujung terhadap pelayan palsu tempatan TANPA mengubah/
// melemahkan kod sekatan SSRF sebenar yang tetap utuh untuk laluan HTTP/pengeluaran sebenar.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const stubUrl = pathToFileURL(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'sim18-stub-urlsafety.mjs')).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.replace(/\\/g, '/').endsWith('utils/urlSafety.js')) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
