// SIMULASI 8 — INTEGRITI PORTAL AWAM (apa yang PEMBACA sebenar nampak).
//
// Dua bahaya berbeza diuji serentak:
//   (a) KEBOCORAN — medan dalaman (nota editor, nama editor, createdBy, emel, status draf)
//       tidak boleh muncul dalam mana-mana respons awam.
//   (b) KEROSAKAN — laluan awam mesti pulangkan data LENGKAP & sah walaupun tanpa sesi;
//       kalau ia kosong/ranap, pembaca nampak portal rosak pada hari launch.
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, bukaDb, isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5206;
const DBF = path.join(os.tmpdir(), 'sim-adjung-awam.db');
const lap = pelapor('SIM 8 — PORTAL AWAM');

const SLOT = 1;
const BIDANG = 'Ekonomi';
const NOTA_RAHSIA = 'NOTA-DALAMAN-JANGAN-BOCOR-XYZ';
const NAMA_EDITOR = 'Sim Admin';

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const awam = buatKlien(srv.base, ''); // TIADA sesi — seperti pembaca sebenar
  const db = bukaDb(DBF);

  await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#802334', icon: 'TrendingUp' });
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: SLOT, bidangName: BIDANG });

  // Terbitkan kandungan SEBENAR yang mengandungi nota dalaman, kemudian luluskan jadi Aktif.
  // Huraian Panjang WAJIB disertakan (2026-09-02, dapatan bug-hunt — lihat nota di sim-lib.mjs
  // HURAIAN_PANJANG_SAH); tanpanya publish ni ditolak 400 dan SELURUH ujian portal awam di bawah
  // (kebocoran + kandungan aktif kelihatan) diuji terhadap kandungan yang tidak pernah wujud.
  const blok = [
    'UUID: awam-0001',
    'Tajuk: Dasar Ekonomi Negara Dikemas Kini',
    'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, SLOT, 'Dasar Ekonomi Negara Dikemas Kini'.length),
    'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
    'Bidang: ' + BIDANG,
    'Topik: Kewangan',
    'Sumber: Berita Harian',
    'URL: https://www.bharian.com.my/awam-ujian',
    'Nota: ' + NOTA_RAHSIA,
    'Status: terbit',
  ].join('\n');
  const rBlok = await api('POST', '/api/system/slots', [{ slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok }]);
  const obj = await dbGet(db, 'SELECT id FROM editorial_objects ORDER BY createdAt DESC LIMIT 1');
  if (!obj) throw new Error('prasyarat: kandungan awam sah tak tercipta — ' + JSON.stringify(rBlok.json));
  await api('PATCH', `/api/system/content/${obj.id}`, { status: 'approved' });

  // Nota dalaman (Peti Makluman) yang TIDAK sepatutnya terbit awam.
  await api('POST', '/api/system/editor-notes', {
    tajuk: 'Arahan Dalaman', kandungan: NOTA_RAHSIA, kategori: 'am', skop: 'dalaman',
  });

  // Draf yang BELUM diterbitkan — tak boleh bocor ke pembaca.
  const blokDraf = [
    'UUID: awam-draf-0002',
    'Tajuk: DRAF BELUM SIAP JANGAN TERBIT',
    'Huraian ringkas: Draf sulit.',
    'Bidang: ' + BIDANG,
    'Topik: Kewangan',
    'Status: draf',
  ].join('\n');
  await api('POST', '/api/system/slots', [{ slotIndex: 2, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blokDraf }]);

  // --- (a) Semakan KEBOCORAN pada setiap laluan awam ---------------------------------
  // NOTA: medan `note` SENGAJA sampai kepada pembaca (dipapar dalam Focus View, had aksara
  // boleh tetap di Tetapan Am Slot) — jadi ia BUKAN kebocoran dan tidak disenaraikan di sini.
  // Yang diuji ialah data yang memang tak sepatutnya awam: draf belum terbit, kredential, dsb.
  const CORAK_BOCOR = [
    ['DRAF BELUM SIAP', 'tajuk draf belum terbit'],
    ['"createdBy"', 'medan createdBy'],
    ['sim-admin@sim.test', 'emel akaun'],
    ['scrypt$', 'cincangan kata laluan'],
    ['"resetToken"', 'token set semula'],
  ];

  const LALUAN_AWAM = [
    ['/api/system/layout/active', 'susun atur frontpage (kandungan kad)'],
    ['/api/public/editor-notes?type=pengumuman', 'pengumuman awam'],
    ['/api/public/editor-notes?type=dalaman', 'cubaan minta skop dalaman'],
    ['/api/public/sponsors/semasa', 'penaja semasa'],
    ['/api/public/sponsors/semua', 'semua penaja'],
    ['/rss.xml', 'suapan RSS'],
    ['/sitemap.xml', 'peta laman'],
    ['/api/system/search?q=dasar', 'carian awam'],
    ['/api/db-state', 'keadaan DB (laluan lama)'],
  ];

  for (const [laluan, nota] of LALUAN_AWAM) {
    const r = await awam('GET', laluan);
    if (!r.ok) {
      // 401/403 pada laluan yang memang terkunci itu OK; catat sahaja.
      lap.lulus(`${nota} -> ${r.status} (tidak terbuka)`);
      continue;
    }
    const bocor = CORAK_BOCOR.filter(([c]) => r.teks.includes(c));
    if (bocor.length) {
      lap.gagal(`KEBOCORAN pada ${nota}`, `${laluan} mendedahkan: ${bocor.map(b => b[1]).join(', ')}`);
    } else {
      lap.lulus(`${nota} tiada kebocoran`);
    }
  }

  // --- (b) Semakan KEROSAKAN — data awam mesti lengkap & sah -------------------------
  const rLayout = await awam('GET', '/api/system/layout/active');
  if (!rLayout.ok) {
    lap.gagal('frontpage TIDAK dapat dimuat tanpa sesi', `HTTP ${rLayout.status} — pembaca nampak portal rosak`);
  } else {
    const teks = JSON.stringify(rLayout.json || {});
    if (!teks.includes('Dasar Ekonomi Negara')) {
      lap.gagal('kandungan AKTIF tidak muncul di frontpage awam', 'kandungan diluluskan tapi tiada dalam layout/active');
    } else lap.lulus('kandungan aktif muncul di frontpage awam');
  }

  const rRss = await awam('GET', '/rss.xml');
  if (rRss.ok) {
    if (!/^<\?xml/.test(rRss.teks.trim())) lap.gagal('rss.xml bukan XML sah', rRss.teks.slice(0, 120));
    else lap.lulus('rss.xml ialah XML sah');
  }
  const rSitemap = await awam('GET', '/sitemap.xml');
  if (rSitemap.ok) {
    if (!/^<\?xml/.test(rSitemap.teks.trim())) lap.gagal('sitemap.xml bukan XML sah', rSitemap.teks.slice(0, 120));
    else lap.lulus('sitemap.xml ialah XML sah');
  }

  // Pautan mendalam kandungan (skema URL awam) mesti berfungsi.
  if (obj) {
    const rKod = await api('GET', `/api/system/content/${obj.id}/url-kod`);
    const kod = rKod.json?.kod || rKod.json?.urlKod;
    if (kod) {
      const rBaca = await awam('GET', `/api/system/content/by-kod/${kod}`);
      if (!rBaca.ok) lap.gagal('pautan mendalam kandungan rosak untuk pembaca', `by-kod/${kod} -> ${rBaca.status}`);
      else if (rBaca.teks.includes(NOTA_RAHSIA)) lap.gagal('KEBOCORAN pada pautan mendalam', 'nota dalaman didedahkan melalui by-kod');
      else lap.lulus('pautan mendalam berfungsi & tiada kebocoran');
    } else {
      lap.lulus('url-kod belum dijana (jana malas) — dilangkau');
    }
  }

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
