// Sim 31 — POST /api/auth/aktifkan-akaun (tetapan identiti kali pertama editor jemputan baharu)
// TIDAK sekat panjang/format username langsung, walhal POST /api/auth/change-username (tukar
// username SENDIRI selepas aktif) kuatkuasakan minimum 3 aksara. Ini bermakna editor baharu boleh
// tetapkan ID pengguna 1-2 aksara semasa aktivasi (string kosong sudah ditangkap secara berasingan)
// -- laluan SATU-SATUNYA cara username pertama kali wujud --
// dan ia terus jadi username SAH selama-lamanya sebab tiada langkah lain memaksa dia ubah balik.
import { bootServer, bukaDb, dbRun, buatKlien } from './sim-lib.mjs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const PORT = 8931;
const dbFile = path.join(os.tmpdir(), `sim31-${Date.now()}.db`);

async function main() {
  const { proc, base } = await bootServer({ port: PORT, dbFile });
  try {
    const db = bukaDb(dbFile);
    const token = crypto.randomBytes(32).toString('hex');
    const tamat = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    // Simulasi akaun jemputan baharu SEBENAR (username sementara 'pending_...', penName kosong)
    // -- persis apa yang POST /api/system/users cipta -- dgn resetToken sah, sama seperti klik
    // pautan emel jemputan.
    await dbRun(db, `INSERT INTO users (id, username, email, role, penName, isSuspended, status, password, resetToken, resetTokenExpiresAt, createdAt, updatedAt)
      VALUES (?,?,?,?,?,0,'Aktif',?,?,?,?,?)`,
      ['sim31-user', `pending_${token.slice(0, 16)}`, 'sim31@sim.test', 'EDITOR', '', 'x', token, tamat, now, now]);
    await new Promise(r => db.close(r));

    const klien = buatKlien(base, '');
    // Editor baharu tetapkan identiti kali pertama -- username SATU HURUF "a".
    const r = await klien('POST', '/api/auth/aktifkan-akaun', {
      token, password: 'KataLaluanSah123', username: 'a', penName: 'Penulis Ujian',
    });

    console.log('Status aktifkan-akaun (username "a"):', r.status, JSON.stringify(r.json));
    let lulus = true;
    if (r.status === 200) {
      console.log('GAGAL: username 1 aksara diterima semasa aktivasi (change-username sedia ada tolak <3 aksara).');
      lulus = false;
    } else {
      console.log('OK: username pendek ditolak semasa aktivasi.');
    }

    // Laluan positif — username SAH (>=3 aksara) mesti tetap diterima seperti biasa, pembetulan
    // tak boleh sekat kes sah.
    const r2 = await klien('POST', '/api/auth/aktifkan-akaun', {
      token, password: 'KataLaluanSah123', username: 'editor-ujian', penName: 'Penulis Ujian',
    });
    console.log('Status aktifkan-akaun (username "editor-ujian"):', r2.status, JSON.stringify(r2.json));
    if (r2.status !== 200) {
      console.log('GAGAL: username sah (>=3 aksara) turut ditolak selepas pembetulan.');
      lulus = false;
    } else {
      console.log('OK: username sah tetap diterima.');
    }
    process.exitCode = lulus ? 0 : 1;
  } finally {
    proc.kill();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
