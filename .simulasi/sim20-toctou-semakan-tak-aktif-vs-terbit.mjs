// SIMULASI 20 — TOCTOU: runSemakanTakAktif() (job harian gantung akaun tak aktif, server.js)
// LAWAN PATCH /content/:id yang menerbitkan kandungan (contentRoutes.js ~baris 1394, reset
// lastPublishedAt+amaranTakAktifTahap=0 -- "saya baru terbit, jangan gantung saya").
//
// (bug-hunt 2026-09-08, sudut baharu diarah selepas nilaiSemulaKeputusanSediaAda-vs-manual-review
// -- semak SEMUA job latar bulk-UPDATE lain untuk corak "SELECT snapshot, gelung UPDATE per-baris
// tanpa semak semula" yang sama.)
//
// runSemakanTakAktif() SELECT semua editor 'Aktif' overdue DAHULU (snapshot amaranTakAktifTahap
// SEMASA + lastPublishedAt SEMASA), kira tahapBaharu (1/2/3) dalam JS, kemudian UPDATE setiap
// baris SATU PERSATU (gelung sequential, setiap iterasi await hantar emel dahulu -- boleh ambil
// masa SEBENAR). Kalau editor SASARAN menerbitkan kandungan (PATCH /content/:id -> status
// 'approved') DALAM tempoh gelung tu sedang berjalan (dicetuskan pada boot pelayan,
// skemaSedia.then(jalankanSemakanTakAktif)), laluan terbit itu reset lastPublishedAt=sekarang +
// amaranTakAktifTahap=0 SERTA MERTA. Tanpa pengawal, UPDATE gantungan tik ni (guna tahapBaharu
// STALE dikira drpd data SEBELUM terbitan) tetap jalan & TULIS GANTI reset tu -- akaun
// DIGANTUNG sebaik sahaja editor menerbitkan kandungan untuk menyelamatkan diri.
//
// Ujian: cipta ~3000 editor "pengisi" overdue (>21 hari, ambang notisPenamatan lalai) supaya
// gelung runSemakanTakAktif() yang tercetus SERTA-MERTA semasa BOOT pelayan (jalankanSemakanTakAktif
// dipanggil dalam skemaSedia.then(), tidak menunggu app.listen) ambil masa sebenar merentasi
// banyak titik await SQLite -- bukan cuma teori. Editor SASARAN turut overdue >21 hari (tahapBaharu
// patut = 3, gantung) dan diletak di HUJUNG senarai (createdAt terkemudian -- DISTINCT query
// server tiada ORDER BY eksplisit tapi lajur rowid/createdAt lazimnya kekal susunan masuk pada
// SQLite tanpa index lain, dipakai di sini sebagai heuristik memanjangkan tetingkap, BUKAN
// jaminan mutlak -- longgokan pengisi cukup besar untuk menjadikan tetingkap saat, bukan
// milisaat, tak kira susunan tepat). Sebaik pelayan started (health check lulus, tapi tik BELUM
// tentu selesai), PATCH kandungan sasaran terus ke 'approved' -- ni MENYIMULASIKAN editor
// menerbitkan tepat pada masa gentingnya sendiri.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbRun, dbGet, bukaDb } from './sim-lib.mjs';

const PORT = 5220;
const DBF = path.join(os.tmpdir(), 'sim-adjung-toctou-semakan-tak-aktif.db');
const lap = pelapor('SIM 20 — TOCTOU SEMAKAN TAK AKTIF LAWAN TERBIT KANDUNGAN');

// Perlu sedia DB & baris SEBELUM boot (skema+seed job tercetus serta-merta lepas skema wujud).
// bootServer() sendiri padam+cipta DB baharu (freshDb) SEBELUM spawn -- jadi kita spawn server
// SEKALI dahulu (biar skema tercipta), tutup, seed baris terus ke fail DB (guna sqlite3 terus),
// kemudian spawn SEMULA (freshDb=false) supaya jalankanSemakanTakAktif() jalan skop baharu ATAS
// baris yang kita seed tu.
const srv0 = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
srv0.proc.kill();
await new Promise((r) => setTimeout(r, 500));

const db0 = bukaDb(DBF);
const now = new Date();
const lamaIso = (hari) => new Date(now.getTime() - hari * 24 * 60 * 60 * 1000).toISOString();

// Peranan tertakluk dasar aktif: 'editor' (PERANAN_TERPAKAI_DASAR_AKTIF, dasarAktifRoutes.js).
await dbRun(db0, `INSERT INTO users (id, username, email, role, password, penName, status, lastPublishedAt, amaranTakAktifTahap, createdAt, updatedAt)
  VALUES ('sim20-sasaran', 'sim20-sasaran', 'sasaran@sim.test', 'EDITOR', 'x', 'Sasaran Sim20', 'Aktif', ?, 0, ?, ?)`,
  [lamaIso(40), lamaIso(40), lamaIso(40)]);
await dbRun(db0, "INSERT INTO user_roles (userId, roleId) VALUES ('sim20-sasaran', 'editor')");

// ~3000 pengisi overdue sama (>21 hari) supaya gelung ambil masa sebenar.
await dbRun(db0, 'BEGIN TRANSACTION');
for (let i = 0; i < 3000; i++) {
  const id = `sim20-isi-${i}`;
  await dbRun(db0, `INSERT INTO users (id, username, email, role, password, penName, status, lastPublishedAt, amaranTakAktifTahap, createdAt, updatedAt)
    VALUES (?, ?, ?, 'EDITOR', 'x', ?, 'Aktif', ?, 0, ?, ?)`,
    [id, id, `${id}@sim.test`, `Pengisi ${i}`, lamaIso(40), lamaIso(40), lamaIso(40)]);
  await dbRun(db0, `INSERT INTO user_roles (userId, roleId) VALUES (?, 'editor')`, [id]);
}
await dbRun(db0, 'COMMIT');

// Kandungan PENDING sasaran, editorName = penName editor sasaran, supaya PATCH ->'approved'
// mencetuskan laluan reset lastPublishedAt/amaranTakAktifTahap (contentRoutes.js ~1394).
const nowIso = now.toISOString();
await dbRun(db0, `INSERT INTO editorial_objects (id, type, categoryId, slotIndex, createdAt, updatedAt)
  VALUES ('sim20-objek', 'MANUAL', 'UMUM', 10, ?, ?)`, [nowIso, nowIso]);
await dbRun(db0, `INSERT INTO editorial_revisions (objectId, version, title, summary, status, createdBy, createdAt, updatedAt)
  VALUES ('sim20-objek', 1, 'Kandungan Ujian Sim20', 'Ringkasan ujian penerbitan sim20 bagi menyelamatkan akaun daripada digantung.', 'pending', 'sim20-sasaran', ?, ?)`, [nowIso, nowIso]);
const revRow = await dbGet(db0, "SELECT id FROM editorial_revisions WHERE objectId='sim20-objek'");
await dbRun(db0, `INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText)
  VALUES ('sim20-objek', ?, 'editorName', 'Sasaran Sim20')`, [revRow.id]);

lap.lulus('3001 editor overdue (1 sasaran + 3000 pengisi) + kandungan pending sasaran disediakan');
await new Promise((r) => db0.close(r));

// Spawn SEMULA (freshDb=false) -- skemaSedia.then(jalankanSemakanTakAktif) tercetus serta-merta
// atas baris yang baru diseed, health-check pulang SEBAIK pelayan listen (tik mungkin belum
// selesai -- itulah tetingkap yang diuji).
const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: false });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);

  // Tembak PATCH terbit SERTA-MERTA (tanpa delay) lepas pelayan sedia -- cuba tangkap tik
  // runSemakanTakAktif() masih di tengah gelung 3001 baris.
  const rTerbit = await api('PATCH', '/api/system/content/sim20-objek', { status: 'approved' });
  if (!rTerbit.ok) throw new Error('PATCH terbit gagal: ' + rTerbit.status + ' ' + rTerbit.teks.slice(0, 300) + '\n\nLOG:\n' + srv.dapatLog().slice(-3000));
  lap.lulus('PATCH terbit (approve) pulang 200 semasa pelayan baru boot');

  // Tunggu tik runSemakanTakAktif() (3001 baris, setiap satu cuba hantar emel -- SMTP tak
  // dikonfigur dlm ujian ni, jadi setiap emel gagal PANTAS, tapi 3001 x dbRun+notify+audit
  // tetap makan beberapa saat sebenar) selesai sepenuhnya sebelum semak keputusan akhir.
  await new Promise((r) => setTimeout(r, 15000));

  const db = bukaDb(DBF);
  const baris = await dbGet(db, "SELECT status, isSuspended, amaranTakAktifTahap, lastPublishedAt FROM users WHERE id='sim20-sasaran'");
  await new Promise((r) => db.close(r));

  if (baris?.status === 'Aktif' && Number(baris?.isSuspended) === 0) {
    lap.lulus('Akaun sasaran KEKAL Aktif (tidak digantung) walau runSemakanTakAktif() jalan serentak dengan penerbitannya sendiri: ' + JSON.stringify(baris));
  } else {
    lap.gagal('KRITIKAL: akaun sasaran DIGANTUNG walau BARU SAHAJA menerbitkan kandungan (TOCTOU tik gantungan lawan reset terbit)', JSON.stringify(baris));
  }
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
