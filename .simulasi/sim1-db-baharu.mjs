// SIMULASI 1 — PEMASANGAN BAHARU (paling kritikal sebelum launch).
// Hidupkan pelayan terhadap DB KOSONG, cipta kandungan melalui setiap laluan sebenar, dan sahkan
// SETIAP medan benar-benar bertahan dalam DB. Kelas pepijat "atribut tak berdaftar / baris
// diandaikan wujud" HANYA menampakkan diri di sini — pada adjung.db sedia ada ia tersembunyi
// kerana baris diwarisi daripada seed lama.
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbAll, dbRun, bukaDb } from './sim-lib.mjs';

const PORT = 5199;
const DBF = path.join(os.tmpdir(), 'sim-adjung-baharu.db');
const lap = pelapor('SIM 1 — DB BAHARU');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  // ---- Prasyarat: cipta Bidang aktif + tetapkan pada slot -------------------------------
  const BIDANG = 'Ekonomi';
  const SLOT = 1; // index 1 (papar "slot 2")

  const rAkt = await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#802334', icon: 'TrendingUp' });
  if (!rAkt.ok) lap.gagal('cipta Bidang pada DB baharu', `HTTP ${rAkt.status} ${rAkt.teks.slice(0, 200)}`);
  else {
    const b = await dbGet(db, 'SELECT * FROM CategoryRegistry WHERE LOWER(name)=LOWER(?)', [BIDANG]);
    if (!b) lap.gagal('Bidang dilapor dicipta tapi TIADA dalam DB', 'CategoryRegistry kosong');
    else lap.lulus('Bidang dicipta & bertahan');
  }

  const rAssign = await api('POST', '/api/system/categories/assign-slot', { slotIndex: SLOT, bidangName: BIDANG });
  const slotRow = await dbGet(db, "SELECT manualDesk FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=?", [SLOT]);
  if (!rAssign.ok) lap.gagal('assign-slot pada DB baharu', `HTTP ${rAssign.status} ${rAssign.teks.slice(0, 200)}`);
  else if (!slotRow || (slotRow.manualDesk || '').toLowerCase() !== BIDANG.toLowerCase()) {
    lap.gagal('assign-slot lapor BERJAYA tapi DB tak berubah', `baris=${JSON.stringify(slotRow)} (slots_config tiada baris pd DB baharu)`);
  } else lap.lulus('assign-slot bertahan pada slot tanpa baris sedia ada');

  // ---- Ujian teras: cipta kandungan, sahkan SETIAP medan bertahan -------------------------
  const HANTAR = {
    slotIndex: SLOT,
    title: 'Ujian Ketahanan Medan Kandungan',
    summary: 'Huraian ringkas untuk ujian ketahanan medan.',
    desk: BIDANG,
    topik: 'Kewangan',
    source: 'Berita Harian',
    url: 'https://www.bharian.com.my/ujian-simulasi',
    imageUrl: 'https://contoh.test/imej.jpg',
  };
  const rCipta = await api('POST', '/api/system/content', HANTAR);
  if (!rCipta.ok) {
    lap.gagal('POST /content pada DB baharu', `HTTP ${rCipta.status} ${rCipta.teks.slice(0, 300)}`);
  } else {
    const objectId = rCipta.json?.id;
    const attrs = await dbAll(db, 'SELECT attributeId, valueText FROM editorial_attribute_values WHERE objectId=?', [objectId]);
    const peta = Object.fromEntries(attrs.map(a => [a.attributeId, a.valueText]));

    // Setiap medan yang dihantar MESTI wujud semula.
    const dijangka = { desk: BIDANG, topik: 'Kewangan', source: 'Berita Harian', url: HANTAR.url, imageUrl: HANTAR.imageUrl };
    for (const [k, v] of Object.entries(dijangka)) {
      // `desk` SENGAJA dijadikan huruf besar semasa simpan (finalCategory = desk.toUpperCase()),
      // jadi bandingkan tanpa mengira huruf besar/kecil untuk medan itu — bukan pepijat.
      const sama = k === 'desk'
        ? String(peta[k] || '').toLowerCase() === String(v).toLowerCase()
        : peta[k] === v;
      if (peta[k] === undefined) {
        lap.gagal(`medan "${k}" HILANG SENYAP selepas cipta kandungan`, `dihantar="${v}" — tiada baris editorial_attribute_values. API balas 200. Atribut mungkin tak berdaftar (FK ditolak, console.warn sahaja).`);
      } else if (!sama) {
        lap.gagal(`medan "${k}" berubah nilai`, `dihantar="${v}" tersimpan="${peta[k]}"`);
      } else lap.lulus(`medan "${k}" bertahan`);
    }

    const rev = await dbGet(db, 'SELECT title, summary, status FROM editorial_revisions WHERE objectId=? ORDER BY version DESC LIMIT 1', [objectId]);
    if (!rev) lap.gagal('revisi kandungan tak wujud', 'editorial_revisions kosong walau API balas 200');
    else if (rev.title !== HANTAR.title) lap.gagal('tajuk tak sepadan', `${rev.title}`);
    else lap.lulus('tajuk & revisi bertahan');
  }

  // ---- Setiap attributeId yang kod TULIS mesti berdaftar --------------------------------
  const berdaftar = new Set((await dbAll(db, 'SELECT id FROM editorial_attributes')).map(r => r.id));
  // Senarai ini diambil daripada kod tulis sebenar (attrs[] di server.js/contentRoutes/pipeline).
  const digunakanOlehKod = ['desk', 'url', 'source', 'imageUrl', 'topik', 'briefLong', 'originalDate',
    'sourceType', 'organizer', 'location', 'access', 'penerangan', 'note', 'image', 'editorName',
    'sourcesJson', 'pernahDitolak', 'sebabMenunggu'];
  const hilang = digunakanOlehKod.filter(a => !berdaftar.has(a));
  if (hilang.length) {
    lap.gagal('attributeId ditulis kod tapi TIDAK didaftar pada DB baharu', `${hilang.join(', ')} — setiap INSERT akan ditolak FK dgn console.warn sahaja (kehilangan data senyap)`);
  } else lap.lulus('semua attributeId yang kod tulis sudah berdaftar');

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
