import express from 'express';
import crypto from 'crypto';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

// Rujukan Sistem (2026-10-25, permintaan Izzat — "simpan maklumat ttg hosting, domain, dll dalam
// admin Adjung Brief untuk rujukan editor"). Kad maklumat infrastruktur (hosting, domain, e-mel,
// deploy, pangkalan data) yang SEMUA editor yang log masuk boleh baca (Rujukan → Dokumentasi →
// 3. Infrastruktur) dan Pentadbir (manageSettings) boleh sunting TANPA deploy — maklumat ini
// berubah (cth bila hosting dipindah), jadi bukan kod keras dalam TSX.
//
// PERATURAN KERAS: halaman ini terbuka kepada semua editor. JANGAN simpan kata laluan, kunci
// peribadi, token API atau alamat peribadi. sahkanRujukan() menolak corak rahsia yang jelas
// (kunci peribadi, token GitHub/OpenAI/AWS/Slack/Resend) sebagai jaring keselamatan terakhir —
// ia BUKAN pengganti pertimbangan manusia, hanya menangkap kesilapan salin-tampal.

export const HAD_TAJUK = 120;
export const HAD_KANDUNGAN = 6000;
export const HAD_KAD = 30;

const CORAK_RAHSIA = /(BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[abp]-[A-Za-z0-9-]{10,}|re_[A-Za-z0-9]{20,})/;

/** Pengesahan tulen (diuji): pulang { ok: true, tajuk, kandungan } atau { ok: false, ralat }. */
export function sahkanRujukan(badan, { sebahagian = false } = {}) {
  const hasil = {};
  if (!sebahagian || badan?.tajuk !== undefined) {
    const t = String(badan?.tajuk ?? '').trim();
    if (!t) return { ok: false, ralat: 'Tajuk wajib diisi.' };
    if (t.length > HAD_TAJUK) return { ok: false, ralat: `Tajuk tidak boleh melebihi ${HAD_TAJUK} aksara.` };
    hasil.tajuk = t;
  }
  if (!sebahagian || badan?.kandungan !== undefined) {
    const k = String(badan?.kandungan ?? '').replace(/\r\n/g, '\n').trim();
    if (!k) return { ok: false, ralat: 'Kandungan wajib diisi.' };
    if (k.length > HAD_KANDUNGAN) return { ok: false, ralat: `Kandungan tidak boleh melebihi ${HAD_KANDUNGAN} aksara.` };
    hasil.kandungan = k;
  }
  const gabung = `${hasil.tajuk || ''}\n${hasil.kandungan || ''}`;
  if (CORAK_RAHSIA.test(gabung)) {
    return { ok: false, ralat: 'Teks ini kelihatan seperti kunci atau token rahsia. Halaman ini boleh dibaca semua editor, jadi rahsia tidak boleh disimpan di sini.' };
  }
  return { ok: true, ...hasil };
}

// Kandungan awal — setiap dakwaan disahkan terhadap DEPLOY.md, .github/workflows/deploy.yml,
// kod pelayan dan pemeriksaan laman hidup (nginx, sijil Let's Encrypt, nameserver DNS) pada
// 2026-10-25. Disemai SEKALI sahaja bila jadual kosong; selepas itu Pentadbir yang memilikinya.
export const KAD_AWAL = [
  {
    tajuk: 'Gambaran ringkas',
    kandungan: `Adjung Brief ialah satu aplikasi web: bahagian paparan (React, dibina dengan Vite), pelayan (Express, Node.js) dan pangkalan data SQLite. Semuanya berjalan pada satu pelayan di **brief.adjung.com**.

Kandungan editorial (artikel, Ticker, Bar, akaun editor) disimpan dalam satu fail pangkalan data pada pelayan itu. Menerbitkan, menyunting atau menarik balik kandungan di Editorium berkuat kuasa serta-merta dan tidak memerlukan deploy.`,
  },
  {
    tajuk: 'Hosting (pelayan)',
    kandungan: `**Penyedia:** DigitalOcean (Droplet, iaitu pelayan maya).
**Nama Droplet:** adjung-brief-prod
**Rantau:** Singapura (sgp1), dipilih supaya dekat dengan pembaca Malaysia.
**Sistem:** Ubuntu, Node.js 20.
**Pengurus proses:** PM2 (proses bernama adjung-brief). Ia memulakan semula aplikasi jika terhenti atau jika pelayan dihidupkan semula.
**Pelayan web hadapan:** nginx, yang meneruskan trafik ke aplikasi.`,
  },
  {
    tajuk: 'Domain, DNS dan HTTPS',
    kandungan: `**Alamat Adjung Brief:** brief.adjung.com
**Domain induk:** adjung.com. Domain induk dan subdomain lain (seperti platform.adjung.com) dihoskan di Vercel untuk produk Adjung yang lain, bukan pada pelayan Brief.
**DNS:** diuruskan di Vercel (nameserver ns1.vercel-dns.com dan ns2.vercel-dns.com). Rekod A untuk "brief" menghala ke alamat IP pelayan Brief. Jika pelayan dipindahkan atau Droplet baharu dicipta, rekod inilah yang perlu dikemas kini.
**HTTPS:** sijil percuma Let's Encrypt melalui Certbot, diperbaharui secara automatik.`,
  },
  {
    tajuk: 'E-mel sistem',
    kandungan: `Jemputan akaun dan set semula kata laluan dihantar melalui **Resend** (perkhidmatan e-mel berasaskan API). Domain penghantar ialah mail.adjung.com, yang telah disahkan di Resend.

Jika e-mel jemputan tidak sampai, semak folder spam penerima dahulu, kemudian hubungi Pentadbir.`,
  },
  {
    tajuk: 'Kod dan deploy',
    kandungan: `Kod sumber disimpan dalam repositori GitHub bernama Adjung-Core. Cabang **main** ialah versi pengeluaran.

Deploy ke pelayan dibuat dengan tangan melalui GitHub Actions: buka workflow "Deploy ke pengeluaran", tekan Run workflow dan pilih cabang main. Ia menarik kod terkini, memasang pakej, membina paparan dan memulakan semula PM2. Menolak (push) kod ke GitHub tidak menggantikan deploy secara automatik.

Pangkalan data disalin sebagai jaring keselamatan sebelum setiap deploy. Satu deploy biasanya mengambil kira-kira satu minit.`,
  },
  {
    tajuk: 'Pangkalan data dan salinan sandaran',
    kandungan: `**Fail:** adjung.db pada cakera pelayan. Inilah satu-satunya tempat semua kandungan editorial disimpan.
**Salinan sandaran automatik:** sekali setiap 24 jam, satu salinan setiap kali pelayan dimulakan semula (paling kerap sejam sekali) dan satu salinan sebelum setiap deploy. Salinan sistem dihadkan 5 GB dan yang tertua dibuang dahulu. Salinan yang dibuat dengan tangan tidak disentuh oleh sistem.
**Perhatian:** salinan sandaran automatik disimpan pada pelayan yang sama.`,
  },
  {
    tajuk: 'Perkhidmatan sokongan',
    kandungan: `**Enjin carian:** sitemap.xml, rss.xml dan robots.txt dihidang terus oleh pelayan. Senarai alamat laman dihantar ke enjin carian (IndexNow) sekali sehari.
**Notifikasi pembaca:** dikawal oleh pelayan yang sama. Suis padam ada di Editorial → Notifikasi Pembaca.
**Semakan pautan mati:** berjalan setiap 12 jam.
**Semakan editor tidak aktif:** berjalan sekali sehari.`,
  },
  {
    tajuk: 'Apa yang perlu editor tahu',
    kandungan: `Menerbit, menyunting dan menarik balik kandungan di Editorium tidak memerlukan deploy dan tidak menjejaskan hosting.

Jika laman tidak boleh dibuka, lambat luar biasa atau Editorium memberi ralat berterusan, laporkan kepada Pentadbir bersama masa kejadian dan tangkapan skrin. Jangan cuba menyelesaikannya dengan menerbitkan semula kandungan.

Kata laluan, kunci dan token tidak disimpan di halaman ini dan tidak boleh dikongsi melalui sembang.`,
  },
];

export async function pastikanSkemaRujukan(dbRun, dbGet) {
  await dbRun(`CREATE TABLE IF NOT EXISTS rujukan_sistem (
    id TEXT PRIMARY KEY, tajuk TEXT NOT NULL, kandungan TEXT NOT NULL, urutan INTEGER NOT NULL DEFAULT 0,
    dikemaskiniPada TEXT, dikemaskiniOleh TEXT)`);
  await dbRun(`CREATE TABLE IF NOT EXISTS rujukan_sistem_tetapan (id TEXT PRIMARY KEY, disemai INTEGER DEFAULT 0)`);
  const t = await dbGet(`SELECT disemai FROM rujukan_sistem_tetapan WHERE id = 'main'`);
  if (!t) {
    // Semai SEKALI sahaja, direkod dalam jadual tetapan — bukan "jika jadual kosong", supaya jika
    // Pentadbir memadam SEMUA kad, ia tidak muncul semula pada boot seterusnya.
    const kini = new Date().toISOString();
    for (let i = 0; i < KAD_AWAL.length; i++) {
      await dbRun(
        `INSERT INTO rujukan_sistem (id, tajuk, kandungan, urutan, dikemaskiniPada, dikemaskiniOleh) VALUES (?, ?, ?, ?, ?, ?)`,
        ['ruj-' + crypto.randomBytes(6).toString('hex'), KAD_AWAL[i].tajuk, KAD_AWAL[i].kandungan, (i + 1) * 10, kini, 'sistem']
      );
    }
    await dbRun(`INSERT INTO rujukan_sistem_tetapan (id, disemai) VALUES ('main', 1)`);
  }
}

export function createRujukanSistemRoutes(dbAll, dbGet, dbRun) {
  const router = express.Router();
  let sedia = null;
  const pastikanSedia = () => (sedia ||= pastikanSkemaRujukan(dbRun, dbGet).catch((e) => { sedia = null; throw e; }));
  const namaPengguna = (req) => req.session?.user?.penName || req.session?.user?.username || 'tidak diketahui';

  router.get('/system/rujukan-sistem', requireAuth, async (req, res) => {
    try {
      await pastikanSedia();
      const kad = await dbAll(`SELECT id, tajuk, kandungan, urutan, dikemaskiniPada, dikemaskiniOleh FROM rujukan_sistem ORDER BY urutan ASC, rowid ASC`);
      res.json({ kad });
    } catch (err) {
      console.error('GET rujukan-sistem error:', err);
      res.status(500).json({ error: 'Gagal memuatkan rujukan sistem.' });
    }
  });

  router.post('/system/rujukan-sistem', requirePermission('manageSettings'), async (req, res) => {
    try {
      await pastikanSedia();
      const sah = sahkanRujukan(req.body);
      if (!sah.ok) return res.status(400).json({ error: sah.ralat });
      const bil = (await dbGet(`SELECT COUNT(*) AS n FROM rujukan_sistem`))?.n || 0;
      if (bil >= HAD_KAD) return res.status(400).json({ error: `Paling banyak ${HAD_KAD} kad.` });
      const maks = (await dbGet(`SELECT COALESCE(MAX(urutan), 0) AS m FROM rujukan_sistem`))?.m || 0;
      const id = 'ruj-' + crypto.randomBytes(6).toString('hex');
      await dbRun(
        `INSERT INTO rujukan_sistem (id, tajuk, kandungan, urutan, dikemaskiniPada, dikemaskiniOleh) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, sah.tajuk, sah.kandungan, maks + 10, new Date().toISOString(), namaPengguna(req)]
      );
      await logAudit(dbRun, { actorId: req.session?.user?.id, actorName: namaPengguna(req), action: 'tambah-rujukan-sistem', targetType: 'rujukan_sistem', targetId: id, detail: sah.tajuk });
      res.json({ success: true, id });
    } catch (err) {
      console.error('POST rujukan-sistem error:', err);
      res.status(500).json({ error: 'Gagal menambah kad.' });
    }
  });

  router.patch('/system/rujukan-sistem/:id', requirePermission('manageSettings'), async (req, res) => {
    try {
      await pastikanSedia();
      const sedaAda = await dbGet(`SELECT id, tajuk FROM rujukan_sistem WHERE id = ?`, [req.params.id]);
      if (!sedaAda) return res.status(404).json({ error: 'Kad tidak dijumpai.' });
      const sah = sahkanRujukan(req.body, { sebahagian: true });
      if (!sah.ok) return res.status(400).json({ error: sah.ralat });
      if (sah.tajuk === undefined && sah.kandungan === undefined) return res.status(400).json({ error: 'Tiada perubahan untuk disimpan.' });
      await dbRun(
        `UPDATE rujukan_sistem SET tajuk = COALESCE(?, tajuk), kandungan = COALESCE(?, kandungan), dikemaskiniPada = ?, dikemaskiniOleh = ? WHERE id = ?`,
        [sah.tajuk ?? null, sah.kandungan ?? null, new Date().toISOString(), namaPengguna(req), req.params.id]
      );
      await logAudit(dbRun, { actorId: req.session?.user?.id, actorName: namaPengguna(req), action: 'sunting-rujukan-sistem', targetType: 'rujukan_sistem', targetId: req.params.id, detail: sah.tajuk || sedaAda.tajuk });
      res.json({ success: true });
    } catch (err) {
      console.error('PATCH rujukan-sistem error:', err);
      res.status(500).json({ error: 'Gagal menyimpan kad.' });
    }
  });

  router.delete('/system/rujukan-sistem/:id', requirePermission('manageSettings'), async (req, res) => {
    try {
      await pastikanSedia();
      const sedaAda = await dbGet(`SELECT id, tajuk FROM rujukan_sistem WHERE id = ?`, [req.params.id]);
      if (!sedaAda) return res.status(404).json({ error: 'Kad tidak dijumpai.' });
      await dbRun(`DELETE FROM rujukan_sistem WHERE id = ?`, [req.params.id]);
      await logAudit(dbRun, { actorId: req.session?.user?.id, actorName: namaPengguna(req), action: 'padam-rujukan-sistem', targetType: 'rujukan_sistem', targetId: req.params.id, detail: sedaAda.tajuk });
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE rujukan-sistem error:', err);
      res.status(500).json({ error: 'Gagal memadam kad.' });
    }
  });

  return router;
}
