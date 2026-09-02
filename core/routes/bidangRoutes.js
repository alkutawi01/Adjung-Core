import express from 'express';
import CategoryRegistry from '../category/CategoryRegistry.js';

// Halaman Bidang (/bidang/:slug, 2026-09-01) — laluan AWAM (tiada requireAuth), dua endpoint:
//   GET /api/bidang/:slug           -> metadata Bidang (nama, slug, deskripsi)
//   GET /api/bidang/:slug/artikel   -> senarai kandungan approved dalam Bidang, dipaginasi
//
// Definisi kandungan awam WAJIB ikut CLAUDE.md ("AMARAN WAJIB — MAX(version)"): hanya revisi
// TERKINI SEBENAR (version tertinggi objek tu, tanpa syarat status) yang status='approved' boleh
// terpapar — corak SAMA seperti searchRoutes.js/sitemapRoutes.js/articleUrlRoutes.js, BUKAN
// "MAX(version) WHERE status='approved'" (pepijat resolveSlotContent() 2026-08-16). Status
// carousel/slot-rotation semasa TIDAK dikira — kandungan approved yang off-rotation tetap muncul,
// sebab laluan ni langsung tak sentuh slots_config/CarouselStableBlock, cuma baca terus
// editorial_objects/editorial_revisions/editorial_attribute_values.
//
// 'archived' disertakan (2026-09-02, Izzat: "saya nak yg aktif dan yg arkib") — Halaman Bidang
// ialah paparan KOLEKSI, bukan cuma giliran carousel semasa, jadi kandungan yang diputar keluar
// (approved -> archived, putaran 24 jam atau manual) kekal boleh dilihat di sini sebagai "Koleksi
// Terdahulu".
//
// NOTA INSIDEN (2026-09-02): ciri ni sempat ditarik balik SAMA HARI selepas kandungan bersumber
// Wikipedia (dilarang keras — lihat CLAUDE.md/Perlembagaan) terpapar melalui laluan ni. Punca
// SEBENAR bukan ciri ni — 48 kandungan bersumber Wikipedia (ditulis sepanjang beberapa sesi lalu,
// kebanyakannya format "[Institusi] genap X tahun") sudah dikesan dan DIPADAM KEKAL (Tong Sampah)
// pada tarikh yang sama. Ciri paparan arkib dipulihkan selepas puncanya dibersihkan — jangan
// tarik balik ciri ni lagi sebagai "fix" pepijat kandungan; kandungan yang salah dasar sumber
// mesti dipadam terus di peringkat kandungan (lihat DELETE /api/system/content/:id), bukan
// disembunyikan dengan menyekat status='archived' di sini. Kalau kandungan bersumber Wikipedia
// ditemui lagi pada masa depan, padam kandungan itu — jangan ulang tarik balik ciri ni.

const ATTR_KEYS = ['desk', 'topik', 'briefLong', 'originalDate', 'source', 'url', 'editorName', 'image', 'sourcesJson'];

function attrSubquery(attributeId, alias) {
  return `(SELECT valueText FROM editorial_attribute_values
            WHERE objectId = eo.id AND revisionId = er.id AND attributeId = '${attributeId}') as ${alias}`;
}

export function createBidangRoutes(dbAll, dbGet) {
  const router = express.Router();

  // GET /api/bidang/:slug — metadata sahaja. 404 kalau slug tak wujud dalam CategoryRegistry
  // langsung (bukan sekadar "tiada kandungan" — kes tu dilayan oleh klien, papar mesej kosong).
  router.get('/bidang/:slug', async (req, res) => {
    try {
      const slug = String(req.params.slug || '').trim().toLowerCase();
      if (!slug) return res.status(404).json({ error: 'Bidang tidak dijumpai.' });
      const cat = await dbGet('SELECT name, slug, description FROM CategoryRegistry WHERE slug = ?', [slug]);
      if (!cat) return res.status(404).json({ error: 'Bidang tidak dijumpai.' });
      res.json({ name: cat.name, slug: cat.slug, description: cat.description || '' });
    } catch (err) {
      console.error('GET /bidang/:slug error:', err);
      res.status(500).json({ error: 'Gagal membaca Bidang.' });
    }
  });

  // GET /api/bidang/:slug/artikel?page=N&perPage=10 — kandungan approved (MAX version) dalam
  // Bidang ni, ikut er.createdAt (Tarikh SIARAN, 2026-09-02 — BUKAN originalDate/Tarikh Sumber,
  // lihat nota di SELECT di bawah) DESC. Setiap item bawa medan cukup untuk SENARAI (tajuk,
  // topik, tarikh) DAN Focus View penuh (huraian, sumber,
  // editor, objectId) — HalamanBidang.tsx guna terus tanpa panggilan API kedua bila artikel
  // diklik.
  router.get('/bidang/:slug/artikel', async (req, res) => {
    try {
      const slug = String(req.params.slug || '').trim().toLowerCase();
      const cat = await dbGet('SELECT name, slug, description FROM CategoryRegistry WHERE slug = ?', [slug]);
      if (!cat) return res.status(404).json({ error: 'Bidang tidak dijumpai.' });

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const perPage = Math.min(50, Math.max(1, parseInt(req.query.perPage, 10) || 10));
      // `offset` eksplisit (pilihan) — Koleksi Terdahulu klien guna saiz kelompok "lihat lagi"
      // (20) yang BERBEZA drpd saiz TERKINI (10), jadi aritmetik page/perPage seragam tak
      // mencukupi untuk kira offset sambungan yang betul. Bila dihantar, ia menang drpd page.
      const offsetParam = req.query.offset !== undefined ? Math.max(0, parseInt(req.query.offset, 10) || 0) : null;
      const offset = offsetParam !== null ? offsetParam : (page - 1) * perPage;

      const attrSelects = ATTR_KEYS.map((k) => attrSubquery(k, k)).join(',\n               ');

      const whereClause = `
        FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id
        INNER JOIN (
          SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions GROUP BY objectId
        ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
        WHERE eo.slotIndex >= 0
          AND er.status IN ('approved', 'archived')
          AND EXISTS (
            SELECT 1 FROM editorial_attribute_values av
            WHERE av.objectId = eo.id AND av.revisionId = er.id AND av.attributeId = 'desk'
              AND LOWER(av.valueText) = LOWER(?)
          )
      `;

      const totalRow = await dbGet(`SELECT COUNT(*) as total ${whereClause}`, [cat.name]);
      const total = totalRow ? Number(totalRow.total) || 0 : 0;

      const rows = await dbAll(`
        SELECT eo.id as objectId, eo.slotIndex, er.title, er.summary, er.createdAt, er.status,
               ${attrSelects}
        ${whereClause}
        ORDER BY er.createdAt DESC
        LIMIT ? OFFSET ?
      `, [cat.name, perPage, offset]);

      const artikel = rows.map((r) => {
        // Sumber berbilang (2026-08-05, server.js resolveSlotContent()) — attribute `sourcesJson`
        // dibaca DI SINI (dapatan bug-hunt, 2026-09-03) sebab laluan ni sebelum ni cuma hantar
        // `source`/`url` tunggal legasi (entri PERTAMA sahaja). Kandungan yang benar-benar ada
        // >1 sumber (ciri sedia ada, dipapar penuh di Focus View biasa) kehilangan sumber ke-2/3
        // SENYAP bila dibuka melalui Halaman Bidang — bukan ranap, cuma data tak lengkap. Parse
        // selamat (JSON rosak/kandungan lama tiada medan ni = senarai kosong), sama corak persis
        // server.js supaya FocusView jatuh balik ke source/sourceUrl legasi bila kosong.
        let sources = [];
        if (r.sourcesJson) {
          try {
            const parsed = JSON.parse(r.sourcesJson);
            if (Array.isArray(parsed)) sources = parsed;
          } catch { /* JSON rosak — kekal senarai kosong, jangan ranap. */ }
        }
        return {
          objectId: r.objectId,
          slotIndex: r.slotIndex,
          title: r.title || '',
          summary: r.summary || '',
          desk: r.desk || cat.name,
          topik: r.topik || '',
          briefLong: r.briefLong || '',
          source: r.source || '',
          sourceUrl: r.url || '',
          sources,
          editorName: r.editorName || '',
          image: r.image || '',
          status: r.status || 'approved',
          originalDate: r.originalDate || '',
          // Tarikh SIARAN (2026-09-02, Izzat: "susunan ikut tarikh siaran bukan tarikh sumber" —
          // dahulu senarai ni SUSUN & PAPAR guna `effectiveDate` (originalDate Tarikh Sumber jatuh
          // balik createdAt), yang mengelirukan teruk bila Tarikh Sumber ialah tarikh SEJARAH/
          // PENUBUHAN organisasi (cth "13 Jan 1888" National Geographic Society) — kandungan
          // terlontar ke bawah senarai "Koleksi Terdahulu" dan papar tarikh 1800-an, seolah-olah
          // Adjung terbitkan pada tahun itu. Senarai kronologi MESTI ikut BILA Adjung sebenarnya
          // menerbitkan (createdAt), bukan bila subjek/organisasi itu wujud. `originalDate` (Tarikh
          // Sumber) kekal dihantar berasingan untuk Focus View sahaja (sourceDate, konteks yang
          // betul untuknya), TIDAK lagi untuk SUSUN atau PAPAR senarai.
          publishedDate: r.createdAt || '',
        };
      });

      res.json({
        bidang: { name: cat.name, slug: cat.slug, description: cat.description || '' },
        artikel,
        page,
        perPage,
        total,
      });
    } catch (err) {
      console.error('GET /bidang/:slug/artikel error:', err);
      res.status(500).json({ error: 'Gagal membaca kandungan Bidang.' });
    }
  });

  return router;
}
