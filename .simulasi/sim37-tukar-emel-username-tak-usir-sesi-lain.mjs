// Sim 37 — change-username/change-email TAK batalkan sesi LAIN akaun yang sama, tak macam
// change-password/reset-password (authRoutes.js) yang eksplisit usir sesi lain sebagai langkah
// keselamatan ("kalau penceroboh sudah log masuk..."). Kalau penceroboh sudah pegang sesi sah
// (kuki dicuri, dsb.) dan pemilik akaun tukar emel/username sebagai langkah pemulihan (tanpa
// tukar kata laluan serentak), sesi penceroboh SEPATUTNYA turut diusir mengikut falsafah sedia
// ada -- tapi sebelum pembetulan ni ia kekal sah sehingga tamat tempoh sendiri (12 jam).
import { bootServer, ciptaPentadbir, login, buatKlien } from './sim-lib.mjs';
import path from 'node:path';
import os from 'node:os';

const PORT = 8949;
const dbFile = path.join(os.tmpdir(), `sim37-${Date.now()}.db`);

async function main() {
  const server = await bootServer({ port: PORT, dbFile });
  try {
    const { username, pass } = await ciptaPentadbir(dbFile);

    // Dua "peranti" log masuk akaun SAMA -- kuki A ialah pemilik sah, kuki B wakil sesi
    // penceroboh yang sudah pegang kuki sah lebih awal.
    const kukiPemilik = await login(server.base, username, pass);
    const kukiPenceroboh = await login(server.base, username, pass);
    const klienPemilik = buatKlien(server.base, kukiPemilik);
    const klienPenceroboh = buatKlien(server.base, kukiPenceroboh);

    const semakAwal = await klienPenceroboh('GET', '/api/system/users');
    console.log('Sesi penceroboh sah sebelum apa-apa:', semakAwal.status);

    // Pemilik sah tukar EMEL sendiri sebagai langkah pemulihan (tanpa tukar kata laluan).
    const tukarEmel = await klienPemilik('POST', '/api/auth/change-email', {
      currentPassword: pass, newEmail: 'pemilik-baharu@sim.test',
    });
    console.log('POST change-email (pemilik):', tukarEmel.status, JSON.stringify(tukarEmel.json));

    const selepasTukarEmel = await klienPenceroboh('GET', '/api/system/users');
    console.log('Sesi penceroboh selepas pemilik tukar emel:', selepasTukarEmel.status);

    let lulus = true;
    if (selepasTukarEmel.status === 401) {
      console.log('OK: sesi penceroboh diusir selepas emel ditukar.');
    } else {
      console.log('GAGAL: sesi penceroboh MASIH SAH selepas emel ditukar.');
      lulus = false;
    }

    // Sesi PEMILIK sendiri mesti KEKAL sah (tak sepatutnya log keluar sendiri).
    const pemilikSelepas = await klienPemilik('GET', '/api/system/users');
    console.log('Sesi PEMILIK sendiri selepas tukar emel:', pemilikSelepas.status);
    if (pemilikSelepas.status === 401) {
      console.log('GAGAL: pemilik sendiri log keluar akibat tindakannya sendiri.');
      lulus = false;
    }

    // Ulang ujian yang sama untuk change-username.
    const kukiPenceroboh2 = await login(server.base, username, pass);
    const klienPenceroboh2 = buatKlien(server.base, kukiPenceroboh2);
    const tukarUsername = await klienPemilik('POST', '/api/auth/change-username', {
      currentPassword: pass, newUsername: username + '-baharu',
    });
    console.log('POST change-username (pemilik):', tukarUsername.status, JSON.stringify(tukarUsername.json));
    const selepasTukarUsername = await klienPenceroboh2('GET', '/api/system/users');
    console.log('Sesi penceroboh 2 selepas pemilik tukar username:', selepasTukarUsername.status);
    if (selepasTukarUsername.status === 401) {
      console.log('OK: sesi penceroboh 2 diusir selepas username ditukar.');
    } else {
      console.log('GAGAL: sesi penceroboh 2 MASIH SAH selepas username ditukar.');
      lulus = false;
    }

    process.exitCode = lulus ? 0 : 1;
  } finally {
    server.proc.kill();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
