import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  GEOMETRY_RATIOS, TIER_SLOTS, TIER_LABELS, setTierOverrides, ratiosForTier,
} from '../editorial/GeometryConfig.js';

// Tetapan Tier Kad (2026-07-30, permintaan pemilik projek) — had aksara tajuk/huraian bagi setiap
// tier bentuk kad, boleh dipinda Ketua Editor melalui Editorium → Slot → Tier Kad.
//
// Nilai LALAI kekal di GeometryConfig.js (diukur daripada saiz fizikal kad). Jadual `tier_settings`
// menyimpan pindaan SAHAJA — tier yang tak pernah dipinda tiada baris langsung, jadi lalai
// sentiasa boleh dikembalikan tanpa meneka nombor asal.
//
// Peraturan teras tak berubah: pindaan pada peringkat TIER, tidak pernah per-slot.
const TIER_KEYS = Object.keys(GEOMETRY_RATIOS);

export const loadTierOverrides = async (dbAll) => {
  try {
    const rows = await dbAll('SELECT tierKey, maxTitleAlone, maxBriefAlone FROM tier_settings');
    const map = {};
    for (const r of rows || []) {
      map[r.tierKey] = {
        maxTitleAlone: r.maxTitleAlone === null ? undefined : Number(r.maxTitleAlone),
        maxBriefAlone: r.maxBriefAlone === null ? undefined : Number(r.maxBriefAlone),
      };
    }
    setTierOverrides(map);
    return map;
  } catch (err) {
    console.warn('Gagal memuatkan pindaan tier (tier_settings):', err.message);
    return {};
  }
};

export const createTierSettingsRoutes = (dbAll, dbRun) => {
  const router = express.Router();

  // Senarai penuh: nilai berkuat kuasa + nilai lalai + bilangan slot bagi setiap tier.
  router.get('/tier-settings', async (req, res) => {
    try {
      const rows = await dbAll('SELECT tierKey, maxTitleAlone, maxBriefAlone, updatedAt FROM tier_settings');
      const pindaanRow = Object.fromEntries((rows || []).map(r => [r.tierKey, r]));
      res.json(TIER_KEYS.map(tier => {
        const lalai = GEOMETRY_RATIOS[tier];
        const berkuatKuasa = ratiosForTier(tier);
        const row = pindaanRow[tier];
        return {
          tierKey: tier,
          label: TIER_LABELS[tier] || tier,
          slots: tier === 'TICKER' ? [-1] : (TIER_SLOTS[tier] || []),
          maxTitleAlone: berkuatKuasa.maxTitleAlone,
          maxBriefAlone: berkuatKuasa.maxBriefAlone,
          lalaiMaxTitleAlone: lalai.maxTitleAlone,
          lalaiMaxBriefAlone: lalai.maxBriefAlone,
          dipinda: !!row,
          updatedAt: row?.updatedAt || null,
        };
      }));
    } catch (err) {
      console.error('GET tier-settings error:', err);
      res.status(500).json({ error: 'Gagal membaca tetapan tier. ' + (err.message || '') });
    }
  });

  router.post('/tier-settings', requireAuth, async (req, res) => {
    try {
      const { tierKey, maxTitleAlone, maxBriefAlone } = req.body || {};
      if (!TIER_KEYS.includes(tierKey)) {
        return res.status(400).json({ error: `Tier tidak dikenali: ${tierKey}` });
      }
      const tajuk = Number(maxTitleAlone);
      const huraian = Number(maxBriefAlone);
      if (!Number.isInteger(tajuk) || tajuk < 1) {
        return res.status(400).json({ error: 'Had tajuk mesti nombor bulat sekurang-kurangnya 1.' });
      }
      if (!Number.isInteger(huraian) || huraian < 0) {
        return res.status(400).json({ error: 'Had huraian mesti nombor bulat 0 atau lebih.' });
      }
      // Tier BAR memang tiada medan huraian pada kadnya — membenarkan had bukan sifar di sini
      // bermakna pengesahan simpan akan menerima huraian yang tiada tempat untuk dipaparkan.
      if (tierKey === 'BAR' && huraian !== 0) {
        return res.status(400).json({ error: 'Kad Bar tiada medan huraian — had huraian mesti kekal 0.' });
      }

      await dbRun(`
        INSERT INTO tier_settings (tierKey, maxTitleAlone, maxBriefAlone, updatedAt)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(tierKey) DO UPDATE SET
          maxTitleAlone = excluded.maxTitleAlone,
          maxBriefAlone = excluded.maxBriefAlone,
          updatedAt = excluded.updatedAt
      `, [tierKey, tajuk, huraian, new Date().toISOString()]);

      await loadTierOverrides(dbAll);
      res.json({ success: true, tierKey, maxTitleAlone: tajuk, maxBriefAlone: huraian });
    } catch (err) {
      console.error('POST tier-settings error:', err);
      res.status(500).json({ error: 'Gagal menyimpan tetapan tier. ' + (err.message || '') });
    }
  });

  // Kembalikan satu tier kepada nilai lalai (buang barisnya, bukan tulis nombor lalai —
  // supaya lalai kekal satu sumber sahaja: GeometryConfig.js).
  router.post('/tier-settings/reset', requireAuth, async (req, res) => {
    try {
      const { tierKey } = req.body || {};
      if (!TIER_KEYS.includes(tierKey)) {
        return res.status(400).json({ error: `Tier tidak dikenali: ${tierKey}` });
      }
      await dbRun('DELETE FROM tier_settings WHERE tierKey = ?', [tierKey]);
      await loadTierOverrides(dbAll);
      res.json({ success: true, tierKey });
    } catch (err) {
      console.error('POST tier-settings/reset error:', err);
      res.status(500).json({ error: 'Gagal mengembalikan nilai lalai. ' + (err.message || '') });
    }
  });

  return router;
};

export default createTierSettingsRoutes;
