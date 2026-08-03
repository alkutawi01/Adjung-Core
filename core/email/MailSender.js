// Penghantar emel (2026-08-03, Fasa 1) — jemputan editor baharu & set semula kata laluan
// sendiri. Dahulu dua aliran ni tak boleh dibina langsung sebab tiada perkhidmatan emel
// sambung (lihat PELAN_PRA_LAUNCH.md Fasa 1).
//
// Guna Resend (API HTTPS), BUKAN SMTP langsung (2026-08-03, ditukar daripada percubaan
// SMTP Hostinger pertama) — DigitalOcean sekat SEMUA port SMTP keluar (465 DAN 587) secara
// lalai untuk Droplet baharu (dasar anti-spam standard mereka, disahkan: sambungan TCP
// mentah ke smtp.hostinger.com gagal terus pada kedua-dua port). Resend hantar emel via
// panggilan HTTPS biasa (port 443, sama macam semua trafik web lain) — terus elak sekatan
// SMTP tu sepenuhnya. Domain penghantar (`mail.adjung.com`) sudah disahkan di Resend.
//
// Toleransi konfigurasi hilang (sama prinsip macam kegagalan ambilan RSS — log dan teruskan,
// jangan ranapkan pelayan): jika RESEND_API_KEY tak ditetapkan di .env (cth semasa
// pembangunan tempatan sebelum Izzat konfigur pengeluaran), hantarEmel() jadi no-op selamat
// (kembalikan { berjaya: false }) berbanding baling ralat yang ranapkan permintaan.

let amaranDipaparkan = false;

function konfigResendLengkap() {
  return !!process.env.RESEND_API_KEY;
}

function paparAmaranSekali() {
  if (!amaranDipaparkan) {
    console.warn('Amaran: RESEND_API_KEY belum dikonfigurasi — emel jemputan/reset kata laluan tak akan dihantar.');
    amaranDipaparkan = true;
  }
}

// Panggil sekali semasa mula pelayan (server.js) supaya amaran kelihatan awal dalam log
// walaupun tiada emel dihantar dalam sesi permulaan tu.
export function semakKonfigSmtpStartup() {
  if (!konfigResendLengkap()) paparAmaranSekali();
}

export async function hantarEmel({ to, subject, html }) {
  if (!konfigResendLengkap()) {
    paparAmaranSekali();
    return { berjaya: false, sebab: 'resend_tidak_dikonfigurasi' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Adjung Brief <jemputan@mail.adjung.com>',
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const teks = await res.text().catch(() => '');
      throw new Error(`Resend API ${res.status}: ${teks}`);
    }
    return { berjaya: true };
  } catch (err) {
    console.error('Gagal menghantar emel:', err.message);
    return { berjaya: false, sebab: err.message };
  }
}
