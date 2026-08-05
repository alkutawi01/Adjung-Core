import express from 'express';
import { validateContentBudget, validateBidangTopik, validateMedanTambahan, validateSourceUrl, TIER_SLOTS } from '../editorial/ContentBudget.js';
import { getAmSettings } from './slotAmRoutes.js';
import CategoryRegistry from '../category/CategoryRegistry.js';
import { requireAuth, requirePermission, hasPermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';
import { notifyMany } from '../notifications/Notify.js';
import { isDue, hasReplacementForExpiry } from '../editorial/Scheduling.js';

// The Ticker (slotIndex -1) never writes to editorial_objects, in either Manual or AI Generated
// mode — it always lives as a single "---"-delimited text blob in system_settings.inTheNewsText
// (see EditorialPipeline.js's slotIndex===-1 branch, and the ticker save path in POST
// /api/system/slots). These mirror the client-side parseInTheNews()/serialization convention
// (Desk:/Title:/Brief:/Source:/Url: fields) so the content-review endpoints can read/write it too.
export const parseTickerText = (text) => {
  if (!text) return [];
  const blocks = text.split(/\n?[-_—–―]{3,}\n?/);
  const items = [];
  for (const block of blocks) {
    let desk = '', title = '', brief = '', source = '', url = '', mode = '';
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (!url) url = trimmed;
        continue;
      }
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx <= 0) continue;
      const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (key === 'desk') desk = val;
      else if (key === 'title') title = val;
      else if (key === 'brief' || key === 'summary') brief = val;
      // 'sumber' accepted as an alias for legacy blocks written before the RSS-Direct fetch
      // handler's `sumber:` key typo (core/routes/slotRoutes.js) was fixed to write `source:` --
      // mirrors the client-side parseInTheNews() in src/utils.tsx, which already tolerated this.
      else if (key === 'source' || key === 'sumber') source = val;
      else if (key === 'url') url = val;
      // Mod Kandungan Ticker sebenar (Manual/AI Generated/RSS Direct) — lihat setiap penulis di
      // slotRoutes.js/slotsConfigRoutes.js/EditorialPipeline.js. Blok lama sebelum medan ni wujud
      // kekal '' (tak diketahui), bukan andaian salah.
      else if (key === 'mode') mode = val;
    }
    if (title) items.push({ desk, title, brief, source, url, mode });
  }
  return items;
};

export const serializeTickerText = (items) => {
  return items
    .map(i => `Desk: ${i.desk || 'UMUM'}\nTitle: ${i.title}\nBrief: ${i.brief || ''}\nSource: ${i.source || ''}\nUrl: ${i.url || '#'}${i.mode ? `\nMode: ${i.mode}` : ''}`)
    .join('\n---\n');
};

// 2026-08-02 (Fasa 2, pepijat kritikal) — inTheNewsText (ticker) ada BERBILANG penulis (RSS
// Direct — slotRoutes.js dua tapak, AI Generated — EditorialPipeline.js, Manual —
// slotsConfigRoutes.js), setiap satu DAHULU tulis-ganti SELURUH teks dengan blok dia sahaja —
// siapa jalan terakhir memusnahkan sumbangan penulis lain sepenuhnya (tiada gabungan langsung).
// Helper kongsi ni baca teks semasa, buang HANYA blok bertanda `modSendiri` (yang akan
// digantikan versi baharu), kekalkan blok mod lain, gabung semula. Setiap penulis kini "milik"
// satu mod sahaja dan tak sentuh mod orang lain.
export const gantiBlokModTicker = (teksSemasa, modSendiri, blokBaharu) => {
  const dikekalkan = parseTickerText(teksSemasa || '').filter((i) => i.mode !== modSendiri);
  return serializeTickerText([...dikekalkan.map((i) => i), ...blokBaharu]);
};

const CONTENT_STATUSES = ['approved', 'pending', 'rejected', 'archived', 'scheduled'];

// Jadual Terbit/Luput (2026-08-02) — Keputusan Izzat #2: hanya Ketua Editor/Penolong Ketua Editor
// (kunci kebenaran `manageEditorial` sedia ada, TIDAK cipta kunci baharu) boleh menetapkan
// scheduledPublishAt/scheduledExpiresAt — Editor biasa TIDAK boleh, walaupun dia boleh terbit
// kandungan dia sendiri secara normal. Ini gerbang SEBENAR (server-side) — penyembunyian UI cuma
// UX, bukan keselamatan (sikap keselamatan sedia ada projek ni).
const gerbangKebenaranJadual = (req, res, next) => {
  const { scheduledPublishAt, scheduledExpiresAt } = req.body || {};
  if (scheduledPublishAt === undefined && scheduledExpiresAt === undefined) return next();
  if (!hasPermission(req.session?.user?.roles, 'manageEditorial')) {
    return res.status(403).json({ error: 'Forbidden', message: 'Hanya Ketua Editor/Penolong Ketua Editor boleh menetapkan Jadual Terbit/Luput.' });
  }
  next();
};

// Scheduler dalaman (2026-08-02) — dipanggil berkala oleh setInterval di server.js (corak sama
// seperti RSS Auto Scheduler). Semak DUA syarat setiap tik:
//   1. status='scheduled' & scheduledPublishAt sudah sampai -> terbit (status='approved').
//   2. status='approved' & scheduledExpiresAt sudah sampai -> arkib (status='archived'), sama
//      transisi status macam laluan arkib manual (reject-to-draft/PATCH status archived) —
//      cuma tanda status, TIDAK sentuh tajuk/huraian.
// Gerbang "ada pengganti" (hasReplacementForExpiry) HANYA disemak semasa SIMPAN tarikh luput
// (PATCH di bawah) — bukan di sini semula. Andaian: sekali gerbang lulus semasa simpan, keadaan
// slot pada saat luput sebenar dipercayai kekal sah (tiada langkah kunci/semak-semula di sini demi
// mengelak concurrency kompleks untuk faedah kecil — didokumenkan di CLAUDE.md/spesifikasi ciri).
export async function runSchedulingTick(dbAll, dbGet, dbRun) {
  const nowIso = new Date().toISOString();

  // (1) Terbit berjadual
  try {
    const dueToPublish = await dbAll(`
      SELECT er.id as revisionId, er.objectId, er.title FROM editorial_revisions er
      INNER JOIN (SELECT objectId, MAX(version) as mv FROM editorial_revisions GROUP BY objectId) lv
        ON lv.objectId = er.objectId AND lv.mv = er.version
      WHERE er.status = 'scheduled' AND er.scheduledPublishAt IS NOT NULL AND er.scheduledPublishAt <= ?
    `, [nowIso]);
    for (const row of dueToPublish) {
      if (!isDue(row.scheduledPublishAt ?? nowIso)) { /* defensive no-op, SQL already filtered */ }
      await dbRun("UPDATE editorial_revisions SET status = 'approved', updatedAt = ? WHERE id = ?", [nowIso, row.revisionId]);
      const objRow = await dbGet('SELECT slotIndex FROM editorial_objects WHERE id = ?', [row.objectId]);
      await logAudit(dbRun, {
        actorId: null, actorName: 'Penjadual Sistem', action: 'kandungan-terbit-berjadual',
        targetType: 'kandungan', targetId: row.objectId, detail: (row.title || '').slice(0, 100),
      });
      if (objRow) {
        const editorRows = await dbAll('SELECT editorId FROM slot_editors WHERE slotIndex = ?', [objRow.slotIndex]);
        await notifyMany(dbRun, (editorRows || []).map((r) => r.editorId), {
          type: 'kandungan_terbit_berjadual', title: 'Kandungan berjadual anda kini disiar',
          detail: (row.title || '').slice(0, 150), targetType: 'kandungan', targetId: row.objectId,
        });
      }
    }
  } catch (err) {
    console.error('[Jadual Terbit] Ralat tik penjadual:', err.message);
  }

  // (2) Luput/arkib berjadual
  try {
    const dueToExpire = await dbAll(`
      SELECT er.id as revisionId, er.objectId, er.title FROM editorial_revisions er
      INNER JOIN (SELECT objectId, MAX(version) as mv FROM editorial_revisions GROUP BY objectId) lv
        ON lv.objectId = er.objectId AND lv.mv = er.version
      WHERE er.status = 'approved' AND er.scheduledExpiresAt IS NOT NULL AND er.scheduledExpiresAt <= ?
    `, [nowIso]);
    for (const row of dueToExpire) {
      await dbRun("UPDATE editorial_revisions SET status = 'archived', updatedAt = ? WHERE id = ?", [nowIso, row.revisionId]);
      const objRow = await dbGet('SELECT slotIndex FROM editorial_objects WHERE id = ?', [row.objectId]);
      await logAudit(dbRun, {
        actorId: null, actorName: 'Penjadual Sistem', action: 'kandungan-luput-berjadual',
        targetType: 'kandungan', targetId: row.objectId, detail: (row.title || '').slice(0, 100),
      });
      if (objRow) {
        const editorRows = await dbAll('SELECT editorId FROM slot_editors WHERE slotIndex = ?', [objRow.slotIndex]);
        await notifyMany(dbRun, (editorRows || []).map((r) => r.editorId), {
          type: 'kandungan_luput_berjadual', title: 'Kandungan anda telah luput & diarkibkan',
          detail: (row.title || '').slice(0, 150), targetType: 'kandungan', targetId: row.objectId,
        });
      }
    }
  } catch (err) {
    console.error('[Jadual Luput] Ralat tik penjadual:', err.message);
  }
}

export function createContentRoutes(db, dbAll, dbGet, dbRun) {
  const router = express.Router();

  // GET /api/system/content/all
  router.get('/content/all', async (req, res) => {
    try {
      // Admin index view: show the latest revision of every object regardless of status (approved,
      // pending, rejected, archived) — unlike the public-facing layout/active endpoint, which only
      // ever serves 'approved' rows. This is what lets Adjung Brief show and manage items the chief
      // editor has rejected/archived after the fact, without those items ever reappearing on the
      // public frontpage.
      const rows = await dbAll(`
        SELECT eo.id as objectId, eo.slotIndex, eo.categoryId, eo.createdAt as objectCreatedAt,
               er.id as revisionId, er.title, er.summary, er.status, er.createdBy,
               er.createdAt as revisionCreatedAt, er.updatedAt as revisionUpdatedAt,
               er.scheduledPublishAt, er.scheduledExpiresAt
        FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id
        INNER JOIN (
          SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions GROUP BY objectId
        ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
        ORDER BY eo.slotIndex ASC, eo.createdAt ASC
      `);

      const objectIds = rows.map(r => r.objectId);
      let attrsByObject = {};
      if (objectIds.length > 0) {
        const placeholders = objectIds.map(() => '?').join(',');
        const attrRows = await dbAll(`SELECT * FROM editorial_attribute_values WHERE objectId IN (${placeholders})`, objectIds);
        for (const a of attrRows) {
          if (!attrsByObject[a.objectId]) attrsByObject[a.objectId] = {};
          attrsByObject[a.objectId][a.attributeId] = a.valueText;
        }
      }

      // Lajur maxTitle/maxBrief dalam slots_config SENGAJA TIDAK dibaca lagi (2026-07-30). Dua
      // lajur tu salinan lama nombor had yang tak pernah dikemas kini — 12 slot simpan nilai yang
      // salah, 20 lagi kosong. Had sebenar datang daripada TIER (GeometryConfig + pindaan Ketua
      // Editor di Editorium → Slot → Tier Kad, lihat tierSettingsRoutes.js). Menghantar salinan
      // lama tu cuma menjemput skrin seterusnya mempercayai nombor yang salah. Lajurnya dibiarkan
      // tidur dalam pangkalan data — membina semula jadual slots_config demi lajur yang tak dibaca
      // ialah risiko tanpa faedah.
      const slotRows = await dbAll("SELECT slotIndex, maxBriefLong, manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage'");
      const limitsBySlot = {};
      for (const s of slotRows) {
        limitsBySlot[s.slotIndex] = { maxBriefLong: s.maxBriefLong, slotCategory: s.manualDesk || '' };
      }

      // seriesIndex: 1-based position within its own slot, in the same createdAt-ASC order used to
      // render the carousel — this is what the "#slot-series" numbering in the bulk text view anchors to.
      const seriesCounter = {};
      const items = rows.map(r => {
        const attrs = attrsByObject[r.objectId] || {};
        seriesCounter[r.slotIndex] = (seriesCounter[r.slotIndex] || 0) + 1;
        const limits = limitsBySlot[r.slotIndex] || {};
        return {
          id: r.objectId,
          revisionId: r.revisionId,
          slotIndex: r.slotIndex,
          seriesIndex: seriesCounter[r.slotIndex],
          title: r.title,
          summary: r.summary,
          summaryLong: attrs.briefLong || '',
          note: attrs.note || '',
          originalDate: attrs.originalDate || '',
          desk: attrs.desk || r.categoryId || '',
          topik: attrs.topik || '',
          source: attrs.source || '',
          url: attrs.url || '#',
          // `attrs.image` (2026-08-02, Fasa 2) — medan "Imej" dalam modal Tulis Kandungan simpan
          // di bawah kunci atribut 'image' (lampiran Focus View, lihat FrontpageView.tsx nota
          // berhampiran item.image vs item.imageUrl — dua konsep tulen berlainan, BUKAN salah
          // eja). Sebelum ini Indeks/Semakan cuma baca imageUrl/coverImageId, jadi imej yang
          // dilampirkan editor semasa menulis langsung tak kelihatan di kedua-dua skrin semakan
          // tu walaupun ia BETUL terpapar di Focus View sebenar. Fallback ni bukan gantikan
          // imageUrl — ia cuma pastikan sesuatu imej (yang mana pun ada) sampai ke pratonton.
          imageUrl: attrs.imageUrl || attrs.coverImageId || attrs.image || '',
          maxBriefLong: limits.maxBriefLong !== undefined ? limits.maxBriefLong : null,
          slotCategory: limits.slotCategory || '',
          status: r.status || 'approved',
          createdBy: r.createdBy || '',
          editorName: attrs.editorName || '',
          createdAt: r.revisionCreatedAt,
          updatedAt: r.revisionUpdatedAt,
          scheduledPublishAt: r.scheduledPublishAt || null,
          scheduledExpiresAt: r.scheduledExpiresAt || null,
        };
      });

      const tickerSettings = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
      const tickerLimits = limitsBySlot[-1] || {};
      const tickerParsed = parseTickerText(tickerSettings ? tickerSettings.inTheNewsText : '');
      const tickerItems = tickerParsed.map((t, idx) => ({
        id: `ticker-${idx}`,
        revisionId: null,
        slotIndex: -1,
        seriesIndex: idx + 1,
        title: t.title,
        summary: t.brief,
        desk: t.desk,
        source: t.source,
        url: t.url || '#',
        imageUrl: '',
        maxTitle: tickerLimits.maxTitle !== undefined ? tickerLimits.maxTitle : null,
        maxBrief: tickerLimits.maxBrief !== undefined ? tickerLimits.maxBrief : null,
        slotCategory: tickerLimits.slotCategory || '',
        status: 'approved',
        // Mod sebenar (Manual/AI Generated/RSS Direct) yang mencipta baris ni — BUKAN konstan
        // 'ticker' tetap macam dulu (tak bawa maklumat, lihat "Kaedah" audit di Indeks). Blok lama
        // sebelum medan Mode: wujud kekal '', papar sebagai "Tidak diketahui" di UI, bukan silap.
        createdBy: t.mode || '',
        createdAt: null,
        updatedAt: null
      }));

      const allItems = [...tickerItems, ...items];
      res.json({ items: allItems, count: allItems.length });
    } catch (err) {
      console.error('Fetch aggregate content error:', err);
      res.status(500).json({ error: 'Failed to fetch aggregate content. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/content/:id
  router.patch('/content/:id', requireAuth, gerbangKebenaranJadual, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, summary, desk, source, url, status, topik, slotIndex, briefLong, originalDate, note, scheduledPublishAt, scheduledExpiresAt } = req.body;
      if (status !== undefined && !CONTENT_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Status tidak sah. Guna salah satu: ${CONTENT_STATUSES.join(', ')}.` });
      }

      if (id.startsWith('ticker-')) {
        if (status !== undefined) {
          return res.status(400).json({ error: 'Item ticker tiada status boleh-ubah — buang baris tu terus daripada tetapan ticker untuk menariknya balik.' });
        }
        if (scheduledPublishAt !== undefined || scheduledExpiresAt !== undefined) {
          return res.status(400).json({ error: 'Item ticker tidak menyokong Jadual Terbit/Luput — ia disegarkan terus daripada suapan RSS.' });
        }
        const idx = parseInt(id.slice('ticker-'.length), 10);
        const settingsRow = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
        const tickerItems = parseTickerText(settingsRow ? settingsRow.inTheNewsText : '');
        if (idx < 0 || idx >= tickerItems.length) {
          return res.status(404).json({ error: 'Item ticker tidak dijumpai.' });
        }
        // Same hard-block as every other content path: an edit can never push this tier's
        // title+brief over its budget, no matter which screen the edit came from.
        const nextTitle = title !== undefined ? title : tickerItems[idx].title;
        const nextBrief = summary !== undefined ? summary : tickerItems[idx].brief;
        const tickerBudgetCheck = validateContentBudget(-1, nextTitle, nextBrief);
        if (!tickerBudgetCheck.isValid) {
          return res.status(400).json({ error: tickerBudgetCheck.reason });
        }
        if (title !== undefined) tickerItems[idx].title = title;
        if (summary !== undefined) tickerItems[idx].brief = summary;
        if (desk !== undefined) tickerItems[idx].desk = desk;
        if (source !== undefined) tickerItems[idx].source = source;
        if (url !== undefined) tickerItems[idx].url = url;
        await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [serializeTickerText(tickerItems)]);
        return res.json({ success: true });
      }

      const { imageUrl } = req.body;
      // Look up the latest revision regardless of current status — a previously rejected/archived
      // item must still be reachable here so the chief editor can flip it back to 'approved'.
      const rev = await dbGet("SELECT * FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1", [id]);
      if (!rev) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }

      // Kunci draf ditolak (2026-08-05, permintaan Izzat) — "editor degil publish semula tanpa
      // pembetulan": Editor biasa boleh self-publish kandungan dia sendiri secara normal (`publish`
      // sedia ada), tapi kandungan yang PERNAH ditolak sekali (bendera `pernahDitolak`, disemat
      // semasa Terbitkan drpd draf lahir-semula "Tolak" — lihat syncManualObjectsForSlot di
      // server.js) mesti lalui Ketua Editor/Penolong Ketua Editor untuk terbit semula, BUKAN
      // Editor sendiri. Semak SEBELUM validasi/tulisan lain — status='approved' yang diminta ialah
      // satu-satunya senario disekat di sini (Tolak/Arkib/edit tajuk-huraian biasa tak disentuh).
      if (status === 'approved' && rev.status !== 'approved'
        && !hasPermission(req.session?.user?.roles, 'manageEditorial')) {
        const bendera = await dbGet(
          "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'pernahDitolak'",
          [id, rev.id]
        );
        if (bendera && bendera.valueText === '1') {
          return res.status(403).json({
            error: 'Kandungan ni pernah ditolak sebelum ini — perlu kelulusan Ketua Editor/Penolong Ketua Editor untuk terbit semula, bukan Editor sendiri.',
          });
        }
      }

      // Same hard-block as every other content path: an edit can never push a slot's title+brief
      // over its tier's budget, no matter which screen the edit came from.
      const objRow = await dbGet("SELECT slotIndex, categoryId FROM editorial_objects WHERE id = ?", [id]);
      if (objRow) {
        // Sasaran slot: slot BAHARU kalau kandungan sedang dipindah (siar-semula kandungan
        // archived ke slot lain), jika tidak slot sedia ada.
        const targetSlotIndex = slotIndex !== undefined ? slotIndex : objRow.slotIndex;

        // Keputusan Izzat #1 (Jadual Luput) — hanya semak bila scheduledExpiresAt SEDANG
        // ditetapkan (nilai bukan-kosong) DAN ia berbeza daripada nilai tersimpan semasa (elak
        // sekat semula kalau PATCH lain sekadar hantar semula nilai sedia ada tanpa berubah).
        if (scheduledExpiresAt !== undefined && scheduledExpiresAt && scheduledExpiresAt !== rev.scheduledExpiresAt) {
          const lainDalamSlot = await dbAll(`
            SELECT r.status FROM editorial_objects o
            INNER JOIN editorial_revisions r ON r.objectId = o.id
            INNER JOIN (SELECT objectId, MAX(version) as mv FROM editorial_revisions GROUP BY objectId) lv
              ON lv.objectId = o.id AND lv.mv = r.version
            WHERE o.slotIndex = ? AND o.id != ?
          `, [targetSlotIndex, id]);
          if (!hasReplacementForExpiry(lainDalamSlot.map((r) => r.status))) {
            return res.status(400).json({
              error: 'Tak boleh tetapkan tarikh luput — ni satu-satunya kandungan slot ni. Sedia kandungan gantian dalam giliran dulu.',
            });
          }
        }

        const nextTitle = title !== undefined ? title : rev.title;
        const nextSummary = summary !== undefined ? summary : rev.summary;
        const budgetCheck = validateContentBudget(targetSlotIndex, nextTitle, nextSummary);
        if (!budgetCheck.isValid) {
          return res.status(400).json({ error: budgetCheck.reason });
        }

        // Had aksara medan bukan-kad (Tetapan Am Slot). Hanya medan yang benar-benar dihantar
        // disemak — kemas kini separa tak boleh ditolak kerana medan yang tak disentuh.
        const medanCheck = validateMedanTambahan({ summaryLong: briefLong, source, topik, note });
        if (!medanCheck.isValid) {
          return res.status(400).json({ error: medanCheck.reason });
        }

        // Format sumber (Fasa 8b) — URL sumber mesti sekurang-kurangnya rupa URL sah kalau diisi.
        const urlCheck = validateSourceUrl(url);
        if (!urlCheck.isValid) {
          return res.status(400).json({ error: urlCheck.reason });
        }

        // Bidang terkunci per-slot, Topik wajib — bila tajuk/huraian diedit, kandungan dipindah
        // ke slot lain, ATAU kandungan sedang diaktifkan semula (archived/rejected -> approved/
        // pending, cth "Siarkan Semula" di Indeks). Bukan tindakan status-sahaja lain (Tolak/
        // Arkib pada kandungan lama tak perlu sepadan Bidang). Kecuali slot BAR.
        const reactivating = status !== undefined
          && ['approved', 'pending'].includes(status)
          && ['archived', 'rejected'].includes(rev.status);
        const mustValidateBidangTopik = title !== undefined || summary !== undefined || slotIndex !== undefined || reactivating;
        if (mustValidateBidangTopik && !TIER_SLOTS.BAR.includes(targetSlotIndex)) {
          const slotRow = await dbGet("SELECT manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [targetSlotIndex]);
          const existingAttrs = await dbGet(
            "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'desk'",
            [id, rev.id]
          );
          const nextDesk = desk !== undefined ? desk : (existingAttrs ? existingAttrs.valueText : objRow.categoryId);
          const existingTopikRow = await dbGet(
            "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'topik'",
            [id, rev.id]
          );
          const nextTopik = topik !== undefined ? topik : (existingTopikRow ? existingTopikRow.valueText : '');
          const bidangTopikCheck = validateBidangTopik({
            slotBidang: slotRow ? slotRow.manualDesk : null,
            itemBidang: nextDesk,
            topik: nextTopik,
            requireTopik: true,
            slotIndex: targetSlotIndex,
          });
          if (!bidangTopikCheck.isValid) {
            return res.status(400).json({ error: bidangTopikCheck.reason });
          }
        }

        if (slotIndex !== undefined && slotIndex !== objRow.slotIndex) {
          await dbRun("UPDATE editorial_objects SET slotIndex = ? WHERE id = ?", [slotIndex, id]);
        }
      }

      // Sejarah versi sebenar (Fasa 6): kandungan (tajuk/huraian) yang benar-benar berubah
      // MESTI dapat baris editorial_revisions BAHARU — bukan UPDATE atas revisi sedia ada,
      // yang memusnahkan teks lama secara senyap. Kemas kini status-sahaja (tiada tajuk/
      // huraian dihantar) kekal UPDATE di tempat, sebab itu bukan penulisan-ganti kandungan,
      // sama macam laluan padam/arkib lain dalam projek ni.
      const isContentEdit = title !== undefined || summary !== undefined;
      const nowIso = new Date().toISOString();
      let liveRevId = rev.id;

      // Jadual Terbit — kalau editor tetapkan scheduledPublishAt TANPA hantar `status` eksplisit,
      // status secara automatik jadi 'scheduled' (kandungan kekal tersembunyi drpd pembaca sehingga
      // masa tiba — lihat runSchedulingTick). Hantar `status` eksplisit sekali tetap dihormati
      // (cth padam jadual serentak paksa 'approved').
      const effectiveStatus = (scheduledPublishAt !== undefined && scheduledPublishAt && status === undefined)
        ? 'scheduled'
        : status;
      const scheduleFieldsChanged = scheduledPublishAt !== undefined || scheduledExpiresAt !== undefined;
      const nextScheduledPublishAt = scheduledPublishAt !== undefined ? (scheduledPublishAt || null) : rev.scheduledPublishAt;
      const nextScheduledExpiresAt = scheduledExpiresAt !== undefined ? (scheduledExpiresAt || null) : rev.scheduledExpiresAt;

      if (isContentEdit) {
        const maxVersionRow = await dbGet('SELECT MAX(version) AS maxVersion FROM editorial_revisions WHERE objectId = ?', [id]);
        const nextVersion = (maxVersionRow && maxVersionRow.maxVersion ? maxVersionRow.maxVersion : 0) + 1;
        const newTitle = title !== undefined ? title : rev.title;
        const newSummary = summary !== undefined ? summary : rev.summary;
        const newStatus = effectiveStatus !== undefined ? effectiveStatus : rev.status;
        const newRev = await dbRun(
          `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt, scheduledPublishAt, scheduledExpiresAt)
           VALUES (?, ?, 'ms', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, nextVersion, newTitle, newSummary, newStatus, req.session?.user?.username || 'edit-content', nowIso, nowIso, nextScheduledPublishAt, nextScheduledExpiresAt]
        );
        liveRevId = newRev.lastID;

        // Bawa semua atribut lama daripada revisi sebelumnya ke revisi baharu (revisionId baharu),
        // supaya medan yang TIDAK disentuh oleh PATCH ni (mis. sumber, imej) tak "hilang" —
        // laluan baca tapis atribut ikut revisionId semasa sahaja.
        const oldAttrs = await dbAll(
          "SELECT attributeId, valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ?",
          [id, rev.id]
        );
        for (const a of oldAttrs) {
          await dbRun(
            "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
            [id, liveRevId, a.attributeId, a.valueText]
          );
        }
      } else if (effectiveStatus !== undefined || scheduleFieldsChanged) {
        await dbRun(
          `UPDATE editorial_revisions SET status = ?, scheduledPublishAt = ?, scheduledExpiresAt = ?, updatedAt = ? WHERE id = ?`,
          [effectiveStatus !== undefined ? effectiveStatus : rev.status, nextScheduledPublishAt, nextScheduledExpiresAt, nowIso, rev.id]
        );
      }

      if (desk !== undefined && desk.trim() !== '') {
        try {
          await CategoryRegistry.incrementCategoryUsage(db, desk);
        } catch (e) {
          console.warn("Failed to register category:", e.message);
        }
      }

      const attrCandidates = { desk, source, url, imageUrl, topik, briefLong, originalDate, note };
      for (const [key, val] of Object.entries(attrCandidates)) {
        if (val === undefined) continue;
        const existing = await dbGet(
          "SELECT id FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = ?",
          [id, liveRevId, key]
        );
        if (existing) {
          await dbRun("UPDATE editorial_attribute_values SET valueText = ? WHERE id = ?", [val, existing.id]);
        } else {
          await dbRun(
            "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
            [id, liveRevId, key, val]
          );
        }
      }

      await dbRun("UPDATE editorial_objects SET updatedAt = ? WHERE id = ?", [new Date().toISOString(), id]);

      // Log Audit (Fasa 4) — cuma catat bila STATUS berubah (terbit/tolak/arkib/siar-semula),
      // sebab itulah tindakan editorial yang bermakna untuk jejak; edit teks semata-mata
      // (tajuk/huraian) tak perlu satu baris log setiap ketikan.
      if (effectiveStatus !== undefined && effectiveStatus !== rev.status) {
        await logAudit(dbRun, {
          actorId: req.session?.user?.id,
          actorName: req.session?.user?.penName || req.session?.user?.username,
          action: `status:${rev.status}->${effectiveStatus}`,
          targetType: 'kandungan',
          targetId: id,
          detail: (title !== undefined ? title : rev.title || '').slice(0, 100),
        });

        // Notifikasi Kandungan (Fasa 6b) — "kandungan disiar". Cuma bila status BAHARU mendarat
        // pada 'approved' (disiar) — bukan setiap perubahan status (arkib/tolak dilayan laluan
        // lain). Beritahu semua editor yang diamanahkan slot ni (bukan cuma penulis asal — slot
        // boleh dikongsi beberapa editor).
        if (effectiveStatus === 'approved' && objRow) {
          const notifySlotIndex = slotIndex !== undefined ? slotIndex : objRow.slotIndex;
          const editorRows = await dbAll('SELECT editorId FROM slot_editors WHERE slotIndex = ?', [notifySlotIndex]);
          await notifyMany(dbRun, (editorRows || []).map((r) => r.editorId), {
            type: 'kandungan_disiar',
            title: 'Kandungan anda telah disiar',
            detail: (title !== undefined ? title : rev.title || '').slice(0, 150),
            targetType: 'kandungan',
            targetId: id,
          });
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Patch content item error:', err);
      res.status(500).json({ error: 'Failed to update item. ' + (err.message || '') });
    }
  });

  // GET /api/system/content/:id/revisions — Sejarah Versi Sebenar (Fasa 6). Pulangkan setiap
  // baris editorial_revisions untuk objek ni (bukan cuma versi terkini), tersusun terbaharu dulu,
  // supaya panel "Sejarah versi" boleh papar & pulihkan versi lama.
  router.get('/content/:id/revisions', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (id.startsWith('ticker-')) {
        return res.status(400).json({ error: 'Item ticker tiada sejarah versi — ia disegarkan terus daripada suapan RSS.' });
      }
      const objRow = await dbGet("SELECT id FROM editorial_objects WHERE id = ?", [id]);
      if (!objRow) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }
      const revisions = await dbAll(
        "SELECT id, version, title, summary, status, createdBy, createdAt, updatedAt FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC",
        [id]
      );
      res.json(revisions);
    } catch (err) {
      console.error('List content revisions error:', err);
      res.status(500).json({ error: 'Failed to list revisions. ' + (err.message || '') });
    }
  });

  // POST /api/system/content/:id/revisions/:revisionId/restore — pulihkan versi lama sebagai
  // versi TERKINI baharu (versi + 1), bukan UPDATE atas rekod lama — sejarah kekal utuh selepas
  // pulih pun. Mesti lepasi budget/Bidang-Topik semasa juga, sebab peraturan tier boleh berubah
  // sejak versi lama tu ditulis.
  router.post('/content/:id/revisions/:revisionId/restore', requireAuth, async (req, res) => {
    try {
      const { id, revisionId } = req.params;
      if (id.startsWith('ticker-')) {
        return res.status(400).json({ error: 'Item ticker tiada sejarah versi untuk dipulihkan.' });
      }
      const objRow = await dbGet("SELECT id, slotIndex FROM editorial_objects WHERE id = ?", [id]);
      if (!objRow) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }
      const oldRev = await dbGet(
        "SELECT * FROM editorial_revisions WHERE id = ? AND objectId = ?",
        [revisionId, id]
      );
      if (!oldRev) {
        return res.status(404).json({ error: 'Versi tersebut tidak dijumpai untuk kandungan ini.' });
      }

      const budgetCheck = validateContentBudget(objRow.slotIndex, oldRev.title || '', oldRev.summary || '');
      if (!budgetCheck.isValid) {
        return res.status(400).json({ error: `Versi ini tak boleh dipulihkan — ${budgetCheck.reason}` });
      }

      if (!TIER_SLOTS.BAR.includes(objRow.slotIndex)) {
        const deskAttr = await dbGet(
          "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'desk'",
          [id, oldRev.id]
        );
        const topikAttr = await dbGet(
          "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'topik'",
          [id, oldRev.id]
        );
        const slotRow = await dbGet("SELECT manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [objRow.slotIndex]);
        const bidangTopikCheck = validateBidangTopik({
          slotBidang: slotRow ? slotRow.manualDesk : null,
          itemBidang: deskAttr ? deskAttr.valueText : null,
          topik: topikAttr ? topikAttr.valueText : '',
          requireTopik: true,
          slotIndex: objRow.slotIndex,
        });
        if (!bidangTopikCheck.isValid) {
          return res.status(400).json({ error: `Versi ini tak boleh dipulihkan — ${bidangTopikCheck.reason}` });
        }
      }

      const maxVersionRow = await dbGet('SELECT MAX(version) AS maxVersion FROM editorial_revisions WHERE objectId = ?', [id]);
      const nextVersion = (maxVersionRow && maxVersionRow.maxVersion ? maxVersionRow.maxVersion : 0) + 1;
      const nowIso = new Date().toISOString();
      const newRev = await dbRun(
        `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
         VALUES (?, ?, 'ms', ?, ?, ?, ?, ?, ?)`,
        [id, nextVersion, oldRev.title, oldRev.summary, oldRev.status, req.session?.user?.username || 'pulih-versi', nowIso, nowIso]
      );
      const newRevId = newRev.lastID;

      const oldAttrs = await dbAll(
        "SELECT attributeId, valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ?",
        [id, oldRev.id]
      );
      for (const a of oldAttrs) {
        await dbRun(
          "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
          [id, newRevId, a.attributeId, a.valueText]
        );
      }

      await dbRun("UPDATE editorial_objects SET updatedAt = ? WHERE id = ?", [nowIso, id]);

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: `pulih-versi:v${oldRev.version}->v${nextVersion}`,
        targetType: 'kandungan',
        targetId: id,
        detail: (oldRev.title || '').slice(0, 100),
      });

      res.json({ success: true, version: nextVersion, revisionId: newRevId });
    } catch (err) {
      console.error('Restore content revision error:', err);
      res.status(500).json({ error: 'Failed to restore revision. ' + (err.message || '') });
    }
  });

  // POST /api/system/content/:id/reject-to-draft — "Tolak" di Indeks (2026-07-29, permintaan
  // pemilik projek). Alur kerja Draf/Terbit: kandungan "Terbitkan" masuk Indeks sebagai Pending,
  // menunggu Ketua Editor. Tolak BUKAN sekadar tanda status='rejected' — ia betul-betul
  // PULANGKAN kandungan tu jadi draf peribadi semula (rekod editorial_objects diarkib untuk
  // jejak audit, kandungan penuh disalin balik jadi blok draf dalam slots_config.manualSummary
  // slot asal supaya editor boleh sambung sunting dalam modal Tulis Kandungan). Draf tak pernah
  // muncul di Indeks — lihat nota di server.js/ManualBlockFormat.js.
  // Gerbang `reject` (2026-08-05, audit) — dahulu `requireAuth` SAHAJA: mana-mana editor yang log
  // masuk boleh "Tolak" kandungan SESIAPA sahaja kembali jadi draf, walhal kunci `reject` sudah
  // wujud dalam matriks Kawalan Akses sejak Fasa 3 (lalai: Ketua Editor + Penolong ya, Pentadbir &
  // Editor tidak) — cuma tak pernah disambungkan ke laluan ni.
  router.post('/content/:id/reject-to-draft', requirePermission('reject'), async (req, res) => {
    try {
      const { id } = req.params;
      if (id.startsWith('ticker-')) {
        return res.status(400).json({ error: 'Ticker tidak menyokong Tolak-ke-Draf.' });
      }

      const objRow = await dbGet("SELECT slotIndex, categoryId FROM editorial_objects WHERE id = ?", [id]);
      if (!objRow) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }
      if (TIER_SLOTS.BAR.includes(objRow.slotIndex)) {
        return res.status(400).json({ error: 'Slot Bar belum menyokong alur kerja Draf/Terbit.' });
      }

      const rev = await dbGet("SELECT * FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1", [id]);
      if (!rev) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }

      const attrRows = await dbAll("SELECT attributeId, valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ?", [id, rev.id]);
      const attrs = {};
      for (const a of attrRows) attrs[a.attributeId] = a.valueText;

      // Sebab penolakan (2026-08-02, Fasa 6) — dahulu "Tolak" pulangkan draf TANPA sebarang
      // catatan kepada penulis, penulis kena teka sendiri kenapa. Disemat depan Nota sedia ada
      // (bukan gantikan) supaya nota asal editor tak hilang.
      // Nota ni SATU baris dalam format blok (parseManualSummaryBlocks huraikan baris demi
      // baris) — baris baharu literal di dalam nilai akan senyap terpotong semasa dihurai
      // semula, jadi digabung dengan pemisah dalam-baris, bukan \n\n.
      const sebab = (req.body?.sebab || '').toString().trim().replace(/\r?\n/g, ' ');
      const notaGabungan = sebab
        ? `Sebab ditolak: ${sebab}${attrs.note ? ` — ${attrs.note}` : ''}`
        : (attrs.note || '');

      const draftBlock = [
        `UUID: object-manual-slot${objRow.slotIndex}-${Date.now()}-reject`,
        `Status: draf`,
        `Tajuk: ${rev.title || ''}`,
        `Topik: ${attrs.topik || ''}`,
        `Huraian ringkas: ${rev.summary || ''}`,
        `Huraian panjang: ${attrs.briefLong || ''}`,
        `Sumber: ${attrs.source || ''}`,
        `URL: ${attrs.url || ''}`,
        `Tarikh sumber: ${attrs.originalDate || ''}`,
        `Imej: ${attrs.image || ''}`,
        `Nota: ${notaGabungan}`,
        // Dipulangkan kepada editor yang MENERBITKANnya dulu (attribute 'editorName'), supaya draf
        // yang ditolak muncul semula dalam "Draf Saya" orang yang sama — bukan hilang dalam slot
        // sehingga dia membelek satu-satu. Kandungan lama tanpa editorName kekal kosong: "Draf
        // Saya" jatuh balik pada penugasan slot untuk blok tanpa nama.
        `Penulis: ${attrs.editorName || ''}`,
      ].join('\n');
      const DRAFT_SEPARATOR = '\n\n________________________________________\n\n';

      const slotRow = await dbGet("SELECT manualSummary FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [objRow.slotIndex]);
      const existingSummary = (slotRow && slotRow.manualSummary) || '';
      const nextSummary = existingSummary.trim() ? `${existingSummary}${DRAFT_SEPARATOR}${draftBlock}` : draftBlock;

      await dbRun("UPDATE slots_config SET manualSummary = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [nextSummary, objRow.slotIndex]);
      await dbRun("UPDATE editorial_revisions SET status = 'archived', updatedAt = ? WHERE id = ?", [new Date().toISOString(), rev.id]);

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'tolak-ke-draf',
        targetType: 'kandungan',
        targetId: id,
        detail: (rev.title || '').slice(0, 100),
      });

      // Notifikasi Kandungan (Fasa 6b) — "kandungan ditolak", sertakan sebab (item A daripada
      // fasa ni: reuse sebab penolakan Fasa 6). Utamakan penulis asal (attrs.editorName, dicap
      // semasa terbit) — draf yang ditolak pulang kepada dia; jatuh balik pada editor slot kalau
      // tiada nama penulis tercatat (kandungan lama).
      const penulisRow = attrs.editorName
        ? await dbGet('SELECT id FROM users WHERE penName = ?', [attrs.editorName])
        : null;
      const penerimaIds = penulisRow
        ? [penulisRow.id]
        : (await dbAll('SELECT editorId FROM slot_editors WHERE slotIndex = ?', [objRow.slotIndex])).map((r) => r.editorId);
      await notifyMany(dbRun, penerimaIds, {
        type: 'kandungan_ditolak',
        title: 'Kandungan anda ditolak',
        detail: sebab ? `Sebab: ${sebab}` : (rev.title || '').slice(0, 150),
        targetType: 'kandungan',
        targetId: id,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Reject-to-draft error:', err);
      res.status(500).json({ error: 'Failed to reject to draft. ' + (err.message || '') });
    }
  });

  // DELETE /api/system/content/:id
  router.delete('/content/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // TICKER DIKECUALIKAN daripada peraturan "arkib, jangan padam" di bawah (2026-07-30,
      // keputusan pemilik projek). Sebabnya: item Ticker datang daripada suapan RSS, bukan
      // ditulis editor dalam modal Tulis Kandungan. Mengarkibkan setiap satunya akan
      // menenggelamkan arkib dengan ratusan baris yang bukan karya editorial — arkib itu untuk
      // menjejaki keputusan editor, bukan menyimpan segala yang pernah melintas jalur.
      if (id.startsWith('ticker-')) {
        const idx = parseInt(id.slice('ticker-'.length), 10);
        const settingsRow = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
        const tickerItems = parseTickerText(settingsRow ? settingsRow.inTheNewsText : '');
        if (idx < 0 || idx >= tickerItems.length) {
          return res.status(404).json({ error: 'Item ticker tidak dijumpai.' });
        }
        const dipadam = tickerItems[idx];
        tickerItems.splice(idx, 1);
        await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [serializeTickerText(tickerItems)]);
        await logAudit(dbRun, {
          actorId: req.session?.user?.id,
          actorName: req.session?.user?.penName || req.session?.user?.username,
          action: 'padam-ticker',
          targetType: 'ticker',
          targetId: id,
          detail: (dipadam?.title || '').slice(0, 100),
        });
        return res.json({ success: true });
      }

      // PERATURAN EDITORIAL (2026-07-30, pemilik projek): kandungan yang sudah DITERBITKAN tidak
      // boleh dipadam — termasuk yang sudah diarkibkan. Yang boleh dipadam hanyalah DRAF, iaitu
      // editor membatalkan rancangan menerbitkan sesuatu.
      //
      // Draf tidak pernah punya baris editorial_objects: ia hidup sebagai teks dalam
      // slots_config.manualSummary dan dipadam terus di modal Tulis Kandungan. Jadi setiap id yang
      // sampai ke sini SUDAH diterbitkan, dan laluan ni tiada kes sah yang tinggal.
      //
      // Untuk mengeluarkan kandungan daripada frontpage, gunakan Arkib (PATCH status) — rekodnya
      // kekal untuk jejak audit.
      const wujud = await dbGet("SELECT id FROM editorial_objects WHERE id = ?", [id]);
      if (!wujud) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }
      return res.status(400).json({
        error: 'Kandungan yang sudah diterbitkan tidak boleh dipadam — arkibkannya sebaliknya. Hanya draf (dalam modal Tulis Kandungan) boleh dipadam.',
      });
    } catch (err) {
      console.error('Delete content item error:', err);
      res.status(500).json({ error: 'Failed to delete item. ' + (err.message || '') });
    }
  });

  // POST /api/system/content
  router.post('/content', requireAuth, async (req, res) => {
    try {
      const { slotIndex, title, summary, desk, source, url, imageUrl, topik } = req.body;
      if (slotIndex === undefined || slotIndex === null) {
        return res.status(400).json({ error: 'Missing slotIndex.' });
      }
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Tajuk diperlukan.' });
      }

      if (slotIndex === -1) {
        // Same hard-block as every other tier — Ticker is not an exception. Previously this
        // branch returned before ever reaching the validateContentBudget call below, so a manually
        // added ticker item could be any length at all.
        const tickerBudgetCheck = validateContentBudget(-1, title.trim(), (summary || '').trim());
        if (!tickerBudgetCheck.isValid) {
          return res.status(400).json({ error: tickerBudgetCheck.reason });
        }
        const tickerUrlCheck = validateSourceUrl(url);
        if (!tickerUrlCheck.isValid) {
          return res.status(400).json({ error: tickerUrlCheck.reason });
        }
        const settingsRow = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
        const tickerItems = parseTickerText(settingsRow ? settingsRow.inTheNewsText : '');
        tickerItems.push({
          desk: (desk || 'UMUM').trim().toUpperCase(),
          title: title.trim(),
          brief: (summary || '').trim(),
          source: source || '',
          url: url || '#'
        });
        await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [serializeTickerText(tickerItems)]);
        return res.json({ success: true, id: `ticker-${tickerItems.length - 1}` });
      }

      // Same hard-block as every other content-creation path: this slot's tier's budget rule applies
      // no matter which screen the content came from (core/editorial/ContentBudget.js).
      const budgetCheck = validateContentBudget(slotIndex, title.trim(), (summary || '').trim());
      if (!budgetCheck.isValid) {
        return res.status(400).json({ error: budgetCheck.reason });
      }

      const medanCheck = validateMedanTambahan({ source, topik });
      if (!medanCheck.isValid) {
        return res.status(400).json({ error: medanCheck.reason });
      }

      const urlCheck = validateSourceUrl(url);
      if (!urlCheck.isValid) {
        return res.status(400).json({ error: urlCheck.reason });
      }

      // Had bilangan kandungan seslot (Tetapan Am Slot; 0 = tiada had). Dikira daripada kandungan
      // yang masih hidup sahaja — kandungan arkib tidak mengambil ruang slot.
      const { hadKandunganSlot } = getAmSettings();
      if (hadKandunganSlot > 0) {
        const kiraan = await dbGet(`
          SELECT COUNT(*) AS n FROM editorial_objects o
          JOIN editorial_revisions r ON r.objectId = o.id
          WHERE o.slotIndex = ? AND r.status IN ('approved', 'pending')
            AND r.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = o.id)
        `, [slotIndex]);
        if (kiraan && kiraan.n >= hadKandunganSlot) {
          return res.status(400).json({
            error: `Slot ${slotIndex + 1} sudah ada ${kiraan.n} kandungan — had maksimum ialah ${hadKandunganSlot} (Tetapan Am Slot). Arkibkan kandungan sedia ada dahulu.`,
          });
        }
      }

      const timestamp = new Date().toISOString();
      const finalCategory = (desk || 'UMUM').trim().toUpperCase();

      // Bidang terkunci per-slot, Topik wajib untuk kandungan baharu — kecuali slot BAR. Checked
      // against finalCategory (not raw desk) so an omitted desk — which defaults to 'UMUM' — still
      // gets caught if the slot has a different locked Bidang, instead of silently bypassing the check.
      if (!TIER_SLOTS.BAR.includes(slotIndex)) {
        const slotRow = await dbGet("SELECT manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slotIndex]);
        const bidangTopikCheck = validateBidangTopik({
          slotBidang: slotRow ? slotRow.manualDesk : null,
          itemBidang: finalCategory,
          topik,
          requireTopik: true,
          slotIndex,
        });
        if (!bidangTopikCheck.isValid) {
          return res.status(400).json({ error: bidangTopikCheck.reason });
        }
      }
      try {
        await CategoryRegistry.incrementCategoryUsage(db, finalCategory);
      } catch (e) {
        console.warn("Failed to register category:", e.message);
      }
      const objectId = `object-manual-slot${slotIndex}-${Date.now()}-new`;

      await dbRun(
        `INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt)
         VALUES (?, 'Brief', ?, 'Medium', ?, ?, ?)`,
        [objectId, finalCategory, slotIndex, timestamp, timestamp]
      );
      const rev = await dbRun(
        `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
         VALUES (?, 1.0, 'ms', ?, ?, 'approved', 'content-review', ?, ?)`,
        [objectId, title.trim(), (summary || '').trim(), timestamp, timestamp]
      );
      const revisionId = rev.lastID;

      const attrs = [
        { key: 'desk', val: finalCategory },
        { key: 'url', val: url || '#' },
        { key: 'source', val: source || '' },
        { key: 'topik', val: topik || '' },
      ];
      if (imageUrl) attrs.push({ key: 'imageUrl', val: imageUrl });
      for (const a of attrs) {
        await dbRun(
          "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
          [objectId, revisionId, a.key, a.val]
        );
      }

      res.json({ success: true, id: objectId });
    } catch (err) {
      console.error('Create content item error:', err);
      res.status(500).json({ error: 'Failed to create item. ' + (err.message || '') });
    }
  });

  // GET /api/system/content/:id/revisions — sejarah versi sebenar (Fasa 6). Senarai semua
  // baris editorial_revisions untuk satu objek, versi terbaharu dahulu. Baca sahaja, tiada
  // perubahan data — tak perlu requireAuth ketat macam laluan tulis, tapi ikut corak laluan
  // baca lain dalam fail ni (content/all) yang juga tiada requireAuth.
  router.get('/content/:id/revisions', async (req, res) => {
    try {
      const { id } = req.params;
      if (id.startsWith('ticker-')) {
        return res.status(400).json({ error: 'Ticker tidak menyokong sejarah versi.' });
      }
      const objRow = await dbGet('SELECT id FROM editorial_objects WHERE id = ?', [id]);
      if (!objRow) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }
      const revisions = await dbAll(
        `SELECT id, version, title, summary, status, createdBy, createdAt, updatedAt
         FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC`,
        [id]
      );
      res.json(revisions);
    } catch (err) {
      console.error('Get content revisions error:', err);
      res.status(500).json({ error: 'Gagal mendapatkan sejarah versi. ' + (err.message || '') });
    }
  });

  // POST /api/system/content/:id/revisions/:revisionId/restore — pulihkan versi lama sebagai
  // versi TERKINI baharu (bukan padam/tulis-ganti versi lain — sejarah kekal berkekalan).
  router.post('/content/:id/revisions/:revisionId/restore', requireAuth, async (req, res) => {
    try {
      const { id, revisionId } = req.params;
      if (id.startsWith('ticker-')) {
        return res.status(400).json({ error: 'Ticker tidak menyokong pulihan versi.' });
      }
      const objRow = await dbGet('SELECT id, slotIndex, categoryId FROM editorial_objects WHERE id = ?', [id]);
      if (!objRow) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }
      const oldRev = await dbGet(
        'SELECT * FROM editorial_revisions WHERE id = ? AND objectId = ?',
        [revisionId, id]
      );
      if (!oldRev) {
        return res.status(404).json({ error: 'Versi tersebut tidak dijumpai untuk item ini.' });
      }
      const currentRev = await dbGet(
        'SELECT * FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1',
        [id]
      );
      if (currentRev && currentRev.id === oldRev.id) {
        return res.status(400).json({ error: 'Versi ini sudah menjadi versi semasa — tiada apa untuk dipulihkan.' });
      }

      // Peraturan bajet ruang & Bidang/Topik terpakai walaupun ini pulihan, bukan sunting
      // baharu — versi lama mungkin tak lagi muat had tier semasa (CLAUDE.md: dikuatkuasakan
      // di setiap laluan simpan, tanpa pengecualian).
      const budgetCheck = validateContentBudget(objRow.slotIndex, oldRev.title, oldRev.summary);
      if (!budgetCheck.isValid) {
        return res.status(400).json({ error: budgetCheck.reason });
      }
      if (!TIER_SLOTS.BAR.includes(objRow.slotIndex)) {
        const slotRow = await dbGet("SELECT manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [objRow.slotIndex]);
        const oldDeskRow = await dbGet(
          "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'desk'",
          [id, oldRev.id]
        );
        const oldTopikRow = await dbGet(
          "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'topik'",
          [id, oldRev.id]
        );
        const bidangTopikCheck = validateBidangTopik({
          slotBidang: slotRow ? slotRow.manualDesk : null,
          itemBidang: oldDeskRow ? oldDeskRow.valueText : objRow.categoryId,
          topik: oldTopikRow ? oldTopikRow.valueText : '',
          requireTopik: true,
          slotIndex: objRow.slotIndex,
        });
        if (!bidangTopikCheck.isValid) {
          return res.status(400).json({ error: bidangTopikCheck.reason });
        }
      }

      const maxVersionRow = await dbGet('SELECT MAX(version) AS maxVersion FROM editorial_revisions WHERE objectId = ?', [id]);
      const nextVersion = (maxVersionRow && maxVersionRow.maxVersion ? maxVersionRow.maxVersion : 0) + 1;
      const nowIso = new Date().toISOString();
      const newRev = await dbRun(
        `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
         VALUES (?, ?, 'ms', ?, ?, ?, ?, ?, ?)`,
        [id, nextVersion, oldRev.title, oldRev.summary, oldRev.status, req.session?.user?.username || 'restore-versi', nowIso, nowIso]
      );
      const newRevId = newRev.lastID;

      const oldAttrs = await dbAll(
        'SELECT attributeId, valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ?',
        [id, oldRev.id]
      );
      for (const a of oldAttrs) {
        await dbRun(
          'INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)',
          [id, newRevId, a.attributeId, a.valueText]
        );
      }

      await dbRun('UPDATE editorial_objects SET updatedAt = ? WHERE id = ?', [nowIso, id]);

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: `restore-versi:${oldRev.version}->v${nextVersion}`,
        targetType: 'kandungan',
        targetId: id,
        detail: (oldRev.title || '').slice(0, 100),
      });

      res.json({ success: true, newRevisionId: newRevId, version: nextVersion });
    } catch (err) {
      console.error('Restore content revision error:', err);
      res.status(500).json({ error: 'Gagal memulihkan versi. ' + (err.message || '') });
    }
  });

  return router;
}
