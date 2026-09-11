import test from 'node:test';
import assert from 'node:assert/strict';
import { sahkanUrlSelamatUntukFetch } from '../core/utils/urlSafety.js';

// Dapatan bug-hunt 2026-09-12: isIpDalamJulatPeribadi() lama cuma kesan IPv4-tertanam dalam
// IPv6 kalau rentetan bermula literal `::ffff:` — bentuk sah LAIN yang diselesaikan Node
// (net.isIP) kepada alamat IPv4 SAMA tak ditangkap, jadi hos IPv6 dalam bentuk ni memintas
// sekatan SSRF sepenuhnya. Ujian ni sahkan fetchSelamat/sahkanUrlSelamatUntukFetch sekat
// KESEMUA bentuk notasi yang sepadan IPv4 peribadi/dalaman yang sama.

test('urlSafety - sekat loopback IPv6 bentuk mampatan `::x.x.x.x` (bukan cuma `::ffff:`)', async () => {
  const hasil = await sahkanUrlSelamatUntukFetch('http://[::127.0.0.1]/');
  assert.equal(hasil.selamat, false);
});

test('urlSafety - sekat loopback IPv6 bentuk penuh tak dimampatkan (tanpa ffff)', async () => {
  const hasil = await sahkanUrlSelamatUntukFetch('http://[0:0:0:0:0:0:127.0.0.1]/');
  assert.equal(hasil.selamat, false);
});

test('urlSafety - sekat loopback IPv6 bentuk penuh tak dimampatkan (dengan ffff)', async () => {
  const hasil = await sahkanUrlSelamatUntukFetch('http://[0:0:0:0:0:ffff:127.0.0.1]/');
  assert.equal(hasil.selamat, false);
});

test('urlSafety - sekat metadata cloud (169.254.169.254) tertanam bentuk mampatan', async () => {
  const hasil = await sahkanUrlSelamatUntukFetch('http://[::169.254.169.254]/');
  assert.equal(hasil.selamat, false);
});

test('urlSafety - sekat RFC1918 (10.x) tertanam bentuk mampatan `::ffff:`', async () => {
  // Corak sedia ada — pastikan pembetulan tak regresi kes yang dahulu sudah betul.
  const hasil = await sahkanUrlSelamatUntukFetch('http://[::ffff:10.0.0.1]/');
  assert.equal(hasil.selamat, false);
});

test('urlSafety - benarkan IPv6 awam yang tak tertanam IPv4 peribadi', async () => {
  const hasil = await sahkanUrlSelamatUntukFetch('http://[2606:4700:4700::1111]/');
  assert.equal(hasil.selamat, true);
});

test('urlSafety - `::` (unspecified) sendiri kekal disekat oleh laluan lain', async () => {
  const hasil = await sahkanUrlSelamatUntukFetch('http://[::]/');
  assert.equal(hasil.selamat, false);
});

// Susulan pass bug-hunt (2026-09-12), lepas semakan bentuk-notasi di atas: awalan NAT64/DNS64
// "well-known" 64:ff9b::/96 (RFC 6052) ialah laluan RANGKAIAN sebenar (bukan sekadar notasi
// alternatif) — rangkaian bergateway NAT64 terjemah 64:ff9b::a.b.c.d terus ke sambungan IPv4
// a.b.c.d. Semakan awalan-sifar (::x.x.x.x / ::ffff:x.x.x.x) di atas TAK tangkap awalan ni
// (group 0-1 = 0x0064/0xff9b, bukan sifar), jadi lolos sebagai "IPv6 awam" walhal sambungan
// sebenar berakhir di IP dalaman/loopback tertanam.
test('urlSafety - sekat loopback (127.0.0.1) tertanam awalan NAT64 64:ff9b::/96', async () => {
  const hasil = await sahkanUrlSelamatUntukFetch('http://[64:ff9b::7f00:1]/');
  assert.equal(hasil.selamat, false);
});

test('urlSafety - sekat metadata cloud (169.254.169.254) tertanam awalan NAT64 64:ff9b::/96', async () => {
  const hasil = await sahkanUrlSelamatUntukFetch('http://[64:ff9b::a9fe:a9fe]/');
  assert.equal(hasil.selamat, false);
});

test('urlSafety - benarkan alamat awam (8.8.8.8) tertanam awalan NAT64, tak regresi kes sah', async () => {
  const hasil = await sahkanUrlSelamatUntukFetch('http://[64:ff9b::808:808]/');
  assert.equal(hasil.selamat, true);
});
