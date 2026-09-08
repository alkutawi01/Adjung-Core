import express from 'express';

// Fasa 11 — Carian pengunjung (2026-08-05, keputusan Izzat: carian ringkas tajuk/topik).
// Laluan AWAM, tiada auth (pembaca portal, bukan Editorium) — carian ikut tajuk/huraian/topik
// kandungan berstatus 'approved' sahaja (definisi sama seperti /api/system/content/all dan
// rss.xml — "laluan awam layout/active hanya sentiasa hidangkan baris approved"). Ticker
// (slotIndex -1) dikecualikan, sama seperti sitemap/rss — bukan kandungan boleh dibuka di
// Focus View.

export function createSearchRoutes(dbAll) {
  const router = express.Router();

  router.get('/system/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) {
        return res.json({ results: [] });
      }
      // Escape aksara khas LIKE (%, _, dan escape char \ itu sendiri) SEBELUM bina corak carian
      // — tanpa ni, carian literal pembaca (cth "50%" diskaun, atau nombor bersambung "90_9")
      // ditafsir sebagai wildcard SQL (% = mana-mana jujukan, _ = mana-mana SATU aksara),
      // memulangkan padanan terlalu luas/salah yang tak berkaitan langsung dgn teks ditaip.
      // ESCAPE '\\' eksplisit diperlukan sebab SQLite LIKE tiada escape char lalai — DUA backslash
      // dalam source (2026-09-08, dapatan regresi Izzat: "search tak keluar langsung") ialah
      // WAJIB, bukan satu — `ESCAPE '\'` (satu backslash) dalam template literal JS ditafsir
      // sebagai escaped-quote oleh JS sendiri, jadi SQL SEBENAR yang sampai ke SQLite jadi
      // `ESCAPE ''` (kosong), yang campak SQLITE_ERROR "ESCAPE expression must be a single
      // character" pada SETIAP carian — carian awam rosak 100% sejak fix LIKE-injection pagi ni
      // (ralat ditelan client, papar "Tiada kandungan dijumpai" macam kosong biasa, bukan ralat
      // sebenar — lihat juga pembetulan susulan di client, tapak sama). Disahkan node -e langsung
      // terhadap sqlite3: `ESCAPE '\'` (1 backslash) -> SQL string `ESCAPE ''` -> SQLITE_ERROR;
      // `ESCAPE '\\'` (2 backslash) -> SQL string `ESCAPE '\'` (1 backslash sebenar) -> betul.
      const qTerlepas = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      const like = `%${qTerlepas}%`;
      // `latest` mesti dikira daripada MAX(version) MERENTASI SEMUA status (bukan hanya di
      // kalangan revisi 'approved') — join tadi (sebelum 2026-08-13) cari revisi berversi
      // tertinggi DALAM KALANGAN yang approved sahaja, jadi bila kandungan diedit lagi lepas
      // terbit lalu diarkib, revisi approved LAMA (yang dah digantikan) tetap sepadan syarat tu
      // dan terus terpapar dalam carian awam — CONTENT-LIFECYCLE-005B, ditemui 2026-08-13 semasa
      // simulasi #41 (kandungan archived kekal boleh dijumpai pembaca melalui carian). Baris asal
      // 2026-08-05 (join thd MAX(version) WHERE status='approved') sendiri fix bug bertentangan
      // (carian kosong sebab edit terbaharu belum approved dianggap versi "terkini") — bentuk di
      // bawah selesaikan KEDUA-DUA arah serentak: cari revisi TERKINI SEBENAR (version tertinggi
      // tanpa syarat status), papar HANYA jika revisi terkini SEBENAR itu approved.
      // eo.categoryId dibekukan pada MASA PENCIPTAAN objek — Bidang sebenar boleh ditukar
      // kemudian (contentRoutes.js PATCH /content/:id, medan `desk`) tanpa mengemas kini
      // eo.categoryId (corak sama seperti rssFeedRoutes.js/articleUrlRoutes.js/sitemapRoutes.js/
      // posterRoutes.js). Label "desk" hasil carian awam ni sebelum ni baca eo.categoryId BEKU
      // terus — kandungan yang Bidangnya ditukar selepas terbit akan papar label Bidang LAMA
      // dalam senarai hasil carian, bercanggah dgn label sebenar di frontpage/halaman Bidang
      // (dapatan bug-hunt 2026-09-08, sambungan sweep categoryId beku yang sama; paparan sahaja,
      // tiada URL dibina di sini). Dibaiki: sertakan atribut 'desk' revisi terkini, guna itu
      // dahulu (fallback categoryId hanya untuk objek lama yang tiada atribut desk).
      const rows = await dbAll(`
        SELECT eo.id as objectId, eo.slotIndex, eo.categoryId, er.title, er.summary,
               (SELECT valueText FROM editorial_attribute_values
                WHERE objectId = eo.id AND revisionId = er.id AND attributeId = 'topik') as topik,
               (SELECT valueText FROM editorial_attribute_values
                WHERE objectId = eo.id AND revisionId = er.id AND attributeId = 'desk') as deskLive
        FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id
        INNER JOIN (
          SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions GROUP BY objectId
        ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
        WHERE eo.slotIndex >= 0
          AND er.status = 'approved'
          AND (
            er.title LIKE ? ESCAPE '\\' OR er.summary LIKE ? ESCAPE '\\'
            OR EXISTS (
              SELECT 1 FROM editorial_attribute_values av
              WHERE av.objectId = eo.id AND av.revisionId = er.id AND av.attributeId = 'topik' AND av.valueText LIKE ? ESCAPE '\\'
            )
          )
        ORDER BY er.createdAt DESC
        LIMIT 20
      `, [like, like, like]);

      const results = rows.map((r) => ({
        objectId: r.objectId,
        slotIndex: r.slotIndex,
        title: r.title || '',
        summary: (r.summary || '').slice(0, 140),
        desk: r.deskLive || r.categoryId || '',
        topik: r.topik || '',
      }));
      res.json({ results });
    } catch (err) {
      console.error('GET /system/search error:', err);
      res.status(500).json({ error: 'Gagal mencari kandungan. ' + err.message });
    }
  });

  return router;
}
