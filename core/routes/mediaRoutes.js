import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { sanitizeSvgMarkup } from '../utils/sanitizeSvg.js';

// 2026-08-02 (Fasa 1 keselamatan) — dahulu laluan ini tanpa auth (mount-level gate di server.js
// kini kunci ini), TANPA had jenis fail (mana-mana base64 berlabel .png pun diterima), dan
// tanpa had saiz selain 10mb body-parser global. Kini disemak: jenis MIME data URI mesti
// imej yang dibenarkan, dan sambungan fail diambil daripada MIME sebenar — bukan nama
// pelanggan hantar — supaya `.png` palsu tak boleh disimpan sebagai `.html`/`.php` dsb.
const JENIS_DIBENARKAN = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};
const HAD_SAIZ_BYTES = 5 * 1024 * 1024; // 5MB — sepadan had client ImageField

// Logik simpan fail dikongsi (2026-08-30, diekstrak utk permohonanPenajaRoutes.js) — laluan
// awam token-gated "Lengkapkan Penajaan" perlu upload TANPA sesi (pemohon tiada akaun), tapi
// `/api/media/upload` di bawah digerbang `requireAuthForWrites` di peringkat mount (server.js).
// Jangan buka gerbang auth /media/upload — laluan token ni sahkan kelayakan dgn cara LAIN
// (token permohonan sah + belum tamat, lihat permohonanPenajaRoutes.js), bukan tiada semakan
// langsung. Pulangkan { url } atau { error, status } — pemanggil terjemah ke respons masing².
export function simpanFailMuatNaik(rootDir, filename, fileData) {
  if (!filename || !fileData || typeof fileData !== 'string') {
    return { error: 'Filename and fileData (base64) are required.', status: 400 };
  }
  const padanan = fileData.match(/^data:([^;]+);base64,/);
  const mime = padanan ? padanan[1].toLowerCase() : null;
  const sambungan = mime ? JENIS_DIBENARKAN[mime] : null;
  if (!sambungan) {
    return { error: 'Jenis fail tidak dibenarkan. Guna PNG, JPEG, WEBP, GIF atau SVG.', status: 400 };
  }
  const base64Data = fileData.split(';base64,').pop();
  const saizBytes = Math.ceil((base64Data.length * 3) / 4);
  if (saizBytes > HAD_SAIZ_BYTES) {
    return { error: 'Fail melebihi had 5MB.', status: 400 };
  }
  const uploadDir = path.join(rootDir, 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const namaAsas = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 80);
  const rawak = crypto.randomBytes(8).toString('hex');
  const cleanFilename = `${Date.now()}-${rawak}-${namaAsas}${sambungan}`;
  const filePath = path.join(uploadDir, cleanFilename);

  if (mime === 'image/svg+xml') {
    let svgMentah;
    try {
      svgMentah = Buffer.from(base64Data, 'base64').toString('utf8');
    } catch {
      return { error: 'Fail SVG tidak dapat dibaca.', status: 400 };
    }
    let svgBersih;
    try {
      svgBersih = sanitizeSvgMarkup(svgMentah);
    } catch (e) {
      return { error: e.message || 'Fail SVG tidak sah.', status: 400 };
    }
    fs.writeFileSync(filePath, svgBersih, { encoding: 'utf8' });
    return { url: `/uploads/${cleanFilename}` };
  }

  fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });
  return { url: `/uploads/${cleanFilename}` };
}

export function createMediaRoutes(rootDir) {
  const router = express.Router();

  // POST /api/media/upload
  router.post('/upload', async (req, res) => {
    try {
      const { filename, fileData } = req.body;
      // Nama fail RAWAK (STORAGE-002, audit #48.9.5, 2026-08-13) — sebelum ni
      // `${Date.now()}-${namaAsal}` sahaja: cap masa julatnya sempit dan selalunya boleh
      // dikaitkan dengan waktu terbit/sunting yang diketahui umum, manakala nama asal fail
      // selalunya boleh diteka (image.jpg, photo.png, gambar1.jpg). Kerana /uploads dihidang
      // statik tanpa auth (imej kandungan terbitan MESTI boleh dilihat pembaca awam), nama yang
      // boleh diteka ialah SATU-SATUNYA perlindungan bagi lampiran kandungan yang belum terbit
      // atau sudah diarkib — dan ia terlalu nipis. 16 aksara hex (64-bit) menjadikan tekaan
      // tidak praktikal.
      //
      // SVG ditapis SEBELUM ditulis (2026-08-06, audit keselamatan). Format lain ialah imej
      // raster — tak boleh membawa skrip — tapi SVG ialah XML yang boleh mengandungi <script>
      // dan pengendali on*. Kerana fail dihidang dari /uploads pada origin YANG SAMA, SVG
      // bersenjata yang dibuka sesiapa akan menjalankan skrip dalam konteks sesi mereka: satu
      // editor boleh merampas sesi Ketua Editor/Pentadbir. Ditapis, bukan ditolak, supaya ikon
      // SVG sah kekal boleh dimuat naik.
      const hasil = simpanFailMuatNaik(rootDir, filename, fileData);
      if (hasil.error) return res.status(hasil.status || 400).json({ error: hasil.error });
      res.json({ url: hasil.url });
    } catch (err) {
      console.error('File upload error:', err);
      res.status(500).json({ error: 'Gagal memuat naik fail.' });
    }
  });

  return router;
}
