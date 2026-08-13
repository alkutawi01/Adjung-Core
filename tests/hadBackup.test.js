import test from 'node:test';
import assert from 'node:assert/strict';
import { pilihBackupUntukDibuang, HAD_SAIZ_BACKUP_BYTES } from '../core/utils/hadBackup.js';

// Kod yang memadam fail backup ialah kelas kod paling berisiko dalam projek ni: adjung.db
// gitignored dan kandungannya tak boleh dijana semula. Ujian ni menjaga tiga invarian yang
// kalau pecah, akibatnya kehilangan kekal.

const s = (nama, saizMB, masa) => ({ nama, saiz: saizMB * 1024 * 1024, masa });

test('had backup - di bawah had tiada apa dibuang', () => {
  const senarai = [s('a', 100, 1), s('b', 100, 2), s('c', 100, 3)];
  assert.deepEqual(pilihBackupUntukDibuang(senarai, 1024 * 1024 * 1024), []);
});

test('had backup - buang paling LAMA dahulu sehingga muat dalam had', () => {
  // 4 x 300MB = 1200MB, had 1000MB -> perlu buang 200MB -> satu fail paling lama sudah cukup.
  const senarai = [s('lama', 300, 1), s('tengah1', 300, 2), s('tengah2', 300, 3), s('baru', 300, 4)];
  const dibuang = pilihBackupUntukDibuang(senarai, 1000 * 1024 * 1024);
  assert.deepEqual(dibuang, ['lama']);
});

test('had backup - buang beberapa bila satu tak cukup', () => {
  const senarai = [s('a', 300, 1), s('b', 300, 2), s('c', 300, 3), s('d', 300, 4)];
  const dibuang = pilihBackupUntukDibuang(senarai, 700 * 1024 * 1024);
  assert.deepEqual(dibuang, ['a', 'b'], 'buang dua yang paling lama, ikut susunan masa');
});

test('had backup - salinan TERBARU tidak pernah dibuang walau ia sendiri melebihi had', () => {
  const senarai = [s('lama', 10, 1), s('gergasi', 9000, 2)];
  const dibuang = pilihBackupUntukDibuang(senarai, 1024 * 1024 * 1024);
  assert.ok(!dibuang.includes('gergasi'), 'jangan sekali-kali buang salinan terakhir');
  assert.deepEqual(dibuang, ['lama']);
});

test('had backup - satu salinan sahaja tidak pernah dibuang', () => {
  assert.deepEqual(pilihBackupUntukDibuang([s('satu-satunya', 9000, 1)], 1024), []);
});

test('had backup - susunan input tidak kronologi tetap dikendalikan ikut masa sebenar', () => {
  const senarai = [s('baru', 300, 9), s('lama', 300, 1), s('tengah', 300, 5)];
  const dibuang = pilihBackupUntukDibuang(senarai, 700 * 1024 * 1024);
  assert.deepEqual(dibuang, ['lama'], 'pilih ikut cap masa, bukan kedudukan dalam array');
});

test('had backup - input kosong/rosak tidak meranapkan dan tidak memadam apa-apa', () => {
  assert.deepEqual(pilihBackupUntukDibuang([], 100), []);
  assert.deepEqual(pilihBackupUntukDibuang(null, 100), []);
  assert.deepEqual(pilihBackupUntukDibuang(undefined, 100), []);
  assert.deepEqual(pilihBackupUntukDibuang([s('a', 10, 1), s('b', 10, 2)], 0), [], 'had 0 dianggap tak sah, jangan padam semua');
  assert.deepEqual(pilihBackupUntukDibuang([s('a', 10, 1), s('b', 10, 2)], -5), []);
  assert.deepEqual(
    pilihBackupUntukDibuang([{ nama: 'x' }, { saiz: 1, masa: 1 }, null], 1),
    [],
    'entri tanpa medan lengkap diabaikan, bukan diandaikan sifar'
  );
});

test('had backup - lalai 5GB seperti ditetapkan pemilik projek', () => {
  assert.equal(HAD_SAIZ_BACKUP_BYTES, 5 * 1024 * 1024 * 1024);
});
