import express from 'express';
import { requirePermission, loadRolePermissions } from '../middleware/auth.js';

export function createSystemRoutes(dbAll, dbRun, dbGet, safeJsonParse, mockDb) {
  const router = express.Router();

  // GET /api/system/weather-status (Live Health Check & Governance Status for Open-Meteo & Holiday APIs)
  router.get('/system/weather-status', async (req, res) => {
    const currentYear = new Date().getFullYear();

    const meteoStart = Date.now();
    let openMeteo;
    try {
      const openMeteoRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=3.1390&longitude=101.6869&current=temperature_2m,weather_code');
      openMeteo = {
        status: openMeteoRes.ok ? 'ONLINE (200 OK)' : 'DEGRADED',
        latencyMs: Date.now() - meteoStart,
        endpoint: 'api.open-meteo.com/v1/forecast',
        coveredCitiesCount: 15,
        rateLimit: 'Uncapped Free Tier',
        lastCheckedAt: new Date().toISOString()
      };
    } catch (err) {
      openMeteo = { status: 'OFFLINE', latencyMs: Date.now() - meteoStart, endpoint: 'api.open-meteo.com/v1/forecast', error: err.message };
    }

    // Same DyDxSoft public-holiday API core/routes/worldClockRoutes.js's /clock-holidays actually
    // reads from -- this used to hardcode 'ONLINE (200 OK)' in every branch (even the catch block)
    // without ever pinging anything, which is exactly the kind of fabricated status this "Live
    // Health Check" panel exists to catch. Real fetch + real latency now, same pattern as Open-Meteo.
    const holidayStart = Date.now();
    let holidayApi;
    try {
      const holidayRes = await fetch(`https://malaysia-holiday.dydxsoft.my/api/v1/holidays?year=${currentYear}`);
      holidayApi = {
        status: holidayRes.ok ? 'ONLINE (200 OK)' : 'DEGRADED',
        latencyMs: Date.now() - holidayStart,
        endpoint: 'malaysia-holiday.dydxsoft.my/api/v1/holidays',
        integratedStatesCount: 15,
        calendarYear: currentYear,
        lastCheckedAt: new Date().toISOString()
      };
    } catch (err) {
      holidayApi = { status: 'OFFLINE', latencyMs: Date.now() - holidayStart, endpoint: 'malaysia-holiday.dydxsoft.my/api/v1/holidays', calendarYear: currentYear, error: err.message };
    }

    res.json({ success: true, openMeteo, holidayApi });
  });

  // GET /api/pages/:key — static/footer pages
  router.get('/pages/:key', async (req, res) => {
    const { key } = req.params;
    try {
      const page = await dbGet("SELECT * FROM static_pages WHERE key = ?", [key]);
      if (!page) {
        return res.status(404).json({ error: 'Page not found.' });
      }
      res.json(page);
    } catch (err) {
      console.error(`Get page ${key} error:`, err);
      res.status(500).json({ error: 'Failed to fetch page. ' + err.message });
    }
  });

  // POST /api/pages/:key
  router.post('/pages/:key', requirePermission('manageSettings'), async (req, res) => {
    const { key } = req.params;
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Missing title or content.' });
    }
    const timestamp = new Date().toISOString();
    try {
      await dbRun(`
        INSERT OR REPLACE INTO static_pages (key, title, content, updatedAt)
        VALUES (?, ?, ?, ?)
      `, [key, title, content, timestamp]);
      res.json({ success: true });
    } catch (err) {
      console.error(`Save page ${key} error:`, err);
      res.status(500).json({ error: 'Failed to save page. ' + err.message });
    }
  });

  // POST /api/system/settings
  router.post('/system/settings', requirePermission('manageSettings'), async (req, res) => {
    try {
      const s = req.body;
      await dbRun(`
        INSERT OR REPLACE INTO system_settings (
          id, frontpageTitle, frontpageSubtitle, rolePermissions,
          inTheNewsText, inTheNewsGoogleDocUrl, featuredScholarId, featuredEntryId,
          editorialSelectionIds, announcementBanner, enableArabicAccent, layoutDensity,
          allowedSignatureFonts, featuredEssayIds, featuredNoteIds, worldClockHolidaysText,
          worldClockHolidaysGoogleDocUrl, researchFindingsText, researchFindingsGoogleDocUrl,
          masterPrompt, worldClockIntervalSec, worldClockBgClickEnabled, reviewPrompt,
          glosSelariEnabled, schoolHolidaysJson
        ) VALUES (
          'settings-main', ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?
        )
      `, [
        s.frontpageTitle, s.frontpageSubtitle, JSON.stringify(s.rolePermissions || {}),
        s.inTheNewsText, s.inTheNewsGoogleDocUrl, s.featuredScholarId, s.featuredEntryId,
        JSON.stringify(s.editorialSelectionIds || []), s.announcementBanner, s.enableArabicAccent ? 1 : 0, s.layoutDensity,
        JSON.stringify(s.allowedSignatureFonts || []), JSON.stringify(s.featuredEssayIds || []), JSON.stringify(s.featuredNoteIds || []), s.worldClockHolidaysText,
        s.worldClockHolidaysGoogleDocUrl, s.researchFindingsText, s.researchFindingsGoogleDocUrl, s.masterPrompt,
        s.worldClockIntervalSec !== undefined ? Number(s.worldClockIntervalSec) : 60,
        s.worldClockBgClickEnabled !== undefined ? (s.worldClockBgClickEnabled ? 1 : 0) : 1,
        s.reviewPrompt,
        s.glosSelariEnabled ? 1 : 0,
        s.schoolHolidaysJson !== undefined ? s.schoolHolidaysJson : null
      ]);
      // Matriks Kawalan Akses mungkin baru diubah — muat semula cache dalam-memori serta-merta
      // supaya perubahan kebenaran berkuat kuasa pada permintaan SETERUSNYA, bukan tunggu server
      // dimulakan semula (sama corak loadAmSettings/loadTierOverrides).
      await loadRolePermissions(dbGet);
      res.json({ success: true });
    } catch (err) {
      console.error('Save system settings error:', err);
      res.status(500).json({ error: 'Failed to save system settings. ' + (err.message || '') });
    }
  });

  // GET /api/system/health
  router.get('/system/health', async (req, res) => {
    try {
      const objCount = await dbGet("SELECT COUNT(*) as count FROM editorial_objects");
      const providerCount = await dbGet("SELECT COUNT(*) as count FROM ai_providers");
      const slotCount = await dbGet("SELECT COUNT(*) as count FROM slots_config");
      res.json({
        status: 'OK',
        uptime: process.uptime(),
        database: 'Connected',
        editorialObjects: objCount ? objCount.count : 0,
        aiProviders: providerCount ? providerCount.count : 0,
        slotsConfigured: slotCount ? slotCount.count : 0,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('System health check error:', err);
      res.status(500).json({ status: 'ERROR', error: 'Failed to perform health check.' });
    }
  });

  return router;
}
