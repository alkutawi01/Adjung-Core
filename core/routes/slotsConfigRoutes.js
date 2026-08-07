import express from 'express';
import { ceilingForSlot as getGeometryCeilingForSlot } from '../editorial/GeometryConfig.js';
import { detectSourceType } from '../editorial/SourceDetector.js';
import CategoryRegistry from '../category/CategoryRegistry.js';
import { requireAuth, hasPermission } from '../middleware/auth.js';
import { logAudit } from '../audit/AuditLog.js';

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

// Ticker Manual mode is genuinely freeform text (the Chief Editor types the whole
// desk:/title:/brief:/source:/url: block directly into a plain textarea — no client-side template
// assembly to hook into, see TickerManagementModal.tsx). Stamping "Mode: Manual" per block here,
// server-side, is the only reliable place: every block saved through THIS handler (contentMode ===
// 'Manual') was, by construction, entered manually, so this is safe to add unconditionally rather
// than needing to parse per-block intent. Mirrors parseTickerText's tolerant block-separator regex
// (core/routes/contentRoutes.js) so re-serializing here can't desync from how it'll be re-parsed.
const stampManualModeOnTickerBlocks = (rawText) => {
  if (!rawText || !rawText.trim()) return rawText;
  const blocks = rawText.split(/\n?[-_—–―]{3,}\n?/).map(b => b.trim()).filter(Boolean);
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

  // GET /api/system/slots
  router.get('/slots', async (req, res) => {
    try {
      const slots = await dbAll("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' ORDER BY slotIndex ASC");
      res.json(slots);
    } catch (err) {
      console.error('Fetch slots config error:', err);
      res.status(500).json({ error: 'Gagal membaca konfigurasi slot.' });
    }
  });

  // POST /api/system/slots
  router.post('/slots', requireAuth, async (req, res) => {
    try {
      const slots = Array.isArray(req.body) ? req.body : [req.body];

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
            // Format ralat sepadan konvensyen sedia ada di seluruh laluan ni (`error` ialah
            // mesej terus dipapar, bukan kod) — client (useSlotEditor.ts) cuma baca `data.error`.
            return res.status(409).json({
              error: `Slot ${slot.slotIndex + 1} telah disimpan oleh orang lain sejak anda membukanya. Muat semula slot ini dahulu supaya perubahan anda tidak menimpa kerja orang lain.`,
            });
          }
        }
      }

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

        let persistedManualSummary = slot.manualSummary;
        if (slot.contentMode === 'Manual' && slot.slotIndex >= 0) {
          try {
            persistedManualSummary = await syncManualObjectsForSlot(slot.slotIndex, slot.manualSummary, slot, req.session?.user?.roles);
          } catch (e) {
            if (e.isValidationError) {
              // Hard-block: abort the whole save (not just this slot) so the admin sees exactly
              // why nothing was published, instead of a silent partial save.
              return res.status(400).json({ error: e.message });
            }
            console.warn(`Failed to sync editorial_objects for slot ${slot.slotIndex}:`, e.message);
          }
        }

        const arahOverrideSah = ['', 'kanan', 'kiri', 'atas', 'bawah'].includes(slot.arahOverride) ? slot.arahOverride : '';
        // Jenis animasi PER-SLOT (2026-08-07) — sanitasi sama corak macam arahOverrideSah di atas.
        const jenisAnimasiOverrideSah = ['', 'pudar', 'colophon', 'sapuan_lajur', 'gerak_susun'].includes(slot.jenisAnimasiOverride) ? slot.jenisAnimasiOverride : '';
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
          `SELECT warnaPanelOverride, kelajuanOverride, logoTransisiMode
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

        await dbRun(`
          INSERT OR REPLACE INTO slots_config (
            layoutTemplateId, slotIndex, contentMode, providerId, model, promptText, sourcesList, refreshRate, allowedContentTypes, priority, expiresAt, bgColor, borderColor, textColor,
            manualTitle, manualSummary, manualSource, manualUrl, manualImageUrl, manualDesk, activeObjectId, searchStrategy, carouselInterval, carouselDelay, generationLimit, maxTitle, maxBrief, maxBriefLong, refreshHour, refreshDay, eventExpiryFilter,
            aiPromptTopic, aiPromptRecency, aiPromptLanguage, aiPromptRegion, aiPromptSource, sourceType, genMode, arahOverride, jenisAnimasiOverride, warnaPanelOverride, kelajuanOverride, logoTransisiMode, updatedAt
          ) VALUES ('frontpage', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          slot.slotIndex, slot.contentMode, providerId, slot.model, slot.promptText, slot.sourcesList, slot.refreshRate, slot.allowedContentTypes, slot.priority, slot.expiresAt, slot.bgColor, slot.borderColor, slot.textColor,
          slot.manualTitle, persistedManualSummary, slot.manualSource, slot.manualUrl, slot.manualImageUrl, slot.manualDesk, slot.activeObjectId, slot.searchStrategy || 'Structured Sources Only', slot.carouselInterval || 10, slot.carouselDelay || 0, slot.generationLimit || 1, slot.maxTitle !== undefined ? slot.maxTitle : null, slot.maxBrief !== undefined ? slot.maxBrief : null, slot.maxBriefLong !== undefined ? slot.maxBriefLong : null, slot.refreshHour || '00:00', slot.refreshDay || 'Isnin', slot.eventExpiryFilter || '',
          slot.aiPromptTopic || '', slot.aiPromptRecency || '', slot.aiPromptLanguage || '', slot.aiPromptRegion || '', slot.aiPromptSource || '', resolvedSourceType, slot.genMode || 'bebas', arahOverrideSah, jenisAnimasiOverrideSah, warnaPanelOverrideSah, kelajuanOverrideSah, logoTransisiModeSah, new Date().toISOString()
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
          await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [stampManualModeOnTickerBlocks(slot.manualSummary)]);
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

      res.json({ success: true });
    } catch (err) {
      console.error('Save slots config error:', err);
      res.status(500).json({ error: 'Gagal menyimpan konfigurasi slot. ' + (err.message || '') });
    }
  });

  return router;
}
