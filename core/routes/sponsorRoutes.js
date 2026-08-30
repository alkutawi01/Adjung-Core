import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';
import { bulanMalaysia } from '../utils/waktuMalaysia.js';
import { sponsorAktifPadaMasa } from '../editorial/PenajaEligibility.js';

// Penaja (2026-08-05, Fasa 12 — permintaan Izzat; dikemas kini 2026-08-30, audit mendalam
// modul Penaja). Tajaan BULANAN (lama) ATAU julat ISO 7-hari/tempoh bebas (baharu), boleh
// berbilang penaja serentak. Dua permukaan berasingan:
//   - Editorium (Pentadbir sahaja, kunci `manageSettings` — sama gerbang macam Direktori/
//     Tetapan/Halaman Awam, keputusan reka bentuk/perniagaan bukan editorial harian): urus
//     penuh (cipta/sunting/arkib).
//   - Awam: /public/sponsors/semasa (footer, tajaan AKTIF SEMASA sahaja) dan
//     /public/sponsors/semua (halaman /penaja, SEMUA penaja aktif — lama & semasa — susun
//     bulan terbaru dahulu).
//
// SKEMA (2026-08-30): `mulaTajaan`/`tamatTajaan` (ISO 8601 + offset +08:00) — julat tarikh
// SEBENAR, menggantikan pergantungan TUNGGAL kepada `bulan` untuk penaja baharu. `bulan`
// KEKAL wujud (backward-compat, penaja lama tanpa julat ISO terus disemak ikut bulan — lihat
// sponsorAktifPadaMasa() di core/editorial/PenajaEligibility.js). Jadual `sponsor_slots`
// (sponsorId, slotIndex) menyimpan skop per-slot — TIADA baris = portal keseluruhan (kelakuan
// asal dikekalkan), ADA baris = penaja HANYA layak untuk slot yang disenaraikan. Kelayakan
// slot ni digunakan KLIEN (FrontpageView.tsx, ambilLogoTransisi/penajaLayakUntukTransisi) —
// laluan awam di bawah tak tapis ikut slot (footer/halaman /penaja bukan konteks slot
// tunggal), cuma hantar `slotIndexes` terus supaya klien boleh tapis sendiri.
const HAD_NAMA = 100;
// Waktu Malaysia, bukan UTC (2026-08-07, Pelan 02 #9) — dahulu toISOString() menjadikan footer
// awam memaparkan penaja bulan lepas antara 12:00 pagi dan 8:00 pagi MYT pada 1 haribulan.
const bulanSemasa = () => bulanMalaysia(); // 'YYYY-MM'

const sahBulan = (b) => /^\d{4}-\d{2}$/.test(String(b || '')) && Number(String(b).slice(5, 7)) >= 1 && Number(String(b).slice(5, 7)) <= 12;
const sahIso = (v) => typeof v === 'string' && v.trim() !== '' && !Number.isNaN(new Date(v).getTime());
const sahSenaraiSlot = (arr) => Array.isArray(arr) && arr.every((n) => Number.isInteger(n) && n >= -1 && n <= 37);

// Baris ADMIN (Editorium) — sertakan jumlahBayaran, Pentadbir sahaja yang capai laluan ni.
// `slotIndexes` disuap dari luar (peta sponsorId->slotIndex[], dibina sekali per senarai
// supaya elak N+1 query) — lalai [] kalau tiada peta dibekalkan.
const barisKepadaPenaja = (r, petaSlot) => ({
  id: r.id,
  nama: r.name,
  logoUrl: r.logoUrl || '',
  url: r.url || '',
  bulan: r.bulan,
  mulaTajaan: r.mulaTajaan || '',
  tamatTajaan: r.tamatTajaan || '',
  slotIndexes: (petaSlot && petaSlot.get(r.id)) || [],
  tayangSemasaTransisi: r.tayangSemasaTransisi === 1,
  jumlahBayaran: r.jumlahBayaran || 0,
  status: r.status,
  dikemasPada: r.updatedAt,
});

// Baris AWAM — SENGAJA tanpa jumlahBayaran (2026-08-05, permintaan Izzat: had ni disimpan utk
// kegunaan dalaman/visualisasi kotak akan datang, bukan angka rasmi terus terdedah kepada
// pembaca sebelum reka bentuk visualisasi disahkan).
const barisKepadaPenajaAwam = (r, petaSlot) => {
  const { jumlahBayaran, ...baki } = barisKepadaPenaja(r, petaSlot);
  return baki;
};

// Bina peta sponsorId -> slotIndex[] daripada jadual sponsor_slots, sekali per senarai baris
// (elak N+1 query per penaja).
async function bacaPetaSlot(dbAll, sponsorIds) {
  const peta = new Map();
  if (!sponsorIds || sponsorIds.length === 0) return peta;
  const placeholders = sponsorIds.map(() => '?').join(',');
  const rows = await dbAll(
    `SELECT sponsorId, slotIndex FROM sponsor_slots WHERE sponsorId IN (${placeholders})`,
    sponsorIds
  );
  for (const row of rows || []) {
    if (!peta.has(row.sponsorId)) peta.set(row.sponsorId, []);
    peta.get(row.sponsorId).push(row.slotIndex);
  }
  return peta;
}

async function tulisSlotUntukSponsor(dbRun, sponsorId, slotIndexes) {
  await dbRun('DELETE FROM sponsor_slots WHERE sponsorId = ?', [sponsorId]);
  const senarai = Array.isArray(slotIndexes) ? slotIndexes : [];
  for (const slotIndex of senarai) {
    await dbRun('INSERT INTO sponsor_slots (sponsorId, slotIndex) VALUES (?, ?)', [sponsorId, slotIndex]);
  }
}

export function createSponsorRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/system/sponsors — senarai PENUH (aktif + arkib) untuk Editorium.
  router.get('/system/sponsors', requirePermission('manageSettings'), async (req, res) => {
    try {
      const rows = await dbAll('SELECT * FROM sponsors ORDER BY bulan DESC, createdAt DESC');
      const petaSlot = await bacaPetaSlot(dbAll, (rows || []).map((r) => r.id));
      res.json((rows || []).map((r) => barisKepadaPenaja(r, petaSlot)));
    } catch (err) {
      console.error('GET system/sponsors error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai penaja. ' + (err.message || '') });
    }
  });

  // POST /api/system/sponsors — cipta penaja baharu.
  router.post('/system/sponsors', requirePermission('manageSettings'), async (req, res) => {
    try {
      const { nama, logoUrl, url, bulan, mulaTajaan, tamatTajaan, slotIndexes, tayangSemasaTransisi, jumlahBayaran } = req.body || {};
      const namaBersih = String(nama || '').trim();
      const bulanBersih = String(bulan || '').trim();
      if (!namaBersih) return res.status(400).json({ error: 'Nama penaja diperlukan.' });
      if (namaBersih.length > HAD_NAMA) return res.status(400).json({ error: `Nama penaja melebihi had ${HAD_NAMA} aksara.` });
      if (!sahBulan(bulanBersih)) return res.status(400).json({ error: 'Bulan mesti format YYYY-MM dengan bulan 01-12.' });
      const bayaranBersih = jumlahBayaran === undefined || jumlahBayaran === null || jumlahBayaran === '' ? 0 : Number(jumlahBayaran);
      if (Number.isNaN(bayaranBersih) || bayaranBersih < 0) return res.status(400).json({ error: 'Jumlah bayaran mesti nombor positif.' });

      // mulaTajaan/tamatTajaan PILIHAN — kalau salah satu diisi, KEDUA-DUA wajib & mula <= tamat.
      const adaMula = mulaTajaan !== undefined && mulaTajaan !== null && mulaTajaan !== '';
      const adaTamat = tamatTajaan !== undefined && tamatTajaan !== null && tamatTajaan !== '';
      if (adaMula !== adaTamat) return res.status(400).json({ error: 'Mula dan tamat tajaan mesti diisi bersama.' });
      if (adaMula && (!sahIso(mulaTajaan) || !sahIso(tamatTajaan))) return res.status(400).json({ error: 'Tarikh mula/tamat tajaan tidak sah.' });
      if (adaMula && new Date(mulaTajaan).getTime() > new Date(tamatTajaan).getTime()) return res.status(400).json({ error: 'Tarikh mula tajaan mesti sebelum tarikh tamat.' });

      if (slotIndexes !== undefined && !sahSenaraiSlot(slotIndexes)) return res.status(400).json({ error: 'Senarai slot tidak sah.' });

      const id = `penaja-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      await dbRun(
        `INSERT INTO sponsors (id, name, logoUrl, url, bulan, mulaTajaan, tamatTajaan, tayangSemasaTransisi, jumlahBayaran, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?)`,
        [id, namaBersih, logoUrl || '', url || '', bulanBersih, adaMula ? mulaTajaan : null, adaMula ? tamatTajaan : null, tayangSemasaTransisi ? 1 : 0, bayaranBersih, now, now]
      );
      if (slotIndexes !== undefined) await tulisSlotUntukSponsor(dbRun, id, slotIndexes);
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'cipta-penaja',
        targetType: 'penaja',
        targetId: id,
        detail: `${namaBersih} (${bulanBersih})`,
      });
      res.json({ success: true, id });
    } catch (err) {
      console.error('POST system/sponsors error:', err);
      res.status(500).json({ error: 'Gagal cipta penaja. ' + (err.message || '') });
    }
  });

  // PATCH /api/system/sponsors/:id — sunting/arkibkan.
  router.patch('/system/sponsors/:id', requirePermission('manageSettings'), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await dbGet('SELECT id, mulaTajaan, tamatTajaan FROM sponsors WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Penaja tidak dijumpai.' });

      const { nama, logoUrl, url, bulan, mulaTajaan, tamatTajaan, slotIndexes, tayangSemasaTransisi, jumlahBayaran, status } = req.body || {};
      const sets = [];
      const params = [];
      if (nama !== undefined) {
        const namaBersih = String(nama).trim();
        if (!namaBersih) return res.status(400).json({ error: 'Nama penaja diperlukan.' });
        if (namaBersih.length > HAD_NAMA) return res.status(400).json({ error: `Nama penaja melebihi had ${HAD_NAMA} aksara.` });
        sets.push('name = ?'); params.push(namaBersih);
      }
      if (logoUrl !== undefined) { sets.push('logoUrl = ?'); params.push(logoUrl); }
      if (url !== undefined) { sets.push('url = ?'); params.push(url); }
      if (bulan !== undefined) {
        if (!sahBulan(bulan)) return res.status(400).json({ error: 'Bulan mesti format YYYY-MM dengan bulan 01-12.' });
        sets.push('bulan = ?'); params.push(bulan);
      }
      if (mulaTajaan !== undefined || tamatTajaan !== undefined) {
        const mulaBaharu = mulaTajaan !== undefined ? mulaTajaan : existing.mulaTajaan;
        const tamatBaharu = tamatTajaan !== undefined ? tamatTajaan : existing.tamatTajaan;
        const kosongkan = (mulaBaharu === '' || mulaBaharu === null) && (tamatBaharu === '' || tamatBaharu === null);
        if (kosongkan) {
          sets.push('mulaTajaan = ?', 'tamatTajaan = ?'); params.push(null, null);
        } else {
          if (!sahIso(mulaBaharu) || !sahIso(tamatBaharu)) return res.status(400).json({ error: 'Tarikh mula/tamat tajaan tidak sah.' });
          if (new Date(mulaBaharu).getTime() > new Date(tamatBaharu).getTime()) return res.status(400).json({ error: 'Tarikh mula tajaan mesti sebelum tarikh tamat.' });
          sets.push('mulaTajaan = ?', 'tamatTajaan = ?'); params.push(mulaBaharu, tamatBaharu);
        }
      }
      if (tayangSemasaTransisi !== undefined) { sets.push('tayangSemasaTransisi = ?'); params.push(tayangSemasaTransisi ? 1 : 0); }
      if (jumlahBayaran !== undefined) {
        const bayaranBersih = jumlahBayaran === null || jumlahBayaran === '' ? 0 : Number(jumlahBayaran);
        if (Number.isNaN(bayaranBersih) || bayaranBersih < 0) return res.status(400).json({ error: 'Jumlah bayaran mesti nombor positif.' });
        sets.push('jumlahBayaran = ?'); params.push(bayaranBersih);
      }
      if (status !== undefined) {
        if (!['aktif', 'arkib'].includes(status)) return res.status(400).json({ error: 'Status tidak sah.' });
        sets.push('status = ?'); params.push(status);
      }
      if (slotIndexes !== undefined && !sahSenaraiSlot(slotIndexes)) return res.status(400).json({ error: 'Senarai slot tidak sah.' });
      if (sets.length === 0 && slotIndexes === undefined) return res.status(400).json({ error: 'Tiada medan untuk dikemas kini.' });

      if (sets.length > 0) {
        sets.push('updatedAt = ?'); params.push(new Date().toISOString());
        params.push(id);
        await dbRun(`UPDATE sponsors SET ${sets.join(', ')} WHERE id = ?`, params);
      }
      if (slotIndexes !== undefined) await tulisSlotUntukSponsor(dbRun, id, slotIndexes);

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-penaja',
        targetType: 'penaja',
        targetId: id,
        detail: status !== undefined ? `status -> ${status}` : undefined,
      });
      res.json({ success: true });
    } catch (err) {
      console.error('PATCH system/sponsors error:', err);
      res.status(500).json({ error: 'Gagal kemas kini penaja. ' + (err.message || '') });
    }
  });

  // GET /api/public/sponsors/semasa — laluan AWAM, footer. Tajaan AKTIF SEMASA sahaja
  // (julat ISO kalau ada, jatuh balik bulan — sponsorAktifPadaMasa).
  router.get('/public/sponsors/semasa', async (req, res) => {
    try {
      const rows = await dbAll("SELECT * FROM sponsors WHERE status = 'aktif' ORDER BY createdAt ASC");
      const sekarang = new Date();
      const bulanKini = bulanSemasa();
      const aktif = (rows || []).filter((r) => sponsorAktifPadaMasa(r, sekarang, bulanKini));
      const petaSlot = await bacaPetaSlot(dbAll, aktif.map((r) => r.id));
      res.json(aktif.map((r) => barisKepadaPenajaAwam(r, petaSlot)));
    } catch (err) {
      console.error('GET public/sponsors/semasa error:', err);
      res.status(500).json({ error: 'Gagal membaca penaja semasa. ' + (err.message || '') });
    }
  });

  // GET /api/public/sponsors/semua — laluan AWAM, halaman /penaja. SEMUA penaja aktif (lama +
  // semasa), susun bulan terbaru dahulu.
  router.get('/public/sponsors/semua', async (req, res) => {
    try {
      const rows = await dbAll(
        "SELECT * FROM sponsors WHERE status = 'aktif' ORDER BY bulan DESC, createdAt ASC"
      );
      const petaSlot = await bacaPetaSlot(dbAll, (rows || []).map((r) => r.id));
      res.json((rows || []).map((r) => barisKepadaPenajaAwam(r, petaSlot)));
    } catch (err) {
      console.error('GET public/sponsors/semua error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai penaja. ' + (err.message || '') });
    }
  });

  return router;
}
