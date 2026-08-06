// URL asas untuk pautan yang dihantar KELUAR melalui emel (jemputan editor, set semula kata
// laluan). Sengaja BUKAN dibina daripada header permintaan.
//
// Sebelum ini kedua-dua laluan emel guna `${req.protocol}://${req.get('host')}`. Dengan
// `app.set('trust proxy', 1)` aktif (server.js — perlu untuk nginx), header Host/X-Forwarded-Host
// datang daripada PEMINTA, bukan daripada pelayan. Penyerang yang tahu emel seorang editor boleh
// memanggil /lupa-kata-laluan dengan Host yang dipalsukan; emel SAH yang dihantar kepada editor
// itu kemudian membawa token set-semula yang sah ke domain penyerang (serangan "password reset
// poisoning"). Editor klik pautan dalam emel yang dia memang jangka, token bocor.
//
// BASE_URL ditetapkan sekali dalam .env (cth https://brief.adjung.com). Sandaran localhost cuma
// untuk pembangunan tempatan — kalau ia muncul dalam emel produksi, itu tanda .env tak lengkap,
// dan lebih baik pautan nampak jelas salah daripada senyap-senyap boleh dieksploitasi.
export function baseUrlEmel() {
  const dariEnv = (process.env.BASE_URL || '').trim().replace(/\/+$/, '');
  if (dariEnv) return dariEnv;
  console.warn('AMARAN: BASE_URL tiada dalam .env — pautan emel akan guna localhost. Tetapkan BASE_URL sebelum deploy.');
  return `http://localhost:${process.env.PORT || 5000}`;
}

export default baseUrlEmel;
