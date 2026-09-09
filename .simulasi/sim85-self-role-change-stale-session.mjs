// SIMULASI 85 — PATCH /users/:id/roles pada AKAUN SENDIRI tak segarkan req.session.user.role
// (bug-hunt round 254, susulan #227 penName — kali ni field `role` [singular, legasi] bukannya
// `penName`).
//
// Konteks: PATCH /api/system/users/:id/roles (userAdminRoutes.js ~baris 625) SUDAH ada
// pengecualian sengaja (2026-09-03) yang tak padam sesi PEMANGGIL SENDIRI bila dia tukar
// peranan akaun dia sendiri ("Pentadbir yang tukar peranan AKAUN DIA SENDIRI ... tak sepatutnya
// log keluar sendiri sebagai kesan sampingan tak sengaja"). `req.session.user.roles` (JAMAK)
// disegarkan LIVE setiap permintaan /api/system/* oleh middleware `refreshSessionRoles`
// (server.js ~baris 1782) — jadi kebenaran RBAC sebenar (requirePermission) tetap betul serta-
// merta selepas tukar peranan sendiri.
//
// TAPI laluan ni turut tulis lajur LEGASI `users.role` (SATU nilai, 'KETUA_EDITOR'/'EDITOR',
// baris 656) — dan TIADA middleware yang menyegarkan `req.session.user.role` (TUNGGAL) macam
// `roles` (JAMAK). Medan ni ditetapkan SEKALI sahaja semasa /login (authRoutes.js baris 135) dan
// dipulangkan mentah oleh GET /api/auth/me (baris 153, `res.json({ user: req.session.user })`).
// Client (App.tsx baris 99, 284, 327, 364) baca `authUser.role` terus utk (a) tentukan sama ada
// pengguna layak papar Editorium (KETUA_EDITOR/EDITOR sahaja), (b) papar
// currentEditoriumName/currentEditoriumContact (byline Ketua Editor pada halaman Bidang) — kesan
// SEBENAR, bukan kosmetik semata.
//
// Skenario sebenar: Pentadbir yang turut pegang ketua_editor (macam Izzat, disebut terus dlm
// komen kod sedia ada) tarik balik peranan ketua_editor drpd akaun DIA SENDIRI (kekal pentadbir,
// jadi manageAccounts tak terjejas, tiada log keluar paksa). DB `users.role` tukar ke 'EDITOR'
// (baris 656: `roles.includes('ketua_editor') ? 'KETUA_EDITOR' : 'EDITOR'`), tapi
// req.session.user.role dalam sesi masih hidup PEMANGGIL kekal 'KETUA_EDITOR' lapuk sehingga dia
// log keluar/masuk semula (sampai 12 jam) — GET /api/auth/me (dipanggil client pada load/refresh)
// akan terus pulangkan nilai LAPUK ni.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, bukaDb } from './sim-lib.mjs';

const PORT = 5285;
const DBF = path.join(os.tmpdir(), 'sim-adjung-self-role-stale-session.db');
const lap = pelapor('SIM 85 — self role-change stale session.user.role');

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const id = 'sim85-admin';
  const { username, pass } = await ciptaPentadbir(DBF, { id });
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  // 0. Sahkan titik permulaan: role='KETUA_EDITOR' di DB DAN sesi (via /me).
  const rMeAwal = await api('GET', '/api/auth/me');
  if (!rMeAwal.ok || rMeAwal.json?.user?.role !== 'KETUA_EDITOR') {
    throw new Error('Fixture tak sah — /me tak mula dgn role KETUA_EDITOR: ' + JSON.stringify(rMeAwal.json));
  }

  // 1. Pentadbir tukar peranan AKAUN DIA SENDIRI: kekalkan pentadbir, TARIK BALIK ketua_editor.
  const rPatch = await api('PATCH', `/api/system/users/${id}/roles`, { roles: ['pentadbir'] });
  if (!rPatch.ok) throw new Error('PATCH roles gagal: HTTP ' + rPatch.status + ' ' + rPatch.teks.slice(0, 300));

  // 2. Sahkan DB SEBENAR sudah bertukar ke 'EDITOR' (legasi, sebab tak lagi ketua_editor).
  const userRow = await dbGet(db, 'SELECT role FROM users WHERE id = ?', [id]);
  console.log('  DB users.role selepas PATCH:', userRow?.role);
  if (userRow?.role !== 'EDITOR') {
    throw new Error('DB users.role tak bertukar ke EDITOR selepas tarik balik ketua_editor — sim ni tak sah, semak fixture');
  }

  // 3. Sesi SAMA (kuki tak diubah, sengaja dikecualikan drpd padamSesiPengguna) — panggil /me
  //    macam client buat pada load semula halaman, TANPA log masuk semula.
  const rMeSelepas = await api('GET', '/api/auth/me');
  if (!rMeSelepas.ok) throw new Error('/me gagal selepas PATCH: HTTP ' + rMeSelepas.status);
  console.log('  /api/auth/me role selepas PATCH (sesi sama):', rMeSelepas.json?.user?.role);
  console.log('  /api/auth/me roles[] selepas PATCH (sesi sama, sepatutnya segar):', JSON.stringify(rMeSelepas.json?.user?.roles));

  if (rMeSelepas.json?.user?.role === 'KETUA_EDITOR') {
    lap.gagal(
      'req.session.user.role (legasi, TUNGGAL) kekal "KETUA_EDITOR" lapuk selepas tarik balik peranan sendiri walaupun DB sudah "EDITOR" — client (App.tsx authUser.role) akan terus papar byline/akses Ketua Editor yang sudah tak sah sehingga log keluar/masuk semula',
      `DB=EDITOR, /me=${rMeSelepas.json?.user?.role}`
    );
  } else if (rMeSelepas.json?.user?.role === 'EDITOR') {
    lap.lulus('req.session.user.role disegarkan betul selepas tukar peranan sendiri');
  } else {
    lap.gagal('Nilai role tidak dijangka', JSON.stringify(rMeSelepas.json));
  }

  // Kawalan: sahkan roles[] (JAMAK) MEMANG sudah segar (refreshSessionRoles jalan betul) — ni
  // mengasingkan bug kepada medan `role` TUNGGAL sahaja, bukan seluruh mekanisme sesi rosak.
  const rolesSegar = Array.isArray(rMeSelepas.json?.user?.roles) && !rMeSelepas.json.user.roles.includes('ketua_editor');
  if (!rolesSegar) {
    lap.gagal('KAWALAN gagal: roles[] (JAMAK) turut tak segar — ini akan jadi masalah RBAC sebenar, bukan cuma paparan', JSON.stringify(rMeSelepas.json?.user?.roles));
  } else {
    lap.lulus('KAWALAN: roles[] (JAMAK) sudah segar (refreshSessionRoles berfungsi) — bug terhad kpd medan role TUNGGAL sahaja');
  }

  lap.ringkasan();
} finally {
  srv.proc.kill();
}
