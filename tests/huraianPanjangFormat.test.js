import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pecahHuraianPanjang, buangSubtajuk, panjangHuraianDikira, validateSubtajuk,
  MAKS_SUBTAJUK, MAKS_AKSARA_SUBTAJUK,
} from '../core/editorial/HuraianPanjangFormat.js';
import { parseManualBlockFields, serializeManualBentoItem } from '../core/editorial/ManualBlockFormat.js';
import { binaHtmlBot } from '../core/routes/articleUrlRoutes.js';

const CONTOH = 'Perenggan pembuka.\n## Kesan kepada harga beras\nPerenggan kedua.\n\n## Reaksi pengeluar\nPerenggan ketiga.';

test('pecahHuraianPanjang: baris "## " jadi subtajuk, baris lain perenggan', () => {
  assert.deepEqual(pecahHuraianPanjang(CONTOH), [
    { jenis: 'perenggan', teks: 'Perenggan pembuka.' },
    { jenis: 'subtajuk', teks: 'Kesan kepada harga beras' },
    { jenis: 'perenggan', teks: 'Perenggan kedua.' },
    { jenis: 'subtajuk', teks: 'Reaksi pengeluar' },
    { jenis: 'perenggan', teks: 'Perenggan ketiga.' },
  ]);
});

test('pecahHuraianPanjang: "#" tunggal, "###" dan "##" di tengah ayat BUKAN subtajuk', () => {
  const blok = pecahHuraianPanjang('# Satu\n### Tiga\nNombor ## di tengah');
  assert.ok(blok.every((b) => b.jenis === 'perenggan'));
});

test('kandungan tanpa subtajuk: kiraan aksara TEPAT sama dengan panjang rentetan asal', () => {
  const lama = '  Perenggan satu.\n\nPerenggan dua.  \n';
  assert.equal(buangSubtajuk(lama), lama);
  assert.equal(panjangHuraianDikira(lama), lama.length);
});

test('panjangHuraianDikira: baris subtajuk dikecualikan', () => {
  assert.equal(panjangHuraianDikira('Abc.\n## Subtajuk panjang di sini\nDef.'), 'Abc.\nDef.'.length);
});

test('validateSubtajuk: susunan sah lulus, tiada subtajuk pun lulus', () => {
  assert.equal(validateSubtajuk(CONTOH).isValid, true);
  assert.equal(validateSubtajuk('Perenggan sahaja.').isValid, true);
  assert.equal(validateSubtajuk(undefined).isValid, true);
});

test('validateSubtajuk: tolak subtajuk di awal, di hujung, berturut-turut, kosong, terlalu panjang, terlalu banyak', () => {
  assert.equal(validateSubtajuk('## Mula\nPerenggan.').isValid, false);
  assert.equal(validateSubtajuk('Perenggan.\n## Hujung').isValid, false);
  assert.equal(validateSubtajuk('Perenggan.\n## Satu\n## Dua\nPerenggan.').isValid, false);
  assert.equal(validateSubtajuk('Perenggan.\n##\nPerenggan.').isValid, false);
  assert.equal(validateSubtajuk(`Perenggan.\n## ${'a'.repeat(MAKS_AKSARA_SUBTAJUK + 1)}\nPerenggan.`).isValid, false);
  const banyak = 'Pembuka.' + Array.from({ length: MAKS_SUBTAJUK + 1 }, (_, i) => `\n## Sub ${i}\nPerenggan ${i}.`).join('');
  assert.equal(validateSubtajuk(banyak).isValid, false);
  const cukup = 'Pembuka.' + Array.from({ length: MAKS_SUBTAJUK }, (_, i) => `\n## Sub ${i}\nPerenggan ${i}.`).join('');
  assert.equal(validateSubtajuk(cukup).isValid, true);
});

test('format blok manual: subtajuk kekal selepas serialize -> parse (tiada kehilangan baris)', () => {
  const blok = serializeManualBentoItem({ title: 'Tajuk', brief: 'Ringkas', briefLong: CONTOH, topik: 'Topik' });
  assert.equal(parseManualBlockFields(blok).briefLong, CONTOH);
});

test('halaman bot: subtajuk jadi <h2>, tanda "##" tidak bocor ke meta description', () => {
  const html = binaHtmlBot({
    kandungan: { title: 'Tajuk', summary: CONTOH, publishedAt: '2026-10-06' },
    url: 'https://brief.adjung.com/x/kandungan/abc', objectId: 'obj',
  });
  assert.ok(html.includes('<h2>Kesan kepada harga beras</h2>'));
  assert.ok(html.includes('<p>Perenggan kedua.</p>'));
  assert.ok(!html.includes('##'));
  const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(!desc.includes('Kesan kepada harga beras'));
});
