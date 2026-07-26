import express from 'express';
import fs from 'fs';
import path from 'path';

export function createMediaRoutes(rootDir) {
  const router = express.Router();

  // POST /api/media/upload
  router.post('/upload', async (req, res) => {
    try {
      const { filename, fileData } = req.body;
      if (!filename || !fileData) {
        return res.status(400).json({ error: 'Filename and fileData (base64) are required.' });
      }

      // Pastikan folder public/uploads wujud
      const uploadDir = path.join(rootDir, 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Bersihkan nama fail dan tambah timestamp untuk mengelakkan pertindihan
      const cleanFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = path.join(uploadDir, cleanFilename);

      // Dapatkan data base64 tulen
      const base64Data = fileData.split(';base64,').pop();
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
