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

  // GET /api/db-state
  router.get('/db-state', async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'];

      const usersRows = await dbAll("SELECT * FROM users");
      const settingsRow = await dbGet("SELECT * FROM system_settings WHERE id = 'settings-main'");

      const users = usersRows.map((u) => ({
        ...u,
        suspended: u.isSuspended === 1
      }));

      const profiles = [];
      const entries = [];
      const identities = [];
      const logs = [];
      const releaseLogs = [];
      const policies = [];

      const systemSettings = settingsRow ? {
        id: settingsRow.id,
        frontpageTitle: settingsRow.frontpageTitle,
        frontpageSubtitle: settingsRow.frontpageSubtitle,
        rolePermissions: safeJsonParse(settingsRow.rolePermissions, {}),
        inTheNewsText: settingsRow.inTheNewsText || '',
        inTheNewsGoogleDocUrl: settingsRow.inTheNewsGoogleDocUrl || '',
        featuredScholarId: settingsRow.featuredScholarId || '',
        featuredEntryId: settingsRow.featuredEntryId || '',
        editorialSelectionIds: safeJsonParse(settingsRow.editorialSelectionIds, []),
        announcementBanner: settingsRow.announcementBanner || '',
        enableArabicAccent: settingsRow.enableArabicAccent === 1,
        layoutDensity: settingsRow.layoutDensity || 'Standard',
        allowedSignatureFonts: safeJsonParse(settingsRow.allowedSignatureFonts, []),
        featuredEssayIds: safeJsonParse(settingsRow.featuredEssayIds, []),
        featuredNoteIds: safeJsonParse(settingsRow.featuredNoteIds, []),
        worldClockHolidaysText: settingsRow.worldClockHolidaysText || '',
        worldClockHolidaysGoogleDocUrl: settingsRow.worldClockHolidaysGoogleDocUrl || '',
        researchFindingsText: settingsRow.researchFindingsText || '',
        researchFindingsGoogleDocUrl: settingsRow.researchFindingsGoogleDocUrl || '',
        masterPrompt: settingsRow.masterPrompt || '',
        worldClockIntervalSec: settingsRow.worldClockIntervalSec !== undefined && settingsRow.worldClockIntervalSec !== null ? settingsRow.worldClockIntervalSec : 60,
        worldClockBgClickEnabled: settingsRow.worldClockBgClickEnabled !== undefined && settingsRow.worldClockBgClickEnabled !== null ? settingsRow.worldClockBgClickEnabled === 1 : true
      } : {};

      let currentUser = null;
      let isSuspended = false;
      if (sessionId) {
        const u = users.find(user => user.id === sessionId);
        if (u) {
          if (u.suspended) {
            isSuspended = true;
          } else {
            currentUser = u;
          }
        }
      }

      const rawNewsText = await fetchGoogleDocText(systemSettings.inTheNewsGoogleDocUrl);
      const rawHolidaysText = await fetchGoogleDocText(systemSettings.worldClockHolidaysGoogleDocUrl);
      const rawFindingsText = await fetchGoogleDocText(systemSettings.researchFindingsGoogleDocUrl);

      const checkStatus = (text, url) => {
        if (!url) return 'empty';
        if (!text) return 'failed';
        if (text.includes('<!DOCTYPE html>') || text.includes('errorMessage') || text.includes('Sorry, the file you have requested does not exist.')) {
          return 'failed';
        }
        return 'success';
      };

      const inTheNewsGoogleDocStatus = checkStatus(rawNewsText, systemSettings.inTheNewsGoogleDocUrl);
      const worldClockHolidaysGoogleDocStatus = checkStatus(rawHolidaysText, systemSettings.worldClockHolidaysGoogleDocUrl);
      const researchFindingsGoogleDocStatus = checkStatus(rawFindingsText, systemSettings.researchFindingsGoogleDocUrl);

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
        currentUser,
        isSuspended,
        inTheNewsGoogleDocText,
        worldClockHolidaysGoogleDocText,
        researchFindingsGoogleDocText,
        inTheNewsGoogleDocStatus,
        worldClockHolidaysGoogleDocStatus,
        researchFindingsGoogleDocStatus
      });
    } catch (err) {
      console.error('Error fetching database state:', err);
      res.status(500).json({ error: 'Database query failed' });
    }
  });

  return router;
}
