import test from 'node:test';
import assert from 'node:assert/strict';
import { semakStatusToken, janaTokenTamatTempoh, STATUS_TOKEN } from '../core/auth/TokenLaluan.js';

test('TokenLaluan - semakStatusToken: userRow tiada -> tidak_wujud', () => {
  assert.equal(semakStatusToken(null), STATUS_TOKEN.TIDAK_WUJUD);
  assert.equal(semakStatusToken(undefined), STATUS_TOKEN.TIDAK_WUJUD);
});

test('TokenLaluan - semakStatusToken: resetToken kosong/null -> tidak_wujud', () => {
  assert.equal(semakStatusToken({ resetToken: null, resetTokenExpiresAt: null }), STATUS_TOKEN.TIDAK_WUJUD);
  assert.equal(semakStatusToken({ resetToken: '', resetTokenExpiresAt: '2099-01-01T00:00:00.000Z' }), STATUS_TOKEN.TIDAK_WUJUD);
});

test('TokenLaluan - semakStatusToken: token wujud tapi tiada tarikh tamat -> tamat_tempoh (jaring keselamatan)', () => {
  assert.equal(semakStatusToken({ resetToken: 'abc123', resetTokenExpiresAt: null }), STATUS_TOKEN.TAMAT_TEMPOH);
});

test('TokenLaluan - semakStatusToken: token sah, belum tamat tempoh -> sah', () => {
  const akanDatang = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  assert.equal(semakStatusToken({ resetToken: 'abc123', resetTokenExpiresAt: akanDatang }), STATUS_TOKEN.SAH);
});

test('TokenLaluan - semakStatusToken: token sudah tamat tempoh -> tamat_tempoh', () => {
  const lepas = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  assert.equal(semakStatusToken({ resetToken: 'abc123', resetTokenExpiresAt: lepas }), STATUS_TOKEN.TAMAT_TEMPOH);
});

test('TokenLaluan - semakStatusToken menghormati nowMs suntikan (bukan Date.now() sebenar)', () => {
  const tamat = '2026-08-05T00:00:00.000Z';
  const sebelum = new Date('2026-08-04T00:00:00.000Z').getTime();
  const selepas = new Date('2026-08-06T00:00:00.000Z').getTime();
  assert.equal(semakStatusToken({ resetToken: 'x', resetTokenExpiresAt: tamat }, sebelum), STATUS_TOKEN.SAH);
  assert.equal(semakStatusToken({ resetToken: 'x', resetTokenExpiresAt: tamat }, selepas), STATUS_TOKEN.TAMAT_TEMPOH);
});

test('TokenLaluan - semakStatusToken: tarikh tamat tidak sah (bukan tarikh) -> tamat_tempoh', () => {
  assert.equal(semakStatusToken({ resetToken: 'x', resetTokenExpiresAt: 'bukan-tarikh' }), STATUS_TOKEN.TAMAT_TEMPOH);
});

test('TokenLaluan - janaTokenTamatTempoh: 48 jam dari masa tertentu', () => {
  const dari = new Date('2026-08-03T00:00:00.000Z').getTime();
  const hasil = janaTokenTamatTempoh(48, dari);
  assert.equal(hasil, new Date('2026-08-05T00:00:00.000Z').toISOString());
});

test('TokenLaluan - janaTokenTamatTempoh: 2 jam untuk aliran lupa-kata-laluan', () => {
  const dari = new Date('2026-08-03T00:00:00.000Z').getTime();
  const hasil = janaTokenTamatTempoh(2, dari);
  assert.equal(hasil, new Date('2026-08-03T02:00:00.000Z').toISOString());
});
