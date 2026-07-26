import express from 'express';
import CategoryRegistry from '../category/CategoryRegistry.js';

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
      const { name, color } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Nama Bidang diperlukan.' });
      const reg = await CategoryRegistry.activateCategory(db, name, color);
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

  return router;
}
