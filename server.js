import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { db as mockDb } from './src/db/mockDb.js';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

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
      // 1. Users Table (Consolidated)
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL,
          penName TEXT,
          signature TEXT,
          avatarColor TEXT,
          bioSummary TEXT,
          isSuspended INTEGER DEFAULT 0,
          password TEXT DEFAULT 'password',
          affiliation TEXT,
          heroTitle TEXT,
          heroSubtitle TEXT,
          displayName TEXT,
          publicVisibility TEXT,
          lifeTimeline TEXT,
          createdAt TEXT,
          updatedAt TEXT
        )
      `);

      // 2. System Settings Table
      db.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id TEXT PRIMARY KEY,
          frontpageTitle TEXT,
          frontpageSubtitle TEXT,
          rolePermissions TEXT,
          inTheNewsText TEXT,
          inTheNewsGoogleDocUrl TEXT,
          featuredScholarId TEXT,
          featuredEntryId TEXT,
          editorialSelectionIds TEXT,
          announcementBanner TEXT,
          enableArabicAccent INTEGER DEFAULT 0,
          layoutDensity TEXT,
          allowedSignatureFonts TEXT,
          featuredEssayIds TEXT,
          featuredNoteIds TEXT,
          worldClockHolidaysText TEXT,
          worldClockHolidaysGoogleDocUrl TEXT,
          researchFindingsText TEXT,
          researchFindingsGoogleDocUrl TEXT
        )
      `, (err) => {
        if (err) reject(err);
        else {
          initEditorialOS(db).then(resolve).catch(reject);
        }
      });
    });
  });
};

// Seed database with default academic data
const seedDatabase = async () => {
  // Sentiasa daftarkan semua pembekal AI utama menggunakan INSERT OR IGNORE
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmtProviders = db.prepare(`
        INSERT OR IGNORE INTO ai_providers (id, name, secretName, model, monthlyBudget, dailyBudget, status, lastTest, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      stmtProviders.run('gemini-1', 'Google Gemini', 'GEMINI_API_KEY', 'gemini-3.5-flash', 100, 10, 'Active', now, 1);
      stmtProviders.run('openai-1', 'ChatGPT (OpenAI)', 'OPENAI_API_KEY', 'gpt-4o', 100, 10, 'Active', now, 1);
      stmtProviders.run('claude-1', 'Claude (Anthropic)', 'CLAUDE_API_KEY', 'claude-3-5-sonnet-latest', 100, 10, 'Active', now, 1);
      stmtProviders.run('meta-1', 'Meta AI (Llama)', 'META_API_KEY', 'llama-3.3-70b-instruct', 100, 10, 'Active', now, 1);
      stmtProviders.run('grok-1', 'Grok (xAI)', 'GROK_API_KEY', 'grok-2-latest', 100, 10, 'Active', now, 1);
      stmtProviders.run('deepseek-1', 'DeepSeek', 'DEEPSEEK_API_KEY', 'deepseek-chat', 100, 10, 'Active', now, 1);
      stmtProviders.run('qwen-1', 'Qwen (Alibaba)', 'QWEN_API_KEY', 'qwen-max', 100, 10, 'Active', now, 1);
      stmtProviders.finalize(async (err) => {
        if (err) reject(err);
        else {
          try {
            // Seed model pricing data
            await new Promise((resPricing, rejPricing) => {
              db.serialize(() => {
                const stmtPricing = db.prepare(`
                  INSERT OR IGNORE INTO ai_model_pricing (providerId, modelName, inputCostPerMillion, outputCostPerMillion, currency, updatedAt)
                  VALUES (?, ?, ?, ?, 'USD', ?)
                `);
                const nowStr = new Date().toISOString();
                stmtPricing.run('gemini-1', 'gemini-3.5-flash', 0.075, 0.30, nowStr);
                stmtPricing.run('openai-1', 'gpt-4o', 2.50, 10.00, nowStr);
                stmtPricing.run('claude-1', 'claude-3-5-sonnet-latest', 3.00, 15.00, nowStr);
                stmtPricing.run('deepseek-1', 'deepseek-chat', 0.14, 0.28, nowStr);
                stmtPricing.run('qwen-1', 'qwen-max', 1.00, 1.00, nowStr);
                stmtPricing.run('meta-1', 'llama-3.3-70b-instruct', 0.30, 0.40, nowStr);
                stmtPricing.finalize(async (errP) => {
                  if (errP) rejPricing(errP);
                  else {
                    try {
                      // Seed prompt templates
                      await new Promise((resPrompts, rejPrompts) => {
                        db.serialize(() => {
                          const stmtPrompts = db.prepare(`
                            INSERT OR IGNORE INTO prompt_templates (id, name, templateText, version, createdAt, updatedAt)
                            VALUES (?, ?, ?, ?, ?, ?)
                          `);
                          const now = new Date().toISOString();
                          stmtPrompts.run(
                            'daily_brief', 
                            'Daily Brief Summary', 
                            'Analyze the source text and write a clear title under 80 characters, and a summary under 250 characters matching the style of scholarly journal.', 
                            'v1.0', 
                            now, 
                            now
                          );
                          stmtPrompts.finalize((errPr) => {
                            if (errPr) rejPrompts(errPr);
                            else resPrompts();
                          });
                        });
                      });
                      resPricing();
                    } catch (promptErr) {
                      rejPricing(promptErr);
                    }
                  }
                });
              });
            });
            resolve();
          } catch (pricingErr) {
            reject(pricingErr);
          }
        }
      });
    });
  });

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
    console.log('Database already contains seed data. Bypassing user & settings seed operation.');
    return;
  }

  console.log('Database is empty. Seeding initial users and default configurations...');
  db.serialize(() => {
    // 1. Seed Users
    const stmtUser = db.prepare(`
      INSERT INTO users (id, username, email, role, penName, signature, avatarColor, bioSummary, isSuspended, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    mockDb.getUsers().forEach(u => {
      stmtUser.run(u.id, u.username, u.email, u.role, u.penName, u.signature, u.avatarColor, u.bioSummary, u.suspended ? 1 : 0);
    });
    stmtUser.finalize();

    // 3. Seed System Settings
    db.run(`
      INSERT INTO system_settings (
        id, frontpageTitle, frontpageSubtitle, rolePermissions, 
        inTheNewsText, inTheNewsGoogleDocUrl, featuredScholarId, featuredEntryId, 
        editorialSelectionIds, announcementBanner, enableArabicAccent, layoutDensity, 
        allowedSignatureFonts, featuredEssayIds, featuredNoteIds, worldClockHolidaysText, 
        worldClockHolidaysGoogleDocUrl, researchFindingsText, researchFindingsGoogleDocUrl
      ) VALUES (
        'settings-main', 'Adjung Mini Portal', 'Editorial Operating System', '{}', 
        '', '', '', '', 
        '[]', '', 0, 'Standard', 
        '[]', '[]', '[]', '', 
        '', '', ''
      )
    `);

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


// Template Integrasi API AI (Gemini, OpenAI, Claude, DeepSeek, Llama, Cohere)

// --- EDITORIAL PIPELINE WORKER (SPEC-XXX) ---

const generateSimulatedContent = (type, category, providerName, model) => {
  const timestamp = new Date().toLocaleTimeString();
  let title = `[${providerName} - ${model}] Perkembangan Terkini ${category}`;
  let summary = `Kandungan editorial ini dijana secara automatik menggunakan model ${model} pada pukul ${timestamp}. Analisis mencerminkan kajian mendalam mengenai ${category} berdasarkan sumber rujukan berwibawa.`;
  let payload = {};

  if (type === 'Book') {
    title = `Kajian Baharu: Sejarah dan Falsafah ${category}`;
    summary = `Buku baharu yang mengulas sejarah, perkembangan, dan metodologi kajian ${category} dalam era moden.`;
    payload = {
      isbn: '978-3-16-148410-0',
      publisher: 'Adjung Scholarly Press',
      coverImageId: ''
    };
  } else if (type === 'Event') {
    title = `Simposium Kebangsaan Falsafah & ${category}`;
    summary = `Persidangan dwi-tahunan yang mengumpulkan para sarjana terkemuka untuk membincangkan isu kontemporari ${category}.`;
    payload = {
      eventDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      location: 'Dewan Senat, Universiti Adjung'
    };
  } else if (type === 'Sponsor') {
    title = `Yayasan Penyelidikan ${category}`;
    summary = `Penaja rasmi geran penyelidikan sains kemanusiaan dan kajian fundamental ${category}.`;
    payload = {
      websiteUrl: 'https://yayasan.adjung.org',
      logoImageId: ''
    };
  }

  return { title, summary, payload };
};

const callAIProvider = async (provider, prompt, capability = 'Editorial Generation', runId = null) => {
  const apiKey = process.env[provider.secretName] || '';
  if (!apiKey) {
    throw new Error(`API key untuk ${provider.name} (${provider.secretName}) tidak ditemui.`);
  }

  const startTime = Date.now();
  let promptTokens = 0;
  let completionTokens = 0;
  let status = 'SUCCESS';
  let responseText = '';
  let parsedJson = null;

  try {
    // 1. Google Gemini (Google AI SDK)
    if (provider.id === 'gemini-1') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: provider.model || 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          tools: [{ googleSearch: {} }]
        }
      });
      responseText = response.text.trim();
      parsedJson = JSON.parse(responseText);
      
      if (response.usageMetadata) {
        promptTokens = response.usageMetadata.promptTokenCount || 0;
        completionTokens = response.usageMetadata.candidatesTokenCount || 0;
      }
    }

    // 2. OpenAI / ChatGPT
    else if (provider.id === 'openai-1') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: provider.model || 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      if (!res.ok) throw new Error(`OpenAI API returned status ${res.status}`);
      const data = await res.json();
      responseText = data.choices[0].message.content;
      parsedJson = JSON.parse(responseText.trim());
      
      if (data.usage) {
        promptTokens = data.usage.prompt_tokens || 0;
        completionTokens = data.usage.completion_tokens || 0;
      }
    }

    // 3. DeepSeek
    else if (provider.id === 'deepseek-1') {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: provider.model || 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      if (!res.ok) throw new Error(`DeepSeek API returned status ${res.status}`);
      const data = await res.json();
      responseText = data.choices[0].message.content;
      parsedJson = JSON.parse(responseText.trim());
      
      if (data.usage) {
        promptTokens = data.usage.prompt_tokens || 0;
        completionTokens = data.usage.completion_tokens || 0;
      }
    }

    // 4. Grok
    else if (provider.id === 'grok-1') {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: provider.model || 'grok-2-latest',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      if (!res.ok) throw new Error(`Grok API returned status ${res.status}`);
      const data = await res.json();
      responseText = data.choices[0].message.content;
      parsedJson = JSON.parse(responseText.trim());
      
      if (data.usage) {
        promptTokens = data.usage.prompt_tokens || 0;
        completionTokens = data.usage.completion_tokens || 0;
      }
    }

    // 5. Claude (Anthropic)
    else if (provider.id === 'claude-1') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: provider.model || 'claude-3-5-sonnet-latest',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt + '\nSila jawab dalam format JSON sahaja.' }]
        })
      });
      if (!res.ok) throw new Error(`Claude API returned status ${res.status}`);
      const data = await res.json();
      responseText = data.content[0].text;
      parsedJson = JSON.parse(responseText.trim());
      
      if (data.usage) {
        promptTokens = data.usage.input_tokens || 0;
        completionTokens = data.usage.output_tokens || 0;
      }
    }

    // 6. Qwen (Alibaba)
    else if (provider.id === 'qwen-1') {
      const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: provider.model || 'qwen-max',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      if (!res.ok) throw new Error(`Qwen API returned status ${res.status}`);
      const data = await res.json();
      responseText = data.choices[0].message.content;
      parsedJson = JSON.parse(responseText.trim());
      
      if (data.usage) {
        promptTokens = data.usage.prompt_tokens || 0;
        completionTokens = data.usage.completion_tokens || 0;
      }
    }

    // 7. Meta AI / Llama (OpenRouter)
    else if (provider.id === 'meta-1') {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: provider.model || 'meta-llama/llama-3.3-70b-instruct',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      if (!res.ok) throw new Error(`Meta Llama OpenRouter API returned status ${res.status}`);
      const data = await res.json();
      responseText = data.choices[0].message.content;
      parsedJson = JSON.parse(responseText.trim());
      
      if (data.usage) {
        promptTokens = data.usage.prompt_tokens || 0;
        completionTokens = data.usage.completion_tokens || 0;
      }
    } else {
      throw new Error(`Pembekal tidak disokong: ${provider.id}`);
    }
  } catch (err) {
    status = 'FAILED';
    promptTokens = Math.ceil(prompt.length / 4);
    const latencyMs = Date.now() - startTime;
    await dbRun(`
      INSERT INTO ai_usage_logs (runId, providerId, modelName, capability, promptTokens, completionTokens, totalTokens, estimatedCost, currency, latencyMs, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 0, ?, 0, 'USD', ?, 'FAILED', ?)
    `, [runId, provider.id, provider.model || 'unknown', capability, promptTokens, promptTokens, latencyMs, new Date().toISOString()]).catch(() => {});
    throw err;
  }

  if (promptTokens === 0) promptTokens = Math.ceil(prompt.length / 4);
  if (completionTokens === 0) completionTokens = Math.ceil(responseText.length / 4);
  const totalTokens = promptTokens + completionTokens;
  const latencyMs = Date.now() - startTime;

  let estimatedCost = 0;
  try {
    const pricing = await dbGet("SELECT * FROM ai_model_pricing WHERE providerId = ? AND modelName = ?", [provider.id, provider.model]);
    if (pricing) {
      estimatedCost = ((promptTokens / 1000000) * pricing.inputCostPerMillion) + ((completionTokens / 1000000) * pricing.outputCostPerMillion);
    }
  } catch (e) {
    // Ignore
  }

  await dbRun(`
    INSERT INTO ai_usage_logs (runId, providerId, modelName, capability, promptTokens, completionTokens, totalTokens, estimatedCost, currency, latencyMs, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, 'SUCCESS', ?)
  `, [runId, provider.id, provider.model, capability, promptTokens, completionTokens, totalTokens, estimatedCost, latencyMs, new Date().toISOString()]).catch(() => {});

  return parsedJson;
};

const runEditorialPipeline = async (slotIndex, runId = null) => {
  const timestamp = new Date().toISOString();
  const currentRunId = runId || `${new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 14)}`;

  const slot = await dbGet("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slotIndex]);
  if (!slot || slot.contentMode !== 'AI Generated') return null;

  // Rekod masa cubaan berjalan (lastAttemptAt) segera
  await dbRun("UPDATE slots_config SET lastAttemptAt = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [timestamp, slotIndex]);

  try {
    const provider = await dbGet("SELECT * FROM ai_providers WHERE id = ?", [slot.providerId]);
    
    if (!provider || !slot.promptText) {
      throw new Error('Slot is missing AI provider or prompt text');
    }

    // Fetch and Hash Source
    const { rawContent, fromCache } = await fetchSourceWithCache(slot.sourcesList);
    const normalizedSource = normalizeContent(rawContent);
    const sourceHash = crypto.createHash('sha256').update(normalizedSource).digest('hex');

    // Compile and Hash Prompt
    const globalPrompt = process.env.GLOBAL_PROMPT_PREFIX || '';
    const campaignPrompt = process.env.EDITORIAL_CAMPAIGN || '';
    const slotPrompt = slot.promptText || '';
    const compiledPrompt = `Global: ${globalPrompt} | Campaign: ${campaignPrompt} | Slot: ${slotPrompt}`;
    const promptHash = crypto.createHash('sha256').update(normalizeContent(compiledPrompt)).digest('hex');

    // Multi-layer Caching Key
    const systemPromptVersion = '1.0';
    const outputSchemaVersion = '1.0';
    const providerVersion = provider.status || 'unknown';
    const aiCacheKey = crypto.createHash('sha256').update(
      sourceHash + promptHash + provider.id + provider.model + providerVersion + systemPromptVersion + outputSchemaVersion
    ).digest('hex');

    // Check AI Cache
    const cachedValue = await dbGet("SELECT objectId FROM editorial_attribute_values WHERE attributeId = 'aiCacheKey' AND valueText = ? LIMIT 1", [aiCacheKey]);
    if (cachedValue) {
      const logMessage = fromCache 
        ? `Skipped because Source Cache: Source content is unchanged (Layer 0/1 hit). (AI Cache Key: ${aiCacheKey.substring(0, 8)})`
        : `Skipped because AI Cache: Reusing AI response. (AI Cache Key: ${aiCacheKey.substring(0, 8)})`;

      await dbRun(`
        INSERT INTO pipeline_logs (createdAt, level, promptVersion, layoutTemplateId, slotIndex, message, runId)
        VALUES (?, 'INFO', ?, 'frontpage', ?, ?, ?)
      `, [timestamp, '1.0', slotIndex, logMessage, currentRunId]);

      // Kemas kini nextRunAt (Falsafah Berkala) dan metadata state machine
      const intervalSecs = slot.refreshInterval || 3600;
      const nextRun = Date.now() + (intervalSecs * 1000);
      await dbRun(`
        UPDATE slots_config 
        SET nextRunAt = ?, lastSuccessfulRunAt = ?, lastRunStatus = 'CACHE_HIT', lastRunMessage = ? 
        WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?
      `, [nextRun, timestamp, logMessage, slotIndex]);

      return { objectId: cachedValue.objectId, status: 'CACHE_HIT' };
    }

    const apiKey = process.env[provider.secretName] || '';
    let title = '';
    let summary = '';
    let customPayload = {};

    const allowedTypes = (slot.allowedContentTypes || 'Berita').split(',');
    const outputType = allowedTypes[0].trim();
    const category = 'Umum';

    let aiSourceUrl = '';

    if (apiKey) {
      try {
        const fullPromptToAI = `
          Global System Context: ${globalPrompt}
          Current Campaign Focus: ${campaignPrompt}
          Slot Specific Instructions: ${slotPrompt}
          
          Tulis tajuk dan ringkasan kandungan bertipe "${outputType}" untuk bahagian berita "${category}" berdasarkan arahan di atas.
          Lakukan carian di internet menggunakan enjin carian sekiranya perlu untuk mendapatkan fakta berita terbaharu.
          
          SYARAT PENTING (MANDATORY):
          1. Tajuk berita ("title") mestilah ringkas, padat dan TIDAK MELEBIHI 115 aksara.
          2. Ringkasan berita ("summary") mestilah TIDAK MELEBIHI 240 aksara.
          3. Gunakan bahasa Melayu yang profesional dan bergaya editorial.
          4. Cari dan sertakan pautan URL artikel berita sebenar (contoh daripada Bernama/Awani/etc.) yang anda rujuk dalam harta "source_url". Jika tiada pautan khusus, gunakan "".
          5. Hasilkan respons dalam format JSON sahaja dengan struktur:
             { 
               "title": "Tajuk", 
               "summary": "Ringkasan",
               "source_url": "https://url-sumber-berita-sebenar"
             }
        `;
        const data = await callAIProvider(provider, fullPromptToAI, 'Editorial Generation', currentRunId);
        title = data.title || '';
        summary = data.summary || '';
        aiSourceUrl = data.source_url || '';
      } catch (e) {
        throw new Error(`AI generation error: ${e.message}`);
      }
    } else {
      throw new Error(`Secret key ${provider.secretName} is not set for provider ${provider.name}`);
    }

    if (!title || !summary) {
      throw new Error('AI returned empty title or summary.');
    }

    // Insert Editorial Object
    const objectId = `object-${outputType.toLowerCase()}-slot${slotIndex}-${Date.now()}`;
    await dbRun(`
      INSERT INTO editorial_objects (id, type, categoryId, priority, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [objectId, outputType, category, slot.priority || 'Medium', timestamp, timestamp]);

    // Insert Initial Revision
    const revisionResult = await dbRun(`
      INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
      VALUES (?, 1.0, 'ms', ?, ?, 'approved', ?, ?, ?)
    `, [objectId, title, summary, `pipeline-slot-${slotIndex}`, timestamp, timestamp]);
    const revisionId = revisionResult.lastID || 1;

    // Save Attribute Values
    const sourceUrl = (slot.sourcesList && (slot.sourcesList.trim().startsWith('http://') || slot.sourcesList.trim().startsWith('https://'))) 
      ? slot.sourcesList.trim() 
      : (aiSourceUrl && aiSourceUrl.trim().startsWith('http') ? aiSourceUrl.trim() : '#');

    const attributesToSave = [
      { key: 'aiCacheKey', val: aiCacheKey },
      { key: 'sourceHash', val: sourceHash },
      { key: 'desk', val: category },
      { key: 'source', val: provider.name },
      { key: 'url', val: sourceUrl },
      { key: 'aiProvider', val: provider.name }
    ];

    Object.keys(customPayload).forEach(key => {
      attributesToSave.push({ key: key, val: customPayload[key] });
    });

    for (const av of attributesToSave) {
      await dbRun(`
        INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText)
        VALUES (?, ?, ?, ?)
      `, [objectId, revisionId, av.key, av.val]);
    }

    // Auto Translations
    const translationConfigs = await dbAll("SELECT * FROM translation_configs WHERE isEnabled = 1");
    for (const tConfig of translationConfigs) {
      const translatorProvider = await dbGet("SELECT * FROM ai_providers WHERE id = ?", [tConfig.providerId]);
      if (translatorProvider) {
        try {
          const transPrompt = `
            Terjemah tajuk dan ringkasan kandungan berita di bawah dari Bahasa Melayu ke ${tConfig.languageName} (${tConfig.languageCode}).
            
            Tajuk Asal: ${title}
            Ringkasan Asal: ${summary}
            
            Syarat Terjemahan:
            1. Terjemah secara profesional.
            2. Had saiz tajuk terjemahan mestilah di bawah 115 aksara.
            3. Had saiz ringkasan terjemahan mestilah di bawah 240 aksara.
            4. Hasilkan respons dalam format JSON sahaja dengan struktur:
               { "title": "Tajuk Terjemahan", "summary": "Ringkasan Terjemahan" }
          `;
          const transData = await callAIProvider(translatorProvider, transPrompt, 'Translation', currentRunId);
          const transTitle = transData.title || '';
          const transSummary = transData.summary || '';

          if (transTitle && transSummary) {
            await dbRun(`
              INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
              VALUES (?, 1.0, ?, ?, ?, 'approved', ?, ?, ?)
            `, [objectId, tConfig.languageCode, transTitle, transSummary, `translator-${tConfig.languageCode}`, timestamp, timestamp]);
            
            console.log(`Translated successfully to ${tConfig.languageCode} using ${translatorProvider.name}`);
          }
        } catch (tErr) {
          console.error(`Translation failed for language ${tConfig.languageCode}:`, tErr);
        }
      }
    }

    // Set next run time and update state machine metadata
    const intervalSecs = slot.refreshInterval || 3600;
    const nextRun = Date.now() + (intervalSecs * 1000);
    const logMsg = `Successfully generated Editorial Object ${objectId} (${outputType}) using ${provider.name}`;

    await dbRun(`
      UPDATE slots_config 
      SET nextRunAt = ?, lastSuccessfulRunAt = ?, lastRunStatus = 'SUCCESS', lastRunMessage = ? 
      WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?
    `, [nextRun, timestamp, logMsg, slotIndex]);

    await dbRun(`
      INSERT INTO pipeline_logs (createdAt, level, promptVersion, layoutTemplateId, slotIndex, message, runId)
      VALUES (?, 'SUCCESS', ?, 'frontpage', ?, ?, ?)
    `, [timestamp, '1.0', slotIndex, logMsg, currentRunId]);

    return { objectId, status: 'SUCCESS' };

  } catch (error) {
    // Kemas kini status kepada FAILED
    const failMsg = error.message || 'Unknown error';
    await dbRun(`
      UPDATE slots_config 
      SET lastRunStatus = 'FAILED', lastRunMessage = ? 
      WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?
    `, [failMsg, slotIndex]);

    await dbRun(`
      INSERT INTO pipeline_logs (createdAt, level, promptVersion, layoutTemplateId, slotIndex, message, runId)
      VALUES (?, 'ERROR', '1.0', 'frontpage', ?, ?, ?)
    `, [timestamp, slotIndex, `Pipeline failed: ${failMsg}`, currentRunId]);

    throw error;
  }
};

// POST /api/system/pipeline/run
app.post('/api/system/pipeline/run', async (req, res) => {
  const currentRunId = `run-${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  try {
    const { slotIndex, force = false } = req.body;
    
    if (slotIndex !== undefined) {
      const slot = await dbGet("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slotIndex]);
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found.' });
      }
      
      const result = await runEditorialPipeline(slotIndex, currentRunId);
      if (result && result.objectId) {
        await dbRun("UPDATE slots_config SET activeObjectId = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [result.objectId, slotIndex]);
        return res.json({ success: true, objectId: result.objectId, status: result.status });
      } else {
        return res.status(400).json({ error: 'Failed to run pipeline (slot might be disabled).' });
      }
    } else {
      // Run all active AI slots
      const slots = await dbAll("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' AND contentMode = 'AI Generated'");
      const results = [];
      
      let processedCount = 0;
      let skippedByScheduler = 0;
      let skippedByAiCache = 0;
      let actualAiCalls = 0;
      
      const now = Date.now();
      
      for (const slot of slots) {
        processedCount++;
        
        // Penjadual Pintar Check (unless force is true)
        if (!force && slot.nextRunAt && slot.nextRunAt > now) {
          skippedByScheduler++;
          await dbRun(`
            INSERT INTO pipeline_logs (createdAt, level, promptVersion, layoutTemplateId, slotIndex, message, runId)
            VALUES (?, 'INFO', '1.0', 'frontpage', ?, ?, ?)
          `, [timestamp, slot.slotIndex, `Skipped by Scheduler: nextRunAt (${new Date(slot.nextRunAt).toLocaleString()}) is in the future.`, currentRunId]);
          continue;
        }
        
        const result = await runEditorialPipeline(slot.slotIndex, currentRunId);
        if (result && result.objectId) {
          await dbRun("UPDATE slots_config SET activeObjectId = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [result.objectId, slot.slotIndex]);
          
          if (result.status === 'CACHE_HIT') {
            skippedByAiCache++;
          } else if (result.status === 'SUCCESS') {
            actualAiCalls++;
          }
          
          results.push({ slotIndex: slot.slotIndex, objectId: result.objectId, status: result.status });
        }
      }
      
      const statsMessage = `Pipeline completed. Total: ${processedCount}, Scheduler Skip: ${skippedByScheduler}, AI Cache Skip: ${skippedByAiCache}, Actual AI calls: ${actualAiCalls}`;
      await dbRun(`
        INSERT INTO pipeline_logs (createdAt, level, promptVersion, layoutTemplateId, slotIndex, message, runId)
        VALUES (?, 'INFO', '1.0', 'frontpage', -1, ?, ?)
      `, [timestamp, statsMessage, currentRunId]);
      
      return res.json({ 
        success: true, 
        runId: currentRunId,
        results,
        stats: {
          processed: processedCount,
          skippedByScheduler,
          skippedByAiCache,
          actualAiCalls
        }
      });
    }
  } catch (err) {
    console.error('Run pipeline error:', err);
    res.status(500).json({ error: 'Failed to run editorial pipeline. ' + (err.message || '') });
  }
});


// --- EDITORIAL OPERATING SYSTEM (SPEC-XXX) SCHEMA INIT & SEED ---

const initEditorialOS = (dbConn) => {
  return new Promise((resolve, reject) => {
    dbConn.serialize(() => {
      // 1. ai_providers
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS ai_providers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          secretName TEXT,
          model TEXT,
          monthlyBudget REAL,
          dailyBudget REAL,
          status TEXT,
          lastTest TEXT,
          enabled INTEGER DEFAULT 1
        )
      `);

      // 2. prompt_templates
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS prompt_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          templateText TEXT,
          version TEXT,
          createdAt TEXT,
          updatedAt TEXT
        )
      `);

      // 4. editorial_objects
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS editorial_objects (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          categoryId TEXT,
          priority TEXT,
          createdAt TEXT,
          updatedAt TEXT
        )
      `);

      // 5. editorial_revisions
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS editorial_revisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          objectId TEXT NOT NULL,
          version REAL,
          language TEXT DEFAULT 'ms',
          title TEXT,
          summary TEXT,
          status TEXT,
          createdBy TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          FOREIGN KEY(objectId) REFERENCES editorial_objects(id) ON DELETE CASCADE
        )
      `);

      // 6. media_library
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS media_library (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          alt TEXT,
          copyright TEXT,
          credit TEXT,
          width INTEGER,
          height INTEGER,
          storagePath TEXT,
          createdAt TEXT,
          updatedAt TEXT
        )
      `);

      // 7. editorial_attributes
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS editorial_attributes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          valueType TEXT
        )
      `);

      // 8. editorial_attribute_values
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS editorial_attribute_values (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          objectId TEXT NOT NULL,
          revisionId INTEGER,
          attributeId TEXT NOT NULL,
          valueText TEXT,
          FOREIGN KEY(objectId) REFERENCES editorial_objects(id) ON DELETE CASCADE,
          FOREIGN KEY(attributeId) REFERENCES editorial_attributes(id) ON DELETE CASCADE
        )
      `);
      
      // Indexes for EAV
      dbConn.run("CREATE INDEX IF NOT EXISTS idx_eav_object ON editorial_attribute_values(objectId, revisionId)");
      dbConn.run("CREATE INDEX IF NOT EXISTS idx_eav_attribute ON editorial_attribute_values(attributeId)");

      // 9. layout_templates
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS layout_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slotCount INTEGER,
          slotDefinitions TEXT
        )
      `);

      // 10. slots_config
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS slots_config (
          layoutTemplateId TEXT NOT NULL,
          slotIndex INTEGER NOT NULL,
          contentMode TEXT DEFAULT 'Manual',
          providerId TEXT,
          model TEXT,
          promptText TEXT,
          sourcesList TEXT,
          refreshRate TEXT,
          allowedContentTypes TEXT,
          priority TEXT,
          expiresAt TEXT,
          bgColor TEXT,
          borderColor TEXT,
          textColor TEXT,
          manualTitle TEXT,
          manualSummary TEXT,
          manualSource TEXT,
          manualUrl TEXT,
          manualImageUrl TEXT,
          activeObjectId TEXT,
          PRIMARY KEY (layoutTemplateId, slotIndex),
          FOREIGN KEY(providerId) REFERENCES ai_providers(id) ON DELETE SET NULL
        )
      `);

      // 11. pipeline_logs
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS pipeline_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          createdAt TEXT,
          level TEXT,
          promptVersion TEXT,
          layoutTemplateId TEXT,
          slotIndex INTEGER,
          message TEXT,
          runId TEXT
        )
      `);

      // 12. source_fetch_cache
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS source_fetch_cache (
          sourceUri TEXT PRIMARY KEY,
          rawContent TEXT NOT NULL,
          contentHash TEXT NOT NULL,
          contentType TEXT,
          etag TEXT,
          lastModified TEXT,
          fetchedAt TEXT NOT NULL
        )
      `);

      // 13. translation_configs
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS translation_configs (
          languageCode TEXT PRIMARY KEY,
          languageName TEXT NOT NULL,
          providerId TEXT NOT NULL,
          isEnabled INTEGER DEFAULT 0,
          createdAt TEXT,
          updatedAt TEXT,
          FOREIGN KEY(providerId) REFERENCES ai_providers(id)
        )
      `);

      // 14. downstream_products
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS downstream_products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          revisionId INTEGER NOT NULL,
          productType TEXT NOT NULL,
          payloadReference TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          FOREIGN KEY(revisionId) REFERENCES editorial_revisions(id) ON DELETE CASCADE
        )
      `);

      // 15. ai_usage_logs
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS ai_usage_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          runId TEXT,
          providerId TEXT NOT NULL,
          modelName TEXT NOT NULL,
          capability TEXT,
          promptTokens INTEGER DEFAULT 0,
          completionTokens INTEGER DEFAULT 0,
          totalTokens INTEGER DEFAULT 0,
          estimatedCost REAL DEFAULT 0,
          currency TEXT DEFAULT 'USD',
          latencyMs INTEGER,
          status TEXT,
          createdAt TEXT NOT NULL,
          FOREIGN KEY(providerId) REFERENCES ai_providers(id)
        )
      `);

      // 16. ai_model_pricing
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS ai_model_pricing (
          providerId TEXT,
          modelName TEXT,
          inputCostPerMillion REAL,
          outputCostPerMillion REAL,
          currency TEXT,
          updatedAt TEXT,
          PRIMARY KEY(providerId, modelName)
        )
      `, (err) => {
        if (err) reject(err);
        else {
          // Jalankan migrasi lajur tambahan secara selamat (mengabaikan ralat jika lajur sudah wujud)
          dbConn.run("ALTER TABLE slots_config ADD COLUMN manualDesk TEXT", () => {
            dbConn.run("ALTER TABLE slots_config ADD COLUMN nextRunAt INTEGER", () => {
              dbConn.run("ALTER TABLE slots_config ADD COLUMN refreshInterval INTEGER", () => {
                dbConn.run("ALTER TABLE slots_config ADD COLUMN lastAttemptAt TEXT", () => {
                  dbConn.run("ALTER TABLE slots_config ADD COLUMN lastSuccessfulRunAt TEXT", () => {
                    dbConn.run("ALTER TABLE slots_config ADD COLUMN lastRunStatus TEXT", () => {
                      dbConn.run("ALTER TABLE slots_config ADD COLUMN lastRunMessage TEXT", () => {
                        dbConn.run("ALTER TABLE editorial_revisions ADD COLUMN language TEXT DEFAULT 'ms'", () => {
                          dbConn.run("ALTER TABLE pipeline_logs ADD COLUMN runId TEXT", () => {
                            resolve();
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        }
      });
    });
  });
};

// --- EDITORIAL OPERATING SYSTEM API ROUTES ---

const normalizeContent = (content) => {
  if (!content) return '';
  return content
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/utm_[a-z]+=[^&]+/g, '')
    .replace(/[?&]&/g, '')
    .replace(/\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}z/gi, '')
    .replace(/\d{10,13}/g, '');
};

const fetchSourceWithCache = async (sourceUri) => {
  if (!sourceUri) return { rawContent: '', fromCache: false };
  const trimmedUri = sourceUri.trim();
  
  if (!trimmedUri.startsWith('http://') && !trimmedUri.startsWith('https://')) {
    try {
      const filePath = path.resolve(trimmedUri);
      if (fs.existsSync(filePath)) {
        return { rawContent: fs.readFileSync(filePath, 'utf8'), fromCache: true };
      }
    } catch (e) {
      // Ignore
    }
    return { rawContent: trimmedUri, fromCache: true };
  }
  
  const now = new Date().toISOString();
  const cacheEntry = await dbGet("SELECT * FROM source_fetch_cache WHERE sourceUri = ?", [trimmedUri]);
  
  if (cacheEntry) {
    const ageMs = Date.now() - new Date(cacheEntry.fetchedAt).getTime();
    if (ageMs < 15 * 60 * 1000) {
      return { rawContent: cacheEntry.rawContent, fromCache: true };
    }
  }
  
  const headers = {};
  if (cacheEntry) {
    if (cacheEntry.etag) headers['If-None-Match'] = cacheEntry.etag;
    if (cacheEntry.lastModified) headers['If-Modified-Since'] = cacheEntry.lastModified;
  }
  
  try {
    const res = await fetch(trimmedUri, { headers, timeout: 8000 });
    
    if (res.status === 304 && cacheEntry) {
      await dbRun("UPDATE source_fetch_cache SET fetchedAt = ? WHERE sourceUri = ?", [now, trimmedUri]);
      return { rawContent: cacheEntry.rawContent, fromCache: true };
    }
    
    if (res.ok) {
      const rawContent = await res.text();
      const etag = res.headers.get('etag') || null;
      const lastModified = res.headers.get('last-modified') || null;
      const contentHash = crypto.createHash('sha256').update(normalizeContent(rawContent)).digest('hex');
      const contentType = res.headers.get('content-type') || null;
      
      await dbRun(`
        INSERT OR REPLACE INTO source_fetch_cache (sourceUri, rawContent, contentHash, contentType, etag, lastModified, fetchedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [trimmedUri, rawContent, contentHash, contentType, etag, lastModified, now]);
      
      return { rawContent, fromCache: false };
    }
  } catch (err) {
    console.error(`Fetch error for ${trimmedUri}, falling back to cache:`, err);
    if (cacheEntry) return { rawContent: cacheEntry.rawContent, fromCache: true };
  }
  
  return cacheEntry ? { rawContent: cacheEntry.rawContent, fromCache: true } : { rawContent: '', fromCache: false };
};

// Helper function to resolve active layout slots
const resolveSlotContent = async (slot, lang = 'ms') => {
  if (slot.contentMode === 'Disabled') {
    return null;
  }

  let finalItem = {
    rawIndex: slot.slotIndex + 1,
    bgColor: slot.bgColor || 'transparent',
    borderColor: slot.borderColor || '',
    textColor: slot.textColor || '#1F1F1F',
    desk: slot.allowedContentTypes || '',
    title: '',
    brief: '',
    source: 'Nature',
    url: '#',
    imageUrl: slot.manualImageUrl || '',
    language: 'ms'
  };

  if (slot.contentMode === 'Manual') {
    finalItem.title = slot.manualTitle || '';
    finalItem.brief = slot.manualSummary || '';
    finalItem.source = slot.manualSource || 'Nature';
    finalItem.url = slot.manualUrl || '#';
    finalItem.imageUrl = slot.manualImageUrl || '';
    finalItem.desk = slot.manualDesk || slot.allowedContentTypes || '';
  } else {
    const objectId = slot.overrideObjectId || slot.activeObjectId || `object-frontpage-${slot.slotIndex}`;
    
    if (objectId) {
      const obj = await dbGet("SELECT * FROM editorial_objects WHERE id = ?", [objectId]);
      if (obj) {
        let rev = await dbGet("SELECT * FROM editorial_revisions WHERE objectId = ? AND status = 'approved' AND language = ? ORDER BY version DESC LIMIT 1", [objectId, lang]);
        if (!rev && lang !== 'ms') {
          rev = await dbGet("SELECT * FROM editorial_revisions WHERE objectId = ? AND status = 'approved' AND language = 'ms' ORDER BY version DESC LIMIT 1", [objectId]);
        }
        
        if (rev) {
          finalItem.title = rev.title || '';
          finalItem.brief = rev.summary || '';
          finalItem.desk = obj.categoryId || slot.allowedContentTypes || '';
          finalItem.language = rev.language || 'ms';
          
          // Fetch EAV attributes
          const avs = await dbAll("SELECT * FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ?", [objectId, rev.id]);
          avs.forEach(av => {
            if (av.attributeId === 'desk') finalItem.desk = av.valueText;
            else if (av.attributeId === 'source') finalItem.source = av.valueText;
            else if (av.attributeId === 'url') finalItem.url = av.valueText;
            else if (av.attributeId === 'deskB') finalItem.deskB = av.valueText;
            else if (av.attributeId === 'titleB') finalItem.titleB = av.valueText;
            else if (av.attributeId === 'briefB') finalItem.briefB = av.valueText;
            else if (av.attributeId === 'sourceB') finalItem.sourceB = av.valueText;
            else if (av.attributeId === 'urlB') finalItem.urlB = av.valueText;
            else if (av.attributeId === 'offset') finalItem.offset = parseInt(av.valueText, 10) || 0;
            else if (av.attributeId === 'coverImageId' || av.attributeId === 'imageUrl') finalItem.imageUrl = av.valueText;
            else if (av.attributeId === 'aiProvider') finalItem.aiProvider = av.valueText;
          });
        }
      }
    }

    // If Hybrid mode, the slot settings override the AI values
    if (slot.contentMode === 'Hybrid') {
      if (slot.manualTitle) finalItem.title = slot.manualTitle;
      if (slot.manualSummary) finalItem.brief = slot.manualSummary;
      if (slot.manualSource) finalItem.source = slot.manualSource;
      if (slot.manualUrl) finalItem.url = slot.manualUrl;
      if (slot.manualImageUrl) finalItem.imageUrl = slot.manualImageUrl;
      if (slot.manualDesk) finalItem.desk = slot.manualDesk;
    }
  }

  if (!finalItem.title || finalItem.title.trim() === '') {
    return null;
  }

  return finalItem;
};

// 1. GET /api/system/layout/active
app.get('/api/system/layout/active', async (req, res) => {
  try {
    const lang = req.query.lang || 'ms';
    const slots = await dbAll("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' ORDER BY slotIndex ASC");
    const resolvedSlots = [];
    
    for (const slot of slots) {
      const resolved = await resolveSlotContent(slot, lang);
      if (resolved) {
        resolvedSlots.push(resolved);
      }
    }
    
    res.json(resolvedSlots);
  } catch (err) {
    console.error('Resolve layout error:', err);
    res.status(500).json({ error: 'Failed to resolve layout slots.' });
  }
});

// 2. GET /api/ai/providers
app.get('/api/ai/providers', async (req, res) => {
  try {
    const providers = await dbAll("SELECT id, name, secretName, model, monthlyBudget, dailyBudget, status, lastTest, enabled FROM ai_providers");
    res.json(providers);
  } catch (err) {
    console.error('Fetch providers error:', err);
    res.status(500).json({ error: 'Failed to fetch providers.' });
  }
});

// 3. POST /api/ai/providers
app.post('/api/ai/providers', async (req, res) => {
  try {
    const p = req.body;
    await dbRun(`
      INSERT OR REPLACE INTO ai_providers (id, name, secretName, model, monthlyBudget, dailyBudget, status, lastTest, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [p.id, p.name, p.secretName, p.model, p.monthlyBudget, p.dailyBudget, p.status, p.lastTest, p.enabled ? 1 : 0]);
    res.json({ success: true });
  } catch (err) {
    console.error('Save provider error:', err);
    res.status(500).json({ error: 'Failed to save provider.' });
  }
});

// POST /api/media/upload
app.post('/api/media/upload', async (req, res) => {
  try {
    const { filename, fileData } = req.body;
    if (!filename || !fileData) {
      return res.status(400).json({ error: 'Filename and fileData (base64) are required.' });
    }

    // Pastikan folder public/uploads wujud
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Bersihkan nama fail dan tambah timestamp untuk mengelakkan pertindihan
    const cleanFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadDir, cleanFilename);

    // Dapatkan data base64 tulen
    const base64Data = fileData.split(';base64,').pop();
    fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });

    const fileUrl = `/uploads/${cleanFilename}`;
    res.json({ url: fileUrl });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Failed to upload file.' });
  }
});

// 4. POST /api/ai/test-provider
app.post('/api/ai/test-provider', async (req, res) => {
  try {
    const { id } = req.body;
    const prov = await dbGet("SELECT * FROM ai_providers WHERE id = ?", [id]);
    if (!prov) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    const apiKey = process.env[prov.secretName] || '';
    const success = apiKey.length > 0;
    const statusText = success ? 'Connected' : 'Missing API Key';
    const lastTest = new Date().toISOString();
    
    await dbRun("UPDATE ai_providers SET status = ?, lastTest = ? WHERE id = ?", [statusText, lastTest, id]);
    res.json({ success, status: statusText, lastTest });
  } catch (err) {
    console.error('Test provider error:', err);
    res.status(500).json({ error: 'Failed to test provider connection.' });
  }
});



// 8. GET /api/ai/prompts
app.get('/api/ai/prompts', async (req, res) => {
  try {
    const prompts = await dbAll("SELECT * FROM prompt_templates");
    res.json(prompts);
  } catch (err) {
    console.error('Fetch prompts error:', err);
    res.status(500).json({ error: 'Failed to fetch prompt templates.' });
  }
});

// 9. POST /api/ai/prompts
app.post('/api/ai/prompts', async (req, res) => {
  try {
    const p = req.body;
    await dbRun(`
      INSERT OR REPLACE INTO prompt_templates (id, name, templateText, version, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `, [p.id, p.name, p.templateText, p.version, new Date().toISOString()]);
    res.json({ success: true });
  } catch (err) {
    console.error('Save prompt error:', err);
    res.status(500).json({ error: 'Failed to save prompt template.' });
  }
});

// 10. GET /api/system/slots
app.get('/api/system/slots', async (req, res) => {
  try {
    const slots = await dbAll("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' ORDER BY slotIndex ASC");
    res.json(slots);
  } catch (err) {
    console.error('Fetch slots config error:', err);
    res.status(500).json({ error: 'Failed to fetch slots configuration.' });
  }
});

// 11. POST /api/system/slots
app.post('/api/system/slots', async (req, res) => {
  try {
    const slots = req.body; // Array of 38 slot configs
    for (const slot of slots) {
      const providerId = slot.providerId && typeof slot.providerId === 'string' && slot.providerId.trim() !== '' && slot.providerId !== 'undefined' && slot.providerId !== 'null' ? slot.providerId : null;
      console.log(`Slot ${slot.slotIndex}: raw providerId = "${slot.providerId}", mapped = ${providerId}`);
      await dbRun(`
        INSERT OR REPLACE INTO slots_config (
          layoutTemplateId, slotIndex, contentMode, providerId, model, promptText, sourcesList, refreshRate, allowedContentTypes, priority, expiresAt, bgColor, borderColor, textColor, 
          manualTitle, manualSummary, manualSource, manualUrl, manualImageUrl, manualDesk, activeObjectId
        ) VALUES ('frontpage', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        slot.slotIndex, slot.contentMode, providerId, slot.model, slot.promptText, slot.sourcesList, slot.refreshRate, slot.allowedContentTypes, slot.priority, slot.expiresAt, slot.bgColor, slot.borderColor, slot.textColor,
        slot.manualTitle, slot.manualSummary, slot.manualSource, slot.manualUrl, slot.manualImageUrl, slot.manualDesk, slot.activeObjectId
      ]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Save slots config error:', err);
    res.status(500).json({ error: 'Failed to save slots configuration. ' + (err.message || '') });
  }
});

// 11b. POST /api/system/settings
app.post('/api/system/settings', async (req, res) => {
  try {
    const s = req.body;
    await dbRun(`
      INSERT OR REPLACE INTO system_settings (
        id, frontpageTitle, frontpageSubtitle, rolePermissions, 
        inTheNewsText, inTheNewsGoogleDocUrl, featuredScholarId, featuredEntryId, 
        editorialSelectionIds, announcementBanner, enableArabicAccent, layoutDensity, 
        allowedSignatureFonts, featuredEssayIds, featuredNoteIds, worldClockHolidaysText, 
        worldClockHolidaysGoogleDocUrl, researchFindingsText, researchFindingsGoogleDocUrl
      ) VALUES (
        'settings-main', ?, ?, ?, 
        ?, ?, ?, ?, 
        ?, ?, ?, ?, 
        ?, ?, ?, ?, 
        ?, ?, ?
      )
    `, [
      s.frontpageTitle, s.frontpageSubtitle, JSON.stringify(s.rolePermissions || {}),
      s.inTheNewsText, s.inTheNewsGoogleDocUrl, s.featuredScholarId, s.featuredEntryId,
      JSON.stringify(s.editorialSelectionIds || []), s.announcementBanner, s.enableArabicAccent ? 1 : 0, s.layoutDensity,
      JSON.stringify(s.allowedSignatureFonts || []), JSON.stringify(s.featuredEssayIds || []), JSON.stringify(s.featuredNoteIds || []), s.worldClockHolidaysText,
      s.worldClockHolidaysGoogleDocUrl, s.researchFindingsText, s.researchFindingsGoogleDocUrl
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error('Save system settings error:', err);
    res.status(500).json({ error: 'Failed to save system settings. ' + (err.message || '') });
  }
});

// 11c. GET /api/translation/configs
app.get('/api/translation/configs', async (req, res) => {
  try {
    let configs = await dbAll("SELECT * FROM translation_configs");
    if (configs.length === 0) {
      const providers = await dbAll("SELECT id FROM ai_providers");
      const defaultProviderId = providers.length > 0 ? providers[0].id : 'gemini-1';
      
      const defaultLangs = [
        { code: 'zh', name: 'Cina', provider: defaultProviderId },
        { code: 'ar', name: 'Arab', provider: defaultProviderId },
        { code: 'en', name: 'Inggeris', provider: defaultProviderId }
      ];
      
      for (const dl of defaultLangs) {
        await dbRun(`
          INSERT INTO translation_configs (languageCode, languageName, providerId, isEnabled, createdAt, updatedAt)
          VALUES (?, ?, ?, 0, ?, ?)
        `, [dl.code, dl.name, dl.provider, new Date().toISOString(), new Date().toISOString()]);
      }
      configs = await dbAll("SELECT * FROM translation_configs");
    }
    res.json(configs);
  } catch (err) {
    console.error('Fetch translation configs error:', err);
    res.status(500).json({ error: 'Failed to fetch translation configurations.' });
  }
});

// 11d. POST /api/translation/configs
app.post('/api/translation/configs', async (req, res) => {
  try {
    const list = req.body;
    for (const item of list) {
      await dbRun(`
        INSERT OR REPLACE INTO translation_configs (languageCode, languageName, providerId, isEnabled, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [item.languageCode, item.languageName, item.providerId, item.isEnabled ? 1 : 0, item.createdAt || new Date().toISOString(), new Date().toISOString()]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Save translation configs error:', err);
    res.status(500).json({ error: 'Failed to save translation configurations.' });
  }
});

// 11e. DELETE /api/translation/configs/:code [NEW]
app.delete('/api/translation/configs/:code', async (req, res) => {
  try {
    const { code } = req.params;
    await dbRun("DELETE FROM translation_configs WHERE languageCode = ?", [code]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete translation config error:', err);
    res.status(500).json({ error: 'Failed to delete translation config.' });
  }
});

// 11f. GET /api/system/ai/statistics [NEW]
app.get('/api/system/ai/statistics', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayStartIso = todayStart.toISOString();

    const usageStats = await dbGet(`
      SELECT 
        COUNT(*) as totalCalls,
        SUM(promptTokens) as promptTokens,
        SUM(completionTokens) as completionTokens,
        SUM(estimatedCost) as estimatedCost
      FROM ai_usage_logs
      WHERE createdAt >= ? AND status = 'SUCCESS'
    `, [todayStartIso]);

    const schedulerSkipped = await dbGet(`
      SELECT COUNT(*) as count FROM pipeline_logs
      WHERE createdAt >= ? AND message LIKE '%Skipped by Scheduler%'
    `, [todayStartIso]);

    const sourceCacheSkipped = await dbGet(`
      SELECT COUNT(*) as count FROM pipeline_logs
      WHERE createdAt >= ? AND message LIKE '%Skipped because Source Cache%'
    `, [todayStartIso]);

    const aiCacheSkipped = await dbGet(`
      SELECT COUNT(*) as count FROM pipeline_logs
      WHERE createdAt >= ? AND (message LIKE '%Skipped because AI Cache%' OR message LIKE '%Cache HIT%')
    `, [todayStartIso]);

    // Calculate dynamic cost saved: estimate $0.005 per saved call (or prompts average)
    const totalCallsSaved = (schedulerSkipped.count || 0) + (sourceCacheSkipped.count || 0) + (aiCacheSkipped.count || 0);
    const estimatedCostSaved = totalCallsSaved * 0.0035;

    res.json({
      today: {
        totalCalls: usageStats.totalCalls || 0,
        schedulerSkipped: schedulerSkipped.count || 0,
        sourceCacheSkipped: sourceCacheSkipped.count || 0,
        aiCacheSkipped: aiCacheSkipped.count || 0,
        promptTokens: usageStats.promptTokens || 0,
        completionTokens: usageStats.completionTokens || 0,
        estimatedCost: parseFloat((usageStats.estimatedCost || 0).toFixed(4)),
        estimatedCostSaved: parseFloat(estimatedCostSaved.toFixed(4)),
        currency: 'USD'
      }
    });
  } catch (err) {
    console.error('Fetch AI statistics error:', err);
    res.status(500).json({ error: 'Failed to fetch AI usage statistics.' });
  }
});

// 11g. GET /api/system/ai/breakdown [NEW]
app.get('/api/system/ai/breakdown', async (req, res) => {
  try {
    const providerBreakdown = await dbAll(`
      SELECT providerId as provider, COUNT(*) as calls, SUM(estimatedCost) as cost
      FROM ai_usage_logs
      WHERE status = 'SUCCESS'
      GROUP BY providerId
    `);

    const modelBreakdown = await dbAll(`
      SELECT providerId, modelName, COUNT(*) as calls, SUM(estimatedCost) as cost, SUM(totalTokens) as tokens, AVG(latencyMs) as avgLatency
      FROM ai_usage_logs
      WHERE status = 'SUCCESS'
      GROUP BY providerId, modelName
    `);

    const capabilityBreakdown = await dbAll(`
      SELECT capability, COUNT(*) as calls, SUM(estimatedCost) as cost, SUM(totalTokens) as tokens, AVG(latencyMs) as avgLatency
      FROM ai_usage_logs
      WHERE status = 'SUCCESS'
      GROUP BY capability
    `);

    const latestCalls = await dbAll(`
      SELECT * FROM ai_usage_logs
      ORDER BY createdAt DESC
      LIMIT 10
    `);

    const history30Days = await dbAll(`
      SELECT date(createdAt) as date, SUM(estimatedCost) as cost, COUNT(*) as calls, SUM(totalTokens) as tokens
      FROM ai_usage_logs
      WHERE status = 'SUCCESS'
      GROUP BY date(createdAt)
      ORDER BY date(createdAt) ASC
      LIMIT 30
    `);

    res.json({
      providerBreakdown,
      modelBreakdown,
      capabilityBreakdown,
      latestCalls,
      history30Days
    });
  } catch (err) {
    console.error('Fetch AI breakdown error:', err);
    res.status(500).json({ error: 'Failed to fetch AI breakdown data.' });
  }
});

// 11h. GET /api/system/ai/pricing [NEW]
app.get('/api/system/ai/pricing', async (req, res) => {
  try {
    const pricing = await dbAll("SELECT * FROM ai_model_pricing");
    res.json(pricing);
  } catch (err) {
    console.error('Fetch pricing error:', err);
    res.status(500).json({ error: 'Failed to fetch AI model pricing.' });
  }
});

// 11i. POST /api/system/ai/pricing [NEW]
app.post('/api/system/ai/pricing', async (req, res) => {
  try {
    const items = req.body;
    const list = Array.isArray(items) ? items : [items];
    for (const item of list) {
      await dbRun(`
        INSERT OR REPLACE INTO ai_model_pricing (providerId, modelName, inputCostPerMillion, outputCostPerMillion, currency, updatedAt)
        VALUES (?, ?, ?, ?, 'USD', ?)
      `, [item.providerId, item.modelName, parseFloat(item.inputCostPerMillion || 0), parseFloat(item.outputCostPerMillion || 0), new Date().toISOString()]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Save pricing error:', err);
    res.status(500).json({ error: 'Failed to save AI model pricing.' });
  }
});

// 12. GET /api/ai/logs
app.get('/api/ai/logs', async (req, res) => {
  try {
    const logs = await dbAll("SELECT * FROM pipeline_logs ORDER BY createdAt DESC LIMIT 100");
    res.json(logs);
  } catch (err) {
    console.error('Fetch pipeline logs error:', err);
    res.status(500).json({ error: 'Failed to fetch pipeline logs.' });
  }
});

// Start Express Server
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API server running on http://localhost:${PORT}`);
});
