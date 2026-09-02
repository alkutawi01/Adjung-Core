// SIMULASI 10 — OPERASI SERENTAK (beberapa editor pada masa sama).
//
// Sidang editorial sebenar bekerja serentak. Diuji: dua editor menyimpan slot yang SAMA,
// hantar-dua-kali (double submit) pada kelulusan, dan perlumbaan naik-taraf automatik
// (dua arkib serentak boleh menaikkan LEBIH daripada ruang yang sebenarnya kosong).
//
// Kegagalan = data rosak, had kapasiti dilanggar, atau kerja seorang editor hilang senyap.
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbAll, bukaDb, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5209;
const DBF = path.join(os.tmpdir(), 'sim-adjung-serentak.db');
const lap = pelapor('SIM 10 — SERENTAK');

const BIDANG = 'Ekonomi';
const SLOT = 1;

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#802334', icon: 'TrendingUp' });
  for (const s of [SLOT, 2, 3, 6]) await api('POST', '/api/system/categories/assign-slot', { slotIndex: s, bidangName: BIDANG });

  // Isi huraian sekadar cukup utk lulus had MINIMUM 80% bajet kad (ContentBudget.js) --
  // panjang berbeza ikut tier fizikal slot, bukan nilai tetap (2026-08-14, harness bit-rot
  // ditemui semasa siasat konkurensi: fixture lama guna huraian pendek tetap yg gagal lulus
  // peraturan minimum-fill ditambah kemudian, jadi ujian serentak tak sempat sampai bahagian
  // perlumbaan langsung).
  const isiHuraian = (slotIndex, sudahDipakai) => {
    const { maxTitle, maxBrief } = ceilingForSlot(slotIndex);
    const bakiFraction = Math.max(0, 0.86 - sudahDipakai / maxTitle);
    const sasaran = Math.min(maxBrief, Math.max(20, Math.round(bakiFraction * maxBrief)));
    const teras = 'Ujian serentak bagi konkurensi editorial. ';
    let huraian = teras;
    while (huraian.length < sasaran) huraian += 'Tambah teks. ';
    return huraian.slice(0, sasaran).trim();
  };

  // Huraian Panjang WAJIB disertakan (2026-09-02, dapatan bug-hunt — lihat HURAIAN_PANJANG_SAH
  // di sim-lib.mjs); tanpanya SETIAP penciptaan kandungan di bawah ditolak 400 sebelum sempat
  // menguji apa-apa perlumbaan serentak.
  const blok = (uuid, tajuk, slotIndex = SLOT) => [
    `UUID: ${uuid}`, `Tajuk: ${tajuk}`, 'Huraian ringkas: ' + isiHuraian(slotIndex, tajuk.length),
    'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
    'Bidang: ' + BIDANG, 'Topik: Kewangan', 'Status: terbit',
  ].join('\n');

  // --- (1) DUA editor menyimpan slot SAMA serentak -------------------------------------
  // Kawalan serentak optimistik (updatedAt) sepatutnya menghalang seorang menulis-ganti
  // kerja seorang lagi secara senyap.
  const sebelum = await dbGet(db, "SELECT updatedAt FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=?", [2]);
  const [a, b] = await Promise.all([
    api('POST', '/api/system/slots', [{ slotIndex: 2, contentMode: 'Manual', manualDesk: BIDANG, updatedAt: sebelum?.updatedAt, manualSummary: blok('serentak-A', 'Versi Editor A', 2) }]),
    api('POST', '/api/system/slots', [{ slotIndex: 2, contentMode: 'Manual', manualDesk: BIDANG, updatedAt: sebelum?.updatedAt, manualSummary: blok('serentak-B', 'Versi Editor B', 2) }]),
  ]);
  const bilBerjaya = [a, b].filter(r => r.ok).length;
  const bilKonflik = [a, b].filter(r => r.status === 409).length;
  if (bilBerjaya === 2 && sebelum?.updatedAt) {
    lap.gagal('kawalan serentak TIDAK berfungsi', 'kedua-dua simpanan diterima — kerja seorang editor ditulis-ganti senyap');
  } else {
    lap.lulus(`simpan slot serentak: ${bilBerjaya} berjaya, ${bilKonflik} ditolak 409 (kerja tidak hilang senyap)`);
  }

  // --- (2) HANTAR-DUA-KALI kelulusan (double submit) -----------------------------------
  await api('POST', '/api/system/slots', [{ slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok('dua-kali', 'Kandungan Hantar Dua Kali', SLOT) }]);
  const objDua = await dbGet(db, "SELECT id FROM editorial_objects WHERE slotIndex=? ORDER BY createdAt DESC LIMIT 1", [SLOT]);
  if (objDua) {
    const [x, y] = await Promise.all([
      api('PATCH', `/api/system/content/${objDua.id}`, { status: 'approved' }),
      api('PATCH', `/api/system/content/${objDua.id}`, { status: 'approved' }),
    ]);
    const bilRevisi = (await dbAll(db, 'SELECT id FROM editorial_revisions WHERE objectId=?', [objDua.id])).length;
    const status = (await dbGet(db, 'SELECT status FROM editorial_revisions WHERE objectId=? ORDER BY version DESC LIMIT 1', [objDua.id]))?.status;
    if (status !== 'approved') lap.gagal('hantar-dua-kali merosakkan status', `status akhir=${status}`);
    else lap.lulus(`hantar-dua-kali kelulusan selamat (status=${status}, ${bilRevisi} revisi, HTTP ${x.status}/${y.status})`);
  }

  // --- (3) PERLUMBAAN naik-taraf automatik ---------------------------------------------
  // Had=1. Cipta 1 aktif + 3 beratur, kemudian arkibkan yang aktif — HANYA SATU sepatutnya
  // naik taraf. Kalau logik naik-taraf berlumba, lebih daripada satu boleh jadi Aktif.
  const amSet = await api('POST', '/api/system/slot-am-settings', {
    mulaIkutMasa: false, hadKandunganSlot: 1, jenisAnimasi: 'colophon', arahAnimasi: 'kanan',
    hadHuraianPanjang: 0, hadSumber: 0, hadTopik: 0, hadNotaEditor: 0,
    hadHuraianPanjangMin: 0, hadSumberMin: 0, hadTopikMin: 0, hadNotaEditorMin: 0, logoPenaja: '',
    warnaPanelTransisi: '#802334', nisbahPenajaTransisi: 0, focusViewTitleScale: 1, focusViewBodySize: 15,
    // Medan wajib ditambah kemudian, fixture ni tak pernah dikemas kini — lihat nota panjang di
    // sim3-tulisan-sah.mjs (dapatan bug-hunt 2026-09-02).
    petikanTempohPutaranSaat: 10, petikanKuantitiHarianMaksimum: 12,
    carouselJedaPertama: 15, carouselTempohLalai: 10, hadJamRotasiSlotPenuh: 24,
  });
  if (!amSet.ok) throw new Error('slot-am-settings gagal ditetapkan: ' + JSON.stringify(amSet.json));

  const idBeratur = [];
  for (let i = 0; i < 3; i++) {
    await api('POST', '/api/system/slots', [{ slotIndex: 3, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok(`beratur-${i}`, `Kandungan Beratur ${i}`, 3) }]);
    const o = await dbGet(db, "SELECT id FROM editorial_objects WHERE slotIndex=3 ORDER BY createdAt DESC LIMIT 1");
    if (o) idBeratur.push(o.id);
  }
  // Luluskan semua: yang pertama jadi Aktif, bakinya beratur slot_penuh.
  for (const id of idBeratur) await api('PATCH', `/api/system/content/${id}`, { status: 'approved' });

  const aktifSebelum = (await dbGet(db, `
    SELECT COUNT(*) n FROM editorial_objects o JOIN editorial_revisions r ON r.objectId=o.id
    WHERE o.slotIndex=3 AND r.status='approved'
      AND r.version=(SELECT MAX(version) FROM editorial_revisions WHERE objectId=o.id)`)).n;

  if (aktifSebelum !== 1) {
    lap.gagal('persediaan perlumbaan: had kapasiti tidak dihormati', `${aktifSebelum} aktif, dijangka 1`);
  } else {
    // Arkibkan yang aktif DUA KALI serentak — cuba cetuskan dua naik-taraf sekali gus.
    const aktifId = (await dbGet(db, `
      SELECT o.id FROM editorial_objects o JOIN editorial_revisions r ON r.objectId=o.id
      WHERE o.slotIndex=3 AND r.status='approved'
        AND r.version=(SELECT MAX(version) FROM editorial_revisions WHERE objectId=o.id) LIMIT 1`))?.id;
    // LIMA serentak, bukan dua — perlumbaan berselang-seli, jadi tekanan lebih tinggi memberi
    // keyakinan lebih tinggi bahawa kunci per-slot benar-benar memegang.
    await Promise.all(Array.from({ length: 5 }, () =>
      api('PATCH', `/api/system/content/${aktifId}`, { status: 'archived' })));
    await new Promise(r => setTimeout(r, 1200));
    const aktifSelepas = (await dbGet(db, `
      SELECT COUNT(*) n FROM editorial_objects o JOIN editorial_revisions r ON r.objectId=o.id
      WHERE o.slotIndex=3 AND r.status='approved'
        AND r.version=(SELECT MAX(version) FROM editorial_revisions WHERE objectId=o.id)`)).n;
    if (aktifSelepas > 1) {
      lap.gagal('PERLUMBAAN naik-taraf melebihi had kapasiti', `had=1 tetapi ${aktifSelepas} kandungan Aktif selepas arkib serentak`);
    } else {
      lap.lulus(`naik-taraf automatik selamat daripada perlumbaan (${aktifSelepas} aktif, had 1)`);
    }
  }

  // --- (3b) DUA KELULUSAN BERBEZA serentak pada slot yang sama -------------------------
  // Corak sama seperti perlumbaan naik-taraf: semakan kapasiti pada laluan kelulusan juga
  // BACA kiraan dahulu, TULIS kemudian. Kalau dua editor meluluskan dua kandungan BERBEZA
  // serentak, kedua-duanya boleh nampak ada ruang dan kedua-duanya jadi Aktif — melebihi had.
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: 6, bidangName: BIDANG });
  const idSerentak = [];
  for (let i = 0; i < 2; i++) {
    await api('POST', '/api/system/slots', [{ slotIndex: 6, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok(`lulus-serentak-${i}`, `Kelulusan Serentak ${i}`, 6) }]);
    const o = await dbGet(db, 'SELECT id FROM editorial_objects WHERE slotIndex=6 ORDER BY createdAt DESC LIMIT 1');
    if (o) idSerentak.push(o.id);
  }
  if (idSerentak.length === 2) {
    await Promise.all(idSerentak.map(id => api('PATCH', `/api/system/content/${id}`, { status: 'approved' })));
    await new Promise(r => setTimeout(r, 600));
    const aktif6 = (await dbGet(db, `
      SELECT COUNT(*) n FROM editorial_objects o JOIN editorial_revisions r ON r.objectId=o.id
      WHERE o.slotIndex=6 AND r.status='approved'
        AND r.version=(SELECT MAX(version) FROM editorial_revisions WHERE objectId=o.id)`)).n;
    if (aktif6 > 1) {
      lap.gagal('PERLUMBAAN kelulusan melebihi had kapasiti', `had=1 tetapi ${aktif6} kandungan Aktif selepas dua kelulusan serentak`);
    } else {
      lap.lulus(`kelulusan serentak menghormati had (${aktif6} aktif, had 1)`);
    }
  }

  // --- (4) assign-slot serentak pada slot sama -----------------------------------------
  await api('POST', '/api/system/categories/activate', { name: 'Sukan', color: '#123456', icon: 'Trophy' });
  await Promise.all([
    api('POST', '/api/system/categories/assign-slot', { slotIndex: 5, bidangName: BIDANG }),
    api('POST', '/api/system/categories/assign-slot', { slotIndex: 5, bidangName: 'Sukan' }),
  ]);
  const bilBaris = (await dbAll(db, "SELECT slotIndex FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=5")).length;
  const nilai = (await dbGet(db, "SELECT manualDesk FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=5"))?.manualDesk;
  if (bilBaris !== 1) lap.gagal('assign-slot serentak mencipta baris pendua', `${bilBaris} baris untuk slot 6`);
  else if (!['Ekonomi', 'Sukan'].includes(nilai)) lap.gagal('assign-slot serentak menghasilkan nilai rosak', `manualDesk=${JSON.stringify(nilai)}`);
  else lap.lulus(`assign-slot serentak: satu baris, nilai waras (${nilai})`);

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
