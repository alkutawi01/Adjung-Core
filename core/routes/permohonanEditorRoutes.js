import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { notifyMany } from '../notifications/Notify.js';
import { logAudit } from '../audit/AuditLog.js';

// Laluan Permohonan Editor (2026-08-25, arahan Izzat — modul KIV 14/8 "Aliran Permohonan
// Editor" kini dibina). Borang awam "Sertai Pasukan Editorial" (HalamanSertai.tsx) menghantar
// permohonan ke sini; Ketua Editor/Pentadbir menyemak di Editorium (DirektoriConsole, seksyen
// Permohonan) dan membuat keputusan.
//
// SENGAJA TIADA laluan "terima = cipta akaun" di sini — butang Terima di DirektoriConsole
// memanggil POST /api/system/users SEDIA ADA (userAdminRoutes.js:165, lengkap dengan kunci
// kandungan, token jemputan 48 jam, e-mel /tetapkan-kata-laluan dan audit) KEMUDIAN menanda
// status permohonan melalui /keputusan di bawah. Menduakan blok cipta-akaun di sini akan
// mencipta dua laluan yang boleh menyimpang (sejarah pepijat projek ini: salinan berganda
// nombor/logik — lihat CLAUDE.md 2026-07-25).

const STATUS_SAH = ['baharu', 'diterima', 'ditolak'];

// Pengesahan kandungan medan (2026-08-25, teguran Izzat: "takkanlah boleh masukkan mcm ni kan?
// kena auto validate kan?") — peraturan DICERMINKAN daripada sahkanMedan() di HalamanSertai.tsx
// (klien). Klien memberi mesej mesra per-medan; semakan di sini ialah gerbang SEBENAR (borang
// boleh dipintas dengan curl). Ubah kedua-dua tempat serentak jika peraturan berubah.
const NEGERI_SAH = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis',
  'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
  'Wilayah Persekutuan Kuala Lumpur', 'Wilayah Persekutuan Labuan', 'Wilayah Persekutuan Putrajaya',
  'Luar Malaysia',
];

function sahkanMedanPermohonan(b) {
  const nama = b.namaPenuh.trim();
  if (!/^[\p{L}][\p{L}\p{M}'’.\- ]{2,}$/u.test(nama) || !nama.includes(' ')) {
    return 'Nama penuh tidak sah. Sila berikan nama penuh sebenar anda.';
  }
  const telefon = b.telefon.trim();
  const angkaTelefon = telefon.replace(/[^0-9]/g, '');
  if (!/^\+?[0-9 ()\-]+$/.test(telefon) || angkaTelefon.length < 9 || angkaTelefon.length > 15) {
    return 'Nombor telefon tidak sah. Contoh: 012-3456789';
  }
  if (!NEGERI_SAH.includes(b.negeri.trim())) {
    return 'Sila pilih negeri daripada senarai yang disediakan.';
  }
  const kelulusan = b.kelulusan.trim();
  if (kelulusan.length < 8 || !/\p{L}{3,}/u.test(kelulusan)) {
    return 'Sila nyatakan kelulusan dengan lengkap (nama kursus, universiti dan tahun graduasi).';
  }
  if (b.motivasi.trim().length < 20) {
    return 'Sila terangkan motivasi anda dengan lebih lengkap, sekurang-kurangnya 20 aksara.';
  }
  const pautan = (b.pautanContoh || '').trim();
  if (pautan && !/^https?:\/\/[^\s]+\.[^\s]{2,}/.test(pautan)) {
    return 'Pautan contoh penulisan mesti bermula dengan http:// atau https://';
  }
  return '';
}
const HAD = {
  namaPenuh: 120,
  emel: 160,
  telefon: 30,
  negeri: 60,
  kelulusan: 200,
  pengalaman: 1000,
  pautanContoh: 300,
  motivasi: 1500,
};

export function createPermohonanEditorRoutes(dbAll, dbGet, dbRun) {
  const router = express.Router();

  // POST /api/public/permohonan-editor — borang awam, tiada auth. Pertahanan spam dua lapis:
  // (1) pengehad kadar khusus didaftar di server.js (lihat hadPermohonanEditor), (2) medan
  // honeypot `laman` — tersembunyi daripada manusia melalui CSS di borang; bot yang mengisinya
  // menerima respons "berjaya" PALSU (200) tetapi tiada rekod ditulis, supaya bot tidak dapat
  // membezakan hantaran yang ditapis daripada yang berjaya dan tidak menyesuaikan diri.
  router.post('/public/permohonan-editor', async (req, res) => {
    try {
      const b = req.body || {};
      if (typeof b.laman === 'string' && b.laman.trim() !== '') {
        return res.json({ success: true });
      }

      const medanWajib = ['namaPenuh', 'emel', 'telefon', 'negeri', 'kelulusan', 'motivasi'];
      for (const m of medanWajib) {
        if (typeof b[m] !== 'string' || !b[m].trim()) {
          return res.status(400).json({ error: 'Sila lengkapkan semua medan wajib.' });
        }
      }
      for (const [m, had] of Object.entries(HAD)) {
        if (typeof b[m] === 'string' && b[m].length > had) {
          return res.status(400).json({ error: `Medan ${m} melebihi had ${had} aksara.` });
        }
      }
      const emel = b.emel.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emel)) {
        return res.status(400).json({ error: 'Alamat e-mel tidak sah.' });
      }
      const ralatMedan = sahkanMedanPermohonan(b);
      if (ralatMedan) {
        return res.status(400).json({ error: ralatMedan });
      }
      // Had panjang SETIAP item (2026-09-03, dapatan bug-hunt) — klien (HalamanSertai.tsx) cuma
      // hantar nama Bidang SEBENAR (senarai tetap, checkbox) jadi selalunya pendek, tapi laluan
      // ni awam tanpa auth (boleh dipintas curl, sama seperti medan lain di HAD di atas) —
      // sebelum ni cuma bilangan item dihadkan (slice(0,10)), setiap item sendiri BOLEH sepanjang
      // apa-apa (dibatas hanya oleh had body JSON global 10MB) — 10 item x jutaan aksara akan
      // menggembungkan lajur `bidangMinat` (JSON) dan mesej makluman `detail` (join ke satu
      // ayat) dgn teks tak bermakna. Had 60 aksara sepadan medan `negeri` (had lain yang serupa
      // sifatnya — nilai pendek daripada senarai tetap).
      const bidangMinat = Array.isArray(b.bidangMinat)
        ? b.bidangMinat.filter((x) => typeof x === 'string' && x.trim() && x.trim().length <= 60).map((x) => x.trim()).slice(0, 10)
        : [];
      if (bidangMinat.length === 0) {
        return res.status(400).json({ error: 'Pilih sekurang-kurangnya satu Bidang minat.' });
      }

      // Satu permohonan terbuka per e-mel — permohonan kedua semasa yang pertama masih 'baharu'
      // ditolak dengan mesej jelas, bukan direkod berganda (memenuhkan senarai semakan Ketua
      // Editor dengan pendua).
      const sediaAda = await dbGet(
        "SELECT id FROM permohonan_editor WHERE LOWER(emel) = ? AND status = 'baharu'",
        [emel]
      );
      if (sediaAda) {
        return res.status(409).json({ error: 'Permohonan dengan e-mel ini sedang dalam semakan. Sila tunggu keputusan.' });
      }

      const id = `permohonan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const kini = new Date().toISOString();
      await dbRun(
        `INSERT INTO permohonan_editor
           (id, namaPenuh, emel, telefon, negeri, kelulusan, bidangMinat, pengalaman, pautanContoh, motivasi, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'baharu', ?)`,
        [
          id,
          b.namaPenuh.trim(),
          emel,
          b.telefon.trim(),
          b.negeri.trim(),
          b.kelulusan.trim(),
          JSON.stringify(bidangMinat),
          (b.pengalaman || '').trim(),
          (b.pautanContoh || '').trim(),
          b.motivasi.trim(),
          kini,
        ]
      );

      // Beritahu Ketua Editor + Pentadbir melalui Peti Makluman (kategori Sistem, konvensyen
      // awalan sistem_* seperti notifikasi akaun di userAdminRoutes.js) — permohonan baharu
      // ialah tindakan luar sistem, bukan tindakan editorial mana-mana editor.
      try {
        const penerima = await dbAll(
          "SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')"
        );
        await notifyMany(
          dbRun,
          penerima.map((r) => r.userId),
          {
            type: 'sistem_permohonan_editor',
            title: 'Permohonan editor baharu diterima',
            detail: `${b.namaPenuh.trim()} (${emel}) memohon menyertai pasukan editorial — Bidang minat: ${bidangMinat.join(', ')}.`,
            targetType: 'permohonan',
            targetId: id,
          },
          dbGet
        );
      } catch (eNotifikasi) {
        // Notifikasi gagal TIDAK menggagalkan permohonan — rekod sudah selamat dalam DB.
        console.warn('Notifikasi permohonan editor gagal:', eNotifikasi?.message);
      }

      res.json({ success: true, id });
    } catch (err) {
      console.error('POST permohonan-editor error:', err);
      res.status(500).json({ error: 'Gagal menghantar permohonan. Sila cuba sekali lagi.' });
    }
  });

  // GET /api/system/permohonan-editor — senarai untuk semakan (Ketua Editor/Pentadbir sahaja,
  // kebenaran sama seperti pengurusan akaun). ?status=baharu|diterima|ditolak (pilihan).
  router.get('/system/permohonan-editor', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const status = STATUS_SAH.includes(req.query.status) ? req.query.status : null;
      const rows = await dbAll(
        `SELECT * FROM permohonan_editor ${status ? 'WHERE status = ?' : ''} ORDER BY createdAt DESC LIMIT 200`,
        status ? [status] : []
      );
      res.json(rows.map((r) => ({ ...r, bidangMinat: JSON.parse(r.bidangMinat || '[]') })));
    } catch (err) {
      console.error('GET permohonan-editor error:', err);
      res.status(500).json({ error: 'Gagal memuatkan senarai permohonan.' });
    }
  });

  // POST /api/system/permohonan-editor/:id/keputusan — tanda diterima/ditolak + catatan.
  // Untuk keputusan 'diterima', klien memanggil POST /api/system/users DAHULU (cipta akaun +
  // e-mel jemputan), kemudian laluan ini merekodkan keputusan — lihat nota kepala fail.
  router.post('/system/permohonan-editor/:id/keputusan', requirePermission('manageAccounts'), async (req, res) => {
    try {
      const { id } = req.params;
      const { keputusan, catatan } = req.body || {};
      if (!['diterima', 'ditolak'].includes(keputusan)) {
        return res.status(400).json({ error: "Keputusan mesti 'diterima' atau 'ditolak'." });
      }
      const rekod = await dbGet('SELECT id, status, emel, namaPenuh FROM permohonan_editor WHERE id = ?', [id]);
      if (!rekod) return res.status(404).json({ error: 'Permohonan tidak dijumpai.' });
      if (rekod.status !== 'baharu') {
        return res.status(409).json({ error: `Permohonan ini sudah ${rekod.status}.` });
      }
      const kini = new Date().toISOString();
      await dbRun(
        'UPDATE permohonan_editor SET status = ?, catatanSemakan = ?, disemakOleh = ?, disemakPada = ? WHERE id = ?',
        [keputusan, (catatan || '').trim(), req.session?.user?.penName || req.session?.user?.username || '', kini, id]
      );
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: keputusan === 'diterima' ? 'terima-permohonan-editor' : 'tolak-permohonan-editor',
        targetType: 'permohonan',
        targetId: id,
        detail: `${rekod.namaPenuh} (${rekod.emel})${catatan ? ` — ${String(catatan).trim()}` : ''}`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('POST permohonan-editor keputusan error:', err);
      res.status(500).json({ error: 'Gagal merekodkan keputusan.' });
    }
  });

  return router;
}
