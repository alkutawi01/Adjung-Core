// Regression: medan berbilang baris/perenggan dalam format blok manual.
//
// Pepijat asal (ditemui simulasi UX #21, 2026-08-12): parseManualBlockFields() mengulang baris
// demi baris dan setiap baris yang BUKAN "Label:" jatuh melalui semua else-if TANPA else — jadi
// hilang senyap. Kesannya: editor taip/tampal Huraian panjang berbilang perenggan, simpan, buka
// semula → perenggan kedua ke atas lenyap tanpa sebarang amaran. Disahkan pada masa itu: 0
// daripada 40 kandungan produksi mempunyai pemisah perenggan, walhal FocusView.tsx memang
// memecahkan `\n{2,}` menjadi <p> berasingan (kod render itu praktikalnya mati).
//
// Serializer TIDAK pernah bermasalah — ia menulis newline literal dengan betul. Ujian di bawah
// mengunci kedua-dua arah supaya round-trip taip → simpan → buka semula kekal utuh.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseManualBlockFields,
  parseManualSummaryBlocks,
  serializeManualBentoQueue,
} from '../core/editorial/ManualBlockFormat.js';

test('ManualBlockFormat - Huraian panjang berbilang perenggan kekal (bukan hilang senyap)', () => {
  const blok = [
    'Tajuk: Tajuk ujian',
    'Huraian panjang: Perenggan satu.',
    '',
    'Perenggan dua.',
    'Sumber: Sumber Ujian',
  ].join('\n');
  const f = parseManualBlockFields(blok);
  assert.equal(f.briefLong, 'Perenggan satu.\n\nPerenggan dua.');
  // Label seterusnya MESTI menamatkan medan — bukan tenggelam ke dalam huraian.
  assert.equal(f.source, 'Sumber Ujian');
});

test('ManualBlockFormat - baris sambungan tanpa baris kosong turut dikekalkan', () => {
  const f = parseManualBlockFields('Tajuk: T\nHuraian panjang: Baris satu.\nBaris dua.\nSumber: S');
  assert.equal(f.briefLong, 'Baris satu.\nBaris dua.');
  assert.equal(f.source, 'S');
});

test('ManualBlockFormat - medan satu-baris TIDAK menyerap baris berikutnya', () => {
  // Tajuk/Topik ialah <input> satu baris dalam UI — baris sesat selepasnya mesti terus diabaikan,
  // bukan digabungkan (kelakuan asal dikekalkan sengaja).
  const f = parseManualBlockFields('Tajuk: Tajuk sebenar\nbaris sesat\nTopik: Topik sebenar');
  assert.equal(f.title, 'Tajuk sebenar');
  assert.equal(f.topik, 'Topik sebenar');
});

test('ManualBlockFormat - Huraian ringkas dan Nota turut menyokong perenggan', () => {
  const f = parseManualBlockFields(
    'Tajuk: T\nHuraian ringkas: Ringkas satu.\n\nRingkas dua.\nNota: Nota satu.\n\nNota dua.\nImej: '
  );
  assert.equal(f.brief, 'Ringkas satu.\n\nRingkas dua.');
  assert.equal(f.note, 'Nota satu.\n\nNota dua.');
});

test('ManualBlockFormat - round-trip taip → serialize → parse mengekalkan perenggan', () => {
  const asal = {
    uuid: 'object-manual-slot11-test-0',
    status: 'draft',
    title: 'Tajuk ujian',
    topik: 'Ujian',
    brief: 'Ringkas.',
    briefLong: 'Perenggan satu ditaip terus.\n\nPerenggan dua ditaip terus juga.',
    source: 'S',
    url: 'https://contoh.example.com',
    date: '2026-08-12',
    sources: [{ name: 'S', url: 'https://contoh.example.com' }],
  };
  const semula = parseManualSummaryBlocks(serializeManualBentoQueue([asal]))[0];
  assert.equal(semula.briefLong, asal.briefLong);
  assert.equal(semula.brief, asal.brief);
  assert.equal(semula.title, asal.title);
  assert.equal(semula.source, asal.source);
  assert.equal(semula.url, asal.url);
});

test('ManualBlockFormat - markdown mentah kekal sebagai sumber, bukan ditukar HTML', () => {
  const teks = 'Ada *italic*, **bold**, ***bold-italic***, * tunggal, [teks], (contoh).';
  const f = parseManualBlockFields(`Tajuk: T\nHuraian ringkas: ${teks}\nSumber: S`);
  assert.equal(f.brief, teks);
});

test('ManualBlockFormat - blok berbilang dgn perenggan tidak bocor antara satu sama lain', () => {
  const dua = serializeManualBentoQueue([
    { uuid: 'a', status: 'draft', title: 'Satu', briefLong: 'A1.\n\nA2.', sources: [] },
    { uuid: 'b', status: 'draft', title: 'Dua', briefLong: 'B1.\n\nB2.', sources: [] },
  ]);
  const blok = parseManualSummaryBlocks(dua);
  assert.equal(blok.length, 2);
  assert.equal(blok[0].briefLong, 'A1.\n\nA2.');
  assert.equal(blok[1].briefLong, 'B1.\n\nB2.');
  assert.equal(blok[0].title, 'Satu');
  assert.equal(blok[1].title, 'Dua');
});
