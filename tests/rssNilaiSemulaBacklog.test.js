// Regresi: nilai semula backlog RSS bila tetapan Editorial berubah (2026-08-20).
//
// Konteks pepijat SEBENAR yang ujian ni kunci. `rss_ticker_items.rssGuid` bertanda UNIQUE dan
// setiap serapan RSS guna `INSERT OR IGNORE`, jadi sebaik satu item pernah dinilai ia TAK PERNAH
// dinilai semula — backlog terperangkap keputusan lama walau Ketua Editor ubah ambang di
// Editorium (laporan Izzat: "GAGAL", tekan Simpan berkali-kali tiada kesan). Pembetulan pertama
// (nilaiSemulaKeputusanSediaAda) memperkenalkan pepijat KEDUA yang lebih bahaya: ia hantar
// `containsSensational = false` TEGAR, jadi ia menghidupkan semula item yang baru sahaja disekat
// oleh purge kata kunci dalam permintaan HTTP yang SAMA — membatalkan dasar editorial Izzat.
//
// Ujian ni mengunci PERATURAN KEPUTUSANnya pada tentukanKeputusanSkor() (fungsi tulen, tiada DB),
// iaitu tempat kedua-dua laluan (serapan baharu + nilai semula backlog) kini berkongsi kebenaran.

import test from 'node:test';
import assert from 'node:assert/strict';
import { tentukanKeputusanSkor, calculateEditorialScore } from '../core/sources/EditorialScoreEngine.js';

const TETAPAN = { autoLiveThreshold: 60, reviewThreshold: 60, tickerTitleMinChars: 0 };

test('nilai semula: skor tinggi lulus auto-live bila ambang diturunkan', () => {
  // Item skor 65: gagal bawah ambang lama 80, lulus bawah ambang baharu 60.
  const lama = tentukanKeputusanSkor(65, false, 50, { autoLiveThreshold: 80, reviewThreshold: 60 });
  assert.equal(lama.status, 'pending');
  assert.equal(lama.decision, 'EDITOR_REVIEW');

  const baharu = tentukanKeputusanSkor(65, false, 50, TETAPAN);
  assert.equal(baharu.status, 'approved');
  assert.equal(baharu.decision, 'AUTO_LIVE');
});

test('nilai semula: had aksara tajuk diturunkan ke 0 melepaskan item TITLE_TOO_SHORT', () => {
  // Tajuk 35 aksara: disekat bawah had 47, lulus bila had ditetapkan 0 (tiada had).
  const berhad = tentukanKeputusanSkor(90, false, 35, { ...TETAPAN, tickerTitleMinChars: 47 });
  assert.equal(berhad.decision, 'TITLE_TOO_SHORT');
  assert.equal(berhad.status, 'pending');

  const tiadaHad = tentukanKeputusanSkor(90, false, 35, { ...TETAPAN, tickerTitleMinChars: 0 });
  assert.equal(tiadaHad.decision, 'AUTO_LIVE');
  assert.equal(tiadaHad.status, 'approved');
});

// INI ujian paling penting dalam fail ni — ia yang menahan pepijat sebenar 2026-08-20.
test('kata kunci disekat MESTI menang atas skor tinggi (dasar editorial, bukan cadangan)', () => {
  // Skor 100 (jauh atas ambang) TAPI mengandungi kata kunci disekat: mesti tetap disekat.
  // Sebelum pembetulan, laluan nilai semula hantar containsSensational=false tegar, jadi item
  // begini dihidupkan semula jadi 'approved' dan terpapar di ticker awam.
  const disekat = tentukanKeputusanSkor(100, true, 80, TETAPAN);
  assert.equal(disekat.decision, 'BLOCKED_KEYWORD');
  assert.equal(disekat.status, 'rejected');
  assert.notEqual(disekat.status, 'approved');
});

test('kata kunci disekat menang walau had aksara tajuk sudah dilonggarkan', () => {
  // Gabungan kedua-dua tetapan yang Izzat longgarkan hari ni — sekatan mesti tetap kekal.
  const hasil = tentukanKeputusanSkor(100, true, 120, { ...TETAPAN, tickerTitleMinChars: 0 });
  assert.equal(hasil.status, 'rejected');
});

test('tentukanKeputusanSkor sepadan TEPAT dengan keputusan calculateEditorialScore', () => {
  // Pengekstrakan fungsi tulen (2026-08-20) tak boleh mengubah kelakuan laluan serapan asal.
  // Kalau salah satu diubah kemudian tanpa satu lagi, ujian ni gagal.
  const sumber = { trustScore: 90, categoryMapping: 'EKONOMI' };
  const kes = [
    { title: 'Kerajaan umum belanjawan tambahan bagi sektor pendidikan negara', description: 'Butiran penuh.' },
    { title: 'Berita gempar tersebar', description: 'Kandungan sensasi.' },
    { title: 'Pendek', description: 'Ringkas.' },
  ];

  for (const item of kes) {
    const penuh = calculateEditorialScore(item, sumber, TETAPAN);
    const terus = tentukanKeputusanSkor(
      penuh.score,
      penuh.decision === 'BLOCKED_KEYWORD',
      (item.title || '').length,
      TETAPAN
    );
    assert.equal(terus.decision, penuh.decision, `decision tak sepadan bagi: ${item.title}`);
    assert.equal(terus.status, penuh.status, `status tak sepadan bagi: ${item.title}`);
  }
});

test('skor 0 sentiasa dikira disekat, tak kira ambang serendah mana', () => {
  // Melindungi had yang didokumentasikan: item yang skornya tersimpan 0 (pernah disekat kata
  // kunci) TIDAK pulih automatik walau ambang diturunkan ke 0 — arah selamat yang disengajakan.
  const hasil = tentukanKeputusanSkor(0, false, 100, { autoLiveThreshold: 0, reviewThreshold: 0 });
  assert.equal(hasil.decision, 'BLOCKED_KEYWORD');
  assert.equal(hasil.status, 'rejected');
});
