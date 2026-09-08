// Parser respons API selamat (2026-08-09, P2 Pusingan 3 VR-01) — `res.json()` gagal senyap
// (proksi timeout, 502 HTML, sambungan putus separuh jalan) melempar SyntaxError mentah
// ("Unexpected token < in JSON") terus kepada pemanggil, yang kerap jatuh sebagai
// `e.message || 'mesej Melayu'` — raw JS/HTML error terpapar terus dalam MesejStatus.
//
// Helper ni tangkap kegagalan parse di SATU tempat: log butiran teknikal penuh ke konsol
// (debug dalaman sahaja, tak dipapar pengguna), lempar Error mesej Melayu bersih supaya
// laluan catch() sedia ada di setiap pemanggil (yang sudah betul di semua tempat) sentiasa
// dapat mesej selamat untuk dipapar. Tidak ubah gelagat apabila JSON sah — hanya lapisan
// keselamatan untuk kes respons rosak/bukan-JSON.
export async function bacaJsonSelamat(res: Response, mesejGagal = 'Gagal membaca respons pelayan.'): Promise<any> {
  try {
    return await res.json();
  } catch (err) {
    console.error('bacaJsonSelamat: respons pelayan bukan JSON sah', { status: res.status, url: res.url, err });
    throw new Error(mesejGagal);
  }
}

// Pelengkap bacaJsonSelamat() di atas — bug SAMA punca, lokasi BERBEZA (2026-09-08).
// bacaJsonSelamat() tangkap kegagalan res.json() SELEPAS fetch() berjaya sambung ke pelayan.
// Tapi fetch() itu SENDIRI juga boleh gagal (offline, DNS putus, CORS, pelayan mati terus)
// — ini melempar TypeError browser MENTAH ("Failed to fetch" Chrome, "NetworkError when
// attempting to fetch resource" Firefox/Safari) SEBELUM res wujud pun. Corak pemanggil di
// seluruh Editorium ialah `catch (err) { setRalat(err.message || 'mesej Melayu') }` — sebab
// TypeError.message tu SENTIASA ada nilai (bukan falsy), fallback Melayu tidak pernah
// tercapai, teks Inggeris mentah bocor terus ke UI Bahasa Melayu (langgar CLAUDE.md).
// Helper ni gantikan corak `err.message || 'mesej lalai'` — kesan sama bila err ialah ralat
// pelayan biasa (Error dgn mesej Melayu sedia ada, cth dari bacaJsonSelamat/throw manual),
// tapi tapis TypeError rangkaian mentah drpd browser kepada mesej Melayu generik.
export function mesejRalat(err: any, mesejLalai: string): string {
  if (err instanceof TypeError) {
    console.error('mesejRalat: fetch() gagal (rangkaian/CORS), mesej browser mentah ditapis', err);
    return 'Sambungan rangkaian terputus. Sila semak sambungan anda dan cuba lagi.';
  }
  return err?.message || mesejLalai;
}
