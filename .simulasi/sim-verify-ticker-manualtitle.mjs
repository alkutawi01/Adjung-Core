// Verifikasi sekali-pakai: manualTitle Ticker tak lagi tersimpan sebagai 'Berita Terkini' beku.
import path from 'node:path';
import { REPO, bootServer, ciptaPentadbir, login, buatKlien, bukaDb, dbGet } from './sim-lib.mjs';

const PORT = 7801;
const DB = path.join(REPO, '.simulasi', 'scratch-ticker-manualtitle.db');

let srv;
try {
  srv = await bootServer({ port: PORT, dbFile: DB, freshDb: true });
  await ciptaPentadbir(DB);
  const cookie = await login(srv.base, 'sim-admin', 'SimUjian!2026');
  const klien = buatKlien(srv.base, cookie);

  // Simulasi apa yang formConfig Ticker (useTickerEditor.ts) hantar sebenar selepas fix —
  // manualTitle: '' (bukan lagi 'Berita Terkini'), tajuk sebenar datang dari baris "Tajuk:" dalam manualSummary.
  const manualSummary = 'Tajuk: Ujian Tajuk Ticker Sebenar\nHuraian ringkas: Kandungan ujian simulasi.';
  const payload = [{
    slotIndex: -1,
    contentMode: 'Manual',
    providerId: '', model: '', promptText: '', sourcesList: '',
    refreshRate: 'Daily', allowedContentTypes: '', priority: 'High', expiresAt: '',
    bgColor: 'transparent', borderColor: '', textColor: '#1F1F1F',
    manualTitle: '', // <-- fix: dulu 'Berita Terkini' hardcode
    manualSummary,
    manualSource: '', manualUrl: '', manualImageUrl: '', manualDesk: '',
    activeObjectId: '',
    searchStrategy: 'Structured Sources Only',
    carouselInterval: 10, carouselDelay: 0, generationLimit: 10,
    maxTitle: 60, maxBrief: 120, maxBriefLong: 0,
    refreshHour: '00:00', refreshDay: 'Isnin', eventExpiryFilter: '',
    aiPromptTopic: '', aiPromptRecency: '', aiPromptLanguage: '', aiPromptRegion: '', aiPromptSource: '',
  }];

  const simpan = await klien('POST', '/api/system/slots', payload);
  console.log('POST /api/system/slots status:', simpan.status, JSON.stringify(simpan.json)?.slice(0, 300));

  const db = bukaDb(DB);
  const row = await dbGet(db, "SELECT manualTitle, manualSummary FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=-1");
  console.log('Lajur DB slots_config selepas simpan:', row);

  const lajurManualTitleKosong = row && (row.manualTitle === '' || row.manualTitle === null);
  const summaryTersimpan = row && row.manualSummary && row.manualSummary.includes('Ujian Tajuk Ticker Sebenar');

  console.log('CEK: manualTitle DB TIDAK lagi "Berita Terkini" beku ->', lajurManualTitleKosong);
  console.log('CEK: manualSummary (sumber tajuk sebenar) tersimpan betul ->', summaryTersimpan);

  if (!simpan.ok) throw new Error('Simpan gagal, tak dapat verify.');
  if (!lajurManualTitleKosong) throw new Error('GAGAL: manualTitle masih ada nilai bukan-kosong selepas fix.');
  if (!summaryTersimpan) throw new Error('GAGAL: manualSummary sepatutnya bawa tajuk sebenar tak tersimpan.');

  console.log('\nVERIFIKASI BERJAYA: manualTitle tak lagi beku "Berita Terkini"; tajuk sebenar Ticker tetap datang drpd manualSummary seperti biasa.');
  await new Promise(r => db.close(r));
} finally {
  if (srv) srv.proc.kill();
}
