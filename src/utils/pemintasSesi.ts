// Pemintas 401 global (2026-08-07, Audit UI/UX Editorium §D1). Sebelum ni TIADA pemintas
// langsung — setiap konsol Editorium mengendalikan sesi tamat SENDIRI-SENDIRI, jadi apabila sesi
// 12 jam luput, sesetengah panel papar "Sesi anda telah tamat" dan sesetengah mereput senyap.
// Pada masa sama `authUser` masih tersimpan dalam localStorage, jadi header terus memaparkan nama
// editor dengan titik hijau "aktif" dan borang log masuk tidak pernah terbuka sendiri.
//
// Pendekatan: satu balutan `fetch` global memeriksa SETIAP respons 401. Bukan semua 401 bermakna
// sesi tamat — log masuk gagal (kata laluan salah) dan kata laluan semasa tak tepat (tukar akaun)
// turut pulangkan 401 dengan mesej BERBEZA. Auth middleware (`core/middleware/auth.js`) SATU-
// SATUNYA punca yang pulangkan `message: 'Log masuk diperlukan.'` — itulah penanda dipercayai.
// Turut disyaratkan storan sesi tempatan WUJUD (`adjung-auth-user`) supaya pelawat awam yang tak
// pernah log masuk tak tercetus modal log masuk tanpa sebab hanya kerana laluan awam pulangkan
// 401 (tak berlaku sekarang, tapi jaring keselamatan murah).
const KUNCI_AUTH = 'adjung-auth-user';
const MESEJ_SESI_TAMAT = 'Log masuk diperlukan.';
export const PERISTIWA_SESI_TAMAT = 'adjung:sesi-tamat';

let dipasang = false;

export function pasangPemintasSesi() {
  if (dipasang || typeof window === 'undefined') return;
  dipasang = true;

  const fetchAsal = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await fetchAsal(...args);
    if (res.status === 401) {
      const adaSesiTersimpan =
        window.localStorage.getItem(KUNCI_AUTH) || window.sessionStorage.getItem(KUNCI_AUTH);
      if (adaSesiTersimpan) {
        res
          .clone()
          .json()
          .then((data) => {
            if (data && data.message === MESEJ_SESI_TAMAT) {
              window.dispatchEvent(new CustomEvent(PERISTIWA_SESI_TAMAT));
            }
          })
          .catch(() => { /* respons 401 bukan JSON — bukan urusan pemintas ni */ });
      }
    }
    return res;
  };
}
