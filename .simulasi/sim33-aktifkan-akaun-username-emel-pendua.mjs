// Sim 33 — POST /api/auth/aktifkan-akaun (tetapan identiti kali pertama editor jemputan baharu)
// semak pendua username HANYA lawan lajur username, walhal POST /api/auth/change-username (tukar
// username SENDIRI selepas aktif) semak MERENTASI username DAN email (dapatan audit 2026-08-08,
// sebab log masuk padan `LOWER(username) = ? OR LOWER(email) = ?`, satu ruang nama gabungan).
// Ini bermakna editor jemputan baharu boleh tetapkan ID pengguna SAMA dengan EMEL akaun lain
// semasa aktivasi -- log masuk lepas ni jadi taksa (dua baris padan carian yang sama).
import { bootServer, bukaDb, dbRun, buatKlien } from './sim-lib.mjs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const PORT = 8933;
const dbFile = path.join(os.tmpdir(), `sim33-${Date.now()}.db`);

async function main() {
  const { proc, base } = await bootServer({ port: PORT, dbFile });
  try {
    const db = bukaDb(dbFile);
    const token = crypto.randomBytes(32).toString('hex');
    const tamat = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Akaun A sedia ada (aktif, ada emel sebenar).
    await dbRun(db, `INSERT INTO users (id, username, email, role, penName, isSuspended, status, password, resetToken, resetTokenExpiresAt, createdAt, updatedAt)
      VALUES (?,?,?,?,?,0,'Aktif',?,NULL,NULL,?,?)`,
      ['sim33-a', 'editor-a', 'editorlama@sim.test', 'EDITOR', 'Editor Lama', 'x', now, now]);

    // Akaun B -- jemputan baharu (username sementara, penName kosong), resetToken sah.
    await dbRun(db, `INSERT INTO users (id, username, email, role, penName, isSuspended, status, password, resetToken, resetTokenExpiresAt, createdAt, updatedAt)
      VALUES (?,?,?,?,?,0,'Aktif',?,?,?,?,?)`,
      ['sim33-b', `pending_${token.slice(0, 16)}`, 'sim33b@sim.test', 'EDITOR', '', 'x', token, tamat, now, now]);
    await new Promise(r => db.close(r));

    const klien = buatKlien(base, '');
    // Editor B tetapkan identiti kali pertama -- username = EMEL akaun A sedia ada.
    const r = await klien('POST', '/api/auth/aktifkan-akaun', {
      token, password: 'KataLaluanSah123', username: 'editorlama@sim.test', penName: 'Penulis Ujian B',
    });

    console.log('Status aktifkan-akaun (username = emel akaun lain):', r.status, JSON.stringify(r.json));
    let lulus = true;
    if (r.status === 200) {
      console.log('GAGAL: username bertindih dengan emel akaun lain diterima semasa aktivasi.');
      lulus = false;
    } else if (r.status === 409) {
      console.log('OK: pendua username/emel ditolak semasa aktivasi.');
    } else {
      console.log('GAGAL: status tak dijangka.');
      lulus = false;
    }

    // Laluan positif -- username unik sah mesti tetap diterima seperti biasa.
    const r2 = await klien('POST', '/api/auth/aktifkan-akaun', {
      token, password: 'KataLaluanSah123', username: 'editor-b-unik', penName: 'Penulis Ujian B',
    });
    console.log('Status aktifkan-akaun (username unik):', r2.status, JSON.stringify(r2.json));
    if (r2.status !== 200) {
      console.log('GAGAL: username unik sah turut ditolak selepas pembetulan.');
      lulus = false;
    } else {
      console.log('OK: username unik sah tetap diterima.');
    }
    process.exitCode = lulus ? 0 : 1;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
