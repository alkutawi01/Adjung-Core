import test from 'node:test';
import assert from 'node:assert/strict';
import { findFixedHoliday, FIXED_HOLIDAYS, ALL_STATE_CODES } from '../core/worldclock/PublicHolidays.js';

// Kod negeri bagi kesemua 15 bandar jalur Jam Dunia (CITY_SETS dalam WorldClockStrip.tsx).
const CLOCK_STATE_CODES = [
  'PLS', 'KUL', 'KTN', 'JHR', 'SBH',
  'KDH', 'SGR', 'NSN', 'PHG', 'LBN',
  'PNG', 'PRK', 'MLK', 'TRG', 'SWK',
];

test('PublicHolidays - Hari Wilayah Persekutuan cuma di Wilayah Persekutuan', () => {
  // Ini pepijat asalnya: 1 Februari memaparkan Cuti Umum di kesemua 15 bandar.
  assert.deepEqual(findFixedHoliday('02/01', 'KUL'), { name: 'Hari Wilayah Persekutuan' });
  assert.deepEqual(findFixedHoliday('02/01', 'LBN'), { name: 'Hari Wilayah Persekutuan' });
  assert.deepEqual(findFixedHoliday('02/01', 'PJY'), { name: 'Hari Wilayah Persekutuan' });

  for (const code of CLOCK_STATE_CODES.filter(s => !['KUL', 'LBN', 'PJY'].includes(s))) {
    assert.equal(findFixedHoliday('02/01', code), null, `${code} tidak sepatutnya bercuti pada 1 Februari`);
  }
});

test('PublicHolidays - Tahun Baharu dikecualikan di lima negeri', () => {
  for (const code of ['JHR', 'KDH', 'KTN', 'PLS', 'TRG']) {
    assert.equal(findFixedHoliday('01/01', code), null, `${code} tidak menyambut Tahun Baharu`);
  }
  for (const code of ['KUL', 'SGR', 'PNG', 'SBH', 'SWK', 'MLK', 'NSN', 'PHG', 'PRK', 'LBN']) {
    assert.deepEqual(findFixedHoliday('01/01', code), { name: 'Tahun Baharu' }, `${code} menyambut Tahun Baharu`);
  }
});

test('PublicHolidays - cuti seluruh negara terpakai di setiap negeri', () => {
  const nationwide = [
    ['05/01', 'Hari Pekerja'],
    ['08/31', 'Hari Kebangsaan'],
    ['09/16', 'Hari Malaysia'],
    ['12/25', 'Hari Krismas'],
  ];
  for (const [key, name] of nationwide) {
    for (const code of ALL_STATE_CODES) {
      assert.deepEqual(findFixedHoliday(key, code), { name }, `${name} sepatutnya cuti di ${code}`);
    }
  }
});

test('PublicHolidays - tarikh bukan cuti dan input kosong pulangkan null', () => {
  for (const code of CLOCK_STATE_CODES) {
    assert.equal(findFixedHoliday('07/27', code), null);
  }
  assert.equal(findFixedHoliday('', 'KUL'), null);
  assert.equal(findFixedHoliday('01/01', ''), null);
  assert.equal(findFixedHoliday('01/01', 'TIADA'), null);
});

test('PublicHolidays - setiap entri guna kunci MM/DD dan kod negeri yang sah', () => {
  for (const h of FIXED_HOLIDAYS) {
    assert.match(h.key, /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/, `kunci "${h.key}" bukan format MM/DD`);
    assert.ok(h.name && h.name.length > 0, 'setiap cuti mesti ada nama');
    if (h.states !== null) {
      assert.ok(h.states.length > 0, `${h.name} tidak boleh ada senarai negeri kosong`);
      for (const code of h.states) {
        assert.ok(ALL_STATE_CODES.includes(code), `kod negeri tidak dikenali "${code}" dalam ${h.name}`);
      }
    }
  }
});
