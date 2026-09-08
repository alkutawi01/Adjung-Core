// Sahkan pembetulan 2026-09-09: backup PRA-MIGRASI (boot) kini checkpoint WAL sebelum menyalin,
// sama macam backup berjadual harian (runScheduledBackup, dibaiki 2026-09-02). Sediakan DB
// scratch dalam mod WAL dengan SATU baris yang sengaja dibiarkan HANYA dalam fail -wal (sambungan
// penulis kekal terbuka, wal_autocheckpoint=0, supaya checkpoint automatik SQLite tak berlaku),
// kemudian boot pelayan sebenar terhadapnya dan sahkan fail backup-boot yang terhasil mengandungi
// baris tu (bukan snapshot lapuk tanpa baris tu).
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { bootServer, dbRun, dbAll, REPO, pelapor } from './sim-lib.mjs';

const lap = pelapor('sim54-backup-boot-wal-checkpoint');
const dbFile = path.join(REPO, '.simulasi', 'scratch-sim54.db');
for (const ext of ['', '-wal', '-shm']) { try { fs.unlinkSync(dbFile + ext); } catch {} }
for (const f of fs.readdirSync(path.join(REPO, '.simulasi'))) {
  if (f.startsWith('scratch-sim54.db.backup-boot-')) { try { fs.unlinkSync(path.join(REPO, '.simulasi', f)); } catch {} }
}

let penulis;
(async () => {
  // 1) Sediakan DB WAL dengan baris "tersembunyi" dalam -wal sahaja.
  penulis = new sqlite3.Database(dbFile);
  await dbRun(penulis, 'PRAGMA journal_mode = WAL;');
  await dbRun(penulis, 'PRAGMA wal_autocheckpoint = 0;'); // elak checkpoint automatik SQLite
  await dbRun(penulis, 'CREATE TABLE penanda_wal (id INTEGER PRIMARY KEY, teks TEXT)');
  await dbRun(penulis, "INSERT INTO penanda_wal (teks) VALUES ('hanya-dalam-wal-sebelum-boot')");
  const adaWal = fs.existsSync(dbFile + '-wal') && fs.statSync(dbFile + '-wal').size > 0;
  if (!adaWal) { lap.gagal('Persediaan', 'Fail -wal kosong/tiada selepas insert — persediaan simulasi sendiri gagal, bukan dapatan sebenar.'); }
  else lap.lulus('Persediaan: baris wujud dalam -wal, sambungan penulis KEKAL terbuka (checkpoint automatik SQLite dielakkan)');

  // 2) Boot pelayan SEBENAR terhadap DB SAMA (freshDb:false — jangan padam DB yang baru disediakan).
  //    Pelayan patut cipta salinan .backup-boot-* semasa boot (tiada salinan sedia ada, JEDA_BACKUP_BOOT_MS belum tercecah).
  const { proc } = await bootServer({ port: 4554, dbFile, freshDb: false });
  await new Promise((r) => setTimeout(r, 1500)); // beri masa giliran db.serialize (checkpoint+salin) selesai

  const backupFiles = fs.readdirSync(path.join(REPO, '.simulasi'))
    .filter((f) => f.startsWith('scratch-sim54.db.backup-boot-'));
  if (backupFiles.length === 0) {
    lap.gagal('Salinan boot dicipta', 'Tiada fail .backup-boot-* dijumpai selepas boot.');
  } else {
    lap.lulus(`Salinan boot dicipta: ${backupFiles[0]}`);
    const backupPath = path.join(REPO, '.simulasi', backupFiles[0]);
    const semak = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY);
    const baris = await dbAll(semak, 'SELECT teks FROM penanda_wal');
    await new Promise((r) => semak.close(r));
    if (baris.length === 1 && baris[0].teks === 'hanya-dalam-wal-sebelum-boot') {
      lap.lulus('Salinan boot MENGANDUNGI baris yang sebelum ni hanya wujud dalam -wal — checkpoint sebelum salin BERFUNGSI.');
    } else {
      lap.gagal('Kandungan salinan boot', `Baris dijangka tiada/salah: ${JSON.stringify(baris)} — checkpoint tidak berlaku sebelum salinan dibuat (pepijat lama berulang).`);
    }
  }

  proc.kill();
  try { await new Promise((r) => penulis.close(r)); } catch {}
  const penemuan = lap.ringkasan();
  process.exit(penemuan.length ? 1 : 0);
})().catch((e) => {
  console.error('RALAT SIMULASI:', e);
  try { proc?.kill?.(); } catch {}
  process.exit(1);
});
