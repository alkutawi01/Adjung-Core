import express from 'express';
import sanitizeHtml from 'sanitize-html';
import CategoryRegistry from '../category/CategoryRegistry.js';

// Senarai putih ketat untuk ikon SVG custom Bidang (muat naik admin) — tiada <script>, tiada
// pengendali on*, tiada href/xlink:href/style (jadi tiada laluan javascript:/url() tersembunyi).
// Bukan cadangan, ni satu-satunya pertahanan XSS untuk laluan ni — jangan longgarkan tanpa sebab kukuh.
const SVG_ALLOWED_TAGS = [
  'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
  'defs', 'clipPath', 'linearGradient', 'radialGradient', 'stop', 'title', 'desc', 'text', 'tspan'
];
const SVG_ALLOWED_ATTR = [
  'viewBox', 'width', 'height', 'xmlns', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'transform', 'offset',
  'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'id', 'fill-rule', 'clip-rule',
  'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-dasharray'
];
const SVG_MAX_BYTES = 100 * 1024; // ikon patut kecil — had jana-jana penyalahgunaan/DB bloat

function sanitizeSvgIcon(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('SVG kosong.');
  if (Buffer.byteLength(raw, 'utf8') > SVG_MAX_BYTES) throw new Error('Fail SVG terlalu besar (had 100KB).');
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

// ---------------------------------------------------------------------------------------------
// SPEC PLAT ILUSTRASI BIDANG
//
// Plat besar yang dipapar dalam kolum kanan Focus View apabila kolum itu benar-benar kosong.
// Berbeza sepenuhnya daripada ikon Bidang 13px — jangan muat naik ikon lucide yang dibesarkan;
// stroke setebal 2px pada kanvas 24 unit jadi nipis dan generik pada saiz bacaan.
//
//   1. Kanvas          viewBox WAJIB "0 0 256 256" (segi empat sama). Ditolak kalau lain.
//   2. Saiz akar       JANGAN letak width/height pada <svg> — CSS yang menyaiz. Kalau ada, dibuang.
//   3. Warna           guna `currentColor` sahaja. Komponen menetapkan marun Adjung; warna yang
//                      dikodkan tetap (hex/rgb) akan mengabaikannya, jadi ia ditolak.
//   4. Kawasan selamat karya dalam 224x224 di tengah (margin 16 unit) supaya ia tidak mencecah tepi.
//   5. Gaya garis      stroke-width 1.5-2 unit. Garis halus yang membuatkan plat itu senyap.
//   6. Had fail        256KB. Karya garisan terperinci memang boleh ratusan kilobait; had ini tidak
//                      membebankan muatan frontpage kerana plat TIDAK dihantar dalam senarai pukal
//                      /categories/active — ia diambil satu per satu melalui
//                      GET /categories/illustration.
//
// Tag/atribut yang dibenarkan sama seperti ikon (SVG_ALLOWED_TAGS/ATTR) — tiada <script>, tiada
// pengendali on*, tiada rujukan luar.
const ILLUSTRATION_MAX_BYTES = 256 * 1024;
const ILLUSTRATION_VIEWBOX = '0 0 256 256';

function sanitizeIllustrationSvg(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('SVG kosong.');
  if (Buffer.byteLength(raw, 'utf8') > ILLUSTRATION_MAX_BYTES) {
    throw new Error('Fail SVG terlalu besar (had 256KB untuk plat ilustrasi).');
  }

  let cleaned = sanitizeHtml(raw, {
    allowedTags: SVG_ALLOWED_TAGS,
    allowedAttributes: { '*': SVG_ALLOWED_ATTR },
    allowedSchemes: [],
    disallowedTagsMode: 'discard',
    parser: { xmlMode: true }
  }).trim();

  if (!/^<svg[\s>]/i.test(cleaned)) throw new Error('Fail bukan SVG yang sah selepas ditapis.');

  // Kanvas mesti tepat — plat dipaparkan pada saiz tetap, jadi viewBox lain bermakna karya keluar
  // daripada kedudukan yang direka atau tergantung tidak seimbang dalam kolum.
  const vb = cleaned.match(/\sviewBox\s*=\s*"([^"]*)"/i);
  const vbNorm = vb ? vb[1].trim().replace(/[\s,]+/g, ' ') : '';
  if (vbNorm !== ILLUSTRATION_VIEWBOX) {
    throw new Error(`viewBox mesti "${ILLUSTRATION_VIEWBOX}" (dapat "${vbNorm || 'tiada'}"). Lihat spec plat ilustrasi.`);
  }

  // Warna tetap mengabaikan marun yang ditetapkan komponen — plat jadi warna lain daripada portal.
  //
  // Diperiksa pada SELURUH markup termasuk tag <svg> akar. Versi pertama semakan ini melangkau tag
  // akar (sebab akar diproses berasingan untuk membuang width/height), sedangkan itulah tempat
  // paling biasa orang meletakkan stroke="#802334" — jadi ia lulus tanpa disedari.
  //
  // `fill="none"`/`stroke="none"` tidak terjejas: ia bukan warna, jadi tidak sepadan #/rgb/hsl.
  if (/(?:fill|stroke|stop-color)\s*=\s*["']?\s*(?:#|rgb|hsl)/i.test(cleaned)) {
    throw new Error('Guna currentColor sahaja untuk fill/stroke — warna tetap mengabaikan marun Adjung.');
  }

  // width/height pada akar melawan penyaizan CSS; buang senyap-senyap, bukan tolak.
  const rootTag = cleaned.slice(0, cleaned.indexOf('>') + 1);
  cleaned = rootTag.replace(/\s(?:width|height)\s*=\s*"[^"]*"/gi, '') + cleaned.slice(rootTag.length);

  return cleaned;
}

export function createCategoryRoutes(db) {
  const router = express.Router();

  // GET /api/system/categories
  router.get('/categories', async (req, res) => {
    try {
      const categories = await CategoryRegistry.getAllCategories(db);
      res.json(categories);
    } catch (err) {
      console.error('Fetch categories error:', err);
      res.status(500).json({ error: 'Failed to fetch categories.' });
    }
  });

  // POST /api/system/categories/register
  router.post('/categories/register', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Missing name parameter.' });
      const reg = await CategoryRegistry.registerCategory(db, name);
      res.json({ success: true, category: reg });
    } catch (err) {
      console.error('Register category error:', err);
      res.status(500).json({ error: 'Failed to register category.' });
    }
  });

  // POST /api/system/categories/rename
  router.post('/categories/rename', async (req, res) => {
    try {
      const { oldName, newName } = req.body;
      if (!oldName || !newName) return res.status(400).json({ error: 'Missing oldName or newName parameter.' });
      await CategoryRegistry.renameCategory(db, oldName, newName);
      res.json({ success: true });
    } catch (err) {
      console.error('Rename category error:', err);
      res.status(500).json({ error: 'Failed to rename category.' });
    }
  });

  // POST /api/system/categories/merge
  router.post('/categories/merge', async (req, res) => {
    try {
      const { sourceCategory, targetCategory } = req.body;
      if (!sourceCategory || !targetCategory) return res.status(400).json({ error: 'Missing sourceCategory or targetCategory parameter.' });
      await CategoryRegistry.mergeCategories(db, sourceCategory, targetCategory);
      res.json({ success: true });
    } catch (err) {
      console.error('Merge categories error:', err);
      res.status(500).json({ error: 'Failed to merge categories.' });
    }
  });

  // GET /api/system/categories/active — senarai Bidang tertutup (Taksonomi), setiap satu
  // disertakan nombor slot yang diperuntukkan untuknya.
  router.get('/categories/active', async (req, res) => {
    try {
      const active = await CategoryRegistry.getActiveCategories(db);
      const withSlots = await Promise.all(active.map(async (cat) => {
        // illustrationSvg SENGAJA tidak dihantar di sini. getActiveCategories buat SELECT *, dan
        // senarai ini dimuat oleh frontpage awam pada setiap muat halaman — menghantar kesemua 25
        // plat bermakna beberapa megabait markup dikirim kepada setiap pelawat sedangkan paling
        // banyak SATU plat pernah dipapar, dan itu pun cuma di dalam Focus View.
        //
        // Yang tinggal ialah bendera boolean, cukup untuk Taksonomi menunjukkan Bidang mana sudah
        // ada plat. Markup penuh diambil satu per satu melalui GET /categories/illustration/:id.
        const { illustrationSvg, ...rest } = cat;
        return {
          ...rest,
          hasIllustration: !!(illustrationSvg && String(illustrationSvg).trim()),
          slots: await CategoryRegistry.getSlotsForCategory(db, cat.name)
        };
      }));
      res.json(withSlots);
    } catch (err) {
      console.error('Fetch active categories error:', err);
      res.status(500).json({ error: 'Failed to fetch active categories.' });
    }
  });

  // POST /api/system/categories/activate — "+ Tambah Bidang" di Taksonomi (Ketua Editor sahaja,
  // dikuatkuasakan di peringkat UI — lihat TetapanConsole.tsx).
  router.post('/categories/activate', async (req, res) => {
    try {
      const { name, color, icon } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Nama Bidang diperlukan.' });
      const reg = await CategoryRegistry.activateCategory(db, name, color, icon);
      res.json({ success: true, category: reg });
    } catch (err) {
      console.error('Activate category error:', err);
      res.status(500).json({ error: err.message || 'Failed to activate category.' });
    }
  });

  // POST /api/system/categories/rename-active — tukar nama SATU baris Bidang taksonomi (tak
  // cascade ke kandungan sedia ada — lihat nota di renameActiveCategory()).
  router.post('/categories/rename-active', async (req, res) => {
    try {
      const { id, newName } = req.body;
      if (!id || !newName || !newName.trim()) return res.status(400).json({ error: 'id dan newName diperlukan.' });
      await CategoryRegistry.renameActiveCategory(db, id, newName);
      res.json({ success: true });
    } catch (err) {
      console.error('Rename active category error:', err);
      res.status(500).json({ error: err.message || 'Failed to rename category.' });
    }
  });

  // GET /api/system/categories/illustration?name=<Bidang> — markup plat SATU Bidang.
  //
  // Berasingan daripada /categories/active dengan sengaja: plat boleh ratusan kilobait, dan hanya
  // satu diperlukan pada satu-satu masa (Focus View memaparkan plat Bidang kandungan yang dibuka
  // sahaja). Menghantarnya dalam senarai pukal bermakna setiap pelawat frontpage memuat turun
  // kesemua 25 plat untuk memaparkan sifar atau satu.
  router.get('/categories/illustration', async (req, res) => {
    try {
      const name = String(req.query.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name diperlukan.' });
      const row = await CategoryRegistry.dbGet(db,
        "SELECT illustrationSvg FROM CategoryRegistry WHERE LOWER(name) = LOWER(?) AND isActive = 1", [name]);
      res.json({ illustrationSvg: (row && row.illustrationSvg) || null });
    } catch (err) {
      console.error('Fetch illustration error:', err);
      res.status(500).json({ error: 'Gagal membaca plat ilustrasi.' });
    }
  });

  // GET /api/system/categories/slot-usage — keadaan kesemua 38 slot frontpage dalam satu panggilan:
  // Bidang mana yang memilikinya, dan BERAPA kandungan live/pending ada di dalamnya.
  //
  // Kiraan itu penting, bukan hiasan: menukar Bidang sesuatu slot mengarkibkan setiap kandungan
  // approved/pending di dalamnya (archiveLiveContentInSlot). Tanpa kiraan ini, amaran sebelum
  // menyimpan cuma boleh berkata "kandungan akan diarkibkan" secara umum — dengan ia, amaran boleh
  // menyebut angka sebenar yang akan hilang daripada frontpage.
  router.get('/categories/slot-usage', async (req, res) => {
    try {
      const rows = await CategoryRegistry.dbAll(db,
        "SELECT slotIndex, manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage'");
      const counts = await CategoryRegistry.dbAll(db, `
        SELECT o.slotIndex AS slotIndex, COUNT(DISTINCT o.id) AS liveCount
        FROM editorial_objects o
        JOIN editorial_revisions r ON r.objectId = o.id AND r.status IN ('approved', 'pending')
        WHERE o.slotIndex >= 0
        GROUP BY o.slotIndex
      `);
      const bySlot = new Map(counts.map(c => [Number(c.slotIndex), Number(c.liveCount)]));
      const deskBySlot = new Map(rows.map(r => [Number(r.slotIndex), (r.manualDesk || '').trim()]));

      res.json(Array.from({ length: 38 }, (_, slotIndex) => ({
        slotIndex,
        bidang: deskBySlot.get(slotIndex) || '',
        liveCount: bySlot.get(slotIndex) || 0
      })));
    } catch (err) {
      console.error('Slot usage error:', err);
      res.status(500).json({ error: 'Gagal membaca keadaan slot.' });
    }
  });

  // POST /api/system/categories/assign-slot — arah "pilih slot untuk Bidang" dari Taksonomi.
  // SENGAJA hanya UPDATE lajur manualDesk (bukan guna POST /slots yang INSERT OR REPLACE ~30
  // lajur sekali gus dan akan kosongkan medan slot lain). bidangName kosong = nyahtetapkan slot.
  router.post('/categories/assign-slot', async (req, res) => {
    try {
      const { slotIndex, bidangName } = req.body;
      if (slotIndex === undefined || slotIndex === null || Number(slotIndex) < 0) {
        return res.status(400).json({ error: 'slotIndex tidak sah.' });
      }
      const trimmed = (bidangName || '').trim();
      if (trimmed) {
        const active = await CategoryRegistry.getActiveCategories(db);
        const match = active.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
        if (!match) {
          return res.status(400).json({ error: `Bidang "${trimmed}" bukan Bidang aktif. Pilih daripada senarai Taksonomi.` });
        }
      }

      const currentRow = await CategoryRegistry.dbGet(db, "SELECT manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slotIndex]);
      const oldDesk = (currentRow && currentRow.manualDesk) || '';

      await CategoryRegistry.dbRun(db, "UPDATE slots_config SET manualDesk = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [trimmed, slotIndex]);

      // Bidang slot betul-betul berubah — kandungan live/pending lama dalam slot ni tak lagi
      // sepadan, arkib supaya tak terus terpapar dengan Bidang yang tak sah.
      if (oldDesk.toLowerCase() !== trimmed.toLowerCase()) {
        await CategoryRegistry.archiveLiveContentInSlot(db, slotIndex);
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Assign slot error:', err);
      res.status(500).json({ error: err.message || 'Failed to assign slot.' });
    }
  });

  // POST /api/system/categories/set-icon — pilih ikon lucide-react daripada pemilih di Taksonomi.
  router.post('/categories/set-icon', async (req, res) => {
    try {
      const { id, icon } = req.body;
      if (!id || !icon) return res.status(400).json({ error: 'id dan icon diperlukan.' });
      await CategoryRegistry.setIcon(db, id, icon);
      res.json({ success: true });
    } catch (err) {
      console.error('Set icon error:', err);
      res.status(400).json({ error: err.message || 'Gagal menetapkan ikon.' });
    }
  });

  // POST /api/system/categories/set-icon-svg — muat naik ikon SVG custom (Taksonomi). Markup
  // ditapis ketat (SVG_ALLOWED_TAGS/ATTR) sebelum disimpan — jangan skip langkah ni.
  router.post('/categories/set-icon-svg', async (req, res) => {
    try {
      const { id, svg } = req.body;
      if (!id || !svg) return res.status(400).json({ error: 'id dan svg diperlukan.' });
      const cleaned = sanitizeSvgIcon(svg);
      await CategoryRegistry.setIconSvg(db, id, cleaned);
      res.json({ success: true });
    } catch (err) {
      console.error('Set icon SVG error:', err);
      res.status(400).json({ error: err.message || 'Gagal memuat naik SVG.' });
    }
  });

  // POST /api/system/categories/set-illustration-svg — muat naik plat ilustrasi Bidang.
  // Disahkan ikut spec di atas (viewBox 256x256, currentColor sahaja) DAN ditapis dengan senarai
  // putih yang sama seperti ikon. Jangan skip mana-mana daripada dua langkah itu.
  router.post('/categories/set-illustration-svg', async (req, res) => {
    try {
      const { id, svg } = req.body;
      if (!id || !svg) return res.status(400).json({ error: 'id dan svg diperlukan.' });
      const cleaned = sanitizeIllustrationSvg(svg);
      await CategoryRegistry.setIllustrationSvg(db, id, cleaned);
      res.json({ success: true });
    } catch (err) {
      console.error('Set illustration SVG error:', err);
      res.status(400).json({ error: err.message || 'Gagal memuat naik plat ilustrasi.' });
    }
  });

  // POST /api/system/categories/clear-illustration-svg — buang plat ilustrasi Bidang.
  router.post('/categories/clear-illustration-svg', async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id diperlukan.' });
      await CategoryRegistry.clearIllustrationSvg(db, id);
      res.json({ success: true });
    } catch (err) {
      console.error('Clear illustration SVG error:', err);
      res.status(400).json({ error: err.message || 'Gagal membuang plat ilustrasi.' });
    }
  });

  return router;
}
