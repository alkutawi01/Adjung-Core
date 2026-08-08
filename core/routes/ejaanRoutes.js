import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

// Penyelarasan Ejaan (2026-08-02, Fasa 8) — dipisahkan daripada Glosari (glosariRoutes.js), yang
// sebelum ini bergabung dalam satu jadual `glosari_istilah` (istilah + elakkan + maksud) walaupun
// dua tujuan berbeza: glosari ialah rujukan definisi istilah, penyelarasan ejaan ialah pasangan
// bentuk betul vs bentuk dielakkan.
//
// SAMA seperti Glosari — ini RUJUKAN PASIF untuk editor menulis manual, BUKAN penapis automatik.
// Ia TIDAK mengubah/menulis-ganti kandungan editorial yang sudah tersimpan atau kandungan RSS masuk;
// itu jenis perubahan yang peraturan projek ni larang keras tanpa kelulusan eksplisit pemilik projek
// (lihat CLAUDE.md). Kalau kelak mahu dijadikan penapis automatik, itu keputusan produk berasingan.
//
//   betul     — bentuk ejaan yang betul/piawai (contoh: "kerana")
//   elakkan   — bentuk yang kerap tersilap tulis, boleh kosong (contoh: "kerena, krn")
//   catatan   — nota ringkas, boleh kosong
const HAD_BETUL = 80;
const HAD_ELAKKAN = 120;
const HAD_CATATAN = 400;

export function createEjaanRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  const barisKepadaEntri = (r) => ({
    id: r.id,
    betul: r.betul,
    elakkan: r.elakkan || '',
    catatan: r.catatan || '',
    dibuatPada: r.createdAt,
  });

  router.get('/ejaan', async (req, res) => {
    try {
      const rows = await dbAll('SELECT * FROM ejaan_piawai ORDER BY betul COLLATE NOCASE ASC');
      res.json((rows || []).map(barisKepadaEntri));
    } catch (err) {
      console.error('GET ejaan error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai ejaan. ' + (err.message || '') });
    }
  });

  router.post('/ejaan', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const betul = (req.body?.betul || '').trim();
      const elakkan = (req.body?.elakkan || '').trim();
      const catatan = (req.body?.catatan || '').trim();

      if (!betul) return res.status(400).json({ error: 'Bentuk betul wajib diisi.' });
      if (betul.length > HAD_BETUL) return res.status(400).json({ error: `Bentuk betul tidak boleh melebihi ${HAD_BETUL} aksara.` });
      if (elakkan.length > HAD_ELAKKAN) return res.status(400).json({ error: `Senarai "elakkan" tidak boleh melebihi ${HAD_ELAKKAN} aksara.` });
      if (catatan.length > HAD_CATATAN) return res.status(400).json({ error: `Catatan tidak boleh melebihi ${HAD_CATATAN} aksara.` });

      // Satu bentuk betul satu entri — kalau tidak, dua baris bercanggah boleh wujud dan senarai
      // berhenti menjadi rujukan yang boleh dipercayai.
      const sedia = await dbGet('SELECT id FROM ejaan_piawai WHERE LOWER(betul) = LOWER(?)', [betul]);
      if (sedia) return res.status(400).json({ error: `Bentuk "${betul}" sudah ada dalam senarai ejaan.` });

      const id = `ejn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await dbRun(
        'INSERT INTO ejaan_piawai (id, betul, elakkan, catatan, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, betul, elakkan, catatan, new Date().toISOString()]
      );
      const baris = await dbGet('SELECT * FROM ejaan_piawai WHERE id = ?', [id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'tambah-ejaan-piawai',
        targetType: 'ejaan',
        targetId: id,
        detail: betul,
      });
      res.json({ success: true, entri: barisKepadaEntri(baris) });
    } catch (err) {
      console.error('POST ejaan error:', err);
      res.status(500).json({ error: 'Gagal menyimpan bentuk ejaan. ' + (err.message || '') });
    }
  });

  router.patch('/ejaan/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const sedia = await dbGet('SELECT id FROM ejaan_piawai WHERE id = ?', [req.params.id]);
      if (!sedia) return res.status(404).json({ error: 'Bentuk ejaan tidak dijumpai.' });

      const betul = (req.body?.betul || '').trim();
      const elakkan = (req.body?.elakkan || '').trim();
      const catatan = (req.body?.catatan || '').trim();

      if (!betul) return res.status(400).json({ error: 'Bentuk betul wajib diisi.' });
      if (betul.length > HAD_BETUL) return res.status(400).json({ error: `Bentuk betul tidak boleh melebihi ${HAD_BETUL} aksara.` });
      if (elakkan.length > HAD_ELAKKAN) return res.status(400).json({ error: `Senarai "elakkan" tidak boleh melebihi ${HAD_ELAKKAN} aksara.` });
      if (catatan.length > HAD_CATATAN) return res.status(400).json({ error: `Catatan tidak boleh melebihi ${HAD_CATATAN} aksara.` });

      const pertindihan = await dbGet('SELECT id FROM ejaan_piawai WHERE LOWER(betul) = LOWER(?) AND id != ?', [betul, req.params.id]);
      if (pertindihan) return res.status(400).json({ error: `Bentuk "${betul}" sudah ada dalam senarai ejaan.` });

      await dbRun(
        'UPDATE ejaan_piawai SET betul = ?, elakkan = ?, catatan = ? WHERE id = ?',
        [betul, elakkan, catatan, req.params.id]
      );
      const baris = await dbGet('SELECT * FROM ejaan_piawai WHERE id = ?', [req.params.id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'sunting-ejaan-piawai',
        targetType: 'ejaan',
        targetId: req.params.id,
        detail: betul,
      });
      res.json({ success: true, entri: barisKepadaEntri(baris) });
    } catch (err) {
      console.error('PATCH ejaan error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini bentuk ejaan. ' + (err.message || '') });
    }
  });

  router.delete('/ejaan/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const sedia = await dbGet('SELECT id FROM ejaan_piawai WHERE id = ?', [req.params.id]);
      if (!sedia) return res.status(404).json({ error: 'Bentuk ejaan tidak dijumpai.' });
      await dbRun('DELETE FROM ejaan_piawai WHERE id = ?', [req.params.id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'padam-ejaan-piawai',
        targetType: 'ejaan',
        targetId: req.params.id,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE ejaan error:', err);
      res.status(500).json({ error: 'Gagal memadam bentuk ejaan. ' + (err.message || '') });
    }
  });

  return router;
}

export default createEjaanRoutes;
