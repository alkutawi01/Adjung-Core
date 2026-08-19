import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';
import { getAmSettings } from './slotAmRoutes.js';

// Petikan (2026-08-19, spesifikasi Izzat) — kandungan editorial sampingan di margin kiri frontpage.
// Lihat nota penuh di server.js (CREATE TABLE petikan) untuk rasional seni bina SATU jadual.
//
// DUA gerbang berasingan, sengaja:
//   statusSah = 'sah'  -> petikan betul-betul wujud dalam karya, disemak MANUSIA terhadap sumber.
//   aktif = 1          -> editor mahu ia disiarkan sekarang.
// Petikan layak dipapar hanya bila KEDUA-DUANYA benar. AI boleh mencari calon petikan, tetapi AI
// BUKAN sumber pengesahan — apa-apa yang masuk daripada AI bermula 'belum_sah' tanpa pengecualian.
const STATUS_SAH_SAH = ['belum_sah', 'sah', 'dipertikai'];

// Had aksara — petikan marginal mesti pendek supaya muat ruang 180-220px tanpa menenggelamkan
// kandungan utama. 400 aksara ialah siling KERAS (bukan sasaran); petikan baik biasanya jauh
// lebih pendek. Had ni juga melindungi hak cipta: petikan panjang berlebihan daripada karya
// terlindung ialah risiko, bukan sekadar isu reka bentuk.
const HAD_TEKS = 400;
const HAD_PENGARANG = 120;
const HAD_KARYA = 200;
const HAD_RUJUKAN = 200;

// Saiz kolam harian (2026-08-19) — bilangan petikan yang "bersiaran" pada satu-satu hari. Semua
// pembaca hari itu berkongsi kolam SAMA; scroll cuma menentukan yang mana sedang dilihat. Ini
// sengaja BUKAN rawak per-permintaan: refresh tidak sepatutnya menghasilkan koleksi lain, dan
// editorial patut boleh tahu apa yang tersiar pada sesuatu hari.
const SAIZ_KOLAM_HARIAN = 8;

const barisKepadaPetikan = (r) => ({
  id: r.id,
  teks: r.teks,
  pengarang: r.pengarang,
  karya: r.karya,
  rujukan: r.rujukan || '',
  bahasa: r.bahasa || 'ms',
  statusSah: r.statusSah || 'belum_sah',
  aktif: r.aktif === 1,
  pautanBuku: r.pautanBuku || '',
  labelPautan: r.labelPautan || '',
  tarikhMula: r.tarikhMula || '',
  tarikhAkhir: r.tarikhAkhir || '',
  dibuatOleh: r.dibuatOleh || '',
  dibuatPada: r.dibuatPada,
  dikemasPada: r.dikemasPada,
});

// Pemilih kolam harian DETERMINISTIK — hari yang sama sentiasa menghasilkan kolam yang sama,
// tanpa menyimpan jadual tugasan berasingan. Benih = tarikh (YYYY-MM-DD), jadi kolam bertukar
// tepat pada tengah malam waktu pelayan dan kekal stabil sepanjang hari itu walau pelayan
// dimulakan semula. Ini sebab utama TIDAK guna ORDER BY RANDOM(): setiap permintaan akan beri
// susunan berbeza, jadi refresh sahaja sudah menukar petikan — bercanggah dengan keputusan Izzat
// bahawa petikan hanya bertukar apabila pembaca scroll.
const benihDaripadaTarikh = (tarikhIso) => {
  let h = 2166136261;
  for (let i = 0; i < tarikhIso.length; i++) {
    h ^= tarikhIso.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// PRNG mudah (mulberry32) — cukup untuk memilih kolam harian, bukan kegunaan kriptografi.
const rawakBerbenih = (benih) => {
  let a = benih;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export function createPetikanRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/public/petikan — laluan AWAM. Pulangkan KOLAM HARIAN sahaja.
  //
  // Togol Ketua Editor (petikanAktif, Tetapan Am Slot) disemak DI SINI, bukan hanya di klien —
  // bila ciri dimatikan, pelayan langsung tidak menghantar data petikan. Ini bermakna mematikan
  // ciri betul-betul mematikannya (tiada data bocor ke halaman awam walau seseorang memanggil
  // API terus), dan ia boleh dimatikan TANPA deploy jika ciri bermasalah.
  router.get('/public/petikan', async (req, res) => {
    try {
      const tetapan = getAmSettings();
      if (!tetapan.petikanAktif) {
        return res.json({ aktif: false, petikan: [] });
      }

      const kini = new Date();
      const hariIni = kini.toISOString().slice(0, 10);

      // Tapis di SQL, bukan di JS — petikan yang belum sah atau tidak aktif tidak sepatutnya
      // meninggalkan pangkalan data langsung. Julat tarikh (tarikhMula/tarikhAkhir) opsyenal:
      // NULL/kosong bermakna "sentiasa layak", bukan "tidak pernah layak".
      const rows = await dbAll(
        `SELECT * FROM petikan
         WHERE aktif = 1
           AND statusSah = 'sah'
           AND (tarikhMula IS NULL OR tarikhMula = '' OR tarikhMula <= ?)
           AND (tarikhAkhir IS NULL OR tarikhAkhir = '' OR tarikhAkhir >= ?)
         ORDER BY id`,
        [hariIni, hariIni]
      );

      const layak = rows || [];
      if (layak.length === 0) return res.json({ aktif: true, petikan: [] });

      // Kocok deterministik ikut tarikh, kemudian ambil SAIZ_KOLAM_HARIAN pertama. `ORDER BY id`
      // di atas penting: ia memberi susunan asas yang stabil supaya benih tarikh menghasilkan
      // kolam yang SAMA setiap kali dipanggil pada hari yang sama.
      const rnd = rawakBerbenih(benihDaripadaTarikh(hariIni));
      const disusun = [...layak];
      for (let i = disusun.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [disusun[i], disusun[j]] = [disusun[j], disusun[i]];
      }

      res.json({
        aktif: true,
        tarikh: hariIni,
        petikan: disusun.slice(0, SAIZ_KOLAM_HARIAN).map(barisKepadaPetikan),
      });
    } catch (err) {
      console.error('GET public petikan error:', err);
      // Jangan pulangkan 500 ke halaman awam untuk ciri SAMPINGAN — frontpage mesti terus
      // berfungsi walaupun Petikan gagal. Pulangkan kosong; kesan paling teruk ialah margin
      // kosong, bukan halaman rosak.
      res.json({ aktif: false, petikan: [] });
    }
  });

  // GET /api/system/petikan — senarai PENUH untuk Editorium (termasuk belum sah/tidak aktif).
  // requireAuth melalui requirePermission — petikan belum disahkan tidak sepatutnya boleh dibaca
  // sesiapa di internet (ia mungkin salah atribusi atau tersalah petik).
  router.get('/system/petikan', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const rows = await dbAll('SELECT * FROM petikan ORDER BY dibuatPada DESC');
      res.json((rows || []).map(barisKepadaPetikan));
    } catch (err) {
      console.error('GET petikan error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai petikan. ' + (err.message || '') });
    }
  });

  // POST /api/system/petikan — cipta petikan baharu.
  router.post('/system/petikan', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const {
        teks, pengarang, karya, rujukan = '', bahasa = 'ms',
        pautanBuku = '', labelPautan = '', tarikhMula = '', tarikhAkhir = '',
      } = req.body || {};

      const semakan = sahkanMedan({ teks, pengarang, karya, rujukan, pautanBuku, tarikhMula, tarikhAkhir });
      if (semakan) return res.status(400).json({ error: semakan });

      const id = `petikan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const kini = new Date().toISOString();
      const namaSesi = req.session?.user?.penName || req.session?.user?.username || '';

      // statusSah SENTIASA 'belum_sah' semasa cipta — TIDAK boleh ditetapkan daripada payload
      // klien. Pengesahan ialah tindakan manusia berasingan (PATCH di bawah), bukan sesuatu yang
      // boleh dilangkau dengan menghantar medan dalam permintaan cipta. Ini gerbang yang sama
      // menghalang output AI daripada terus dianggap sahih.
      await dbRun(
        `INSERT INTO petikan (id, teks, pengarang, karya, rujukan, bahasa, statusSah, aktif,
                              pautanBuku, labelPautan, tarikhMula, tarikhAkhir, dibuatOleh, dibuatPada, dikemasPada)
         VALUES (?, ?, ?, ?, ?, ?, 'belum_sah', 1, ?, ?, ?, ?, ?, ?, ?)`,
        [id, teks.trim(), pengarang.trim(), karya.trim(), (rujukan || '').trim(), (bahasa || 'ms').trim(),
         (pautanBuku || '').trim(), (labelPautan || '').trim(), (tarikhMula || '').trim(), (tarikhAkhir || '').trim(),
         namaSesi, kini, kini]
      );

      const baris = await dbGet('SELECT * FROM petikan WHERE id = ?', [id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: namaSesi,
        action: 'cipta-petikan', targetType: 'petikan', targetId: id,
        detail: teks.trim().slice(0, 60),
      });
      res.json({ success: true, petikan: barisKepadaPetikan(baris) });
    } catch (err) {
      console.error('POST petikan error:', err);
      res.status(500).json({ error: 'Gagal menyimpan petikan. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/petikan/:id — sunting kandungan, tanda sah, aktif/nyahaktif.
  // Satu laluan untuk ketiga-tiganya sebab semuanya kemas kini separa pada baris sama; medan yang
  // TIDAK dihantar langsung tidak disentuh (corak sama editorNotesRoutes.js).
  router.patch('/system/petikan/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const sedia = await dbGet('SELECT * FROM petikan WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Petikan tidak dijumpai.' });

      const b = req.body || {};
      const gabung = {
        teks: b.teks !== undefined ? b.teks : sedia.teks,
        pengarang: b.pengarang !== undefined ? b.pengarang : sedia.pengarang,
        karya: b.karya !== undefined ? b.karya : sedia.karya,
        rujukan: b.rujukan !== undefined ? b.rujukan : (sedia.rujukan || ''),
        pautanBuku: b.pautanBuku !== undefined ? b.pautanBuku : (sedia.pautanBuku || ''),
        tarikhMula: b.tarikhMula !== undefined ? b.tarikhMula : (sedia.tarikhMula || ''),
        tarikhAkhir: b.tarikhAkhir !== undefined ? b.tarikhAkhir : (sedia.tarikhAkhir || ''),
      };
      const semakan = sahkanMedan(gabung);
      if (semakan) return res.status(400).json({ error: semakan });

      if (b.statusSah !== undefined && !STATUS_SAH_SAH.includes(b.statusSah)) {
        return res.status(400).json({ error: `Status pengesahan tidak sah. Guna salah satu: ${STATUS_SAH_SAH.join(', ')}.` });
      }

      // Menyunting TEKS petikan membatalkan pengesahan sedia ada (2026-08-19) — kalau teks
      // berubah, semakan lama terhadap sumber sudah tidak lagi terpakai pada teks BAHARU itu.
      // Tanpa peraturan ni, editor boleh menyunting petikan yang sudah 'sah' menjadi apa-apa
      // sahaja dan ia kekal bertanda sah — memusnahkan seluruh makna gerbang pengesahan.
      // Pengecualian: kalau permintaan ini sendiri menetapkan statusSah secara eksplisit, hormati
      // pilihan editor (dia mungkin membetulkan typo lalu mengesahkan semula dalam satu tindakan).
      const teksBerubah = b.teks !== undefined && b.teks.trim() !== (sedia.teks || '').trim();
      const statusSahBaharu = b.statusSah !== undefined
        ? b.statusSah
        : (teksBerubah ? 'belum_sah' : sedia.statusSah);

      const kini = new Date().toISOString();
      await dbRun(
        `UPDATE petikan SET teks = ?, pengarang = ?, karya = ?, rujukan = ?, bahasa = ?,
                            statusSah = ?, aktif = ?, pautanBuku = ?, labelPautan = ?,
                            tarikhMula = ?, tarikhAkhir = ?, dikemasPada = ?
         WHERE id = ?`,
        [
          gabung.teks.trim(), gabung.pengarang.trim(), gabung.karya.trim(), (gabung.rujukan || '').trim(),
          (b.bahasa !== undefined ? b.bahasa : (sedia.bahasa || 'ms')).trim(),
          statusSahBaharu,
          b.aktif !== undefined ? (b.aktif ? 1 : 0) : sedia.aktif,
          (gabung.pautanBuku || '').trim(),
          (b.labelPautan !== undefined ? b.labelPautan : (sedia.labelPautan || '')).trim(),
          (gabung.tarikhMula || '').trim(), (gabung.tarikhAkhir || '').trim(),
          kini, id,
        ]
      );

      const baris = await dbGet('SELECT * FROM petikan WHERE id = ?', [id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'sunting-petikan', targetType: 'petikan', targetId: id,
        detail: `statusSah=${statusSahBaharu}, aktif=${baris.aktif}`,
      });
      res.json({ success: true, petikan: barisKepadaPetikan(baris) });
    } catch (err) {
      console.error('PATCH petikan error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini petikan. ' + (err.message || '') });
    }
  });

  // DELETE /api/system/petikan/:id — buang petikan sepenuhnya.
  //
  // Petikan BUKAN kandungan terbitan Adjung (ia kutipan daripada karya orang lain), jadi peraturan
  // "terbitan tak boleh dipadam, hanya diarkib" tidak terpakai di sini. Petikan tersalah taip atau
  // tersalah atribusi patut boleh dibuang bersih, bukan disimpan selamanya. Editor yang cuma mahu
  // menyembunyikan sementara guna togol `aktif`, bukan padam.
  router.delete('/system/petikan/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const sedia = await dbGet('SELECT * FROM petikan WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Petikan tidak dijumpai.' });

      await dbRun('DELETE FROM petikan WHERE id = ?', [id]);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'padam-petikan', targetType: 'petikan', targetId: id,
        detail: (sedia.teks || '').slice(0, 60),
      });
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE petikan error:', err);
      res.status(500).json({ error: 'Gagal memadam petikan. ' + (err.message || '') });
    }
  });

  return router;
}

// Pengesahan medan dikongsi POST dan PATCH — SATU takrifan, supaya dua laluan tu tak boleh
// terpesong sesama sendiri (kelas pepijat yang projek ni memang pernah alami; lihat CLAUDE.md).
function sahkanMedan({ teks, pengarang, karya, rujukan, pautanBuku, tarikhMula, tarikhAkhir }) {
  const t = (teks || '').trim();
  const p = (pengarang || '').trim();
  const k = (karya || '').trim();

  if (!t) return 'Teks petikan wajib diisi.';
  if (!p) return 'Nama pengarang wajib diisi. Petikan tanpa pengarang tidak boleh disiarkan.';
  if (!k) return 'Judul karya wajib diisi. Petikan mesti boleh dijejaki kepada sumbernya.';

  if (t.length > HAD_TEKS) return `Teks petikan (${t.length} aksara) melebihi had ${HAD_TEKS} aksara. Petikan marginal mesti pendek.`;
  if (p.length > HAD_PENGARANG) return `Nama pengarang (${p.length} aksara) melebihi had ${HAD_PENGARANG} aksara.`;
  if (k.length > HAD_KARYA) return `Judul karya (${k.length} aksara) melebihi had ${HAD_KARYA} aksara.`;
  if ((rujukan || '').trim().length > HAD_RUJUKAN) return `Rujukan melebihi had ${HAD_RUJUKAN} aksara.`;

  const pb = (pautanBuku || '').trim();
  if (pb && !/^https?:\/\//i.test(pb) && !pb.startsWith('/')) {
    return 'Pautan buku mesti bermula dengan http://, https:// atau / (pautan dalaman).';
  }

  // Tarikh opsyenal, tetapi kalau diisi mesti format ISO sebenar — bukan templat separa yang
  // kemudiannya gagal senyap dalam perbandingan SQL julat tarikh.
  const corakTarikh = /^\d{4}-\d{2}-\d{2}$/;
  const tm = (tarikhMula || '').trim();
  const ta = (tarikhAkhir || '').trim();
  if (tm && !corakTarikh.test(tm)) return 'Tarikh mula mesti format YYYY-MM-DD.';
  if (ta && !corakTarikh.test(ta)) return 'Tarikh akhir mesti format YYYY-MM-DD.';
  if (tm && ta && tm > ta) return 'Tarikh mula tidak boleh lewat daripada tarikh akhir.';

  return null;
}
