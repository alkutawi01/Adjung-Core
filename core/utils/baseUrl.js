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

// Semak sekali semasa mula pelayan (Gate 4, audit ChatGPT 2026-08-08) — dahulu amaran BASE_URL
// tiada cuma console.warn(), jadi hanya kelihatan kepada sesiapa yang SSH terus ke pelayan
// (Ketua Editor/Pentadbir tak pernah nampak). Sama corak macam semakKonfigSmtpStartup
// (MailSender.js) — tapi khusus digerbangkan pada emel BENAR-BENAR aktif (RESEND_API_KEY
// wujud) DAN produksi (NODE_ENV=production), supaya pembangunan tempatan tak sentiasa
// bising. Rekod ke Log Audit (bukan notifikasi Peti Makluman) — ini isu konfigurasi
// deployment, bukan peristiwa editorial, jadi Log Sistem (bukan Peti Makluman) tempat yang
// betul untuk seseorang menyiasat "kenapa pautan emel pelik".
export async function semakKonfigBaseUrlStartup(logAudit, dbRun) {
  const dariEnv = (process.env.BASE_URL || '').trim();
  const produksi = process.env.NODE_ENV === 'production';
  const emelAktif = !!process.env.RESEND_API_KEY;
  if (dariEnv || !produksi || !emelAktif) return;
  console.error('RALAT KONFIGURASI: BASE_URL tiada dalam .env production sedangkan emel (RESEND_API_KEY) aktif — pautan emel sebenar (jemputan/reset kata laluan) akan pecah dengan localhost.');
  try {
    await logAudit(dbRun, {
      action: 'konfigurasi-base-url-tiada',
      targetType: 'server',
      detail: 'BASE_URL tiada dalam .env production sedangkan RESEND_API_KEY aktif — pautan emel akan guna localhost dan pecah.',
    });
  } catch (e) {
    console.error('Gagal rekod audit BASE_URL tiada:', e.message);
  }
}

export default baseUrlEmel;
