// SIMULASI 13 — MENUTUP JURANG LIPUTAN.
//
// Laporan liputan (.simulasi/liputan.mjs) menunjukkan 18 laluan tulis belum disentuh. Simulasi
// ni menyasarkan yang BERMAKNA sebelum launch: laluan DESTRUKTIF (padam/gabung kandungan) dan
// laluan KESELAMATAN AKAUN (tukar kata laluan/username/emel, tebus token). Baki yang dilangkau
// ialah pipeline AI (dinyahkeutamaan) dan utiliti bergantung rangkaian.
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbAll, dbRun, hashPassword, bukaDb, isiHuraianCukup } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5212;
const DBF = path.join(os.tmpdir(), 'sim-adjung-jurang.db');
const lap = pelapor('SIM 13 — JURANG LIPUTAN');

const BIDANG = 'Ekonomi';
const PASS_ADMIN = 'SimUjian!2026';

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, PASS_ADMIN);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#802334', icon: 'TrendingUp' });
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: 1, bidangName: BIDANG });

  // =====================================================================================
  // A. BATCH PASTE — laluan cipta kandungan PUKAL. Mesti hormati peraturan yang sama.
  // =====================================================================================
  // Format SEBENAR laluan ni: medan `text` mengandungi JSON (bukan `pastedText`), item guna
  // kunci title/summary/category/topik/slotIndex. Disahkan terhadap kod laluan, bukan diteka —
  // payload salah bentuk cuma menghasilkan 400 dan laluan kejayaan tidak pernah teruji.
  const bilAsal = (await dbGet(db, 'SELECT COUNT(*) n FROM editorial_objects')).n;
  const rBatchSah = await api('POST', '/api/system/pipeline/batch_paste', {
    text: JSON.stringify([{
      slotIndex: 1, title: 'Kandungan Pukal Sah', summary: isiHuraianCukup(ceilingForSlot, 1, 'Kandungan Pukal Sah'.length),
      category: BIDANG, topik: 'Kewangan', source_url: 'https://ujian.test/pukal',
    }]),
  });
  const bilLepasSah = (await dbGet(db, 'SELECT COUNT(*) n FROM editorial_objects')).n;
  if (rBatchSah.ok && bilLepasSah > bilAsal) {
    lap.lulus(`batch_paste mencipta kandungan sebenar (${bilAsal} -> ${bilLepasSah})`);
  } else {
    lap.gagal('batch_paste (payload SAH) tidak mencipta kandungan', `HTTP ${rBatchSah.status} ${rBatchSah.teks.slice(0, 180)}`);
  }

  // Bajet ruang MESTI dikuatkuasakan di sini juga (CLAUDE.md: setiap laluan simpan, tanpa kecuali).
  const bilSebelum = (await dbGet(db, 'SELECT COUNT(*) n FROM editorial_objects')).n;
  const rBatchGagal = await api('POST', '/api/system/pipeline/batch_paste', {
    text: JSON.stringify([{
      slotIndex: 1, title: 'A'.repeat(3000), summary: 'X.',
      category: BIDANG, topik: 'Kewangan', source_url: 'https://ujian.test/besar',
    }]),
  });
  const bilSelepas = (await dbGet(db, 'SELECT COUNT(*) n FROM editorial_objects')).n;
  if (rBatchGagal.ok && bilSelepas > bilSebelum) {
    lap.gagal('batch_paste MEMINTAS bajet ruang kad', 'tajuk 3000 aksara diterima & disimpan');
  } else {
    lap.lulus(`batch_paste menolak tajuk melampau (HTTP ${rBatchGagal.status}, tiada kandungan baharu)`);
  }

  // =====================================================================================
  // B. GABUNG BIDANG — destruktif (memetakan semula kandungan, memadam Bidang sumber)
  // =====================================================================================
  await api('POST', '/api/system/categories/register', { name: 'BidangSumber' });
  await api('POST', '/api/system/categories/register', { name: 'BidangSasaran' });
  const sebelumGabung = (await dbAll(db, 'SELECT id FROM CategoryRegistry')).length;
  const rGabung = await api('POST', '/api/system/categories/merge', { sourceCategory: 'BidangSumber', targetCategory: 'BidangSasaran' });
  const sumberMasihAda = await dbGet(db, "SELECT id FROM CategoryRegistry WHERE LOWER(name)='bidangsumber'");
  const sasaranAda = await dbGet(db, "SELECT id FROM CategoryRegistry WHERE LOWER(name)='bidangsasaran'");
  if (!rGabung.ok) {
    lap.gagal('gabung Bidang gagal', `HTTP ${rGabung.status} ${rGabung.teks.slice(0, 150)}`);
  } else if (sumberMasihAda) {
    lap.gagal('gabung Bidang tidak membuang sumber', 'BidangSumber masih wujud selepas gabung');
  } else if (!sasaranAda) {
    lap.gagal('gabung Bidang MEMUSNAHKAN sasaran', 'BidangSasaran hilang — kehilangan data');
  } else {
    lap.lulus(`gabung Bidang: sumber dibuang, sasaran kekal (${sebelumGabung} -> ${(await dbAll(db, 'SELECT id FROM CategoryRegistry')).length})`);
  }

  // Gabung ke Bidang yang TIDAK wujud tidak boleh memusnahkan sumber secara senyap.
  await api('POST', '/api/system/categories/register', { name: 'BidangYatim' });
  await api('POST', '/api/system/categories/merge', { sourceCategory: 'BidangYatim', targetCategory: 'BidangTakPernahAda' });
  const yatim = await dbGet(db, "SELECT id FROM CategoryRegistry WHERE LOWER(name)='bidangyatim'");
  const sasaranBaharu = await dbGet(db, "SELECT id FROM CategoryRegistry WHERE LOWER(name)='bidangtakpernahada'");
  if (!yatim && !sasaranBaharu) {
    lap.gagal('gabung ke Bidang tak wujud MEMUSNAHKAN sumber', 'kedua-dua Bidang hilang — kandungan jadi yatim');
  } else {
    lap.lulus('gabung ke Bidang tak wujud tidak memusnahkan data');
  }

  // =====================================================================================
  // C. PADAM KANDUNGAN BELUM TERBIT MILIK SEORANG EDITOR — destruktif
  // =====================================================================================
  const now = new Date().toISOString();
  await dbRun(db, `INSERT INTO users (id,username,email,role,password,penName,createdAt,updatedAt)
    VALUES ('sim-ed2','sim-ed2','ed2@sim.test','EDITOR',?,'Editor Dua',?,?)`, [hashPassword('EdUjian!2026'), now, now]);
  await dbRun(db, "INSERT OR IGNORE INTO user_roles (userId,roleId) VALUES ('sim-ed2','editor')");

  // Kandungan AKTIF milik editor lain TIDAK boleh terpadam oleh operasi "belum terbit".
  await api('POST', '/api/system/slots', [{
    slotIndex: 1, contentMode: 'Manual', manualDesk: BIDANG,
    manualSummary: ['UUID: jurang-aktif', 'Tajuk: Kandungan Aktif Jangan Padam',
      'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, 1, 'Kandungan Aktif Jangan Padam'.length),
      `Bidang: ${BIDANG}`, 'Topik: Kewangan', 'Status: terbit'].join('\n'),
  }]);
  const objAktif = await dbGet(db, 'SELECT id FROM editorial_objects ORDER BY createdAt DESC LIMIT 1');
  if (objAktif) await api('PATCH', `/api/system/content/${objAktif.id}`, { status: 'approved' });

  const rPadam = await api('POST', '/api/system/users/sim-ed2/kandungan-belum-terbit/padam', {});
  const aktifMasihAda = objAktif ? await dbGet(db,
    "SELECT status FROM editorial_revisions WHERE objectId=? ORDER BY version DESC LIMIT 1", [objAktif.id]) : null;
  if (aktifMasihAda && aktifMasihAda.status === 'approved') {
    lap.lulus(`padam kandungan belum terbit tidak menyentuh kandungan AKTIF (HTTP ${rPadam.status})`);
  } else {
    lap.gagal('KANDUNGAN AKTIF TERPADAM oleh operasi "belum terbit"', `status kini ${JSON.stringify(aktifMasihAda)}`);
  }

  // =====================================================================================
  // D. KESELAMATAN AKAUN — tukar kata laluan/username/emel
  // =====================================================================================
  // Kata laluan lama SALAH mesti ditolak.
  const rSalah = await api('POST', '/api/auth/change-password', { currentPassword: 'SALAH-SEKALI', newPassword: 'BaharuUjian!2026' });
  if (rSalah.ok) lap.gagal('tukar kata laluan diterima dengan kata laluan lama SALAH', 'sesiapa yang rampas sesi boleh kunci pemilik keluar');
  else lap.lulus(`tukar kata laluan dgn kata laluan lama salah ditolak (HTTP ${rSalah.status})`);

  // Kata laluan baharu terlalu pendek mesti ditolak.
  const rPendek = await api('POST', '/api/auth/change-password', { currentPassword: PASS_ADMIN, newPassword: '123' });
  if (rPendek.ok) lap.gagal('kata laluan terlalu pendek diterima', 'had minimum tidak dikuatkuasakan');
  else lap.lulus(`kata laluan terlalu pendek ditolak (HTTP ${rPendek.status})`);

  // Username yang sudah diguna akaun lain mesti ditolak.
  const rUsername = await api('POST', '/api/auth/change-username', { newUsername: 'sim-ed2', currentPassword: PASS_ADMIN });
  if (rUsername.ok) {
    const bilSama = (await dbAll(db, "SELECT id FROM users WHERE LOWER(username)='sim-ed2'")).length;
    if (bilSama > 1) lap.gagal('username PENDUA dibenarkan', `${bilSama} akaun berkongsi username sama`);
    else lap.lulus('tukar username diterima tanpa mencipta pendua');
  } else {
    lap.lulus(`username sudah diguna ditolak (HTTP ${rUsername.status})`);
  }

  // Tukar emel: emel milik akaun LAIN mesti ditolak (kalau tidak, dua akaun berkongsi emel dan
  // aliran "lupa kata laluan" jadi tidak menentu — token boleh sampai ke akaun yang salah).
  const rEmel = await api('POST', '/api/auth/change-email', { newEmail: 'ed2@sim.test', currentPassword: PASS_ADMIN });
  if (rEmel.ok) {
    const bilKongsi = (await dbAll(db, "SELECT id FROM users WHERE LOWER(email)='ed2@sim.test'")).length;
    if (bilKongsi > 1) lap.gagal('EMEL PENDUA dibenarkan', `${bilKongsi} akaun berkongsi emel sama — aliran set-semula jadi tak menentu`);
    else lap.lulus('tukar emel diterima tanpa mencipta pendua');
  } else {
    lap.lulus(`emel sudah diguna akaun lain ditolak (HTTP ${rEmel.status})`);
  }

  // =====================================================================================
  // E. TEBUS TOKEN (aktifkan-akaun) — token palsu mesti ditolak
  // =====================================================================================
  const rTokenPalsu = await api('POST', '/api/auth/aktifkan-akaun', {
    token: crypto.randomBytes(32).toString('hex'), kataLaluanBaharu: 'TokenUjian!2026',
  });
  if (rTokenPalsu.ok) lap.gagal('TOKEN PALSU DITERIMA', 'sesiapa boleh mengaktifkan akaun dengan token rawak');
  else lap.lulus(`token palsu ditolak (HTTP ${rTokenPalsu.status})`);

  // =====================================================================================
  // F. Tetapan RSS & set-semula label/tier — tulisan mesti bertahan
  // =====================================================================================
  const rRss = await api('POST', '/api/system/rss-settings', { autoAbsorb: false, maxItems: 20 });
  lap.lulus(`rss-settings -> HTTP ${rRss.status}`);

  // Override Bidang item Ticker pada id HANTU — mesti 404, bukan kejayaan palsu (Ticker ialah
  // satu-satunya kandungan SEBENAR di produksi setakat ni, jadi laluan ni berbaloi diuji).
  const rOverride = await api('PUT', '/api/system/ticker/override-desk/ID-TICKER-HANTU', { newDesk: BIDANG });
  if (rOverride.ok) lap.gagal('override Bidang Ticker lapor berjaya untuk item tak wujud', `HTTP ${rOverride.status}`);
  else lap.lulus(`override Bidang Ticker (id hantu) ditolak (HTTP ${rOverride.status})`);

  const rResetLabel = await api('POST', '/api/system/ui-labels/reset', { key: 'status.aktif', lalai: 'Aktif', kategori: 'status' });
  const nilaiLabel = await dbGet(db, "SELECT value FROM ui_labels WHERE key='status.aktif'");
  if (rResetLabel.ok && nilaiLabel?.value !== 'Aktif') {
    lap.gagal('ui-labels/reset lapor berjaya tanpa menulis', `nilai DB ${JSON.stringify(nilaiLabel?.value)}`);
  } else {
    lap.lulus(`ui-labels/reset berfungsi (HTTP ${rResetLabel.status})`);
  }

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
