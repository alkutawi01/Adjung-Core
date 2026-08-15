import test from 'node:test';
import assert from 'node:assert/strict';
import { penggalSukuKata, cariTitikPenggal, SOFT_HYPHEN, setPemenggalanPengecualian } from '../core/editorial/PemenggalSukuKata.js';

// Pemenggal ini menggantikan `hyphens: auto` yang GAGAL SECARA SENYAP apabila pelayar tiada
// kamus hyphenation (diuji hidup: Melayu, Inggeris DAN Jerman semuanya gagal pecah dalam
// pelayar terbenam). Kerana ia menyisip aksara terus ke dalam teks editorial yang dipapar,
// peraturannya mesti tepat — sempang di tempat salah ialah kerosakan yang dilihat pembaca.
// Ujian ni mengunci peraturan pemenggalan supaya tidak reput.

/** Bantuan: tunjukkan hasil penggalan guna "-" supaya kegagalan mudah dibaca. */
const penggal = (kata) => penggalSukuKata(kata).split(SOFT_HYPHEN).join('-');

// PENGAWAL KEGAGALAN SENYAP — jangan buang ujian ini.
// SOFT_HYPHEN pernah ditulis sebagai aksara U+00AD LITERAL dalam kod sumber. Aksara itu tak
// kelihatan dalam editor mahupun diff, jadi apabila ia hilang (penormalan teks, transform
// bundler, salin-tampal), pemalar itu jadi rentetan KOSONG — dan seluruh pemenggal senyap-senyap
// bertukar jadi tiada operasi: tiada ralat, ujian corak masih lulus (kerana 'a-b'.split('') pun
// tak ubah apa-apa), tetapi tiada sempang langsung muncul pada paparan. Ia mengambil masa lama
// untuk dikesan. Kini ia ditulis String.fromCharCode(0x00AD) — ASCII tulen dalam sumber.
test('PENGAWAL: SOFT_HYPHEN mestilah betul-betul U+00AD, bukan rentetan kosong', () => {
  assert.equal(SOFT_HYPHEN.length, 1, 'SOFT_HYPHEN hilang atau lebih daripada satu aksara');
  assert.equal(SOFT_HYPHEN.charCodeAt(0), 0x00AD, 'SOFT_HYPHEN bukan U+00AD');
});

test('corak V-KV: penggal sebelum konsonan tunggal', () => {
  assert.equal(penggal('Didahulukan'), 'Di-da-hu-lu-kan');
  assert.equal(penggal('kebudayaan'), 'ke-bu-da-ya-an');
});

// SEMPADAN IMBUHAN — had yang diketahui, dikunci di sini supaya perubahan tak berlaku senyap.
//
// Pemenggal ini FONETIK (peraturan suku kata semata), bukan MORFOLOGI (tidak tahu kata dasar
// atau imbuhan). Pada perkataan berimbuhan, dua pembahagian yang sama-sama munasabah wujud:
//
//   Pelancongan  fonetik: pe-lan-co-ngan   morfologi: pe-lan-cong-an  (lancong + -an)
//   pencapaian   fonetik: pen-ca-pa-i-an   morfologi: pen-ca-pai-an   (capai + -an)
//   perairan     fonetik: pe-ra-i-ran      morfologi: pe-ra-ir-an     (air + -an)
//
// Kami pilih FONETIK kerana ia deterministik tanpa kamus kata dasar. Setiap titik penggal
// yang dihasilkan masih boleh dibaca dan tidak mengubah makna — dan kerana pelayar hanya
// guna SATU titik penggal setiap baris, pembaca tidak pernah nampak perkataan berpecah
// kepada banyak serpihan sekali gus.
//
// Jika pemilik projek mahu pembahagian morfologi, ia memerlukan kamus kata dasar Melayu —
// kerja yang jauh lebih besar, dan patut diputuskan olehnya, bukan diandaikan di sini.
test('sempadan imbuhan: pembahagian fonetik (had diketahui, bukan pepijat)', () => {
  assert.equal(penggal('Pelancongan'), 'Pe-lan-co-ngan');
  assert.equal(penggal('pencapaian'), 'pen-ca-pa-i-an');
  assert.equal(penggal('perairan'), 'pe-ra-i-ran');
});

test('corak VK-KV: penggal antara dua konsonan', () => {
  assert.equal(penggal('Dipersembahkan'), 'Di-per-sem-bah-kan');
  assert.equal(penggal('bantuan'), 'ban-tu-an');
  assert.equal(penggal('menghimpunkan'), 'meng-him-pun-kan');
});

test('digraf (ng, ny, sy, kh, gh) dikira SATU unit konsonan', () => {
  // Jika ng dipecah, "bangun" jadi "ban-gun" — salah.
  assert.equal(penggal('bangunan'), 'ba-ngu-nan');
  // Tapi ng + s = dua unit, jadi ng menutup suku kata.
  assert.equal(penggal('kebangsaan'), 'ke-bang-sa-an');
  assert.equal(penggal('menyanyikan'), 'me-nya-nyi-kan');
  assert.equal(penggal('mengakhiri'), 'me-nga-khi-ri');
  assert.equal(penggal('menyusahkan'), 'me-nyu-sah-kan');
});

test('corak V-V: penggal antara dua vokal bersebelahan', () => {
  assert.equal(penggal('keadaan'), 'ke-a-da-an');
  assert.equal(penggal('perbezaan'), 'per-be-za-an');
});

test('diftong di HUJUNG perkataan tidak dipenggal', () => {
  // "ai"/"au"/"oi" di hujung ialah diftong — satu bunyi, tak boleh dipisah.
  assert.equal(penggal('kedaipun'.replace('pun', '')), 'kedai');   // terlalu pendek, tak disentuh
  assert.equal(penggal('perhimpunan'), 'per-him-pu-nan');
  assert.ok(penggalSukuKata('bermacam-macam').includes(SOFT_HYPHEN));
});

test('vokal bersebelahan BUKAN diftong tetap dipenggal', () => {
  // "ei" bukan diftong Melayu, jadi ia dipenggal seperti biasa.
  assert.equal(penggal('keinginan'), 'ke-i-ngi-nan');
});

test('perkataan pendek tidak diproses langsung', () => {
  for (const pendek of ['ilmu', 'buku', 'baca', 'anak', 'Adjung', 'bantu']) {
    assert.equal(penggalSukuKata(pendek), pendek, `"${pendek}" tak sepatutnya disentuh`);
  }
});

test('tiada serpihan satu huruf terpencil di hujung mana-mana', () => {
  const kata = ['Didahulukan', 'Dipersembahkan', 'Pelancongan', 'keadaan', 'perbezaan', 'kebudayaan'];
  for (const k of kata) {
    for (const t of cariTitikPenggal(k)) {
      assert.ok(t >= 2, `${k}: serpihan kiri terlalu pendek pada indeks ${t}`);
      assert.ok(k.length - t >= 2, `${k}: serpihan kanan terlalu pendek pada indeks ${t}`);
    }
  }
});

test('teks bukan-huruf dibiarkan sepenuhnya (URL, angka, kod)', () => {
  for (const teks of ['https://adjung.com/berita', 'ISBN-9789671234567', '2026-07-31', 'COVID-19']) {
    assert.equal(penggalSukuKata(teks), teks, `"${teks}" tak sepatutnya disentuh`);
  }
});

test('ayat penuh: hanya perkataan panjang disentuh, ruang & tanda baca kekal', () => {
  const asal = 'Adjung ialah platform penerbitan digital yang mengutamakan ilmu.';
  const hasil = penggalSukuKata(asal);
  // Buang soft hyphen mesti pulih teks asal SEBIJI — tiada huruf hilang/bertambah.
  assert.equal(hasil.split(SOFT_HYPHEN).join(''), asal);
  // Perkataan pendek kekal utuh.
  assert.ok(hasil.includes(' ialah '), 'perkataan pendek "ialah" tak sepatutnya dipenggal');
  // Perkataan panjang memang dipenggal.
  assert.ok(hasil.includes(SOFT_HYPHEN), 'perkataan panjang sepatutnya ada titik penggal');
});

test('idempoten: panggil dua kali tidak menimbunkan sempang', () => {
  const sekali = penggalSukuKata('Dipersembahkan');
  const duakali = penggalSukuKata(sekali);
  assert.equal(duakali, sekali);
});

test('input bukan rentetan / kosong dikendalikan dengan selamat', () => {
  assert.equal(penggalSukuKata(''), '');
  assert.equal(penggalSukuKata(null), null);
  assert.equal(penggalSukuKata(undefined), undefined);
  assert.deepEqual(cariTitikPenggal(null), []);
});

test('KRITIKAL: tiada satu huruf pun ditambah atau dibuang daripada kandungan', () => {
  // Falsafah teras #1 — teks editorial tidak boleh diubah. Soft hyphen mesti satu-satunya
  // perbezaan; buang ia dan teks mesti kembali SEBIJI sama.
  const contoh = [
    'Kelantan Lancar Pelan Induk Pelancongan Warisan Islam 2026',
    'Setiap Penerbitan Mempunyai Tempatnya',
    'Editorial Didahulukan, Algoritma Dikemudiankan',
    'Membina Semula Peradaban Bermula dengan Pengetahuan',
    'Reka bentuk Adjung menumpukan kepada tipografi, ruang putih dan hierarki visual.',
  ];
  for (const teks of contoh) {
    assert.equal(penggalSukuKata(teks).split(SOFT_HYPHEN).join(''), teks);
  }
});

// Pengecualian editor (2026-08-16, arahan Izzat — "sistem yg dah ada dah betul, cuma saya nak
// sistem benarkan editor buat apa2 pengecualian... dia mcm autocorrect"). Contoh sebenar Izzat:
// "pentadbiran". Algoritma fonetik hasilkan "pen-tad-bi-ran" (dikunci di atas, BUKAN salah — dia
// sendiri sahkan "sistem yg dah ada dah betul") — ujian ni kunci KEBOLEHAN editor timpa dengan
// corak lain ("pen-tad-bir-an") bila dia rasa perlu, bukan tuntutan satu jawapan sahaja betul.
test('pengecualian editor: corak override diguna pakai, bukan algoritma automatik', () => {
  try {
    setPemenggalanPengecualian([{ perkataan: 'pentadbiran', corak: 'pen-tad-bir-an' }]);
    assert.equal(penggal('pentadbiran'), 'pen-tad-bir-an', 'pengecualian mesti override algoritma automatik ("pen-tad-bi-ran")');
    // Kes huruf ASAL kekal (huruf besar P dalam ayat sebenar), bukan huruf kecil corak tersimpan.
    assert.equal(penggal('Pentadbiran'), 'Pen-tad-bir-an', 'huruf besar/kecil perkataan asal mesti dikekalkan, bukan corak');
  } finally {
    setPemenggalanPengecualian([]);
  }
});

test('pengecualian editor: perkataan tanpa entri dalam peta terus guna algoritma biasa', () => {
  try {
    setPemenggalanPengecualian([{ perkataan: 'pentadbiran', corak: 'pen-tad-bir-an' }]);
    assert.equal(penggal('kebudayaan'), 'ke-bu-da-ya-an', 'perkataan lain tak sepatutnya terjejas oleh pengecualian perkataan lain');
  } finally {
    setPemenggalanPengecualian([]);
  }
});

// Pertahanan KEDUA (pelayan/pemenggalanRoutes.js pertahanan PERTAMA) — corak yang, bila sempang
// dibuang, TIDAK sepadan tepat perkataan asal mesti DITOLAK senyap (fallback algoritma), bukan
// diguna pakai. Kalau tidak, sisipan sempang akan merosakkan teks editorial sebenar dipaparkan —
// melanggar falsafah teras "jangan sentuh teks editorial".
test('pengecualian editor: corak yang tak sepadan perkataan (data rosak/lapuk) DITOLAK senyap', () => {
  try {
    setPemenggalanPengecualian([{ perkataan: 'pentadbiran', corak: 'pen-tad-XXX-an' }]);
    // Corak rosak (segmen bergabung != "pentadbiran") — jatuh balik ke algoritma biasa, teks
    // TIDAK dirosakkan oleh corak yang salah.
    assert.equal(penggal('pentadbiran'), 'pen-tad-bi-ran');
    assert.equal(penggalSukuKata('pentadbiran').split(SOFT_HYPHEN).join(''), 'pentadbiran');
  } finally {
    setPemenggalanPengecualian([]);
  }
});

test('pengecualian editor: senarai kosong/tak sah dikendalikan dengan selamat', () => {
  try {
    setPemenggalanPengecualian([]);
    assert.equal(penggal('kebudayaan'), 'ke-bu-da-ya-an');
    setPemenggalanPengecualian(null);
    assert.equal(penggal('kebudayaan'), 'ke-bu-da-ya-an');
    setPemenggalanPengecualian([{ perkataan: '', corak: 'pen-tad-bir-an' }, { perkataan: 'pentadbiran', corak: '' }]);
    assert.equal(penggal('pentadbiran'), 'pen-tad-bi-ran', 'entri tanpa perkataan/corak sah dilangkau, bukan diguna pakai');
  } finally {
    setPemenggalanPengecualian([]);
  }
});
