import express from 'express';
import fs from 'fs';
import path from 'path';

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

export function createMediaRoutes(rootDir) {
  const router = express.Router();

  // POST /api/media/upload
  router.post('/upload', async (req, res) => {
    try {
      const { filename, fileData } = req.body;
      if (!filename || !fileData || typeof fileData !== 'string') {
        return res.status(400).json({ error: 'Filename and fileData (base64) are required.' });
      }

      const padanan = fileData.match(/^data:([^;]+);base64,/);
      const mime = padanan ? padanan[1].toLowerCase() : null;
      const sambungan = mime ? JENIS_DIBENARKAN[mime] : null;
      if (!sambungan) {
        return res.status(400).json({ error: 'Jenis fail tidak dibenarkan. Guna PNG, JPEG, WEBP, GIF atau SVG.' });
      }

      const base64Data = fileData.split(';base64,').pop();
      const saizBytes = Math.ceil((base64Data.length * 3) / 4);
      if (saizBytes > HAD_SAIZ_BYTES) {
        return res.status(400).json({ error: 'Fail melebihi had 5MB.' });
      }

      const uploadDir = path.join(rootDir, 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const namaAsas = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 80);
      const cleanFilename = `${Date.now()}-${namaAsas}${sambungan}`;
      const filePath = path.join(uploadDir, cleanFilename);

      fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });

      const fileUrl = `/uploads/${cleanFilename}`;
      res.json({ url: fileUrl });
    } catch (err) {
      console.error('File upload error:', err);
      res.status(500).json({ error: 'Failed to upload file.' });
    }
  });

  return router;
}
