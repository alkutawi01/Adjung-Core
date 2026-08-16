import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

// Glosari (2026-08-01; tujuannya berubah 2026-08-07) — istilah dan maksudnya, DIPAPARKAN kepada
// pembaca sebagai tooltip hover pada kandungan sebenar. Lihat src/components/common/
// IstilahGlosari.tsx: kali pertama sesuatu istilah muncul dalam tajuk/huraian sebuah artikel,
// istilah itu digaris putus-putus dan maksudnya dipapar sebagai tooltip.
//
// Ia tetap TIDAK menulis-ganti kandungan editorial yang sudah ditulis — ia cuma membalut istilah
// pada masa PAPARAN, sama konsep dengan enjin autocondong (adjung_typography_rules). Teks sebenar
// dalam pangkalan data tidak pernah disentuh.
//
// Asalnya ini rujukan PASIF untuk pasukan editorial sahaja (dibaca manusia di Editorium, tidak
// pernah menyentuh apa pembaca nampak). Sebab itu `maksud` dahulu boleh kosong. Sejak ia menjadi
// tooltip pembaca, entri TANPA maksud tidak melakukan apa-apa langsung — binaPetaGlosari()
// melangkaunya terus — jadi ia kini WAJIB, jika tidak ia cuma data mati.
//
//   istilah   — bentuk yang DIPILIH (contoh: "pautan")
//   maksud    — penjelasan untuk pembaca. Sejak Glosari Berasaskan Bidang (2026-08-16, di bawah)
//               ni FALLBACK PALING AKHIR (bukan lagi satu-satunya definisi) — dipaparkan TANPA
//               label Bidang, cuma bila istilah tu langsung tiada Sense am/khusus sepadan.
//   elakkan   — WARISAN, tidak lagi dihantar oleh borang Glosari. Bentuk ejaan betul berbanding
//               bentuk dielakkan kini ada jadual sendiri (`ejaan_piawai`, core/routes/ejaanRoutes.js,
//               tab "Penyelarasan Ejaan"). Lajur dikekalkan kerana baris lama mungkin masih mengisinya.
//
// Glosari Berasaskan Bidang — Sense (2026-08-16, arahan Izzat, seni bina disahkan
// docs/glossary-architecture-proposal.md v3) — satu istilah kini boleh ada BANYAK Sense:
//   glosari_sense        — satu takrifan. amSense=1 (AM, tiada Bidang) ATAU amSense=0 (KHUSUS,
//                           WAJIB >=1 Bidang). Peraturan resolusi tooltip (IstilahGlosari.tsx):
//                           Sense khusus sepadan Bidang kandungan > Sense am > `maksud` (di atas)
//                           > tiada tooltip. Label "(Bidang)" HANYA dipaparkan bila Sense KHUSUS
//                           digunakan — Sense am dan `maksud` fallback KEDUA-DUANYA tiada label.
//   glosari_sense_bidang  — perkaitan Sense<->Bidang (categoryId = CategoryRegistry.id, kunci
//                           STABIL; kandungan sendiri simpan NAMA Bidang, resolusi guna slug —
//                           lihat fungsi resolusiSlugKeCategoryId di bawah).
//
// Invariant (dikuatkuasakan di sini, bukan hanya didoumentasikan):
//   1. Maksimum SATU Sense am setiap istilah — PERINGKAT DB (unique index separa, server.js).
//   2. Sense am (amSense=1) MESTI SIFAR Bidang — disahkan di sini sebelum INSERT/UPDATE.
//   3. Sense khusus (amSense=0) MESTI >=1 Bidang — disahkan di sini sebelum INSERT/UPDATE.
//   4. Satu Bidang tak boleh terikat DUA Sense khusus bagi istilah SAMA — disahkan di sini
//      (semak silang SEMUA Sense sedia ada bagi istilahId yang sama, bukan boleh jadi constraint
//      SQL tunggal sebab perlu skop kepada istilahId, bukan categoryId sahaja).
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

  // GET /glosari — elak N+1 (2026-08-16): DUA query pukal sahaja (senses + perkaitan Bidang),
  // digabung dalam memori ikut istilahId/senseId, tak kira berapa banyak istilah/Sense wujud.
  router.get('/glosari', async (req, res) => {
    try {
      const istilahRows = await dbAll('SELECT * FROM glosari_istilah ORDER BY istilah COLLATE NOCASE ASC');
      const senseRows = await dbAll('SELECT * FROM glosari_sense ORDER BY createdAt ASC');
      // JOIN terus ke CategoryRegistry supaya `slug`/`name` semasa (bukan nama lapuk yang
      // mungkin tersimpan di tempat lain) sedia untuk resolusi client-side (IstilahGlosari.tsx).
      const bidangRows = await dbAll(`
        SELECT gsb.senseId, cr.id AS categoryId, cr.name, cr.slug
        FROM glosari_sense_bidang gsb
        JOIN CategoryRegistry cr ON cr.id = gsb.categoryId
      `);

      const bidangBySense = {};
      for (const b of bidangRows) {
        (bidangBySense[b.senseId] = bidangBySense[b.senseId] || []).push({ id: b.categoryId, name: b.name, slug: b.slug });
      }
      const sensesByIstilah = {};
      for (const s of senseRows) {
        (sensesByIstilah[s.istilahId] = sensesByIstilah[s.istilahId] || []).push({
          id: s.id,
          definisi: s.definisi,
          amSense: s.amSense === 1,
          bidang: bidangBySense[s.id] || [],
        });
      }

      res.json(istilahRows.map((r) => ({ ...barisKepadaEntri(r), senses: sensesByIstilah[r.id] || [] })));
    } catch (err) {
      console.error('GET glosari error:', err);
      res.status(500).json({ error: 'Gagal membaca glosari. ' + (err.message || '') });
    }
  });

  router.post('/glosari', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const istilah = (req.body?.istilah || '').trim();
      const elakkan = (req.body?.elakkan || '').trim();
      const maksud = (req.body?.maksud || '').trim();
      // senseAwal (2026-08-16, permintaan Izzat) — borang "Tambah Istilah" kini cipta istilah
      // DAN Sense pertamanya SERENTAK (satu langkah), bukan dua langkah berasingan (dahulu:
      // cipta istilah dgn `maksud` wajib, kemudian buka "Urus Sense" berasingan untuk Sense
      // sebenar). { definisi, amSense, bidangIds } — bentuk SAMA seperti body POST
      // /glosari/:istilahId/sense di bawah.
      const senseAwal = req.body?.senseAwal;

      if (!istilah) return res.status(400).json({ error: 'Istilah wajib diisi.' });
      if (istilah.length > HAD_ISTILAH) return res.status(400).json({ error: `Istilah tidak boleh melebihi ${HAD_ISTILAH} aksara.` });
      if (elakkan.length > HAD_ELAKKAN) return res.status(400).json({ error: `Senarai "elakkan" tidak boleh melebihi ${HAD_ELAKKAN} aksara.` });
      if (maksud.length > HAD_MAKSUD) return res.status(400).json({ error: `Maksud tidak boleh melebihi ${HAD_MAKSUD} aksara.` });

      // Maksud (fallback warisan) tak lagi wajib sejak Sense wujud (2026-08-16) — tapi istilah
      // MESTI ada sekurang-kurangnya SATU sumber definisi (maksud ATAU senseAwal sah), jika tidak
      // ia data mati (binaPetaGlosari(), IstilahGlosari.tsx, melangkau terus entri sebegini).
      let senseDefinisi = '', senseAmSense = false, senseBidangIds = [];
      if (senseAwal) {
        senseDefinisi = (senseAwal.definisi || '').trim();
        senseAmSense = !!senseAwal.amSense;
        senseBidangIds = Array.isArray(senseAwal.bidangIds) ? senseAwal.bidangIds.filter(Boolean) : [];
        if (!senseDefinisi) return res.status(400).json({ error: 'Huraian makna wajib diisi.' });
        if (senseDefinisi.length > HAD_MAKSUD) return res.status(400).json({ error: `Huraian makna tidak boleh melebihi ${HAD_MAKSUD} aksara.` });
      } else if (!maksud) {
        return res.status(400).json({ error: 'Maksud wajib diisi. Tanpanya istilah tidak akan dipaparkan kepada pembaca.' });
      }

      // Satu istilah satu entri — kalau tidak, dua baris bercanggah boleh wujud dan glosari berhenti
      // menjadi rujukan yang boleh dipercayai.
      const sedia = await dbGet('SELECT id FROM glosari_istilah WHERE LOWER(istilah) = LOWER(?)', [istilah]);
      if (sedia) return res.status(400).json({ error: `Istilah "${istilah}" sudah ada dalam glosari.` });

      // Sahkan invariant Sense SEBELUM transaksi bermula (bukan selepas INSERT istilah) supaya
      // ralat pengesahan pulang sebagai 400 biasa, bukan tertangkap sebagai ralat 500 generik
      // dalam blok cuba/tangkap transaksi di bawah. `istilahId` di sini belum wujud lagi dalam DB
      // — tak mengapa, sahkanInvariantSense() cuma cari Sense SEDIA ADA bagi istilahId tu (tiada,
      // sebab istilah baharu) dan sahkan Bidang wujud dalam CategoryRegistry (tak bergantung
      // istilah wujud).
      const id = `glo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (senseAwal) {
        const ralatInvariant = await sahkanInvariantSense(dbAll, dbGet, { istilahId: id, amSense: senseAmSense, bidangIds: senseBidangIds });
        if (ralatInvariant) return res.status(400).json({ error: ralatInvariant });
      }

      const now = new Date().toISOString();
      let senseId = null;
      await dbRun('BEGIN TRANSACTION');
      try {
        await dbRun(
          'INSERT INTO glosari_istilah (id, istilah, elakkan, maksud, createdAt) VALUES (?, ?, ?, ?, ?)',
          [id, istilah, elakkan, maksud, now]
        );
        if (senseAwal) {
          senseId = `gsn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await dbRun(
            'INSERT INTO glosari_sense (id, istilahId, definisi, amSense, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            [senseId, id, senseDefinisi, senseAmSense ? 1 : 0, now, now]
          );
          for (const categoryId of senseBidangIds) {
            await dbRun('INSERT INTO glosari_sense_bidang (senseId, categoryId) VALUES (?, ?)', [senseId, categoryId]);
          }
        }
        await dbRun('COMMIT');
      } catch (e) {
        try { await dbRun('ROLLBACK'); } catch (rollbackErr) { console.error('Rollback gagal (cipta istilah+Sense):', rollbackErr.message); }
        throw e;
      }

      const baris = await dbGet('SELECT * FROM glosari_istilah WHERE id = ?', [id]);
      const bidangPenuh = senseBidangIds.length
        ? await dbAll(`SELECT id, name, slug FROM CategoryRegistry WHERE id IN (${senseBidangIds.map(() => '?').join(',')})`, senseBidangIds)
        : [];
      const senses = senseId ? [{ id: senseId, definisi: senseDefinisi, amSense: senseAmSense, bidang: bidangPenuh }] : [];

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'tambah-glosari',
        targetType: 'glosari',
        targetId: id,
        detail: istilah,
      });
      res.json({ success: true, entri: { ...barisKepadaEntri(baris), senses } });
    } catch (err) {
      console.error('POST glosari error:', err);
      res.status(500).json({ error: 'Gagal menyimpan istilah. ' + (err.message || '') });
    }
  });

  router.delete('/glosari/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const sedia = await dbGet('SELECT id FROM glosari_istilah WHERE id = ?', [req.params.id]);
      if (!sedia) return res.status(404).json({ error: 'Istilah tidak dijumpai.' });
      // ON DELETE CASCADE (server.js, jadual glosari_sense) padam semua Sense + perkaitan Bidang
      // istilah ni serentak — tiada DELETE tambahan diperlukan di sini.
      await dbRun('DELETE FROM glosari_istilah WHERE id = ?', [req.params.id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'padam-glosari',
        targetType: 'glosari',
        targetId: req.params.id,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE glosari error:', err);
      res.status(500).json({ error: 'Gagal memadam istilah. ' + (err.message || '') });
    }
  });

  // ── Sense (Glosari Berasaskan Bidang) ──────────────────────────────────────────────────

  /** Sahkan invariant 2/3/4 (lihat nota kepala fail) untuk satu Sense akan-disimpan.
   *  `abaikanSenseId` — semasa PATCH, kecualikan Sense semasa sendiri drpd semakan pertindihan
   *  Bidang (elak Sense "bertindih dengan dirinya sendiri" apabila Bidangnya tak berubah). */
  async function sahkanInvariantSense(dbAll, dbGet, { istilahId, amSense, bidangIds, senseId: abaikanSenseId }) {
    if (amSense) {
      if (bidangIds.length > 0) {
        return 'Sense am tidak boleh dikaitkan dengan mana-mana Bidang — buang pilihan Bidang, atau tukar kepada "Khusus Bidang".';
      }
      const senseAmSedia = await dbGet(
        'SELECT id FROM glosari_sense WHERE istilahId = ? AND amSense = 1' + (abaikanSenseId ? ' AND id != ?' : ''),
        abaikanSenseId ? [istilahId, abaikanSenseId] : [istilahId]
      );
      if (senseAmSedia) {
        return 'Istilah ini sudah ada Sense am. Satu istilah cuma boleh ada SATU Sense am — sunting Sense am sedia ada, jangan cipta baharu.';
      }
    } else {
      if (bidangIds.length === 0) {
        return 'Sense khusus Bidang mesti dikaitkan dengan sekurang-kurangnya satu Bidang.';
      }
      const bidangSah = await dbAll(
        `SELECT id, name FROM CategoryRegistry WHERE id IN (${bidangIds.map(() => '?').join(',')})`,
        bidangIds
      );
      if (bidangSah.length !== bidangIds.length) {
        return 'Satu atau lebih Bidang yang dipilih tidak wujud. Pilih semula daripada senarai Bidang aktif.';
      }
      const senseLain = await dbAll(
        'SELECT id FROM glosari_sense WHERE istilahId = ? AND amSense = 0' + (abaikanSenseId ? ' AND id != ?' : ''),
        abaikanSenseId ? [istilahId, abaikanSenseId] : [istilahId]
      );
      if (senseLain.length > 0) {
        const idLain = senseLain.map((s) => s.id);
        const bidangTerikat = await dbAll(
          `SELECT gsb.categoryId, cr.name FROM glosari_sense_bidang gsb
           JOIN CategoryRegistry cr ON cr.id = gsb.categoryId
           WHERE gsb.senseId IN (${idLain.map(() => '?').join(',')})`,
          idLain
        );
        const bertindih = bidangSah.filter((b) => bidangTerikat.some((t) => t.categoryId === b.id));
        if (bertindih.length > 0) {
          return `Bidang "${bertindih.map((b) => b.name).join('", "')}" sudah terikat Sense lain bagi istilah ini. Satu istilah cuma boleh ada SATU Sense khusus setiap Bidang.`;
        }
      }
    }
    return null;
  }

  router.post('/glosari/:istilahId/sense', requirePermission('manageEditorial'), async (req, res) => {
    const { istilahId } = req.params;
    try {
      const istilahRow = await dbGet('SELECT id FROM glosari_istilah WHERE id = ?', [istilahId]);
      if (!istilahRow) return res.status(404).json({ error: 'Istilah tidak dijumpai.' });

      const definisi = (req.body?.definisi || '').trim();
      const amSense = !!req.body?.amSense;
      const bidangIds = Array.isArray(req.body?.bidangIds) ? req.body.bidangIds.filter(Boolean) : [];

      if (!definisi) return res.status(400).json({ error: 'Definisi Sense wajib diisi.' });
      if (definisi.length > HAD_MAKSUD) return res.status(400).json({ error: `Definisi tidak boleh melebihi ${HAD_MAKSUD} aksara.` });

      const ralatInvariant = await sahkanInvariantSense(dbAll, dbGet, { istilahId, amSense, bidangIds });
      if (ralatInvariant) return res.status(400).json({ error: ralatInvariant });

      const id = `gsn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();

      await dbRun('BEGIN TRANSACTION');
      try {
        await dbRun(
          'INSERT INTO glosari_sense (id, istilahId, definisi, amSense, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          [id, istilahId, definisi, amSense ? 1 : 0, now, now]
        );
        for (const categoryId of bidangIds) {
          await dbRun('INSERT INTO glosari_sense_bidang (senseId, categoryId) VALUES (?, ?)', [id, categoryId]);
        }
        await dbRun('COMMIT');
      } catch (e) {
        try { await dbRun('ROLLBACK'); } catch (rollbackErr) { console.error('Rollback gagal (cipta Sense):', rollbackErr.message); }
        throw e;
      }

      const bidangPenuh = bidangIds.length
        ? await dbAll(`SELECT id, name, slug FROM CategoryRegistry WHERE id IN (${bidangIds.map(() => '?').join(',')})`, bidangIds)
        : [];

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'tambah-sense-glosari',
        targetType: 'glosari-sense',
        targetId: id,
        detail: amSense ? `${istilahId}: Sense am` : `${istilahId}: Sense khusus (${bidangPenuh.map((b) => b.name).join(', ')})`,
      });

      res.json({ success: true, sense: { id, definisi, amSense, bidang: bidangPenuh } });
    } catch (err) {
      console.error('POST glosari sense error:', err);
      res.status(500).json({ error: 'Gagal menyimpan Sense. ' + (err.message || '') });
    }
  });

  router.patch('/glosari/sense/:senseId', requirePermission('manageEditorial'), async (req, res) => {
    const { senseId } = req.params;
    try {
      const senseRow = await dbGet('SELECT * FROM glosari_sense WHERE id = ?', [senseId]);
      if (!senseRow) return res.status(404).json({ error: 'Sense tidak dijumpai.' });

      const definisi = (req.body?.definisi || '').trim();
      const amSense = !!req.body?.amSense;
      const bidangIds = Array.isArray(req.body?.bidangIds) ? req.body.bidangIds.filter(Boolean) : [];

      if (!definisi) return res.status(400).json({ error: 'Definisi Sense wajib diisi.' });
      if (definisi.length > HAD_MAKSUD) return res.status(400).json({ error: `Definisi tidak boleh melebihi ${HAD_MAKSUD} aksara.` });

      const ralatInvariant = await sahkanInvariantSense(dbAll, dbGet, {
        istilahId: senseRow.istilahId, amSense, bidangIds, senseId,
      });
      if (ralatInvariant) return res.status(400).json({ error: ralatInvariant });

      const now = new Date().toISOString();
      await dbRun('BEGIN TRANSACTION');
      try {
        await dbRun('UPDATE glosari_sense SET definisi = ?, amSense = ?, updatedAt = ? WHERE id = ?', [definisi, amSense ? 1 : 0, now, senseId]);
        // Ganti PENUH senarai Bidang (bukan tokok/tolak separa) — lebih ringkas & selamat drpd
        // diff, dan bilangan baris per Sense kecil (jarang lebih beberapa Bidang).
        await dbRun('DELETE FROM glosari_sense_bidang WHERE senseId = ?', [senseId]);
        for (const categoryId of bidangIds) {
          await dbRun('INSERT INTO glosari_sense_bidang (senseId, categoryId) VALUES (?, ?)', [senseId, categoryId]);
        }
        await dbRun('COMMIT');
      } catch (e) {
        try { await dbRun('ROLLBACK'); } catch (rollbackErr) { console.error('Rollback gagal (sunting Sense):', rollbackErr.message); }
        throw e;
      }

      const bidangPenuh = bidangIds.length
        ? await dbAll(`SELECT id, name, slug FROM CategoryRegistry WHERE id IN (${bidangIds.map(() => '?').join(',')})`, bidangIds)
        : [];

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'sunting-sense-glosari',
        targetType: 'glosari-sense',
        targetId: senseId,
        detail: amSense ? 'Sense am' : `Sense khusus (${bidangPenuh.map((b) => b.name).join(', ')})`,
      });

      res.json({ success: true, sense: { id: senseId, definisi, amSense, bidang: bidangPenuh } });
    } catch (err) {
      console.error('PATCH glosari sense error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini Sense. ' + (err.message || '') });
    }
  });

  router.delete('/glosari/sense/:senseId', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const sedia = await dbGet('SELECT id FROM glosari_sense WHERE id = ?', [req.params.senseId]);
      if (!sedia) return res.status(404).json({ error: 'Sense tidak dijumpai.' });
      // ON DELETE CASCADE (server.js) padam baris glosari_sense_bidang berkaitan serentak.
      await dbRun('DELETE FROM glosari_sense WHERE id = ?', [req.params.senseId]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'padam-sense-glosari',
        targetType: 'glosari-sense',
        targetId: req.params.senseId,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE glosari sense error:', err);
      res.status(500).json({ error: 'Gagal memadam Sense. ' + (err.message || '') });
    }
  });

  return router;
}

export default createGlosariRoutes;
