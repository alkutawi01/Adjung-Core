import express from 'express';
import { validateContentBudget, validateBidangTopik, validateMedanTambahan, validateSourceUrl, TIER_SLOTS } from '../editorial/ContentBudget.js';
import { MIN_BRIEF_LONG_CHARS } from '../editorial/GeometryConfig.js';
import { getAmSettings } from './slotAmRoutes.js';
import CategoryRegistry from '../category/CategoryRegistry.js';
import { requireAuth, requirePermission, hasPermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';
import { notifyMany } from '../notifications/Notify.js';
import { isDue, hasReplacementForExpiry } from '../editorial/Scheduling.js';

// Dua jenis Menunggu (2026-08-06, permintaan Izzat: "menunggu sepatutnya ada dua jenis, menunggu
// semakan dan menunggu untuk disiarkan/aktif") — helper kongsi tulis/kemas kini attribute
// `sebabMenunggu` (EAV, sama corak pernahDitolak). 'semakan' = perlu keputusan MANUSIA (Ketua
// Editor/Penolong, atau Editor berkelayakan publish); 'slot_penuh' = dah lulus keputusan, cuma
// tunggu ruang kosong (hadKandunganSlot) — dinaik taraf AUTOMATIK oleh
// promosikanMenungguSlotKosong() di bawah, tiada keputusan manusia kedua diperlukan. '' = tak
// terpakai (approved/archived/rejected/scheduled).
async function tetapkanSebabMenunggu(dbGet, dbRun, objectId, revisionId, nilai) {
  const sedia = await dbGet(
    "SELECT id FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'sebabMenunggu'",
    [objectId, revisionId]
  );
  if (sedia) {
    await dbRun('UPDATE editorial_attribute_values SET valueText = ? WHERE id = ?', [nilai, sedia.id]);
  } else {
    await dbRun(
      "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, 'sebabMenunggu', ?)",
      [objectId, revisionId, nilai]
    );
  }
}

// Naik taraf AUTOMATIK kandungan 'slot_penuh' bila ruang berkosong dalam slot (2026-08-06) —
// dipanggil selepas MANA-MANA tindakan yang mengurangkan kiraan 'approved' sesuatu slot (Arkib
// manual, Tolak-ke-draf, Luput berjadual — lihat setiap tapak panggilan). Naikkan SATU sahaja
// setiap panggilan (yang paling lama tertunggu — createdAt ASC, gilir adil), bukan semua sekali
// gus — kalau ruang lebih daripada satu terbuka serentak (jarang, tapi boleh berlaku semasa
// runSchedulingTick luput beberapa item serentak), panggilan berulang di setiap tapak yang sama
// akan naikkan taraf satu demi satu sehingga ruang penuh atau tiada calon lagi.
// Kunci per-slot (2026-08-07) — keadaan perlumbaan SEBENAR yang ditangkap simulasi serentak:
// dua tindakan yang membebaskan ruang pada slot SAMA (cth dua permintaan Arkib serentak, atau
// runSchedulingTick meluputkan beberapa item serentak) memanggil fungsi ni bersilang. Kedua-dua
// panggilan membaca kiraan 'approved' SEBELUM mana-mana daripadanya menulis, kedua-duanya nampak
// ada ruang, dan kedua-duanya menaikkan satu kandungan — slot melebihi hadKandunganSlot.
// Perlumbaan ni berselang-seli (lulus larian pertama, gagal larian kemudian), jadi ia takkan
// pernah ditemui dengan membaca kod atau ujian sekali-jalan.
//
// Panggilan pada slot yang SAMA kini beratur (rantaian janji per-slot); slot berbeza tetap
// berjalan serentak. Cukup kerana pelayan berjalan sebagai SATU proses (PM2 mod fork) — kalau
// kelak diskalakan kepada mod cluster/berbilang tika, kunci ni mesti dinaik taraf kepada kunci
// peringkat pangkalan data (cth transaksi IMMEDIATE), kerana kunci dalam-proses tidak merentas proses.
const kunciPromosiSlot = new Map();

// Siri-kan operasi status kandungan (2026-08-07) — perlumbaan KEDUA yang ditangkap simulasi
// serentak: semakan had kapasiti dalam PATCH /content/:id juga BACA kiraan 'approved' dahulu dan
// TULIS status kemudian. Dua editor meluluskan dua kandungan BERBEZA pada slot yang sama dalam
// masa yang sama: kedua-duanya nampak ada ruang, kedua-duanya jadi Aktif, had dilanggar.
// Disahkan berselang-seli — 3 daripada 4 larian gagal sebelum pembetulan ini.
//
// Operasi status kandungan disiri-kan sepenuhnya (bukan per-slot) kerana bahagian kritikal
// merentangi hampir keseluruhan pengendali, dan menguncinya per-slot memerlukan penyusunan semula
// besar pada kod yang sudah rumit — risiko yang tidak berbaloi. Kosnya boleh diabaikan: ini
// tindakan editorial (beberapa puluh sehari, dicetuskan klik manusia), bukan trafik pembaca.
// Laluan BACA awam tidak tersentuh langsung.
//
// Sama seperti kunci promosi di atas: cukup kerana pelayan satu proses (PM2 mod fork). Kalau
// kelak diskalakan kepada berbilang tika, ini mesti jadi kunci peringkat pangkalan data.
let rantaianKunciKandungan = Promise.resolve();
function denganKunciKandungan(fn) {
  const giliran = rantaianKunciKandungan.catch(() => {}).then(fn);
  rantaianKunciKandungan = giliran.catch(() => {});
  return giliran;
}

async function promosikanMenungguSlotKosong(dbAll, dbGet, dbRun, slotIndex) {
  const sebelumnya = kunciPromosiSlot.get(slotIndex) || Promise.resolve();
  const giliran = sebelumnya
    .catch(() => {}) // kegagalan panggilan terdahulu tak boleh menyekat giliran seterusnya
    .then(() => promosikanMenungguSlotKosongTanpaKunci(dbAll, dbGet, dbRun, slotIndex));
  kunciPromosiSlot.set(slotIndex, giliran);
  try {
    await giliran;
  } finally {
    // Elak Map membesar tanpa had: buang entri kalau tiada panggilan lain beratur selepas kita.
    if (kunciPromosiSlot.get(slotIndex) === giliran) kunciPromosiSlot.delete(slotIndex);
  }
}

async function promosikanMenungguSlotKosongTanpaKunci(dbAll, dbGet, dbRun, slotIndex) {
  if (TIER_SLOTS.BAR.includes(slotIndex)) return; // Bar tak sokong alur Draf/Terbit
  const { hadKandunganSlot } = getAmSettings();
  if (!hadKandunganSlot || hadKandunganSlot <= 0) return; // tiada had = tiada giliran utk dinaik taraf

  while (true) {
    const kiraanAktif = await dbGet(`
      SELECT COUNT(*) AS n FROM editorial_objects o
      JOIN editorial_revisions r ON r.objectId = o.id
      WHERE o.slotIndex = ? AND r.status = 'approved'
        AND r.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = o.id)
    `, [slotIndex]);
    if (!kiraanAktif || kiraanAktif.n >= hadKandunganSlot) return; // tiada ruang (lagi)

    const calon = await dbGet(`
      SELECT o.id AS objectId, r.id AS revisionId, r.title FROM editorial_objects o
      JOIN editorial_revisions r ON r.objectId = o.id
      JOIN editorial_attribute_values eav ON eav.objectId = o.id AND eav.revisionId = r.id
        AND eav.attributeId = 'sebabMenunggu' AND eav.valueText = 'slot_penuh'
      WHERE o.slotIndex = ? AND r.status = 'pending'
        AND r.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = o.id)
      ORDER BY o.createdAt ASC LIMIT 1
    `, [slotIndex]);
    if (!calon) return; // tiada calon menunggu slot kosong

    const kini = new Date().toISOString();
    await dbRun("UPDATE editorial_revisions SET status = 'approved', updatedAt = ? WHERE id = ?", [kini, calon.revisionId]);
    await tetapkanSebabMenunggu(dbGet, dbRun, calon.objectId, calon.revisionId, '');
    await logAudit(dbRun, {
      actorId: null, actorName: 'Sistem (Slot Berkosong)',
      action: 'kandungan-naik-taraf-slot-kosong', targetType: 'kandungan', targetId: calon.objectId,
      detail: (calon.title || '').slice(0, 100),
    });
    const editorRows = await dbAll('SELECT editorId FROM slot_editors WHERE slotIndex = ?', [slotIndex]);
    await notifyMany(dbRun, (editorRows || []).map((r) => r.editorId), {
      type: 'kandungan_disiar', title: 'Kandungan anda kini Aktif (slot dah berkosong)',
      detail: (calon.title || '').slice(0, 150), targetType: 'kandungan', targetId: calon.objectId,
    });
  }
}

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
    return res.status(403).json({ error: 'Akses ditolak', message: 'Hanya Ketua Editor/Penolong Ketua Editor boleh menetapkan Jadual Terbit/Luput.' });
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
      const objRow = await dbGet('SELECT slotIndex FROM editorial_objects WHERE id = ?', [row.objectId]);

      // Had kandungan seslot terpakai pada terbitan BERJADUAL juga (2026-08-06, audit). Dahulu
      // langkah ni menaikkan scheduled->approved TANPA SYARAT: jadual ialah satu-satunya laluan
      // yang boleh menolak slot melebihi hadKandunganSlot, sedangkan setiap laluan kelulusan
      // manual menghormatinya. Kalau slot penuh pada saat jadual matang, kandungan masuk giliran
      // 'slot_penuh' dan dinaikkan automatik oleh promosikanMenungguSlotKosong() sebaik ruang
      // terbuka — jadual tetap dihormati, cuma beratur, bukan dibuang.
      let statusJadual = 'approved';
      let sebabJadual = '';
      if (objRow && !TIER_SLOTS.BAR.includes(objRow.slotIndex)) {
        const { hadKandunganSlot } = getAmSettings();
        if (hadKandunganSlot > 0) {
          const kiraanAktif = await dbGet(`
            SELECT COUNT(*) AS n FROM editorial_objects o
            JOIN editorial_revisions r ON r.objectId = o.id
            WHERE o.slotIndex = ? AND o.id != ? AND r.status = 'approved'
              AND r.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = o.id)
          `, [objRow.slotIndex, row.objectId]);
          if (kiraanAktif && kiraanAktif.n >= hadKandunganSlot) {
            statusJadual = 'pending';
            sebabJadual = 'slot_penuh';
          }
        }
      }

      await dbRun("UPDATE editorial_revisions SET status = ?, updatedAt = ? WHERE id = ?", [statusJadual, nowIso, row.revisionId]);
      await tetapkanSebabMenunggu(dbGet, dbRun, row.objectId, row.revisionId, sebabJadual);
      await logAudit(dbRun, {
        actorId: null, actorName: 'Penjadual Sistem',
        action: sebabJadual === 'slot_penuh' ? 'kandungan-berjadual-tunggu-slot' : 'kandungan-terbit-berjadual',
        targetType: 'kandungan', targetId: row.objectId, detail: (row.title || '').slice(0, 100),
      });
      if (objRow) {
        const editorRows = await dbAll('SELECT editorId FROM slot_editors WHERE slotIndex = ?', [objRow.slotIndex]);
        await notifyMany(dbRun, (editorRows || []).map((r) => r.editorId), {
          type: 'kandungan_terbit_berjadual',
          title: sebabJadual === 'slot_penuh'
            ? 'Kandungan berjadual anda menunggu slot kosong'
            : 'Kandungan berjadual anda kini disiar',
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
        // Slot berkosong (2026-08-06) — luput berjadual bebaskan satu ruang 'approved'; naik
        // taraf calon 'slot_penuh' paling lama tertunggu dalam slot yang sama, kalau ada.
        await promosikanMenungguSlotKosong(dbAll, dbGet, dbRun, objRow.slotIndex).catch((e) => {
          console.warn('[Jadual Luput] Gagal naik taraf kandungan slot-berkosong:', e.message);
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
  //
  // Gerbang sesi (2026-08-06, pembetulan audit) — laluan ni dahulu TERBUKA sepenuhnya tanpa sesi.
  // Ia memulangkan SETIAP revisi terkini tanpa mengira status (approved/pending/rejected/archived)
  // berserta medan DALAMAN: `note` (Nota editor — ironinya kita bina gerbang ketat siapa boleh
  // MENULISnya di slotsConfigRoutes.js, tapi sesiapa di internet boleh MEMBACA semuanya),
  // `editorName`, `createdBy`. Disahkan hidup semasa audit: 127 item terdedah tanpa log masuk,
  // termasuk 102 kandungan arkib (yang merangkumi kandungan pernah DITOLAK). Kesemua empat
  // pemanggilnya ialah skrin Editorium di sebalik log masuk (DashboardConsole, IndeksConsole,
  // SenaraiSlotConsole, ContentReview), jadi requireAuth tidak memecahkan apa-apa. Laluan AWAM
  // sebenar (layout/active, rss.xml, search) berasingan dan sentiasa 'approved' sahaja.
  router.get('/content/all', requireAuth, async (req, res) => {
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
          // Dua jenis Menunggu (2026-08-06) — 'semakan' (perlu keputusan Ketua Editor/Penolong)
          // atau 'slot_penuh' (dah lulus, tunggu ruang kosong) — lihat SenaraiSlotConsole.tsx.
          sebabMenunggu: attrs.sebabMenunggu || '',
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
      res.status(500).json({ error: 'Gagal membaca himpunan kandungan. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/content/:id
  router.patch('/content/:id', requireAuth, gerbangKebenaranJadual, (req, res) => denganKunciKandungan(async () => {
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

      // Dasar Terbit Sendiri Editor (2026-08-06, permintaan Izzat) — "editor boleh terus publish,
      // tp benda ni boleh diubah oleh ketua editor... guna rbac". Kunci RBAC `publish` (togol
      // khusus Ketua Editor di /system/editor-publish-policy, TetapanAmSlotConsole.tsx) tentukan
      // sama ada Editor biasa boleh terus luluskan kandungan SENDIRI. Disemak SEBELUM kunci
      // pernah-ditolak di bawah (dasar am ni lebih luas drpd kes pernah-ditolak khusus).
      //
      // Kunci draf ditolak (2026-08-05) — "editor degil publish semula tanpa pembetulan":
      // walaupun dasar am benarkan self-publish, kandungan yang PERNAH ditolak sekali (bendera
      // `pernahDitolak`, disemat semasa Terbitkan drpd draf lahir-semula "Tolak" — lihat
      // syncManualObjectsForSlot server.js) tetap mesti lalui Ketua Editor/Penolong untuk terbit
      // semula. Semak SEBELUM validasi/tulisan lain — status='approved' ialah satu-satunya
      // senario disekat di sini (Tolak/Arkib/edit tajuk-huraian biasa tak disentuh).
      if (status === 'approved' && rev.status !== 'approved'
        && !hasPermission(req.session?.user?.roles, 'manageEditorial')) {
        if (!hasPermission(req.session?.user?.roles, 'publish')) {
          return res.status(403).json({
            error: 'Dasar semasa: Editor perlu kelulusan Ketua Editor/Penolong Ketua Editor untuk terbit — kandungan kekal Menunggu sehingga disemak.',
          });
        }
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

      // Dua jenis Menunggu (2026-08-06) — kandungan yang LULUS gerbang kelulusan di atas mungkin
      // masih tak boleh terus jadi Aktif kalau slot dah penuh dengan kandungan APPROVED sedia
      // ada (hadKandunganSlot, Tetapan Am Slot). Ditetapkan '' (bukan null) di sini supaya jenis
      // konsisten sepanjang fungsi — diisi 'slot_penuh' di bawah kalau berkenaan.
      let sebabMenungguBaharu = '';

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

        // Had MINIMUM huraian panjang (2026-08-07, permintaan Izzat) — sama penguatkuasaan
        // seperti laluan Terbitkan (server.js syncManualObjectsForSlot). Hanya terpakai bila
        // `briefLong` BENAR-BENAR dihantar dalam PATCH ni (medan tak disentuh, tak disemak).
        if (briefLong !== undefined && briefLong && briefLong.trim() && briefLong.length < MIN_BRIEF_LONG_CHARS) {
          return res.status(400).json({
            error: `Huraian panjang terlalu pendek (${briefLong.length} aksara, minimum ${MIN_BRIEF_LONG_CHARS}). Panjangkan huraian atau kosongkan terus medan ni.`,
          });
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
        // `topik`/`desk` MESTI turut mencetuskan semakan (2026-08-07, ditemui oleh simulasi
        // pintas-peraturan): sebelum ni senarai pencetus cuma title/summary/slotIndex/reactivating,
        // jadi PATCH yang menyentuh HANYA Topik atau HANYA Bidang melepasi validateBidangTopik
        // sepenuhnya — Topik boleh dikosongkan (walaupun wajib) dan Bidang boleh ditukar kepada
        // nilai yang tak sepadan Bidang terkunci slot. Medan yang DIVALIDASI mesti sentiasa
        // termasuk dalam syarat yang mencetuskan validasinya sendiri.
        const mustValidateBidangTopik = title !== undefined || summary !== undefined
          || slotIndex !== undefined || topik !== undefined || desk !== undefined || reactivating;
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

        // Had bilangan kandungan AKTIF seslot (2026-08-06, permintaan Izzat: "menunggu sepatutnya
        // ada dua jenis... menunggu semakan dan menunggu untuk disiarkan/aktif") — kandungan yang
        // LULUS gerbang kelulusan di atas tapi slot dah PENUH dengan kandungan APPROVED sedia ada
        // TIDAK terus jadi Aktif; ia kekal 'pending' bertanda sebabMenunggu='slot_penuh', dinaik
        // taraf AUTOMATIK oleh promosikanMenungguSlotKosong() sebaik ruang kosong wujud (tiada
        // keputusan manusia kedua diperlukan). Kira APPROVED SAHAJA (bukan approved+pending macam
        // POST /content di bawah, laluan penciptaan berasingan) — 'pending' memang dijangka
        // beratur menunggu giliran, bukan sebahagian had "aktif serentak".
        if (status === 'approved' && rev.status !== 'approved' && !TIER_SLOTS.BAR.includes(targetSlotIndex)) {
          const { hadKandunganSlot } = getAmSettings();
          if (hadKandunganSlot > 0) {
            const kiraanAktif = await dbGet(`
              SELECT COUNT(*) AS n FROM editorial_objects o
              JOIN editorial_revisions r ON r.objectId = o.id
              WHERE o.slotIndex = ? AND o.id != ? AND r.status = 'approved'
                AND r.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = o.id)
            `, [targetSlotIndex, id]);
            if (kiraanAktif && kiraanAktif.n >= hadKandunganSlot) {
              sebabMenungguBaharu = 'slot_penuh';
            }
          }
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
      let effectiveStatus = (scheduledPublishAt !== undefined && scheduledPublishAt && status === undefined)
        ? 'scheduled'
        : status;
      // Slot penuh (dua jenis Menunggu, lihat nota di atas) — tulis-ganti niat 'approved' kepada
      // 'pending' SEBELUM apa-apa penulisan DB berlaku, supaya SETIAP laluan tulis di bawah
      // (edit kandungan MAHUPUN status-sahaja) secara automatik hormati sekatan ni tanpa perlu
      // disemak dua kali.
      if (sebabMenungguBaharu === 'slot_penuh' && effectiveStatus === 'approved') {
        effectiveStatus = 'pending';
      }
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

          // Dasar aktif editorial (2026-08-05, permintaan Izzat) — "aktif" ditakrif KANDUNGAN
          // DITERBITKAN, bukan log masuk sahaja. Kemas kini `users.lastPublishedAt` bagi PENULIS
          // asal (attrs.editorName, bukan sesiapa yang klik butang — Ketua Editor selalunya yang
          // luluskan kandungan ORANG LAIN, bukan kandungan dia sendiri), reset
          // `amaranTakAktifTahap` ke 0 supaya kitaran amaran hari-7/14/21 (runSemakanTakAktif,
          // server.js) bermula semula bersih. Gagal senyap (console.warn) — kegagalan ni tak
          // patut gagalkan terbitan sebenar.
          try {
            const editorNameRow = await dbGet(
              "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'editorName'",
              [id, liveRevId]
            );
            const editorName = ((editorNameRow && editorNameRow.valueText) || '').trim();
            if (editorName) {
              await dbRun(
                "UPDATE users SET lastPublishedAt = ?, amaranTakAktifTahap = 0 WHERE LOWER(TRIM(penName)) = LOWER(?)",
                [nowIso, editorName]
              );
            }
          } catch (e) {
            console.warn('Gagal kemas kini lastPublishedAt (dasar aktif):', e.message);
          }
        }

        // Slot berkosong (2026-08-06) — Arkib SENGAJA membebaskan satu ruang 'approved' dalam
        // slot ni; naik taraf calon 'slot_penuh' paling lama tertunggu, kalau ada.
        if (effectiveStatus === 'archived' && objRow) {
          const slotUntukPromosi = slotIndex !== undefined ? slotIndex : objRow.slotIndex;
          await promosikanMenungguSlotKosong(dbAll, dbGet, dbRun, slotUntukPromosi).catch((e) => {
            console.warn('Gagal naik taraf kandungan slot-berkosong:', e.message);
          });
        }
      }

      // Dua jenis Menunggu (2026-08-06) — catat/kemas kini sebab menunggu SETIAP kali status
      // benar-benar berubah pada 'pending' (semakan biasa atau tersekat slot penuh) atau bersih
      // sepenuhnya bila mendarat pada status lain ('approved' terus, 'archived', dsb).
      if (effectiveStatus !== undefined) {
        const nilaiSebab = effectiveStatus === 'pending'
          ? (sebabMenungguBaharu === 'slot_penuh' ? 'slot_penuh' : 'semakan')
          : '';
        await tetapkanSebabMenunggu(dbGet, dbRun, id, liveRevId, nilaiSebab);
      }

      res.json({ success: true, slotPenuh: sebabMenungguBaharu === 'slot_penuh' });
    } catch (err) {
      console.error('Patch content item error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini kandungan. ' + (err.message || '') });
    }
  }));

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
      res.status(500).json({ error: 'Gagal membaca senarai versi. ' + (err.message || '') });
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

      // Had kandungan seslot terpakai pada pulihan juga (2026-08-06, audit). Versi lama boleh
      // berstatus 'approved'; memulihkannya ke atas kandungan yang kini diarkib/menunggu akan
      // menjadikannya AKTIF serta-merta — memintas hadKandunganSlot yang dikuatkuasakan pada
      // setiap laluan kelulusan lain. Kalau slot dah penuh, versi tetap dipulihkan tapi masuk
      // giliran 'slot_penuh' (sama mekanisme macam PATCH /content/:id), bukan ditolak: editor
      // tak patut kehilangan pulihan sebab masalah ruang yang akan selesai sendiri.
      let statusPulihan = oldRev.status;
      let sebabMenungguPulihan = '';
      if (oldRev.status === 'approved' && !TIER_SLOTS.BAR.includes(objRow.slotIndex)) {
        const { hadKandunganSlot } = getAmSettings();
        if (hadKandunganSlot > 0) {
          const kiraanAktif = await dbGet(`
            SELECT COUNT(*) AS n FROM editorial_objects o
            JOIN editorial_revisions r ON r.objectId = o.id
            WHERE o.slotIndex = ? AND o.id != ? AND r.status = 'approved'
              AND r.version = (SELECT MAX(version) FROM editorial_revisions WHERE objectId = o.id)
          `, [objRow.slotIndex, id]);
          if (kiraanAktif && kiraanAktif.n >= hadKandunganSlot) {
            statusPulihan = 'pending';
            sebabMenungguPulihan = 'slot_penuh';
          }
        }
      }

      const maxVersionRow = await dbGet('SELECT MAX(version) AS maxVersion FROM editorial_revisions WHERE objectId = ?', [id]);
      const nextVersion = (maxVersionRow && maxVersionRow.maxVersion ? maxVersionRow.maxVersion : 0) + 1;
      const nowIso = new Date().toISOString();
      const newRev = await dbRun(
        `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
         VALUES (?, ?, 'ms', ?, ?, ?, ?, ?, ?)`,
        [id, nextVersion, oldRev.title, oldRev.summary, statusPulihan, req.session?.user?.username || 'pulih-versi', nowIso, nowIso]
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
      // Tanda sebab menunggu pada revisi BAHARU supaya panel Senarai Slot papar "menunggu slot
      // kosong" (bukan "menunggu semakan"), dan promosikanMenungguSlotKosong() boleh menaikkannya
      // automatik sebaik ruang terbuka.
      await tetapkanSebabMenunggu(dbGet, dbRun, id, newRevId, statusPulihan === 'pending' ? (sebabMenungguPulihan || 'semakan') : '');

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: `pulih-versi:v${oldRev.version}->v${nextVersion}`,
        targetType: 'kandungan',
        targetId: id,
        detail: (oldRev.title || '').slice(0, 100),
      });

      res.json({ success: true, version: nextVersion, revisionId: newRevId, slotPenuh: sebabMenungguPulihan === 'slot_penuh' });
    } catch (err) {
      console.error('Restore content revision error:', err);
      res.status(500).json({ error: 'Gagal memulihkan versi. ' + (err.message || '') });
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

      // UPSERT + semak `changes` SEBELUM mengarkibkan revisi (2026-08-06, audit "kegagalan
      // senyap"). Dahulu UPDATE tulen: kalau baris slots_config slot tu tiada, teks draf yang baru
      // disusun ini hilang terus (0 baris ditulis, tiada ralat), TAPI baris seterusnya tetap
      // mengarkibkan revisi asal — kandungan editor MUSNAH sepenuhnya sedangkan UI kata "berjaya
      // ditolak ke draf". Urutan sekarang: pastikan draf betul-betul selamat dulu, baru arkib.
      const tulisDraf = await dbRun(`
        INSERT INTO slots_config (layoutTemplateId, slotIndex, manualSummary)
        VALUES ('frontpage', ?, ?)
        ON CONFLICT(layoutTemplateId, slotIndex) DO UPDATE SET manualSummary = excluded.manualSummary
      `, [objRow.slotIndex, nextSummary]);
      if (!tulisDraf || tulisDraf.changes === 0) {
        return res.status(500).json({ error: 'Draf gagal disimpan — kandungan asal TIDAK diarkibkan, tiada apa hilang. Cuba lagi.' });
      }
      await dbRun("UPDATE editorial_revisions SET status = 'archived', updatedAt = ? WHERE id = ?", [new Date().toISOString(), rev.id]);
      await tetapkanSebabMenunggu(dbGet, dbRun, id, rev.id, '');

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'tolak-ke-draf',
        targetType: 'kandungan',
        targetId: id,
        detail: (rev.title || '').slice(0, 100),
      });

      // Slot berkosong (2026-08-06) — kalau kandungan yang ditolak ni tadinya 'approved' (bukan
      // 'pending'), Tolak turut bebaskan satu ruang aktif; naik taraf calon 'slot_penuh' paling
      // lama tertunggu dalam slot yang sama, kalau ada.
      if (rev.status === 'approved') {
        await promosikanMenungguSlotKosong(dbAll, dbGet, dbRun, objRow.slotIndex).catch((e) => {
          console.warn('Gagal naik taraf kandungan slot-berkosong (Tolak):', e.message);
        });
      }

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
      res.status(500).json({ error: 'Gagal menolak kandungan ke draf. ' + (err.message || '') });
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
      res.status(500).json({ error: 'Gagal memadam kandungan. ' + (err.message || '') });
    }
  });

  // POST /api/system/content
  router.post('/content', requireAuth, async (req, res) => {
    try {
      const { slotIndex, title, summary, desk, source, url, imageUrl, topik } = req.body;
      if (slotIndex === undefined || slotIndex === null) {
        return res.status(400).json({ error: 'Nombor slot tiada.' });
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
        await logAudit(dbRun, {
          actorId: req.session?.user?.id,
          actorName: req.session?.user?.penName || req.session?.user?.username,
          action: 'cipta-kandungan-ticker',
          targetType: 'kandungan',
          targetId: `ticker-${tickerItems.length - 1}`,
          detail: title.trim().slice(0, 100),
        });
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

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'cipta-kandungan',
        targetType: 'kandungan',
        targetId: objectId,
        detail: title.trim().slice(0, 100),
      });

      res.json({ success: true, id: objectId });
    } catch (err) {
      console.error('Create content item error:', err);
      res.status(500).json({ error: 'Gagal mencipta kandungan. ' + (err.message || '') });
    }
  });

  // (2026-08-06, audit "kegagalan senyap") Blok PENDUA GET /content/:id/revisions +
  // POST .../restore dibuang dari sini. Ia didaftar kali KEDUA selepas versi bergerbang di
  // atas (baris ~722/747), jadi Express tak pernah memadankannya — kod mati. Bahaya sebenar:
  // salinan GET yang mati tu TIADA requireAuth, jadi kalau versi bergerbang dipadam atau
  // susunan berubah, laluan terbuka hidup semula secara senyap.


  return router;
}
