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
