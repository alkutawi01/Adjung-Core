// Regression: resolusi Sense Glosari Berasaskan Bidang (2026-08-16, seni bina disahkan
// docs/glossary-architecture-proposal.md v3, arahan Izzat).
//
// Peraturan MUKTAMAD (Seksyen 3) — Sense KHUSUS sepadan Bidang kandungan > Sense AM > `maksud`
// lama (glosari_istilah) > tiada tooltip. Label "(Bidang)" HANYA dipaparkan bila Sense KHUSUS
// digunakan (namaBidang bukan-null) — Sense am dan `maksud` fallback KEDUA-DUANYA namaBidang
// null. Ini peraturan yang Izzat betulkan selepas draf pertama SILAP kata Bidang sentiasa
// dipaparkan — ujian ni kunci corak BETUL, bukan draf pertama.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugBidang, resolveDefinisiGlosari } from '../core/editorial/GlosariResolusi.js';

// Contoh sebenar daripada spesifikasi Izzat (docs v3, Kes A/B/C) — istilah "intervensi" dengan
// Sense khusus Sukan + Perubatan, Sense am, dan `maksud` lama warisan.
const entriIntervensi = {
  istilah: 'intervensi',
  maksud: 'Maksud lama warisan sebelum Sense wujud.',
  senses: [
    {
      id: 'gsn-1', amSense: false,
      definisi: 'Program senaman atau aktiviti berstruktur yang dirancang khas untuk meningkatkan tahap kecergasan fizikal atau mengawal berat badan.',
      bidang: [{ id: 'cat-sukan', name: 'Sukan', slug: 'sukan' }],
    },
    {
      id: 'gsn-2', amSense: false,
      definisi: 'Tindakan, rawatan atau prosedur yang dilakukan untuk menangani sesuatu keadaan kesihatan.',
      bidang: [{ id: 'cat-perubatan', name: 'Perubatan & Kesihatan', slug: 'perubatan-kesihatan' }],
    },
    {
      id: 'gsn-am', amSense: true,
      definisi: 'Tindakan campur tangan yang bertujuan menangani atau mempengaruhi sesuatu keadaan.',
      bidang: [],
    },
  ],
};

test('Kes A (spesifikasi Izzat) — Sense khusus sepadan Bidang konteks, label Bidang dipaparkan', () => {
  const hasil = resolveDefinisiGlosari(entriIntervensi, 'Sukan');
  assert.equal(hasil.namaBidang, 'Sukan');
  assert.match(hasil.definisi, /kecergasan fizikal/);
});

test('Kes B (spesifikasi Izzat) — tiada Sense khusus bagi Bidang konteks, jatuh ke Sense am TANPA label', () => {
  const hasil = resolveDefinisiGlosari(entriIntervensi, 'Pendidikan');
  assert.equal(hasil.namaBidang, null, 'Sense am TIDAK papar label Bidang, walau Bidang konteks (Pendidikan) diketahui');
  assert.match(hasil.definisi, /campur tangan yang bertujuan menangani/);
});

test('Kes C (spesifikasi Izzat) — tiada Sense khusus, tiada Sense am, jatuh ke maksud lama TANPA label', () => {
  const entriTanpaAm = { ...entriIntervensi, senses: entriIntervensi.senses.filter((s) => !s.amSense) };
  const hasil = resolveDefinisiGlosari(entriTanpaAm, 'Pendidikan');
  assert.equal(hasil.namaBidang, null);
  assert.equal(hasil.definisi, 'Maksud lama warisan sebelum Sense wujud.');
});

test('Tiada sebarang definisi (tiada Sense, maksud kosong) — tiada tooltip', () => {
  const entriKosong = { istilah: 'x', maksud: '', senses: [] };
  assert.equal(resolveDefinisiGlosari(entriKosong, 'Sukan'), null);
});

test('Bidang konteks kosong/tiada (Ticker) — terus fallback (Sense am), TIADA label', () => {
  const hasilKosong = resolveDefinisiGlosari(entriIntervensi, '');
  assert.equal(hasilKosong.namaBidang, null);
  const hasilNull = resolveDefinisiGlosari(entriIntervensi, null);
  assert.equal(hasilNull.namaBidang, null);
  const hasilUndefined = resolveDefinisiGlosari(entriIntervensi, undefined);
  assert.equal(hasilUndefined.namaBidang, null);
});

// Gotcha ditemui semasa pengesahan getSlug() (docs v3, pembetulan #2 Izzat: "buktikan, jangan
// andaikan") — slugBidang('') mesti pulangkan 'umum', BUKAN rentetan kosong (cermin tepat
// CategoryRegistry.getSlug() pelayan). resolveDefinisiGlosari() TIDAK bergantung pada tingkah
// laku ni (semak kosong DAHULU), tapi slugBidang() SENDIRI mesti kekal seiras pelayan.
test('slugBidang() — cermin tepat gotcha CategoryRegistry.getSlug() pelayan (nama kosong -> "umum")', () => {
  assert.equal(slugBidang(''), 'umum');
  assert.equal(slugBidang(null), 'umum');
  assert.equal(slugBidang(undefined), 'umum');
  assert.equal(slugBidang('Sukan'), 'sukan');
  assert.equal(slugBidang('Al-Quran & Sunnah'), 'al-quran-sunnah');
});

test('resolveDefinisiGlosari() TIDAK terjejas gotcha "umum" — walau Bidang aktif bernama "Umum" wujud, konteks kosong tetap fallback am, bukan silap padan', () => {
  const entriDenganSenseUmum = {
    istilah: 'contoh',
    maksud: '',
    senses: [
      { id: 'gsn-umum', amSense: false, definisi: 'Sense khusus Bidang "Umum" — tak patut terpadan bila konteks kosong.', bidang: [{ id: 'cat-umum', name: 'Umum', slug: 'umum' }] },
      { id: 'gsn-am', amSense: true, definisi: 'Sense am sebenar.', bidang: [] },
    ],
  };
  const hasil = resolveDefinisiGlosari(entriDenganSenseUmum, ''); // Ticker/desk kosong
  assert.equal(hasil.definisi, 'Sense am sebenar.', 'konteks kosong MESTI fallback ke Sense am, jangan silap padan slug "umum"');
  assert.equal(hasil.namaBidang, null);
});

test('Definisi Sense khusus kosong dilangkau, jatuh ke fallback seterusnya', () => {
  const entriSenseKosong = {
    istilah: 'y',
    maksud: 'Fallback lama.',
    senses: [{ id: 'gsn-3', amSense: false, definisi: '   ', bidang: [{ id: 'cat-x', name: 'X', slug: 'x' }] }],
  };
  const hasil = resolveDefinisiGlosari(entriSenseKosong, 'X');
  assert.equal(hasil.namaBidang, null);
  assert.equal(hasil.definisi, 'Fallback lama.');
});
