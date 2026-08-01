import express from 'express';
import { TIER_SLOTS, tierForSlot, TIER_LABELS } from '../editorial/GeometryConfig.js';
import { parseManualSummaryBlocks } from '../editorial/ManualBlockFormat.js';
import { requireAuth } from '../middleware/auth.js';

// "Draf Saya" (2026-08-01, permintaan pemilik projek) — satu tempat untuk seorang editor melihat
// SEMUA draf dia sendiri, tanpa perlu membuka slot satu per satu untuk mencarinya.
//
// Kenapa ia perlu mengimbas teks, bukan sekadar SELECT: draf BUKAN baris pangkalan data. Ia blok
// teks bertanda "Status: draf" yang hidup di dalam slots_config.manualSummary slot masing-masing
// (lihat syncManualObjectsForSlot di server.js — draf sengaja tidak pernah mencipta baris
// editorial_objects). Jadi satu-satunya cara mengumpulnya ialah membaca setiap slot dan menghurai
// bloknya. 38 slot, teks pendek — murah, tiada jadual/indeks baharu diperlukan.
//
// Siapa pemilik satu draf:
//   1. Baris "Penulis:" dalam blok itu — cap nama pena editor yang menciptanya (dicap sejak
//      2026-08-01). Ini sumber utama.
//   2. Blok LAMA tiada baris itu. Ia tidak ditekan kepada sesiapa; ia jatuh balik pada penugasan
//      slot (jadual slot_editors) — draf dalam slot yang ditugaskan kepada editor ini dikira
//      miliknya. Baris begitu ditanda `milik: 'slot'` supaya UI boleh menyatakannya dengan jujur.
const BAR_SLOTS = new Set(TIER_SLOTS.BAR);

const samaNama = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

export const createDraftRoutes = (dbAll) => {
  const router = express.Router();

  // 2026-08-02 (Fasa 1): draf belum terbit ialah dalaman — laluan ni dahulu tanpa auth
  // langsung, sesiapa yang tahu ?penulis=<nama editor lain> boleh baca draf orang lain.
  router.get('/drafts', requireAuth, async (req, res) => {
    try {
      const penulis = (req.query.penulis || '').toString().trim();
      const editorId = (req.query.editorId || '').toString().trim();
      if (!penulis && !editorId) {
        return res.status(400).json({ error: 'Sesi editor diperlukan untuk membaca draf.' });
      }

      // Slot yang ditugaskan kepada editor ni — asas fallback untuk blok lama tanpa nama penulis.
      let slotSaya = new Set();
      if (editorId) {
        const rows = await dbAll('SELECT slotIndex FROM slot_editors WHERE editorId = ?', [editorId]);
        slotSaya = new Set((rows || []).map(r => r.slotIndex));
      }

      const slots = await dbAll(
        "SELECT slotIndex, manualSummary, manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex >= 0 ORDER BY slotIndex"
      );

      const draf = [];
      for (const slot of slots || []) {
        // Ticker (-1) sudah ditapis oleh SQL di atas; tier Bar pula belum menyokong alur kerja
        // Draf/Terbit langsung (lihat contentRoutes.js reject-to-draft), jadi ia tiada draf.
        if (BAR_SLOTS.has(slot.slotIndex)) continue;
        const blok = parseManualSummaryBlocks(slot.manualSummary || '');
        blok.forEach((b, urutan) => {
          if (b.status !== 'draft') return;
          const adaNama = !!(b.penulis || '').trim();
          const milik = adaNama
            ? (samaNama(b.penulis, penulis) ? 'nama' : null)
            : (slotSaya.has(slot.slotIndex) ? 'slot' : null);
          if (!milik) return;
          const tier = tierForSlot(slot.slotIndex);
          draf.push({
            slotIndex: slot.slotIndex,
            urutan,
            tier,
            tierLabel: TIER_LABELS[tier] || tier || '',
            bidang: slot.manualDesk || '',
            uuid: b.uuid || '',
            tajuk: b.title || '',
            topik: b.topik || '',
            huraian: b.brief || '',
            // huraianPanjang (2026-08-01) — semata-mata untuk penunjuk "kelengkapan" di UI (ada/
            // tiada Huraian Panjang). Isi penuh tak dihantar dalam senarai ringkas mana-mana medan
            // lain sebab tu; ni satu-satunya pengecualian, dan cuma dibaca untuk semak !!string.
            huraianPanjang: b.briefLong || '',
            penulis: b.penulis || '',
            milik,
          });
        });
      }

      res.json(draf);
    } catch (err) {
      console.error('GET drafts error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai draf. ' + (err.message || '') });
    }
  });

  return router;
};

export default createDraftRoutes;
