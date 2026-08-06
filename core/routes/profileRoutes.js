import express from 'express';
import { requireAuth, hasPermission } from '../middleware/auth.js';

// Profil Editor (2026-08-01, spesifikasi pemilik projek — aksesori header, bukan destinasi
// sidebar) — editor yang log masuk boleh sunting IDENTITI DIA SENDIRI. Dipermudah 2026-08-02
// (Izzat: "ni bukan medsos, hanya utk rujukan dalaman, kalau ada pun di kad/focus view, nama
// pena") — tandatangan/warna avatar/bio DIBUANG, Nama Pena sahaja. Sengaja TIDAK termasuk
// email/username/kata laluan/peranan di laluan ni — masing-masing laluan berasingan (lihat
// authRoutes.js untuk kata laluan; username/emel dirancang Fasa 6b, RBAC bukan hak editor
// sendiri untuk ubah).
//
// Butiran profil wajib + Syarat & Peraturan (2026-08-05, permintaan Izzat) — enam medan
// onboarding (namaPenuh/kelulusan*/negeriMenetap/nomborTelefon) ditambah kepada laluan SAMA ni
// (bukan laluan baharu — kekal SATU tempat tulis identiti sendiri). `terimaTerma: true`
// menstempel `termaDipersetujuiPada` (gerbang log masuk pertama, LengkapkanProfilModal.tsx) —
// HANYA bila kelima-lima medan wajib turut dihantar sekali (semua-atau-tiada, elak setuju
// terma tanpa lengkap profil). Terma sedia dipersetujui (`termaDipersetujuiPada` bukan NULL)
// tak pernah ditulis-ganti — cap masa PERSETUJUAN PERTAMA kekal walaupun editor edit profil
// lain kemudian.
const HAD_PEN_NAME = 60;
const MEDAN_ONBOARDING_WAJIB = ['namaPenuh', 'kelulusanKursus', 'kelulusanUniversiti', 'kelulusanTahun', 'negeriMenetap', 'nomborTelefon'];

export function createProfileRoutes(dbGet, dbRun) {
  const router = express.Router();

  // GET /api/system/profile/:id — 2026-08-05 (audit): dahulu ProfilEditorModal.tsx ambil
  // emel/username sendiri drpd GET /api/db-state (laluan AWAM tanpa sesi) — selamat masa tu
  // sebab db-state pulangkan lajur `email` terus. Pembetulan keselamatan hari yang sama (tutup
  // kebocoran resetToken di db-state) turut buang `email` drpd respons db-state — betul untuk
  // laluan awam, tapi pecahkan paparan "Emel semasa" di sini secara senyap. Laluan GET khusus
  // (sesi diperlukan, pemilik sendiri sahaja) ni gantikan pergantungan tu.
  router.get('/profile/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const isSelf = req.session.user.id === id;
      if (!isSelf && !hasPermission(req.session.user.roles, 'manageAccounts')) {
        return res.status(403).json({ error: 'Hanya boleh lihat profil sendiri.' });
      }
      const baris = await dbGet(
        `SELECT id, username, email, role, penName, namaPenuh, kelulusanKursus, kelulusanUniversiti,
                kelulusanTahun, negeriMenetap, nomborTelefon, termaDipersetujuiPada
         FROM users WHERE id = ?`,
        [id]
      );
      if (!baris) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });
      res.json({ user: baris });
    } catch (err) {
      console.error('GET profile error:', err);
      res.status(500).json({ error: 'Gagal membaca profil. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/profile/:id — 2026-08-02 (Fasa 1): dahulu sesiapa boleh tulis profil
  // MANA-MANA id dalam URL, tanpa semak siapa yang memanggil. Kini perlu sesi sah, dan hanya
  // pemilik akaun sendiri ATAU Ketua Editor boleh menyunting.
  router.patch('/profile/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const isSelf = req.session.user.id === id;
      if (!isSelf && !hasPermission(req.session.user.roles, 'manageAccounts')) {
        return res.status(403).json({ error: 'Hanya boleh sunting profil sendiri.' });
      }
      const sedia = await dbGet('SELECT id, termaDipersetujuiPada FROM users WHERE id = ?', [id]);
      if (!sedia) return res.status(404).json({ error: 'Akaun tidak dijumpai.' });

      const {
        penName, namaPenuh, kelulusanKursus, kelulusanUniversiti, kelulusanTahun,
        negeriMenetap, nomborTelefon, terimaTerma,
      } = req.body || {};
      const set = [];
      const params = [];

      if (penName !== undefined) {
        const v = (penName || '').trim();
        if (!v) return res.status(400).json({ error: 'Nama pena tidak boleh kosong.' });
        if (v.length > HAD_PEN_NAME) return res.status(400).json({ error: `Nama pena tidak boleh melebihi ${HAD_PEN_NAME} aksara.` });
        // Nama pena unik (2026-08-06, pembetulan audit) — sama sebab macam POST /users: penName
        // ialah identiti "siapa tulis kandungan ni" di seluruh sistem (editorName, Draf Saya,
        // lastPublishedAt dasar aktif), padanan LOWER(TRIM()) tanpa gerbang. Semak akaun LAIN
        // (bukan diri sendiri — editor boleh "tukar" ke nama sama dia sendiri, cth ubah huruf
        // besar/kecil sahaja).
        const lain = await dbGet('SELECT id FROM users WHERE LOWER(TRIM(penName)) = LOWER(?) AND id != ?', [v, id]);
        if (lain) return res.status(409).json({ error: `Nama pena "${v}" sudah digunakan akaun lain — pilih nama pena lain.` });
        set.push('penName = ?'); params.push(v);
      }

      const medanTeksBiasa = { namaPenuh, kelulusanKursus, kelulusanUniversiti, kelulusanTahun, negeriMenetap, nomborTelefon };
      for (const [lajur, nilai] of Object.entries(medanTeksBiasa)) {
        if (nilai === undefined) continue;
        const v = (nilai || '').toString().trim();
        if (v.length > 200) return res.status(400).json({ error: `${lajur} tidak boleh melebihi 200 aksara.` });
        set.push(`${lajur} = ?`); params.push(v);
      }

      if (terimaTerma === true) {
        const kurang = MEDAN_ONBOARDING_WAJIB.filter((m) => !(medanTeksBiasa[m] || '').toString().trim());
        if (kurang.length > 0) {
          return res.status(400).json({ error: `Lengkapkan semua medan profil dahulu sebelum bersetuju Syarat & Peraturan (kurang: ${kurang.join(', ')}).` });
        }
        // Cap masa PERSETUJUAN PERTAMA kekal — jangan tulis-ganti kalau editor hantar semula
        // (cth sunting profil kemudian, terimaTerma masih true dalam body borang sedia ada).
        if (!sedia.termaDipersetujuiPada) {
          set.push('termaDipersetujuiPada = ?'); params.push(new Date().toISOString());
        }
      }

      if (set.length === 0) return res.status(400).json({ error: 'Tiada medan untuk dikemas kini.' });

      set.push('updatedAt = ?'); params.push(new Date().toISOString());
      params.push(id);
      await dbRun(`UPDATE users SET ${set.join(', ')} WHERE id = ?`, params);

      const baris = await dbGet(
        `SELECT id, username, email, role, penName, namaPenuh, kelulusanKursus, kelulusanUniversiti,
                kelulusanTahun, negeriMenetap, nomborTelefon, termaDipersetujuiPada
         FROM users WHERE id = ?`,
        [id]
      );
      res.json({ success: true, user: baris });
    } catch (err) {
      console.error('PATCH profile error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini profil. ' + (err.message || '') });
    }
  });

  return router;
}

export default createProfileRoutes;
