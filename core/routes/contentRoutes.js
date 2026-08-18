import express from 'express';
import { validateContentBudget, validateBidangTopik, validateMedanTambahan, validateSourceUrl, validateGlossLength, TIER_SLOTS } from '../editorial/ContentBudget.js';
import { effectiveMinBriefLong } from '../editorial/GeometryConfig.js';
import { getAmSettings } from './slotAmRoutes.js';
import CategoryRegistry from '../category/CategoryRegistry.js';
import { requireAuth, requirePermission, hasPermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';
import { notifyMany } from '../notifications/Notify.js';
import { isDue, hasReplacementForExpiry, resolveEffectiveStatus } from '../editorial/Scheduling.js';
import { denganKunciKandungan } from '../utils/kunciKandungan.js';
import { kutipNamaFailDariAtribut, padamFailMuatNaikYatim } from '../utils/failMuatNaik.js';

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

// Pembantu pemilikan kandungan kongsi (2026-08-18) — semakan "adakah SAYA penulis asal
// kandungan ni" disalin 4 kali merentasi fail ni dengan peraturan TAK KONSISTEN (3 tapak guna
// padanan tepat sensitif-huruf, 1 tapak guna LOWER(TRIM(...)) dalam SQL) — akibat sebenar:
// editor yang `penName` sesi berbeza huruf besar/kecil atau ada ruang lampau berbanding
// `editorName` tersimpan boleh terkunci daripada kandungan SENDIRI. Satu takrifan sahaja,
// dipangkas + huruf-kecil kedua-dua belah (padan corak SQL LOWER(TRIM(...)) yang sedia ada di
// tapak lastPublishedAt — itu yang paling betul, bukan dua tapak strict di bawah).
async function penulisAsalKandungan(dbGet, objectId, revisionId) {
  const row = await dbGet(
    "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'editorName'",
    [objectId, revisionId]
  );
  return ((row && row.valueText) || '').trim();
}
function namaSepadan(a, b) {
  const ta = (a || '').trim().toLowerCase();
  const tb = (b || '').trim().toLowerCase();
  return !!ta && !!tb && ta === tb;
}
function namaSayaSesi(req) {
  return (req.session?.user?.penName || req.session?.user?.username || '').trim();
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
//
// Dipindah ke ../utils/kunciKandungan.js (2026-08-08, dapatan audit keselamatan ChatGPT) — SATU
// rantaian ni sekarang perlu dikongsi merentasi fail (slotsConfigRoutes.js POST /slots, tik
// penjadual server.js), bukan cuma laluan dalam fail ni. Import di atas, bukan takrif tempatan.

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

const CONTENT_STATUSES = ['approved', 'pending', 'rejected', 'archived', 'scheduled', 'dipadam'];

// Tong Sampah — bilangan hari kandungan kekal di 'dipadam' sebelum dipadam KEKAL secara automatik
// (2026-08-08, permintaan Izzat — "boleh restore semula atau padam terus dalam tempoh tertentu").
// Dikuatkuasakan oleh runSchedulingTick() (tik sama macam Jadual Terbit/Luput).
const HARI_SIMPAN_TONG_SAMPAH = 30;

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
    // Penapisan masa dibuat dalam JS (isDue), BUKAN perbandingan rentetan SQL (2026-08-12,
    // pepijat disahkan simulasi UX #29). Dahulu klausa `er.scheduledPublishAt <= ?` membanding
    // DUA FORMAT BERBEZA sebagai TEKS: nilai tersimpan ialah waktu tempatan KL berserta ofset
    // ('2026-08-12T15:09:00+08:00', ditulis oleh klLocalToIso) manakala parameternya ialah UTC 'Z'
    // (new Date().toISOString(), cth '2026-08-12T07:11:40.713Z'). SQLite membanding TEKS aksara
    // demi aksara, bukan sebagai detik masa — jadi '...T15:09...' tidak pernah dikira <=
    // '...T07:11...' walaupun saat itu SUDAH tiba. Kesannya jadual terbit tersangkut sehingga jam
    // UTC sendiri melepasi angka itu, iaitu LEWAT ~8 jam (dan boleh terlangkau ke hari berikutnya
    // untuk jadual lewat malam) — senyap sepenuhnya, UI tetap papar "scheduled" dengan yakin.
    //
    // `scheduledPublishAt` kini turut DIPILIH (dahulu tidak) supaya isDue() benar-benar dapat
    // menilainya; sebelum ni row.scheduledPublishAt sentiasa undefined lalu jatuh ke `?? nowIso`
    // yang sentiasa benar — semakan "pertahanan" itu tidak pernah menyemak apa-apa.
    // isDue() guna Date.getTime(), jadi ofset zon waktu ditafsir betul tidak kira formatnya.
    //
    // Baris 'scheduled' sentiasa sedikit (skala editorial, bukan trafik pembaca — lihat nota kunci
    // di atas), jadi menapis dalam JS tidak membebankan.
    const dueToPublish = await dbAll(`
      SELECT er.id as revisionId, er.objectId, er.title, er.scheduledPublishAt FROM editorial_revisions er
      INNER JOIN (SELECT objectId, MAX(version) as mv FROM editorial_revisions GROUP BY objectId) lv
        ON lv.objectId = er.objectId AND lv.mv = er.version
      WHERE er.status = 'scheduled' AND er.scheduledPublishAt IS NOT NULL
    `);
    for (const row of dueToPublish) {
      if (!isDue(row.scheduledPublishAt)) continue;
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

      // Pengawal `AND status = 'scheduled'` (2026-08-08, dapatan audit keselamatan ChatGPT,
      // lapisan pertahanan kedua) — tik ni kini dikunci merentasi denganKunciKandungan (utama),
      // tapi pengawal ni pastikan UPDATE tak sekali-kali tulis-ganti status yang dah berubah
      // sejak SELECT di atas tik ni bermula, walau atas sebab lain (bug masa depan/kunci gagal).
      const hasilJadual = await dbRun(
        "UPDATE editorial_revisions SET status = ?, updatedAt = ? WHERE id = ? AND status = 'scheduled'",
        [statusJadual, nowIso, row.revisionId]
      );
      if (!hasilJadual || hasilJadual.changes === 0) continue;
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
            : 'Kandungan berjadual anda kini disiarkan',
          detail: (row.title || '').slice(0, 150), targetType: 'kandungan', targetId: row.objectId,
        });
      }
    }
  } catch (err) {
    console.error('[Jadual Terbit] Ralat tik penjadual:', err.message);
  }

  // (2) Luput/arkib berjadual
  try {
    // Sama pepijat, sama pembetulan seperti (1) Terbit berjadual di atas — lihat nota penuh di
    // sana. Ini BUKAN andaian daripada corak kod yang serupa: disahkan bahawa scheduledExpiresAt
    // ditulis oleh helper YANG SAMA (klLocalToIso, IndeksConsole.tsx:329-330 menetapkan kedua-dua
    // medan sekali gus), jadi formatnya juga waktu tempatan KL + ofset '+08:00' dan perbandingan
    // rentetan terhadap UTC 'Z' rosak dengan cara yang sama persis (luput lewat ~8 jam).
    const dueToExpire = await dbAll(`
      SELECT er.id as revisionId, er.objectId, er.title, er.scheduledExpiresAt FROM editorial_revisions er
      INNER JOIN (SELECT objectId, MAX(version) as mv FROM editorial_revisions GROUP BY objectId) lv
        ON lv.objectId = er.objectId AND lv.mv = er.version
      WHERE er.status = 'approved' AND er.scheduledExpiresAt IS NOT NULL
    `);
    for (const row of dueToExpire) {
      if (!isDue(row.scheduledExpiresAt)) continue;
      // Pengawal `AND status = 'approved'` — lihat nota sama di (1) Terbit berjadual di atas.
      const hasilLuput = await dbRun(
        "UPDATE editorial_revisions SET status = 'archived', updatedAt = ? WHERE id = ? AND status = 'approved'",
        [nowIso, row.revisionId]
      );
      if (!hasilLuput || hasilLuput.changes === 0) continue;
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

  // (3) Tong Sampah — auto-padam KEKAL lepas HARI_SIMPAN_TONG_SAMPAH hari (2026-08-08,
  // permintaan Izzat). Tiada laluan pulih lepas ni — betul-betul DELETE, bukan tanda status.
  try {
    const ambangIso = new Date(Date.now() - HARI_SIMPAN_TONG_SAMPAH * 24 * 60 * 60 * 1000).toISOString();
    const dueToPurge = await dbAll(`
      SELECT er.id as revisionId, er.objectId, er.title, av.valueText as dipadamPada
      FROM editorial_revisions er
      INNER JOIN (SELECT objectId, MAX(version) as mv FROM editorial_revisions GROUP BY objectId) lv
        ON lv.objectId = er.objectId AND lv.mv = er.version
      LEFT JOIN editorial_attribute_values av
        ON av.objectId = er.objectId AND av.revisionId = er.id AND av.attributeId = 'dipadamPada'
      WHERE er.status = 'dipadam'
    `);
    for (const row of dueToPurge) {
      // TIADA cap masa dipadamPada (tak sepatutnya berlaku — laluan DELETE sentiasa catat, dan
      // PATCH disekat drpd menetapkan 'dipadam') — JANGAN padam kekal terus (2026-08-08, audit:
      // versi awal layan baris tanpa cap masa sebagai "dah tamat tempoh", bermakna satu-satunya
      // jaring keselamatan Tong Sampah terlepas serta-merta). Cap SEKARANG supaya kiraan 30 hari
      // bermula dari saat ni, sama macam baru masuk Tong Sampah.
      if (!row.dipadamPada) {
        await dbRun(
          "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, 'dipadamPada', ?)",
          [row.objectId, row.revisionId, nowIso]
        );
        continue;
      }
      if (row.dipadamPada > ambangIso) continue;
      // Pengawal sesah-semula (2026-08-08, dapatan audit keselamatan ChatGPT, lapisan
      // pertahanan kedua) — dueToPurge ialah snapshot dari SELECT awal tik ni; kunci
      // denganKunciKandungan (utama) dah pastikan tiada Pulihkan boleh berselang-seli DALAM
      // satu tik, tapi semak semula status di sini (bukan percaya snapshot buta) kekalkan invarian
      // walau kunci gagal/diubah masa depan — padam kekal MESTI batal kalau status dah berubah.
      const masihDipadam = await dbGet(
        "SELECT id FROM editorial_revisions WHERE id = ? AND status = 'dipadam'",
        [row.revisionId]
      );
      if (!masihDipadam) continue;
      // Kutip nama fail muat naik SEBELUM baris atribut dipadam (selepas itu nilainya hilang) —
      // STORAGE-002. Fail sebenar dipadam SELEPAS penulisan DB berjaya, di bawah.
      const atributSebelumPadam = await dbAll(
        "SELECT valueText FROM editorial_attribute_values WHERE objectId = ?",
        [row.objectId]
      );
      const failCalon = kutipNamaFailDariAtribut(atributSebelumPadam);
      await dbRun("DELETE FROM editorial_attribute_values WHERE objectId = ?", [row.objectId]);
      await dbRun("DELETE FROM editorial_revisions WHERE objectId = ?", [row.objectId]);
      await dbRun("DELETE FROM editorial_objects WHERE id = ?", [row.objectId]);
      if (failCalon.length > 0) {
        await padamFailMuatNaikYatim(dbGet, failCalon, { konteks: 'auto-padam-tong-sampah' });
      }
      await logAudit(dbRun, {
        actorId: null, actorName: 'Penjadual Sistem', action: 'kandungan-padam-kekal-auto-tong-sampah',
        targetType: 'kandungan', targetId: row.objectId, detail: (row.title || '').slice(0, 100),
      });
    }
  } catch (err) {
    console.error('[Tong Sampah] Ralat tik auto-padam kekal:', err.message);
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
          // Tandatangan Nota (2026-08-08, Fasa 4 pemilikan kandungan) — PERANAN sahaja
          // ("Ketua Editor"/"Penolong Ketua Editor"), bukan nama. Kosong bila penulis asal
          // kandungan sendiri yang menulis notanya — lihat gerbang di PATCH /content/:id.
          notaOleh: attrs.notaOleh || '',
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
      // 'dipadam' TIDAK boleh ditetapkan melalui PATCH (2026-08-08, audit aliran penerbitan) —
      // hanya laluan DELETE (yang berkunci manageEditorial DAN mencatat statusSebelumPadam +
      // dipadamPada) boleh hantar kandungan ke Tong Sampah. Tanpa sekatan ni, sesiapa sahaja yang
      // log masuk boleh PATCH status='dipadam' (pintas kunci), dan tanpa cap masa dipadamPada
      // penjadual auto-padam layan ia sebagai dah tamat tempoh — padam KEKAL dalam 90 saat.
      if (status === 'dipadam') {
        return res.status(400).json({ error: 'Status "dipadam" hanya melalui tindakan Padam (Tong Sampah), bukan kemas kini status terus.' });
      }

      // Ticker SENGAJA TERKECUALI daripada gerbang pemilikan + `editOwn` di bawah (2026-08-18,
      // keputusan Izzat eksplisit) — item ticker ditarik automatik daripada suapan RSS, bukan
      // tulisan editor, jadi konsep "pemilikan kandungan" tidak bermakna di sini. Ini keputusan
      // SEDAR, bukan terlepas pandang — JANGAN tambah semakan pemilikan/`editOwn` ke cawangan ni
      // tanpa arahan baharu Izzat.
      if (id.startsWith('ticker-')) {
        if (status !== undefined) {
          return res.status(400).json({ error: 'Item ticker tiada status boleh-ubah. Buang baris tu terus daripada tetapan ticker untuk menariknya balik.' });
        }
        if (scheduledPublishAt !== undefined || scheduledExpiresAt !== undefined) {
          return res.status(400).json({ error: 'Item ticker tidak menyokong Jadual Terbit/Luput, sebab ia disegarkan terus daripada suapan RSS.' });
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

      // Kandungan dalam Tong Sampah dibekukan (2026-08-08, audit aliran penerbitan) — tiada
      // suntingan/tukar status melalui PATCH; mesti Pulihkan dulu (POST /pulihkan-sampah, yang
      // kembalikan statusSebelumPadam dengan betul) atau Padam Kekal. Tanpa sekatan ni, PATCH
      // status='approved' terus boleh "menghidupkan" kandungan sampah sambil meninggalkan atribut
      // statusSebelumPadam/dipadamPada tergantung — pulihan separa yang mengelirukan.
      if (rev.status === 'dipadam') {
        return res.status(400).json({ error: 'Kandungan ni dalam Tong Sampah. Pulihkan dahulu sebelum menyunting, atau Padam Kekal.' });
      }

      // Gerbang pemilikan kandungan (2026-08-08, dapatan audit keselamatan ChatGPT P1-01a) —
      // SEBELUM ni laluan ni cuma `requireAuth`, jadi mana-mana Editor log masuk boleh PATCH
      // title/summary/desk/topik/slotIndex/source/url kandungan EDITOR LAIN, bertentangan terus
      // dengan keputusan Izzat 2026-08-08: "kandungan yg ditulis oleh editor A, hanya editor A
      // yg boleh edit, terbit, atau draf". Corak sama macam gerbang Nota Editor di bawah — Ketua
      // Editor/Penolong (manageEditorial) KEKAL penuh (tindakan Indeks — arkib/tolak/dsb. perlu
      // terus berfungsi), Editor biasa hanya boleh sunting kandungan sendiri.
      if (!hasPermission(req.session?.user?.roles, 'manageEditorial')) {
        const penulisSedia = await penulisAsalKandungan(dbGet, id, rev.id);
        const namaSayaSedia = namaSayaSesi(req);
        if (!namaSepadan(penulisSedia, namaSayaSedia)) {
          return res.status(403).json({
            error: 'Kandungan ni ditulis editor lain — anda tiada kebenaran menyuntingnya. Hubungi Ketua Editor/Penolong Ketua Editor.',
          });
        }

        // Togol `editOwn` "Edit Sendiri" (2026-08-18, keputusan Izzat) — sengaja SEMPIT, hanya
        // menembak bila permintaan ni benar-benar UBAH MEDAN KANDUNGAN (tajuk/huraian/atribut).
        // Peralihan status (Terbit/Arkib) sudah digerbang `publish` (di bawah), dan Nota Editor
        // sudah digerbang sendiri (bawah ni juga) — kedua-duanya TAK boleh ikut terkunci sekali
        // bila `editOwn=false`, kalau tidak togol tu bercanggah dengan togol `publish`/
        // `manageEditorNotes` yang Ketua Editor mungkin sengaja biarkan hidup. "Edit Sendiri"
        // bermaksud menyunting yang SEDIA ADA sahaja.
        const adaMedanKandungan = [title, summary, desk, source, url, imageUrl, topik, briefLong, originalDate]
          .some((v) => v !== undefined);
        if (adaMedanKandungan && !hasPermission(req.session?.user?.roles, 'editOwn')) {
          return res.status(403).json({
            error: 'Anda tiada kebenaran menyunting kandungan — Edit Sendiri dinyahaktifkan untuk peranan anda. Hubungi Ketua Editor/Penolong Ketua Editor.',
          });
        }
      }

      // Gerbang Nota Editor (2026-08-08, Fasa 4 pemilikan kandungan, keputusan Izzat) — "ketua
      // editor dan penolong hanya boleh akses di indeks... jika perlu tulis nota editor, dia
      // boleh tulis kat situ. dan di nota editor tu perlu terpapar tandatangan Ketua Editor atau
      // Penolong Ketua Editor sahaja. kalau editor yg tulis kandungan tu sendiri yg buat nota,
      // takyah tandatangan." Nota kandungan yang SUDAH TERBIT cuma boleh ditulis (a) penulis asal
      // (attribute 'editorName', dicap semasa Terbit) — tiada tandatangan, ni suara dia sendiri,
      // atau (b) Ketua Editor/Penolong (manageEditorial) — tandatangan PERANAN sahaja, bukan nama.
      // Editor lain (bukan penulis, bukan KE/Penolong) tak boleh sentuh nota kandungan ni langsung.
      let notaOlehBaharu;
      if (note !== undefined) {
        const penulisAsal = await penulisAsalKandungan(dbGet, id, rev.id);
        const sayaKetuaEditorAtauPenolong = hasPermission(req.session?.user?.roles, 'manageEditorial');
        const sayaPenulisAsal = namaSepadan(penulisAsal, namaSayaSesi(req));
        if (!sayaPenulisAsal && !sayaKetuaEditorAtauPenolong) {
          return res.status(403).json({
            error: 'Nota Editor cuma boleh ditulis penulis asal kandungan ini atau Ketua Editor/Penolong Ketua Editor, daripada Indeks.',
          });
        }
        notaOlehBaharu = sayaPenulisAsal
          ? ''
          : ((req.session?.user?.roles || []).includes('ketua_editor') ? 'Ketua Editor' : 'Penolong Ketua Editor');
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
            error: 'Dasar semasa: Editor perlu kelulusan Ketua Editor/Penolong Ketua Editor untuk terbit. Kandungan kekal Menunggu sehingga disemak.',
          });
        }
        const bendera = await dbGet(
          "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'pernahDitolak'",
          [id, rev.id]
        );
        if (bendera && bendera.valueText === '1') {
          return res.status(403).json({
            error: 'Kandungan ni pernah ditolak sebelum ini, jadi perlu kelulusan Ketua Editor/Penolong Ketua Editor untuk terbit semula, bukan Editor sendiri.',
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
              error: 'Tak boleh tetapkan tarikh luput sebab ni satu-satunya kandungan slot ni. Sedia kandungan gantian dalam giliran dulu.',
            });
          }
        }

        // Cuma sah semula bajet bila tajuk/huraian/slot BENAR-BENAR disentuh PATCH ni (2026-08-08,
        // pepijat kritikal Izzat) — sebelum ni disemak semula pada SETIAP PATCH termasuk tindakan
        // status-sahaja (Arkib/Tolak/Siar tanpa ubah kandungan). Akibatnya: kandungan lama yang
        // dicipta SEBELUM had minimum huraian (MIN_BRIEF_USAGE_FRACTION) wujud terperangkap —
        // langsung tak boleh diarkibkan/ditolak, sebab semakan retroaktif tu gagal walaupun
        // kandungan sebenarnya tak disentuh. Status-sahaja tak pernah boleh menyebabkan limpahan
        // kad (teks tak berubah), jadi tiada sebab sah semula bajet untuk laluan tu.
        const nextTitle = title !== undefined ? title : rev.title;
        const nextSummary = summary !== undefined ? summary : rev.summary;
        const sentuhKandunganAtauSlot = title !== undefined || summary !== undefined || slotIndex !== undefined;

        // Kandungan sedia ada DIKECUALIKAN daripada had yang DIKETATKAN kemudian (2026-08-16,
        // keputusan Izzat: "kandungan yg dah terbit ... tak perlu patuh had aksara baru; hanya
        // kandungan baharu yg perlu patuh"). Senario sebenar yang dilaporkan: kandungan disiarkan
        // ketika had lama, Ketua Editor ketatkan had di Tetapan Slot, kemudian SEBARANG suntingan
        // kandungan tu (walau sekadar betulkan satu ejaan) ditolak selamanya — kandungan
        // terperangkap, tak boleh dibaiki langsung, sedangkan versi lamanya TETAP hidup di halaman
        // awam. Corak sama seperti pengecualian status-sahaja di bawah nota atas.
        //
        // Ujian pengecualian: adakah kandungan TERSIMPAN (sebelum suntingan ni) SUDAH pun gagal
        // had SEMASA? Kalau ya, ia diterbitkan bawah had LAMA yang lebih longgar — bukan salah
        // editor — jadi had baharu tak dikuatkuasakan ke atasnya. Kalau kandungan tersimpan masih
        // LULUS had semasa, penguatkuasaan kekal penuh: itu bermakna suntingan INI sendiri yang
        // buat ia melebihi had (bukan pindaan had), dan itu memang patut disekat supaya editor
        // tak boleh merosakkan susun atur kad yang sedang elok.
        const lulusSebelumSunting = validateContentBudget(targetSlotIndex, rev.title || '', rev.summary || '').isValid;
        const budgetCheck = sentuhKandunganAtauSlot && lulusSebelumSunting
          ? validateContentBudget(targetSlotIndex, nextTitle, nextSummary)
          : { isValid: true };
        if (!budgetCheck.isValid) {
          // Ayat akibat yang BETUL untuk laluan ni (2026-08-16, pepijat Izzat) — kandungan LAMA
          // kekal disiarkan, cuma suntingan ditolak. ContentBudget.js sengaja tak lagi menyatakan
          // akibat sendiri, lihat nota di situ.
          return res.status(400).json({
            error: `${budgetCheck.reason} Suntingan tidak disimpan — versi sedia ada kekal disiarkan seperti sebelum ini.`,
          });
        }

        // Had MINIMUM huraian panjang (2026-08-07, permintaan Izzat) — sama penguatkuasaan
        // seperti laluan Terbitkan (server.js syncManualObjectsForSlot). Hanya terpakai bila
        // `briefLong` BENAR-BENAR dihantar dalam PATCH ni (medan tak disentuh, tak disemak).
        // Pengecualian had-diketatkan sama seperti bajet kad di atas (2026-08-16). Medan ni
        // (briefLong/source/topik/note) TIDAK wujud sebagai lajur `editorial_revisions` — ia
        // disimpan dalam `editorial_attribute_values` (rujuk skema server.js), jadi nilai lama
        // MESTI dibaca dari situ; `rev.briefLong` sentiasa undefined dan akan senyap melumpuhkan
        // pengecualian ni tanpa sebarang ralat.
        const nilaiLamaRows = await dbAll(
          `SELECT attributeId, valueText FROM editorial_attribute_values
           WHERE objectId = ? AND revisionId = ? AND attributeId IN ('briefLong','source','topik','note')`,
          [id, rev.id]
        );
        const nilaiLama = Object.fromEntries(nilaiLamaRows.map((r) => [r.attributeId, r.valueText || '']));

        const briefLongLamaGagalMin = !!(nilaiLama.briefLong && nilaiLama.briefLong.trim()
          && nilaiLama.briefLong.length < effectiveMinBriefLong());
        if (!briefLongLamaGagalMin && briefLong !== undefined && briefLong && briefLong.trim() && briefLong.length < effectiveMinBriefLong()) {
          return res.status(400).json({
            error: `Huraian panjang terlalu pendek (${briefLong.length} aksara, minimum ${effectiveMinBriefLong()}). Panjangkan huraian atau kosongkan terus medan ni.`,
          });
        }

        // Had aksara medan bukan-kad (Tetapan Am Slot). Hanya medan yang benar-benar dihantar
        // disemak — kemas kini separa tak boleh ditolak kerana medan yang tak disentuh.
        // Pengecualian had-diketatkan sama seperti di atas (2026-08-16).
        const medanLamaGagal = !validateMedanTambahan({
          summaryLong: nilaiLama.briefLong, source: nilaiLama.source,
          topik: nilaiLama.topik, note: nilaiLama.note,
        }).isValid;
        const medanCheck = medanLamaGagal
          ? { isValid: true }
          : validateMedanTambahan({ summaryLong: briefLong, source, topik, note });
        if (!medanCheck.isValid) {
          return res.status(400).json({ error: `${medanCheck.reason} Suntingan tidak disimpan — versi sedia ada kekal disiarkan seperti sebelum ini.` });
        }

        // Had nisbah gloss interlinear (2026-08-12, keputusan Izzat) — lihat nota ContentBudget.js.
        // Hanya medan yang benar-benar dihantar dlm PATCH ni disemak (selaras medanCheck di atas).
        const glossCheck = validateGlossLength({
          Tajuk: title, 'Huraian ringkas': summary, 'Huraian panjang': briefLong,
        });
        if (!glossCheck.isValid) {
          return res.status(400).json({ error: glossCheck.reason });
        }

        // Format sumber (Fasa 8b) — URL sumber mesti sekurang-kurangnya rupa URL sah kalau diisi.
        const urlCheck = validateSourceUrl(url);
        if (!urlCheck.isValid) {
          return res.status(400).json({ error: urlCheck.reason });
        }
        // Nama sumber placeholder + format Tarikh sumber (2026-08-19, pepijat sebenar Izzat —
        // lihat nota penuh di ContentBudget.js) — laluan suntingan kandungan sedia ada patut
        // tertakluk semakan sama seperti laluan Terbit baharu, kalau tidak editor boleh
        // "membaiki" kandungan lama dengan menyimpan placeholder yang sama, terlepas gerbang ni.
        const namaCheck = validateSumberNama(source);
        if (!namaCheck.isValid) {
          return res.status(400).json({ error: namaCheck.reason });
        }
        const tarikhCheck = validateTarikhSumber(originalDate);
        if (!tarikhCheck.isValid) {
          return res.status(400).json({ error: tarikhCheck.reason });
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

      // Jadual Terbit — status berkesan bagi kedua-dua arah (SET automatik jadi 'scheduled', BATAL
      // pulih ke 'approved') dikira oleh resolveEffectiveStatus() (core/editorial/Scheduling.js) —
      // satu sumber kebenaran kongsi supaya diuji terus tanpa DB/HTTP (tests/scheduling.test.js).
      // Status eksplisit yang client hantar sentiasa dihormati (cth padam jadual serentak paksa
      // 'approved') — lihat komen di fungsi tu utk sejarah pepijat #36.2.
      let effectiveStatus = resolveEffectiveStatus({ scheduledPublishAt, status, currentStatus: rev.status });
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

      // Satu transaksi untuk keseluruhan fasa tulis PATCH: revisi baharu (edit kandungan) +
      // salinan atribut lama + kemas kini atribut + kemas kini objek (PIPELINE-TRANSACTION-001,
      // audit #46.10/#47.7, dibaiki 2026-08-13). Sebelum ni setiap penulisan auto-commit
      // sendiri — kegagalan separuh jalan tinggalkan revisi baharu TANPA atribut (Bidang/URL/
      // sumber hilang senyap) sambil editor nampak "Gagal kemas kini" dan berkemungkinan cuba
      // lagi. Corak sama seperti laluan pulih-versi di bawah (BEGIN/COMMIT/ROLLBACK). Nota:
      // incrementCategoryUsage kekal try/catch dalaman (kegagalan kaunter TIDAK menggagalkan
      // transaksi — kelakuan sedia ada dikekalkan).
      // Nilai Bidang/Topik SEBELUM tulisan (AUDIT-003, audit #45.12) — dibaca di luar transaksi
      // supaya masih boleh dirujuk selepas COMMIT untuk log audit di bawah. Baca daripada revisi
      // SEMASA (rev.id): itulah nilai yang editor sebenarnya lihat sebelum menyunting.
      const bidangSebelumRow = await dbGet(
        "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'desk'",
        [id, rev.id]
      );
      const topikSebelumRow = await dbGet(
        "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'topik'",
        [id, rev.id]
      );
      const bidangSebelum = (bidangSebelumRow?.valueText || objRow?.categoryId || '').trim();
      const topikSebelum = (topikSebelumRow?.valueText || '').trim();

      await dbRun('BEGIN TRANSACTION');
      try {
        if (isContentEdit) {
          const maxVersionRow = await dbGet('SELECT MAX(version) AS maxVersion FROM editorial_revisions WHERE objectId = ?', [id]);
          const nextVersion = (maxVersionRow && maxVersionRow.maxVersion ? maxVersionRow.maxVersion : 0) + 1;
          const newTitle = title !== undefined ? title : rev.title;
          const newSummary = summary !== undefined ? summary : rev.summary;
          const newStatus = effectiveStatus !== undefined ? effectiveStatus : rev.status;
          // createdBy (2026-08-07, pepijat kritikal Izzat) — token LALUAN ("manual-slot-save",
          // "content-review", dll — jawab *macam mana* dicipta, bukan *siapa*, lihat nota
          // pendaftaran attribute 'editorName' di server.js), BUKAN nama pengguna sebenar. Sebelum
          // ni PATCH ni tulis ganti dengan `req.session.user.username` — kandungan Manual yang
          // pernah diedit (cth Ketua Editor betulkan taip salah) dapat createdBy="izzatanas", tak
          // sepadan senarai putih resolveSlotContent() (server.js, mod Manual: createdBy IN
          // ('manual-slot-save', 'migration-manual-blob', 'content-review')) — kandungan tu terus
          // TAK KELIHATAN pada frontpage LANGSUNG selepas diedit, walaupun status kekal 'approved'
          // dan UI admin nampak normal. Warisi token ASAL revisi lama, bukan cipta baharu — identiti
          // penyunting sebenar sudah direkod berasingan dalam attribute 'editorName'.
          const newRev = await dbRun(
            `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt, scheduledPublishAt, scheduledExpiresAt)
             VALUES (?, ?, 'ms', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, nextVersion, newTitle, newSummary, newStatus, rev.createdBy || 'content-review', nowIso, nowIso, nextScheduledPublishAt, nextScheduledExpiresAt]
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

        const attrCandidates = { desk, source, url, imageUrl, topik, briefLong, originalDate, note, notaOleh: notaOlehBaharu };
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
        await dbRun('COMMIT');
      } catch (e) {
        try {
          await dbRun('ROLLBACK');
        } catch (rollbackErr) {
          console.error('Rollback gagal selepas ralat kemas kini kandungan:', rollbackErr.message);
        }
        throw e;
      }

      // Log Audit taksonomi (AUDIT-003, audit #45.12, ditambah 2026-08-13) — pertukaran Bidang
      // atau Topik MENGUBAH MAKNA EDITORIAL kandungan (ia berpindah kategori di mata pembaca,
      // tukar warna identiti, tukar hasil carian) tapi dahulu langsung tiada jejak: gerbang audit
      // sedia ada cuma memicu pada perubahan STATUS, jadi tukar Bidang tanpa tukar status
      // meninggalkan sifar rekod siapa/bila/dari-apa-ke-apa. Ini BUKAN sama dengan sejarah versi —
      // versi menyimpan KEADAAN kandungan, audit menjawab siapa membuat TINDAKAN dan bila.
      // Dicatat hanya bila nilai benar-benar BERUBAH (bukan setiap simpanan yang kebetulan
      // menghantar semula nilai sama), selaras falsafah "jangan satu baris log setiap ketikan".
      const bidangSelepas = desk !== undefined ? String(desk).trim() : bidangSebelum;
      const topikSelepas = topik !== undefined ? String(topik).trim() : topikSebelum;
      const bidangBerubah = bidangSelepas.toUpperCase() !== bidangSebelum.toUpperCase();
      const topikBerubah = topikSelepas !== topikSebelum;
      if (bidangBerubah || topikBerubah) {
        const bahagian = [];
        if (bidangBerubah) bahagian.push(`Bidang: ${bidangSebelum || '(kosong)'} -> ${bidangSelepas || '(kosong)'}`);
        if (topikBerubah) bahagian.push(`Topik: ${topikSebelum || '(kosong)'} -> ${topikSelepas || '(kosong)'}`);
        await logAudit(dbRun, {
          actorId: req.session?.user?.id,
          actorName: req.session?.user?.penName || req.session?.user?.username,
          action: 'kemas-kini-taksonomi',
          targetType: 'kandungan',
          targetId: id,
          detail: bahagian.join(' | ').slice(0, 200),
        });
      }

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
          // Elak notifikasi bertindih dgn toast (2026-08-16, "notification hygiene" — permintaan
          // Izzat + audit ChatGPT) — editor yang SENDIRI tekan Terbit dah nampak toast serta-merta,
          // notifikasi lewat dalam Peti Makluman untuk perkara sama cuma bunyi bising berganda.
          // Editor LAIN yang diamanahkan slot sama (kongsi slot) TETAP terima — mereka tak nampak
          // toast tu.
          const penerimaBukanDiri = (editorRows || []).map((r) => r.editorId).filter((eid) => eid !== req.session?.user?.id);
          await notifyMany(dbRun, penerimaBukanDiri, {
            type: 'kandungan_disiar',
            title: 'Kandungan anda telah disiarkan',
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

      // Pulangkan status MUKTAMAD (#33.2-A, 2026-08-13) — sebelum ni respons PATCH tak sebut
      // status langsung, jadi client terpaksa MENEKA peraturan peralihan status server sendiri.
      // Tekaan itu tidak lengkap: IndeksConsole hanya menaik taraf baris ke 'Scheduled' bila
      // status semasa 'Pending', sedangkan server menjadikan kandungan 'scheduled' walaupun ia
      // sedang 'approved' — jadi menetapkan jadual pada kandungan AKTIF meninggalkan senarai
      // Indeks memapar "Aktif" sedangkan rekod sebenar sudah 'scheduled' (baris kekal dalam
      // penapis Aktif sehingga muat semula penuh). Dibaca terus daripada revisi TERKINI SEBENAR
      // (corak NOT EXISTS sama seperti laluan awam) supaya betul untuk KEDUA-DUA cabang: edit
      // kandungan (revisi baharu) dan tindakan status-sahaja (kemas kini di tempat).
      const revStatusAkhir = await dbGet(
        `SELECT status FROM editorial_revisions er1
         WHERE er1.objectId = ?
           AND NOT EXISTS (SELECT 1 FROM editorial_revisions er2 WHERE er2.objectId = er1.objectId AND er2.version > er1.version)`,
        [id]
      );

      res.json({
        success: true,
        status: revStatusAkhir ? revStatusAkhir.status : undefined,
        slotPenuh: sebabMenungguBaharu === 'slot_penuh',
        ...(notaOlehBaharu !== undefined ? { notaOleh: notaOlehBaharu } : {}),
      });
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
        return res.status(400).json({ error: 'Item ticker tiada sejarah versi, sebab ia disegarkan terus daripada suapan RSS.' });
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
  // Gerbang + kunci + transaksi (2026-08-07, Pelan 02 #3): dahulu laluan ni `requireAuth` sahaja,
  // sedangkan memulihkan versi berstatus 'approved' ialah tindakan TERBIT — sama kesannya seperti
  // PATCH /content/:id yang menaikkan status ke 'approved', jadi kunci `publish` yang sama dipakai.
  // Ia juga disiri-kan dengan denganKunciKandungan (perlumbaan baca-kiraan/tulis-status yang sama)
  // dan dibungkus satu transaksi supaya revisi baharu tidak pernah wujud tanpa atributnya.
  router.post('/content/:id/revisions/:revisionId/restore', requireAuth, (req, res) => denganKunciKandungan(async () => {
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

      // Kandungan dalam Tong Sampah dibekukan (2026-08-08, audit aliran penerbitan) — memulihkan
      // VERSI lama akan mencipta revisi baharu (versi tertinggi) berstatus approved/pending,
      // menghidupkan semula objek yang dipadam sambil memintas laluan Pulihkan rasmi. Sama
      // sekatan macam PATCH: Pulihkan dulu, baru sunting/pulih versi.
      const revTerkini = await dbGet(
        "SELECT id, status FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1",
        [id]
      );
      if (revTerkini && revTerkini.status === 'dipadam') {
        return res.status(400).json({ error: 'Kandungan ni dalam Tong Sampah. Pulihkan dahulu sebelum memulihkan versi lama.' });
      }

      // Gerbang pemilikan + `editOwn` (2026-08-18) — laluan ni MENCIPTA REVISI BAHARU daripada
      // teks versi lama, iaitu suntingan kandungan PENUH (sama kesan seperti PATCH title/summary
      // di atas), tapi sebelum ni langsung TIADA semakan pemilikan mahupun `editOwn` — mana-mana
      // editor log masuk boleh memulihkan versi lama kandungan EDITOR LAIN, bertentangan terus
      // dengan keputusan Izzat 2026-08-08 yang gerbang pemilikan PATCH dibina untuk kuatkuasakan.
      // Dibaiki menggunakan revisi TERKINI (bukan revisi lama yang dipulihkan) sebagai rujukan
      // pemilikan — penulis kandungan sekarang, bukan siapa menulis versi lama tu.
      if (!hasPermission(req.session?.user?.roles, 'manageEditorial')) {
        const penulisSedia = await penulisAsalKandungan(dbGet, id, revTerkini ? revTerkini.id : oldRev.id);
        if (!namaSepadan(penulisSedia, namaSayaSesi(req))) {
          return res.status(403).json({
            error: 'Kandungan ni ditulis editor lain — anda tiada kebenaran memulihkan versi lamanya. Hubungi Ketua Editor/Penolong Ketua Editor.',
          });
        }
        if (!hasPermission(req.session?.user?.roles, 'editOwn')) {
          return res.status(403).json({
            error: 'Anda tiada kebenaran menyunting kandungan — Edit Sendiri dinyahaktifkan untuk peranan anda. Hubungi Ketua Editor/Penolong Ketua Editor.',
          });
        }
      }

      // Versi lama berstatus 'approved' terus terbit semula apabila dipulihkan — jadi ia perlukan
      // kebenaran `publish` yang sama seperti laluan kelulusan lain.
      if (oldRev.status === 'approved' && !hasPermission(req.session?.user?.roles, 'publish')) {
        return res.status(403).json({
          error: 'Anda tiada kebenaran untuk memulihkan versi yang terus terbit. Minta Ketua Editor/Penolong Ketua Editor.',
        });
      }

      const budgetCheck = validateContentBudget(objRow.slotIndex, oldRev.title || '', oldRev.summary || '');
      if (!budgetCheck.isValid) {
        return res.status(400).json({ error: `Versi ini tak boleh dipulihkan: ${budgetCheck.reason}` });
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
          return res.status(400).json({ error: `Versi ini tak boleh dipulihkan: ${bidangTopikCheck.reason}` });
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

      // Satu transaksi untuk keseluruhan pulihan: revisi baharu + salinan atribut (Bidang, Topik,
      // URL, sumber) + kemas kini objek. Kegagalan separuh jalan dahulu meninggalkan revisi tanpa
      // atribut — Bidang/URL/sumber hilang senyap.
      await dbRun('BEGIN TRANSACTION');
      let newRevId;
      try {
        // createdBy WARIS token laluan asal (bukan req.session.user.username) — SAMA pepijat
        // kritikal 2026-08-07 yang dibetulkan di PATCH /content/:id (lihat nota di situ), tapi
        // laluan pulih-versi ni terlepas fix asal, ditemui 2026-08-16 selepas fix duplikasi
        // carousel resolveSlotContent() (server.js): objek yang dipulihkan pakai createdBy=
        // nama pengguna sebenar (cth "izzat") tak pernah lulus senarai putih Mod Manual
        // (createdBy IN ('manual-slot-save', 'migration-manual-blob', 'content-review')) di
        // resolveSlotContent() — kandungan pulihan terus TAK KELIHATAN pada frontpage awam
        // LANGSUNG walaupun status kekal 'approved' dan UI admin nampak normal (sama corak
        // kegagalan senyap macam pepijat 2026-08-07 asal, cuma laluan berbeza). Identiti
        // penyunting sebenar sudah direkod berasingan dalam attribute 'editorName'.
        const newRev = await dbRun(
          `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
           VALUES (?, ?, 'ms', ?, ?, ?, ?, ?, ?)`,
          [id, nextVersion, oldRev.title, oldRev.summary, statusPulihan, oldRev.createdBy || 'content-review', nowIso, nowIso]
        );
        newRevId = newRev.lastID;

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
        await dbRun('COMMIT');
      } catch (e) {
        try {
          await dbRun('ROLLBACK');
        } catch (rollbackErr) {
          console.error('Rollback gagal selepas ralat pulih versi:', rollbackErr.message);
        }
        throw e;
      }

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
  }));

  // POST /api/system/content/:id/pulihkan-sampah — "Pulihkan" dalam Tong Sampah (2026-08-08,
  // permintaan Izzat). Cuma sah bila status SEMASA ialah 'dipadam'; kembalikan ke
  // statusSebelumPadam yang disimpan semasa DELETE /content/:id (bukan andaian tegar 'archived')
  // supaya kandungan pulih tepat macam sebelum dipadam. Dikunci manageEditorial (kebenaran) DAN
  // denganKunciKandungan (mutasi) — dahulu cuma kebenaran, jadi auto-purge Tong Sampah (tik
  // penjadual server.js, kini turut dalam kunci sama) boleh berselang-seli dengan Pulihkan ni:
  // Pulihkan tukar status ke 'archived', tapi purge yang sedang mengimbas snapshot LAMA (masih
  // nampak 'dipadam') terus PADAM KEKAL kandungan yang baru sahaja berjaya dipulihkan. Dapatan
  // audit keselamatan ChatGPT 2026-08-08.
  router.post('/content/:id/pulihkan-sampah', requirePermission('manageEditorial'), (req, res) => denganKunciKandungan(async () => {
    try {
      const { id } = req.params;
      const rev = await dbGet("SELECT * FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1", [id]);
      if (!rev) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }
      if (rev.status !== 'dipadam') {
        return res.status(400).json({ error: 'Kandungan ni tiada dalam Tong Sampah.' });
      }
      const statusSebelumRow = await dbGet(
        "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'statusSebelumPadam'",
        [id, rev.id]
      );
      const statusPulihan = (statusSebelumRow && CONTENT_STATUSES.includes(statusSebelumRow.valueText))
        ? statusSebelumRow.valueText
        : 'archived';
      await dbRun("UPDATE editorial_revisions SET status = ?, updatedAt = ? WHERE id = ?", [statusPulihan, new Date().toISOString(), rev.id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'pulihkan-kandungan-tong-sampah',
        targetType: 'kandungan',
        targetId: id,
        detail: (rev.title || '').slice(0, 100),
      });
      res.json({ success: true, status: statusPulihan });
    } catch (err) {
      console.error('Pulihkan Tong Sampah error:', err);
      res.status(500).json({ error: 'Gagal memulihkan kandungan. ' + (err.message || '') });
    }
  }));

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
  // denganKunciKandungan (2026-08-08, dapatan audit keselamatan ChatGPT) — dahulu laluan ni
  // TIADA kunci mutasi langsung (cuma gerbang kebenaran), walhal ia baca-ubah-tulis
  // slots_config.manualSummary yang SAMA-SAMA disentuh PATCH/DELETE/POST kandungan lain (yang
  // semuanya DAH dikunci). Dua Tolak berselang-seli pada slot SAMA (dua kandungan ditolak hampir
  // serentak) baca manualSummary lama yang SAMA, tulis draf masing-masing berasingan — draf yang
  // ditulis dulu HILANG terus, ditimpa draf kedua (bukan kedua-duanya tergabung).
  router.post('/content/:id/reject-to-draft', requirePermission('reject'), (req, res) => denganKunciKandungan(async () => {
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
      // Sebab kini WAJIB (2026-08-18, keputusan Izzat) — gerbang pelayan ni pertahanan LAPISAN
      // KEDUA (client — IndeksConsole.tsx — dah kunci butang sehingga diisi), bukan satu-satunya
      // semakan; laluan API boleh dipanggil terus (skrip/alat luar) memintas UI, jadi pelayan
      // MESTI tolak sendiri, bukan percaya client sahaja.
      if (!sebab) {
        return res.status(400).json({ error: 'Sebab penolakan wajib diisi — penulis asal perlu tahu apa isunya.' });
      }
      const notaGabungan = `Sebab ditolak: ${sebab}${attrs.note ? `. Nota: ${attrs.note}` : ''}`;

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
        return res.status(500).json({ error: 'Draf gagal disimpan. Kandungan asal TIDAK diarkibkan, tiada apa hilang. Cuba lagi.' });
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
      const penerimaIds = (penulisRow
        ? [penulisRow.id]
        : (await dbAll('SELECT editorId FROM slot_editors WHERE slotIndex = ?', [objRow.slotIndex])).map((r) => r.editorId))
        // Elak notifikasi bertindih dgn toast (2026-08-16, "notification hygiene") — kalau penulis
        // asal sendiri yang tolak kandungannya (retract sendiri), dia dah nampak toast, tak perlu
        // notifikasi lewat untuk perkara sama.
        .filter((eid) => eid !== req.session?.user?.id);
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
  }));

  // DELETE /api/system/content/:id
  // Dikunci sama seperti PATCH (2026-08-07, Pelan 02 #8): cabang ticker di bawah membuat
  // baca-ubah-tulis pada satu medan teks `system_settings.inTheNewsText`, jadi dua permintaan
  // serentak boleh menimpa satu sama lain dan item ticker hilang senyap.
  router.delete('/content/:id', requireAuth, (req, res) => denganKunciKandungan(async () => {
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

      // TONG SAMPAH (diubah 2026-08-08, keputusan Izzat — sebelum ni kandungan diterbitkan/
      // diarkibkan LANGSUNG tak boleh dipadam, cuma draf; kini boleh, tapi lembut dulu, bukan
      // terus hilang — "boleh restore semula atau padam terus dalam tempoh tertentu"). Panggilan
      // PERTAMA pada kandungan bukan-'dipadam' hantar ke Tong Sampah (status='dipadam', boleh
      // dipulihkan). Panggilan KEDUA (kandungan yang DAH pun 'dipadam') padam KEKAL sebenar —
      // tiada laluan pulih lepas ni. Auto-padam kekal lepas 30 hari dikuatkuasakan
      // runSchedulingTick(). Dikunci Ketua Editor/Penolong Ketua Editor sahaja (manageEditorial,
      // sama kunci "Terbit sekarang" tanpa kelulusan) — tindakan padam kekal tak boleh dibuat
      // asal (tiada backup DB boleh dipercayai, CLAUDE.md), Editor biasa guna Arkib sahaja.
      const wujud = await dbGet("SELECT id, slotIndex FROM editorial_objects WHERE id = ?", [id]);
      if (!wujud) {
        return res.status(404).json({ error: 'Item tidak dijumpai.' });
      }
      if (!hasPermission(req.session?.user?.roles, 'manageEditorial')) {
        return res.status(403).json({
          error: 'Padam kandungan diterbitkan/diarkibkan hanya untuk Ketua Editor/Penolong Ketua Editor. Editor guna Arkib sebaliknya.',
        });
      }
      const revSemasa = await dbGet(
        "SELECT id, status, title FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1",
        [id]
      );
      if (revSemasa && revSemasa.status === 'dipadam') {
        // Panggilan KEDUA — dah dalam Tong Sampah, ni padam KEKAL sebenar.
        // Kutip nama fail muat naik SEBELUM baris atribut dipadam (selepas itu nilainya hilang)
        // — STORAGE-002. Fail sebenar dipadam SELEPAS penulisan DB berjaya, di bawah.
        const atributSebelumPadam = await dbAll(
          "SELECT valueText FROM editorial_attribute_values WHERE objectId = ?",
          [id]
        );
        const failCalon = kutipNamaFailDariAtribut(atributSebelumPadam);
        await dbRun("DELETE FROM editorial_attribute_values WHERE objectId = ?", [id]);
        await dbRun("DELETE FROM editorial_revisions WHERE objectId = ?", [id]);
        await dbRun("DELETE FROM editorial_objects WHERE id = ?", [id]);
        if (failCalon.length > 0) {
          await padamFailMuatNaikYatim(dbGet, failCalon, { konteks: 'padam-kekal-manual' });
        }
        await logAudit(dbRun, {
          actorId: req.session?.user?.id,
          actorName: req.session?.user?.penName || req.session?.user?.username,
          action: 'padam-kandungan-kekal',
          targetType: 'kandungan',
          targetId: id,
          detail: (revSemasa.title || '').slice(0, 100),
        });
        return res.json({ success: true, kekal: true });
      }
      // Panggilan PERTAMA — hantar ke Tong Sampah. statusSebelumPadam disimpan supaya Pulihkan
      // boleh kembalikan status TEPAT sebelum ni (Aktif/Menunggu/Arkib), bukan andaian tegar.
      await dbRun("UPDATE editorial_revisions SET status = 'dipadam', updatedAt = ? WHERE id = ?", [new Date().toISOString(), revSemasa.id]);
      await dbRun(
        "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, 'statusSebelumPadam', ?)",
        [id, revSemasa.id, revSemasa.status]
      );
      await dbRun(
        "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, 'dipadamPada', ?)",
        [id, revSemasa.id, new Date().toISOString()]
      );
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'padam-kandungan-tong-sampah',
        targetType: 'kandungan',
        targetId: id,
        detail: (revSemasa.title || '').slice(0, 100),
      });
      // Slot berkosong (2026-08-08, audit aliran penerbitan) — padam-lembut kandungan Aktif
      // bebaskan satu ruang 'approved', sama macam Arkib/Tolak/Luput (yang kesemuanya panggil
      // promosi ni); tanpa panggilan ni kandungan beratur 'slot_penuh' kekal tersekat sampai
      // peristiwa lain berlaku. Kunci promosi per-slot berasingan drpd kunci kandungan — selamat.
      if (revSemasa.status === 'approved') {
        await promosikanMenungguSlotKosong(dbAll, dbGet, dbRun, wujud.slotIndex).catch((e) => {
          console.warn('Gagal naik taraf kandungan slot-berkosong (Padam):', e.message);
        });
      }
      return res.json({ success: true, kekal: false });
    } catch (err) {
      console.error('Delete content item error:', err);
      res.status(500).json({ error: 'Gagal memadam kandungan. ' + (err.message || '') });
    }
  }));

  // POST /api/system/content
  // Dikunci sama seperti PATCH/DELETE (2026-08-07, Pelan 02 #8): cabang ticker menulis semula
  // keseluruhan `inTheNewsText`, dan semakan hadKandunganSlot di bawah pula membaca kiraan
  // sebelum menulis — kedua-duanya perlumbaan baca-ubah-tulis.
  router.post('/content', requireAuth, (req, res) => denganKunciKandungan(async () => {
    try {
      const { slotIndex, title, summary, desk, source, url, imageUrl, topik } = req.body;
      if (slotIndex === undefined || slotIndex === null) {
        return res.status(400).json({ error: 'Nombor slot tiada.' });
      }
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Tajuk diperlukan.' });
      }

      // Gerbang penugasan slot (2026-08-08, dapatan audit keselamatan ChatGPT P1-01b) — laluan
      // legasi ni terus INSERT status='approved' tanpa semak slot_editors LANGSUNG, jadi mana-mana
      // Editor log masuk boleh cipta kandungan aktif terus dalam slot SESIAPA sahaja (pintas
      // sepenuhnya gerbang penugasan slot Fasa 2, POST /slots di slotsConfigRoutes.js). Tiada
      // pemanggil UI sedia ada guna laluan ni (disahkan: sifar padanan fetch('/api/system/content')
      // tanpa ID di src/), tapi endpoint tetap tercapai terus via API — gerbang yang sama diguna
      // pakai di sini utk konsisten dgn laluan penulisan slot yang lain.
      if (slotIndex !== -1 && !hasPermission(req.session?.user?.roles, 'manageEditorial')) {
        const userId = req.session?.user?.id;
        const ditugaskan = userId
          ? await dbAll('SELECT 1 FROM slot_editors WHERE slotIndex = ? AND editorId = ?', [slotIndex, userId])
          : [];
        if (ditugaskan.length === 0) {
          return res.status(403).json({ error: `Anda tidak ditugaskan untuk Slot ${slotIndex + 1}. Hubungi Ketua Editor kalau slot ni sepatutnya milik anda.` });
        }
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

      // Had nisbah gloss interlinear (2026-08-12, keputusan Izzat) — lihat nota ContentBudget.js.
      // Laluan cipta ni tiada medan briefLong (PATCH berasingan selepas cipta), jadi Tajuk+Huraian
      // ringkas sahaja disemak di sini.
      const glossCheck = validateGlossLength({ Tajuk: title, 'Huraian ringkas': summary });
      if (!glossCheck.isValid) {
        return res.status(400).json({ error: glossCheck.reason });
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
            error: `Slot ${slotIndex + 1} sudah ada ${kiraan.n} kandungan. Had maksimum ialah ${hadKandunganSlot} (Tetapan Am Slot). Arkibkan kandungan sedia ada dahulu.`,
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

      // Satu transaksi untuk keseluruhan penciptaan: objek + revisi + atribut (PIPELINE-
      // TRANSACTION-001, audit #46.10/#47.7, dibaiki 2026-08-13). Sebelum ni tiga INSERT
      // berasingan auto-commit sendiri-sendiri — kegagalan separuh jalan (cth kunci DB, FK)
      // tinggalkan objek+revisi TANPA atribut tersimpan SENYAP sambil editor nampak mesej
      // "Gagal mencipta" dan berkemungkinan cuba lagi (objek berganda). Corak sama seperti
      // laluan pulih-versi di atas (BEGIN/COMMIT/ROLLBACK) — operasi editorial sama ada
      // berjaya sepenuhnya atau tidak wujud langsung.
      await dbRun('BEGIN TRANSACTION');
      let revisionId;
      try {
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
        revisionId = rev.lastID;

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
        await dbRun('COMMIT');
      } catch (e) {
        try {
          await dbRun('ROLLBACK');
        } catch (rollbackErr) {
          console.error('Rollback gagal selepas ralat cipta kandungan:', rollbackErr.message);
        }
        throw e;
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
  }));

  // (2026-08-06, audit "kegagalan senyap") Blok PENDUA GET /content/:id/revisions +
  // POST .../restore dibuang dari sini. Ia didaftar kali KEDUA selepas versi bergerbang di
  // atas (baris ~722/747), jadi Express tak pernah memadankannya — kod mati. Bahaya sebenar:
  // salinan GET yang mati tu TIADA requireAuth, jadi kalau versi bergerbang dipadam atau
  // susunan berubah, laluan terbuka hidup semula secara senyap.

  // Perpustakaan Prompt Semakan (2026-08-08, ChatGPT REVIEW-01 + spesifikasi Izzat) — Ketua
  // Editor tampal SEMUA kandungan dalam kotak Semakan Pukal ke chatbox AI luaran (ChatGPT/
  // Gemini/dll.) utk dibetulkan (cth ejaan Melayu baku), bukan disunting terus dalam sistem.
  // Perpustakaan ni simpan arahan/prompt bernama yang Ketua Editor klik utk salin terus ke
  // papan klip, tampal di chatbox tu — bukan pipeline penjanaan AI (berbeza drpd masterPrompt/
  // reviewPrompt di system_settings, yg wired ke Urus Slot). Guna jadual prompt_templates
  // sedia ada (kosong/tak digunakan UI lain), gerbang manageEditorial (Ketua Editor/Penolong
  // Ketua Editor — padanan sebenar penonton skrin Semakan Pukal), bukan manageSettings
  // (Pentadbir sahaja, gerbang /api/ai/prompts yg berasingan utk konfigurasi AI provider).
  router.get('/semakan-prompts', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const rows = await dbAll("SELECT id, name, templateText, updatedAt FROM prompt_templates WHERE id LIKE 'semakan_%' ORDER BY updatedAt DESC");
      res.json(rows);
    } catch (err) {
      console.error('Fetch semakan prompts error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai prompt semakan.' });
    }
  });

  router.post('/semakan-prompts', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { name, templateText } = req.body || {};
      if (!name || !String(name).trim() || !templateText || !String(templateText).trim()) {
        return res.status(400).json({ error: 'Nama dan kandungan prompt wajib diisi.' });
      }
      const id = `semakan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      await dbRun(
        "INSERT INTO prompt_templates (id, name, templateText, version, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [id, String(name).trim(), String(templateText).trim(), 'v1', now, now]
      );
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'cipta-prompt-semakan',
        targetType: 'prompt-semakan',
        targetId: id,
        detail: String(name).trim(),
      });
      res.json({ success: true, id });
    } catch (err) {
      console.error('Create semakan prompt error:', err);
      res.status(500).json({ error: 'Gagal menyimpan prompt semakan.' });
    }
  });

  router.delete('/semakan-prompts/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      if (!id.startsWith('semakan_')) return res.status(404).json({ error: 'Prompt tidak ditemui.' });
      await dbRun("DELETE FROM prompt_templates WHERE id = ?", [id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'padam-prompt-semakan',
        targetType: 'prompt-semakan',
        targetId: id,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Delete semakan prompt error:', err);
      res.status(500).json({ error: 'Gagal memadam prompt semakan.' });
    }
  });

  return router;
}
