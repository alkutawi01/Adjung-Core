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
const isIpDalamJulatPeribadi = (ip, family) => {
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true; // loopback
    if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (setara RFC1918)
    if (lower.startsWith('::ffff:')) {
      // IPv4-mapped — semak bahagian IPv4-nya.
      return isIpDalamJulatPeribadi(lower.replace('::ffff:', ''), 4);
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

export default sahkanUrlSelamatUntukFetch;
