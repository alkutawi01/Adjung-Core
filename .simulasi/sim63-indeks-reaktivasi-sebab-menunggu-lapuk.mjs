// sim63 — bukti sokongan pembetulan IndeksConsole.tsx handleReactivate() (2026-09-09): PATCH
// "Siarkan Semula" pada kandungan archived boleh pulangkan slotPenuh=true (slot sasaran dah
// penuh, kandungan MENDARAT 'pending' bertanda sebabMenunggu='slot_penuh' di server, BUKAN
// terus 'approved') — sebelum pembetulan, optimistic update client cuma tampal `status:'Pending'`
// tanpa turut segarkan `sebabMenunggu`, jadi rekod React lama kekal bawa sebabMenunggu LAMA
// (kosong, sebab rekod tu 'Archive' sebelum ni) sehingga muat semula penuh — baris Indeks
// (labelSebabMenunggu()) dan kiraan statusCounts.PendingSemakan/PendingSlotPenuh (IndeksConsole.tsx
// ~baris 541-542, tapis terus guna `sebabMenunggu`) tersilap kelaskan kandungan yang SUDAH lulus
// (cuma tunggu slot) sebagai "belum disemak Ketua Editor".
//
// Sim ni tak boleh jalankan React (bukan persekitaran DOM) — ia mengesahkan tanggapan ASAS fix tu
// terus terhadap HTTP API sebenar: buktikan respons PATCH reaktivasi (slotPenuh:true) dan GET
// /content/all SELEPAS memang pulangkan sebabMenunggu='slot_penuh', supaya jelas kenapa
// `{...i, status:'Pending'}` sahaja (tanpa sebabMenunggu) mesti tinggalkan data lapuk sepadan corak
// sim62 (Direktori) yang dibaiki pusingan sebelum ni.
import path from 'node:path';
import {
  bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, bukaDb,
  isiHuraianCukup, HURAIAN_PANJANG_SAH, REPO,
} from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5963;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim63.db');
const lapor = pelapor('sim63-indeks-reaktivasi-sebab-menunggu-lapuk');
const SLOT = 1; // tier MENEGAK, ada huraian
const BIDANG = 'Sukan';

async function utama() {
  const { proc, base } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const { username, pass } = await ciptaPentadbir(DB_FILE);
    const cookie = await login(base, username, pass);
    const api = buatKlien(base, cookie);
    const db = bukaDb(DB_FILE);

    await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#802334', icon: 'Trophy' });
    await api('POST', '/api/system/categories/assign-slot', { slotIndex: SLOT, bidangName: BIDANG });

    // Slot dihadkan 1 kandungan aktif serentak.
    const amSet = await api('POST', '/api/system/slot-am-settings', {
      mulaIkutMasa: false, hadKandunganSlot: 1, jenisAnimasi: 'colophon', arahAnimasi: 'kanan',
      hadHuraianPanjang: 0, hadSumber: 0, hadTopik: 0, hadNotaEditor: 0,
      hadHuraianPanjangMin: 0, hadSumberMin: 0, hadTopikMin: 0, hadNotaEditorMin: 0, logoPenaja: '',
      warnaPanelTransisi: '#802334', nisbahPenajaTransisi: 0, focusViewTitleScale: 1, focusViewBodySize: 15,
      petikanTempohPutaranSaat: 10, petikanKuantitiHarianMaksimum: 12,
      carouselJedaPertama: 15, carouselTempohLalai: 10, hadJamRotasiSlotPenuh: 24,
    });
    if (!amSet.ok) { lapor.gagal('slot-am-settings gagal ditetapkan', JSON.stringify(amSet.json)); process.exitCode = 1; return; }

    // Kandungan A — terbit terus (Ketua Editor self-publish), mengisi satu-satunya ruang slot.
    const blokA = [
      'UUID: sim63-a', 'Tajuk: Kandungan A Mengisi Slot',
      'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, SLOT, 'Kandungan A Mengisi Slot'.length),
      'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
      'Bidang: ' + BIDANG, 'Topik: Bola Sepak', 'Sumber: Berita Harian',
      'URL: https://www.bharian.com.my/sim63-a', 'Tarikh sumber: 2026-09-01', 'Status: terbit',
    ].join('\n');
    const rA = await api('POST', '/api/system/slots', [{ slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blokA }]);
    if (!rA.ok) { lapor.gagal('Terbit Kandungan A', JSON.stringify(rA.json)); process.exitCode = 1; return; }
    const objA = await dbGet(db, "SELECT id FROM editorial_objects WHERE slotIndex = ? ORDER BY createdAt DESC LIMIT 1", [SLOT]);

    // Kandungan B — terbit lalu terus diarkib (mensimulasikan kandungan lama yg pernah aktif,
    // kini nak "Siarkan Semula" ke slot yang SEKARANG sudah dipenuhi A).
    const blokB = [
      'UUID: sim63-b', 'Tajuk: Kandungan B Untuk Diarkib Dahulu',
      'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, SLOT, 'Kandungan B Untuk Diarkib Dahulu'.length),
      'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
      'Bidang: ' + BIDANG, 'Topik: Badminton', 'Sumber: Utusan',
      'URL: https://utusan.test/sim63-b', 'Tarikh sumber: 2026-09-01', 'Status: terbit',
    ].join('\n');
    // Slot dikosongkan sekejap (tukar had sementara ke 0) supaya B boleh terbit serentak dgn A,
    // sebelum dikembalikan ke had=1 dan B diarkibkan — mengelak B sendiri kena 'pending' sejak awal.
    await api('POST', '/api/system/slot-am-settings', { ...amSet.json, hadKandunganSlot: 0 });
    const rB = await api('POST', '/api/system/slots', [{ slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blokB }]);
    if (!rB.ok) { lapor.gagal('Terbit Kandungan B', JSON.stringify(rB.json)); process.exitCode = 1; return; }
    const objB = await dbGet(db, "SELECT id FROM editorial_objects WHERE slotIndex = ? AND id != ? ORDER BY createdAt DESC LIMIT 1", [SLOT, objA.id]);
    await api('POST', '/api/system/slot-am-settings', amSet.json); // had=1 semula

    const rArkibB = await api('PATCH', `/api/system/content/${objB.id}`, { status: 'archived' });
    if (!rArkibB.ok) { lapor.gagal('Arkibkan Kandungan B', JSON.stringify(rArkibB.json)); process.exitCode = 1; return; }
    lapor.lulus('Persediaan: A aktif mengisi slot (had=1), B diarkibkan');

    // "Siarkan Semula" B ke slot SAMA (dah penuh dgn A) — laluan SEBENAR handleReactivate()
    // (IndeksConsole.tsx): PATCH {status:'approved', desk, topik, slotIndex}.
    const rReaktivasi = await api('PATCH', `/api/system/content/${objB.id}`, {
      status: 'approved', desk: BIDANG, topik: 'Badminton', slotIndex: SLOT,
    });
    if (!rReaktivasi.ok) { lapor.gagal('PATCH Siarkan Semula B', JSON.stringify(rReaktivasi.json)); process.exitCode = 1; return; }

    if (rReaktivasi.json.slotPenuh === true && rReaktivasi.json.status === 'pending') {
      lapor.lulus('SAHIH: reaktivasi ke slot penuh pulangkan slotPenuh=true, status="pending" — client MESTI papar "Menunggu (Slot Penuh)", bukan "Menunggu Semakan"');
    } else {
      lapor.gagal('Respons reaktivasi tak sepadan jangkaan (slot patut penuh)', JSON.stringify(rReaktivasi.json));
    }

    // Kebenaran pelayan (dibaca GET /content/all, medan sama yang diisi IndeksConsole.tsx muat())
    // MESTI sebabMenunggu='slot_penuh' — inilah nilai yang optimistic patch BAHARU (sebabMenunggu:
    // body.slotPenuh ? 'slot_penuh' : '') mesti sepadan, dan yang kod LAMA (tiada sebabMenunggu
    // langsung dlm objek ditampal) akan GAGAL sepadan (kekal '' warisan rekod Archive B).
    const rSemua = await api('GET', '/api/system/content/all');
    const bSelepas = (rSemua.json?.items || []).find(i => i.id === objB.id);
    if (!bSelepas) { lapor.gagal('Kandungan B tak dijumpai dalam GET /content/all', ''); process.exitCode = 1; return; }
    console.log('  [maklumat] GET /content/all selepas reaktivasi:', JSON.stringify({ status: bSelepas.status, sebabMenunggu: bSelepas.sebabMenunggu }));
    if (bSelepas.status === 'pending' && bSelepas.sebabMenunggu === 'slot_penuh') {
      lapor.lulus('SAHIH: GET /content/all sahkan sebabMenunggu="slot_penuh" tersimpan sebenar di pelayan — optimistic patch BAHARU (sebabMenunggu: body.slotPenuh ? \'slot_penuh\' : \'\') kini SEPADAN kebenaran server; patch LAMA ({...i,status:"Pending"} sahaja) akan tinggalkan sebabMenunggu="" (silap papar "Menunggu Semakan")');
    } else {
      lapor.gagal('Kebenaran pelayan tak sepadan jangkaan', JSON.stringify(bSelepas));
    }

    lapor.ringkasan();
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exitCode = 1; });
