// SIMULASI 84 — PATCH /profile/:id (tukar nama pena) tak segarkan req.session.user.penName
// (bug-hunt round 253, angle "field write-path consistency" pada penName/editorName, susulan
// #220-226 pada desk/topik/rolePermissions).
//
// authRoutes.js POST /change-username DAN /change-email KEDUA-DUANYA menyegarkan
// req.session.user.<medan> serta-merta selepas UPDATE berjaya ("Sesi server simpan salinan
// username untuk paparan header — segarkan serta-merta supaya tak lapuk sehingga log masuk
// semula"). PATCH /api/system/profile/:id (profileRoutes.js) TIDAK buat perkara sama untuk
// penName walaupun ia medan SAMA kategori (snapshot pada req.session.user, dibaca semula pada
// setiap permintaan seterusnya dalam sesi yang sama) — req.session.user hanya ditetapkan SEKALI
// semasa /login (authRoutes.js ~baris 131) dan tidak pernah di-refetch dari DB per-permintaan.
//
// Kesan sebenar: req.session.user.penName dibaca di MERATA tempat sepanjang sesi tu (namaSayaSesi()
// di contentRoutes.js/slotsConfigRoutes.js, ditulis terus sebagai snapshot attribute 'editorName'
// pada kandungan BAHARU yang diterbitkan/disunting DALAM sesi yang sama) — selepas editor tukar
// nama pena, kandungan seterusnya yang dia terbitkan/sunting DALAM SESI SAMA (tanpa log masuk
// semula) akan tersilap cap NAMA LAMA sebagai editorName, bukan nama baharu yang dia baru simpan.
import path from 'node:path';
import os from 'node:os';
import { bootServer, ciptaPentadbir, login, buatKlien, pelapor, dbGet, bukaDb, isiHuraianCukup, HURAIAN_PANJANG_SAH } from './sim-lib.mjs';
import { ceilingForSlot } from '../core/editorial/GeometryConfig.js';

const PORT = 5284;
const DBF = path.join(os.tmpdir(), 'sim-adjung-profile-penname-stale-session.db');
const lap = pelapor('SIM 84 — PATCH profile penName stale session');

const SLOT = 5; // KOMPAK tier, ringkas
const BIDANG = 'Sukan';

const srv = await bootServer({ port: PORT, dbFile: DBF, freshDb: true });
try {
  const id = 'sim84-admin';
  const { username, pass } = await ciptaPentadbir(DBF, { id });
  const cookie = await login(srv.base, username, pass);
  const api = buatKlien(srv.base, cookie);
  const db = bukaDb(DBF);

  // 1. Tukar nama pena SELEPAS log masuk, DALAM sesi yang sama (tiada log masuk semula).
  const NAMA_BAHARU = 'Sim84 Nama Pena Baharu';
  const rPatch = await api('PATCH', `/api/system/profile/${id}`, { penName: NAMA_BAHARU });
  if (!rPatch.ok) throw new Error('PATCH profile gagal: HTTP ' + rPatch.status + ' ' + rPatch.teks.slice(0, 300));
  if (rPatch.json?.user?.penName !== NAMA_BAHARU) {
    throw new Error('DB penName tak bertukar selepas PATCH — sim ni tak sah, semak fixture');
  }
  console.log('  DB users.penName selepas PATCH:', rPatch.json.user.penName);

  // 2. Terbitkan kandungan BAHARU dalam SESI YANG SAMA (kuki tak diubah, tiada login semula).
  await api('POST', '/api/system/categories/activate', { name: BIDANG, color: '#334455', icon: 'Trophy' });
  await api('POST', '/api/system/categories/assign-slot', { slotIndex: SLOT, bidangName: BIDANG });

  const TAJUK_UNIK = 'Sim84 EditorName';
  const blok = [
    'UUID: sim84-uuid-0001',
    `Tajuk: ${TAJUK_UNIK}`,
    'Huraian ringkas: ' + isiHuraianCukup(ceilingForSlot, SLOT, TAJUK_UNIK.length),
    'Huraian panjang: ' + HURAIAN_PANJANG_SAH,
    'Bidang: ' + BIDANG,
    'Topik: Bola Sepak',
    'Sumber: Berita Harian',
    'URL: https://www.bharian.com.my/sim84-ujian',
    'Tarikh sumber: 2026-09-01',
    'Status: terbit',
  ].join('\n');

  const rTerbit = await api('POST', '/api/system/slots', [{
    slotIndex: SLOT, contentMode: 'Manual', manualDesk: BIDANG, manualSummary: blok,
  }]);
  if (!rTerbit.ok) throw new Error('Terbitkan gagal: HTTP ' + rTerbit.status + ' ' + rTerbit.teks.slice(0, 300));

  const obj = await dbGet(db, 'SELECT id FROM editorial_objects ORDER BY createdAt DESC LIMIT 1');
  if (!obj) throw new Error('Tiada objek dicipta selepas terbit');
  const revRow = await dbGet(db, 'SELECT id FROM editorial_revisions WHERE objectId = ? ORDER BY version DESC LIMIT 1', [obj.id]);
  const attrRow = await dbGet(db,
    "SELECT valueText FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = 'editorName'",
    [obj.id, revRow.id]);

  console.log('  editorName tersimpan pada kandungan BAHARU:', JSON.stringify(attrRow && attrRow.valueText));

  if (!attrRow || attrRow.valueText !== NAMA_BAHARU) {
    lap.gagal(
      'editorName kandungan baharu tak sepadan nama pena BAHARU yang baru disimpan (sesi bawa nama LAMA)',
      `Dijangka "${NAMA_BAHARU}", sebenar ${JSON.stringify(attrRow && attrRow.valueText)}`
    );
  } else {
    lap.lulus('editorName kandungan baharu sepadan nama pena BAHARU (sesi disegarkan betul)');
  }

  lap.ringkasan();
} finally {
  srv.proc.kill();
}
