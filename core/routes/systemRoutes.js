import express from 'express';
import { requirePermission, loadRolePermissions } from '../middleware/auth.js';
import { notifyMany } from '../notifications/Notify.js';

// Notifikasi Sistem (Fasa 6b) — dedail sama seperti slotRoutes.js's beritahuPentadbirDanKetuaEditor,
// disalin di sini (bukan diimport) sebab modul ni tak lain kongsi apa-apa dengan slotRoutes.js;
// dua fungsi kecil identik lebih murah daripada satu import silang-domain untuk 6 baris.
async function beritahuPentadbirDanKetuaEditor(dbAll, dbRun, payload) {
  const rows = await dbAll("SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')");
  await notifyMany(dbRun, (rows || []).map((r) => r.userId), payload);
}

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
      // Elak banjir notis — panel ni dipol berkala oleh klien, jadi hanya hantar notis kalau
      // TIADA notis 'sistem_cuaca_gagal' belum-dibaca dalam sejam lepas (satu kegagalan
      // berterusan = SATU notis, bukan satu setiap poll).
      const baruBaru = await dbGet(
        "SELECT id FROM notifications WHERE type = 'sistem_cuaca_gagal' AND isRead = 0 AND createdAt > ? LIMIT 1",
        [new Date(Date.now() - 60 * 60 * 1000).toISOString()]
      );
      if (!baruBaru) {
        await beritahuPentadbirDanKetuaEditor(dbAll, dbRun, {
          type: 'sistem_cuaca_gagal',
          title: 'API cuaca (Open-Meteo) gagal dihubungi',
          detail: err.message || 'Ralat tidak diketahui',
          targetType: 'sistem',
          targetId: 'weather-status',
        });
      }
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

  // GET /api/system/link-checks (Fasa 8b, 2026-08-05) — status semakan pautan mati (sumber
  // kandungan). Dibaca oleh DashboardConsole.tsx, jalur "Status sistem", sama corak macam
  // weather-status di atas. Semakan sebenar berjalan latar (server.js setInterval, 12 jam) —
  // laluan ni cuma BACA keputusan tersimpan, tak sekali-kali semak URL secara langsung dalam
  // permintaan (elak permintaan pengguna tersekat menunggu pelayan luar yang perlahan/mati).
  router.get('/system/link-checks', async (req, res) => {
    try {
      const rows = await dbAll(
        "SELECT url, ok, httpStatus, errorMessage, checkedAt FROM source_link_checks ORDER BY checkedAt DESC"
      );
      const mati = rows.filter((r) => !r.ok);
      const terakhirSemak = rows.length
        ? rows.reduce((max, r) => (r.checkedAt > max ? r.checkedAt : max), rows[0].checkedAt)
        : null;
      res.json({ jumlahDiperiksa: rows.length, jumlahMati: mati.length, terakhirSemak, mati });
    } catch (err) {
      console.error('GET link-checks error:', err);
      res.status(500).json({ error: 'Gagal membaca status semakan pautan. ' + err.message });
    }
  });

  // POST /api/system/link-checks/run-now — cetus semakan pautan serta-merta (Ketua Editor/
  // Pentadbir), tanpa tunggu giliran 12 jam. Sama corak "run-now" manual sedia ada untuk laluan
  // lain (cth pipeline AI, walaupun kini dimatikan). Import lazy (bukan atas fail) elak kitaran
  // import — systemRoutes.js tak lain bergantung pada modul editorial.
  router.post('/system/link-checks/run-now', requirePermission('manageSettings'), async (req, res) => {
    try {
      const { checkAllSourceLinks } = await import('../editorial/LinkChecker.js');
      const hasil = await checkAllSourceLinks(dbAll, dbRun);
      res.json({ success: true, ...hasil });
    } catch (err) {
      console.error('POST link-checks/run-now error:', err);
      res.status(500).json({ error: 'Gagal jalankan semakan pautan. ' + err.message });
    }
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
          glosSelariEnabled, schoolHolidaysJson, focusViewNotaMaxAksara,
          tickerOverlayTitleSize, tickerOverlayBriefSize
        ) VALUES (
          'settings-main', ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
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
        s.schoolHolidaysJson !== undefined ? s.schoolHolidaysJson : null,
        s.focusViewNotaMaxAksara !== undefined ? Number(s.focusViewNotaMaxAksara) : 180,
        s.tickerOverlayTitleSize || 'L',
        s.tickerOverlayBriefSize || 'M'
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
