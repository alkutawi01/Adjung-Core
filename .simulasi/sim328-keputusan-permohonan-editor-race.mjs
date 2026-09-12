// sim328 — verifikasi POST /system/permohonan-editor/:id/keputusan lawan dua permintaan
// SERENTAK (klik dua kali Terima/Tolak, atau percubaan semula rangkaian) pada permohonan SAMA.
//
// Lead pusingan #327: komen kod permohonanEditorRoutes.js baris 81-90 mengaku gerbang
// `if (rekod.status !== 'baharu')` "sendiri terdedah kepada race yang ia cuba elakkan" — tapi
// tak sempat sahkan sama ada ni gap SEBENAR atau dah dibaiki dgn kunci. Bacaan kod (baris 91-96,
// 270-317) tunjuk SELURUH handler (baca rekod -> semak status -> UPDATE -> logAudit -> emel)
// dibungkus `denganKunciKeputusanPermohonanEditor()` — kunci rantaian promise global SAMA corak
// `denganKunciAktifkanPenaja` (permohonanPenajaRoutes.js). Ujian ni hantar DUA POST /keputusan
// (satu 'diterima', satu 'ditolak') SERENTAK (Promise.all) ke permohonan SAMA utk sahkan tingkah
// laku SEBENAR: sepatutnya SATU berjaya (200) DAN SATU ditolak (409 "sudah diterima/ditolak"),
// tiada UPDATE berganda / log audit berganda / emel penolakan berganda.
import { bootServer, bukaDb, dbRun, dbGet, dbAll, ciptaPentadbir, login, buatKlien, pelapor, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5928;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim328.db');
const lapor = pelapor('sim328-keputusan-permohonan-editor-race');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE });
  try {
    await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, 'sim-admin', 'SimUjian!2026');
    const klien = buatKlien(base, cookie);

    // 1. Suntik terus SATU rekod permohonan_editor status='baharu' (langkau borang awam, bukan
    // fokus ujian ni).
    const idPermohonan = 'permohonan-sim328-0001';
    const kini = new Date().toISOString();
    const db = bukaDb(DB_FILE);
    await dbRun(db, `
      INSERT INTO permohonan_editor
        (id, namaPenuh, emel, telefon, negeri, kelulusan, bidangMinat, pengalaman, pautanContoh, motivasi, status, createdAt)
      VALUES (?, 'Sim328 Pemohon', 'sim328@ujian.test', '0123456789', 'Selangor', 'Ijazah Sarjana Muda, UM, 2020', '["Ekonomi"]', '', '', 'Motivasi ujian simulasi sekurang-kurangnya dua puluh aksara panjang.', 'baharu', ?)
    `, [idPermohonan, kini]);
    await new Promise(r => db.close(r));
    lapor.lulus('Persediaan: rekod permohonan_editor disuntik terus pada status baharu');

    // 2. Tembak DUA POST /keputusan SERENTAK (Promise.all — hampir simultan, bukan berturutan)
    // pada permohonan SAMA: satu 'diterima', satu 'ditolak'.
    const [rA, rB] = await Promise.all([
      klien('POST', `/api/system/permohonan-editor/${idPermohonan}/keputusan`, { keputusan: 'diterima', catatan: 'Serentak A' }),
      klien('POST', `/api/system/permohonan-editor/${idPermohonan}/keputusan`, { keputusan: 'ditolak', catatan: 'Serentak B' }),
    ]);
    console.log('  [maklumat] Respons A (diterima):', rA.status, JSON.stringify(rA.json));
    console.log('  [maklumat] Respons B (ditolak):', rB.status, JSON.stringify(rB.json));

    // 3. Semak keadaan DB SEBENAR selepas kedua-dua panggilan siap.
    const db2 = bukaDb(DB_FILE);
    const rekodSelepas = await dbGet(db2, 'SELECT status, catatanSemakan FROM permohonan_editor WHERE id = ?', [idPermohonan]);
    const logs = await dbAll(db2, "SELECT action FROM audit_log WHERE targetId = ? ORDER BY id", [idPermohonan]);
    await new Promise(r => db2.close(r));

    console.log('  [maklumat] rekod selepas:', JSON.stringify(rekodSelepas));
    console.log('  [maklumat] baris log audit bagi permohonan ni:', JSON.stringify(logs));

    const responsOk = [rA, rB].filter(r => r.ok);
    const respons409 = [rA, rB].filter(r => r.status === 409);
    const statusSah = rekodSelepas && ['diterima', 'ditolak'].includes(rekodSelepas.status);

    if (responsOk.length === 1 && respons409.length === 1 && statusSah && logs.length === 1) {
      lapor.lulus(
        `Dikunci betul — SATU permintaan berjaya (status akhir='${rekodSelepas.status}'), SATU lagi ditolak 409 ` +
        `("sudah ${rekodSelepas.status}"), TEPAT SATU baris log audit tercipta. Kunci ` +
        '`denganKunciKeputusanPermohonanEditor` (baris 91-96, membalut seluruh handler baris 270-317) ' +
        'menyerialisasi baca-semak-tulis dgn betul — bukan gap terbuka, komen baris 81-90 huraikan SEBAB kunci ' +
        'tu wujud (bukan gap semasa tanpa kunci).'
      );
    } else if (responsOk.length === 2) {
      lapor.gagal(
        'RACE SEBENAR — KEDUA-DUA permintaan berjaya (200), UPDATE/log audit/emel berganda berlaku ' +
        '(gerbang status!==\'baharu\' terlepas kedua-dua kali) — kunci TIDAK berkesan.',
        `A=${JSON.stringify(rA.json)} B=${JSON.stringify(rB.json)} rekodSelepas=${JSON.stringify(rekodSelepas)} logs=${logs.length}`
      );
    } else {
      lapor.gagal(
        'Keadaan tak dijangka — semak semula andaian ujian',
        `A=${rA.status}/${JSON.stringify(rA.json)} B=${rB.status}/${JSON.stringify(rB.json)} rekodSelepas=${JSON.stringify(rekodSelepas)} logs=${logs.length}`
      );
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
