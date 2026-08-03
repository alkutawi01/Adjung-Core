import nodemailer from 'nodemailer';

// Penghantar emel (2026-08-03, Fasa 1) — infrastruktur SMTP sebenar (Hostinger) untuk jemputan
// editor baharu & set semula kata laluan sendiri. Dahulu dua aliran ni tak boleh dibina langsung
// sebab tiada perkhidmatan emel sambung (lihat PELAN_PRA_LAUNCH.md Fasa 1).
//
// Toleransi konfigurasi hilang (sama prinsip macam kegagalan ambilan RSS — log dan teruskan,
// jangan ranapkan pelayan): jika SMTP_HOST/SMTP_USER/SMTP_PASS tak ditetapkan di .env (cth
// semasa pembangunan tempatan sebelum Izzat konfigur pengeluaran), hantarEmel() jadi no-op
// selamat (kembalikan { berjaya: false }) berbanding baling ralat yang ranapkan permintaan.

let transporter = null;
let amaranDipaparkan = false;

function konfigSmtpLengkap() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function paparAmaranSekali() {
  if (!amaranDipaparkan) {
    console.warn('Amaran: SMTP belum dikonfigurasi — emel jemputan/reset kata laluan tak akan dihantar.');
    amaranDipaparkan = true;
  }
}

function dapatkanTransporter() {
  if (!konfigSmtpLengkap()) {
    paparAmaranSekali();
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true, // port 465 = TLS/SSL tersirat
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Paksa IPv4 (2026-08-03) — smtp.hostinger.com pulangkan rekod AAAA (IPv6) yang tak
      // boleh dicapai daripada Droplet DigitalOcean (cuma ada IPv4), ENETUNREACH lambat
      // (tersekat sehingga connection timeout) sebelum sambungan IPv4 dicuba. Paksa terus
      // elak percubaan IPv6 yang tahu pasti gagal.
      family: 4,
    });
  }
  return transporter;
}

// Panggil sekali semasa mula pelayan (server.js) supaya amaran kelihatan awal dalam log
// walaupun tiada emel dihantar dalam sesi permulaan tu.
export function semakKonfigSmtpStartup() {
  if (!konfigSmtpLengkap()) paparAmaranSekali();
}

export async function hantarEmel({ to, subject, html }) {
  const t = dapatkanTransporter();
  if (!t) return { berjaya: false, sebab: 'smtp_tidak_dikonfigurasi' };
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || '"Adjung Brief" <editorial@adjung.com>',
      to,
      subject,
      html,
    });
    return { berjaya: true };
  } catch (err) {
    console.error('Gagal menghantar emel:', err.message);
    return { berjaya: false, sebab: err.message };
  }
}
