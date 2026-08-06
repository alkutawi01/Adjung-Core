import sanitizeHtml from 'sanitize-html';

// Penapis SVG KONGSI (2026-08-06, audit keselamatan). Dahulu logik senarai putih ni hidup HANYA
// dalam categoryRoutes.js (ikon/plat Bidang), manakala muat naik media am (mediaRoutes.js)
// menerima `image/svg+xml` dan menulisnya ke public/uploads TANPA sebarang penapisan — SVG boleh
// membawa <script>/pengendali on*, dan kerana fail dihidang dari origin yang SAMA dengan portal,
// sesiapa yang membukanya menjalankan skrip itu dalam konteks sesi mereka (stored XSS: editor
// boleh menyerang Ketua Editor/Pentadbir).
//
// Senarai putih ini ialah satu-satunya pertahanan — jangan longgarkan tanpa sebab kukuh.
// Tiada <script>, tiada pengendali on*, tiada href/xlink:href/style (jadi tiada laluan
// javascript:/url() tersembunyi), tiada <foreignObject> (boleh menyeludup HTML sebenar).
export const SVG_ALLOWED_TAGS = [
  'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
  'defs', 'clipPath', 'linearGradient', 'radialGradient', 'stop', 'title', 'desc', 'text', 'tspan'
];

export const SVG_ALLOWED_ATTR = [
  'viewBox', 'width', 'height', 'xmlns', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'transform', 'offset',
  'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'id', 'fill-rule', 'clip-rule',
  'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-dasharray'
];

/**
 * Tapis markup SVG kepada senarai putih di atas. Tidak menyentuh warna — pemanggil yang perlukan
 * penukaran currentColor (ikon/plat Bidang) buat langkah itu sendiri selepas ini.
 * @throws {Error} kalau input kosong atau bukan SVG sah selepas ditapis.
 */
export function sanitizeSvgMarkup(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('SVG kosong.');
  const cleaned = sanitizeHtml(raw, {
    allowedTags: SVG_ALLOWED_TAGS,
    allowedAttributes: { '*': SVG_ALLOWED_ATTR },
    allowedSchemes: [],
    disallowedTagsMode: 'discard',
    // xmlMode: SVG ialah XML sensitif huruf besar/kecil (cth "viewBox", "gradientTransform") — mod
    // HTML lalai sanitize-html rata-ratakan semua nama atribut jadi huruf kecil, jadi tanpa ni
    // viewBox terus tertapis (bukan sebab disekat, sebab dah tak sepadan nama dalam allowlist).
    parser: { xmlMode: true }
  }).trim();
  if (!/^<svg[\s>]/i.test(cleaned)) throw new Error('Fail bukan SVG yang sah selepas ditapis.');
  return cleaned;
}

export default sanitizeSvgMarkup;
