import express from 'express';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';
import { bulanMalaysia } from '../utils/waktuMalaysia.js';
import { sponsorAktifPadaMasa } from '../editorial/PenajaEligibility.js';
import { angkaRom } from './permohonanPenajaRoutes.js';
import { isSafeHttpUrl } from '../sources/SourceSanitizer.js';

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
// sahIso() (dapatan bug-hunt 2026-09-12) — SAMA corak pepijat "regex/parse sahaja tak cukup
// sahkan tarikh kalendar sebenar" yang dibaiki di validateTarikhSumber() (ContentBudget.js) dan
// formatSatuTarikh() (EventDateValidator.js) 2026-09-09. `new Date(v).getTime()` cuma semak
// rentetan BOLEH dihurai — ia TAK tolak tarikh mustahil, sebaliknya SENYAP gelongsor ke tarikh
// lain: new Date('2026-02-30T14:30:00+08:00') pulangkan Date SAH (2 Mac, bukan NaN). Input medan
// ni ialah <input type="datetime-local"> (PenajaConsole.tsx) yang editor taip/pilih terus, jadi
// "30 Februari" boleh tersimpan sebagai mulaTajaan/tamatTajaan tanpa sebarang ralat 400 — julat
// tajaan sebenar penaja jadi silap tanpa amaran. Sahkan komponen Y-M-D round-trip Date.UTC
// (elak anjak zon waktu) SEBELUM terima rentetan tu sebagai tarikh sah.
const sahIso = (v) => {
  if (typeof v !== 'string' || v.trim() === '') return false;
  const trimmed = v.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return false;
  const [, tahunStr, bulanStr, hariStr] = match;
  const tahunNum = Number(tahunStr);
  const bulanNum = Number(bulanStr);
  const hariNum = Number(hariStr);
  const d = new Date(Date.UTC(tahunNum, bulanNum - 1, hariNum));
  const kalendarSah = d.getUTCFullYear() === tahunNum && d.getUTCMonth() === bulanNum - 1 && d.getUTCDate() === hariNum;
  if (!kalendarSah) return false;
  return !Number.isNaN(new Date(trimmed).getTime());
};
// unik (2026-09-08, dapatan bug-hunt) — sahSenaraiSlot() dahulu cuma semak julat/integer, tak
// tolak duplikat (cth [3,3]). sponsor_slots ada PRIMARY KEY (sponsorId, slotIndex), jadi
// tulisSlotUntukSponsor() (DELETE semua slot sponsor tu, kemudian INSERT satu-satu TANPA
// transaksi) akan DELETE berjaya, sebahagian INSERT berjaya, lalu INSERT slot pendua tu
// langgar PRIMARY KEY dan throw — baki gelung tak sempat jalan, permintaan pulang 500, TAPI
// DELETE awal tu dah termeterai (bukan dalam transaksi) — penaja kehilangan skop slot sedia
// ada tanpa gantian baharu lengkap. Sama corak pepijat "tulisan berbilang langkah tanpa
// transaksi" yang dibaiki di permohonanPenajaRoutes.js /aktifkan (lihat nota di situ).
// Tolak input pendua di peringkat pengesahan (400 bersih) daripada biar ia pecahkan data.
const sahSenaraiSlot = (arr) => Array.isArray(arr) && arr.every((n) => Number.isInteger(n) && n >= -1 && n <= 37)
  && new Set(arr).size === arr.length;

// Baris ADMIN (Editorium) — sertakan jumlahBayaran, Pentadbir sahaja yang capai laluan ni.
// `slotIndexes` disuap dari luar (peta sponsorId->slotIndex[], dibina sekali per senarai
// supaya elak N+1 query) — lalai [] kalau tiada peta dibekalkan.
// Label "Hamba Allah N" (2026-09-02, dapatan bug-hunt) — `anonymousNo` sengaja dijana secara
// berjujukan (aktifkan permohonan penaja, permohonanPenajaRoutes.js) khusus supaya pembaca boleh
// bezakan penaja "Hamba Allah" berbilang, TAPI medan ni sebelum ni tak pernah dihantar dalam
// respons baris (admin ATAU awam) — angkaRom() (juga dieksport, tak pernah dipanggil mana-mana)
// jadi kod mati, dan setiap penaja anonim (Editorium MAHUPUN halaman /penaja awam) papar
// literal "Hamba Allah" sama, tak boleh dibezakan seorang drpd yang lain. Gabung nombor Rom
// terus ke `nama` di sini (SATU tempat, dipakai admin dan awam serentak) — tiada perubahan skema.
const namaPaparPenaja = (r) => (r.anonymousNo ? `${r.name} ${angkaRom(r.anonymousNo)}` : r.name);

// tajaanTamat (2026-09-09, bug-hunt) — Editorium (PenajaConsole.tsx) memaparkan penaja ikut
// lajur `status` MENTAH ('aktif'/'arkib') sahaja, tak pernah baca mulaTajaan/tamatTajaan.
// TIADA cron/setInterval yang mengemas kini `status` bila tamatTajaan berlalu (tak macam
// permohonan_penaja, yang GET /system/permohonan-penaja sengaja kira status='tamat' ON-READ —
// lihat komen di situ). Kesan sebenar: penaja julat-tarikh yang tamatTajaan-nya sudah lepas terus
// dipaparkan di bawah "Penaja Aktif" dengan lencana hijau `success` SELAMANYA (logoUrl sudah pun
// hilang dari laman awam sebenar, sebab sponsorAktifPadaMasa() — yang gerbang KEDUA-DUA laluan
// awam — sudah kira ia tak aktif ikut tarikh). Pentadbir tak ada isyarat visual langsung penaja tu
// perlu diarkibkan/diperbaharui — kena buka borang Sunting satu-satu untuk perasan tarikh sudah
// lepas. Dibaiki: kira status TAMAT on-read (sama falsafah permohonan_penaja), pulangkan sebagai
// medan BAHARU `tajaanTamat` (bukan tulis balik `status` sedia ada 'aktif'/'arkib' — dua nilai tu
// masih kekal fungsi TOGGLE tab Aktif/Arkib client-side, jangan pecahkan itu) supaya UI boleh papar
// lencana amaran berasingan tanpa mengubah tab mana penaja tu tergolong.
// tajaanTamat ISALAH SUDAH TAMAT, BUKAN "belum bermula lagi" (2026-09-09, susulan bug-hunt
// sim42) — barisan asal tandakan tajaanTamat guna `!sponsorAktifPadaMasa(...)` sahaja, tapi
// sponsorAktifPadaMasa() pulangkan false atas DUA sebab berlainan: (1) tamatTajaan sudah
// berlalu (memang "Tamat", label betul), ATAU (2) mulaTajaan MASIH DI MASA HADAPAN (tajaan
// dijadualkan, cth kempen minggu depan yang Pentadbir sediakan awal — belum bermula langsung).
// Kesan pepijat: penaja julat-tarikh masa hadapan terus dipaparkan dengan lencana amaran
// "Tamat" sebaik dicipta, sedangkan ia belum pun tayang — mengelirukan (nampak macam dah
// luput). Semakan ni kini eksplisit tanya "adakah tamatTajaan sudah lepas SEKARANG", bukan
// "adakah ia tak aktif sekarang atas apa jua sebab" — penaja belum bermula (mula > sekarang)
// tak lagi terjebak dalam label yang sama.
// tajaanSudahLepas HANYA tangani penaja julat-tarikh (mulaTajaan+tamatTajaan kedua-duanya
// diisi) — kembali false serta-merta bila salah satu tiada, termasuk penaja BULANAN lama
// (guna `bulan`, tiada julat ISO langsung). Itu bermakna penaja bulanan berstatus 'aktif'
// yang `bulan`-nya SUDAH BUKAN bulan semasa (cth "2026-06" sedangkan sekarang 2026-09) tak
// pernah dapat lencana amaran "Tamat" ni — SAMA PEPIJAT yang baru dibaiki utk penaja julat-
// tarikh (komited hari ni, lihat nota tajaanTamat/tajaanSudahLepas di atas), cuma cabang
// bulanan tercicir drpd pembetulan asal sebab tajaanSudahLepas() sengaja skop sempit kepada
// julat ISO sahaja. Kesan sebenar: sponsorAktifPadaMasa() (gerbang SEBENAR laluan awam) sudah
// betul-betul menyembunyikan logo penaja bulanan lapuk drpd footer/halaman /penaja (bulan !==
// bulanKini), tapi Editorium terus papar ia di bawah "Penaja Aktif" TANPA sebarang isyarat
// visual — Pentadbir tak nampak penaja tu sebenarnya sudah tak tayang, sama seperti masalah
// asal yang dilaporkan utk kes julat-tarikh (2026-09-09, bug-hunt susulan).
const tajaanSudahLepas = (sponsor, sekarang, bulanKini) => {
  if (!sponsor) return false;
  if (sponsor.mulaTajaan && sponsor.tamatTajaan) {
    const masa = sekarang instanceof Date ? sekarang.getTime() : new Date(sekarang).getTime();
    const tamat = new Date(sponsor.tamatTajaan).getTime();
    if (Number.isNaN(masa) || Number.isNaN(tamat)) return false;
    return tamat < masa;
  }
  // Penaja bulanan (tiada julat ISO) — "Tamat" bermakna bulan tersimpan BUKAN bulan semasa.
  // bulanKini opsyenal (pemanggil lama yang tak hantar ia terus jatuh balik `false`, elak
  // regresi kalau ada laluan lain panggil fungsi ni tanpa parameter tambahan).
  if (!bulanKini) return false;
  return !!sponsor.bulan && sponsor.bulan !== bulanKini;
};

const barisKepadaPenaja = (r, petaSlot, sekarang, bulanKini) => ({
  id: r.id,
  nama: namaPaparPenaja(r),
  logoUrl: r.logoUrl || '',
  url: r.url || '',
  bulan: r.bulan,
  mulaTajaan: r.mulaTajaan || '',
  tamatTajaan: r.tamatTajaan || '',
  slotIndexes: (petaSlot && petaSlot.get(r.id)) || [],
  tayangSemasaTransisi: r.tayangSemasaTransisi === 1,
  jumlahBayaran: r.jumlahBayaran || 0,
  status: r.status,
  tajaanTamat: r.status === 'aktif' && tajaanSudahLepas(r, sekarang || new Date(), bulanKini),
  dikemasPada: r.updatedAt,
});

// Baris AWAM — SENGAJA tanpa jumlahBayaran (2026-08-05, permintaan Izzat: had ni disimpan utk
// kegunaan dalaman/visualisasi kotak akan datang, bukan angka rasmi terus terdedah kepada
// pembaca sebelum reka bentuk visualisasi disahkan).
const barisKepadaPenajaAwam = (r, petaSlot, sekarang, bulanKini) => {
  const { jumlahBayaran, tajaanTamat, ...baki } = barisKepadaPenaja(r, petaSlot, sekarang, bulanKini);
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

// Kunci penggantian slot penaja (2026-09-09, ditemui semasa audit pasangan sibling — corak
// bug SAMA PERSIS yang dibaiki di slotEditorRoutes.js pada 2026-08-08 tapi tak pernah
// disambung ke sini). DELETE SELURUH baris sponsor_slots satu penaja + INSERT semula bukan
// operasi atomik. Dua PATCH /system/sponsors/:id berselang-seli pada PENAJA SAMA (cth dua
// Pentadbir ubah senarai slot penaja tu hampir serentak) boleh jadi: baca lama [1,2] → padam
// kedua-duanya → INSERT [1,3] → INSERT [1,4], hasil akhir [1,3,1,4], BUKAN [1,3] atau [1,4]
// yang mana-mana permintaan sebenarnya minta — "lost update" sebenar. Rantaian promise global
// (bukan kunci per-sponsorId) memadai sama sebab pelayan satu proses (PM2 mod fork) dan
// trafik urus penaja sangat jarang (tindakan Editorium Pentadbir, bukan trafik pembaca).
let rantaianKunciSlotPenaja = Promise.resolve();
function denganKunciSlotPenaja(fn) {
  const giliran = rantaianKunciSlotPenaja.catch(() => {}).then(fn);
  rantaianKunciSlotPenaja = giliran.catch(() => {});
  return giliran;
}

async function tulisSlotUntukSponsor(dbRun, sponsorId, slotIndexes) {
  return denganKunciSlotPenaja(async () => {
    await dbRun('DELETE FROM sponsor_slots WHERE sponsorId = ?', [sponsorId]);
    const senarai = Array.isArray(slotIndexes) ? slotIndexes : [];
    for (const slotIndex of senarai) {
      await dbRun('INSERT INTO sponsor_slots (sponsorId, slotIndex) VALUES (?, ?)', [sponsorId, slotIndex]);
    }
  });
}

// logoUrl boleh jadi laluan muat naik relatif (/uploads/xxx daripada /api/media/upload) ATAU
// URL luaran penuh — dikongsi POST dan PATCH /system/sponsors di bawah.
const laluanMuatNaikSah = (v) => /^\/uploads\/[A-Za-z0-9._-]+$/.test(v);

export function createSponsorRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/system/sponsors — senarai PENUH (aktif + arkib) untuk Editorium.
  router.get('/system/sponsors', requirePermission('manageSettings'), async (req, res) => {
    try {
      const rows = await dbAll('SELECT * FROM sponsors ORDER BY bulan DESC, createdAt DESC');
      const petaSlot = await bacaPetaSlot(dbAll, (rows || []).map((r) => r.id));
      const sekarang = new Date();
      const bulanKini = bulanSemasa();
      res.json((rows || []).map((r) => barisKepadaPenaja(r, petaSlot, sekarang, bulanKini)));
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

      // isSafeHttpUrl (2026-09-09, sama kelas pepijat kritikal dgn RssDirectEngine.js/
      // EditorialPipeline.js) — `url` (laman rasmi penaja) dipaparkan terus `<a href>` di
      // HalamanPenaja.tsx (awam) dan `logoUrl` dipaparkan terus `<img src>` di FrontpageView.tsx/
      // HalamanPenaja.tsx (awam). Laluan ni (borang Editorium admin, medan teks bebas "Nama
      // fail / URL logo") TAK PERNAH gerbang skema URL macam laluan buktiBayaranUrl/logoUrl di
      // permohonanPenajaRoutes.js (laluanMuatNaikSah) — admin taip terus, jadi `javascript:`/
      // `data:` boleh tersimpan tanpa disekat. `logoUrl` boleh jadi laluan muat naik relatif
      // (/uploads/xxx daripada /api/media/upload) ATAU URL luaran penuh — benarkan KEDUA-DUA
      // bentuk sah, sekat skema berbahaya.
      if (url && !isSafeHttpUrl(url)) return res.status(400).json({ error: 'URL laman rasmi penaja tidak sah (mesti http:// atau https://).' });
      if (logoUrl && !laluanMuatNaikSah(logoUrl) && !isSafeHttpUrl(logoUrl)) return res.status(400).json({ error: 'URL logo penaja tidak sah.' });

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
      if (logoUrl !== undefined) {
        if (logoUrl && !laluanMuatNaikSah(logoUrl) && !isSafeHttpUrl(logoUrl)) return res.status(400).json({ error: 'URL logo penaja tidak sah.' });
        sets.push('logoUrl = ?'); params.push(logoUrl);
      }
      if (url !== undefined) {
        if (url && !isSafeHttpUrl(url)) return res.status(400).json({ error: 'URL laman rasmi penaja tidak sah (mesti http:// atau https://).' });
        sets.push('url = ?'); params.push(url);
      }
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
  //
  // belumBermula (2026-09-09, bug-hunt) — laluan ni dahulu memulangkan SETIAP baris
  // status='aktif' TANPA tapis sponsorAktifPadaMasa() langsung, tak macam /public/sponsors/semasa
  // (footer) yang sudah betul tapis. Kesan sebenar: penaja julat-tarikh yang mulaTajaan MASIH DI
  // MASA HADAPAN (cth kempen disediakan awal untuk minggu depan) terus dipaparkan nama+logo+URL
  // klik di HalamanPenaja.tsx (awam) sebaik dicipta — mendedahkan penaja sebelum tempoh tajaan
  // bermula, bertentangan falsafah ciri julat-tarikh (logo patut TEPAT ikut tempoh: "hilang TEPAT
  // bila tamat" bermakna ia juga patut "muncul TEPAT bila mula", bukan awal). Halaman ni SENGAJA
  // kekal papar penaja yang tamatTajaan SUDAH LEPAS (sejarah/arkib penuh, itulah tujuan laluan ni
  // berbanding /semasa) — cuma penaja yang BELUM BERMULA yang disorok, guna semakan SAMA persis
  // (mulaTajaan di masa hadapan) yang sudah dikongsi tajaanSudahLepas()/PenajaEligibility.js.
  router.get('/public/sponsors/semua', async (req, res) => {
    try {
      const rows = await dbAll(
        "SELECT * FROM sponsors WHERE status = 'aktif' ORDER BY bulan DESC, createdAt ASC"
      );
      const sekarang = Date.now();
      const belumBermula = (r) => {
        if (!r.mulaTajaan || !r.tamatTajaan) return false; // penaja bulanan lama — tiada julat, tak pernah "belum bermula"
        const mula = new Date(r.mulaTajaan).getTime();
        return !Number.isNaN(mula) && mula > sekarang;
      };
      const tampil = (rows || []).filter((r) => !belumBermula(r));
      const petaSlot = await bacaPetaSlot(dbAll, tampil.map((r) => r.id));
      res.json(tampil.map((r) => barisKepadaPenajaAwam(r, petaSlot)));
    } catch (err) {
      console.error('GET public/sponsors/semua error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai penaja. ' + (err.message || '') });
    }
  });

  return router;
}
