// SIMULASI 149 — Permohonan Penaja: tindakan 'minta_maklumat' WAJIB cuba hantar e-mel kepada
// pemohon (dapatan bug-hunt 2026-09-09). Sebelum fix, 'tolak' dan 'lulus' hantar e-mel tapi
// 'minta_maklumat' senyap — catatanDalaman cuma dibaca PenajaConsole.tsx (admin), pemohon
// penaja SENGAJA tiada akaun/log masuk (lihat komen fail permohonanPenajaRoutes.js), jadi
// tiada e-mel = pemohon tak tahu langsung status berubah atau maklumat apa diperlukan.
//
// Pendekatan pengesahan: bootServer() jalankan server.js dalam SUBPROCESS berasingan (lihat
// sim-lib.mjs), jadi tak boleh monkey-patch modul MailSender.js terus dari skrip ni. Sebaliknya
// tetapkan RESEND_API_KEY PALSU (subprocess warisi env ni) — hantarEmel() cuba panggilan
// rangkaian SEBENAR ke Resend, ditolak 401 (kunci tak sah), dan mencetak
// "Gagal menghantar emel: Resend API 401..." ke log server. Kehadiran baris log ni SELEPAS
// tindakan 'minta_maklumat' membuktikan hantarEmel() DIPANGGIL (walau gagal auth) — sebelum
// fix, tiada baris log emel langsung utk tindakan ni.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor } from './sim-lib.mjs';

const PORT = 5249;
const DBF = path.join(os.tmpdir(), 'sim-adjung-penaja-minta-maklumat.db');
const lap = pelapor('SIM 149 — PENAJA MINTA MAKLUMAT E-MEL');

process.env.RESEND_API_KEY = 'sim149_kunci_palsu_untuk_uji_panggilan';

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);

  const emelPemohon = 'pemohon-sim149@example.test';
  const rBorang = await fetch(srv.base + '/api/public/permohonan-penaja', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jenisPemohon: 'individu', namaSebenar: 'Pemohon Ujian Sim149', emel: emelPemohon,
      pilihanPaparan: 'nama', aktivitiUtama: '',
    }),
  }).then(async (r) => ({ ok: r.ok, status: r.status, json: await r.json().catch(() => null) }));
  if (!rBorang.ok || !rBorang.json?.id) throw new Error('Hantar borang gagal: ' + rBorang.status + ' ' + JSON.stringify(rBorang.json));
  const id = rBorang.json.id;
  lap.lulus('Permohonan penaja dicipta: ' + id);

  const logSebelum = srv.dapatLog().length;

  const rKeputusan = await api('PATCH', `/api/system/permohonan-penaja/${id}/keputusan`, {
    tindakan: 'minta_maklumat', catatan: 'Sila sertakan salinan pendaftaran organisasi.',
  });
  if (!rKeputusan.ok) throw new Error('PATCH keputusan gagal: ' + rKeputusan.status + ' ' + rKeputusan.teks);
  lap.lulus('PATCH .../keputusan (minta_maklumat) berjaya, status ditukar');

  // Beri masa panggilan rangkaian async (fetch ke Resend) sempat selesai + tercetak ke log.
  await new Promise((r) => setTimeout(r, 2500));
  const logBaharu = srv.dapatLog().slice(logSebelum);

  if (/Gagal menghantar emel: Resend API/.test(logBaharu)) {
    lap.lulus('hantarEmel() DIPANGGIL selepas tindakan minta_maklumat (percubaan Resend direkodkan dalam log, ditolak 401 sebab kunci ujian palsu — itu dijangka)');
  } else {
    lap.gagal('KRITIKAL: hantarEmel() TIDAK dipanggil untuk tindakan minta_maklumat — pemohon tiada notis langsung', logBaharu.slice(-1500));
  }
} finally {
  srv.proc.kill();
  const penemuan = lap.ringkasan();
  process.exit(penemuan.length > 0 ? 1 : 0);
}
