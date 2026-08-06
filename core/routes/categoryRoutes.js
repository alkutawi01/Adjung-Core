import express from 'express';
import { sanitizeSvgMarkup } from '../utils/sanitizeSvg.js';
import CategoryRegistry from '../category/CategoryRegistry.js';
import { requirePermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

// Senarai putih ketat untuk ikon SVG custom Bidang (muat naik admin) — tiada <script>, tiada
// pengendali on*, tiada href/xlink:href/style (jadi tiada laluan javascript:/url() tersembunyi).
// Bukan cadangan, ni satu-satunya pertahanan XSS untuk laluan ni — jangan longgarkan tanpa sebab kukuh.
const SVG_MAX_BYTES = 100 * 1024; // ikon patut kecil — had jana-jana penyalahgunaan/DB bloat

// Kongsi antara ikon KECIL (di bawah) dan plat ilustrasi BESAR (sanitizeIllustrationSvg) — dahulu
// dua salinan berasingan, satu (ikon) tertinggal tanpa penukaran warna sama sekali (2026-08-06,
// laporan Izzat: "warna pun tak berubah ikut warna yg sepatutnya" selepas muat naik ikon custom).
// Warna literal (fill/stroke/stop-color) ditukar kepada currentColor supaya ikon/plat mewarisi
// warna Bidang (`color` CSS pada wrapper di BidangIcon.tsx), sama seperti ikon lucide-react
// bawaan yang memang guna currentColor secara semula jadi.
const KEKAL_WARNA = /^(?:none|transparent|inherit|currentColor|url\()/i;
function tukarWarnaKepadaCurrentColor(svg) {
  let warnaDitukar = 0;
  let hasil = svg.replace(/\s(fill|stroke|stop-color)\s*=\s*"([^"]*)"/gi, (padanan, atribut, nilai) => {
    if (KEKAL_WARNA.test(nilai.trim())) return padanan;
    warnaDitukar++;
    return ` ${atribut}="currentColor"`;
  });

  // Ikon TANPA atribut `fill` eksplisit langsung (kes biasa: fail line-icon yang bergantung pada
  // lalai SVG) tak pernah sepadan regex di atas — tiada apa untuk "ditukar". Tapi lalai SVG bila
  // `fill` tiada ialah HITAM, bukan warisi warna induk — jadi ikon tetap hitam walaupun wrapper
  // `color` CSS betul. Suntik `fill="currentColor"` pada akar <svg> (fill DIWARISI ke anak yang
  // tiada fill sendiri) supaya kes ni turut ikut warna Bidang. (2026-08-06, ditemui semasa
  // pembetulan data sedia ada — skrip migrasi laporkan 0/9 ditukar walaupun ikon jelas hitam,
  // sebab tiada literal fill/stroke untuk regex atas tangkap langsung.)
  const akhirTagAkar = hasil.indexOf('>');
  const tagAkar = hasil.slice(0, akhirTagAkar + 1);
  if (!/\sfill\s*=/i.test(tagAkar)) {
    hasil = tagAkar.replace(/^<svg/i, '<svg fill="currentColor"') + hasil.slice(akhirTagAkar + 1);
    warnaDitukar++;
  }

  return { svg: hasil, warnaDitukar };
}

function sanitizeSvgIcon(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('SVG kosong.');
  if (Buffer.byteLength(raw, 'utf8') > SVG_MAX_BYTES) throw new Error('Fail SVG terlalu besar (had 100KB).');
  // Penapisan senarai putih dikongsi dengan muat naik media (core/utils/sanitizeSvg.js) supaya
  // tiada dua salinan peraturan keselamatan yang boleh terpesong antara satu sama lain.
  let cleaned = sanitizeSvgMarkup(raw);
  ({ svg: cleaned } = tukarWarnaKepadaCurrentColor(cleaned));
  return cleaned;
}

// ---------------------------------------------------------------------------------------------
// SPEC PLAT ILUSTRASI BIDANG
//
// Plat besar yang dipapar dalam kolum kanan Focus View apabila kolum itu benar-benar kosong.
// Berbeza sepenuhnya daripada ikon Bidang 13px — jangan muat naik ikon lucide yang dibesarkan;
// stroke setebal 2px pada kanvas 24 unit jadi nipis dan generik pada saiz bacaan.
//
// DUA SYARAT sahaja dikuatkuasakan — sengaja sedikit, kerana setiap syarat bermakna satu fail
// terpaksa disunting tangan:
//
//   1. viewBox WUJUD   nombornya bebas. "0 0 1024 1024" sama sah seperti "0 0 256 256"; CSS
//                      menyaiz mengikut nisbah, jadi nombor itu tidak pernah kelihatan. Tanpa
//                      viewBox pula, height:auto tiada nisbah untuk dikira dan plat runtuh.
//   2. Had fail        256KB.
//
// Selebihnya DIBETULKAN sendiri, bukan ditolak: warna literal ditukar kepada currentColor, dan
// width/height pada akar dibuang. Kalau sistem mampu membetulkannya, ia tidak patut menjadi syarat
// yang memaksa manusia menyunting fail.
//
// Selebihnya CADANGAN reka bentuk, bukan syarat: nisbah segi empat sama duduk paling baik dalam
// kolum; kekalkan karya sedikit dari tepi supaya ia tidak tersepit; garis halus supaya plat kekal
// senyap dan tidak menarik perhatian daripada tajuk.
//
// Tag/atribut yang dibenarkan sama seperti ikon (SVG_ALLOWED_TAGS/ATTR) — tiada <script>, tiada
// pengendali on*, tiada rujukan luar.
const ILLUSTRATION_MAX_BYTES = 256 * 1024;

function sanitizeIllustrationSvg(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('SVG kosong.');
  if (Buffer.byteLength(raw, 'utf8') > ILLUSTRATION_MAX_BYTES) {
    throw new Error('Fail SVG terlalu besar (had 256KB untuk plat ilustrasi).');
  }

  let cleaned = sanitizeSvgMarkup(raw);

  // viewBox mesti ADA, tetapi nombornya bebas.
  //
  // Versi pertama semakan ini menuntut tepat "0 0 256 256". Itu salah: CSS menyaiz plat dengan
  // width 240px dan height auto, jadi SVG berskala mengikut NISBAH sahaja — "0 0 1024 1024"
  // dipapar sama persis seperti "0 0 256 256". Menuntut nombor tertentu cuma memaksa pereka
  // menyunting tangan setiap fail untuk sifar perbezaan pada skrin.
  //
  // Yang benar-benar perlu ialah kewujudan viewBox: tanpanya, height:auto tiada nisbah untuk
  // dikira dan plat runtuh. Nisbah bukan segi empat sama pun diterima — CSS mengandungkannya
  // dalam kotak 240x240 (lihat .bidang-illustration di src/index.css).
  const vb = cleaned.match(/\sviewBox\s*=\s*"([^"]*)"/i);
  const vbNums = vb ? vb[1].trim().split(/[\s,]+/).map(Number) : [];
  if (vbNums.length !== 4 || vbNums.some(n => !Number.isFinite(n)) || vbNums[2] <= 0 || vbNums[3] <= 0) {
    throw new Error('SVG mesti ada viewBox yang sah, cth viewBox="0 0 1024 1024". Tanpanya plat tidak boleh diskalakan.');
  }

  // Warna tetap DITUKAR, bukan ditolak.
  //
  // Versi terdahulu menolak sebarang fill/stroke berwarna tetap dan menyuruh pereka menyunting
  // fail sendiri. Itu kerja yang sistem memang mampu buat: plat ini monokrom mengikut reka bentuk
  // (marun Adjung, ditetapkan komponen melalui `color`), jadi setiap warna literal dalam fail
  // memang sepatutnya menjadi currentColor. Menolak fail kerana ia hitam, sedangkan kita akan
  // mewarnakannya semula, cuma memindahkan kerja mekanikal kepada manusia.
  //
  // Yang DIKEKALKAN: `none` (bermaksud jangan isi — bukan warna), `transparent`, `inherit`,
  // `currentColor` sendiri, dan rujukan `url(#...)` kepada kecerunan. Stop kecerunan yang berwarna
  // tetap turut ditukar, jadi kecerunan menjadi rata currentColor — betul untuk plat monokrom.
  //
  // Nilai legap (opacity/fill-opacity/stroke-opacity) tidak disentuh, jadi variasi ton dalam karya
  // asal masih kekal.
  const { svg: svgWarnaDitukar, warnaDitukar } = tukarWarnaKepadaCurrentColor(cleaned);
  cleaned = svgWarnaDitukar;

  // width/height pada akar melawan penyaizan CSS; buang senyap-senyap, bukan tolak.
  const rootTag = cleaned.slice(0, cleaned.indexOf('>') + 1);
  cleaned = rootTag.replace(/\s(?:width|height)\s*=\s*"[^"]*"/gi, '') + cleaned.slice(rootTag.length);

  return { svg: cleaned, warnaDitukar };
}

export function createCategoryRoutes(db) {
  const router = express.Router();
  // Log Audit (Fasa 4) — CategoryRegistry sendiri hanya terima `db` mentah (bukan dbRun
  // terbalut), jadi bina penyesuai ringkas ke bentuk (query, params) yang logAudit jangkakan.
  const dbRunAdapter = (query, params) => CategoryRegistry.dbRun(db, query, params);

  // GET /api/system/categories
  router.get('/categories', async (req, res) => {
    try {
      const categories = await CategoryRegistry.getAllCategories(db);
      res.json(categories);
    } catch (err) {
      console.error('Fetch categories error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai Bidang.' });
    }
  });

  // POST /api/system/categories/register
  router.post('/categories/register', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Parameter nama tiada.' });
      const reg = await CategoryRegistry.registerCategory(db, name);
      await logAudit(dbRunAdapter, { actorId: req.session?.user?.id, actorName: req.session?.user?.penName || req.session?.user?.username, action: 'daftar-bidang', targetType: 'bidang', targetId: reg?.id, detail: name });
      res.json({ success: true, category: reg });
    } catch (err) {
      console.error('Register category error:', err);
      res.status(500).json({ error: 'Gagal mendaftarkan Bidang.' });
    }
  });

  // POST /api/system/categories/rename
  router.post('/categories/rename', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { oldName, newName } = req.body;
      if (!oldName || !newName) return res.status(400).json({ error: 'Parameter nama lama atau nama baharu tiada.' });
      await CategoryRegistry.renameCategory(db, oldName, newName);
      await logAudit(dbRunAdapter, { actorId: req.session?.user?.id, actorName: req.session?.user?.penName || req.session?.user?.username, action: 'namakan-semula-bidang', targetType: 'bidang', detail: `${oldName} -> ${newName}` });
      res.json({ success: true });
    } catch (err) {
      console.error('Rename category error:', err);
      res.status(500).json({ error: 'Gagal menamakan semula Bidang.' });
    }
  });

  // POST /api/system/categories/merge
  router.post('/categories/merge', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { sourceCategory, targetCategory } = req.body;
      if (!sourceCategory || !targetCategory) return res.status(400).json({ error: 'Parameter Bidang sumber atau Bidang sasaran tiada.' });
      await CategoryRegistry.mergeCategories(db, sourceCategory, targetCategory);
      await logAudit(dbRunAdapter, { actorId: req.session?.user?.id, actorName: req.session?.user?.penName || req.session?.user?.username, action: 'gabung-bidang', targetType: 'bidang', detail: `${sourceCategory} -> ${targetCategory}` });
      res.json({ success: true });
    } catch (err) {
      console.error('Merge categories error:', err);
      res.status(500).json({ error: 'Gagal menggabungkan Bidang.' });
    }
  });

  // GET /api/system/categories/active — senarai Bidang tertutup (Taksonomi), setiap satu
  // disertakan nombor slot yang diperuntukkan untuknya.
  router.get('/categories/active', async (req, res) => {
    try {
      const active = await CategoryRegistry.getActiveCategories(db);
      const withSlots = await Promise.all(active.map(async (cat) => {
        // illustrationSvg SENGAJA tidak dihantar di sini. getActiveCategories buat SELECT *, dan
        // senarai ini dimuat oleh frontpage awam pada setiap muat halaman — menghantar kesemua 25
        // plat bermakna beberapa megabait markup dikirim kepada setiap pelawat sedangkan paling
        // banyak SATU plat pernah dipapar, dan itu pun cuma di dalam Focus View.
        //
        // Yang tinggal ialah bendera boolean, cukup untuk Taksonomi menunjukkan Bidang mana sudah
        // ada plat. Markup penuh diambil satu per satu melalui GET /categories/illustration/:id.
        const { illustrationSvg, ...rest } = cat;
        return {
          ...rest,
          hasIllustration: !!(illustrationSvg && String(illustrationSvg).trim()),
          slots: await CategoryRegistry.getSlotsForCategory(db, cat.name)
        };
      }));
      res.json(withSlots);
    } catch (err) {
      console.error('Fetch active categories error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai Bidang aktif.' });
    }
  });

  // POST /api/system/categories/activate — "+ Tambah Bidang" di Taksonomi (Ketua Editor sahaja,
  // dikuatkuasakan di peringkat UI — lihat TetapanConsole.tsx).
  router.post('/categories/activate', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { name, color, icon } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Nama Bidang diperlukan.' });
      const reg = await CategoryRegistry.activateCategory(db, name, color, icon);
      res.json({ success: true, category: reg });
    } catch (err) {
      console.error('Activate category error:', err);
      res.status(500).json({ error: err.message || 'Failed to activate category.' });
    }
  });

  // POST /api/system/categories/unify-colors — selaraskan SEMUA Bidang aktif kepada SATU warna
  // (Izzat: "biar editor boleh pilih nak selaraskan semua bidang guna satu warna sahaja, atau
  // pelbagaikan"). Ikon custom tak perlu diproses semula — warna diwarisi hidup (currentColor).
  router.post('/categories/unify-colors', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { color } = req.body || {};
      if (!color) return res.status(400).json({ error: 'Warna diperlukan.' });
      const hasil = await CategoryRegistry.unifyAllColors(db, color);
      await logAudit(dbRunAdapter, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'selaraskan-warna-bidang',
        targetType: 'bidang',
        detail: `${hasil.dikemas} Bidang -> ${color}`,
      });
      res.json({ success: true, ...hasil });
    } catch (err) {
      console.error('Unify category colors error:', err);
      res.status(400).json({ error: err.message || 'Gagal menyelaraskan warna.' });
    }
  });

  // POST /api/system/categories/diversify-colors — Bidang aktif yang berkongsi warna sama
  // diagihkan warna baharu berbeza (Bidang paling lama dalam kumpulan berkongsi tu kekal dengan
  // warna asalnya). Bidang yang warnanya sudah unik langsung tak diusik.
  router.post('/categories/diversify-colors', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const hasil = await CategoryRegistry.diversifyColors(db);
      await logAudit(dbRunAdapter, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'pelbagaikan-warna-bidang',
        targetType: 'bidang',
        detail: `${hasil.dikemas} daripada ${hasil.diperiksa} Bidang dikemas kini`,
      });
      res.json({ success: true, ...hasil });
    } catch (err) {
      console.error('Diversify category colors error:', err);
      res.status(400).json({ error: err.message || 'Gagal mempelbagaikan warna.' });
    }
  });

  // POST /api/system/categories/rename-active — tukar nama SATU baris Bidang taksonomi (tak
  // cascade ke kandungan sedia ada — lihat nota di renameActiveCategory()).
  router.post('/categories/rename-active', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id, newName } = req.body;
      if (!id || !newName || !newName.trim()) return res.status(400).json({ error: 'id dan newName diperlukan.' });
      await CategoryRegistry.renameActiveCategory(db, id, newName);
      res.json({ success: true });
    } catch (err) {
      console.error('Rename active category error:', err);
      res.status(500).json({ error: err.message || 'Gagal menamakan semula Bidang.' });
    }
  });

  // GET /api/system/categories/taksonomi — senarai PENUH Bidang (aktif DAN arkib) untuk konsol
  // Bidang Editorium. Berasingan daripada /categories/active (yang cuma aktif, untuk dropdown
  // awam/borang kandungan) — di sini Ketua Editor perlu nampak dua-dua status untuk boleh
  // pulihkan yang diarkib.
  router.get('/categories/taksonomi', async (req, res) => {
    try {
      const semua = await CategoryRegistry.getAllCategories(db);
      const withSlots = await Promise.all(semua.map(async (cat) => ({
        ...cat,
        slots: await CategoryRegistry.getSlotsForCategory(db, cat.name),
      })));
      res.json(withSlots);
    } catch (err) {
      console.error('Fetch taksonomi categories error:', err);
      res.status(500).json({ error: 'Gagal membaca Taksonomi Bidang.' });
    }
  });

  // POST /api/system/categories/set-active — arkib/pulih SATU Bidang (Ketua Editor sahaja,
  // dikuatkuasakan di peringkat UI — lihat BidangConsole.tsx).
  router.post('/categories/set-active', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id, isActive } = req.body;
      if (!id) return res.status(400).json({ error: 'id Bidang diperlukan.' });
      await CategoryRegistry.setActiveStatus(db, id, !!isActive);
      await logAudit(dbRunAdapter, { actorId: req.session?.user?.id, actorName: req.session?.user?.penName || req.session?.user?.username, action: isActive ? 'aktifkan-bidang' : 'arkib-bidang', targetType: 'bidang', targetId: id });
      res.json({ success: true });
    } catch (err) {
      console.error('Set active category error:', err);
      res.status(500).json({ error: err.message || 'Failed to update category status.' });
    }
  });

  // GET /api/system/categories/illustration?name=<Bidang> — markup plat SATU Bidang.
  //
  // Berasingan daripada /categories/active dengan sengaja: plat boleh ratusan kilobait, dan hanya
  // satu diperlukan pada satu-satu masa (Focus View memaparkan plat Bidang kandungan yang dibuka
  // sahaja). Menghantarnya dalam senarai pukal bermakna setiap pelawat frontpage memuat turun
  // kesemua 25 plat untuk memaparkan sifar atau satu.
  router.get('/categories/illustration', async (req, res) => {
    try {
      const name = String(req.query.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name diperlukan.' });
      const row = await CategoryRegistry.dbGet(db,
        "SELECT illustrationSvg FROM CategoryRegistry WHERE LOWER(name) = LOWER(?) AND isActive = 1", [name]);
      res.json({ illustrationSvg: (row && row.illustrationSvg) || null });
    } catch (err) {
      console.error('Fetch illustration error:', err);
      res.status(500).json({ error: 'Gagal membaca plat ilustrasi.' });
    }
  });

  // GET /api/system/categories/slot-usage — keadaan kesemua 38 slot frontpage dalam satu panggilan:
  // Bidang mana yang memilikinya, dan BERAPA kandungan live/pending ada di dalamnya.
  //
  // Kiraan itu penting, bukan hiasan: menukar Bidang sesuatu slot mengarkibkan setiap kandungan
  // approved/pending di dalamnya (archiveLiveContentInSlot). Tanpa kiraan ini, amaran sebelum
  // menyimpan cuma boleh berkata "kandungan akan diarkibkan" secara umum — dengan ia, amaran boleh
  // menyebut angka sebenar yang akan hilang daripada frontpage.
  router.get('/categories/slot-usage', async (req, res) => {
    try {
      const rows = await CategoryRegistry.dbAll(db,
        "SELECT slotIndex, manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage'");
      const counts = await CategoryRegistry.dbAll(db, `
        SELECT o.slotIndex AS slotIndex, COUNT(DISTINCT o.id) AS liveCount
        FROM editorial_objects o
        JOIN editorial_revisions r ON r.objectId = o.id AND r.status IN ('approved', 'pending')
        WHERE o.slotIndex >= 0
        GROUP BY o.slotIndex
      `);
      const bySlot = new Map(counts.map(c => [Number(c.slotIndex), Number(c.liveCount)]));
      const deskBySlot = new Map(rows.map(r => [Number(r.slotIndex), (r.manualDesk || '').trim()]));

      res.json(Array.from({ length: 38 }, (_, slotIndex) => ({
        slotIndex,
        bidang: deskBySlot.get(slotIndex) || '',
        liveCount: bySlot.get(slotIndex) || 0
      })));
    } catch (err) {
      console.error('Slot usage error:', err);
      res.status(500).json({ error: 'Gagal membaca keadaan slot.' });
    }
  });

  // POST /api/system/categories/assign-slot — arah "pilih slot untuk Bidang" dari Taksonomi.
  // SENGAJA hanya UPDATE lajur manualDesk (bukan guna POST /slots yang INSERT OR REPLACE ~30
  // lajur sekali gus dan akan kosongkan medan slot lain). bidangName kosong = nyahtetapkan slot.
  router.post('/categories/assign-slot', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { slotIndex, bidangName } = req.body;
      if (slotIndex === undefined || slotIndex === null || Number(slotIndex) < 0) {
        return res.status(400).json({ error: 'slotIndex tidak sah.' });
      }
      const trimmed = (bidangName || '').trim();
      if (trimmed) {
        const active = await CategoryRegistry.getActiveCategories(db);
        const match = active.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
        if (!match) {
          return res.status(400).json({ error: `Bidang "${trimmed}" bukan Bidang aktif. Pilih daripada senarai Taksonomi.` });
        }
      }

      const currentRow = await CategoryRegistry.dbGet(db, "SELECT manualDesk, contentMode FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slotIndex]);
      const oldDesk = (currentRow && currentRow.manualDesk) || '';

      // UPSERT, bukan UPDATE kosong (2026-08-06, disahkan hidup — laporan Izzat "tak boleh save
      // bidang untuk slot tertentu"). Dahulu UPDATE TULEN: kalau baris slots_config bagi slot tu
      // belum wujud (slot yang tak pernah disimpan melalui Urus Slot), UPDATE padan SIFAR baris,
      // SQLite tak lempar ralat, dan laluan ni tetap pulangkan {success:true} — UI papar berjaya
      // sedangkan tiada apa tersimpan. Sekarang baris dicipta kalau tiada; `changes` disemak
      // selepas tu supaya kegagalan sebenar tak lagi senyap.
      const hasilTulis = await CategoryRegistry.dbRun(db, `
        INSERT INTO slots_config (layoutTemplateId, slotIndex, manualDesk)
        VALUES ('frontpage', ?, ?)
        ON CONFLICT(layoutTemplateId, slotIndex) DO UPDATE SET manualDesk = excluded.manualDesk
      `, [slotIndex, trimmed]);
      if (!hasilTulis || hasilTulis.changes === 0) {
        return res.status(500).json({ error: `Slot ${Number(slotIndex) + 1} gagal disimpan — tiada baris ditulis.` });
      }

      // Bidang slot betul-betul berubah — kandungan live/pending lama dalam slot ni tak lagi
      // sepadan, arkib supaya tak terus terpapar dengan Bidang yang tak sah.
      if (oldDesk.toLowerCase() !== trimmed.toLowerCase()) {
        await CategoryRegistry.archiveLiveContentInSlot(db, slotIndex);
        // Slot Manual: giliran SEBENAR yang dibaca modal Urus Slot ialah teks mentah
        // manualSummary — archiveLiveContentInSlot() di atas cuma tanda status baris
        // editorial_revisions (untuk paparan Semakan Kandungan), TIDAK sentuh teks tu. Tanpa
        // baris ni, kandungan "diarkib" muncul semula setiap kali modal dibuka (dihurai balik
        // daripada teks lama yang tak berubah), dan disiar semula sebagai 'approved' bila
        // disimpan. Kosongkan sekali supaya kedua-dua sumber data selari.
        if (currentRow && currentRow.contentMode === 'Manual') {
          await CategoryRegistry.dbRun(db, "UPDATE slots_config SET manualSummary = '' WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slotIndex]);
        }
      }

      await logAudit(dbRunAdapter, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'tetapkan-bidang-slot',
        targetType: 'slot',
        targetId: String(slotIndex),
        detail: trimmed || '(kosong)',
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Assign slot error:', err);
      res.status(500).json({ error: err.message || 'Failed to assign slot.' });
    }
  });

  // POST /api/system/categories/set-icon — pilih ikon lucide-react daripada pemilih di Taksonomi.
  router.post('/categories/set-icon', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id, icon } = req.body;
      if (!id || !icon) return res.status(400).json({ error: 'id dan icon diperlukan.' });
      await CategoryRegistry.setIcon(db, id, icon);
      res.json({ success: true });
    } catch (err) {
      console.error('Set icon error:', err);
      res.status(400).json({ error: err.message || 'Gagal menetapkan ikon.' });
    }
  });

  // POST /api/system/categories/set-icon-svg — muat naik ikon SVG custom (Taksonomi). Markup
  // ditapis ketat (SVG_ALLOWED_TAGS/ATTR) sebelum disimpan — jangan skip langkah ni.
  router.post('/categories/set-icon-svg', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id, svg } = req.body;
      if (!id || !svg) return res.status(400).json({ error: 'id dan svg diperlukan.' });
      const cleaned = sanitizeSvgIcon(svg);
      await CategoryRegistry.setIconSvg(db, id, cleaned);
      res.json({ success: true });
    } catch (err) {
      console.error('Set icon SVG error:', err);
      res.status(400).json({ error: err.message || 'Gagal memuat naik SVG.' });
    }
  });

  // POST /api/system/categories/set-color — tukar warna identiti Bidang.
  //
  // Warna diberi automatik semasa Bidang dicipta dan sebelum ini tiada cara langsung untuk
  // menukarnya — tiada rute, tiada UI. Warna ini muncul pada eyebrow kad, glif Bidang dan eyebrow
  // Focus View, jadi Bidang yang mendapat warna tidak sesuai kekal begitu selama-lamanya.
  router.post('/categories/set-color', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id, color } = req.body;
      if (!id || !color) return res.status(400).json({ error: 'id dan color diperlukan.' });
      await CategoryRegistry.setColor(db, id, color);
      res.json({ success: true });
    } catch (err) {
      console.error('Set colour error:', err);
      res.status(400).json({ error: err.message || 'Gagal menetapkan warna.' });
    }
  });

  // POST /api/system/categories/set-illustration-svg — muat naik plat ilustrasi Bidang.
  // Disahkan ikut spec di atas (viewBox 256x256, currentColor sahaja) DAN ditapis dengan senarai
  // putih yang sama seperti ikon. Jangan skip mana-mana daripada dua langkah itu.
  router.post('/categories/set-illustration-svg', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id, svg } = req.body;
      if (!id || !svg) return res.status(400).json({ error: 'id dan svg diperlukan.' });
      const { svg: cleaned, warnaDitukar } = sanitizeIllustrationSvg(svg);
      await CategoryRegistry.setIllustrationSvg(db, id, cleaned);
      // Markup yang BENAR-BENAR disimpan dipulangkan, supaya pratonton di Editorium memaparkan plat
      // sebenar (sudah bermarun) dan bukan fail mentah yang dipilih pengguna.
      res.json({ success: true, illustrationSvg: cleaned, warnaDitukar });
    } catch (err) {
      console.error('Set illustration SVG error:', err);
      res.status(400).json({ error: err.message || 'Gagal memuat naik plat ilustrasi.' });
    }
  });

  // POST /api/system/categories/clear-illustration-svg — buang plat ilustrasi Bidang.
  router.post('/categories/clear-illustration-svg', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id diperlukan.' });
      await CategoryRegistry.clearIllustrationSvg(db, id);
      res.json({ success: true });
    } catch (err) {
      console.error('Clear illustration SVG error:', err);
      res.status(400).json({ error: err.message || 'Gagal membuang plat ilustrasi.' });
    }
  });

  return router;
}
