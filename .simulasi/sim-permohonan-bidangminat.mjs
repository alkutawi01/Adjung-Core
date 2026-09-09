// Sim ad-hoc: satu baris permohonan_editor dengan bidangMinat JSON rosak tak boleh gugurkan
// SELURUH senarai GET /api/system/permohonan-editor untuk Ketua Editor/Pentadbir.
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { REPO, bukaDb, dbRun, bootServer, ciptaPentadbir, login, buatKlien, pelapor } from './sim-lib.mjs';

const PORT = 5991;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-permohonan-bidangminat.db');
const lapor = pelapor('sim-permohonan-bidangminat');

const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
try {
  const { username, pass } = await ciptaPentadbir(DB_FILE);
  const cookie = await login(base, username, pass);
  const klien = buatKlien(base, cookie);

  const db = bukaDb(DB_FILE);
  const now = new Date().toISOString();
  // Baris SAH
  await dbRun(db, `INSERT INTO permohonan_editor
      (id, namaPenuh, emel, telefon, negeri, kelulusan, bidangMinat, motivasi, status, createdAt)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ['ph-sah', 'Ali Sah', 'ali@sim.test', '0123456789', 'Selangor', 'Ijazah', JSON.stringify(['Ekonomi']), 'Minat menulis.', 'baharu', now]);
  // Baris ROSAK — bidangMinat bukan JSON sah (cth data rosak/diubah manual)
  await dbRun(db, `INSERT INTO permohonan_editor
      (id, namaPenuh, emel, telefon, negeri, kelulusan, bidangMinat, motivasi, status, createdAt)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ['ph-rosak', 'Bakar Rosak', 'bakar@sim.test', '0129876543', 'Kelantan', 'Diploma', 'ini bukan json', 'Minat sukan.', 'baharu', now]);
  await new Promise(r => db.close(r));

  const resp = await klien('GET', '/api/system/permohonan-editor');
  if (resp.status !== 200) {
    lapor.gagal('GET permohonan-editor patut 200 walau satu baris ada bidangMinat rosak', `status=${resp.status} body=${JSON.stringify(resp.json)}`);
  } else {
    const ids = (resp.json || []).map(r => r.id).sort();
    if (ids.length === 2 && ids.includes('ph-sah') && ids.includes('ph-rosak')) {
      lapor.lulus('Kedua-dua baris (sah + rosak) kembali, 200 OK');
      const rosak = resp.json.find(r => r.id === 'ph-rosak');
      const sah = resp.json.find(r => r.id === 'ph-sah');
      if (Array.isArray(rosak.bidangMinat) && rosak.bidangMinat.length === 0) {
        lapor.lulus('Baris rosak jatuh balik ke bidangMinat=[] (bukan ranap)');
      } else {
        lapor.gagal('Baris rosak patut bidangMinat=[]', JSON.stringify(rosak.bidangMinat));
      }
      if (Array.isArray(sah.bidangMinat) && sah.bidangMinat[0] === 'Ekonomi') {
        lapor.lulus('Baris sah kekal bidangMinat=["Ekonomi"] tepat');
      } else {
        lapor.gagal('Baris sah patut bidangMinat=["Ekonomi"]', JSON.stringify(sah.bidangMinat));
      }
    } else {
      lapor.gagal('Kedua-dua ID dijangka dalam respons', JSON.stringify(ids));
    }
  }
} finally {
  proc.kill();
}
const penemuan = lapor.ringkasan();
process.exit(penemuan.length ? 1 : 0);
