import express from 'express';

// Glosari & Penyelarasan Ejaan (2026-08-01, spesifikasi pemilik projek) — senarai rujukan istilah
// untuk pasukan editorial: bentuk yang DIPILIH bagi sesuatu istilah, berbanding bentuk yang kerap
// tersilap tulis.
//
// Ia SENGAJA rujukan, bukan penapis automatik. Ia TIDAK mengubah kandungan editorial yang sudah
// ditulis — menulis-ganti teks editor secara automatik ialah perkara yang peraturan projek ni
// larang keras. Enjin autocondong (adjung_typography_rules) mengubah PAPARAN sahaja dan itu perkara
// berasingan; glosari di sini menjawab "kita eja begini, bukan begitu" untuk rujukan manusia.
//
//   istilah   — bentuk yang DIPILIH (contoh: "pautan")
//   elakkan   — bentuk yang patut dielakkan, boleh kosong (contoh: "link")
//   maksud    — penjelasan ringkas/nota penggunaan, boleh kosong
const HAD_ISTILAH = 80;
const HAD_ELAKKAN = 120;
const HAD_MAKSUD = 400;

export function createGlosariRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  const barisKepadaEntri = (r) => ({
    id: r.id,
    istilah: r.istilah,
    elakkan: r.elakkan || '',
    maksud: r.maksud || '',
    dibuatPada: r.createdAt,
  });

  router.get('/glosari', async (req, res) => {
    try {
      const rows = await dbAll('SELECT * FROM glosari_istilah ORDER BY istilah COLLATE NOCASE ASC');
      res.json((rows || []).map(barisKepadaEntri));
    } catch (err) {
      console.error('GET glosari error:', err);
      res.status(500).json({ error: 'Gagal membaca glosari. ' + (err.message || '') });
    }
  });

  router.post('/glosari', async (req, res) => {
    try {
      const istilah = (req.body?.istilah || '').trim();
      const elakkan = (req.body?.elakkan || '').trim();
      const maksud = (req.body?.maksud || '').trim();

      if (!istilah) return res.status(400).json({ error: 'Istilah wajib diisi.' });
      if (istilah.length > HAD_ISTILAH) return res.status(400).json({ error: `Istilah tidak boleh melebihi ${HAD_ISTILAH} aksara.` });
      if (elakkan.length > HAD_ELAKKAN) return res.status(400).json({ error: `Senarai "elakkan" tidak boleh melebihi ${HAD_ELAKKAN} aksara.` });
      if (maksud.length > HAD_MAKSUD) return res.status(400).json({ error: `Maksud tidak boleh melebihi ${HAD_MAKSUD} aksara.` });

      // Satu istilah satu entri — kalau tidak, dua baris bercanggah boleh wujud dan glosari berhenti
      // menjadi rujukan yang boleh dipercayai.
      const sedia = await dbGet('SELECT id FROM glosari_istilah WHERE LOWER(istilah) = LOWER(?)', [istilah]);
      if (sedia) return res.status(400).json({ error: `Istilah "${istilah}" sudah ada dalam glosari.` });

      const id = `glo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await dbRun(
        'INSERT INTO glosari_istilah (id, istilah, elakkan, maksud, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, istilah, elakkan, maksud, new Date().toISOString()]
      );
      const baris = await dbGet('SELECT * FROM glosari_istilah WHERE id = ?', [id]);
      res.json({ success: true, entri: barisKepadaEntri(baris) });
    } catch (err) {
      console.error('POST glosari error:', err);
      res.status(500).json({ error: 'Gagal menyimpan istilah. ' + (err.message || '') });
    }
  });

  router.delete('/glosari/:id', async (req, res) => {
    try {
      const sedia = await dbGet('SELECT id FROM glosari_istilah WHERE id = ?', [req.params.id]);
      if (!sedia) return res.status(404).json({ error: 'Istilah tidak dijumpai.' });
      await dbRun('DELETE FROM glosari_istilah WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE glosari error:', err);
      res.status(500).json({ error: 'Gagal memadam istilah. ' + (err.message || '') });
    }
  });

  return router;
}

export default createGlosariRoutes;
