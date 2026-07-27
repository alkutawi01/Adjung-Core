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
      const withSlots = await Promise.all(active.map(async (cat) => ({
        ...cat,
        slots: await CategoryRegistry.getSlotsForCategory(db, cat.name)
      })));
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

  return router;
}
