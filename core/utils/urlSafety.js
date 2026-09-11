import dns from 'node:dns/promises';
import net from 'node:net';
import { Agent, fetch as fetchUndici } from 'undici';

// Sekatan SSRF (2026-08-08, audit keselamatan — laporan luaran) — sebelum ni satu-satunya
// pengesahan URL sumber (RSS berdaftar, senarai rujukan slot pipeline AI, pengesahan pautan
// citation) ialah `url.startsWith('http')`. Editor mana-mana yang boleh daftar sumber RSS
// (kebenaran manageEditorial) atau isi senarai rujukan slot boleh masukkan URL alamat dalaman
// (http://localhost:3000/..., http://127.0.0.1/..., http://169.254.169.254/latest/meta-data/ —
// perkhidmatan metadata cloud) dan pelayan akan cuba mengambilnya — sekurang-kurangnya "blind
// SSRF" (pelayan dedah wujud/tak-wujud servis dalaman), berpotensi lebih teruk kalau kandungan
// respons tu terus dipaparkan/diproses (lihat SourceFetcher.js/EditorialPipeline.js).
//
// Pendekatan: selain sekat rentetan hos yang jelas (localhost, IP peribadi/loopback/link-local),
// SELESAIKAN nama domain kepada IP sebenar dan semak IP tu — bukan sekadar nama hos yang
// ditaip — supaya domain yang direka khas untuk "DNS rebinding" (rekod A menghala ke IP dalaman)
// turut disekat, bukan hanya lolos disebabkan namanya bukan "localhost" secara literal.
// kembangIpv6 (dapatan bug-hunt 2026-09-12, susulan terus pembetulan 100.64.0.0/10 di bawah) —
// semakan asal cuma tangkap alamat IPv4-tertanam kalau rentetan LITERAL bermula `::ffff:` tepat.
// Tapi format tu bukan satu-satunya cara sah tulis IPv4-tertanam dalam IPv6 — `::127.0.0.1`
// (bentuk mampatan `::`, tanpa `ffff:`), `0:0:0:0:0:0:127.0.0.1` (bentuk penuh tak dimampatkan),
// dan `0:0:0:0:0:ffff:127.0.0.1` (bentuk penuh DENGAN `ffff`) SEMUANYA rentetan IPv6 sah yang
// diselesaikan `net.isIP()`/DNS AAAA kepada 127.0.0.1 sama persis — disahkan `net.isIP()` Node
// pulangkan 6 (sah) untuk kesemuanya — tapi TIADA satu pun bermula literal `::ffff:`, jadi semua
// LOLOS semakan lama sebagai "bukan peribadi" walaupun sebenarnya loopback/RFC1918/dsb. Editor
// yang daftar sumber RSS/rujukan boleh guna hos literal `[::127.0.0.1]` atau domain dengan rekod
// AAAA dalam bentuk ni untuk terus memintas sekatan SSRF sepenuhnya. Fungsi ni kembangkan
// MANA-MANA rentetan IPv6 sah kepada 8 kumpulan hex penuh (uruskan mampatan `::` di mana jua ia
// berlaku, dan kumpulan terakhir dalam format bertitik IPv4), supaya pengesanan IPv4-tertanam
// tak lagi bergantung pada SATU corak rentetan literal.
function kembangIpv6(ip) {
  let mentah = ip;
  let ekorIpv4 = null;
  const kedudukanTitikTerakhir = mentah.lastIndexOf(':');
  const bahagianEkor = mentah.slice(kedudukanTitikTerakhir + 1);
  if (bahagianEkor.includes('.')) {
    // Kumpulan terakhir dalam format bertitik (cth "...::127.0.0.1") — tukar ke 2 kumpulan hex.
    const oktet = bahagianEkor.split('.').map(Number);
    if (oktet.length !== 4 || oktet.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
    ekorIpv4 = oktet;
    mentah = mentah.slice(0, kedudukanTitikTerakhir + 1) +
      ((oktet[0] << 8) | oktet[1]).toString(16) + ':' +
      ((oktet[2] << 8) | oktet[3]).toString(16);
  }
  const bahagianMampat = mentah.split('::');
  if (bahagianMampat.length > 2) return null; // lebih daripada satu `::` — tak sah
  let kiri = bahagianMampat[0] ? bahagianMampat[0].split(':') : [];
  let kanan = bahagianMampat.length === 2 && bahagianMampat[1] ? bahagianMampat[1].split(':') : [];
  kiri = kiri.filter((s) => s !== '');
  kanan = kanan.filter((s) => s !== '');
  const jumlahHilang = 8 - (kiri.length + kanan.length);
  if (bahagianMampat.length === 1 && jumlahHilang !== 0) return null; // tiada `::` tapi bukan 8 kumpulan
  if (jumlahHilang < 0) return null;
  const kumpulanTengah = bahagianMampat.length === 2 ? new Array(jumlahHilang).fill('0') : [];
  const kumpulanPenuh = [...kiri, ...kumpulanTengah, ...kanan];
  if (kumpulanPenuh.length !== 8) return null;
  const nilaiHex = kumpulanPenuh.map((s) => parseInt(s || '0', 16));
  if (nilaiHex.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
  return { kumpulan: nilaiHex, ekorIpv4 };
}

const isIpDalamJulatPeribadi = (ip, family) => {
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true; // loopback
    if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (setara RFC1918)
    // Semak SEMUA notasi IPv4-tertanam (bukan cuma corak literal `::ffff:`) — lihat komen
    // kembangIpv6() di atas. Kumpulan 0-5 (96 bit pertama) sifar bermakna 32 bit terakhir
    // ialah alamat IPv4 tertanam (mampat `::x.x.x.x` ATAU bentuk penuh tak dimampatkan
    // `0:0:0:0:0:[ffff]:x.x.x.x`) — semak bahagian IPv4 tu ikut peraturan IPv4 sedia ada.
    const dikembang = kembangIpv6(lower);
    if (dikembang && dikembang.kumpulan.slice(0, 5).every((n) => n === 0) &&
        (dikembang.kumpulan[5] === 0 || dikembang.kumpulan[5] === 0xffff)) {
      const [g6, g7] = [dikembang.kumpulan[6], dikembang.kumpulan[7]];
      const a = (g6 >> 8) & 0xff, b = g6 & 0xff, c = (g7 >> 8) & 0xff, d = g7 & 0xff;
      // Elak salah tangkap alamat "unspecified" (::) / IPv4-compatible sifar (::0.0.0.0) yang
      // bukan IPv4 tertanam sebenar — kalau 32 bit terakhir pun sifar sepenuhnya DAN bukan
      // representasi eksplisit `0.0.0.0`, ia cuma `::`, biar laluan lain tangani.
      return isIpDalamJulatPeribadi(`${a}.${b}.${c}.${d}`, 4);
    }
    // Awalan NAT64/DNS64 "well-known" 64:ff9b::/96 (RFC 6052) — dapatan susulan pass bug-hunt ni
    // (2026-09-12), corak sama macam semakan IPv4-tertanam di atas tapi awalan BERBEZA. Rangkaian
    // IPv6-sahaja (biasa pada banyak infrastruktur awan/rangkaian mudah alih moden) guna gateway
    // NAT64 yang secara telus terjemah 64:ff9b::a.b.c.d KEPADA sambungan sebenar ke a.b.c.d IPv4 —
    // ni BUKAN sekadar notasi alternatif macam ::ffff:/::(mampat) di atas, ia laluan RANGKAIAN
    // sebenar (disintesis DNS64/gateway NAT64) yang menghala terus ke alamat IPv4 tertanam tu.
    // Domain jahat/editor nakal boleh daftar rekod AAAA 64:ff9b::7f00:1 (127.0.0.1) atau
    // 64:ff9b::a9fe:a9fe (169.254.169.254, metadata awan) — semakan awalan-sifar di atas TAK
    // tangkap awalan ni langsung (group[0]=0x0064, group[1]=0xff9b, bukan sifar), jadi ia lolos
    // sebagai "alamat awam" walhal sambungan sebenar (pada rangkaian bergateway NAT64) berakhir
    // di IP dalaman/loopback yang sepatutnya disekat. Sama semakan bahagian IPv4 tertanam
    // (group 6-7) macam di atas, awalan tetap group 0-5 = [0x0064, 0xff9b, 0, 0, 0, 0].
    if (dikembang && dikembang.kumpulan[0] === 0x0064 && dikembang.kumpulan[1] === 0xff9b &&
        dikembang.kumpulan[2] === 0 && dikembang.kumpulan[3] === 0 &&
        dikembang.kumpulan[4] === 0 && dikembang.kumpulan[5] === 0) {
      const [g6, g7] = [dikembang.kumpulan[6], dikembang.kumpulan[7]];
      const a = (g6 >> 8) & 0xff, b = g6 & 0xff, c = (g7 >> 8) & 0xff, d = g7 & 0xff;
      return isIpDalamJulatPeribadi(`${a}.${b}.${c}.${d}`, 4);
    }
    return false;
  }
  const bahagian = ip.split('.').map(Number);
  if (bahagian.length !== 4 || bahagian.some((n) => Number.isNaN(n))) return true; // format pelik — sekat, jangan cuba teka
  const [a, b] = bahagian;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local, termasuk metadata cloud (169.254.169.254)
  // 100.64.0.0/10 (RFC 6598, "Shared Address Space"/CGNAT) — dapatan bug-hunt (2026-09-12).
  // Julat ni SENGAJA bukan RFC1918 (jadi tak ditangkap semakan 10/172.16-31/192.168 di atas),
  // tapi ia BUKAN alamat awam sebenar — ISP guna untuk CGNAT DAN beberapa pembekal awan guna
  // untuk metadata/rangkaian dalaman perkhidmatan (cth metadata Alibaba Cloud ECS terletak di
  // 100.100.100.200, di luar julat 169.254.169.254 yang lazim). Editor yang daftar sumber
  // RSS/URL rujukan/citation boleh menghala domain (DNS rebinding atau IP literal) ke julat ni
  // dan pelayan (mana-mana dihoskan atas infrastruktur yang letak metadata/servis dalaman di
  // sini) akan cuba mengambilnya — sama kelas risiko SSRF metadata cloud yang 169.254.169.254 di
  // atas sengaja disekat, cuma julat CIDR berbeza yang sebelum ni terlepas pandang.
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 0) return true; // "this network"
  return false;
};

const HOS_DISEKAT_LITERAL = new Set(['localhost', 'localhost.localdomain', '0.0.0.0', '::1']);

/**
 * Sahkan URL selamat untuk pelayan ambil sendiri (fetch pelayan-ke-pelayan) — dipanggil SEBELUM
 * apa-apa fetch() ke URL yang datang daripada input editor (sumber RSS, senarai rujukan slot,
 * pengesahan pautan citation). Pulangkan `{ selamat: boolean, sebab?: string }`.
 */
export async function sahkanUrlSelamatUntukFetch(url) {
  if (!url || typeof url !== 'string') return { selamat: false, sebab: 'URL kosong.' };

  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    return { selamat: false, sebab: 'Format URL tidak sah.' };
  }

  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    return { selamat: false, sebab: 'Cuma URL http:// atau https:// dibenarkan.' };
  }

  const hos = urlObj.hostname.toLowerCase();
  if (HOS_DISEKAT_LITERAL.has(hos)) {
    return { selamat: false, sebab: 'Nama hos ini disekat (alamat pelayan tempatan).' };
  }

  // Hos itu sendiri IP literal — semak terus tanpa DNS.
  if (net.isIP(hos)) {
    if (isIpDalamJulatPeribadi(hos, net.isIP(hos))) {
      return { selamat: false, sebab: 'Alamat IP ini dalam julat peribadi/dalaman, disekat.' };
    }
    // `alamat` disertakan (2026-09-03, dapatan bug-hunt — lihat nota DNS-rebinding di
    // fetchSelamat() di bawah) supaya pemanggil boleh KUNCI sambungan sebenar ke IP yang BARU
    // disahkan ini, bukan biar fetch() buat resolusi DNS/parse hos KEDUA secara berasingan.
    return { selamat: true, alamat: [{ address: hos, family: net.isIP(hos) }] };
  }

  // Nama domain — selesaikan SEMUA rekod (IPv4 + IPv6) dan sekat kalau MANA-MANA satu jatuh
  // dalam julat peribadi (pertahanan DNS rebinding, bukan cuma alamat pertama).
  let alamat;
  try {
    alamat = await dns.lookup(hos, { all: true, verbatim: true });
  } catch {
    return { selamat: false, sebab: 'Nama domain tidak dapat diselesaikan.' };
  }
  if (!alamat || alamat.length === 0) {
    return { selamat: false, sebab: 'Nama domain tidak dapat diselesaikan.' };
  }
  for (const { address, family } of alamat) {
    if (isIpDalamJulatPeribadi(address, family)) {
      return { selamat: false, sebab: 'Domain ini menyelesaikan kepada alamat IP peribadi/dalaman, disekat.' };
    }
  }
  // `alamat` (senarai penuh rekod yang BARU disahkan selamat) disertakan dalam respons supaya
  // fetchSelamat() boleh kunci sambungan terus ke alamat-alamat INI — lihat nota panjang di situ.
  return { selamat: true, alamat };
}

const HAD_PELENCONGAN_LALAI = 5;

/** Ralat khas — pelencongan (redirect) URL menghala ke alamat tak selamat, ATAU terlalu banyak
 *  pelencongan berturut-turut. Pemanggil boleh tangkap `err instanceof RalatUrlTakSelamat` untuk
 *  bezakan daripada ralat rangkaian biasa (tamat masa, DNS gagal, dsb.). */
export class RalatUrlTakSelamat extends Error {}

// Kunci sambungan terus ke alamat IP yang BARU disahkan (2026-09-03, dapatan bug-hunt, diluluskan
// Izzat) — menutup jurang "DNS rebinding" TOCTOU yang tinggal selepas pembetulan pelencongan
// 2026-08-08 di bawah. Sebelum ni `sahkanUrlSelamatUntukFetch()` selesaikan nama domain (dns.lookup)
// untuk SEMAK IP, tapi `fetch()` yang menyusul buat resolusi DNS SENDIRI, BERASINGAN, semasa
// sambungan sebenar dibuat — domain jahat dengan TTL rendah boleh pulangkan IP AWAM masa semakan
// (lulus), kemudian pulangkan IP DALAMAN (169.254.169.254, 127.0.0.1, dsb.) masa sambungan sebenar
// beberapa milisaat kemudian (dua carian DNS berasingan, jawapan BOLEH berbeza). Pemeriksaan dan
// sambungan sebenar mesti guna IP yang SAMA PERSIS, bukan cuma nama hos yang sama.
//
// Diselesaikan dengan "pin" (kunci) sambungan terus ke senarai IP yang BARU disahkan
// sahkanUrlSelamatUntukFetch(), guna Agent undici dengan `connect.lookup` disara ganti — lookup
// pilihan ni langsung TAK buat carian DNS baharu, ia cuma pulangkan semula senarai alamat yang
// SUDAH disahkan (fungsi Agent ni sekali pakai, dicipta sekali untuk SATU hos sahaja bagi SATU
// percubaan sambungan, ditutup lepas selesai — bukan dikongsi rentas permintaan).
function buatDispatcherTerkunci(hostnameDijangka, senaraiAlamat) {
  const hosLower = hostnameDijangka.toLowerCase();
  return new Agent({
    connect: {
      lookup: (hostnameDiminta, opsyen, callback) => {
        if ((hostnameDiminta || '').toLowerCase() !== hosLower) {
          // Sepatutnya TIDAK PERNAH berlaku — Agent ni dicipta khusus untuk SATU hos sahaja,
          // sekali pakai bagi SATU percubaan sambungan. Gagal selamat (tolak) kalau entah
          // bagaimana ada percubaan sambung ke hos LAIN melalui Agent terkunci ni.
          callback(new Error(`Cubaan sambung ke hos tidak dijangka: ${hostnameDiminta}`));
          return;
        }
        callback(null, senaraiAlamat.map(({ address, family }) => ({ address, family })));
      },
    },
  });
}

/**
 * Ganti terus `fetch()` untuk apa-apa URL yang datang daripada input editor (sumber RSS, senarai
 * rujukan slot, URL citation AI, semakan pautan mati) — sahkanUrlSelamatUntukFetch() SAHAJA
 * (dipanggil sebelum fetch pertama) tak cukup: URL luaran yang lulus semakan awal masih boleh
 * 302 ke `http://127.0.0.1/...` dan `fetch({redirect:'follow'})` akan ikut terus tanpa sesahkan
 * semula sasaran (2026-08-08, dapatan audit keselamatan ChatGPT P1-02). Fungsi ni sahkan SETIAP
 * URL dalam rantaian pelencongan (bukan cuma yang pertama) sebelum diikuti, dengan had bilangan
 * pelencongan supaya tak berputar tanpa henti. Setiap hop turut KUNCI sambungan ke IP yang
 * disahkan bagi hop tu (lihat buatDispatcherTerkunci() di atas — pertahanan DNS-rebinding).
 *
 * Guna `fetch` undici (bukan `fetch` bawaan Node global) SEMATA-MATA supaya boleh hantar
 * `dispatcher` tersuai — dua-dua sebenarnya pelaksanaan SAMA (fetch bawaan Node dibina atas
 * undici), jadi kelakuan tak berbeza untuk pemanggil sedia ada.
 */
export async function fetchSelamat(url, options = {}, { hadPelencongan = HAD_PELENCONGAN_LALAI } = {}) {
  let urlSemasa = url;
  for (let cubaan = 0; cubaan <= hadPelencongan; cubaan++) {
    const semakan = await sahkanUrlSelamatUntukFetch(urlSemasa);
    if (!semakan.selamat) {
      throw new RalatUrlTakSelamat(semakan.sebab);
    }
    const hostnameSemasa = new URL(urlSemasa).hostname;
    const dispatcher = buatDispatcherTerkunci(hostnameSemasa, semakan.alamat);
    let res;
    try {
      res = await fetchUndici(urlSemasa, { ...options, redirect: 'manual', dispatcher });
    } finally {
      // close() (bukan destroy()) — biar permintaan/respons yang sedang diproses (cth res.text()
      // pemanggil selepas fungsi ni pulang) selesai dahulu sebelum soket benar-benar ditutup;
      // Agent ni sekali pakai (tak dikongsi), jadi tiada kesan kepada permintaan lain.
      dispatcher.close().catch(() => {});
    }
    const lokasi = (res.status >= 300 && res.status < 400) ? res.headers.get('location') : null;
    if (!lokasi) return res;
    try {
      urlSemasa = new URL(lokasi, urlSemasa).toString();
    } catch {
      throw new RalatUrlTakSelamat('Pelencongan (redirect) ke URL tidak sah.');
    }
  }
  throw new RalatUrlTakSelamat(`Terlalu banyak pelencongan (redirect), disekat selepas ${hadPelencongan} kali.`);
}

// tetTeksBerhad (2026-09-09, bug-hunt suapan RSS) — `await response.text()` bawaan buffer
// SELURUH badan respons dalam memori tanpa had, tak kira apa Content-Length nyatakan (header tu
// boleh ditinggalkan/dipalsukan pihak sumber). executeDirectRssFetch() (slotRoutes.js) panggil
// `response.text()` terus atas respons SETIAP sumber RSS berdaftar, jalan automatik 3 jam sekali
// (Promise.allSettled, semua sumber serentak) — SATU sumber (didaftar sah oleh editor tapi
// kemudian dipintas/rosak/pelayan-nya sendiri bermasalah) yang menghantar respons gergasi (cth
// beratus MB, sengaja atau kerana pepijat pelayan hulu) boleh membengkakkan memori proses Node
// SEHINGGA nyahstabil keseluruhan pelayan Adjung Brief — bukan cuma satu sumber tu gagal senyap
// macam sepatutnya (falsafah sedia ada laluan ni, lihat catch(fetchErr) di bawah). Fungsi ni baca
// respons secara STREAM (bukan tunggu keseluruhan), kira bait SEBENAR yang tiba, dan HENTIKAN
// bacaan sebaik had dilampaui — dilontar sebagai RalatUrlTakSelamat supaya laluan panggilan sedia
// ada (catch generik + log Audit + amaran Pentadbir/Ketua Editor) terus tangani ia sama seperti
// kegagalan rangkaian lain, TANPA ubah tingkah laku laluan tu.
export async function tetTeksBerhad(response, { hadBait = 10 * 1024 * 1024 } = {}) {
  const reader = response.body && typeof response.body.getReader === 'function'
    ? response.body.getReader()
    : null;
  // Tiada ReadableStream (persekitaran/pemalsuan ujian tak sokong) — jatuh balik ke response.text()
  // biasa, tiada regresi berbanding kelakuan sedia ada.
  if (!reader) return response.text();

  const decoder = new TextDecoder();
  let jumlahBait = 0;
  let teks = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      jumlahBait += value.byteLength;
      if (jumlahBait > hadBait) {
        throw new RalatUrlTakSelamat(`Respons melebihi had ${hadBait} bait, ambilan dibatalkan.`);
      }
      teks += decoder.decode(value, { stream: true });
    }
    teks += decoder.decode();
    return teks;
  } finally {
    try { await reader.cancel(); } catch {}
  }
}

export default sahkanUrlSelamatUntukFetch;
