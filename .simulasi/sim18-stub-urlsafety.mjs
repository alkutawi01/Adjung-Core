// Rintik (stub) khusus SIM 18 — gantian ujian bagi core/utils/urlSafety.js, disuntik oleh
// sim18-loader-urlsafety-stub.mjs. Lulus SEMUA URL tanpa semakan SSRF supaya executeDirectRssFetch()
// boleh diuji terus terhadap pelayan RSS palsu tempatan (127.0.0.1). TIDAK PERNAH digunakan oleh
// kod pengeluaran sebenar — loader hanya aktif bila sim18 dijalankan dengan --loader eksplisit.
export class RalatUrlTakSelamat extends Error {}

export async function sahkanUrlSelamatUntukFetch(url) {
  return { selamat: true, alamat: [] };
}

export async function fetchSelamat(url, options = {}) {
  const { dispatcher, ...rest } = options;
  return fetch(url, rest);
}

export default sahkanUrlSelamatUntukFetch;
