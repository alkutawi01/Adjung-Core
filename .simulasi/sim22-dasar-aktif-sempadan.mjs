// SIMULASI 22 — Dasar Aktif Editorial: sisi KONFIGURASI Pentadbir + sempadan hari via HTTP
// sebenar (bukan job-execution runSemakanTakAktif(), yang baru dibaiki sesi ni — lihat sim20).
//
// Ujian:
//  1. PATCH /api/system/dasar-aktif-editorial dgn nilai TAK menaik (amaranPertama=10 > amaranKedua=5)
//     -> wajib DITOLAK (400), tak ditulis ke DB.
//  2. PATCH dgn nilai SAH menaik (3/6/9 hari) -> diterima, disahkan tersimpan via GET semula.
//  3. Seed editor dgn lastPublishedAt pada pelbagai jarak dari sempadan amaranPertamaHari=3 --
//     GET /api/system/users wajib pulangkan hariTakAktif TEPAT (floor hari) dan
//     tertaklukDasarAktif=true, ambangHariDasarAktif ikut nilai BAHARU (3/6/9) bukan lalai 7/14/21.
//  4. Seed akaun Pentadbir+Editor serentak (macam akaun pemilik projek sebenar) dgn
//     lastPublishedAt jauh lampau -- wajib tertaklukDasarAktif=false (DIKECUALIKAN) via HTTP,
//     bukan cuma baca kod.
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbRun, dbGet } from './sim-lib.mjs';

const PORT = 5222;
const DBF = path.join(os.tmpdir(), 'sim-adjung-dasar-aktif-sempadan.db');
const lap = pelapor('SIM 22 — DASAR AKTIF EDITORIAL: SEMPADAN + KONFIGURASI');
const HARI_MS = 24 * 60 * 60 * 1000;

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);

  // 1. Validasi menaik ditolak.
  const rTolak = await api('POST', '/api/system/dasar-aktif-editorial', {
    amaranPertamaHari: 10, amaranKeduaHari: 5, notisPenamatanHari: 21,
  });
  if (rTolak.status === 400) {
    lap.lulus('PATCH dgn tempoh TAK menaik (10 > 5) ditolak 400: ' + rTolak.json?.error);
  } else {
    lap.gagal('KRITIKAL: PATCH tempoh tak menaik TIDAK ditolak', JSON.stringify(rTolak));
  }
  // sama nilai (bukan strictly increasing) juga wajib ditolak
  const rTolakSama = await api('POST', '/api/system/dasar-aktif-editorial', {
    amaranPertamaHari: 5, amaranKeduaHari: 5, notisPenamatanHari: 9,
  });
  if (rTolakSama.status === 400) {
    lap.lulus('PATCH dgn amaranPertama === amaranKedua (5=5) turut ditolak 400 (strictly increasing)');
  } else {
    lap.gagal('KRITIKAL: PATCH dgn nilai SAMA (bukan strictly increasing) TIDAK ditolak', JSON.stringify(rTolakSama));
  }

  // Sahkan DB TAK berubah (masih lalai 7/14/21) selepas percubaan gagal di atas.
  const rSemakGagal = await api('GET', '/api/system/dasar-aktif-editorial');
  if (rSemakGagal.json?.amaranPertamaHari === 7 && rSemakGagal.json?.amaranKeduaHari === 14 && rSemakGagal.json?.notisPenamatanHari === 21) {
    lap.lulus('DB kekal nilai LALAI 7/14/21 selepas percubaan PATCH tak sah (tiada tulisan sebahagian/kotor)');
  } else {
    lap.gagal('KRITIKAL: DB berubah walau PATCH sepatutnya ditolak', JSON.stringify(rSemakGagal.json));
  }

  // 2. PATCH sah 3/6/9.
  const rSah = await api('POST', '/api/system/dasar-aktif-editorial', {
    amaranPertamaHari: 3, amaranKeduaHari: 6, notisPenamatanHari: 9,
  });
  if (rSah.ok && rSah.json?.amaranPertamaHari === 3) {
    lap.lulus('PATCH dgn tempoh sah menaik (3/6/9) diterima');
  } else {
    lap.gagal('PATCH tempoh sah GAGAL diterima', JSON.stringify(rSah));
  }

  // 3. Seed editor dgn lastPublishedAt pelbagai jarak dari sempadan amaranPertamaHari=3 (kini 3 hari).
  const db = new sqlite3.Database(DBF);
  const now = Date.now();
  const seedEditor = async (id, penName, msLalu) => {
    const lastPublishedAt = new Date(now - msLalu).toISOString();
    const createdAt = new Date(now - 365 * HARI_MS).toISOString();
    await dbRun(db, `INSERT INTO users (id,username,email,role,password,penName,status,createdAt,updatedAt,lastPublishedAt,amaranTakAktifTahap)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
      [id, id, `${id}@sim.test`, 'EDITOR', 'x', penName, 'Aktif', createdAt, createdAt, lastPublishedAt]);
    await dbRun(db, `INSERT INTO user_roles (userId, roleId) VALUES (?, 'editor')`, [id]);
  };

  // Sempadan bawah amaranPertamaHari (3 hari): elapsed sedikit KURANG drpd 3 hari -> hariTakAktif=2.
  await seedEditor('sim22-a', 'Editor Bawah3', 3 * HARI_MS - 5000);
  // elapsed sedikit LEBIH drpd 3 hari -> hariTakAktif=3.
  await seedEditor('sim22-b', 'Editor Lebih3', 3 * HARI_MS + 5000);
  // elapsed sedikit LEBIH drpd 9 hari (notisPenamatanHari) -> hariTakAktif=9.
  await seedEditor('sim22-c', 'Editor Lebih9', 9 * HARI_MS + 5000);

  // 4. Akaun Pentadbir+Editor serentak (macam pemilik projek sebenar), lastPublishedAt lampau
  // (365 hari) -- wajib DIKECUALIKAN drpd dasar ni walau peranan editor turut dipegang.
  await dbRun(db, `INSERT INTO users (id,username,email,role,password,penName,status,createdAt,updatedAt,lastPublishedAt,amaranTakAktifTahap)
    VALUES ('sim22-pentadbir','sim22-pentadbir','sim22-pentadbir@sim.test','EDITOR','x','Pentadbir+Editor','Aktif',?,?,?,0)`,
    [new Date(now - 365 * HARI_MS).toISOString(), new Date(now - 365 * HARI_MS).toISOString(), new Date(now - 365 * HARI_MS).toISOString()]);
  await dbRun(db, `INSERT INTO user_roles (userId, roleId) VALUES ('sim22-pentadbir', 'editor')`);
  await dbRun(db, `INSERT INTO user_roles (userId, roleId) VALUES ('sim22-pentadbir', 'pentadbir')`);
  await new Promise((r) => db.close(r));

  const rUsers = await api('GET', '/api/system/users');
  if (!rUsers.ok) throw new Error('GET /users gagal: ' + rUsers.status + ' ' + rUsers.teks);
  const byId = {};
  for (const u of rUsers.json || []) byId[u.id] = u;

  // Sahkan ambang dipaparkan ikut nilai BAHARU (3/6/9), bukan lalai 7/14/21.
  const ambangA = byId['sim22-a']?.ambangHariDasarAktif;
  if (ambangA && ambangA.amaranPertama === 3 && ambangA.amaranKedua === 6 && ambangA.notisPenamatan === 9) {
    lap.lulus('GET /users ambangHariDasarAktif ikut tempoh BAHARU (3/6/9) — muat semula LIVE berfungsi via HTTP');
  } else {
    lap.gagal('KRITIKAL: ambangHariDasarAktif TAK ikut tempoh baharu (cache stale lalai 7/14/21?)', JSON.stringify(ambangA));
  }

  const semak = (id, jangkaHariTakAktif, label) => {
    const u = byId[id];
    if (!u) { lap.gagal(`${label}: user tak wujud dlm respons GET /users`, id); return; }
    if (u.tertaklukDasarAktif !== true) {
      lap.gagal(`${label}: tertaklukDasarAktif sepatutnya true`, JSON.stringify(u));
      return;
    }
    if (u.hariTakAktif === jangkaHariTakAktif) {
      lap.lulus(`${label}: hariTakAktif=${u.hariTakAktif} (jangka ${jangkaHariTakAktif}) TEPAT`);
    } else {
      lap.gagal(`${label}: hariTakAktif SALAH (dapat ${u.hariTakAktif}, jangka ${jangkaHariTakAktif})`, JSON.stringify(u));
    }
  };
  semak('sim22-a', 2, 'Editor Bawah3 (elapsed < 3 hari)');
  semak('sim22-b', 3, 'Editor Lebih3 (elapsed > 3 hari sedikit)');
  semak('sim22-c', 9, 'Editor Lebih9 (elapsed > 9 hari sedikit)');

  const pentadbirGanda = byId['sim22-pentadbir'];
  if (pentadbirGanda && pentadbirGanda.tertaklukDasarAktif === false && pentadbirGanda.hariTakAktif === null) {
    lap.lulus('Akaun Pentadbir+Editor serentak: tertaklukDasarAktif=false, hariTakAktif=null (DIKECUALIKAN betul via HTTP walau 365 hari tak aktif)');
  } else {
    lap.gagal('KRITIKAL: akaun Pentadbir+Editor serentak TIDAK dikecualikan drpd Dasar Aktif', JSON.stringify(pentadbirGanda));
  }
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
