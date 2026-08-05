import express from 'express';
import { requirePermission } from '../middleware/auth.js';

// Penaja (2026-08-05, Fasa 12 — permintaan Izzat). Tajaan BULANAN, boleh berbilang penaja
// serentak satu bulan. Dua permukaan berasingan:
//   - Editorium (Pentadbir sahaja, kunci `manageSettings` — sama gerbang macam Direktori/
//     Tetapan/Halaman Awam, keputusan reka bentuk/perniagaan bukan editorial harian): urus
//     penuh (cipta/sunting/arkib).
//   - Awam: /public/sponsors/semasa (footer, bulan SEMASA sahaja) dan /public/sponsors/semua
//     (halaman /penaja, SEMUA penaja aktif — lama & semasa — susun bulan terbaru dahulu).
const HAD_NAMA = 100;
const bulanSemasa = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'

const barisKepadaPenaja = (r) => ({
  id: r.id,
  nama: r.name,
  logoUrl: r.logoUrl || '',
  url: r.url || '',
  bulan: r.bulan,
  tayangSemasaTransisi: r.tayangSemasaTransisi === 1,
  status: r.status,
  dikemasPada: r.updatedAt,
});

export function createSponsorRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/system/sponsors — senarai PENUH (aktif + arkib) untuk Editorium.
  router.get('/system/sponsors', requirePermission('manageSettings'), async (req, res) => {
    try {
      const rows = await dbAll('SELECT * FROM sponsors ORDER BY bulan DESC, createdAt DESC');
      res.json((rows || []).map(barisKepadaPenaja));
    } catch (err) {
      console.error('GET system/sponsors error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai penaja. ' + (err.message || '') });
    }
  });

  // POST /api/system/sponsors — cipta penaja baharu.
  router.post('/system/sponsors', requirePermission('manageSettings'), async (req, res) => {
    try {
      const { nama, logoUrl, url, bulan, tayangSemasaTransisi } = req.body || {};
      const namaBersih = String(nama || '').trim();
      const bulanBersih = String(bulan || '').trim();
      if (!namaBersih) return res.status(400).json({ error: 'Nama penaja diperlukan.' });
      if (namaBersih.length > HAD_NAMA) return res.status(400).json({ error: `Nama penaja melebihi had ${HAD_NAMA} aksara.` });
      if (!/^\d{4}-\d{2}$/.test(bulanBersih)) return res.status(400).json({ error: 'Bulan mesti format YYYY-MM.' });

      const id = `penaja-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      await dbRun(
        `INSERT INTO sponsors (id, name, logoUrl, url, bulan, tayangSemasaTransisi, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'aktif', ?, ?)`,
        [id, namaBersih, logoUrl || '', url || '', bulanBersih, tayangSemasaTransisi ? 1 : 0, now, now]
      );
      res.json({ success: true, id });
    } catch (err) {
      console.error('POST system/sponsors error:', err);
      res.status(500).json({ error: 'Gagal cipta penaja. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/sponsors/:id — sunting/arkibkan.
  router.patch('/system/sponsors/:id', requirePermission('manageSettings'), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await dbGet('SELECT id FROM sponsors WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Penaja tidak dijumpai.' });

      const { nama, logoUrl, url, bulan, tayangSemasaTransisi, status } = req.body || {};
      const sets = [];
      const params = [];
      if (nama !== undefined) {
        const namaBersih = String(nama).trim();
        if (!namaBersih) return res.status(400).json({ error: 'Nama penaja diperlukan.' });
        if (namaBersih.length > HAD_NAMA) return res.status(400).json({ error: `Nama penaja melebihi had ${HAD_NAMA} aksara.` });
        sets.push('name = ?'); params.push(namaBersih);
      }
      if (logoUrl !== undefined) { sets.push('logoUrl = ?'); params.push(logoUrl); }
      if (url !== undefined) { sets.push('url = ?'); params.push(url); }
      if (bulan !== undefined) {
        if (!/^\d{4}-\d{2}$/.test(String(bulan))) return res.status(400).json({ error: 'Bulan mesti format YYYY-MM.' });
        sets.push('bulan = ?'); params.push(bulan);
      }
      if (tayangSemasaTransisi !== undefined) { sets.push('tayangSemasaTransisi = ?'); params.push(tayangSemasaTransisi ? 1 : 0); }
      if (status !== undefined) {
        if (!['aktif', 'arkib'].includes(status)) return res.status(400).json({ error: 'Status tidak sah.' });
        sets.push('status = ?'); params.push(status);
      }
      if (sets.length === 0) return res.status(400).json({ error: 'Tiada medan untuk dikemas kini.' });
      sets.push('updatedAt = ?'); params.push(new Date().toISOString());
      params.push(id);

      await dbRun(`UPDATE sponsors SET ${sets.join(', ')} WHERE id = ?`, params);
      res.json({ success: true });
    } catch (err) {
      console.error('PATCH system/sponsors error:', err);
      res.status(500).json({ error: 'Gagal kemas kini penaja. ' + (err.message || '') });
    }
  });

  // GET /api/public/sponsors/semasa — laluan AWAM, footer. Bulan SEMASA + status aktif sahaja.
  router.get('/public/sponsors/semasa', async (req, res) => {
    try {
      const rows = await dbAll(
        "SELECT * FROM sponsors WHERE bulan = ? AND status = 'aktif' ORDER BY createdAt ASC",
        [bulanSemasa()]
      );
      res.json((rows || []).map(barisKepadaPenaja));
    } catch (err) {
      console.error('GET public/sponsors/semasa error:', err);
      res.status(500).json({ error: 'Gagal membaca penaja semasa. ' + (err.message || '') });
    }
  });

  // GET /api/public/sponsors/semua — laluan AWAM, halaman /penaja. SEMUA penaja aktif (lama +
  // semasa), susun bulan terbaru dahulu.
  router.get('/public/sponsors/semua', async (req, res) => {
    try {
      const rows = await dbAll(
        "SELECT * FROM sponsors WHERE status = 'aktif' ORDER BY bulan DESC, createdAt ASC"
      );
      res.json((rows || []).map(barisKepadaPenaja));
    } catch (err) {
      console.error('GET public/sponsors/semua error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai penaja. ' + (err.message || '') });
    }
  });

  return router;
}
