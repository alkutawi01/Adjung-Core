import dns from 'node:dns/promises';
import net from 'node:net';

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
    return { selamat: false, sebab: 'Nama hos ni disekat (alamat pelayan tempatan).' };
  }

  // Hos itu sendiri IP literal — semak terus tanpa DNS.
  if (net.isIP(hos)) {
    if (isIpDalamJulatPeribadi(hos, net.isIP(hos))) {
      return { selamat: false, sebab: 'Alamat IP ni dalam julat peribadi/dalaman, disekat.' };
    }
    return { selamat: true };
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
      return { selamat: false, sebab: 'Domain ni menyelesaikan kepada alamat IP peribadi/dalaman, disekat.' };
    }
  }
  return { selamat: true };
}

export default sahkanUrlSelamatUntukFetch;
