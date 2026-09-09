// Sahkan pembetulan: POST /api/system/slot-editors kini menolak editor yang isSuspended=1.
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { REPO, bukaDb, dbRun, ciptaPentadbir, bootServer, login, buatKlien } from './sim-lib.mjs';

const DB = path.join(REPO, '.simulasi', 'scratch-sim-suspended-editor.db');
const PORT = 34599;

(async () => {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB, freshDb: true });
  try {
    const { pass } = await ciptaPentadbir(DB, {});
    // Cipta satu editor biasa, DIGANTUNG (isSuspended=1).
    const db = bukaDb(DB);
    const now = new Date().toISOString();
    await dbRun(db, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,isSuspended,status,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      ['sim-editor-suspended', 'sim-editor-suspended', 'sim-editor-suspended@sim.test', 'EDITOR', 'x', 'Editor Digantung', 1, 'Tidak Aktif', now, now]);
    await new Promise(r => db.close(r));

    const cookie = await login(base, 'sim-admin', pass);
    const klien = buatKlien(base, cookie);

    const res = await klien('POST', '/api/system/slot-editors', {
      slotIndex: 2,
      editorIds: ['sim-editor-suspended'],
    });

    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.json));

    if (res.status === 400 && /digantung/i.test(res.json?.error || '')) {
      console.log('LULUS: editor digantung ditolak dgn ralat yg jelas.');
    } else {
      console.log('GAGAL: editor digantung TIDAK ditolak (bug masih wujud atau regresi baharu).');
      process.exitCode = 1;
    }

    // Sahkan tiada baris ditulis ke slot_editors utk editor digantung ni.
    const db2 = bukaDb(DB);
    const rows = await new Promise((resolve, reject) =>
      db2.all('SELECT * FROM slot_editors WHERE editorId = ?', ['sim-editor-suspended'], (e, r) => e ? reject(e) : resolve(r)));
    await new Promise(r => db2.close(r));
    console.log('Baris slot_editors utk editor digantung:', rows.length);
    if (rows.length > 0) {
      console.log('GAGAL: baris ditulis walau ditolak di response.');
      process.exitCode = 1;
    }

    // Regresi: editor AKTIF (bukan digantung) mesti terus boleh ditugaskan seperti biasa.
    const db3 = bukaDb(DB);
    await dbRun(db3, `INSERT OR REPLACE INTO users (id,username,email,role,password,penName,isSuspended,status,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      ['sim-editor-aktif', 'sim-editor-aktif', 'sim-editor-aktif@sim.test', 'EDITOR', 'x', 'Editor Aktif', 0, 'Aktif', now, now]);
    await new Promise(r => db3.close(r));
    const resAktif = await klien('POST', '/api/system/slot-editors', {
      slotIndex: 2,
      editorIds: ['sim-editor-aktif'],
    });
    console.log('Status (editor aktif):', resAktif.status, JSON.stringify(resAktif.json));
    if (resAktif.status === 200 && resAktif.json?.editorIds?.includes('sim-editor-aktif')) {
      console.log('LULUS: editor aktif tetap boleh ditugaskan (tiada regresi).');
    } else {
      console.log('GAGAL: editor aktif TERSEKAT (regresi).');
      process.exitCode = 1;
    }
  } finally {
    proc.kill();
  }
})();
