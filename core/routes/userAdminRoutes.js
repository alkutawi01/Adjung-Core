import express from 'express';
import crypto from 'crypto';
import { requirePermission } from '../middleware/auth.js';
import { hashPassword } from './authRoutes.js';
import { logAudit } from '../audit/AuditLog.js';
import { baseUrlEmel } from '../utils/baseUrl.js';
import { notify, notifyMany } from '../notifications/Notify.js';
import { hantarEmel } from '../email/MailSender.js';
import { janaTokenTamatTempoh, AWALAN_USERNAME_SEMENTARA } from '../auth/TokenLaluan.js';
import { TIER_SLOTS } from '../editorial/GeometryConfig.js';
import { MANUAL_BLOCK_SPLIT_REGEX, parseManualSummaryBlocks } from '../editorial/ManualBlockFormat.js';
import { padamSesiPengguna } from '../auth/SesiPengguna.js';
import { denganKunciKandungan, denganKunciPeranananPengguna } from '../utils/kunciKandungan.js';
import { getDasarAktifAmbangMs, loadDasarAktifSettings, PERANAN_TERPAKAI_DASAR_AKTIF } from './dasarAktifRoutes.js';

// Direktori (2026-08-02, Fasa 3) — dahulu `staffList` konsol client array kosong berkod keras,
// "+ Tambah Anggota" hiasan, tindakan status hanya state React (hilang bila muat semula). Laluan
// ni jadikan Direktori sebenar: baca/tulis jadual `users` + `user_roles` sebenar. Domain
// Pentadbir sepenuhnya (kebenaran `manageAccounts`) — lihat matriks di core/middleware/auth.js.
const STATUS_SAH = ['Aktif', 'Cuti', 'Tidak Aktif', 'Ditamatkan'];
const ROLE_IDS_SAH = ['pentadbir', 'ketua_editor', 'penolong_ketua_editor', 'editor'];
const BAR_SLOTS = new Set(TIER_SLOTS.BAR);
const samaNama = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

// Kunci "jangan biar sistem terkunci daripada dirinya sendiri" (2026-09-09, bug-hunt) — kebenaran
// `manageAccounts` (urus akaun, termasuk laluan status/peranan DI SINI) DAN `manageRbac` (matriks
// Kawalan Akses, TetapanConsole.tsx) kedua-duanya HANYA dipegang peranan 'pentadbir' ikut lalai
// (core/middleware/auth.js DEFAULT_ROLE_PERMISSIONS). Kalau akaun 'pentadbir' AKTIF terakhir
// digantung/ditamatkan (PATCH .../status) atau ditarik balik peranan 'pentadbir' (PATCH .../roles)
// tanpa 'pentadbir' aktif LAIN kekal, TIADA SESIAPA lagi boleh urus akaun ATAU kebenaran — bahkan
// akaun 'pentadbir' yang baru digantung sendiri pun tak boleh log masuk balik urus diri sendiri.
// Satu-satunya jalan keluar ialah edit terus adjung.db (di luar aplikasi). Semak dahulu SEBELUM
// tindakan ni dibenarkan, sama falsafah macam "mesti pegang sekurang-kurangnya satu peranan" di
// PATCH .../roles yang sedia ada.
async function adaPentadbirAktifLain(dbGet, idDikecualikan) {
  const baris = await dbGet(
    `SELECT COUNT(*) AS n FROM user_roles ur
     INNER JOIN users u ON u.id = ur.userId
     WHERE ur.roleId = 'pentadbir' AND u.isSuspended = 0 AND u.id != ?`,
    [idDikecualikan]
  );
  return (baris?.n || 0) > 0;
}

// Draf/Menunggu tak diterbitkan kepunyaan seorang editor (2026-08-05, permintaan Izzat: "kalau
// editor tu dah dibuang, adakah kandungan yg berstatus menunggu dan draf masih ada? saya rasa yg
// arkib sahaja dikekalkan") — dipanggil oleh GET (kira/senarai sahaja) DAN POST (padam sebenar) di
// bawah supaya logik pengesanan kekal SATU tempat, bukan disalin dua kali.
//
// Draf: blok teks "Status: draf" dalam slots_config.manualSummary (bukan baris DB — lihat
// draftRoutes.js untuk penjelasan penuh corak ni), dikenal pasti drpd baris "Penulis:" sepadan
// nama pena. Menunggu: baris editorial_objects SEBENAR dgn revisi TERKINI berstatus 'pending' dan
// atribut editorName sepadan. Kandungan approved/archived (Arkib) — SENGAJA tidak disentuh
// langsung di sini, itu rekod sejarah kekal.
async function cariKandunganBelumTerbit(dbAll, penName) {
  const draf = []; // { slotIndex, tajuk }
  const menunggu = []; // { id, tajuk }
  if (!penName) return { draf, menunggu };

  const slots = await dbAll(
    "SELECT slotIndex, manualSummary FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex >= 0"
  );
  for (const slot of slots || []) {
    if (BAR_SLOTS.has(slot.slotIndex)) continue; // Bar belum sokong alur Draf/Terbit
    const blok = parseManualSummaryBlocks(slot.manualSummary || '');
    blok.forEach((b) => {
      if (b.status === 'draft' && samaNama(b.penulis, penName)) {
        draf.push({ slotIndex: slot.slotIndex, tajuk: b.title || '(tiada tajuk)' });
      }
    });
  }

  const rows = await dbAll(`
    SELECT eo.id, er.title FROM editorial_objects eo
    INNER JOIN (SELECT objectId, MAX(version) mv FROM editorial_revisions GROUP BY objectId) lv ON lv.objectId = eo.id
    INNER JOIN editorial_revisions er ON er.objectId = eo.id AND er.version = lv.mv
    INNER JOIN editorial_attribute_values eav ON eav.objectId = eo.id AND eav.revisionId = er.id AND eav.attributeId = 'editorName'
    WHERE er.status = 'pending' AND LOWER(TRIM(eav.valueText)) = LOWER(TRIM(?))
  `, [penName]);
  for (const r of rows || []) menunggu.push({ id: r.id, tajuk: r.title || '(tiada tajuk)' });

  return { draf, menunggu };
}

// Buang blok Draf sepadan drpd manualSummary SETIAP slot — split guna regex SAMA dengan
// parseManualSummaryBlocks (diimport terus, bukan disalin semula) supaya raw-split dan
// hasil-hurai SENTIASA sepadan indeks demi indeks (satu-satunya cara selamat "zip" dua array
// tanpa parseManualBlockFields tunggal, yang tidak dieksport).
const bahagikanBlokMentah = (manualSummary) => {
  // Semakan cepat MESTI case-insensitive, sepadan dengan MANUAL_BLOCK_SPLIT_REGEX (bendera 'i')
  // dan parseManualBlockFields (case-insensitive sejak #272/#273) -- pepijat corak sama #274/#275
  // (ManualBlockFormat.js parseManualSummaryBlocks): guard literal-case .includes('Tajuk:')/
  // .includes('Event:') tersilap pulangkan [] utk blok berlabel huruf kecil (cth "tajuk:") walau
  // split+parse sebenar di bawah akan berjaya kalau dipanggil terus.
  const t = manualSummary ? manualSummary.toLowerCase() : '';
  if (!t || (!t.includes('tajuk:') && !t.includes('event:'))) return [];
  return manualSummary.split(MANUAL_BLOCK_SPLIT_REGEX).filter((b) => b.trim().length > 0);
};
const DRAFT_BLOCK_SEPARATOR = '\n\n________________________________________\n\n';

export function createUserAdminRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/system/users — senarai penuh anggota + peranan + kiraan aktiviti ringkas.
  router.get('/users', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const users = await dbAll(
        `SELECT id, username, email, penName, status, isSuspended, createdAt, updatedAt, lastPublishedAt, amaranTakAktifTahap, autoTerbit FROM users ORDER BY createdAt ASC`
      );
      const roleRows = await dbAll(`SELECT userId, roleId FROM user_roles`);
      const rolesByUser = {};
      for (const r of roleRows || []) {
        (rolesByUser[r.userId] = rolesByUser[r.userId] || []).push(r.roleId);
      }

      // Dasar Aktif Editorial — status "hari tak aktif" (2026-08-16, permintaan Izzat: "macam
      // mana nak check" tempoh tu). Basis pengiraan SAMA PERSIS macam runSemakanTakAktif()
      // server.js (lastPublishedAt jatuh balik ke createdAt), Pentadbir DIKECUALIKAN sama sebab
      // (struktur RBAC tak boleh terbit kandungan) — satu neraca dikongsi, dua tempat (Direktori
      // paparkan, server.js kuatkuasakan) tak boleh terpesong tentang siapa/berapa hari.
      //
      // Muat semula LIVE sebelum baca (2026-09-08, gap didokumentasikan CLAUDE.md ditutup) —
      // dahulu laluan ni baca cache dalam-memori TERUS tanpa muat semula, tak macam
      // runSemakanTakAktif() (server.js) yang sudah dibaiki panggil loadDasarAktifSettings()
      // segar pada SETIAP jalanan. Kesan sebenar: tempoh custom yang Pentadbir simpan sebelum
      // restart pelayan terakhir akan papar nombor LALAI 7/14/21 (bukan nombor tersimpan) pada
      // lajur "Tak Aktif" Direktori sepanjang tempoh antara restart dan jalanan job harian
      // pertama, ATAU sesiapa buka panel Tetapan Dasar Aktif dan simpan semula (yang muat semula
      // cache secara tak sengaja). Kos baca DB tambahan boleh diabaikan (satu baris, dipanggil
      // sekerap laluan ni sahaja dipanggil — bukan job kerap).
      await loadDasarAktifSettings(dbGet);
      const ambangMs = getDasarAktifAmbangMs();
      const HARI_MS_LOKAL = 24 * 60 * 60 * 1000;

      // Kiraan aktiviti (2026-08-02) — anggaran terbaik daripada atribut `editorName` yang
      // dicap semasa terbit (lihat server.js syncManualObjectsForSlot) — bukan kiraan sempurna
      // (satu sesi Simpan/Terbit = satu nama editor untuk SEMUA item dalam sesi tu, lihat nota
      // sedia ada di server.js), tapi lebih jujur daripada angka rekaan yang wujud dulu.
      //
      // Skop ikut revisionId TERKINI sahaja (2026-09-03, dapatan bug-hunt susulan pepijat
      // version-chain GET /content/all) — objek yang disunting >1 kali (Semakan Kandungan)
      // ada BERBILANG baris `editorial_attribute_values` bagi attributeId='editorName' SATU
      // objek (satu bagi setiap revisi lama DAN revisi terkini, lihat komen PATCH /content/:id
      // di contentRoutes.js). Query lama `WHERE attributeId = 'editorName' AND valueText = ?`
      // (tiada `revisionId`) mengira baris LAMA sekali — kalau kandungan disunting editor LAIN
      // selepas ni (editorName attribut ditukar pada revisi baharu), objek tu KEKAL disumbang
      // ke kiraan aktiviti editor ASAL selama-lamanya walau kandungan kini milik editor lain
      // sepenuhnya. Sekat kepada revisionId = MAX(version) objek tu sahaja, corak SAMA seperti
      // query "menunggu" di atas (baris ~53-59).
      //
      // Padanan LOWER(TRIM()) (2026-09-08, dapatan bug-hunt susulan pepijat sama-corak
      // POST /content/:id/reject-to-draft) — kedua-dua query ni (sini DAN "menunggu" di atas)
      // dahulu padan `eav.valueText = ?` TEPAT lawan `u.penName`/`penName` semasa. profileRoutes.js
      // (PATCH /profile/:id, komen baris ~80) SENGAJA benarkan editor tukar penName ke huruf
      // besar/kecil BERBEZA bagi nama SAMA ("ahmad zaki" -> "Ahmad Zaki") — selepas tukar begitu,
      // baris `editorial_attribute_values.editorName` yang dicap masa terbit LAMA (huruf kecil
      // asal) tak lagi padan penName semasa (huruf besar baharu) walau nama sebenar tak berubah,
      // jadi kiraan "menunggu"/"aktiviti" senyap jatuh ke 0 untuk editor tu selepas dia tukar
      // huruf besar/kecil nama pena sendiri. Disahkan pepijat sebenar via simulasi DB scratch
      // (kiraan lama = 0, kiraan LOWER(TRIM()) = 1 bagi kes sama). Padanan kini konsisten dengan
      // SETIAP tempat lain dalam projek ni yang banding penName/editorName (server.js baris ~3974,
      // contentRoutes.js baris ~1395/1925, profileRoutes.js baris ~82/129).
      const staff = await Promise.all((users || []).map(async (u) => {
        const countRow = await dbGet(
          `SELECT COUNT(DISTINCT eav.objectId) AS cnt
           FROM editorial_attribute_values eav
           INNER JOIN (SELECT objectId, MAX(version) mv FROM editorial_revisions GROUP BY objectId) lv
             ON lv.objectId = eav.objectId
           INNER JOIN editorial_revisions er ON er.objectId = eav.objectId AND er.version = lv.mv
           WHERE eav.attributeId = 'editorName' AND LOWER(TRIM(eav.valueText)) = LOWER(TRIM(?)) AND eav.revisionId = er.id`,
          [u.penName || '']
        );
        const roles = rolesByUser[u.id] || [];
        // u.status === 'Aktif' (2026-09-03, dapatan audit) — runSemakanTakAktif() (server.js)
        // yang KUATKUASAKAN dasar ni cuma pertimbangkan akaun `WHERE u.status = 'Aktif'` (Cuti/
        // Tidak Aktif/Ditamatkan tak pernah dieskalasi/gantung semasa status tu berkuatkuasa).
        // Basis paparan ni sebelum ni terlepas syarat status, jadi Direktori boleh papar lencana
        // amaran tahap 1/2/3 + hari tak aktif MENINGKAT untuk editor yang sedang 'Cuti' — nampak
        // macam dia bakal digantung walhal enforcement sebenar tak sentuh dia langsung selagi
        // status bukan 'Aktif'. Satu neraca dikongsi (nota di atas) — ni tutup jurang tu.
        const tertaklukDasarAktif = u.status === 'Aktif' && roles.some((r) => PERANAN_TERPAKAI_DASAR_AKTIF.includes(r)) && !roles.includes('pentadbir');
        let hariTakAktif = null;
        let tahapAmaran = 0;
        if (tertaklukDasarAktif) {
          const basis = u.lastPublishedAt ? new Date(u.lastPublishedAt).getTime() : new Date(u.createdAt).getTime();
          if (basis && !Number.isNaN(basis)) {
            hariTakAktif = Math.floor((Date.now() - basis) / HARI_MS_LOKAL);
            tahapAmaran = u.amaranTakAktifTahap || 0;
          }
        }
        return {
          id: u.id,
          username: u.username,
          email: u.email,
          penName: u.penName || u.username,
          status: STATUS_SAH.includes(u.status) ? u.status : 'Aktif',
          suspended: u.isSuspended === 1,
          autoTerbit: u.autoTerbit === 1,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          roles,
          countPublished: countRow ? countRow.cnt : 0,
          tertaklukDasarAktif,
          hariTakAktif,
          tahapAmaran,
          ambangHariDasarAktif: {
            amaranPertama: Math.round(ambangMs.amaranPertama / HARI_MS_LOKAL),
            amaranKedua: Math.round(ambangMs.amaranKedua / HARI_MS_LOKAL),
            notisPenamatan: Math.round(ambangMs.notisPenamatan / HARI_MS_LOKAL),
          },
        };
      }));

      res.json(staff);
    } catch (err) {
      console.error('GET users error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai anggota. ' + (err.message || '') });
    }
  });

  // POST /api/system/users — cipta akaun editor baharu.
  //
  // 2026-08-03 (Fasa 1, jemputan editor baharu) — DAHULU Pentadbir menaip kata laluan awal
  // terus dalam borang, kemudian terpaksa beritahu editor baharu kata laluan tu secara luar
  // talian (WhatsApp/Slack/verbal) — bocor keselamatan sebenar. Kini Pentadbir TIDAK memilih
  // kata laluan langsung: akaun dicipta dengan hash kata laluan rawak yang tak boleh log masuk
  // (`resetToken` yang tentukan pemilikan sebenar), emel jemputan dihantar ke editor baharu
  // dengan pautan `/tetapkan-kata-laluan?token=...` (sah 48 jam) supaya dia tetapkan kata
  // laluannya SENDIRI — lihat POST /api/auth/aktifkan-akaun di authRoutes.js.
  // denganKunciKandungan (2026-08-08, dapatan audit keselamatan ChatGPT) — semakan pendua
  // (SELECT username/email/penName) diikuti INSERT bukan atomik: dua Pentadbir cipta akaun
  // hampir serentak dgn nama pena SAMA boleh dua-dua lulus semakan sebelum mana-mana INSERT.
  // `username` ada UNIQUE peringkat DB (jaring terakhir), tapi `email`/`penName` TIADA — dua
  // akaun kongsi penName sebenarnya BOLEH wujud tanpa kunci ni (rosakkan identiti "siapa tulis
  // kandungan", lihat nota panjang di bawah). Cipta akaun jarang berlaku (tindakan Pentadbir,
  // bukan trafik kerap), jadi guna kunci global sedia ada — bukan reka kunci berasingan.
  router.post('/users', requirePermission('manageAccounts'), (req, res) => denganKunciKandungan(async () => {
    try {
      const { email, roles } = req.body || {};
      const e = (email || '').trim().toLowerCase();
      if (!e) {
        return res.status(400).json({ error: 'Emel diperlukan.' });
      }
      // Format SAMA seperti POST /api/auth/change-email (authRoutes.js) — laluan tu tolak emel
      // tak sah bila editor sendiri TUKAR emel kemudian, tapi laluan INI (Ketua Editor CIPTA
      // akaun kali pertama) tak pernah semak format langsung sebelum ni. Kesan sebenar: emel
      // tak sah (cth "bukan-emel", tiada @/domain) diterima 200, jemputan gagal dihantar senyap
      // (hantarEmel() gugur/gagal ikut pembekal), DAN akaun tu terus "guna" alamat rosak tu
      // buat selama-lamanya — POST semula emel yang SAMA (walau dieja betul) akan 409 sbb emel
      // asal dah "digunakan", tiada laluan UI pulihkan (lihat komen hantar-semula-jemputan di
      // bawah, sama isu). 2026-09-09, bug-hunt.
      const emelSah = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
      if (!emelSah) {
        return res.status(400).json({ error: 'Format emel tidak sah.' });
      }
      const rolesToAssign = Array.isArray(roles) ? roles.filter((r) => ROLE_IDS_SAH.includes(r)) : [];
      if (rolesToAssign.length === 0) {
        return res.status(400).json({ error: 'Pilih sekurang-kurangnya satu peranan.' });
      }

      const existing = await dbGet('SELECT id FROM users WHERE LOWER(email) = ?', [e]);
      if (existing) {
        return res.status(409).json({ error: 'Emel sudah digunakan.' });
      }
      // Username/nama pena TIDAK LAGI ditetapkan Ketua Editor di sini (2026-08-16, permintaan
      // Izzat — "ni menyusahkan ketua editor utk fikir nama pena editor", diorang isi sendiri).
      // Username sementara (berawalan AWALAN_USERNAME_SEMENTARA + token) UNIK secara terjamin
      // (token 32-bait rawak), jadi tiada semakan pendua diperlukan di sini. penName kosong DAN
      // tiada semakan pendua di sini juga — semakan keunikan sebenar (penName SEBENAR editor
      // pilih) berlaku di POST /api/auth/aktifkan-akaun bila mereka tetapkan identiti sendiri
      // (lihat perluTetapkanIdentiti(), TokenLaluan.js).
      const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const kini = new Date().toISOString();
      const tokenJemputan = crypto.randomBytes(32).toString('hex');
      const usernameSementara = `${AWALAN_USERNAME_SEMENTARA}${tokenJemputan.slice(0, 16)}`;
      const tamatTempoh = janaTokenTamatTempoh(48);
      // Hash kata laluan rawak sekali-lalu — lajur `password` DB tak boleh NULL, tapi nilai ni
      // tak pernah diketahui/dimasukkan sesiapa jadi mustahil dipadankan verifyPassword() sehingga
      // editor tetapkan kata laluannya sendiri melalui token jemputan.
      const kataLaluanSementara = hashPassword(crypto.randomBytes(32).toString('hex'));
      await dbRun(
        `INSERT INTO users (id, username, email, role, penName, isSuspended, status, password, resetToken, resetTokenExpiresAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 0, 'Aktif', ?, ?, ?, ?, ?)`,
        // `role` legasi diisi ikut peranan tertinggi yang dipilih, sekadar untuk paparan lama —
        // sumber kebenaran sebenar ialah user_roles di bawah. `penName` kosong (bukan NULL,
        // lajur nullable tapi kod lain di seluruh sistem anggap ia string) sehingga aktivasi.
        [id, usernameSementara, e, rolesToAssign.includes('ketua_editor') ? 'KETUA_EDITOR' : 'EDITOR', '', kataLaluanSementara, tokenJemputan, tamatTempoh, kini, kini]
      );
      for (const roleId of rolesToAssign) {
        await dbRun('INSERT OR IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)', [id, roleId]);
      }

      // URL PENUH diperlukan (bukan laluan relatif) — pautan ni dibuka daripada klien EMEL,
      // bukan pelayar yang sedang di brief.adjung.com, jadi tiada origin sedia ada untuk
      // pautan relatif "menyambung" kepadanya. Corak sama seperti sitemapRoutes.js/authRoutes.js.
      const baseUrlJemputan = baseUrlEmel();
      const pautanJemputan = `${baseUrlJemputan}/tetapkan-kata-laluan?token=${tokenJemputan}`;
      // `emelDihantar` (di respons di bawah) kini DIBACA klien (DirektoriConsole.tsx,
      // TambahAnggotaModal & PermohonanModal — dibaiki 2026-09-03, dapatan bug-hunt: dahulu
      // mesej UI KEKAL menyatakan "telah dihantar" tanpa semak status sebenar). TIADA laluan
      // "hantar semula jemputan" wujud lagi kalau hantaran ni gagal — akaun dah tercipta (emel
      // sekarang "digunakan", POST ni akan 409 kalau cuba lagi) dan token 48 jam ni akan tamat
      // tanpa cara pemohon dapatkannya semula melalui UI. Keputusan produk (bina laluan hantar
      // semula, ATAU biarkan Pentadbir pulihkan secara manual DB) belum dibuat — tanya Izzat
      // sebelum bina, jangan anggap salah satu sahaja jalan betul.
      const hantaran = await hantarEmel({
        to: e,
        subject: 'Jemputan Sertai Adjung Brief',
        html: `<p>Salam,</p>` +
          `<p>Anda telah dijemput sertai Adjung Brief sebagai ${rolesToAssign.join(', ')}.</p>` +
          `<p>Klik pautan berikut untuk menetapkan nama pena, ID pengguna dan kata laluan akaun anda (sah selama 48 jam):</p>` +
          `<p><a href="${pautanJemputan}">${pautanJemputan}</a></p>`,
      });

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'cipta-akaun',
        targetType: 'akaun',
        targetId: id,
        detail: `${e}, peranan: ${rolesToAssign.join(', ')}`,
      });

      res.json({ success: true, id, emelDihantar: hantaran.berjaya });
    } catch (err) {
      console.error('POST users error:', err);
      // Lapisan pertahanan kedua (2026-08-08) — kalau semua di atas terlepas (patut mustahil di
      // dalam denganKunciKandungan, tapi indeks UNIQUE username/email/penName di server.js jaring
      // terakhir), pulangkan 409 mesra bukan 500 mentah.
      if (/UNIQUE constraint failed/i.test(err.message || '')) {
        return res.status(409).json({ error: 'Username, emel atau nama pena sudah digunakan akaun lain.' });
      }
      res.status(500).json({ error: 'Gagal mencipta akaun. ' + (err.message || '') });
    }
  }));

  // POST /api/system/users/:id/hantar-semula-jemputan (2026-09-03, soalan terbuka bug-hunt,
  // diluluskan Izzat) — sebelum ni TIADA cara pulihkan jemputan yang gagal/tamat tempoh selain
  // pulih terus DB. Jana token 48-jam BAHARU + hantar e-mel jemputan sekali lagi, guna templat
  // SAMA seperti POST /users di atas. Digerbang hanya untuk akaun yang MASIH belum diaktifkan
  // (username sementara berawalan AWALAN_USERNAME_SEMENTARA) — akaun yang dah aktif tetapkan
  // identiti sendiri, hantar semula "jemputan" kepada mereka tak bermakna/mengelirukan.
  router.post('/users/:id/hantar-semula-jemputan', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const { id } = req.params;
      const sedia = await dbGet('SELECT id, username, email, role FROM users WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });
      if (!(sedia.username || '').startsWith(AWALAN_USERNAME_SEMENTARA)) {
        return res.status(400).json({ error: 'Akaun ini sudah diaktifkan — jemputan tak boleh dihantar semula.' });
      }
      const roleRows = await dbAll('SELECT roleId FROM user_roles WHERE userId = ?', [id]);
      const rolesToAssign = (roleRows || []).map((r) => r.roleId);

      const tokenJemputan = crypto.randomBytes(32).toString('hex');
      const tamatTempoh = janaTokenTamatTempoh(48);
      await dbRun('UPDATE users SET resetToken = ?, resetTokenExpiresAt = ?, updatedAt = ? WHERE id = ?', [tokenJemputan, tamatTempoh, new Date().toISOString(), id]);

      const baseUrlJemputan = baseUrlEmel();
      const pautanJemputan = `${baseUrlJemputan}/tetapkan-kata-laluan?token=${tokenJemputan}`;
      const hantaran = await hantarEmel({
        to: sedia.email,
        subject: 'Jemputan Sertai Adjung Brief',
        html: `<p>Salam,</p>` +
          `<p>Anda telah dijemput sertai Adjung Brief sebagai ${rolesToAssign.join(', ') || sedia.role}.</p>` +
          `<p>Klik pautan berikut untuk menetapkan nama pena, ID pengguna dan kata laluan akaun anda (sah selama 48 jam):</p>` +
          `<p><a href="${pautanJemputan}">${pautanJemputan}</a></p>`,
      });

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'hantar-semula-jemputan',
        targetType: 'akaun',
        targetId: id,
        detail: sedia.email,
      });

      res.json({ success: true, emelDihantar: hantaran.berjaya });
    } catch (err) {
      console.error('POST hantar-semula-jemputan error:', err);
      res.status(500).json({ error: 'Gagal menghantar semula jemputan. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/users/:id/status — Aktif/Cuti/Tidak Aktif/Ditamatkan.
  // denganKunciPeranananPengguna (2026-09-09, bug-hunt, susulan #197) — laluan ni buat corak
  // baca-semak-tulis (TOCTOU) atas invariant SAMA yang PATCH .../roles sudah dikunci untuk:
  // adaPentadbirAktifLain(dbGet, id) SELECT bilangan pentadbir AKTIF LAIN, KEMUDIAN (selepas
  // jurang async) UPDATE users SET status/isSuspended akaun INI. Dahulu TIADA kunci langsung.
  // Dua PATCH .../status hampir serentak yang masing-masing GANTUNG/TAMATKAN salah SATU daripada
  // cuma DUA akaun Pentadbir aktif yang tinggal (cth dua Ketua Editor tamatkan A dan B pada masa
  // sama) boleh berselang-seli: kedua-dua permintaan baca snapshot "pentadbir lain masih aktif"
  // SEBELUM mana-mana UPDATE komited, kedua-dua lulus semakan dan 200 OK — sistem tertinggal
  // SIFAR akaun Pentadbir aktif (kesan tepat yang diamarankan komen adaPentadbirAktifLain() di
  // atas). Disahkan reproduce sebenar (dua akaun pentadbir, DUA PATCH .../status serentak ke
  // 'Ditamatkan' — kedua-dua 200 OK, 0 pentadbir aktif tertinggal) via
  // `.simulasi/sim68-status-pentadbir-terakhir-race.mjs`. Kunci SAMA (bukan berasingan) dgn
  // PATCH .../roles sebab invariant "pentadbir aktif terakhir" DIKONGSI merentasi kedua-dua
  // laluan — kunci berasingan tak cukup menghalang satu laluan bertindih lawan laluan yang lain.
  router.patch('/users/:id/status', requirePermission('manageAccounts'), (req, res) => denganKunciPeranananPengguna(async () => {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      if (!STATUS_SAH.includes(status)) {
        return res.status(400).json({ error: `Status tidak sah. Guna salah satu: ${STATUS_SAH.join(', ')}.` });
      }
      const sedia = await dbGet('SELECT id, penName, username, status AS statusLama, isSuspended AS isSuspendedLama FROM users WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });

      // isSuspended (disemak semasa log masuk, authRoutes.js) diselaraskan ikut status — Tidak
      // Aktif/Ditamatkan menyekat log masuk, Aktif/Cuti tidak.
      const isSuspended = (status === 'Tidak Aktif' || status === 'Ditamatkan') ? 1 : 0;

      // Sekatan pentadbir aktif terakhir (lihat komen adaPentadbirAktifLain() di atas) — cuma
      // relevan bila akaun ni AKAN digantung (statusLama aktif -> isSuspended baharu 1) DAN ia
      // sendiri pegang peranan 'pentadbir'. Akaun bukan-pentadbir/dah pun digantung tak terjejas.
      if (isSuspended === 1 && sedia.isSuspendedLama === 0) {
        const rolesSedia = await dbAll('SELECT roleId FROM user_roles WHERE userId = ?', [id]);
        const iniPentadbir = (rolesSedia || []).some((r) => r.roleId === 'pentadbir');
        if (iniPentadbir && !(await adaPentadbirAktifLain(dbGet, id))) {
          return res.status(400).json({ error: 'Tidak boleh gantung/tamatkan akaun ini — ia satu-satunya akaun Pentadbir aktif yang tinggal. Lantik Pentadbir lain dahulu.' });
        }
      }
      const kini = new Date().toISOString();
      // Dapatan bug-hunt (2026-09-03): Pentadbir "aktifkan semula" akaun yang digantung Dasar
      // Aktif Editorial (amaranTakAktifTahap=3) TIDAK PERNAH direset di sini sebelum ni.
      // runSemakanTakAktif() (server.js) cuma eskalasi bila `tahapSemasa < 3/2/1` — dengan tahap
      // kekal 3 selamanya, akaun yang diaktifkan semula jadi KEBAL kekal daripada dasar ni (tiada
      // amaran/gantung automatik seterusnya) walau tak pernah terbit apa-apa lagi, sehingga dia
      // terbit sekali (yang reset tahap ke 0 di contentRoutes.js). Reset ke 0 DI SINI apabila
      // status bertukar ke 'Aktif' daripada keadaan digantung (`sedia.statusLama` != 'Aktif') —
      // turut segarkan `lastPublishedAt` ke SEKARANG supaya editor dapat tempoh bertenang penuh
      // (7/14/21 hari baharu) bermula dari tarikh diaktifkan semula, bukan terus tersepit ke tahap
      // notis-penamatan pada semakan HARIAN pertama selepas aktifkan semula (basis lama sudah jauh
      // melepasi ambang, tanpa reset ni dia akan digantung semula esok tanpa peluang langsung).
      const patutResetDasarAktif = status === 'Aktif' && sedia.statusLama !== 'Aktif';
      if (patutResetDasarAktif) {
        await dbRun('UPDATE users SET status = ?, isSuspended = ?, amaranTakAktifTahap = 0, lastPublishedAt = ?, updatedAt = ? WHERE id = ?', [status, isSuspended, kini, kini, id]);
      } else {
        await dbRun('UPDATE users SET status = ?, isSuspended = ?, updatedAt = ? WHERE id = ?', [status, isSuspended, kini, id]);
      }

      // Batalkan sesi aktif sedia ada (2026-08-08, dapatan audit keselamatan ChatGPT) —
      // isSuspended cuma disemak semasa log masuk (authRoutes.js), BUKAN pada setiap permintaan
      // (requireAuth/requirePermission cuma semak sesi wujud, tak baca semula status DB). Tanpa
      // ni, akaun yang baru digantung/ditamatkan kekal ada akses PENUH sehingga sesi tamat sendiri
      // (sampai 12 jam) — sama falsafah macam padamSesiPengguna sedia ada selepas tukar kata laluan.
      if (isSuspended === 1) {
        await padamSesiPengguna(id);
      }

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: `status-akaun:${status}`,
        targetType: 'akaun',
        targetId: id,
      });

      // Notifikasi Sistem (Fasa 6b) — akaun digantung/diaktifkan semula. Keputusan Izzat: setiap
      // editor terima notis akaun-SENDIRI, Ketua Editor/Pentadbir terima notis akaun-LAIN.
      //
      // Tajuk notis kini ikut STATUS SEBENAR (2026-09-09, dapatan bug-hunt), bukan cuma
      // `digantung` (binari isSuspended) — STATUS_SAH ada EMPAT nilai (Aktif/Cuti/Tidak
      // Aktif/Ditamatkan) tapi isSuspended cuma 0/1 (Cuti dikira SAMA seperti Aktif, lihat
      // pengiraan `isSuspended` di atas). Bila `digantung` binari tu dipakai terus untuk pilih
      // tajuk, peralihan Aktif->Cuti (isSuspended kekal 0, `digantung`=false) papar tajuk
      // "Akaun anda telah diaktifkan semula" — SALAH, akaun tu bukan sedang "diaktifkan
      // semula", ia BARU sahaja ditukar ke Cuti. Peralihan Tidak Aktif->Cuti (isSuspended
      // 1->0) ada masalah sama. Tajuk kini dipetakan terus daripada `status` baharu supaya
      // keempat-empat nilai dilayan tepat, `digantung` (binari) kekal cuma untuk `type` notis
      // (dibaca MaklumanDrawer.tsx sekadar pilih ikon/label kumpulan, bukan teks).
      const digantung = isSuspended === 1;
      const tajukStatusAkaun = {
        'Aktif': 'Akaun anda telah diaktifkan semula',
        'Cuti': 'Akaun anda kini berstatus Cuti',
        'Tidak Aktif': 'Akaun anda telah digantung',
        'Ditamatkan': 'Akaun anda telah ditamatkan',
      }[status] || `Status akaun anda kini: ${status}`;
      await notify(dbRun, {
        userId: id,
        type: digantung ? 'sistem_akaun_digantung' : 'sistem_akaun_diaktifkan',
        title: tajukStatusAkaun,
        detail: `Status akaun kini: ${status}`,
        targetType: 'akaun',
        targetId: id,
      });
      const pentadbirRows = await dbAll("SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')");
      const penerimaLain = (pentadbirRows || [])
        .map((r) => r.userId)
        .filter((uid) => uid !== id && uid !== req.session?.user?.id);
      await notifyMany(dbRun, penerimaLain, {
        type: digantung ? 'sistem_akaun_digantung' : 'sistem_akaun_diaktifkan',
        title: `${sedia.penName || sedia.username}: status akaun ditukar ke ${status}`,
        detail: `Ditukar oleh ${req.session?.user?.penName || req.session?.user?.username || 'sistem'}.`,
        targetType: 'akaun',
        targetId: id,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('PATCH user status error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini status. ' + (err.message || '') });
    }
  }));

  // PATCH /api/system/users/:id/auto-terbit (2026-08-28, permintaan Izzat) — togol per-editor:
  // bila hidup, butang "Simpan sebagai draf" editor tu (SlotManagerModal.tsx saveDraft()) TERUS
  // menerbitkan seluruh giliran draf, bukan sekadar simpan. TIDAK buka laluan kebenaran baharu di
  // pelayan — cuma tukar keputusan KLIEN; PATCH /content/:id yang menerbitkan sebenar tetap
  // melalui gerbang publish/pemilikan/bajet sedia ada tanpa pengecualian.
  router.patch('/users/:id/auto-terbit', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const { id } = req.params;
      const { autoTerbit } = req.body || {};
      if (typeof autoTerbit !== 'boolean') {
        return res.status(400).json({ error: 'Medan autoTerbit mesti boolean.' });
      }
      const sedia = await dbGet('SELECT id, penName, username FROM users WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });

      await dbRun('UPDATE users SET autoTerbit = ?, updatedAt = ? WHERE id = ?', [autoTerbit ? 1 : 0, new Date().toISOString(), id]);

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: `auto-terbit:${autoTerbit ? 'hidup' : 'mati'}`,
        targetType: 'akaun',
        targetId: id,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('PATCH user auto-terbit error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini togol auto-terbit. ' + (err.message || '') });
    }
  });

  // GET /api/system/users/:id/kandungan-belum-terbit — kiraan/senarai Draf+Menunggu kepunyaan
  // akaun ni, untuk papar amaran SEBELUM Pentadbir sahkan "Ditamatkan" (bukan padam automatik
  // senyap — keputusan Izzat: "tunjuk & minta pengesahan").
  router.get('/users/:id/kandungan-belum-terbit', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const { id } = req.params;
      const user = await dbGet('SELECT penName FROM users WHERE id = ?', [id]);
      if (!user) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });
      const { draf, menunggu } = await cariKandunganBelumTerbit(dbAll, (user.penName || '').trim());
      res.json({ draf, menunggu });
    } catch (err) {
      console.error('GET kandungan-belum-terbit error:', err);
      res.status(500).json({ error: 'Gagal mengira kandungan belum terbit. ' + (err.message || '') });
    }
  });

  // POST /api/system/users/:id/kandungan-belum-terbit/padam — padam SEBENAR Draf+Menunggu
  // kepunyaan akaun ni. Kandungan approved/archived (Arkib) TIDAK disentuh — itu rekod sejarah
  // kekal, "terbitan tak boleh padam" (peraturan projek) terpakai penuh di sini.
  // denganKunciKandungan (2026-08-08, dapatan audit keselamatan ChatGPT) — dahulu TIADA kunci
  // mutasi, walhal laluan ni baca-ubah-tulis slots_config.manualSummary (sama medan yang PATCH/
  // reject-to-draft/pulihkan-sampah/POST-slots semua DAH dikunci) DAN DELETE editorial_objects
  // pending. Editor simpan draf baharu SEMASA Pentadbir padam kandungan belum-terbit akaun sama:
  // draf baharu boleh hilang senyap, ditimpa tulisan laluan ni yang baca versi lama.
  router.post('/users/:id/kandungan-belum-terbit/padam', requirePermission('manageAccounts'), (req, res) => denganKunciKandungan(async () => {
    try {
      const { id } = req.params;
      const user = await dbGet('SELECT penName, username FROM users WHERE id = ?', [id]);
      if (!user) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });
      const penName = (user.penName || '').trim();
      if (!penName) return res.json({ success: true, drafDipadam: 0, menungguDipadam: 0 });

      let drafDipadam = 0;
      const slots = await dbAll(
        "SELECT slotIndex, manualSummary FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex >= 0"
      );
      for (const slot of slots || []) {
        if (BAR_SLOTS.has(slot.slotIndex)) continue;
        const manualSummary = slot.manualSummary || '';
        const mentah = bahagikanBlokMentah(manualSummary);
        if (mentah.length === 0) continue;
        const parsed = parseManualSummaryBlocks(manualSummary);
        const disimpan = [];
        let berubah = false;
        mentah.forEach((raw, i) => {
          const meta = parsed[i];
          const buang = meta && meta.status === 'draft' && samaNama(meta.penulis, penName);
          if (buang) { drafDipadam += 1; berubah = true; }
          else disimpan.push(raw.trim());
        });
        if (berubah) {
          const nextSummary = disimpan.join(DRAFT_BLOCK_SEPARATOR);
          await dbRun(
            "UPDATE slots_config SET manualSummary = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?",
            [nextSummary, slot.slotIndex]
          );
        }
      }

      const rows = await dbAll(`
        SELECT eo.id FROM editorial_objects eo
        INNER JOIN (SELECT objectId, MAX(version) mv FROM editorial_revisions GROUP BY objectId) lv ON lv.objectId = eo.id
        INNER JOIN editorial_revisions er ON er.objectId = eo.id AND er.version = lv.mv
        INNER JOIN editorial_attribute_values eav ON eav.objectId = eo.id AND eav.revisionId = er.id AND eav.attributeId = 'editorName'
        WHERE er.status = 'pending' AND eav.valueText = ?
      `, [penName]);
      for (const r of rows || []) {
        await dbRun('DELETE FROM editorial_objects WHERE id = ?', [r.id]); // CASCADE ke revisions/attrs
      }

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'padam-kandungan-belum-terbit',
        targetType: 'akaun',
        targetId: id,
        detail: `${user.penName || user.username}: ${drafDipadam} draf, ${rows.length} menunggu dipadam.`,
      });

      res.json({ success: true, drafDipadam, menungguDipadam: rows.length });
    } catch (err) {
      console.error('POST kandungan-belum-terbit/padam error:', err);
      res.status(500).json({ error: 'Gagal memadam kandungan belum terbit. ' + (err.message || '') });
    }
  }));

  // PATCH /api/system/users/:id/roles — ganti SELURUH set peranan akaun (satu akaun boleh
  // pegang berbilang — cth Izzat Pentadbir + Ketua Editor serentak).
  // denganKunciPeranananPengguna (2026-09-09, bug-hunt) — lihat komen kunciKandungan.js: laluan
  // ni DELETE seluruh baris user_roles akaun ni lalu gelung INSERT semula, sibling pepijat corak
  // permohonanPenajaRoutes.js/sponsorRoutes.js. Tanpa kunci ni, dua PATCH .../roles hampir
  // serentak bagi akaun SAMA boleh berselang-seli DELETE/INSERT dan menghilangkan peranan senyap.
  router.patch('/users/:id/roles', requirePermission('manageAccounts'), (req, res) => denganKunciPeranananPengguna(async () => {
    try {
      const { id } = req.params;
      const { roles } = req.body || {};
      if (!Array.isArray(roles) || roles.some((r) => !ROLE_IDS_SAH.includes(r))) {
        return res.status(400).json({ error: `Peranan tidak sah. Guna gabungan: ${ROLE_IDS_SAH.join(', ')}.` });
      }
      if (roles.length === 0) {
        return res.status(400).json({ error: 'Akaun mesti pegang sekurang-kurangnya satu peranan.' });
      }
      const sedia = await dbGet('SELECT id, isSuspended FROM users WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });

      // Sekatan pentadbir aktif terakhir (lihat komen adaPentadbirAktifLain() di atas) — cuma
      // relevan bila akaun ni AKTIF sekarang, PEGANG 'pentadbir' sekarang, dan set peranan BAHARU
      // tak lagi termasuk 'pentadbir'. Akaun yang dah digantung tak dikira (dah pun tak boleh
      // manageAccounts walau roles dia apa sekalipun).
      if (sedia.isSuspended === 0 && !roles.includes('pentadbir')) {
        const rolesSediaAda = await dbAll('SELECT roleId FROM user_roles WHERE userId = ?', [id]);
        const iniPentadbir = (rolesSediaAda || []).some((r) => r.roleId === 'pentadbir');
        if (iniPentadbir && !(await adaPentadbirAktifLain(dbGet, id))) {
          return res.status(400).json({ error: 'Tidak boleh tarik balik peranan Pentadbir daripada akaun ini — ia satu-satunya akaun Pentadbir aktif yang tinggal. Lantik Pentadbir lain dahulu.' });
        }
      }

      await dbRun('DELETE FROM user_roles WHERE userId = ?', [id]);
      for (const roleId of roles) {
        await dbRun('INSERT OR IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)', [id, roleId]);
      }
      // `role` legasi diselaraskan sekali untuk paparan lama (Indeks dsb.) — bukan sumber
      // kebenaran, cuma elak label ketinggalan zaman.
      const roleLegasiBaharu = roles.includes('ketua_editor') ? 'KETUA_EDITOR' : 'EDITOR';
      await dbRun('UPDATE users SET role = ?, updatedAt = ? WHERE id = ?', [roleLegasiBaharu, new Date().toISOString(), id]);

      // Segarkan sesi LIVE PEMANGGIL SENDIRI (2026-09-09, bug-hunt, susulan #227 penName) — sesi
      // pemanggil sengaja DIKECUALIKAN drpd padamSesiPengguna di bawah (2026-09-03, supaya dia
      // tak log keluar sendiri), tapi itu bermakna req.session.user snapshot dia TAK PERNAH
      // disegarkan langsung selepas ni. `roles` (JAMAK) memang disegar LIVE setiap permintaan
      // /api/system/* oleh middleware refreshSessionRoles (server.js), tapi `role` (TUNGGAL,
      // legasi) TIADA mekanisme setara — ia hanya ditetapkan sekali semasa /login dan dipulangkan
      // mentah oleh GET /api/auth/me. Client (App.tsx) baca authUser.role terus utk kelayakan
      // Editorium DAN byline currentEditoriumName/currentEditoriumContact (Ketua Editor sahaja) —
      // tanpa baris ni, Pentadbir yang tarik balik ketua_editor drpd akaun dia sendiri kekal
      // dilayan sbg Ketua Editor pada UI sehingga log keluar/masuk semula (sampai 12 jam),
      // walaupun DB (dan requirePermission() sebenar) sudah betul serta-merta.
      if (req.session?.user?.id === id) {
        req.session.user.role = roleLegasiBaharu;
        req.session.user.roles = roles;
      }

      // Batalkan sesi aktif sedia ada (2026-08-08, dapatan audit keselamatan ChatGPT) —
      // requirePermission() baca req.session.user.roles yang DICAP semasa log masuk, bukan baca
      // semula jadual user_roles setiap permintaan. Tanpa ni, akaun yang baru DITURUNKAN peranan
      // (cth Ketua Editor ditarik balik ke Editor sahaja) kekal ada kebenaran LAMA sepanjang sesi
      // masih hidup (sampai 12 jam) — bukan sekadar UI lapuk, kebenaran sebenar di pelayan pun
      // lapuk. Sama falsafah macam padamSesiPengguna sedia ada selepas tukar kata laluan.
      //
      // Sesi PEMANGGIL sendiri dikecualikan (2026-09-03, dapatan bug-hunt, diluluskan Izzat) —
      // Pentadbir yang tukar peranan AKAUN DIA SENDIRI (cth uruskan peranan tambahan) tak sepatutnya
      // log keluar sendiri sebagai kesan sampingan tak sengaja. Sama corak macam laluan tukar kata
      // laluan (~baris 159 fail ni), yang sudah kecualikan `req.sessionID` betul.
      await padamSesiPengguna(id, req.sessionID);

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'ubah-peranan',
        targetType: 'akaun',
        targetId: id,
        detail: `peranan baharu: ${roles.join(', ')}`,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('PATCH user roles error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini peranan. ' + (err.message || '') });
    }
  }));

  return router;
}

export default createUserAdminRoutes;
