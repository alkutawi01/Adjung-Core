import express from 'express';
import { ceilingForSlot as getGeometryCeilingForSlot, TIER_SLOTS } from '../editorial/GeometryConfig.js';
import { JENIS_ANIMASI_ASAS } from '../editorial/AnimasiConfig.js';
import { detectSourceType } from '../editorial/SourceDetector.js';
import CategoryRegistry from '../category/CategoryRegistry.js';
import { requireAuth, hasPermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';
import { MANUAL_BLOCK_SPLIT_REGEX, MANUAL_BLOCK_SEPARATOR, parseManualBlockFields } from '../editorial/ManualBlockFormat.js';
import { namaSepadan } from './contentRoutes.js';
// denganKunciTicker (2026-08-20, dapatan audit modul Ticker) — simpanan Ticker mod Manual di
// bawah menulis-ganti `inTheNewsText`, medan yang sama yang ditulis serapan RSS Direct
// (slotRoutes.js) di bawah rantaian kunci BERASINGAN. Tanpa kunci ni, simpanan Manual boleh
// mendarat tepat antara baca dan tulis serapan RSS — dan kandungan Manual yang baru disimpan
// ditimpa semula oleh RSS beberapa milisaat kemudian, seolah-olah simpanan tak pernah berlaku.
// SUSUNAN KUNCI: Kandungan DAHULU, Ticker KEMUDIAN (lihat nota penuh di contentRoutes.js).
import { denganKunciKandungan, denganKunciTicker } from '../utils/kunciKandungan.js';

// Gerbang Nota (2026-08-05, permintaan Ketua Editor) — medan "Nota editor" (Focus View)
// sepatutnya HANYA boleh ditulis oleh (a) editor yang DITUGASKAN slot berkenaan (`slot_editors`,
// bukan sesiapa yang kebetulan boleh buka Urus Slot — sesiapa BOLEH sebab tiada gerbang tulis
// per-slot sedia ada, lihat nota di POST /slots di bawah) atau (b) Ketua Editor/Penolong Ketua
// Editor (kunci `manageEditorial` sedia ada, PERANAN SAHAJA — bukan terikat slot tertentu).
// Editor lain yang boleh sunting tajuk/huraian slot yang SAMA (kebenaran sedia ada, sengaja
// longgar) TETAP disekat khusus pada medan Nota sahaja — baki borang tak disentuh.
async function bolehTulisNota(dbAll, req, slotIndex) {
  if (hasPermission(req.session?.user?.roles, 'manageEditorial')) return true;
  const userId = req.session?.user?.id;
  if (!userId) return false;
  const rows = await dbAll('SELECT 1 FROM slot_editors WHERE slotIndex = ? AND editorId = ?', [slotIndex, userId]);
  return rows.length > 0;
}

// Ganti HANYA baris "Nota: ..." dalam SATU blok (dikenal pasti dgn UUID), biar baki blok
// (tajuk/huraian/sumber/dll — medan yg editor tu MEMANG dibenarkan ubah) tak disentuh. Pemadanan
// blok guna regex sama seperti parseManualSummaryTemplate (server.js) supaya kedua-dua bahagian
// baca teks yang SAMA cara — tidak diimport terus (function besar, digandingkan rapat dengan
// parseManualSummaryTemplate/syncManualObjectsForSlot di server.js), corak "disalin sengaja
// tak disatukan" yang sama macam ManualBlockFormat.js/server.js parser berganda.
function kekalkanNotaLama(manualSummaryBaharu, notaLamaByUuid) {
  if (!manualSummaryBaharu || !manualSummaryBaharu.includes('UUID:')) return manualSummaryBaharu;
  const blocks = manualSummaryBaharu.split(/(?:\r?\n){2,}(?=UUID:|Tajuk:|Event:)|____+|----+|====+|___+/i);
  const diperbetul = blocks.map((block) => {
    const uuidMatch = block.match(/^UUID:\s*(.*)$/m);
    const uuid = uuidMatch ? uuidMatch[1].trim() : '';
    // UUID tiada langsung dlm map DAN tiada dlm blok pun (format usang/rosak) — tiada garis dasar
    // dipercayai, biar sahaja (risiko lebih tinggi ganggu format sedia ada drpd faedah gerbang
    // ni). UUID wujud tapi BUKAN dlm map (kandungan BAHARU editor tak sah ni cipta sendiri) —
    // garis dasar KOSONG ('') — editor tu "bertanggungjawab menulis kandungan" makna ditugaskan
    // SLOT, bukan sekadar orang yang kebetulan sedang menaip; kandungan baharu dlm slot bukan
    // tugasannya tetap tak boleh bawa Nota.
    if (!uuid) return block;
    const notaLama = notaLamaByUuid.has(uuid) ? notaLamaByUuid.get(uuid) : '';
    if (/^Nota:.*$/m.test(block)) {
      return block.replace(/^Nota:.*$/m, `Nota: ${notaLama}`);
    }
    return `${block}\nNota: ${notaLama}`;
  });
  return diperbetul.join('\n\n________________________________________\n\n');
}

// Draf peribadi (2026-08-08, Fasa 3 pemilikan kandungan, keputusan Izzat — "kandungan yg
// ditulis oleh editor A, hanya editor A yg boleh edit, terbit, atau draf"). SlotManagerModal.tsx
// (klien) sudah tapis `items` supaya blok editor LAIN tak pernah kelihatan/disunting — tapi itu
// makna payload yang dihantar client SECARA STRUKTUR tak membawa blok tersebut langsung. Kalau
// server tulis-ganti manualSummary DENGAN payload tu SAHAJA, draf setiap editor lain dalam slot
// yang sama PADAM. Fungsi ni gabung semula: ambil blok "bukan milik saya" daripada versi
// TERSIMPAN (bukan yang client hantar), lekatkan pada penghujung payload baharu.
//
// Pemilikan blok = medan `penulis` (dicap sekali semasa blok dicipta, lihat ManualBlockFormat.js).
// Blok tanpa `penulis` (belum dituntut) dianggap KEPUNYAAN SAYA di sini — sepadan tapisan klien,
// supaya blok tak berpemilik yang seseorang sedang mula isi tak "hilang" (sebenarnya cuma
// terkeluar daripada gabungan ni sebab ia memang sepatutnya ada dalam payload client).
//
// Slot Bar DIKECUALIKAN — tiada pemisahan draf/terbit untuk tier tu, seluruh giliran ialah SATU
// hantaran keseluruhan setiap Simpan (lihat nota isBarLikeRemoval/isBarUpdate di server.js).
function kekalkanDrafOrangLain(manualSummaryBaharu, manualSummaryLama, namaPenggunaSemasa) {
  if (!manualSummaryLama || !manualSummaryLama.includes('UUID:')) return manualSummaryBaharu;
  const blokLama = manualSummaryLama.split(MANUAL_BLOCK_SPLIT_REGEX).filter((b) => b.trim().length > 0);
  const drafOrangLain = blokLama.filter((block) => {
    const fields = parseManualBlockFields(block);
    // Cuma draf (status !== 'draft' bermakna dah TERBIT — direkodkan di editorial_objects,
    // bukan dalam manualSummary lagi, jadi tak sepatutnya muncul di sini pun; disemak untuk
    // selamat) DAN penulis SAH bukan pengguna semasa. namaSepadan() (bukan !==, 2026-08-20,
    // baki isu 1e daripada pelan 18/8 — helper pemilikan disatukan di tempat lain tapi tapak
    // ni terlepas) — padanan tepat sensitif-huruf bermakna editor yang penName-nya beza huruf
    // besar/kecil sikit sahaja (cth ejaan sesi vs ejaan blok tersimpan) dilayan sebagai "orang
    // lain", draf sendiri boleh tersalin/berganda dalam gabungan ni.
    return fields.status === 'draft' && fields.penulis && !namaSepadan(fields.penulis, namaPenggunaSemasa);
  });
  if (drafOrangLain.length === 0) return manualSummaryBaharu;
  const bahagianBaharu = (manualSummaryBaharu || '').trim();
  return bahagianBaharu
    ? `${bahagianBaharu}${MANUAL_BLOCK_SEPARATOR}${drafOrangLain.join(MANUAL_BLOCK_SEPARATOR)}`
    : drafOrangLain.join(MANUAL_BLOCK_SEPARATOR);
}

// Ticker Manual mode is genuinely freeform text (the Chief Editor types the whole
// desk:/title:/brief:/source:/url: block directly into a plain textarea — no client-side template
// assembly to hook into, see TickerManagementModal.tsx). Stamping "Mode: Manual" per block here,
// server-side, is the only reliable place: every block saved through THIS handler (contentMode ===
// 'Manual') was, by construction, entered manually, so this is safe to add unconditionally rather
// than needing to parse per-block intent. Mirrors parseTickerText's tolerant block-separator regex
// (core/routes/contentRoutes.js) so re-serializing here can't desync from how it'll be re-parsed.
// Corak pemisah DISELARASKAN dengan parseTickerText (contentRoutes.js) — SALINAN KETIGA yang
// terlepas semasa pembetulan 20/8 (dapatan audit susulan): corak lama tanpa penambat baris
// memecahkan blok pada mana-mana tiga sempang, termasuk di dalam URL yang Ketua Editor tampal
// terus dalam textarea Manual ni. "Ubah kedua-duanya SERENTAK" (nota asal di atas fungsi ni)
// sebenarnya ada TIGA tempat, bukan dua — kalau corak ni diubah lagi, semak jugak
// contentRoutes.js parseTickerText DAN src/utils.tsx parseInTheNews.
export const stampManualModeOnTickerBlocks = (rawText) => {
  if (!rawText || !rawText.trim()) return rawText;
  const blocks = rawText.split(/^[ \t]*(?:[-_—–―]{3,}|⸻+)[ \t]*$/m).map(b => b.trim()).filter(Boolean);
  const stamped = blocks.map(block => {
    const hasMode = block.split('\n').some(line => line.trim().toLowerCase().startsWith('mode:'));
    return hasMode ? block : `${block}\nMode: Manual`;
  });
  return stamped.join('\n____\n');
};

// syncManualObjectsForSlot stays defined in server.js (it's a large function with its own SQL
// transaction, see Phase 1 of this session's server.js cleanup) and is passed in here rather than
// moved, since moving it would also require moving parseManualSummaryTemplate, which
// resolveSlotContent (server.js's render-time path) also depends on.
export function createSlotsConfigRoutes(db, dbAll, dbRun, syncManualObjectsForSlot, parseManualSummaryTemplate) {
  const router = express.Router();

  // GET /api/system/slots (2026-09-02, dapatan audit keselamatan — laluan ni TIADA `requireAuth`
  // sebab portal awam sendiri panggil terus, tanpa sesi, semasa muat frontpage
  // (FrontpageView.tsx) untuk baca override transisi per-slot. Sebelum ni `SELECT *` PENUH
  // dipulangkan kepada SESIAPA sahaja — lajur `manualSummary` menyimpan TEKS DRAF MENTAH sebenar
  // (rujuk nota "Dua laluan edit selepas terbit" di CLAUDE.md — draf belum terbit/ditolak hidup
  // sebagai teks bertanda dalam lajur ni, termasuk baris "Sebab Penolakan:" dan nama editor
  // sebenar), dan `promptText`/`aiPromptSource`/`aiPromptTopic`/dll (Arahan AI dalaman) turut
  // terdedah. Corak pembetulan SAMA seperti `/api/db-state` (dbStateRoutes.js) — subset terhad
  // bila tiada sesi, `SELECT *` PENUH bila sesi Editorium wujud (tiada perubahan utk kes tu).
  //
  // Subset awam dijejak SEPENUHNYA daripada penggunaan sebenar `slotsConfig`
  // (GET /api/system/slots) dalam FrontpageView.tsx (grep menyeluruh setiap akses `s.<medan>`
  // pada state ni) — hanya lapan medan berikut yang benar-benar dibaca portal awam:
  // slotIndex (kunci padanan), carouselInterval (kelajuan pusingan Ticker), dan enam override
  // transisi PER-SLOT (arahOverride, jenisAnimasiOverride, warnaPanelOverride, kelajuanOverride,
  // logoTransisiMode, nisbahPenajaTransisiOverride). Jangan tambah medan baharu di sini tanpa
  // jejak dahulu sama ada ia benar-benar sampai ke kod portal awam — terutamanya JANGAN sertakan
  // manualSummary/promptText/aiPromptSource/aiPromptTopic/aiPromptRecency/aiPromptLanguage/
  // aiPromptRegion/masterPrompt walau agak-agak, semuanya draf/Arahan AI dalaman sensitif.
  const MEDAN_SELAMAT_AWAM = [
    'slotIndex', 'carouselInterval', 'arahOverride', 'jenisAnimasiOverride',
    'warnaPanelOverride', 'kelajuanOverride', 'logoTransisiMode', 'nisbahPenajaTransisiOverride',
  ];

  router.get('/slots', async (req, res) => {
    try {
      const slots = await dbAll("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' ORDER BY slotIndex ASC");
      const disahkan = !!(req.session && req.session.user);
      if (disahkan) {
        res.json(slots);
        return;
      }
      const slotsAwam = slots.map((slot) => {
        const subset = {};
        for (const medan of MEDAN_SELAMAT_AWAM) subset[medan] = slot[medan];
        return subset;
      });
      res.json(slotsAwam);
    } catch (err) {
      console.error('Fetch slots config error:', err);
      res.status(500).json({ error: 'Gagal membaca konfigurasi slot.' });
    }
  });

  // POST /api/system/slots — denganKunciKandungan (2026-08-08, dapatan audit keselamatan
  // ChatGPT) — pengesahan konkurensi optimistik (updatedAt) di bawah cuma "semak dulu, tulis
  // kemudian", BUKAN atomik: dua permintaan pada slot SAMA boleh dua-dua BACA updatedAt lama yang
  // sepadan, dua-dua LULUS semakan, sebelum mana-mana satu pun sempat menulis — 409 tak sekali-kali
  // tercetus walau ini SEBENARNYA situasi yang gerbang tu direka untuk halang. Kunci kongsi ni
  // (sama rantaian dgn PATCH/DELETE/reject-to-draft/pulihkan-sampah kandungan DAN tik penjadual)
  // jadikan baca-semak-tulis SATU unit atomik merentasi permintaan serentak.
  router.post('/slots', requireAuth, (req, res) => denganKunciKandungan(async () => {
    try {
      const slots = Array.isArray(req.body) ? req.body : [req.body];

      // Gerbang akses slot (2026-08-08, Fasa 2 pemilikan kandungan, keputusan Izzat) — Editor
      // biasa hanya boleh menulis dalam slot yang DIA ditugaskan (`slot_editors`). Slot yang
      // ditugaskan kepada orang lain DAN slot yang belum ada tugasan langsung dua-duanya
      // tertutup kepadanya; slot tanpa tugasan terbuka kepada Ketua Editor/Penolong sahaja.
      //
      // Sebelum ni laluan ni cuma `requireAuth`: sesiapa yang log masuk boleh menulis dalam
      // mana-mana slot antara 38, jadi tiada cara tahu siapa pemilik kandungan sebenar. Gerbang
      // di klien (pemilih slot ditapis) TIDAK memadai — ia boleh dipintas terus dari API.
      //
      // Ticker (slotIndex -1) dikecualikan: ia diuruskan berasingan di Modul Khas dengan
      // gerbangnya sendiri, bukan sebahagian pengagihan slot bento.
      const bolehSemuaSlot = hasPermission(req.session?.user?.roles, 'manageEditorial');
      if (!bolehSemuaSlot) {
        const userId = req.session?.user?.id;
        for (const slot of slots) {
          if (slot.slotIndex === -1) continue;
          const ditugaskan = userId
            ? await dbAll('SELECT 1 FROM slot_editors WHERE slotIndex = ? AND editorId = ?', [slot.slotIndex, userId])
            : [];
          if (ditugaskan.length === 0) {
            return res.status(403).json({
              error: `Anda tidak ditugaskan untuk Slot ${slot.slotIndex + 1}. Hubungi Ketua Editor kalau slot ni sepatutnya milik anda.`,
            });
          }
        }
      }

      // Kawalan serentak (2026-08-02, Fasa 6) — SEMAK SEMUA slot dahulu sebelum tulis MANA-MANA
      // satu (sama corak seperti batch_paste — semua-atau-tiada, bukan simpanan separa). Dua
      // editor buka slot sama: yang kedua simpan mesti tahu orang lain dah ubah dulu, bukan
      // menulis-ganti senyap. `slot.updatedAt` yang client hantar ialah nilai yang dia BACA
      // semasa buka slot (GET /slots pulangkan lajur ni terus, tiada laluan berasingan
      // diperlukan) — kalau tak sepadan nilai SEMASA di DB, seseorang lain dah simpan dulu.
      for (const slot of slots) {
        if (slot.updatedAt) {
          const semasaRow = await dbAll(
            "SELECT updatedAt FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?",
            [slot.slotIndex]
          );
          const updatedAtSemasa = semasaRow[0]?.updatedAt || null;
          if (updatedAtSemasa && updatedAtSemasa !== slot.updatedAt) {
            // Cari SIAPA sebenarnya buat simpanan terkini, supaya mesej tepat (2026-08-16,
            // soalan tajam Izzat: "saya orang lain ke?" — semakan ni sebelum ni cuma banding
            // cap masa `updatedAt`, TAK PERNAH semak identiti penulis sebenar, jadi mesej
            // sentiasa kata "orang lain" walaupun penulis sebenar ialah AKAUN SAMA dari
            // tab/peranti lain, macam yang berlaku sesi ni). targetId jejak audit
            // 'kemas-kini-konfigurasi-slot' ialah senarai slotIndex bergabung koma (cth
            // "11" atau "5,11") — bungkus dgn koma kiri/kanan supaya padanan tepat SATU
            // slotIndex, bukan sepadan separa (cth "1" tak silap padan dalam "11").
            const entriTerkini = await dbAll(
              `SELECT actorId, actorName FROM audit_log
               WHERE action = 'kemas-kini-konfigurasi-slot' AND (',' || targetId || ',') LIKE ?
               ORDER BY id DESC LIMIT 1`,
              [`%,${slot.slotIndex},%`]
            );
            const penulisSebenar = entriTerkini[0] || null;
            const idPemohon = req.session?.user?.id;
            let mesej;
            if (penulisSebenar?.actorId && penulisSebenar.actorId === idPemohon) {
              mesej = `Slot ${slot.slotIndex + 1} telah anda sendiri kemas kini di tab/peranti lain sejak slot ini dibuka di sini. Muat semula slot ini dahulu supaya perubahan di sini tidak menimpa simpanan anda yang lebih baharu.`;
            } else if (penulisSebenar?.actorName) {
              mesej = `Slot ${slot.slotIndex + 1} telah dikemas kini oleh ${penulisSebenar.actorName} sejak anda membukanya. Muat semula slot ini dahulu supaya perubahan anda tidak menimpa kerja mereka.`;
            } else {
              mesej = `Slot ${slot.slotIndex + 1} telah dikemas kini sejak anda membukanya. Muat semula slot ini dahulu supaya perubahan anda tidak menimpa kerja yang lebih baharu.`;
            }
            // Format ralat sepadan konvensyen sedia ada di seluruh laluan ni (`error` ialah
            // mesej terus dipapar, bukan kod) — client (useSlotEditor.ts) cuma baca `data.error`.
            return res.status(409).json({ error: mesej });
          }
        }
      }

      // Hasil sebenar setiap kandungan diterbitkan (LIFE-01) — dikumpul merentas semua slot
      // dlm permintaan ni (biasanya satu, Terbit tunggal), dipulangkan dlm response supaya
      // client boleh papar mesej tepat (Diterbitkan vs Menunggu Semakan), bukan sentiasa anggap
      // berjaya = terus aktif.
      const publishOutcomes = [];

      for (const slot of slots) {
        const providerId = slot.providerId && typeof slot.providerId === 'string' && slot.providerId.trim() !== '' && slot.providerId !== 'undefined' && slot.providerId !== 'null' ? slot.providerId : null;
        console.log(`Slot ${slot.slotIndex}: raw providerId = "${slot.providerId}", mapped = ${providerId}`);

        // Bidang kini senarai tertutup kurasi Ketua Editor — sekatan keras sama macam bajet
        // aksara, bukan cuma UI dropdown yang boleh dipintas terus dari API.
        const nextDesk = (slot.manualDesk || '').trim();
        if (nextDesk) {
          const activeBidang = await CategoryRegistry.getActiveCategories(db);
          const matchesActive = activeBidang.some(c => c.name.toLowerCase() === nextDesk.toLowerCase());
          if (!matchesActive) {
            return res.status(400).json({ error: `Bidang "${nextDesk}" bukan Bidang aktif. Pilih daripada senarai Taksonomi.` });
          }
        }
        const prevRow = await dbAll("SELECT manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slot.slotIndex]);
        const prevDesk = (prevRow[0] && prevRow[0].manualDesk) || '';

        // Hard ceiling: a slot's own had aksara can never exceed what its card geometry can
        // physically show, regardless of what the client sends — clamp before it ever reaches
        // storage, so an oversized value can't sneak in and later get copied around on re-save.
        const ceiling = getGeometryCeilingForSlot(slot.slotIndex);
        if (typeof slot.maxTitle === 'number' && slot.maxTitle > ceiling.maxTitle) slot.maxTitle = ceiling.maxTitle;
        if (typeof slot.maxBrief === 'number' && slot.maxBrief > ceiling.maxBrief) slot.maxBrief = ceiling.maxBrief;
        if (typeof slot.maxBriefLong === 'number' && slot.maxBriefLong > ceiling.maxBriefLong) slot.maxBriefLong = ceiling.maxBriefLong;
        const resolvedSourceType = slot.sourceType || detectSourceType(slot.manualUrl, `${slot.manualTitle || ''} ${slot.manualSummary || ''}`);

        // syncManualObjectsForSlot dipanggil DULU (sebelum INSERT slots_config, 2026-07-29) —
        // dua sebab: (1) ia pulangkan teks manualSummary yang PATUT disimpan (draf sahaja, item
        // "Terbitkan" dikeluarkan — lihat nota alur kerja Draf/Terbit di server.js), dan (2)
        // membetulkan pepijat sedia ada di mana kegagalan pengesahan (validation) dulu berlaku
        // SELEPAS slots_config dah ditulis — simpanan tak sah sempat tersimpan walaupun save
        // ditolak. Sekarang pengesahan berlaku dulu; simpanan gagal tak sentuh DB langsung.
        // Gerbang Nota (2026-08-05) — semak SEBELUM syncManualObjectsForSlot supaya pembetulan
        // (kalau perlu) tersedia dalam manualSummary yang sebenarnya diproses/disimpan, bukan
        // selepas fakta. Hanya buat kerja tambahan (baca DB, hurai teks) bila requester TAK ada
        // kebenaran langsung (kes biasa — Ketua Editor/Penolong simpan sendiri — terus langkau).
        if (slot.contentMode === 'Manual' && slot.slotIndex >= 0 && typeof slot.manualSummary === 'string'
            && parseManualSummaryTemplate && !(await bolehTulisNota(dbAll, req, slot.slotIndex))) {
          const semasaSlotRow = await dbAll(
            "SELECT manualSummary FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?",
            [slot.slotIndex]
          );
          const notaLamaByUuid = new Map();
          try {
            const itemLama = parseManualSummaryTemplate((semasaSlotRow[0] && semasaSlotRow[0].manualSummary) || '', slot);
            for (const it of itemLama) {
              if (it.uuid) notaLamaByUuid.set(it.uuid, it.note || '');
            }
          } catch (e) {
            console.warn(`Gagal hurai manualSummary sedia ada slot ${slot.slotIndex} utk semak Nota:`, e.message);
          }
          slot.manualSummary = kekalkanNotaLama(slot.manualSummary, notaLamaByUuid);
        }

        // Gabung draf orang lain (2026-08-08, Fasa 3 pemilikan kandungan) — SELEPAS gerbang Nota
        // (yang boleh ubah suai medan Nota dalam blok SEDIA ADA payload), SEBELUM
        // syncManualObjectsForSlot (yang proses payload sebagai senarai LENGKAP giliran slot).
        // Bukan tier Bar (tiada pemisahan draf/terbit di situ) dan bukan slot Ticker
        // (slotIndex -1, format berasingan sepenuhnya).
        if (slot.contentMode === 'Manual' && slot.slotIndex >= 0 && typeof slot.manualSummary === 'string'
            && !TIER_SLOTS.BAR.includes(slot.slotIndex)) {
          const semasaUntukGabung = await dbAll(
            "SELECT manualSummary FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?",
            [slot.slotIndex]
          );
          const namaSemasa = req.session?.user?.penName || req.session?.user?.username || '';
          slot.manualSummary = kekalkanDrafOrangLain(
            slot.manualSummary,
            (semasaUntukGabung[0] && semasaUntukGabung[0].manualSummary) || '',
            namaSemasa
          );
        }

        let persistedManualSummary = slot.manualSummary;
        if (slot.contentMode === 'Manual' && slot.slotIndex >= 0) {
          try {
            const namaSayaSesi = (req.session?.user?.penName || req.session?.user?.username || '').trim();
            const syncResult = await syncManualObjectsForSlot(slot.slotIndex, slot.manualSummary, slot, req.session?.user?.roles, namaSayaSesi);
            persistedManualSummary = syncResult.manualSummary;
            if (Array.isArray(syncResult.publishOutcomes)) publishOutcomes.push(...syncResult.publishOutcomes);
          } catch (e) {
            if (e.isValidationError) {
              // Hard-block: abort the whole save (not just this slot) so the admin sees exactly
              // why nothing was published, instead of a silent partial save.
              // bolehSalinAI (2026-08-19) — diteruskan dari server.js supaya klien tahu ralat ni
              // berkait kandungan yang AI mungkin janakan (had aksara/format), bukan keputusan
              // editorial (Bidang/kebenaran) — kawal sama ada toast papar butang salin.
              return res.status(400).json({ error: e.message, bolehSalinAI: !!e.bolehSalinAI });
            }
            console.warn(`Failed to sync editorial_objects for slot ${slot.slotIndex}:`, e.message);
          }
        }

        // Override tempoh carousel PER-SLOT (2026-08-26) — corak SAMA seperti arahOverrideSah di
        // bawah: nilai tak sah/kosong jatuh ke null (warisi carouselTempohLalai global), bukan
        // ralat 500. 1-300 saat, sepadan had validasi slot_am_settings.carouselTempohLalai.
        const carouselIntervalOverrideNombor = Number(slot.carouselIntervalOverride);
        const carouselIntervalOverrideSah = Number.isInteger(carouselIntervalOverrideNombor) && carouselIntervalOverrideNombor >= 1 && carouselIntervalOverrideNombor <= 300
          ? carouselIntervalOverrideNombor
          : null;
        const arahOverrideSah = ['', 'kanan', 'kiri', 'atas', 'bawah'].includes(slot.arahOverride) ? slot.arahOverride : '';
        // Jenis animasi PER-SLOT (2026-08-07) — sanitasi sama corak macam arahOverrideSah di atas.
        // Override per-slot SENGAJA terhad kepada JENIS_ANIMASI_ASAS sahaja (TIADA 'rawak') —
        // 'rawak' cuma pilihan GLOBAL (Tetapan Am Slot) buat masa ni.
        const jenisAnimasiOverrideSah = ['', ...JENIS_ANIMASI_ASAS].includes(slot.jenisAnimasiOverride) ? slot.jenisAnimasiOverride : '';
        // Warna panel / kelajuan / logo transisi PER-SLOT (2026-08-07, Pelan 03) — sanitasi corak
        // SAMA seperti dua di atas: nilai tak sah jatuh ke '' (warisi tetapan am), bukan ralat 500.
        // Ini penting sebab '' ialah keadaan lalai yang sah, jadi menolak input rosak dengan
        // senyap-warisi lebih selamat daripada menyimpan nilai yang memecahkan panel transisi.
        // Gerbang per-MEDAN (bukan per-laluan) untuk tetapan estetik transisi — corak sama seperti
        // bolehTulisNota di atas. POST /slots sengaja longgar supaya editor boleh menyunting
        // kandungan slot yang ditugaskan kepadanya; menggerbang seluruh laluan akan mematahkan
        // aliran kerja itu. Jadi medan estetik hanya boleh DIUBAH oleh pemegang `manageEditorial`;
        // bagi yang lain nilai tersimpan dikekalkan, bukan ditolak dengan ralat (mereka menghantar
        // semula borang PENUH, jadi menolak akan menghalang suntingan kandungan yang sah).
        const bolehUbahEstetik = hasPermission(req.session?.user?.roles, 'manageEditorial');
        const sediaAdaRows = bolehUbahEstetik ? [] : await dbAll(
          `SELECT warnaPanelOverride, kelajuanOverride, logoTransisiMode, nisbahPenajaTransisiOverride
             FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?`,
          [slot.slotIndex]
        );
        const sediaAda = sediaAdaRows[0] || {};

        const warnaPanelOverrideSah = !bolehUbahEstetik
          ? (sediaAda.warnaPanelOverride || '')
          : /^#[0-9a-fA-F]{6}$/.test(String(slot.warnaPanelOverride || '')) ? slot.warnaPanelOverride : '';
        const kelajuanNombor = Number(slot.kelajuanOverride);
        const kelajuanOverrideSah = !bolehUbahEstetik
          ? (sediaAda.kelajuanOverride || '')
          : Number.isFinite(kelajuanNombor) && kelajuanNombor >= 0.25 && kelajuanNombor <= 4 ? String(kelajuanNombor) : '';
        const logoTransisiModeSah = !bolehUbahEstetik
          ? (sediaAda.logoTransisiMode || '')
          : ['', 'adjung', 'penaja', 'tiada'].includes(slot.logoTransisiMode) ? slot.logoTransisiMode : '';
        // Nisbah penaja transisi PER-SLOT (2026-08-26, parity 100% dgn Tetapan Am) — corak SAMA
        // seperti kelajuanOverride di atas: '' = warisi tetapan am, subset SAH NISBAH_PENAJA_TRANSISI
        // (0/1/2/3) disimpan sebagai TEKS.
        const nisbahSah = ['', '0', '1', '2', '3'].includes(String(slot.nisbahPenajaTransisiOverride ?? ''));
        const nisbahPenajaTransisiOverrideSah = !bolehUbahEstetik
          ? (sediaAda.nisbahPenajaTransisiOverride || '')
          : nisbahSah ? String(slot.nisbahPenajaTransisiOverride ?? '') : '';

        await dbRun(`
          INSERT OR REPLACE INTO slots_config (
            layoutTemplateId, slotIndex, contentMode, providerId, model, promptText, sourcesList, refreshRate, allowedContentTypes, priority, expiresAt, bgColor, borderColor, textColor,
            manualTitle, manualSummary, manualSource, manualUrl, manualImageUrl, manualDesk, activeObjectId, searchStrategy, carouselInterval, carouselIntervalOverride, carouselDelay, generationLimit, maxTitle, maxBrief, maxBriefLong, refreshHour, refreshDay, eventExpiryFilter,
            aiPromptTopic, aiPromptRecency, aiPromptLanguage, aiPromptRegion, aiPromptSource, sourceType, genMode, arahOverride, jenisAnimasiOverride, warnaPanelOverride, kelajuanOverride, logoTransisiMode, nisbahPenajaTransisiOverride, updatedAt
          ) VALUES ('frontpage', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          slot.slotIndex, slot.contentMode, providerId, slot.model, slot.promptText, slot.sourcesList, slot.refreshRate, slot.allowedContentTypes, slot.priority, slot.expiresAt, slot.bgColor, slot.borderColor, slot.textColor,
          slot.manualTitle, persistedManualSummary, slot.manualSource, slot.manualUrl, slot.manualImageUrl, slot.manualDesk, slot.activeObjectId, slot.searchStrategy || 'Structured Sources Only', slot.carouselInterval || 10, carouselIntervalOverrideSah, slot.carouselDelay || 0, slot.generationLimit || 1, slot.maxTitle !== undefined ? slot.maxTitle : null, slot.maxBrief !== undefined ? slot.maxBrief : null, slot.maxBriefLong !== undefined ? slot.maxBriefLong : null, slot.refreshHour || '00:00', slot.refreshDay || 'Isnin', slot.eventExpiryFilter || '',
          slot.aiPromptTopic || '', slot.aiPromptRecency || '', slot.aiPromptLanguage || '', slot.aiPromptRegion || '', slot.aiPromptSource || '', resolvedSourceType, slot.genMode || 'bebas', arahOverrideSah, jenisAnimasiOverrideSah, warnaPanelOverrideSah, kelajuanOverrideSah, logoTransisiModeSah, nisbahPenajaTransisiOverrideSah, new Date().toISOString()
        ]);

        if (slot.manualDesk && slot.manualDesk.trim() !== '') {
          try {
            await CategoryRegistry.incrementCategoryUsage(db, slot.manualDesk);
          } catch (e) {
            console.warn("Failed to register category:", e.message);
          }
        }

        // Bidang slot betul-betul berubah — kandungan live/pending lama dalam slot ni tak lagi
        // sepadan Bidang terkunci baharu, arkib (status flip, bukan padam — lihat
        // archiveLiveContentInSlot) supaya tak terus terpapar dengan Bidang yang tak sah.
        if (prevDesk.toLowerCase() !== nextDesk.toLowerCase()) {
          try {
            await CategoryRegistry.archiveLiveContentInSlot(db, slot.slotIndex);
          } catch (e) {
            console.warn(`Failed to archive live content for slot ${slot.slotIndex}:`, e.message);
          }
        }

        if (slot.masterPrompt !== undefined && slot.masterPrompt !== null) {
          await dbRun("UPDATE system_settings SET masterPrompt = ? WHERE id = 'settings-main'", [slot.masterPrompt]);
        }

        // 2026-08-02 (Fasa 7, ditemui semasa ujian pemindahan Ticker) — dahulu laluan ni
        // menulis-ganti inTheNewsText TANPA SYARAT bila contentMode Ticker = 'Manual', walaupun
        // slot.manualSummary kosong/tak bermakna. `manualSummary` slot Ticker ialah medan BERBEZA
        // sepenuhnya daripada inTheNewsText sebenar (dua sumber kandungan berasingan) — bermakna
        // satu simpanan tak sengaja dalam mod Manual dengan medan kosong PADAM kandungan Ticker
        // SEBENAR (9000+ aksara sumber RSS sebenar) secara senyap. Nyaris berlaku semasa ujian
        // pemindahan Ticker ke Editorium hari ni — dipulihkan dari backup, tapi punca sebenar
        // (laluan simpan ni) belum dibetulkan sehingga sekarang. Kini hanya tulis-ganti bila
        // manualSummary BENAR-BENAR ada kandungan bermakna — kosong/ruang kosong sahaja dilangkau
        // terus, inTheNewsText sedia ada KEKAL tak disentuh.
        if (slot.slotIndex === -1 && slot.contentMode === 'Manual' && (slot.manualSummary || '').trim() !== '') {
          await denganKunciTicker(async () => {
            await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [stampManualModeOnTickerBlocks(slot.manualSummary)]);
          });
        }
      }

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-konfigurasi-slot',
        targetType: 'slot',
        targetId: slots.map((s) => s.slotIndex).join(','),
        detail: `${slots.length} slot disimpan`,
      });

      // Log KHUSUS setiap kandungan yang BARU diterbitkan/dihantar sesi simpan ni (2026-08-16,
      // permintaan Izzat -- "Aktiviti Editor takde apa2" lepas dia terbitkan kandungan sebenar
      // pertama). Entri generik "kemas-kini-konfigurasi-slot" di atas sengaja KEKAL (jejak audit
      // teknikal, "N slot disimpan") tapi tak sebut tajuk & label mentah kod -- tak berguna
      // sebagai bukti "saya baru terbitkan X" utk Ketua Editor semak sendiri. publishOutcomes
      // (dikumpul di atas drpd syncManualObjectsForSlot) cuma kandungan yang BARU
      // diterbitkan/cuba terbit SESI NI (bukan seluruh giliran slot -- lihat nota "objectId
      // SENTIASA baharu" di server.js), jadi selamat log satu baris setiap satu tanpa risiko
      // pendua bila editor sekadar edit kandungan LAMA yang tak berubah status.
      for (const outcome of publishOutcomes) {
        if (!outcome.title) continue;
        await logAudit(dbRun, {
          actorId: req.session?.user?.id,
          actorName: req.session?.user?.penName || req.session?.user?.username,
          action: outcome.status === 'approved' ? 'menerbit-kandungan' : 'kandungan-menunggu-kelulusan',
          targetType: 'kandungan',
          targetId: outcome.objectId,
          detail: outcome.title,
        });
      }

      res.json({ success: true, publishOutcomes });
    } catch (err) {
      console.error('Save slots config error:', err);
      res.status(500).json({ error: 'Gagal menyimpan konfigurasi slot. ' + (err.message || '') });
    }
  }));

  return router;
}
