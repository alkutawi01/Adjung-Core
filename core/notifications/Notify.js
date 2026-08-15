// Notify (2026-08-02, Fasa 6b) — bekas sejawat `core/audit/AuditLog.js`'s logAudit(): satu fungsi
// kongsi supaya setiap laluan yang patut memberitahu editor (kandungan disiar/ditolak, penugasan
// slot, RSS/cuaca gagal, kata laluan ditukar, akaun digantung/diaktifkan) menulis SATU baris
// konsisten ke jadual `notifications` PER-EDITOR — bukan setiap laluan reka format sendiri.
//
// Beza dengan logAudit(): logAudit ialah jejak audit sistem (satu baris, semua orang boleh
// lihat di Log Audit). Notify() ialah PER-PENGGUNA — satu baris SATU pengguna, status baca/belum
// baca sendiri, untuk Peti Makluman. Sesuatu tindakan selalunya panggil KEDUA-DUANYA.
//
// Kumpul (dbGet, opsyenal, 2026-08-16, permintaan Izzat + audit ChatGPT "notification hygiene")
// — kegagalan berulang (cth RSS sumber sama gagal setiap 5 minit) SEBELUM ni cipta SATU baris
// baharu SETIAP kali, banjir Peti Makluman dgn "kejadian" yang sebenarnya SATU insiden berterusan.
//
// Tingkap MASA, BUKAN status dibaca (2026-08-16, pembetulan pepijat sendiri — Izzat perasan
// notifikasi RSS MASIH banjir baris berasingan selepas fix pertama). Percubaan pertama kumpul
// ikut "notifikasi belum dibaca" (isRead=0) — tapi Izzat buka Peti Makluman kerap, dan MEMBUKA
// dia terus tanda SEMUA notifikasi dibaca (reka bentuk sengaja, lihat EditoriumView.tsx
// bukaMakluman()). Jadi pada masa kegagalan RSS SETERUSNYA berlaku, notifikasi terdahulu dah
// isRead=1 (Izzat dah check inbox dlm masa tu) — carian "belum dibaca" tak jumpa apa-apa,
// cipta baris BAHARU setiap kali juga, fix asal tak berkesan langsung dlm amalan. Kumpul ikut
// TINGKAP MASA (baris sama jenis+sasaran diCIPTA/dikemaskini dlm KUMPUL_TINGKAP_MS lepas) — tak
// kisah dibaca ke tidak — jauh lebih tahan terhadap corak sebenar editor kerap semak inbox.
const KUMPUL_TINGKAP_MS = 6 * 60 * 60 * 1000; // 6 jam — kegagalan RSS di luar tingkap ni dikira insiden BAHARU, bukan sambungan lama.
// (.+?) TAK LOKEK (bukan [^,)]+) — tarikh "sejak" sendiri MENGANDUNGI koma (format
// toLocaleString ms-MY, cth "15/8/2026, 12:13:06 PTG"), jadi had [^,)]+ (elak koma) yang
// dicuba mula-mula (2026-08-16) SILAP potong mulaSejak pada koma PERTAMA di dalam tarikh
// itu sendiri, bukan pada sempadan sebelum ", terakhir ..." — regex jadi tak padan langsung,
// kiraan jatuh balik ke default 2 SETIAP kali (kekal "2 kali" walau berapa kali pun berulang,
// disahkan gagal via scratch/test_notify_race2.mjs). (.+?) tak lokek + akhiran ", terakhir
// [^)]+)? opsyenal bersama \)$ betul kerana regex cuba sependek mungkin utk group 2 sehingga
// baki rentetan sepadan penuh — sempadan sebenar cuma jumpa pada ", terakhir " (bukan
// sebarang koma), disahkan padan pada ujian yang sama selepas pembetulan ni.
const padanKiraan = (detail) => (detail || '').match(/\((\d+) kali sejak (.+?)(?:, terakhir [^)]+)?\)$/);

// Kunci proses untuk kumpul (2026-08-16, pembetulan kali kedua — Izzat masih nampak baris
// "Ambilan RSS gagal: Bernama" berasingan walaupun tingkap masa dah betul). Punca sebenar:
// SELECT-then-write (baca "sedia", kemudian putuskan UPDATE atau INSERT) ialah corak
// tolak-cek-tolak (TOCTOU) — kalau DUA panggilan notify() untuk kunci (userId+type+targetId)
// SAMA berjalan lebih kurang serentak (cth penjadual dalaman + panggilan manual "Tarik RSS
// Sekarang" berlaku hampir sama masa), kedua-dua boleh SELECT dahulu (jumpa tiada baris sedia
// tertutup transaksi), lalu KEDUA-DUA INSERT baris baharu berasingan — kumpul gagal senyap,
// bukan sebab tingkap masa salah (dah dibetulkan sebelum ni) tapi sebab bacaan-tulis tak atomik.
// Kunci Promise per-kekunci di bawah paksa panggilan kunci SAMA berbaris (queue) dalam proses
// Node ni — tidak menyelesaikan race merentasi PROSES berasingan (cth semasa restart pm2 yang
// bertindih), tapi itu jauh lebih jarang berbanding race dalam-proses yang sebenarnya berlaku.
const kunciDalamProses = new Map();
async function denganKunciNotifikasi(kekunci, tugas) {
  const sebelum = kunciDalamProses.get(kekunci) || Promise.resolve();
  const giliranIni = sebelum.then(tugas, tugas);
  kunciDalamProses.set(kekunci, giliranIni.catch(() => {}));
  return giliranIni;
}

export async function notify(dbRun, dbGetOrPayload, payloadArg) {
  // Keserasian belakang — panggilan lama notify(dbRun, payload) tanpa dbGet (tiada kumpul)
  // terus berfungsi macam biasa.
  const ada3Argumen = payloadArg !== undefined;
  const dbGet = ada3Argumen ? dbGetOrPayload : null;
  const payload = ada3Argumen ? payloadArg : dbGetOrPayload;
  const { userId, type, title, detail, targetType, targetId, kumpul } = payload;
  if (!userId || !type || !title) return;
  if (kumpul && dbGet && targetId) {
    return denganKunciNotifikasi(`${userId}|${type}|${targetId}`, () => notifyTanpaKunci(dbRun, dbGet, payload));
  }
  return notifyTanpaKunci(dbRun, dbGet, payload);
}

async function notifyTanpaKunci(dbRun, dbGet, payload) {
  const { userId, type, title, detail, targetType, targetId, kumpul } = payload;
  try {
    const kiniIso = new Date().toISOString();
    if (kumpul && dbGet && targetId) {
      const tingkapMula = new Date(Date.now() - KUMPUL_TINGKAP_MS).toISOString();
      const sedia = await dbGet(
        `SELECT id, detail, createdAt FROM notifications
         WHERE userId = ? AND type = ? AND targetId = ? AND createdAt > ?
         ORDER BY createdAt DESC LIMIT 1`,
        [userId, type, targetId, tingkapMula]
      );
      if (sedia) {
        const padanan = padanKiraan(sedia.detail);
        const kiraanBaharu = padanan ? parseInt(padanan[1], 10) + 1 : 2;
        const mulaSejak = padanan ? padanan[2] : new Date(sedia.createdAt).toLocaleString('ms-MY');
        // isRead=0 (2026-08-16) — insiden lama yang DAH dibaca tapi berulang SEMULA dlm tingkap
        // masa ni patut tarik perhatian lagi (lencana bell naik semula) — "ni berlaku lagi" ialah
        // maklumat baharu yang berbaloi, walaupun baris DB yang sama dikemaskini bukan baris baru.
        // Sertakan waktu KEGAGALAN TERAKHIR eksplisit dalam teks (2026-08-16, cadangan ChatGPT)
        // — "(5 kali)" sahaja tak bagitahu editor sama ada insiden ni MASIH berlaku sekarang atau
        // dah lama senyap; `createdAt` baris dikemaskini setiap kali (jadi UI boleh papar tarikh
        // ringkas), tapi masa TEPAT (jam:minit) sebelum ni tak pernah masuk teks detail sendiri.
        const masaTerakhir = new Date(kiniIso).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
        await dbRun(
          `UPDATE notifications SET detail = ?, createdAt = ?, isRead = 0 WHERE id = ?`,
          [`${detail || title} (${kiraanBaharu} kali sejak ${mulaSejak}, terakhir ${masaTerakhir})`, kiniIso, sedia.id]
        );
        return;
      }
    }
    await dbRun(
      `INSERT INTO notifications (id, userId, type, title, detail, targetType, targetId, isRead, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        type,
        title,
        detail || null,
        targetType || null,
        targetId || null,
        kiniIso,
      ]
    );
  } catch (err) {
    // Kegagalan menulis notifikasi TIDAK BOLEH menggagalkan tindakan sebenar (terbit/tolak/dsb.) —
    // sama prinsip macam logAudit(), notifikasi ialah rekod sampingan.
    console.error('Gagal menulis notifikasi:', err.message);
  }
}

// Hantar notis SAMA kepada berbilang pengguna (cth semua editor sesuatu slot). Set() buang
// duplikat/kosong dahulu supaya seorang editor tak terima dua notis sama untuk satu tindakan.
// dbGet opsyenal (2026-08-16) — diteruskan terus ke notify() untuk sokong `kumpul`.
export async function notifyMany(dbRun, userIds, payload, dbGet) {
  const unik = [...new Set((userIds || []).filter(Boolean))];
  for (const userId of unik) {
    if (dbGet) await notify(dbRun, dbGet, { ...payload, userId });
    else await notify(dbRun, { ...payload, userId });
  }
}

// Beritahu PELULUS kandungan (2026-08-08, audit aliran penerbitan) — Ketua Editor dan Penolong
// Ketua Editor, iaitu peranan yang benar-benar boleh meluluskan kandungan Menunggu. SENGAJA bukan
// beritahuPentadbirDanKetuaEditor() (slotRoutes.js/systemRoutes.js): Pentadbir tiada kebenaran
// `manageEditorial` (lihat DEFAULT_ROLE_PERMISSIONS, core/middleware/auth.js), jadi memberitahunya
// tentang giliran kelulusan cuma bunyi bising — dia tak boleh bertindak ke atasnya.
//
// Sebelum ni notifikasi kandungan HANYA pergi kepada editor slot dan penulis asal, jadi kandungan
// boleh duduk dalam giliran Menunggu tanpa had sehingga Ketua Editor terfikir untuk semak Indeks
// sendiri — tiada isyarat langsung yang ada kerja menunggu keputusan dia.
export async function beritahuPelulusKandungan(dbAll, dbRun, payload) {
  const rows = await dbAll(
    "SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('ketua_editor', 'penolong_ketua_editor')"
  );
  await notifyMany(dbRun, (rows || []).map((r) => r.userId), payload);
}

export default notify;
