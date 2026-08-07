// Batalkan sesi aktif sesuatu akaun selepas kata laluannya ditukar (2026-08-07, Pelan 02 #11).
//
// Masalah sebenar: menukar kata laluan dahulu TIDAK menyentuh sesi yang sudah hidup dalam
// sessions.db, jadi sesiapa yang sudah log masuk dengan kata laluan LAMA (termasuk penceroboh
// yang mencetuskan aliran "lupa kata laluan" itu sendiri) kekal log masuk sehingga kuki luput —
// sampai 12 jam. Menukar kata laluan mesti bermakna mengusir semua sesi lain serta-merta.
//
// Stor sesi ialah jadual `sessions` (connect-sqlite3): sid, expired, sess — `sess` ialah JSON
// sesi penuh, jadi pemilik sesi cuma boleh ditentukan dengan menghuraikan JSON itu (tiada lajur
// userId untuk ditanya terus). Bilangan sesi kecil (sepasukan editor), jadi imbasan penuh murah.

let storSesi = null;

// Dipanggil sekali semasa but (server.js) selepas sessions.db dibuka.
export const daftarStorSesi = (sessionDb) => {
  storSesi = sessionDb;
};

export const padamSesiPengguna = (userId, sidDikecualikan = null) => new Promise((resolve) => {
  if (!storSesi || !userId) return resolve(0);
  storSesi.all('SELECT sid, sess FROM sessions', [], (err, rows) => {
    if (err) {
      // Best-effort: kegagalan membersihkan sesi tidak boleh menggagalkan penukaran kata laluan
      // yang SUDAH berjaya — cukup dicatat, bukan dilemparkan.
      console.error('Gagal membaca stor sesi untuk membatalkan sesi lama:', err.message);
      return resolve(0);
    }
    const sidUntukDipadam = [];
    for (const row of rows || []) {
      let sesi = null;
      try {
        sesi = JSON.parse(row.sess);
      } catch (e) {
        continue;
      }
      if (sesi && sesi.user && sesi.user.id === userId && row.sid !== sidDikecualikan) {
        sidUntukDipadam.push(row.sid);
      }
    }
    if (sidUntukDipadam.length === 0) return resolve(0);
    const tandaTanya = sidUntukDipadam.map(() => '?').join(', ');
    storSesi.run(`DELETE FROM sessions WHERE sid IN (${tandaTanya})`, sidUntukDipadam, (errPadam) => {
      if (errPadam) {
        console.error('Gagal memadam sesi lama selepas tukar kata laluan:', errPadam.message);
        return resolve(0);
      }
      resolve(sidUntukDipadam.length);
    });
  });
});
