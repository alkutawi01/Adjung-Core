import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { db as mockDb } from './src/db/mockDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, 'adjung.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Enable Foreign Key support in SQLite
db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");
});

// Initialize database schema
const initializeSchema = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Users Table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE,
          email TEXT,
          role TEXT,
          penName TEXT,
          signature TEXT,
          avatarColor TEXT,
          bioSummary TEXT,
          isSuspended INTEGER DEFAULT 0,
          password TEXT DEFAULT 'password'
        )
      `);

      // 2. Profiles Table
      db.run(`
        CREATE TABLE IF NOT EXISTS profiles (
          authorId TEXT PRIMARY KEY,
          heroTitle TEXT,
          heroSubtitle TEXT,
          FOREIGN KEY(authorId) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // 3. Identities Table
      db.run(`
        CREATE TABLE IF NOT EXISTS identities (
          identityId TEXT PRIMARY KEY,
          accountId TEXT UNIQUE,
          username TEXT,
          displayName TEXT,
          penName TEXT,
          biography TEXT,
          publicVisibility TEXT,
          lifeTimeline TEXT,
          signatures TEXT,
          FOREIGN KEY(accountId) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // 4. Entries Table
      db.run(`
        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          authorId TEXT,
          title TEXT,
          slug TEXT,
          contentType TEXT,
          status TEXT,
          visibility TEXT,
          content TEXT,
          excerpt TEXT,
          featuredImage TEXT,
          publishedDate TEXT,
          createdDate TEXT,
          updatedDate TEXT,
          publicationClass TEXT,
          publisher TEXT,
          signatureVersionId TEXT,
          tags TEXT,
          footnotes TEXT,
          footnotesData TEXT,
          marginNotes TEXT,
          marginNotesData TEXT,
          citations TEXT,
          revisions TEXT,
          underReview INTEGER DEFAULT 0
        )
      `);

      // 5. System Settings Table
      db.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id TEXT PRIMARY KEY,
          frontpageTitle TEXT,
          frontpageSubtitle TEXT,
          rolePermissions TEXT,
          inTheNewsText TEXT,
          featuredScholarId TEXT,
          featuredEntryId TEXT,
          editorialSelectionIds TEXT,
          announcementBanner TEXT,
          enableArabicAccent INTEGER,
          layoutDensity TEXT,
          allowedSignatureFonts TEXT,
          featuredEssayIds TEXT,
          featuredNoteIds TEXT
        )
      `);
      db.run("ALTER TABLE system_settings ADD COLUMN inTheNewsText TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN inTheNewsGoogleDocUrl TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN featuredScholarId TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN featuredEntryId TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN editorialSelectionIds TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN announcementBanner TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN enableArabicAccent INTEGER", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN layoutDensity TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN allowedSignatureFonts TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN featuredEssayIds TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN featuredNoteIds TEXT", () => {});
      db.run("ALTER TABLE users ADD COLUMN affiliation TEXT", () => {});
      db.run("ALTER TABLE identities ADD COLUMN affiliation TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN worldClockHolidaysText TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN worldClockHolidaysGoogleDocUrl TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN researchFindingsText TEXT", () => {});
      db.run("ALTER TABLE system_settings ADD COLUMN researchFindingsGoogleDocUrl TEXT", () => {});

      // 6. Logs Table
      db.run(`
        CREATE TABLE IF NOT EXISTS logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT,
          operator TEXT,
          role TEXT,
          action TEXT
        )
      `);

      // 7. Release Logs Table
      db.run(`
        CREATE TABLE IF NOT EXISTS release_logs (
          id TEXT PRIMARY KEY,
          version TEXT,
          date TEXT,
          changes TEXT
        )
      `);

      // 8. Policies Table
      db.run(`
        CREATE TABLE IF NOT EXISTS policies (
          id TEXT PRIMARY KEY,
          type TEXT,
          title TEXT,
          lastUpdated TEXT,
          sections TEXT
        )
      `, (err) => {
        if (err) reject(err);
        else {
          db.run("ALTER TABLE entries ADD COLUMN underReview INTEGER DEFAULT 0;", () => {});
          resolve();
        }
      });
    });
  });
};

// Seed database with default academic data
const seedDatabase = async () => {
  const checkUsersCount = () => {
    return new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  };

  const usersCount = await checkUsersCount();
  if (usersCount > 0) {
    console.log('Database already contains seed data. Bypassing seed operation.');
    return;
  }

  console.log('Database is empty. Seeding initial academic seed data...');
  db.serialize(() => {
    // 1. Seed Users
    const stmtUser = db.prepare(`
      INSERT INTO users (id, username, email, role, penName, signature, avatarColor, bioSummary, isSuspended)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    mockDb.getUsers().forEach(u => {
      stmtUser.run(u.id, u.username, u.email, u.role, u.penName, u.signature, u.avatarColor, u.bioSummary, u.suspended ? 1 : 0);
    });
    stmtUser.finalize();

    // 2. Seed Profiles
    const stmtProfile = db.prepare(`
      INSERT INTO profiles (authorId, heroTitle, heroSubtitle)
      VALUES (?, ?, ?)
    `);
    mockDb.getProfiles().forEach(p => {
      stmtProfile.run(p.authorId, p.heroTitle, p.heroSubtitle);
    });
    stmtProfile.finalize();

    // 3. Seed Identities
    const stmtIdentity = db.prepare(`
      INSERT INTO identities (identityId, accountId, username, displayName, penName, biography, publicVisibility, lifeTimeline, signatures)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    mockDb.getIdentities().forEach(i => {
      stmtIdentity.run(i.identityId, i.accountId, i.username, i.displayName, i.penName, i.biography, i.publicVisibility, JSON.stringify(i.lifeTimeline), JSON.stringify(i.signatures));
    });
    stmtIdentity.finalize();

    // 4. Seed Entries
    const stmtEntry = db.prepare(`
      INSERT INTO entries (id, authorId, title, slug, contentType, status, visibility, content, excerpt, featuredImage, publishedDate, createdDate, updatedDate, publicationClass, publisher, signatureVersionId, tags, footnotes, footnotesData, marginNotes, marginNotesData, citations, revisions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    mockDb.getEntries().forEach(e => {
      stmtEntry.run(
        e.id,
        e.authorId,
        e.title,
        e.slug,
        e.contentType,
        e.status,
        e.visibility,
        e.content,
        e.excerpt || '',
        e.featuredImage || '',
        e.publishedDate,
        e.createdDate,
        e.updatedDate,
        e.publicationClass,
        e.publisher || '',
        e.signatureVersionId || '',
        JSON.stringify(e.tags || []),
        JSON.stringify(e.footnotes || []),
        JSON.stringify(e.footnotesData || {}),
        JSON.stringify(e.marginNotes || {}),
        JSON.stringify(e.marginNotesData || {}),
        JSON.stringify(e.citations || []),
        JSON.stringify(e.revisions || [])
      );
    });
    stmtEntry.finalize();

    // 5. Seed System Settings
    const sysSettings = mockDb.getSystemSettings();
    db.run(`
      INSERT INTO system_settings (
        id, frontpageTitle, frontpageSubtitle, rolePermissions, inTheNewsText,
        featuredScholarId, featuredEntryId, editorialSelectionIds, announcementBanner,
        enableArabicAccent, layoutDensity, allowedSignatureFonts, featuredEssayIds, featuredNoteIds
      )
      VALUES ('settings-main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sysSettings.frontpageTitle,
      sysSettings.frontpageSubtitle,
      JSON.stringify(sysSettings.rolePermissions),
      sysSettings.inTheNewsText,
      sysSettings.featuredScholarId,
      sysSettings.featuredEntryId,
      JSON.stringify(sysSettings.editorialSelectionIds || []),
      sysSettings.announcementBanner,
      sysSettings.enableArabicAccent ? 1 : 0,
      sysSettings.layoutDensity,
      JSON.stringify(sysSettings.allowedSignatureFonts || []),
      JSON.stringify(sysSettings.featuredEssayIds || []),
      JSON.stringify(sysSettings.featuredNoteIds || [])
    ]);

    // 6. Seed Logs
    const stmtLog = db.prepare(`
      INSERT INTO logs (id, timestamp, operator, role, action)
      VALUES (?, ?, ?, ?, ?)
    `);
    mockDb.getLogs().forEach(l => {
      stmtLog.run(l.id, l.timestamp, l.operator, l.role, l.action);
    });
    stmtLog.finalize();

    // 7. Seed Release Logs
    const stmtRelease = db.prepare(`
      INSERT INTO release_logs (id, version, date, changes)
      VALUES (?, ?, ?, ?)
    `);
    mockDb.getReleaseLogs().forEach(rl => {
      stmtRelease.run(rl.id, rl.version, rl.date, JSON.stringify(rl.changes));
    });
    stmtRelease.finalize();

    // 8. Seed Policies
    const stmtPolicy = db.prepare(`
      INSERT INTO policies (id, type, title, lastUpdated, sections)
      VALUES (?, ?, ?, ?, ?)
    `);
    mockDb.getPolicies().forEach(po => {
      stmtPolicy.run(po.id, po.type, po.title, po.lastUpdated, JSON.stringify(po.sections));
    });
    stmtPolicy.finalize();

    console.log('Database seeding operation complete.');
  });
};

// Start initialization flow
initializeSchema().then(() => {
  seedDatabase();
}).catch(err => {
  console.error('Failed to initialize database schema:', err);
});

// Helper: Query DB to array
const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Helper: Query DB single row
const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Helper: Run DB command
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

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

// --- REST API ROUTES ---

// 1. Fetch Complete DB State
app.get('/api/db-state', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];

    const usersRows = await dbAll("SELECT * FROM users");
    const profilesRows = await dbAll("SELECT * FROM profiles");
    const entriesRows = await dbAll("SELECT * FROM entries");
    const identitiesRows = await dbAll("SELECT * FROM identities");
    const settingsRow = await dbGet("SELECT * FROM system_settings WHERE id = 'settings-main'");
    const logsRows = await dbAll("SELECT * FROM logs ORDER BY timestamp DESC");
    const releaseLogsRows = await dbAll("SELECT * FROM release_logs");
    const policiesRows = await dbAll("SELECT * FROM policies");

    const users = usersRows.map((u) => ({
      ...u,
      suspended: u.isSuspended === 1
    }));

    const profiles = profilesRows;

    const entries = entriesRows.map((e) => ({
      ...e,
      tags: JSON.parse(e.tags || '[]'),
      footnotes: JSON.parse(e.footnotes || '[]'),
      footnotesData: JSON.parse(e.footnotesData || '{}'),
      marginNotes: JSON.parse(e.marginNotes || '{}'),
      marginNotesData: JSON.parse(e.marginNotesData || '{}'),
      citations: JSON.parse(e.citations || '[]'),
      revisions: JSON.parse(e.revisions || '[]'),
      isInstitutional: e.publicationClass === 'Institutional',
      underReview: e.underReview === 1
    }));

    const identities = identitiesRows.map((i) => ({
      ...i,
      lifeTimeline: JSON.parse(i.lifeTimeline || '[]'),
      signatures: JSON.parse(i.signatures || '[]')
    }));

    const systemSettings = settingsRow ? {
      id: settingsRow.id,
      frontpageTitle: settingsRow.frontpageTitle,
      frontpageSubtitle: settingsRow.frontpageSubtitle,
      rolePermissions: JSON.parse(settingsRow.rolePermissions || '{}'),
      inTheNewsText: settingsRow.inTheNewsText || '',
      inTheNewsGoogleDocUrl: settingsRow.inTheNewsGoogleDocUrl || '',
      featuredScholarId: settingsRow.featuredScholarId || '',
      featuredEntryId: settingsRow.featuredEntryId || '',
      editorialSelectionIds: JSON.parse(settingsRow.editorialSelectionIds || '[]'),
      announcementBanner: settingsRow.announcementBanner || '',
      enableArabicAccent: settingsRow.enableArabicAccent === 1,
      layoutDensity: settingsRow.layoutDensity || 'Standard',
      allowedSignatureFonts: JSON.parse(settingsRow.allowedSignatureFonts || '[]'),
      featuredEssayIds: JSON.parse(settingsRow.featuredEssayIds || '[]'),
      featuredNoteIds: JSON.parse(settingsRow.featuredNoteIds || '[]'),
      worldClockHolidaysText: settingsRow.worldClockHolidaysText || '',
      worldClockHolidaysGoogleDocUrl: settingsRow.worldClockHolidaysGoogleDocUrl || '',
      researchFindingsText: settingsRow.researchFindingsText || '',
      researchFindingsGoogleDocUrl: settingsRow.researchFindingsGoogleDocUrl || ''
    } : {};

    const logs = logsRows;
    const releaseLogs = releaseLogsRows.map(rl => ({
      ...rl,
      changes: JSON.parse(rl.changes || '{}')
    }));
    const policies = policiesRows.map(po => ({
      ...po,
      sections: JSON.parse(po.sections || '[]')
    }));

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

// 2. Authentication Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'Username/Email and Password are required.' });
    }

    const normalized = usernameOrEmail.trim().toLowerCase();
    const userRow = await dbGet(
      "SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?",
      [normalized, normalized]
    );

    if (!userRow) {
      return res.status(404).json({ error: 'UserNotFound', message: 'User not found. Please check your credentials.' });
    }

    if (userRow.isSuspended === 1) {
      return res.status(403).json({ error: 'AccountSuspended', message: 'This account has been suspended by the editorial board.' });
    }

    if (password !== userRow.password) {
      return res.status(401).json({ error: 'IncorrectPassword', message: 'Incorrect password.' });
    }

    const authenticatedUser = {
      ...userRow,
      suspended: userRow.isSuspended === 1
    };

    res.json({ user: authenticatedUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login pipeline failed' });
  }
});

// Authentication Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalized = email.trim().toLowerCase();
    const userRow = await dbGet(
      "SELECT * FROM users WHERE LOWER(email) = ?",
      [normalized]
    );

    if (!userRow) {
      return res.status(404).json({ error: 'UserNotFound', message: 'User with this email was not found.' });
    }

    await dbRun(
      "UPDATE users SET password = ? WHERE id = ?",
      [password, userRow.id]
    );

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Reset password failed.' });
  }
});

// 3. Create or Save Entry
app.post('/api/entries', async (req, res) => {
  try {
    const e = req.body;
    if (!e.id) return res.status(400).json({ error: 'Entry ID is required.' });

    const publishedDate = e.status === 'Published' ? (e.publishedDate || new Date().toISOString()) : null;
    const updatedDate = new Date().toISOString();

    const checkExists = await dbGet("SELECT id FROM entries WHERE id = ?", [e.id]);
    if (checkExists) {
      await dbRun(`
        UPDATE entries SET
          title = ?, slug = ?, contentType = ?, status = ?, visibility = ?, content = ?, excerpt = ?,
          featuredImage = ?, publishedDate = ?, updatedDate = ?, publicationClass = ?, publisher = ?,
          signatureVersionId = ?, tags = ?, footnotes = ?, footnotesData = ?, marginNotes = ?,
          marginNotesData = ?, citations = ?, revisions = ?
        WHERE id = ?
      `, [
        e.title, e.slug, e.contentType, e.status, e.visibility, e.content, e.excerpt || '',
        e.featuredImage || '', publishedDate, updatedDate, e.publicationClass, e.publisher || '',
        e.signatureVersionId || '', JSON.stringify(e.tags || []), JSON.stringify(e.footnotes || []),
        JSON.stringify(e.footnotesData || {}), JSON.stringify(e.marginNotes || {}),
        JSON.stringify(e.marginNotesData || {}), JSON.stringify(e.citations || []),
        JSON.stringify(e.revisions || []), e.id
      ]);
    } else {
      const createdDate = new Date().toISOString();
      await dbRun(`
        INSERT INTO entries (
          id, authorId, title, slug, contentType, status, visibility, content, excerpt,
          featuredImage, publishedDate, createdDate, updatedDate, publicationClass, publisher,
          signatureVersionId, tags, footnotes, footnotesData, marginNotes, marginNotesData,
          citations, revisions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        e.id, e.authorId, e.title, e.slug, e.contentType, e.status, e.visibility, e.content, e.excerpt || '',
        e.featuredImage || '', publishedDate, createdDate, updatedDate, e.publicationClass, e.publisher || '',
        e.signatureVersionId || '', JSON.stringify(e.tags || []), JSON.stringify(e.footnotes || []),
        JSON.stringify(e.footnotesData || {}), JSON.stringify(e.marginNotes || {}),
        JSON.stringify(e.marginNotesData || {}), JSON.stringify(e.citations || []),
        JSON.stringify(e.revisions || [])
      ]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Save entry error:', err);
    res.status(500).json({ error: 'Failed to save entry.' });
  }
});

// 4. Delete Entry
app.delete('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun("DELETE FROM entries WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
});

// 5. Create or Update User
app.post('/api/users', async (req, res) => {
  try {
    const u = req.body;
    if (!u.id) return res.status(400).json({ error: 'User ID is required.' });

    const checkExists = await dbGet("SELECT id FROM users WHERE id = ?", [u.id]);
    if (checkExists) {
      await dbRun(`
        UPDATE users SET
          username = ?, email = ?, role = ?, penName = ?, signature = ?, avatarColor = ?, bioSummary = ?, isSuspended = ?, affiliation = ?
          ${u.password ? ', password = ?' : ''}
        WHERE id = ?
      `, [
        u.username, u.email, u.role, u.penName, u.signature, u.avatarColor, u.bioSummary, u.suspended ? 1 : 0, u.affiliation,
        ...(u.password ? [u.password] : []), u.id
      ]);
    } else {
      await dbRun(`
        INSERT INTO users (id, username, email, role, penName, signature, avatarColor, bioSummary, isSuspended, password, affiliation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        u.id, u.username, u.email, u.role, u.penName, u.signature, u.avatarColor, u.bioSummary, u.suspended ? 1 : 0, u.password || 'password', u.affiliation
      ]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Save user error:', err);
    res.status(500).json({ error: 'Failed to save user.' });
  }
});

// 6. Save Profile
app.post('/api/profiles', async (req, res) => {
  try {
    const p = req.body;
    if (!p.authorId) return res.status(400).json({ error: 'AuthorId is required.' });

    const checkExists = await dbGet("SELECT authorId FROM profiles WHERE authorId = ?", [p.authorId]);
    if (checkExists) {
      await dbRun("UPDATE profiles SET heroTitle = ?, heroSubtitle = ? WHERE authorId = ?", [p.heroTitle, p.heroSubtitle, p.authorId]);
    } else {
      await dbRun("INSERT INTO profiles (authorId, heroTitle, heroSubtitle) VALUES (?, ?, ?)", [p.authorId, p.heroTitle, p.heroSubtitle]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Save profile error:', err);
    res.status(500).json({ error: 'Failed to save profile.' });
  }
});

// 7. Save Identity
app.post('/api/identities', async (req, res) => {
  try {
    const i = req.body;
    if (!i.identityId) return res.status(400).json({ error: 'IdentityId is required.' });

    const checkExists = await dbGet("SELECT identityId FROM identities WHERE identityId = ?", [i.identityId]);
    if (checkExists) {
      await dbRun(`
        UPDATE identities SET
          accountId = ?, username = ?, displayName = ?, penName = ?, biography = ?, publicVisibility = ?,
          lifeTimeline = ?, signatures = ?, affiliation = ?
        WHERE identityId = ?
      `, [
        i.accountId, i.username, i.displayName, i.penName, i.biography, i.publicVisibility,
        JSON.stringify(i.lifeTimeline || []), JSON.stringify(i.signatures || []), i.affiliation, i.identityId
      ]);
    } else {
      await dbRun(`
        INSERT INTO identities (
          identityId, accountId, username, displayName, penName, biography, publicVisibility, lifeTimeline, signatures, affiliation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        i.identityId, i.accountId, i.username, i.displayName, i.penName, i.biography, i.publicVisibility,
        JSON.stringify(i.lifeTimeline || []), JSON.stringify(i.signatures || []), i.affiliation
      ]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Save identity error:', err);
    res.status(500).json({ error: 'Failed to save identity.' });
  }
});

// 8. Save Settings
app.post('/api/system/settings', async (req, res) => {
  try {
    const s = req.body;
    await dbRun(`
      UPDATE system_settings SET
        frontpageTitle = ?, 
        frontpageSubtitle = ?, 
        rolePermissions = ?, 
        inTheNewsText = ?,
        inTheNewsGoogleDocUrl = ?,
        featuredScholarId = ?,
        featuredEntryId = ?,
        editorialSelectionIds = ?,
        announcementBanner = ?,
        enableArabicAccent = ?,
        layoutDensity = ?,
        allowedSignatureFonts = ?,
        featuredEssayIds = ?,
        featuredNoteIds = ?,
        worldClockHolidaysText = ?,
        worldClockHolidaysGoogleDocUrl = ?,
        researchFindingsText = ?,
        researchFindingsGoogleDocUrl = ?
      WHERE id = 'settings-main'
    `, [
      s.frontpageTitle, 
      s.frontpageSubtitle, 
      JSON.stringify(s.rolePermissions), 
      s.inTheNewsText,
      s.inTheNewsGoogleDocUrl,
      s.featuredScholarId,
      s.featuredEntryId,
      JSON.stringify(s.editorialSelectionIds || []),
      s.announcementBanner,
      s.enableArabicAccent ? 1 : 0,
      s.layoutDensity,
      JSON.stringify(s.allowedSignatureFonts || []),
      JSON.stringify(s.featuredEssayIds || []),
      JSON.stringify(s.featuredNoteIds || []),
      s.worldClockHolidaysText,
      s.worldClockHolidaysGoogleDocUrl,
      s.researchFindingsText,
      s.researchFindingsGoogleDocUrl
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error('Save settings error:', err);
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// 9. Reset Database
app.post('/api/system/reset', async (req, res) => {
  try {
    db.serialize(async () => {
      await dbRun("DELETE FROM users");
      await dbRun("DELETE FROM profiles");
      await dbRun("DELETE FROM identities");
      await dbRun("DELETE FROM entries");
      await dbRun("DELETE FROM system_settings");
      await dbRun("DELETE FROM logs");
      await dbRun("DELETE FROM release_logs");
      await dbRun("DELETE FROM policies");

      // Re-run seed
      await seedDatabase();
      res.json({ success: true });
    });
  } catch (err) {
    console.error('Reset database error:', err);
    res.status(500).json({ error: 'Failed to reset database.' });
  }
});

// 10. Add Log
app.post('/api/logs', async (req, res) => {
  try {
    const l = req.body;
    await dbRun(`
      INSERT INTO logs (id, timestamp, operator, role, action)
      VALUES (?, ?, ?, ?, ?)
    `, [l.id, l.timestamp, l.operator, l.role, l.action]);
    res.json({ success: true });
  } catch (err) {
    console.error('Add log error:', err);
    res.status(500).json({ error: 'Failed to add log.' });
  }
});

// 11. Moderation: Report Entry
app.post('/api/entries/:id/report', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun("UPDATE entries SET underReview = 1 WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Report entry error:', err);
    res.status(500).json({ error: 'Failed to report entry.' });
  }
});

// 12. Moderation: Dismiss Report
app.post('/api/entries/:id/dismiss-report', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun("UPDATE entries SET underReview = 0 WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Dismiss report error:', err);
    res.status(500).json({ error: 'Failed to dismiss report.' });
  }
});

// 13. Moderation: Unlist Entry
app.post('/api/entries/:id/unlist', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun("UPDATE entries SET underReview = 0, visibility = 'Private' WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Unlist entry error:', err);
    res.status(500).json({ error: 'Failed to unlist entry.' });
  }
});

// Start Express Server
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API server running on http://localhost:${PORT}`);
});
