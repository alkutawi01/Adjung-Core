import express from 'express';
import crypto from 'crypto';
import { requirePermission } from '../middleware/auth.js';
import { notifyMany } from '../notifications/Notify.js';
import { logAudit } from '../audit/AuditLog.js';
import { hantarEmel } from '../email/MailSender.js';
import { simpanFailMuatNaik } from './mediaRoutes.js';

// Permohonan Penaja (2026-08-30) — aliran awam "Mohon Jadi Penaja", dikunci selepas 10
// pusingan perbincangan Izzat/ChatGPT (rujukan: PBS Funding Standards, Institute for Nonprofit
// News, National Council of Nonprofits, ProPublica, IRS Qualified Sponsorship, Content Code
// Malaysia 2022). Prinsip teras: Adjung menjual PENGIKTIRAFAN (acknowledgment), bukan iklan
// atau derma — penajaan tidak memberi sebarang hak mempengaruhi kandungan editorial.
//
// Carta status:
//   baharu -> dalam_semakan -> {perlu_maklumat | ditolak | diluluskan}
//   diluluskan -> (bukti bayaran + logo dihantar) -> dibayar -> aktif -> tamat
//
// SENGAJA TIADA akaun/log masuk penaja (keputusan Izzat) — kelulusan & bayaran berjalan
// melalui e-mel + SATU pautan peribadi berjangka (token, 7 hari, boleh dihantar semula kalau
// tersalah muat naik — bukan token sekali-guna literal). Rekod `permohonan_penaja` BERASINGAN
// drpd jadual `sponsors` aktif (sama corak `permohonan_editor` vs `users`) — "Aktifkan sebagai
// Penaja" mencipta/mengemas kini baris `sponsors` sedia ada, permohonan asal kekal sbg sejarah.
//
// Syarat kelayakan (keputusan Izzat 30/8/2026, sengaja umum — tafsiran terperinci ialah budi
// bicara Ketua Editor semasa semakan, BUKAN checklist rigid dalam kod): organisasi/aktiviti
// pemohon tidak boleh bercanggah dengan syariat Islam. Checklist semakan di bawah ialah PANDUAN
// bidang yang perlu disemak, bukan kriteria automatik lulus/tolak.

const HAD = {
  namaSebenar: 120,
  namaOrganisasi: 150,
  namaWakil: 120,
  emel: 160,
  laman: 300,
  noPendaftaran: 60,
  aktivitiUtama: 200,
  penerangan: 300,
  catatan: 800,
};
const STATUS_SENARAI = ['baharu', 'dalam_semakan', 'perlu_maklumat', 'ditolak', 'diluluskan', 'dibayar', 'aktif', 'tamat'];
const TEMPOH_TOKEN_HARI = 7;
const TEMPOH_TAJAAN_MAX_HARI = 31; // maksimum 1 bulan (keputusan Izzat 30/8/2026)

const janaRujukan = async (dbGet) => {
  const tahun = new Date().getFullYear();
  const awalan = `PEN-${tahun}-`;
  const terakhir = await dbGet(
    "SELECT id FROM permohonan_penaja WHERE id LIKE ? ORDER BY id DESC LIMIT 1",
    [`${awalan}%`]
  );
  const nomborSeterusnya = terakhir ? parseInt(terakhir.id.slice(awalan.length), 10) + 1 : 1;
  return `${awalan}${String(nomborSeterusnya).padStart(4, '0')}`;
};

// Angka Rom untuk label "Hamba Allah N" — dijana daripada anonymousNo semasa paparan sahaja,
// TIDAK disimpan sebagai teks (lihat komen ALTER TABLE sponsors.anonymousNo, server.js).
export function angkaRom(n) {
  const peta = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let sisa = n;
  let hasil = '';
  for (const [nilai, simbol] of peta) {
    while (sisa >= nilai) { hasil += simbol; sisa -= nilai; }
  }
  return hasil || String(n);
}

export function createPermohonanPenajaRoutes(dbAll, dbGet, dbRun, rootDir) {
  const router = express.Router();

  // POST /api/public/permohonan-penaja — borang awam, tiada auth. Honeypot `laman` sama corak
  // permohonan_editor.
  router.post('/public/permohonan-penaja', async (req, res) => {
    try {
      const b = req.body || {};
      if (typeof b.laman === 'string' && b.laman.trim() !== '') {
        return res.json({ success: true });
      }
      const jenis = b.jenisPemohon;
      if (!['individu', 'organisasi'].includes(jenis)) {
        return res.status(400).json({ error: 'Jenis pemohon mesti Individu atau Organisasi.' });
      }
      const emel = String(b.emel || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emel)) {
        return res.status(400).json({ error: 'Alamat e-mel tidak sah.' });
      }
      for (const [m, had] of Object.entries(HAD)) {
        if (typeof b[m] === 'string' && b[m].length > had) {
          return res.status(400).json({ error: `Medan ${m} melebihi had ${had} aksara.` });
        }
      }

      let namaSebenar = '', namaOrganisasi = '', namaWakil = '', pilihanPaparan = null;
      if (jenis === 'individu') {
        namaSebenar = String(b.namaSebenar || '').trim();
        if (!namaSebenar) return res.status(400).json({ error: 'Sila isi nama sebenar anda.' });
        pilihanPaparan = b.pilihanPaparan === 'hamba_allah' ? 'hamba_allah' : 'nama';
      } else {
        namaOrganisasi = String(b.namaOrganisasi || '').trim();
        namaWakil = String(b.namaWakil || '').trim();
        if (!namaOrganisasi) return res.status(400).json({ error: 'Sila isi nama organisasi.' });
        if (!namaWakil) return res.status(400).json({ error: 'Sila isi nama wakil yang boleh dihubungi.' });
      }

      const aktivitiUtama = String(b.aktivitiUtama || '').trim();
      if (jenis === 'organisasi' && !aktivitiUtama) {
        return res.status(400).json({ error: 'Sila nyatakan bidang/aktiviti utama organisasi.' });
      }

      // Satu permohonan terbuka per e-mel — sama corak permohonan_editor, elak pendua dalam
      // senarai semakan.
      const sediaAda = await dbGet(
        "SELECT id FROM permohonan_penaja WHERE LOWER(emel) = ? AND status IN ('baharu','dalam_semakan','perlu_maklumat')",
        [emel]
      );
      if (sediaAda) {
        return res.status(409).json({ error: 'Permohonan dengan e-mel ini sedang dalam semakan. Sila tunggu keputusan.' });
      }

      const id = await janaRujukan(dbGet);
      const kini = new Date().toISOString();
      await dbRun(
        `INSERT INTO permohonan_penaja
           (id, jenisPemohon, namaSebenar, namaOrganisasi, namaWakil, emel, laman, noPendaftaran,
            aktivitiUtama, penerangan, pilihanPaparan, pilihanTajaan, catatan, status, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'baharu', ?)`,
        [
          id, jenis, namaSebenar || null, namaOrganisasi || null, namaWakil || null, emel,
          String(b.lamanRasmi || '').trim() || null, String(b.noPendaftaran || '').trim() || null,
          aktivitiUtama || null, String(b.penerangan || '').trim() || null, pilihanPaparan,
          String(b.pilihanTajaan || '').trim() || null, String(b.catatan || '').trim() || null, kini,
        ]
      );

      try {
        const penerima = await dbAll(
          "SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')"
        );
        await notifyMany(
          dbRun,
          penerima.map((r) => r.userId),
          {
            type: 'sistem_permohonan_penaja',
            title: 'Permohonan penajaan baharu diterima',
            detail: `${id} — ${jenis === 'individu' ? namaSebenar : namaOrganisasi} (${emel}) memohon menjadi penaja Adjung Brief.`,
            targetType: 'permohonan_penaja',
            targetId: id,
          },
          dbGet
        );
      } catch (eNotifikasi) {
        console.warn('Notifikasi permohonan penaja gagal:', eNotifikasi?.message);
      }

      res.json({ success: true, id });
    } catch (err) {
      console.error('POST permohonan-penaja error:', err);
      res.status(500).json({ error: 'Gagal menghantar permohonan. Sila cuba sekali lagi.' });
    }
  });

  // GET /api/system/permohonan-penaja — senarai untuk Editorium (gerbang manageSettings, sama
  // seperti sponsorRoutes.js — keputusan perniagaan/penempatan bukan editorial harian).
  router.get('/system/permohonan-penaja', requirePermission('manageSettings'), async (req, res) => {
    try {
      const status = STATUS_SENARAI.includes(req.query.status) ? req.query.status : null;
      const rows = await dbAll(
        `SELECT * FROM permohonan_penaja ${status ? 'WHERE status = ?' : ''} ORDER BY createdAt DESC LIMIT 200`,
        status ? [status] : []
      );
      res.json(rows);
    } catch (err) {
      console.error('GET permohonan-penaja error:', err);
      res.status(500).json({ error: 'Gagal memuatkan senarai permohonan.' });
    }
  });

  // PATCH /api/system/permohonan-penaja/:id/keputusan — tindakan semakan: mula_semakan,
  // minta_maklumat, tolak, lulus. 'lulus' menjana token bayaran + emel arahan bayaran.
  router.patch('/system/permohonan-penaja/:id/keputusan', requirePermission('manageSettings'), async (req, res) => {
    try {
      const { id } = req.params;
      const { tindakan, catatan, jumlahDipersetujui } = req.body || {};
      const rekod = await dbGet('SELECT * FROM permohonan_penaja WHERE id = ?', [id]);
      if (!rekod) return res.status(404).json({ error: 'Permohonan tidak dijumpai.' });

      const kini = new Date().toISOString();
      const namaPapar = rekod.jenisPemohon === 'individu' ? rekod.namaSebenar : rekod.namaOrganisasi;

      if (tindakan === 'mula_semakan') {
        if (rekod.status !== 'baharu') return res.status(409).json({ error: 'Permohonan sudah dalam semakan.' });
        await dbRun('UPDATE permohonan_penaja SET status = ?, updatedAt = ? WHERE id = ?', ['dalam_semakan', kini, id]);
      } else if (tindakan === 'minta_maklumat') {
        await dbRun('UPDATE permohonan_penaja SET status = ?, catatanDalaman = ?, updatedAt = ? WHERE id = ?',
          ['perlu_maklumat', String(catatan || '').trim(), kini, id]);
      } else if (tindakan === 'tolak') {
        await dbRun('UPDATE permohonan_penaja SET status = ?, sebabTolak = ?, updatedAt = ? WHERE id = ?',
          ['ditolak', String(catatan || '').trim(), kini, id]);
        await hantarEmel({
          to: rekod.emel,
          subject: `Permohonan Penajaan Adjung Brief [${id}]`,
          html: `<p>Salam,</p><p>Selepas semakan, Adjung Brief tidak dapat menerima permohonan penajaan ${id} pada masa ini berdasarkan Dasar Penajaan Adjung.</p>${catatan ? `<p>${String(catatan).trim()}</p>` : ''}<p>Terima kasih atas minat anda.</p>`,
        });
      } else if (tindakan === 'lulus') {
        const jumlah = Number(jumlahDipersetujui);
        if (!jumlah || jumlah <= 0) return res.status(400).json({ error: 'Sila nyatakan jumlah tajaan yang dipersetujui.' });
        const token = crypto.randomBytes(32).toString('hex');
        const tokenTamatPada = new Date(Date.now() + TEMPOH_TOKEN_HARI * 86400000).toISOString();
        await dbRun(
          'UPDATE permohonan_penaja SET status = ?, jumlahDipersetujui = ?, tokenBayaran = ?, tokenTamatPada = ?, diluluskanPada = ?, disemakOleh = ?, updatedAt = ? WHERE id = ?',
          ['diluluskan', jumlah, token, tokenTamatPada, kini, req.session?.user?.penName || req.session?.user?.username || '', kini, id]
        );
        const pautan = `${process.env.SITE_URL || 'https://brief.adjung.com'}/lengkapkan-penajaan?token=${token}`;
        await hantarEmel({
          to: rekod.emel,
          subject: `Permohonan Penajaan Diluluskan [${id}]`,
          html: `<p>Salam,</p><p>Tahniah, permohonan penajaan ${id} bagi ${namaPapar} telah diluluskan.</p>` +
            `<p>Jumlah tajaan yang dipersetujui: <strong>RM${jumlah.toLocaleString('ms-MY')}</strong> (tempoh maksimum 1 bulan).</p>` +
            `<p>Sila lengkapkan langkah terakhir (muat naik bukti bayaran${rekod.jenisPemohon === 'organisasi' ? ' dan logo' : ''}) melalui pautan berikut dalam tempoh ${TEMPOH_TOKEN_HARI} hari:</p>` +
            `<p><a href="${pautan}">${pautan}</a></p>` +
            `<p>Tiada log masuk diperlukan. Sebarang pertanyaan, balas terus e-mel ini.</p>`,
        });
      } else {
        return res.status(400).json({ error: 'Tindakan tidak sah.' });
      }

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: `permohonan-penaja-${tindakan}`,
        targetType: 'permohonan_penaja',
        targetId: id,
        detail: `${namaPapar} (${rekod.emel})${catatan ? ` — ${String(catatan).trim()}` : ''}`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('PATCH permohonan-penaja keputusan error:', err);
      res.status(500).json({ error: 'Gagal merekodkan keputusan.' });
    }
  });

  // GET /public/lengkapkan-penajaan/:token — halaman token peribadi, tiada auth.
  router.get('/public/lengkapkan-penajaan/:token', async (req, res) => {
    try {
      const rekod = await dbGet('SELECT * FROM permohonan_penaja WHERE tokenBayaran = ?', [req.params.token]);
      if (!rekod) return res.status(404).json({ error: 'Pautan tidak sah.' });
      if (!['diluluskan', 'dibayar'].includes(rekod.status)) {
        return res.status(410).json({ error: 'Pautan ini tidak lagi aktif.' });
      }
      if (rekod.tokenTamatPada && new Date(rekod.tokenTamatPada).getTime() < Date.now()) {
        return res.status(410).json({ error: 'Pautan ini telah tamat tempoh. Sila hubungi Adjung Brief untuk pautan baharu.' });
      }
      res.json({
        id: rekod.id,
        jenisPemohon: rekod.jenisPemohon,
        namaPapar: rekod.jenisPemohon === 'individu' ? rekod.namaSebenar : rekod.namaOrganisasi,
        jumlahDipersetujui: rekod.jumlahDipersetujui,
        status: rekod.status,
        buktiBayaranUrl: rekod.buktiBayaranUrl || '',
        logoUrl: rekod.logoUrl || '',
        perluLogo: rekod.jenisPemohon === 'organisasi',
      });
    } catch (err) {
      console.error('GET lengkapkan-penajaan error:', err);
      res.status(500).json({ error: 'Ralat pelayan.' });
    }
  });

  // POST /public/lengkapkan-penajaan/:token/upload — muat naik bukti bayaran/logo TANPA sesi.
  // `/api/media/upload` (mediaRoutes.js) digerbang `requireAuthForWrites` di peringkat mount
  // (server.js) — pemohon penaja TIADA akaun (keputusan Izzat), jadi laluan ni sahkan kelayakan
  // dgn cara LAIN: token permohonan mesti sah, status 'diluluskan' & belum tamat tempoh. Guna
  // simpanFailMuatNaik() dikongsi (sama had jenis/saiz fail macam /media/upload).
  router.post('/public/lengkapkan-penajaan/:token/upload', async (req, res) => {
    try {
      const rekod = await dbGet('SELECT id, status, tokenTamatPada FROM permohonan_penaja WHERE tokenBayaran = ?', [req.params.token]);
      if (!rekod) return res.status(404).json({ error: 'Pautan tidak sah.' });
      if (rekod.status !== 'diluluskan') return res.status(409).json({ error: 'Pautan ini tidak lagi aktif.' });
      if (rekod.tokenTamatPada && new Date(rekod.tokenTamatPada).getTime() < Date.now()) {
        return res.status(410).json({ error: 'Pautan ini telah tamat tempoh.' });
      }
      const { filename, fileData } = req.body || {};
      const hasil = simpanFailMuatNaik(rootDir, filename, fileData);
      if (hasil.error) return res.status(hasil.status || 400).json({ error: hasil.error });
      res.json({ url: hasil.url });
    } catch (err) {
      console.error('POST lengkapkan-penajaan upload error:', err);
      res.status(500).json({ error: 'Gagal memuat naik fail.' });
    }
  });

  // POST /public/lengkapkan-penajaan/:token — hantar bukti bayaran (+ logo jika organisasi).
  // Boleh dihantar semula (bukan sekali-guna literal, keputusan Izzat/ChatGPT — pemohon mungkin
  // tersalah muat naik) selagi token belum tamat & status belum 'dibayar'.
  router.post('/public/lengkapkan-penajaan/:token', async (req, res) => {
    try {
      const rekod = await dbGet('SELECT * FROM permohonan_penaja WHERE tokenBayaran = ?', [req.params.token]);
      if (!rekod) return res.status(404).json({ error: 'Pautan tidak sah.' });
      if (rekod.status !== 'diluluskan') {
        return res.status(409).json({ error: 'Permohonan ini tidak lagi menunggu bukti bayaran.' });
      }
      if (rekod.tokenTamatPada && new Date(rekod.tokenTamatPada).getTime() < Date.now()) {
        return res.status(410).json({ error: 'Pautan ini telah tamat tempoh. Sila hubungi Adjung Brief untuk pautan baharu.' });
      }
      const { buktiBayaranUrl, logoUrl, tarikhBayaran } = req.body || {};
      if (!buktiBayaranUrl || typeof buktiBayaranUrl !== 'string') {
        return res.status(400).json({ error: 'Sila muat naik bukti bayaran.' });
      }
      if (rekod.jenisPemohon === 'organisasi' && (!logoUrl || typeof logoUrl !== 'string')) {
        return res.status(400).json({ error: 'Sila muat naik logo organisasi.' });
      }
      const kini = new Date().toISOString();
      await dbRun(
        'UPDATE permohonan_penaja SET buktiBayaranUrl = ?, logoUrl = ?, tarikhBayaranDihantar = ?, updatedAt = ? WHERE id = ?',
        [buktiBayaranUrl, logoUrl || null, (tarikhBayaran || '').trim() || null, kini, rekod.id]
      );
      try {
        const penerima = await dbAll("SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')");
        await notifyMany(dbRun, penerima.map((r) => r.userId), {
          type: 'sistem_permohonan_penaja',
          title: 'Bukti bayaran penajaan diterima',
          detail: `${rekod.id} telah menghantar bukti bayaran. Sila sahkan di Editorium.`,
          targetType: 'permohonan_penaja',
          targetId: rekod.id,
        }, dbGet);
      } catch (e) { console.warn('Notifikasi bukti bayaran gagal:', e?.message); }
      res.json({ success: true });
    } catch (err) {
      console.error('POST lengkapkan-penajaan error:', err);
      res.status(500).json({ error: 'Gagal menghantar. Sila cuba sekali lagi.' });
    }
  });

  // PATCH /api/system/permohonan-penaja/:id/sahkan-bayaran — admin sahkan bayaran diterima.
  router.patch('/system/permohonan-penaja/:id/sahkan-bayaran', requirePermission('manageSettings'), async (req, res) => {
    try {
      const rekod = await dbGet('SELECT * FROM permohonan_penaja WHERE id = ?', [req.params.id]);
      if (!rekod) return res.status(404).json({ error: 'Permohonan tidak dijumpai.' });
      if (!rekod.buktiBayaranUrl) return res.status(409).json({ error: 'Bukti bayaran belum dihantar pemohon.' });
      const kini = new Date().toISOString();
      await dbRun('UPDATE permohonan_penaja SET status = ?, dibayarPada = ?, updatedAt = ? WHERE id = ?', ['dibayar', kini, kini, rekod.id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'permohonan-penaja-sahkan-bayaran',
        targetType: 'permohonan_penaja',
        targetId: rekod.id,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('PATCH sahkan-bayaran error:', err);
      res.status(500).json({ error: 'Gagal mengesahkan bayaran.' });
    }
  });

  // POST /api/system/permohonan-penaja/:id/aktifkan — cipta/kemas kini baris `sponsors` sedia
  // ada. `sponsorSediaAdaId` (pilihan) — pembaharuan penaja Hamba Allah sedia ada, PAUTKAN
  // (jangan cipta baris baharu / jangan teka ikut nama) supaya anonymousNo dikekalkan.
  router.post('/system/permohonan-penaja/:id/aktifkan', requirePermission('manageSettings'), async (req, res) => {
    try {
      const rekod = await dbGet('SELECT * FROM permohonan_penaja WHERE id = ?', [req.params.id]);
      if (!rekod) return res.status(404).json({ error: 'Permohonan tidak dijumpai.' });
      if (rekod.status !== 'dibayar') return res.status(409).json({ error: 'Bayaran belum disahkan.' });
      if (rekod.jenisPemohon === 'organisasi' && !rekod.logoUrl) {
        return res.status(409).json({ error: 'Logo organisasi belum dihantar.' });
      }

      const { sponsorSediaAdaId, slotIndexes } = req.body || {};
      const kini = new Date();
      const mulaTajaan = kini.toISOString();
      let tempohHari = Number(req.body?.tempohHari) || TEMPOH_TAJAAN_MAX_HARI;
      if (tempohHari > TEMPOH_TAJAAN_MAX_HARI) tempohHari = TEMPOH_TAJAAN_MAX_HARI;
      const tamatTajaan = new Date(kini.getTime() + tempohHari * 86400000).toISOString();
      const bulanSemasa = mulaTajaan.slice(0, 7);
      const namaPapar = rekod.jenisPemohon === 'individu'
        ? (rekod.pilihanPaparan === 'hamba_allah' ? null : rekod.namaSebenar)
        : rekod.namaOrganisasi;

      let sponsorId = sponsorSediaAdaId || null;
      if (sponsorId) {
        const sponsorSediaAda = await dbGet('SELECT id, anonymousNo FROM sponsors WHERE id = ?', [sponsorId]);
        if (!sponsorSediaAda) return res.status(404).json({ error: 'Penaja sedia ada tidak dijumpai untuk dipautkan.' });
        await dbRun(
          `UPDATE sponsors SET logoUrl = ?, url = ?, bulan = ?, mulaTajaan = ?, tamatTajaan = ?, jumlahBayaran = ?, status = 'aktif', updatedAt = ? WHERE id = ?`,
          [rekod.logoUrl || '', rekod.laman || '', bulanSemasa, mulaTajaan, tamatTajaan, rekod.jumlahDipersetujui || 0, kini.toISOString(), sponsorId]
        );
      } else {
        sponsorId = `penaja-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let anonymousNo = null;
        if (rekod.jenisPemohon === 'individu' && rekod.pilihanPaparan === 'hamba_allah') {
          const maxRow = await dbGet('SELECT MAX(anonymousNo) as maxNo FROM sponsors');
          anonymousNo = (maxRow?.maxNo || 0) + 1;
        }
        await dbRun(
          `INSERT INTO sponsors (id, name, logoUrl, url, bulan, mulaTajaan, tamatTajaan, tayangSemasaTransisi, jumlahBayaran, anonymousNo, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'aktif', ?, ?)`,
          [sponsorId, namaPapar || 'Hamba Allah', rekod.logoUrl || '', rekod.laman || '', bulanSemasa, mulaTajaan, tamatTajaan, rekod.jumlahDipersetujui || 0, anonymousNo, kini.toISOString(), kini.toISOString()]
        );
      }

      const skopSlot = Array.isArray(slotIndexes) ? slotIndexes.filter((n) => Number.isInteger(n)) : [];
      if (skopSlot.length > 0) {
        await dbRun('DELETE FROM sponsor_slots WHERE sponsorId = ?', [sponsorId]);
        for (const slotIndex of skopSlot) {
          await dbRun('INSERT INTO sponsor_slots (sponsorId, slotIndex) VALUES (?, ?)', [sponsorId, slotIndex]);
        }
      }

      await dbRun('UPDATE permohonan_penaja SET status = ?, sponsorId = ?, diaktifkanPada = ?, updatedAt = ? WHERE id = ?',
        ['aktif', sponsorId, kini.toISOString(), kini.toISOString(), rekod.id]);

      await hantarEmel({
        to: rekod.emel,
        subject: `Penajaan Anda Kini Aktif [${rekod.id}]`,
        html: `<p>Salam,</p><p>Penajaan ${rekod.id} kini aktif di Adjung Brief. Terima kasih atas sokongan anda.</p>`,
      });

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'permohonan-penaja-aktifkan',
        targetType: 'permohonan_penaja',
        targetId: rekod.id,
        detail: `Penaja: ${sponsorId}`,
      });
      res.json({ success: true, sponsorId });
    } catch (err) {
      console.error('POST aktifkan permohonan-penaja error:', err);
      res.status(500).json({ error: 'Gagal mengaktifkan penajaan.' });
    }
  });

  return router;
}
