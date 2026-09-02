import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

// Nota Ketua Editor (2026-08-01, spesifikasi pemilik projek) — tiga jenis nota yang Ketua Editor
// terbitkan kepada pasukan editorial, dan dalam satu kes, kepada pembaca awam:
//
//   kategori 'notis'  — pengumuman rasmi, keutamaan tertinggi
//   kategori 'am'     — peringatan/garis panduan tugas harian
//   kategori 'khas'   — nota bersasar, contohnya arahan satu kempen atau satu Bidang
//
// Skop (`type`) berasingan daripada kategori, dan inilah pengasingan paling penting dalam modul ni.
// TIGA nilai (2026-08-05, dipecah daripada 'awam' generik — Ketua Editor perhatikan togol awal
// "Awam" sahaja tak jelas ke MANA nota tu disiarkan; kini setiap pilihan sepadan TEPAT dengan
// satu destinasi Frontpage sebenar, label sama di kedua-dua hujung):
//   'dalaman'             — hanya kelihatan dalam Editorium (makluman editor), tak pernah awam
//   'catatan_ketua_editor' — disiarkan di Frontpage, pautan footer "Catatan Ketua Editor"
//   'pengumuman'          — disiarkan di Frontpage, pautan footer "Pengumuman"
//
// Nota 'dalaman' TIDAK BOLEH SESEKALI terlepas ke laluan awam. Sebab itu laluan awam di bawah
// menapis `type` di dalam SQL itu sendiri (senarai putih 2 nilai awam sahaja), bukan bergantung
// pada penapisan di klien — pelayar tak boleh minta nota dalaman walaupun ia mengubah parameter
// permintaan sendiri.
//
// Status: 'aktif' (hidup) atau 'arkib' (disimpan sebagai rekod). Nota tidak dipadam terus; ia
// diarkibkan — selaras dengan peraturan padam/arkib projek untuk kandungan terbitan.
const KATEGORI_SAH = ['notis', 'am', 'khas'];
const SKOP_SAH = ['dalaman', 'catatan_ketua_editor', 'pengumuman'];
const SKOP_AWAM_SAH = ['catatan_ketua_editor', 'pengumuman'];
const STATUS_SAH = ['aktif', 'arkib'];

// Had aksara dikuatkuasakan di PELAYAN, bukan sekadar atribut maxlength pada borang — borang boleh
// dipintas, laluan API tidak.
const HAD_TAJUK = 150;
const HAD_KANDUNGAN = 5000;

export function createEditorNotesRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  const barisKepadaNota = (r) => ({
    id: r.id,
    tajuk: r.title,
    kandungan: r.content,
    kategori: r.category,
    skop: r.type,
    status: r.status,
    disemat: r.is_pinned === 1,
    penulis: r.author_name || '',
    penulisId: r.author_id || '',
    dibuatPada: r.created_at,
    dikemasPada: r.updated_at,
  });

  // GET /api/system/editor-notes — senarai penuh untuk Editorium (dalaman + awam).
  // Lalai status 'aktif' supaya arkib tidak membanjiri paparan harian; hantar ?status=arkib untuk
  // tab Arkib, atau ?status=semua untuk kedua-duanya.
  //
  // requireAuth (2026-08-06, audit keselamatan) — dahulu TERBUKA sepenuhnya walaupun laluan awam
  // bertapis (/public/editor-notes, senarai putih skop) sudah wujud bersebelahan. Sesiapa di
  // internet boleh baca SEMUA nota termasuk skop 'dalaman' dan arkib dengan
  // ?skop=dalaman&status=semua — perbincangan dalaman sidang editorial terdedah. Laluan awam di
  // bawah kekal terbuka; ini laluan Editorium, perlu sesi.
  router.get('/system/editor-notes', requireAuth, async (req, res) => {
    try {
      const { kategori, skop, status = 'aktif' } = req.query;
      const syarat = [];
      const params = [];

      if (kategori && KATEGORI_SAH.includes(kategori)) {
        syarat.push('category = ?');
        params.push(kategori);
      }
      if (skop && SKOP_SAH.includes(skop)) {
        syarat.push('type = ?');
        params.push(skop);
      }
      if (status !== 'semua') {
        syarat.push('status = ?');
        params.push(STATUS_SAH.includes(status) ? status : 'aktif');
      }

      const where = syarat.length ? `WHERE ${syarat.join(' AND ')}` : '';
      // Nota disemat naik ke atas tanpa mengira tarikh — itulah maksud menyemat.
      const rows = await dbAll(
        `SELECT * FROM editor_notes ${where} ORDER BY is_pinned DESC, created_at DESC`,
        params
      );
      res.json((rows || []).map(barisKepadaNota));
    } catch (err) {
      console.error('GET editor-notes error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai nota. ' + (err.message || '') });
    }
  });

  // GET /api/public/editor-notes?type=catatan_ketua_editor|pengumuman[&termasukArkib=1] —
  // laluan AWAM. `type` WAJIB dan disahkan terhadap SENARAI PUTIH 2 nilai awam sahaja
  // (SKOP_AWAM_SAH) — 'dalaman' tidak pernah termasuk dalam senarai tu langsung, jadi mustahil
  // tercapai walaupun pelayar cuba `?type=dalaman` secara langsung.
  //
  // `termasukArkib=1` (2026-08-18, permintaan Izzat — footer "Pengumuman" patut turut papar
  // rekod lama, bukan cuma aktif) — bila hadir, pulangkan status 'aktif' DAN 'arkib' sekali,
  // aktif dahulu (ikut susunan sedia ada), arkib kemudian (terbaru dahulu). Setiap baris bawa
  // `status` supaya klien boleh label jelas mana yang sudah diarkibkan — TANPA parameter ni,
  // tingkah laku lama (aktif sahaja) kekal tak berubah, jadi banner header (yang cuma perlukan
  // SATU pengumuman aktif terkini) terus guna panggilan sedia ada tanpa perubahan.
  router.get('/public/editor-notes', async (req, res) => {
    try {
      const { type, termasukArkib } = req.query;
      if (!SKOP_AWAM_SAH.includes(type)) {
        return res.status(400).json({ error: 'Parameter type diperlukan (catatan_ketua_editor atau pengumuman).' });
      }
      const where = termasukArkib === '1'
        ? `type = ? AND status IN ('aktif', 'arkib')`
        : `type = ? AND status = 'aktif'`;
      const rows = await dbAll(
        `SELECT id, title, content, category, author_name, created_at, status
         FROM editor_notes
         WHERE ${where}
         ORDER BY (status = 'aktif') DESC, is_pinned DESC, created_at DESC`,
        [type]
      );
      res.json((rows || []).map((r) => ({
        id: r.id,
        tajuk: r.title,
        kandungan: r.content,
        kategori: r.category,
        penulis: r.author_name || '',
        dibuatPada: r.created_at,
        status: r.status,
      })));
    } catch (err) {
      console.error('GET public editor-notes error:', err);
      res.status(500).json({ error: 'Gagal membaca nota awam. ' + (err.message || '') });
    }
  });

  // POST /api/system/editor-notes — cipta nota baharu.
  router.post('/system/editor-notes', requirePermission('manageEditorNotes'), async (req, res) => {
    try {
      const { tajuk, kandungan, kategori = 'am', skop = 'dalaman' } = req.body || {};
      // Identiti penulis (NOTE-02, audit ChatGPT 2026-08-08) — DAHULU diambil terus daripada
      // req.body.penulis/penulisId (client-supplied), jadi sesiapa dgn manageEditorNotes boleh
      // hantar nama editor LAIN dlm medan tu, memalsukan "Penulis: <sesiapa>" dlm rekod sedangkan
      // sesi sebenar akaun berbeza. Sumber kebenaran identiti MESTI sesi pelayan, sama corak
      // seperti actorId/actorName di logAudit() bawah — bukan payload klien.
      const penulisId = req.session?.user?.id || '';
      const penulis = req.session?.user?.penName || req.session?.user?.username || '';

      const t = (tajuk || '').trim();
      const k = (kandungan || '').trim();
      if (!t || !k) {
        return res.status(400).json({ error: 'Tajuk dan kandungan nota wajib diisi.' });
      }
      if (t.length > HAD_TAJUK) {
        return res.status(400).json({ error: `Tajuk nota tidak boleh melebihi ${HAD_TAJUK} aksara.` });
      }
      if (k.length > HAD_KANDUNGAN) {
        return res.status(400).json({ error: `Kandungan nota tidak boleh melebihi ${HAD_KANDUNGAN} aksara.` });
      }
      if (!KATEGORI_SAH.includes(kategori)) {
        return res.status(400).json({ error: `Kategori tidak sah. Guna salah satu: ${KATEGORI_SAH.join(', ')}.` });
      }
      if (!SKOP_SAH.includes(skop)) {
        return res.status(400).json({ error: `Skop tidak sah. Guna salah satu: ${SKOP_SAH.join(', ')}.` });
      }

      const id = `nota-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const kini = new Date().toISOString();
      await dbRun(
        `INSERT INTO editor_notes (id, title, content, category, type, status, is_pinned, author_id, author_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'aktif', 0, ?, ?, ?, ?)`,
        [id, t, k, kategori, skop, (penulisId || '').trim(), (penulis || '').trim(), kini, kini]
      );
      const baris = await dbGet('SELECT * FROM editor_notes WHERE id = ?', [id]);
      await logAudit(dbRun, { actorId: req.session?.user?.id, actorName: req.session?.user?.penName || req.session?.user?.username, action: 'cipta-nota', targetType: 'nota_ketua_editor', targetId: id, detail: t });
      res.json({ success: true, nota: barisKepadaNota(baris) });
    } catch (err) {
      console.error('POST editor-notes error:', err);
      res.status(500).json({ error: 'Gagal menyimpan nota. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/editor-notes/:id — sunting kandungan, tukar status (arkib/pulih), semat.
  // Satu laluan untuk ketiga-tiganya sebab semuanya kemas kini separa pada baris yang sama; medan
  // yang tidak dihantar tidak disentuh.
  router.patch('/system/editor-notes/:id', requirePermission('manageEditorNotes'), async (req, res) => {
    try {
      const { id } = req.params;
      const sedia = await dbGet('SELECT * FROM editor_notes WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Nota tidak dijumpai.' });

      const { tajuk, kandungan, kategori, skop, status, disemat } = req.body || {};

      // Kandungan nota AKTIF beku, tak boleh disunting (2026-08-18, keputusan Izzat — "sekat
      // sunting selepas aktif... macam mesej yang dah dihantar") — Peti Makluman (MaklumanDrawer)
      // baca terus dari pelayan setiap kali dibuka, TIADA petanda "disunting pada" dipaparkan
      // kepada editor, jadi sunting senyap nota yg dah tersiar (dalam inbox editor) mengubah apa
      // editor lihat tanpa jejak. Sebaik nota diterbitkan (status='aktif' — SEMUA nota lahir
      // aktif, tiada mod draf), teksnya kekal muktamad; kesilapan dibetulkan dgn Arkib nota lama
      // + terbitkan nota BAHARU, bukan sunting di tempat. Peralihan status (arkib/pulih) dan
      // semat/nyahsemat TAK disentuh gerbang ni — cuma medan KANDUNGAN yang dikunci.
      // PEMBETULAN (2026-09-02, dapatan bug-hunt): gerbang asal semak `sedia.status` (status
      // SEBELUM permintaan ini) sahaja — kalau nota semasa 'arkib', gerbang tak terpakai
      // langsung, walaupun request SAMA hantar `status: 'aktif'` BERSAMA `kandungan`/`tajuk`
      // baharu serentak (hidupkan semula nota arkib dengan teks disunting dalam SATU UPDATE).
      // Ini memintas terus peraturan "nota aktif beku" di atas — nota yang "dihidupkan semula"
      // ni pun tersiar semula dalam Peti Makluman dengan kandungan berbeza, tiada jejak sunting.
      // Semak status AKAN JADI (selepas permintaan ini), bukan status sebelum ini.
      const cubaUbahKandungan = [tajuk, kandungan, kategori, skop].some((v) => v !== undefined);
      const statusAkanJadiAktif = status !== undefined ? status === 'aktif' : sedia.status === 'aktif';
      if (cubaUbahKandungan && statusAkanJadiAktif) {
        return res.status(400).json({
          error: 'Nota yang sudah aktif tidak boleh disunting — ia sudah tersiar dalam Peti Makluman editor. Arkibkan nota ini dan terbitkan nota baharu sebaliknya.',
        });
      }

      const set = [];
      const params = [];

      if (tajuk !== undefined) {
        const t = (tajuk || '').trim();
        if (!t) return res.status(400).json({ error: 'Tajuk nota tidak boleh kosong.' });
        if (t.length > HAD_TAJUK) return res.status(400).json({ error: `Tajuk nota tidak boleh melebihi ${HAD_TAJUK} aksara.` });
        set.push('title = ?'); params.push(t);
      }
      if (kandungan !== undefined) {
        const k = (kandungan || '').trim();
        if (!k) return res.status(400).json({ error: 'Kandungan nota tidak boleh kosong.' });
        if (k.length > HAD_KANDUNGAN) return res.status(400).json({ error: `Kandungan nota tidak boleh melebihi ${HAD_KANDUNGAN} aksara.` });
        set.push('content = ?'); params.push(k);
      }
      if (kategori !== undefined) {
        if (!KATEGORI_SAH.includes(kategori)) return res.status(400).json({ error: 'Kategori tidak sah.' });
        set.push('category = ?'); params.push(kategori);
      }
      if (skop !== undefined) {
        if (!SKOP_SAH.includes(skop)) return res.status(400).json({ error: 'Skop tidak sah.' });
        set.push('type = ?'); params.push(skop);
      }
      if (status !== undefined) {
        if (!STATUS_SAH.includes(status)) return res.status(400).json({ error: 'Status tidak sah.' });
        set.push('status = ?'); params.push(status);
      }
      if (disemat !== undefined) {
        set.push('is_pinned = ?'); params.push(disemat ? 1 : 0);
      }

      if (set.length === 0) {
        return res.status(400).json({ error: 'Tiada medan untuk dikemas kini.' });
      }

      set.push('updated_at = ?'); params.push(new Date().toISOString());
      params.push(id);
      await dbRun(`UPDATE editor_notes SET ${set.join(', ')} WHERE id = ?`, params);

      const baris = await dbGet('SELECT * FROM editor_notes WHERE id = ?', [id]);
      if (status !== undefined) {
        await logAudit(dbRun, { actorId: req.session?.user?.id, actorName: req.session?.user?.penName || req.session?.user?.username, action: `status-nota:${status}`, targetType: 'nota_ketua_editor', targetId: id });
      }
      res.json({ success: true, nota: barisKepadaNota(baris) });
    } catch (err) {
      console.error('PATCH editor-notes error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini nota. ' + (err.message || '') });
    }
  });

  // DELETE /api/system/editor-notes/:id — hanya nota ARKIB boleh dipadam terus. Nota aktif mesti
  // diarkibkan dahulu, corak sama macam peraturan padam/arkib kandungan editorial: sesuatu yang
  // pernah terbit tidak lenyap dengan satu klik.
  router.delete('/system/editor-notes/:id', requirePermission('manageEditorNotes'), async (req, res) => {
    try {
      const { id } = req.params;
      const sedia = await dbGet('SELECT status FROM editor_notes WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Nota tidak dijumpai.' });
      if (sedia.status !== 'arkib') {
        return res.status(400).json({ error: 'Hanya nota yang sudah diarkibkan boleh dipadam. Arkibkan nota ini dahulu.' });
      }
      await dbRun('DELETE FROM editor_notes WHERE id = ?', [id]);
      await logAudit(dbRun, { actorId: req.session?.user?.id, actorName: req.session?.user?.penName || req.session?.user?.username, action: 'padam-nota', targetType: 'nota_ketua_editor', targetId: id });
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE editor-notes error:', err);
      res.status(500).json({ error: 'Gagal memadam nota. ' + (err.message || '') });
    }
  });

  return router;
}

export default createEditorNotesRoutes;
