// Regresi: pemisah blok Ticker mesti menduduki SATU BARIS PENUH (2026-08-20).
//
// Punca sebenar: corak lama `/\n?[-_—–―]{3,}\n?/` menjadikan KEDUA-DUA baris baharu pilihan,
// jadi tiga aksara sempang di mana-mana sahaja memecahkan blok — paling mudah berlaku di dalam
// URL berita yang mengandungi slug seperti `.../berita---terkini`. Kesannya bukan sekadar URL
// terpotong: medan `Mode:` yang terletak SELEPAS baris Url turut tercampak ke serpihan kedua,
// jadi blok itu kehilangan identiti modnya. gantiBlokModTicker() menapis ikut `mode`, jadi blok
// tanpa mod tidak akan pernah diganti oleh pemiliknya lagi — ia menjadi yatim yang kekal dalam
// rentetan ticker selama-lamanya.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTickerText, serializeTickerText, gantiBlokModTicker } from '../core/routes/contentRoutes.js';

const blok = (o) => [
  `Desk: ${o.desk}`, `Title: ${o.title}`, `Brief: ${o.brief}`,
  `Source: ${o.source}`, `Url: ${o.url}`, `Mode: ${o.mode}`,
].join('\n');

test('URL mengandungi tiga sempang tidak memecahkan blok', () => {
  const teks = blok({
    desk: 'SEMASA', title: 'Berita ujian', brief: 'Huraian.',
    source: 'Utusan', url: 'https://contoh.com/berita---terkini', mode: 'RSS Direct',
  });
  const item = parseTickerText(teks);
  assert.equal(item.length, 1);
  assert.equal(item[0].url, 'https://contoh.com/berita---terkini', 'URL tidak boleh terpotong');
  assert.equal(item[0].mode, 'RSS Direct', 'Mod hilang bermakna blok jadi yatim, tak boleh diganti');
});

test('tiga sempang di tengah ayat editorial tidak memecahkan blok', () => {
  const teks = blok({
    desk: 'BUDAYA', title: 'Tanda ――― dalam tipografi Melayu', brief: 'Huraian biasa.',
    source: 'Dewan Bahasa', url: 'https://contoh.com/a', mode: 'Manual',
  });
  const item = parseTickerText(teks);
  assert.equal(item.length, 1);
  assert.equal(item[0].mode, 'Manual');
});

test('baris pemisah sebenar TETAP memecahkan blok (serasi ke belakang)', () => {
  const teks = [
    blok({ desk: 'A', title: 'Pertama', brief: 'x', source: 's', url: 'https://a.com', mode: 'RSS Direct' }),
    blok({ desk: 'B', title: 'Kedua', brief: 'y', source: 't', url: 'https://b.com', mode: 'Manual' }),
  ].join('\n---\n');
  const items = parseTickerText(teks);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Pertama');
  assert.equal(items[1].title, 'Kedua');
});

test('serializeTickerText melipat baris baharu supaya blok tak boleh pecah sendiri', () => {
  // Huraian berbilang baris yang barisnya kebetulan sempang sahaja: dahulu ia menyuntik baris
  // pemisah PALSU ke dalam rentetan tersimpan dan memecahkan blok sendiri semasa dibaca semula.
  const teks = serializeTickerText([{
    desk: 'SEMASA', title: 'Tajuk sah', brief: 'Perenggan satu.\n---\nPerenggan dua.',
    source: 'Sumber', url: 'https://contoh.com', mode: 'Manual',
  }]);
  const items = parseTickerText(teks);
  assert.equal(items.length, 1, 'blok tidak boleh berpecah akibat kandungannya sendiri');
  assert.equal(items[0].mode, 'Manual');
  assert.ok(items[0].brief.includes('Perenggan satu.'), 'teks asal kekal');
  assert.ok(items[0].brief.includes('Perenggan dua.'), 'teks selepas baris baharu TIDAK hilang');
});

test('pusingan penuh: serialize -> parse mengekalkan setiap medan', () => {
  const asal = [
    { desk: 'EKONOMI', title: 'Satu', brief: 'Huraian satu', source: 'RTM', url: 'https://a.com/x---y', mode: 'RSS Direct' },
    { desk: 'SUKAN', title: 'Dua', brief: 'Huraian dua', source: 'Bernama', url: 'https://b.com', mode: 'Manual' },
  ];
  const hasil = parseTickerText(serializeTickerText(asal));
  assert.deepEqual(hasil, asal);
});

test('gantiBlokModTicker menukar mod sendiri sahaja, blok mod lain kekal utuh', () => {
  const teksSemasa = serializeTickerText([
    { desk: 'A', title: 'Manual kekal', brief: 'm', source: 's', url: 'https://m.com', mode: 'Manual' },
    { desk: 'B', title: 'RSS lama', brief: 'r', source: 't', url: 'https://r.com', mode: 'RSS Direct' },
  ]);
  const hasil = parseTickerText(gantiBlokModTicker(teksSemasa, 'RSS Direct', [
    { desk: 'C', title: 'RSS baharu', brief: 'n', source: 'u', url: 'https://n.com', mode: 'RSS Direct' },
  ]));
  assert.equal(hasil.length, 2);
  assert.ok(hasil.some((i) => i.title === 'Manual kekal'), 'blok Manual TIDAK boleh terjejas');
  assert.ok(hasil.some((i) => i.title === 'RSS baharu'));
  assert.ok(!hasil.some((i) => i.title === 'RSS lama'), 'blok RSS lama patut diganti');
});

test('senarai kosong membuang semua blok mod itu tetapi mengekalkan mod lain', () => {
  // Kelakuan yang ticker bergantung padanya bila TIADA berita layak (had usia 24 jam + hari sunyi).
  const teksSemasa = serializeTickerText([
    { desk: 'A', title: 'Manual kekal', brief: 'm', source: 's', url: 'https://m.com', mode: 'Manual' },
    { desk: 'B', title: 'RSS lapuk', brief: 'r', source: 't', url: 'https://r.com', mode: 'RSS Direct' },
  ]);
  const hasil = parseTickerText(gantiBlokModTicker(teksSemasa, 'RSS Direct', []));
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].title, 'Manual kekal');
});
