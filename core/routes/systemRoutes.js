import express from 'express';
import { requireAuth, requirePermission, loadRolePermissions } from '../middleware/auth.js';
import { notifyMany } from '../notifications/Notify.js';
import { logAudit } from '../audit/AuditLog.js';

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
  // requirePermission (2026-08-08, dapatan audit keselamatan ChatGPT) — dahulu tiada gerbang;
  // "Live Health Check & Governance Status" (nota kod sedia ada) memang papan pemuka Editorium,
  // bukan API awam, dan buat panggilan rangkaian sebenar + kemungkinan tulis notifikasi setiap
  // permintaan — sesiapa boleh cetuskan side-effect ni tanpa had. Sifar pengguna awam disahkan.
  router.get('/system/weather-status', requirePermission('manageSettings'), async (req, res) => {
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
  // requirePermission (2026-08-08, dapatan audit keselamatan ChatGPT) — laluan run-now
  // bersebelahan dah dikunci manageSettings, GET terlepas. Dedah URL sumber + ralat dalaman.
  router.get('/system/link-checks', requirePermission('manageSettings'), async (req, res) => {
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

  // Dasar Terbit Sendiri Editor (2026-08-06, permintaan Izzat) — "editor boleh terus publish, tp
  // benda ni boleh diubah oleh ketua editor... guna rbac, benarkan ketua editor sahaja yg boleh
  // tukar polisi ni". Guna kunci RBAC SEDIA ADA (`publish`, peranan `editor`) sebagai sumber
  // kebenaran tunggal (sepadan Kawalan Akses penuh, TIDAK cipta konsep dasar berasingan) — cuma
  // laluan NI dibuka khusus untuk Ketua Editor/Penolong (`manageEditorial`), bukan Pentadbir-sahaja
  // (`manageSettings`) macam borang Kawalan Akses penuh, supaya Ketua Editor boleh tukar SATU
  // togol ni sendiri tanpa perlu akses seluruh matriks RBAC yang sensitif.
  //
  // system_settings.rolePermissions disimpan sebagai ARRAY {roleId, roleName, permissions}[]
  // (format borang TetapanConsole.tsx) — bukan objek map terus.
  const bacaMatriksRolePermissions = async () => {
    const row = await dbGet("SELECT rolePermissions FROM system_settings WHERE id = 'settings-main'");
    const raw = row && row.rolePermissions ? safeJsonParse(row.rolePermissions, []) : [];
    return Array.isArray(raw) ? raw : [];
  };

  // requireAuth (2026-08-08, dapatan audit keselamatan ChatGPT) — keterukan rendah (pulangkan
  // satu boolean sahaja), tapi sifar pengguna awam disahkan (Editorium sahaja), jadi tiada sebab
  // biarkan terbuka. requireAuth sahaja (bukan requirePermission), sebab setiap Editor log masuk
  // memang perlu tahu dasar ni untuk gerbang UI Terbit Sendiri.
  router.get('/system/editor-publish-policy', requireAuth, async (req, res) => {
    try {
      const matriks = await bacaMatriksRolePermissions();
      const barisEditor = matriks.find((r) => r.roleId === 'editor');
      // Tiada baris tersimpan langsung (pemasangan baharu) = lalai DEFAULT_ROLE_PERMISSIONS.editor
      // (publish: true, lihat core/middleware/auth.js) — Editor boleh self-publish.
      const benarkanSelfPublish = barisEditor ? barisEditor.permissions?.publish !== false : true;
      res.json({ benarkanSelfPublish });
    } catch (err) {
      console.error('GET editor-publish-policy error:', err);
      res.status(500).json({ error: 'Gagal membaca dasar terbit sendiri editor.' });
    }
  });

  router.patch('/system/editor-publish-policy', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { benarkanSelfPublish } = req.body || {};
      if (typeof benarkanSelfPublish !== 'boolean') {
        return res.status(400).json({ error: 'benarkanSelfPublish mesti boolean.' });
      }
      const matriks = await bacaMatriksRolePermissions();
      const indeks = matriks.findIndex((r) => r.roleId === 'editor');
      if (indeks === -1) {
        // Baris 'editor' tak wujud langsung dalam matriks tersimpan (pemasangan baharu/matriks
        // lapuk) — cipta baris minimum, kunci lain akan digabung ke lalai DEFAULT_ROLE_PERMISSIONS
        // oleh parseStoredMatrix() (core/middleware/auth.js) semasa dibaca semula.
        matriks.push({ roleId: 'editor', roleName: 'Editor', permissions: { publish: benarkanSelfPublish } });
      } else {
        matriks[indeks] = {
          ...matriks[indeks],
          permissions: { ...(matriks[indeks].permissions || {}), publish: benarkanSelfPublish },
        };
      }
      await dbRun(
        "UPDATE system_settings SET rolePermissions = ? WHERE id = 'settings-main'",
        [JSON.stringify(matriks)]
      );
      await loadRolePermissions(dbGet);

      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-dasar-terbit-sendiri',
        targetType: 'tetapan',
        targetId: 'editor-publish-policy',
        detail: benarkanSelfPublish ? 'Editor dibenarkan terbit sendiri.' : 'Editor kini perlu kelulusan Ketua Editor/Penolong untuk terbit.',
      });

      res.json({ success: true, benarkanSelfPublish });
    } catch (err) {
      console.error('PATCH editor-publish-policy error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini dasar terbit sendiri editor.' });
    }
  });

  // GET /api/pages/:key — static/footer pages
  router.get('/pages/:key', async (req, res) => {
    const { key } = req.params;
    try {
      const page = await dbGet("SELECT * FROM static_pages WHERE key = ?", [key]);
      if (!page) {
        return res.status(404).json({ error: 'Halaman tidak dijumpai.' });
      }
      res.json(page);
    } catch (err) {
      console.error(`Get page ${key} error:`, err);
      res.status(500).json({ error: 'Gagal membaca halaman. ' + err.message });
    }
  });

  // GET /api/pages-status — peta ringkas {key: aktif} untuk SETIAP halaman statik (2026-08-08,
  // permintaan Izzat: suis "Aktif di Footer"). Awam (bukan requireAuth) sebab footer perlu tahu
  // pautan mana nak papar SEBELUM pembaca log masuk — sama taraf keterdedahan macam GET /pages/:key
  // sedia ada (kandungan halaman awam itu sendiri, bukan medan dalaman).
  router.get('/pages-status', async (req, res) => {
    try {
      const rows = await dbAll("SELECT key, aktif FROM static_pages");
      const peta = {};
      for (const r of rows) peta[r.key] = r.aktif !== 0;
      res.json(peta);
    } catch (err) {
      console.error('Get pages-status error:', err);
      res.status(500).json({ error: 'Gagal membaca status halaman. ' + err.message });
    }
  });

  // POST /api/pages/:key
  router.post('/pages/:key', requirePermission('manageSettings'), async (req, res) => {
    const { key } = req.params;
    const { title, content, aktif } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Tajuk atau kandungan tiada.' });
    }
    // aktif (suis footer) — INSERT OR REPLACE tanpa medan ni akan tulis-ganti dengan lalai
    // SQLite (0/NULL) setiap kali disimpan, memadamkan status suis sedia ada secara senyap.
    // Baca nilai semasa dulu kalau klien tak hantar (cth simpan lama sebelum suis wujud).
    let aktifBaharu = typeof aktif === 'boolean' ? (aktif ? 1 : 0) : undefined;
    if (aktifBaharu === undefined) {
      const sedia = await dbGet("SELECT aktif FROM static_pages WHERE key = ?", [key]);
      aktifBaharu = sedia ? sedia.aktif : 1;
    }
    const timestamp = new Date().toISOString();
    try {
      await dbRun(`
        INSERT OR REPLACE INTO static_pages (key, title, content, aktif, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `, [key, title, content, aktifBaharu, timestamp]);

      // Log Audit (2026-08-06, pembetulan audit) — halaman awam (Tentang, Terma Penggunaan, dll)
      // dibaca sesiapa di internet, patut ada jejak siapa ubah kandungannya bila.
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-halaman-awam',
        targetType: 'halaman-awam',
        targetId: key,
        detail: (title || '').slice(0, 100),
      });

      res.json({ success: true });
    } catch (err) {
      console.error(`Save page ${key} error:`, err);
      res.status(500).json({ error: 'Gagal menyimpan halaman. ' + err.message });
    }
  });

  // Peta medan→serializer system_settings (2026-08-08, dapatan audit keselamatan ChatGPT P2-01
  // susulan) — whitelist EKSPLISIT, jangan sekali-kali bina senarai lajur SQL terus drpd
  // Object.keys(req.body). Setiap serializer pulangkan nilai sedia simpan (JSON.stringify utk
  // array/objek, 0/1 utk boolean). Diletak di luar handler (bukan konstruk semula setiap
  // permintaan) — peta statik, tiada sebab jadi baharu setiap panggilan.
  const SETTINGS_SERIALIZER = {
    frontpageTitle: (v) => v,
    frontpageSubtitle: (v) => v,
    rolePermissions: (v) => JSON.stringify(v || {}),
    inTheNewsText: (v) => v,
    inTheNewsGoogleDocUrl: (v) => v,
    featuredScholarId: (v) => v,
    featuredEntryId: (v) => v,
    editorialSelectionIds: (v) => JSON.stringify(v || []),
    announcementBanner: (v) => v,
    enableArabicAccent: (v) => (v ? 1 : 0),
    layoutDensity: (v) => v,
    allowedSignatureFonts: (v) => JSON.stringify(v || []),
    featuredEssayIds: (v) => JSON.stringify(v || []),
    featuredNoteIds: (v) => JSON.stringify(v || []),
    worldClockHolidaysText: (v) => v,
    worldClockHolidaysGoogleDocUrl: (v) => v,
    researchFindingsText: (v) => v,
    researchFindingsGoogleDocUrl: (v) => v,
    masterPrompt: (v) => v,
    worldClockIntervalSec: (v) => Number(v),
    worldClockBgClickEnabled: (v) => (v ? 1 : 0),
    reviewPrompt: (v) => v,
    glosSelariEnabled: (v) => (v ? 1 : 0),
    schoolHolidaysJson: (v) => v,
    focusViewNotaMaxAksara: (v) => Number(v),
    focusViewAutoAdvanceSec: (v) => Number(v),
    tickerOverlayTitleSize: (v) => v,
    tickerOverlayBriefSize: (v) => v,
  };

  // POST /api/system/settings — UPDATE separa berpandukan whitelist (2026-08-08, dapatan audit
  // keselamatan ChatGPT P2-01 susulan), gantikan INSERT OR REPLACE penuh lama. SQLite REPLACE
  // sebenarnya delete+insert di sebalik tabir, bukan "kemas kini beberapa medan" — sebarang medan
  // TAK dihantar client lama tersilap dikodkan keras nilai lalai (worldClockIntervalSec=60 dll.),
  // bukan dikekalkan. Reka bentuk baharu: medan tiada dlm badan permintaan (`undefined`) = KEKAL
  // nilai sedia ada, bukan ditimpa lalai. Serasi belakang OTOMATIK tanpa kod cabang — client lama
  // (TetapanConsole/EditorialConsole) hantar objek GABUNGAN PENUH (semua medan hadir) = semua
  // lajur dikemas kini, kelakuan sama macam dulu; client baharu boleh hantar objek separa (cuma
  // medan berubah) bila-bila nanti tanpa pelayan perlu tahu bezanya.
  router.post('/system/settings', requirePermission('manageSettings'), async (req, res) => {
    try {
      const s = req.body;

      // Julat sah medan berangka (SETTINGS-VALIDATION-001, audit #44.4, 2026-08-13) — sebelum ni
      // medan ni cuma `Number(v)` tanpa sebarang semakan: rentetan sampah jadi NaN dan tersimpan
      // senyap, nilai gila (0 saat, 999999) diterima bulat-bulat. Bukan lubang keselamatan (laluan
      // digerbang manageSettings, aktor dipercayai) tapi satu salah taip boleh merosakkan kelakuan
      // portal awam tanpa amaran. DITOLAK dengan sebab jelas, BUKAN diapit senyap — mengapit
      // menukar niat editor tanpa dia sedar; falsafah sama seperti validateContentBudget.
      const JULAT_NOMBOR = {
        worldClockIntervalSec: { min: 0, max: 3600, nama: 'Selang masa auto-slaid Jam Dunia', unit: 'saat (0 = matikan)' },
        focusViewNotaMaxAksara: { min: 20, max: 2000, nama: 'Had aksara Nota Editor', unit: 'aksara' },
        focusViewAutoAdvanceSec: { min: 3, max: 120, nama: 'Tempoh tatal automatik Focus View', unit: 'saat' },
      };
      for (const [medan, julat] of Object.entries(JULAT_NOMBOR)) {
        if (s[medan] === undefined) continue;
        const n = Number(s[medan]);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < julat.min || n > julat.max) {
          return res.status(400).json({
            error: `${julat.nama} mesti nombor bulat antara ${julat.min} dan ${julat.max} ${julat.unit}. Tetapan tidak disimpan.`,
          });
        }
      }

      const kolum = [];
      const nilai = [];
      for (const [medan, serial] of Object.entries(SETTINGS_SERIALIZER)) {
        if (s[medan] === undefined) continue;
        kolum.push(medan);
        nilai.push(serial(s[medan]));
      }
      // Baris canonical 'settings-main' sepatutnya dah disemai server.js semasa boot — INSERT OR
      // IGNORE di sini jaring kecemasan murah (UPDATE pada baris tak wujud senyap tak buat apa-apa,
      // bukan ralat), bukan gantikan logik semai.
      await dbRun("INSERT OR IGNORE INTO system_settings (id) VALUES ('settings-main')");
      if (kolum.length > 0) {
        await dbRun(
          `UPDATE system_settings SET ${kolum.map((k) => `${k} = ?`).join(', ')} WHERE id = 'settings-main'`,
          nilai
        );
      }
      // Matriks Kawalan Akses mungkin baru diubah — muat semula cache dalam-memori serta-merta
      // supaya perubahan kebenaran berkuat kuasa pada permintaan SETERUSNYA, bukan tunggu server
      // dimulakan semula (sama corak loadAmSettings/loadTierOverrides).
      await loadRolePermissions(dbGet);

      // Log Audit (2026-08-06, pembetulan audit) — laluan ni tulis-ganti SATU baris settings-main
      // sepenuhnya (INSERT OR REPLACE), merangkumi tetapan sistem paling sensitif dalam projek ni
      // (matriks Kawalan Akses RBAC, master prompt AI, dll). Dahulu sifar jejak langsung —
      // sesiapa boleh ubah kebenaran peranan tanpa rekod siapa/bila.
      await logAudit(dbRun, {
        actorId: req.session?.user?.id,
        actorName: req.session?.user?.penName || req.session?.user?.username,
        action: 'kemas-kini-tetapan-sistem',
        targetType: 'tetapan',
        targetId: 'system-settings',
        detail: s.rolePermissions !== undefined ? 'Termasuk kemas kini matriks Kawalan Akses (RBAC).' : undefined,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Save system settings error:', err);
      res.status(500).json({ error: 'Gagal menyimpan tetapan sistem. ' + (err.message || '') });
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
      res.status(500).json({ status: 'ERROR', error: 'Gagal menjalankan semakan kesihatan sistem.' });
    }
  });

  return router;
}
