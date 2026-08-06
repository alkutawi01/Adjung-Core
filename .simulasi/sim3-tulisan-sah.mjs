// SIMULASI 3 — TULISAN SAH BENAR-BENAR SAMPAI KE DB.
//
// SIM 2 memastikan laluan tak lapor kejayaan PALSU. Simulasi ini menutup separuh lagi: bila
// pengguna buat sesuatu yang SAH, adakah ia betul-betul tersimpan? Corak: baca DB sebelum ->
// panggil API -> baca DB selepas -> sahkan perubahan yang DIJANGKA benar-benar berlaku.
//
// Ini menangkap kelas "UI kata tersimpan, DB tak berubah" yang tak dapat dilihat dengan membaca
// kod sahaja — persis pepijat assign-slot yang dilaporkan Izzat.
import path from 'node:path';
import os from 'node:os';
import sqlite3 from 'sqlite3';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, dbAll, dbRun, bukaDb } from './sim-lib.mjs';

const PORT = 5201;
const DBF = path.join(os.tmpdir(), 'sim-adjung-tulis.db');
const lap = pelapor('SIM 3 — TULISAN SAH');

const SVG_IKON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>';
const SVG_PLAT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M8 8h240v240H8z"/></svg>';

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const { username, pass } = await ciptaPentadbir(DBF);
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  // Pembantu: panggil API, kemudian sahkan keadaan DB sebenar.
  const semak = async (label, panggil, sahkan) => {
    const r = await panggil();
    if (!r.ok) { lap.gagal(label, `API tolak: HTTP ${r.status} ${r.teks.slice(0, 160)}`); return; }
    const masalah = await sahkan();
    if (masalah) lap.gagal(label, `API balas 200 TAPI ${masalah}`);
    else lap.lulus(label);
  };

  // ---- Bidang -------------------------------------------------------------------------
  await api('POST', '/api/system/categories/activate', { name: 'Ekonomi', color: '#111111', icon: 'TrendingUp' });
  const bid = await dbGet(db, "SELECT id FROM CategoryRegistry WHERE LOWER(name)='ekonomi'");
  const BID = bid?.id;
  if (!BID) throw new Error('Bidang prasyarat tak tercipta — simulasi tak boleh diteruskan.');

  await semak('set-color menulis warna', () => api('POST', '/api/system/categories/set-color', { id: BID, color: '#ABCDEF' }),
    async () => { const r = await dbGet(db, 'SELECT color FROM CategoryRegistry WHERE id=?', [BID]); return r.color === '#ABCDEF' ? null : `warna DB masih "${r.color}"`; });

  await semak('set-icon menulis ikon', () => api('POST', '/api/system/categories/set-icon', { id: BID, icon: 'Coins' }),
    async () => { const r = await dbGet(db, 'SELECT icon FROM CategoryRegistry WHERE id=?', [BID]); return r.icon === 'Coins' ? null : `ikon DB "${r.icon}"`; });

  await semak('set-icon-svg menulis SVG', () => api('POST', '/api/system/categories/set-icon-svg', { id: BID, svg: SVG_IKON }),
    async () => { const r = await dbGet(db, 'SELECT iconSvg FROM CategoryRegistry WHERE id=?', [BID]); return r.iconSvg ? null : 'iconSvg masih kosong'; });

  await semak('set-illustration-svg menulis plat', () => api('POST', '/api/system/categories/set-illustration-svg', { id: BID, svg: SVG_PLAT }),
    async () => { const r = await dbGet(db, 'SELECT illustrationSvg FROM CategoryRegistry WHERE id=?', [BID]); return r.illustrationSvg ? null : 'illustrationSvg masih kosong'; });

  await semak('clear-illustration-svg membuang plat', () => api('POST', '/api/system/categories/clear-illustration-svg', { id: BID }),
    async () => { const r = await dbGet(db, 'SELECT illustrationSvg FROM CategoryRegistry WHERE id=?', [BID]); return r.illustrationSvg ? 'plat masih ada' : null; });

  await semak('rename-active menukar nama', () => api('POST', '/api/system/categories/rename-active', { id: BID, newName: 'Ekonomi Global' }),
    async () => { const r = await dbGet(db, 'SELECT name FROM CategoryRegistry WHERE id=?', [BID]); return r.name === 'Ekonomi Global' ? null : `nama DB "${r.name}"`; });

  await semak('set-active mengarkibkan', () => api('POST', '/api/system/categories/set-active', { id: BID, isActive: false }),
    async () => { const r = await dbGet(db, 'SELECT isActive FROM CategoryRegistry WHERE id=?', [BID]); return r.isActive === 0 ? null : `isActive=${r.isActive}`; });
  await api('POST', '/api/system/categories/set-active', { id: BID, isActive: true }); // pulihkan

  // ---- assign-slot: SETIAP slot bukan-BAR, termasuk yang tiada baris -------------------
  const BAR = new Set([7, 8, 9, 10, 21, 22, 23, 24]);
  let gagalSlot = [];
  for (let i = 0; i < 38; i++) {
    if (BAR.has(i)) continue;
    const r = await api('POST', '/api/system/categories/assign-slot', { slotIndex: i, bidangName: 'Ekonomi Global' });
    const row = await dbGet(db, "SELECT manualDesk FROM slots_config WHERE layoutTemplateId='frontpage' AND slotIndex=?", [i]);
    if (!r.ok || !row || (row.manualDesk || '').toLowerCase() !== 'ekonomi global') {
      gagalSlot.push(`slot${i + 1}(HTTP${r.status},db=${JSON.stringify(row?.manualDesk)})`);
    }
    await api('POST', '/api/system/categories/assign-slot', { slotIndex: i, bidangName: '' }); // kosongkan semula
  }
  if (gagalSlot.length) lap.gagal('assign-slot pada SEMUA 30 slot bukan-BAR', gagalSlot.join(' '));
  else lap.lulus('assign-slot bertahan pada kesemua 30 slot bukan-BAR');

  // ---- Tetapan sistem & label ---------------------------------------------------------
  await semak('ui-labels menulis label', () => api('POST', '/api/system/ui-labels', { 'status.aktif': 'AktifUjian' }),
    async () => { const r = await dbGet(db, "SELECT value FROM ui_labels WHERE key='status.aktif'"); return r?.value === 'AktifUjian' ? null : `nilai DB ${JSON.stringify(r?.value)}`; });

  await semak('slot-am-settings menulis had', () => api('POST', '/api/system/slot-am-settings', {
    mulaIkutMasa: false, hadKandunganSlot: 7, jenisAnimasi: 'colophon', arahAnimasi: 'kanan',
    hadHuraianPanjang: 0, hadSumber: 0, hadTopik: 0, hadNotaEditor: 0, logoPenaja: '',
    warnaPanelTransisi: '#802334', nisbahPenajaTransisi: 0, focusViewTitleScale: 1, focusViewBodySize: 15,
  }),
    async () => { const r = await dbGet(db, 'SELECT hadKandunganSlot FROM slot_am_settings LIMIT 1'); return Number(r?.hadKandunganSlot) === 7 ? null : `DB=${JSON.stringify(r)}`; });

  await semak('pages menulis halaman', () => api('POST', '/api/pages/syarat-editor', { title: 'Syarat Ujian', content: '# Ujian' }),
    async () => { const r = await dbGet(db, "SELECT title FROM static_pages WHERE key='syarat-editor'"); return r?.title === 'Syarat Ujian' ? null : `DB=${JSON.stringify(r)}`; });

  // ---- Rujukan editorial --------------------------------------------------------------
  await semak('ejaan menulis entri', () => api('POST', '/api/system/ejaan', { betul: 'kerana', elakkan: 'kerena' }),
    async () => { const r = await dbGet(db, "SELECT betul FROM ejaan_piawai WHERE betul='kerana'"); return r ? null : 'tiada baris ejaan_piawai'; });

  await semak('glosari menulis entri', () => api('POST', '/api/system/glosari', { istilah: 'pautan', elakkan: 'link' }),
    async () => { const r = await dbGet(db, "SELECT istilah FROM glosari_istilah WHERE istilah='pautan'"); return r ? null : 'tiada baris glosari_istilah'; });

  // ---- Penaja & nota ------------------------------------------------------------------
  await semak('sponsors mencipta penaja', () => api('POST', '/api/system/sponsors', { nama: 'Penaja Ujian', bulan: '2026-08', jumlahBayaran: 100 }),
    async () => { const r = await dbGet(db, "SELECT name FROM sponsors WHERE name='Penaja Ujian'"); return r ? null : 'tiada baris sponsors'; });

  await semak('editor-notes mencipta nota', () => api('POST', '/api/system/editor-notes', { tajuk: 'Nota Ujian', kandungan: 'Isi', kategori: 'am', skop: 'dalaman' }),
    async () => { const r = await dbGet(db, "SELECT title FROM editor_notes WHERE title='Nota Ujian'"); return r ? null : 'tiada baris editor_notes'; });

  // ---- Slot editors -------------------------------------------------------------------
  await semak('slot-editors menugaskan editor', () => api('POST', '/api/system/slot-editors', { slotIndex: 2, editorIds: ['sim-admin'] }),
    async () => { const r = await dbGet(db, 'SELECT editorId FROM slot_editors WHERE slotIndex=2'); return r?.editorId === 'sim-admin' ? null : `DB=${JSON.stringify(r)}`; });

  // ---- Dasar terbit sendiri -----------------------------------------------------------
  await semak('editor-publish-policy menulis dasar', () => api('PATCH', '/api/system/editor-publish-policy', { benarkanSelfPublish: false }),
    async () => {
      const r = await dbGet(db, "SELECT rolePermissions FROM system_settings WHERE id='settings-main'");
      const m = JSON.parse(r?.rolePermissions || '[]');
      const ed = Array.isArray(m) ? m.find(x => x.roleId === 'editor') : null;
      return ed && ed.permissions?.publish === false ? null : `matriks tak menunjukkan publish=false (${JSON.stringify(ed?.permissions?.publish)})`;
    });

  // ---- Tier settings ------------------------------------------------------------------
  await semak('tier-settings menulis pindaan', () => api('POST', '/api/system/tier-settings', { tierKey: 'KOMPAK', maxTitleAlone: 70, maxBriefAlone: 30 }),
    async () => { const r = await dbGet(db, "SELECT maxTitleAlone FROM tier_settings WHERE tierKey='KOMPAK'"); return Number(r?.maxTitleAlone) === 70 ? null : `DB=${JSON.stringify(r)}`; });

  await new Promise(r => db.close(r));
} finally {
  srv.proc.kill();
}

const penemuan = lap.ringkasan();
process.exit(penemuan.length ? 1 : 0);
