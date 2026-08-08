import express from 'express';
import { safeJsonParse } from '../utils/jsonUtils.js';

// Helper to extract plain text from published Google Doc HTML
function extractTextFromHtml(html) {
  if (!html) return '';
  // Remove scripts and styles first (both inside head and body)
  let cleanedHtml = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Extract everything inside <body ...> ... </body>
  const bodyMatch = cleanedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyHtml = bodyMatch ? bodyMatch[1] : cleanedHtml;

  // Replace <p> tags, </div>, and <br> with newlines
  let text = bodyHtml
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "") // strip all HTML tags
    // Decode common HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up multi-newlines
    .replace(/\n\s*\n\s*\n/g, "\n\n");

  return text.trim();
}

// Cache dalam-memori untuk ambilan Google Doc luaran (2026-08-02, Fasa 15 — "prestasi &
// kesediaan produksi"). `GET /api/db-state` dahulu buat 3 ambilan Google Doc (In The News,
// Cuti Jam Dunia, Dapatan Penyelidikan) SETIAP panggilan, masing-masing sehingga 5s timeout —
// sampai 15s tersekat pada kes terburuk, walhal SELEBIHNYA endpoint ni cuma baca SQLite tempatan
// (pantas). Corak sama seperti cache XML di sitemapRoutes.js / rssFeedRoutes.js: satu kunci
// per URL supaya pertukaran URL di Tetapan tak terjebak cache lapuk URL lama.
const GOOGLE_DOC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minit
const googleDocCache = new Map(); // docUrl -> { text, expiresAt }

async function fetchGoogleDocTextCached(docUrl) {
  if (!docUrl) return '';
  const now = Date.now();
  const hit = googleDocCache.get(docUrl);
  if (hit && hit.expiresAt > now) {
    return hit.text;
  }
  const text = await fetchGoogleDocText(docUrl);
  googleDocCache.set(docUrl, { text, expiresAt: now + GOOGLE_DOC_CACHE_TTL_MS });
  return text;
}

// Helper to fetch Google Doc text export in the background (supports standard and published URLs)
async function fetchGoogleDocText(docUrl) {
  if (!docUrl) return '';
  try {
    const isPublishedUrl = docUrl.includes('/d/e/') || docUrl.includes('/pub');
    let fetchUrl = '';

    if (isPublishedUrl) {
      fetchUrl = docUrl;
    } else {
      const match = docUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) return '';
      const docId = match[1];
      fetchUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(id);

    if (!response.ok) {
      console.error('Failed to fetch Google Doc:', response.statusText);
      return '';
    }
    const content = await response.text();

    if (isPublishedUrl) {
      return extractTextFromHtml(content);
    } else {
      return content;
    }
  } catch (err) {
    console.error('Error fetching Google Doc:', err);
    return '';
  }
}

export function createDbStateRoutes(dbAll, dbGet) {
  const router = express.Router();

  // GET /api/db-state (2026-08-08, audit keselamatan — laporan luaran)
  //
  // Laluan ni TERBUKA tanpa sesi (portal awam sendiri membacanya semasa muat), jadi apa-apa yang
  // dipulangkan di sini terdedah kepada SESIAPA di internet, bukan sahaja kakitangan log masuk.
  // Dua pepijat kritikal ditemui dan dibetulkan hari ni:
  //
  //   1. Header `x-session-id` DIANGGAP sebagai identiti pengguna tanpa sebarang pengesahan kuki
  //      sesi sebenar — sesiapa boleh hantar ID pengguna sendiri terka/curi dan terima balik
  //      objek `currentUser` orang itu. Disahkan medan `currentUser`/`isSuspended` yang terhasil
  //      TAK PERNAH dibaca mana-mana kod klien (grep kosong) — dibuang terus, bukan "dibetulkan"
  //      guna sesi sebenar, sebab tiada apa yang perlukannya.
  //
  //   2. Jadual `users` PENUH (nama sebenar, nombor telefon, peranan, status gantung) dan medan
  //      dalaman `system_settings` (masterPrompt/reviewPrompt AI, URL Google Doc dalaman, matriks
  //      rolePermissions) dihantar kepada SEMUA pelawat tanpa mengira sesi. Disahkan dengan jejak
  //      setiap medan sampai ke kod klien (FrontpageView.tsx dan App.tsx, laluan portal awam):
  //      cuma teks Google Doc yang SUDAH DISELESAIKAN (inTheNewsGoogleDocText dll.) dan segelintir
  //      tetapan kosmetik (glosSelariEnabled, tickerOverlay*, worldClock*, focusViewNotaMaxAksara,
  //      dsb.) yang benar-benar dipaparkan; `users`, `masterPrompt`/`reviewPrompt`,
  //      `rolePermissions`, dan URL Google Doc mentah TIDAK pernah dirujuk portal awam — ia cuma
  //      dibawa sekali oleh `...u`/pemetaan lapuk drpd rangka kerja lama. Sekarang: subset selamat
  //      (SELAMAT_AWAM di bawah) sentiasa dipulangkan; `users` penuh dan medan dalaman HANYA
  //      dipulangkan bila `req.session.user` (kuki sesi SEBENAR, bukan header) wujud.
  router.get('/db-state', async (req, res) => {
    try {
      const disahkan = !!(req.session && req.session.user);

      const usersRows = await dbAll("SELECT * FROM users");
      const settingsRow = await dbGet("SELECT * FROM system_settings WHERE id = 'settings-main'");

      // Subset PEMILIH SAHAJA (2026-08-08, dapatan audit keselamatan ChatGPT P2-01) — dahulu
      // `usersPenuh` bawa SEMUA lajur users (nama penuh, nombor telefon, kelulusan universiti,
      // negeri menetap, dsb.) kepada MANA-MANA pengguna log masuk, walau cuma satu-satunya
      // pemanggil sebenar (EditoriumView.tsx/SenaraiSlotConsole.tsx, pemilih editor penugasan
      // slot) cuma perlukan id/penName/username/status. Direktori/Profil penuh sudah ada laluan
      // sendiri terkunci betul (GET /api/system/users manageAccounts, GET /api/system/profile/:id
      // diri sendiri/manageAccounts) — db-state tak perlu bawa data PII penuh langsung.
      const usersPenuh = usersRows.map((u) => ({
        id: u.id,
        penName: u.penName,
        username: u.username,
        status: u.status,
        suspended: u.isSuspended === 1,
      }));

      const profiles = [];
      const entries = [];
      const identities = [];
      const logs = [];
      const releaseLogs = [];
      const policies = [];

      // Subset SELAMAT UNTUK AWAM — hanya medan yang disahkan benar-benar dipaparkan/dipakai oleh
      // portal awam tanpa sesi (lihat nota audit di atas). Jangan tambah medan baharu di sini
      // tanpa jejak dahulu sama ada ia benar-benar sampai ke kod portal awam.
      const settingsAwam = settingsRow ? {
        id: settingsRow.id,
        frontpageTitle: settingsRow.frontpageTitle,
        frontpageSubtitle: settingsRow.frontpageSubtitle,
        inTheNewsText: settingsRow.inTheNewsText || '',
        announcementBanner: settingsRow.announcementBanner || '',
        enableArabicAccent: settingsRow.enableArabicAccent === 1,
        layoutDensity: settingsRow.layoutDensity || 'Standard',
        allowedSignatureFonts: safeJsonParse(settingsRow.allowedSignatureFonts, []),
        featuredEssayIds: safeJsonParse(settingsRow.featuredEssayIds, []),
        featuredNoteIds: safeJsonParse(settingsRow.featuredNoteIds, []),
        worldClockHolidaysText: settingsRow.worldClockHolidaysText || '',
        worldClockIntervalSec: settingsRow.worldClockIntervalSec !== undefined && settingsRow.worldClockIntervalSec !== null ? settingsRow.worldClockIntervalSec : 60,
        worldClockBgClickEnabled: settingsRow.worldClockBgClickEnabled !== undefined && settingsRow.worldClockBgClickEnabled !== null ? settingsRow.worldClockBgClickEnabled === 1 : true,
        glosSelariEnabled: settingsRow.glosSelariEnabled === 1,
        focusViewNotaMaxAksara: settingsRow.focusViewNotaMaxAksara !== undefined && settingsRow.focusViewNotaMaxAksara !== null ? settingsRow.focusViewNotaMaxAksara : 180,
        tickerOverlayTitleSize: settingsRow.tickerOverlayTitleSize || 'L',
        tickerOverlayBriefSize: settingsRow.tickerOverlayBriefSize || 'M'
      } : {};

      // Medan DALAMAN — URL Google Doc mentah, prompt AI, matriks kebenaran — hanya untuk kakitangan
      // log masuk (Editorium). Portal awam terima teks Google Doc yang SUDAH diselesaikan sahaja
      // (inTheNewsGoogleDocText dll. di bawah), tak pernah URL sumbernya.
      const settingsDalaman = settingsRow ? {
        rolePermissions: safeJsonParse(settingsRow.rolePermissions, {}),
        inTheNewsGoogleDocUrl: settingsRow.inTheNewsGoogleDocUrl || '',
        featuredScholarId: settingsRow.featuredScholarId || '',
        featuredEntryId: settingsRow.featuredEntryId || '',
        editorialSelectionIds: safeJsonParse(settingsRow.editorialSelectionIds, []),
        worldClockHolidaysGoogleDocUrl: settingsRow.worldClockHolidaysGoogleDocUrl || '',
        researchFindingsText: settingsRow.researchFindingsText || '',
        researchFindingsGoogleDocUrl: settingsRow.researchFindingsGoogleDocUrl || '',
        masterPrompt: settingsRow.masterPrompt || '',
        reviewPrompt: settingsRow.reviewPrompt || '',
        schoolHolidaysJson: settingsRow.schoolHolidaysJson || ''
      } : {};

      const users = disahkan ? usersPenuh : [];
      const systemSettings = disahkan ? { ...settingsAwam, ...settingsDalaman } : settingsAwam;

      const rawNewsText = await fetchGoogleDocTextCached(settingsDalaman.inTheNewsGoogleDocUrl);
      const rawHolidaysText = await fetchGoogleDocTextCached(settingsDalaman.worldClockHolidaysGoogleDocUrl);
      const rawFindingsText = await fetchGoogleDocTextCached(settingsDalaman.researchFindingsGoogleDocUrl);

      const checkStatus = (text, url) => {
        if (!url) return 'empty';
        if (!text) return 'failed';
        if (text.includes('<!DOCTYPE html>') || text.includes('errorMessage') || text.includes('Sorry, the file you have requested does not exist.')) {
          return 'failed';
        }
        return 'success';
      };

      const inTheNewsGoogleDocStatus = checkStatus(rawNewsText, settingsDalaman.inTheNewsGoogleDocUrl);
      const worldClockHolidaysGoogleDocStatus = checkStatus(rawHolidaysText, settingsDalaman.worldClockHolidaysGoogleDocUrl);
      const researchFindingsGoogleDocStatus = checkStatus(rawFindingsText, settingsDalaman.researchFindingsGoogleDocUrl);

      const inTheNewsGoogleDocText = inTheNewsGoogleDocStatus === 'success' ? rawNewsText : '';
      const worldClockHolidaysGoogleDocText = worldClockHolidaysGoogleDocStatus === 'success' ? rawHolidaysText : '';
      const researchFindingsGoogleDocText = researchFindingsGoogleDocStatus === 'success' ? rawFindingsText : '';

      res.json({
        users,
        profiles,
        entries,
        identities,
        systemSettings,
        logs,
        releaseLogs,
        policies,
        inTheNewsGoogleDocText,
        worldClockHolidaysGoogleDocText,
        researchFindingsGoogleDocText,
        inTheNewsGoogleDocStatus,
        worldClockHolidaysGoogleDocStatus,
        researchFindingsGoogleDocStatus
      });
    } catch (err) {
      console.error('Error fetching database state:', err);
      res.status(500).json({ error: 'Pertanyaan pangkalan data gagal.' });
    }
  });

  return router;
}
