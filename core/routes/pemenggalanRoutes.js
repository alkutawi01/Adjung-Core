import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

// Pengecualian Pemenggalan Suku Kata (2026-08-16, arahan terus Izzat) — "sistem yg dah ada dah
// betul, cuma saya nak sistem benarkan editor buat apa2 pengecualian, jika editor rasa perlu.
// dia mcm autocorrect. jadi editor just masuk dlm modul baru (kalau belum ada), dan tambah dalam
// list: pentadbiran: pen-tad-bir-an, dan sistem automatik guna pemenggalan tu."
//
// Peluasan kepada core/editorial/PemenggalSukuKata.js (algoritma (K)(K)V(K) deterministik sedia
// ada) — BUKAN gantian. Editor tambah pasangan perkataan+corak di sini, engine periksa peta ni
// DAHULU sebelum jatuh balik ke algoritma. Sama seperti ejaanRoutes.js/glosariRoutes.js: rujukan
// PASIF diurus editor, GET awam (dibaca modul awam FrontpageView.tsx untuk hidrat cache
// dalam-modul via setPemenggalanPengecualian()), tulis digerbang requirePermission.
//
//   perkataan — kata dasar/terbitan yang mahu dipenggal secara khusus (contoh: "pentadbiran")
//   corak     — bentuk bersempang (contoh: "pen-tad-bir-an") — sempang dibuang MESTI sepadan
//               tepat perkataan (huruf kecil), jika tidak sisipan sempang akan rosakkan teks
//               editorial sebenar apabila dipaparkan — DITOLAK di sini (400), bukan disimpan
//               lalu gagal senyap semasa paparan.
const HAD_PERKATAAN = 60;
const HAD_CORAK = 90;

const corakSahUntukPerkataan = (perkataan, corak) => {
  if (!corak.includes('-')) return false;
  const segmen = corak.split('-');
  if (segmen.some((s) => s.length === 0)) return false;
  return segmen.join('').toLowerCase() === perkataan.toLowerCase();
};

export function createPemenggalanRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  const barisKepadaEntri = (r) => ({
    id: r.id,
    perkataan: r.perkataan,
    corak: r.corak,
    dibuatPada: r.createdAt,
  });

  router.get('/pemenggalan-pengecualian', async (req, res) => {
    try {
      const rows = await dbAll('SELECT * FROM pemenggalan_pengecualian ORDER BY perkataan COLLATE NOCASE ASC');
      res.json((rows || []).map(barisKepadaEntri));
    } catch (err) {
      console.error('GET pemenggalan-pengecualian error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai pengecualian pemenggalan. ' + (err.message || '') });
    }
  });

  router.post('/pemenggalan-pengecualian', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const perkataan = (req.body?.perkataan || '').trim();
      const corak = (req.body?.corak || '').trim().toLowerCase();

      if (!perkataan) return res.status(400).json({ error: 'Perkataan wajib diisi.' });
      if (perkataan.length > HAD_PERKATAAN) return res.status(400).json({ error: `Perkataan tidak boleh melebihi ${HAD_PERKATAAN} aksara.` });
      if (!corak) return res.status(400).json({ error: 'Corak pemenggalan wajib diisi (contoh: pen-tad-bir-an).' });
      if (corak.length > HAD_CORAK) return res.status(400).json({ error: `Corak tidak boleh melebihi ${HAD_CORAK} aksara.` });
      if (!corakSahUntukPerkataan(perkataan, corak)) {
        return res.status(400).json({ error: `Corak "${corak}" (sempang dibuang) mesti sepadan tepat dengan perkataan "${perkataan}".` });
      }

      // Satu perkataan satu entri — dua corak bercanggah untuk perkataan sama tak bermakna.
      const sedia = await dbGet('SELECT id FROM pemenggalan_pengecualian WHERE LOWER(perkataan) = LOWER(?)', [perkataan]);
      if (sedia) return res.status(400).json({ error: `Perkataan "${perkataan}" sudah ada dalam senarai pengecualian.` });

      const id = `pmg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await dbRun(
        'INSERT INTO pemenggalan_pengecualian (id, perkataan, corak, createdBy, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, perkataan, corak, req.session?.user?.username || null, new Date().toISOString()]
      );
      const baris = await dbGet('SELECT * FROM pemenggalan_pengecualian WHERE id = ?', [id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'tambah-pengecualian-pemenggalan',
        targetType: 'pemenggalan',
        targetId: id,
        detail: `${perkataan}: ${corak}`,
      });
      res.json({ success: true, entri: barisKepadaEntri(baris) });
    } catch (err) {
      console.error('POST pemenggalan-pengecualian error:', err);
      res.status(500).json({ error: 'Gagal menyimpan pengecualian pemenggalan. ' + (err.message || '') });
    }
  });

  router.patch('/pemenggalan-pengecualian/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const sedia = await dbGet('SELECT id FROM pemenggalan_pengecualian WHERE id = ?', [req.params.id]);
      if (!sedia) return res.status(404).json({ error: 'Pengecualian pemenggalan tidak dijumpai.' });

      const perkataan = (req.body?.perkataan || '').trim();
      const corak = (req.body?.corak || '').trim().toLowerCase();

      if (!perkataan) return res.status(400).json({ error: 'Perkataan wajib diisi.' });
      if (perkataan.length > HAD_PERKATAAN) return res.status(400).json({ error: `Perkataan tidak boleh melebihi ${HAD_PERKATAAN} aksara.` });
      if (!corak) return res.status(400).json({ error: 'Corak pemenggalan wajib diisi (contoh: pen-tad-bir-an).' });
      if (corak.length > HAD_CORAK) return res.status(400).json({ error: `Corak tidak boleh melebihi ${HAD_CORAK} aksara.` });
      if (!corakSahUntukPerkataan(perkataan, corak)) {
        return res.status(400).json({ error: `Corak "${corak}" (sempang dibuang) mesti sepadan tepat dengan perkataan "${perkataan}".` });
      }

      const pertindihan = await dbGet('SELECT id FROM pemenggalan_pengecualian WHERE LOWER(perkataan) = LOWER(?) AND id != ?', [perkataan, req.params.id]);
      if (pertindihan) return res.status(400).json({ error: `Perkataan "${perkataan}" sudah ada dalam senarai pengecualian.` });

      await dbRun(
        'UPDATE pemenggalan_pengecualian SET perkataan = ?, corak = ? WHERE id = ?',
        [perkataan, corak, req.params.id]
      );
      const baris = await dbGet('SELECT * FROM pemenggalan_pengecualian WHERE id = ?', [req.params.id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'sunting-pengecualian-pemenggalan',
        targetType: 'pemenggalan',
        targetId: req.params.id,
        detail: `${perkataan}: ${corak}`,
      });
      res.json({ success: true, entri: barisKepadaEntri(baris) });
    } catch (err) {
      console.error('PATCH pemenggalan-pengecualian error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini pengecualian pemenggalan. ' + (err.message || '') });
    }
  });

  router.delete('/pemenggalan-pengecualian/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const sedia = await dbGet('SELECT id FROM pemenggalan_pengecualian WHERE id = ?', [req.params.id]);
      if (!sedia) return res.status(404).json({ error: 'Pengecualian pemenggalan tidak dijumpai.' });
      await dbRun('DELETE FROM pemenggalan_pengecualian WHERE id = ?', [req.params.id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'padam-pengecualian-pemenggalan',
        targetType: 'pemenggalan',
        targetId: req.params.id,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE pemenggalan-pengecualian error:', err);
      res.status(500).json({ error: 'Gagal memadam pengecualian pemenggalan. ' + (err.message || '') });
    }
  });

  return router;
}

export default createPemenggalanRoutes;
