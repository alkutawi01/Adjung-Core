import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';
import { getAmSettings } from './slotAmRoutes.js';
import {
  KATEGORI_PETIKAN, HAD_TEKS_PETIKAN, huraiPetikanTampal, kunciDedupPetikan,
  pilihDanSusunKolam, binaArahanAiPetikan,
} from '../editorial/PetikanConfig.js';

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
// kandungan utama. Siling KERAS (bukan sasaran); petikan baik biasanya jauh lebih pendek. Had ni
// juga melindungi hak cipta: petikan panjang berlebihan daripada karya terlindung ialah risiko,
// bukan sekadar isu reka bentuk. Nombornya datang daripada PetikanConfig.js supaya penghurai
// tampalan dan pengesahan borang tidak boleh terpesong sesama sendiri.
const HAD_TEKS = HAD_TEKS_PETIKAN;
const HAD_PENGARANG = 120;
const HAD_KARYA = 200;
const HAD_RUJUKAN = 200;

const barisKepadaPetikan = (r) => ({
  id: r.id,
  teks: r.teks,
  pengarang: r.pengarang,
  karya: r.karya,
  rujukan: r.rujukan || '',
  bahasa: r.bahasa || 'ms',
  kategori: r.kategori || null,
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

// Pemilihan + penyusunan kolam harian kini hidup di core/editorial/PetikanConfig.js
// (pilihDanSusunKolam) — dikongsi, deterministik ikut tarikh, dengan kepelbagaian kategori.
// Sebab ia TIDAK guna ORDER BY RANDOM(): setiap permintaan akan beri susunan berbeza, jadi
// refresh sahaja sudah menukar petikan — bercanggah dengan keputusan Izzat bahawa petikan hanya
// bertukar apabila pembaca scroll.

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
      //
      // Kategori WAJIB untuk kelayakan (2026-08-19) — bukan sekadar metadata hiasan. Keperluan
      // Izzat ialah petikan berturut-turut bukan daripada kategori sama; petikan TANPA kategori
      // tidak boleh menyertai jaminan itu langsung, jadi ia ditahan sehingga editor mengisinya.
      // Ini juga gerbang yang menangkap kes AI memulangkan kategori di luar senarai tertutup
      // (disimpan NULL + amaran semasa import) — petikan itu tidak akan tersiar dengan kategori
      // palsu, dan tidak juga tersiar tanpa kategori. Konsol memaparkan amaran jelas supaya
      // keadaan ini kelihatan, bukan senyap.
      const rows = await dbAll(
        `SELECT * FROM petikan
         WHERE aktif = 1
           AND statusSah = 'sah'
           AND kategori IS NOT NULL AND TRIM(kategori) != ''
           AND (tarikhMula IS NULL OR tarikhMula = '' OR tarikhMula <= ?)
           AND (tarikhAkhir IS NULL OR tarikhAkhir = '' OR tarikhAkhir >= ?)
         ORDER BY id`,
        [hariIni, hariIni]
      );

      const layak = (rows || []).map(barisKepadaPetikan);
      if (layak.length === 0) return res.json({ aktif: true, tarikh: hariIni, petikan: [] });

      // Kolam DIPILIH dan DISUSUN sepenuhnya di pelayan (lihat pilihDanSusunKolam) — klien
      // menerima urutan siap dan cuma berjalan 1->N. Sengaja: kalau klien menyusun sendiri,
      // setiap pembaca dapat urutan berbeza dan logik editorial berselerak di dua tempat.
      // `ORDER BY id` di atas penting — ia memberi susunan asas stabil supaya benih tarikh
      // menghasilkan kolam SAMA setiap kali dipanggil pada hari yang sama.
      res.json({
        aktif: true,
        tarikh: hariIni,
        petikan: pilihDanSusunKolam(layak, hariIni),
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
        teks, pengarang, karya, rujukan = '', bahasa = 'ms', kategori = null,
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
        `INSERT INTO petikan (id, teks, pengarang, karya, rujukan, bahasa, kategori, statusSah, aktif,
                              pautanBuku, labelPautan, tarikhMula, tarikhAkhir, dibuatOleh, dibuatPada, dikemasPada)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'belum_sah', 1, ?, ?, ?, ?, ?, ?, ?)`,
        [id, teks.trim(), pengarang.trim(), karya.trim(), (rujukan || '').trim(), (bahasa || 'ms').trim(),
         kategoriSahAtauNull(kategori),
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
        `UPDATE petikan SET teks = ?, pengarang = ?, karya = ?, rujukan = ?, bahasa = ?, kategori = ?,
                            statusSah = ?, aktif = ?, pautanBuku = ?, labelPautan = ?,
                            tarikhMula = ?, tarikhAkhir = ?, dikemasPada = ?
         WHERE id = ?`,
        [
          gabung.teks.trim(), gabung.pengarang.trim(), gabung.karya.trim(), (gabung.rujukan || '').trim(),
          (b.bahasa !== undefined ? b.bahasa : (sedia.bahasa || 'ms')).trim(),
          b.kategori !== undefined ? kategoriSahAtauNull(b.kategori) : (sedia.kategori || null),
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

  // GET /api/system/petikan-arahan-ai — teks Arahan AI untuk editor salin ke chatbot luar.
  // Dijana di PELAYAN (bukan ditulis semula di klien) supaya prompt dan penghurai sentiasa
  // datang daripada SATU takrifan — kalau prompt berubah tetapi penghurai tidak, import senyap
  // rosak. Kedua-duanya hidup dalam PetikanConfig.js.
  router.get('/system/petikan-arahan-ai', requirePermission('manageEditorial'), (req, res) => {
    res.json({ arahan: binaArahanAiPetikan(), kategori: KATEGORI_PETIKAN });
  });

  // POST /api/system/petikan/hurai — PRATONTON sahaja, TIDAK menulis apa-apa ke pangkalan data.
  //
  // Dipisahkan daripada import sebenar dengan sengaja: editor mesti melihat berapa yang sah,
  // berapa gagal dan SEBAB setiap kegagalan SEBELUM apa-apa disimpan. Import membuta terhadap
  // output AI ialah cara pepijat "teks templat tersiar sebagai kandungan" berlaku pada mulanya.
  router.post('/system/petikan/hurai', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { teks } = req.body || {};
      if (!teks || !teks.trim()) return res.status(400).json({ error: 'Tiada teks untuk dihurai.' });

      const { rekod, gagal } = huraiPetikanTampal(teks);

      // Dedup terhadap koleksi SEDIA ADA — tampal semula output yang sama tidak sepatutnya
      // menghasilkan pendua senyap dalam pustaka.
      const sedia = await dbAll('SELECT teks, pengarang, karya FROM petikan');
      const kunciSedia = new Set((sedia || []).map(kunciDedupPetikan));
      const baharu = [];
      const pendua = [];
      for (const r of rekod) {
        if (kunciSedia.has(kunciDedupPetikan(r))) pendua.push(r);
        else baharu.push(r);
      }

      res.json({
        jumlahDikesan: rekod.length + gagal.length,
        bolehImport: baharu.length,
        rekod: baharu,
        pendua: pendua.length,
        gagal,
      });
    } catch (err) {
      console.error('POST petikan/hurai error:', err);
      res.status(500).json({ error: 'Gagal menghurai teks. ' + (err.message || '') });
    }
  });

  // POST /api/system/petikan/import — simpan rekod yang editor SUDAH lihat dalam pratonton.
  //
  // Semua rekod masuk sebagai 'belum_sah' tanpa pengecualian. "Sah secara struktur" (format
  // betul) TIDAK pernah bermaksud "sah terhadap sumber" (petikan betul-betul wujud dalam karya).
  // Hanya manusia yang membandingkan dengan PDF asal boleh membuat lompatan itu.
  router.post('/system/petikan/import', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const senarai = Array.isArray(req.body?.rekod) ? req.body.rekod : [];
      if (!senarai.length) return res.status(400).json({ error: 'Tiada rekod untuk diimport.' });

      const kini = new Date().toISOString();
      const namaSesi = req.session?.user?.penName || req.session?.user?.username || '';
      // Kumpulan import — supaya Mod Semakan boleh menapis "petikan daripada buku yang sama"
      // dan editor menyemak berturut-turut tanpa melompat antara karya.
      const kumpulan = `import-${Date.now()}`;

      const sedia = await dbAll('SELECT teks, pengarang, karya FROM petikan');
      const kunciSedia = new Set((sedia || []).map(kunciDedupPetikan));

      let disimpan = 0;
      let dilangkau = 0;
      for (const r of senarai) {
        // Sahkan SEMULA di pelayan — jangan percaya rekod yang datang balik daripada klien.
        // Klien boleh diubah suai; pratonton bukan gerbang keselamatan.
        const semakan = sahkanMedan({
          teks: r.teks, pengarang: r.pengarang, karya: r.karya,
          rujukan: r.rujukan, pautanBuku: r.pautanBuku, tarikhMula: '', tarikhAkhir: '',
        });
        if (semakan) { dilangkau++; continue; }
        if (kunciSedia.has(kunciDedupPetikan(r))) { dilangkau++; continue; }
        kunciSedia.add(kunciDedupPetikan(r));

        const id = `petikan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await dbRun(
          `INSERT INTO petikan (id, teks, pengarang, karya, rujukan, bahasa, kategori, statusSah, aktif,
                                pautanBuku, labelPautan, tarikhMula, tarikhAkhir, dibuatOleh, dibuatPada, dikemasPada, kumpulanImport)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'belum_sah', 1, ?, '', '', '', ?, ?, ?, ?)`,
          [id, (r.teks || '').trim(), (r.pengarang || '').trim(), (r.karya || '').trim(),
           (r.rujukan || '').trim(), (r.bahasa || 'ms').trim(), kategoriSahAtauNull(r.kategori),
           (r.pautanBuku || '').trim(), namaSesi, kini, kini, kumpulan]
        );
        disimpan++;
      }

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: namaSesi,
        action: 'import-petikan', targetType: 'petikan', targetId: kumpulan,
        detail: `${disimpan} petikan diimport (belum disahkan), ${dilangkau} dilangkau`,
      });

      res.json({ success: true, disimpan, dilangkau, kumpulanImport: kumpulan });
    } catch (err) {
      console.error('POST petikan/import error:', err);
      res.status(500).json({ error: 'Gagal mengimport petikan. ' + (err.message || '') });
    }
  });

  return router;
}

// Kategori mesti daripada senarai TERTUTUP. Nilai di luar senarai jatuh ke NULL (bukan ditolak,
// bukan dipadan secara kabur) — petikannya mungkin sempurna, cuma labelnya salah. NULL bermakna
// "belum diklasifikasi" dan petikan itu tidak layak masuk kolam harian sehingga editor
// membetulkannya, jadi tiada risiko ia tersiar dengan kategori palsu.
function kategoriSahAtauNull(nilai) {
  const t = (nilai || '').toString().trim();
  if (!t) return null;
  return KATEGORI_PETIKAN.find((k) => k.toLowerCase() === t.toLowerCase()) || null;
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
