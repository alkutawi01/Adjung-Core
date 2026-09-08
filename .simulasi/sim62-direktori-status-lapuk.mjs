// sim62 — bukti sokongan pembetulan DirektoriConsole.tsx (2026-09-09): medan Dasar Aktif
// (tertaklukDasarAktif/hariTakAktif/tahapAmaran) daripada GET /api/system/users BERUBAH bila
// `status` seorang anggota ditukar (PATCH /users/:id/status), tapi ProfilAnggotaModal.ubahStatus()
// sebelum pembetulan cuma kemaskini `status` secara optimistik tanpa segarkan medan lain — sim ni
// tak boleh jalankan React terus (bukan persekitaran DOM), jadi ia mengesahkan tanggapan asas fix
// tu terus terhadap HTTP API sebenar: buktikan GET /users SEBELUM tukar status vs SELEPAS tukar
// status memang pulangkan nilai BERBEZA untuk medan Dasar Aktif, supaya jelas kenapa optimistic
// update `{ ...staff, status }` sahaja (tanpa muat semula) mesti tinggalkan data lapuk.
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbRun, bukaDb, hashPassword, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5962;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim62.db');
const lapor = pelapor('sim62-direktori-status-lapuk');

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const klien = buatKlien(base, cookie);

    // Semai satu editor 'Aktif' yang SUDAH tak aktif 30 hari (melepasi ambang notisPenamatan
    // lalai 21 hari) dan amaranTakAktifTahap=3 (sudah pun digantung logik-nya walau status DB
    // kekal 'Aktif' buat ujian ni — cukup untuk uji pengiraan tertaklukDasarAktif/hariTakAktif).
    const db = bukaDb(DB_FILE);
    const now = new Date();
    const lamaDahulu = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await dbRun(db, `INSERT INTO users (id, username, email, penName, role, password, status, isSuspended, amaranTakAktifTahap, lastPublishedAt, createdAt, updatedAt)
      VALUES ('sim62-editor','sim62ed','sim62ed@sim.test','Editor Sim62','EDITOR',?,'Aktif',0,3,?,?,?)`,
      [hashPassword('SimEditor!2026'), lamaDahulu, lamaDahulu, lamaDahulu]);
    await dbRun(db, `INSERT INTO user_roles (userId, roleId) VALUES ('sim62-editor','editor')`);
    await new Promise(r => db.close(r));

    // 1) SEBELUM tukar status — editor masih 'Aktif', tertaklukDasarAktif MESTI true, hariTakAktif
    //    MESTI ~30, tahapAmaran MESTI 3 (papar lencana "Digantung (tidak aktif)" di Direktori).
    const rSebelum = await klien('GET', '/api/system/users');
    const uSebelum = (rSebelum.json || []).find(u => u.id === 'sim62-editor');
    if (!uSebelum) { lapor.gagal('Persediaan: editor sim62 tak dijumpai dalam GET /users', JSON.stringify(rSebelum.json)); process.exitCode = 1; return; }
    console.log('  [maklumat] SEBELUM:', JSON.stringify({ tertaklukDasarAktif: uSebelum.tertaklukDasarAktif, hariTakAktif: uSebelum.hariTakAktif, tahapAmaran: uSebelum.tahapAmaran }));
    if (uSebelum.tertaklukDasarAktif === true && uSebelum.hariTakAktif >= 29 && uSebelum.tahapAmaran === 3) {
      lapor.lulus('Persediaan sahih: editor Aktif tak-aktif-30-hari papar tertaklukDasarAktif=true, hariTakAktif~30, tahapAmaran=3');
    } else {
      lapor.gagal('Persediaan tak sepadan jangkaan', JSON.stringify(uSebelum));
    }

    // 2) Pentadbir tukar status ke 'Cuti' (Ketua Editor letak cuti sementara, BUKAN 'Ditamatkan')
    //    — ProfilAnggotaModal.ubahStatus() klien guna laluan ni.
    const rTukar = await klien('PATCH', '/api/system/users/sim62-editor/status', { status: 'Cuti' });
    if (!rTukar.ok) { lapor.gagal('PATCH status ke Cuti gagal', JSON.stringify(rTukar.json)); process.exitCode = 1; return; }
    lapor.lulus('PATCH /users/:id/status -> Cuti berjaya (200)');

    // 3) SELEPAS tukar status — status='Cuti' bermakna tertaklukDasarAktif() (userAdminRoutes.js
    //    ~baris 175, `u.status === 'Aktif' && ...`) MESTI jatuh ke FALSE serta-merta — pelayan
    //    TIDAK PERNAH pulangkan hariTakAktif/tahapAmaran utk akaun Cuti walau amaranTakAktifTahap
    //    mentah dalam DB kekal 3 (sengaja tak direset di sini, cuma disembunyikan bila tak
    //    'Aktif' — lihat komen kod).
    const rSelepas = await klien('GET', '/api/system/users');
    const uSelepas = (rSelepas.json || []).find(u => u.id === 'sim62-editor');
    console.log('  [maklumat] SELEPAS (dari GET /users sebenar):', JSON.stringify({ status: uSelepas.status, tertaklukDasarAktif: uSelepas.tertaklukDasarAktif, hariTakAktif: uSelepas.hariTakAktif, tahapAmaran: uSelepas.tahapAmaran }));
    if (uSelepas.status === 'Cuti' && uSelepas.tertaklukDasarAktif === false && uSelepas.hariTakAktif === null) {
      lapor.lulus('SAHIH: GET /users SELEPAS tukar status memang pulangkan tertaklukDasarAktif=false/hariTakAktif=null berbeza drpd SEBELUM — mengesahkan onUpdated({...staff,status}) optimistik SAHAJA (tanpa muat semula) mesti tinggalkan lencana/hari lapuk di UI Direktori sehingga muatSemula() dipanggil');
    } else {
      lapor.gagal('SELEPAS tak sepadan jangkaan (server tak ubah medan Dasar Aktif macam disangka)', JSON.stringify(uSelepas));
    }

    // 4) Cerminkan tepat apa `kemaskiniStaff({ ...staff, status })` (optimistic, TANPA muat
    //    semula) akan tinggalkan pada state React klien — nilai LAMA (uSebelum) ditampal status
    //    baharu sahaja, dibandingkan dgn kebenaran sebenar pelayan (uSelepas).
    const optimistikSahaja = { ...uSebelum, status: 'Cuti' };
    const berbeza = optimistikSahaja.tertaklukDasarAktif !== uSelepas.tertaklukDasarAktif
      || optimistikSahaja.hariTakAktif !== uSelepas.hariTakAktif
      || optimistikSahaja.tahapAmaran !== uSelepas.tahapAmaran;
    if (berbeza) {
      lapor.lulus('BUG DISAHKAN (sebelum fix): state optimistik `{...staff, status}` SAHAJA (tanpa muatSemula) akan papar tertaklukDasarAktif/hariTakAktif/tahapAmaran BERBEZA drpd kebenaran pelayan sebenar -- justifikasi pembetulan onSegarkanSenarai() dalam DirektoriConsole.tsx');
    } else {
      lapor.gagal('Tak dapat sahkan percanggahan (patut berbeza)', JSON.stringify({ optimistikSahaja, uSelepas }));
    }

    const penemuan = lapor.ringkasan();
    process.exitCode = penemuan.length ? 1 : 0;
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
