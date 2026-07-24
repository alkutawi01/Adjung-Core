import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import EditorialPipeline from './core/editorial/EditorialPipeline.js';
import PresentationComposer from './core/presentation/PresentationComposer.js';
import CategoryRegistry from './core/category/CategoryRegistry.js';
import { validateContentBudget } from './core/editorial/ContentBudget.js';
import { safeJsonParse } from './core/utils/jsonUtils.js';
import { detectSourceType } from './core/editorial/SourceDetector.js';
import { createAIRoutes } from './core/routes/aiRoutes.js';
import { createCategoryRoutes } from './core/routes/categoryRoutes.js';
import { createSystemRoutes } from './core/routes/systemRoutes.js';
import { createSlotRoutes, executeDirectRssFetch } from './core/routes/slotRoutes.js';
const mockDb = {};

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
      `, (errSys) => {
        if (errSys) return reject(errSys);
        db.run(`
          CREATE TABLE IF NOT EXISTS rss_editorial_settings (
            id TEXT PRIMARY KEY,
            autoLiveThreshold INTEGER DEFAULT 80,
            reviewThreshold INTEGER DEFAULT 60,
            priorityKeywords TEXT,
            blockedKeywords TEXT,
            priorityBonus INTEGER DEFAULT 15,
            blockedPenalty INTEGER DEFAULT 40,
            updatedAt TEXT
          )
        `, (errRssSet) => {
          if (errRssSet) reject(errRssSet);
          else {
            db.run("ALTER TABLE rss_ticker_items ADD COLUMN formattedBrief TEXT;", () => {});
            db.run("ALTER TABLE rss_ticker_items ADD COLUMN scoreBreakdown TEXT;", () => {});
            db.run("ALTER TABLE rss_ticker_items ADD COLUMN decision TEXT;", () => {});
            db.run("ALTER TABLE rss_ticker_items ADD COLUMN deskBreakdown TEXT;", () => {});
            db.run("ALTER TABLE rss_ticker_items ADD COLUMN secondaryDesk TEXT;", () => {});
            db.run("ALTER TABLE rss_ticker_items ADD COLUMN secondaryScore INTEGER DEFAULT 0;", () => {});
            db.run("ALTER TABLE rss_ticker_items ADD COLUMN rawCategory TEXT;", () => {});
            db.run("ALTER TABLE rss_editorial_settings ADD COLUMN maxNewsAgeHours INTEGER DEFAULT 48;", () => {});
            db.run("ALTER TABLE rss_editorial_settings ADD COLUMN tickerMaxItems INTEGER DEFAULT 20;", () => {});

            db.run(`
              CREATE TABLE IF NOT EXISTS rss_editorial_memory (
                id TEXT PRIMARY KEY,
                rssItemId TEXT,
                phraseExtracted TEXT NOT NULL,
                suggestedDesk TEXT NOT NULL,
                occurrenceCount INTEGER DEFAULT 1,
                status TEXT DEFAULT 'pending',
                createdAt TEXT
              )
            `, () => {});

            db.run(`
              CREATE TABLE IF NOT EXISTS rss_global_exclusion_rules (
                id TEXT PRIMARY KEY,
                keyword TEXT NOT NULL UNIQUE,
                penaltyWeight INTEGER DEFAULT 45,
                targetDesksExcluded TEXT DEFAULT 'Sains & Teknologi,Ekonomi,Pendidikan,Kesihatan',
                enabled INTEGER DEFAULT 1,
                createdAt TEXT
              )
            `, () => {});

            db.run(`
              CREATE TABLE IF NOT EXISTS rss_blocked_categories (
                id TEXT PRIMARY KEY,
                categoryName TEXT NOT NULL UNIQUE,
                enabled INTEGER DEFAULT 1,
                createdAt TEXT
              )
            `, () => {});

            db.run(`
              CREATE TABLE IF NOT EXISTS adjung_typography_rules (
                id TEXT PRIMARY KEY,
                term TEXT NOT NULL,
                style TEXT DEFAULT 'italic',
                category TEXT DEFAULT 'foreign_term',
                matchType TEXT DEFAULT 'word',
                scope TEXT DEFAULT 'all',
                language TEXT DEFAULT 'ms-MY',
                caseSensitive INTEGER DEFAULT 0,
                priority INTEGER DEFAULT 50,
                status TEXT DEFAULT 'active',
                enabled INTEGER DEFAULT 1,
                excludeTerms TEXT,
                ruleVersion INTEGER DEFAULT 1,
                createdBy TEXT DEFAULT 'Chief Editor',
                createdAt TEXT,
                updatedAt TEXT,
                UNIQUE(term, language, scope)
              )
            `, () => {});
            
            db.run(`
              CREATE TABLE IF NOT EXISTS rss_text_rules (
                id TEXT PRIMARY KEY,
                ruleName TEXT NOT NULL,
                ruleType TEXT NOT NULL,
                scope TEXT DEFAULT 'brief',
                sourceId TEXT NULL,
                pattern TEXT,
                replacement TEXT,
                enabled INTEGER DEFAULT 1,
                locked INTEGER DEFAULT 0,
                orderIndex INTEGER DEFAULT 10,
                createdAt TEXT
              )
            `, () => {
              const now = new Date().toISOString();
              db.run(`INSERT OR IGNORE INTO rss_text_rules (id, ruleName, ruleType, scope, sourceId, pattern, replacement, enabled, locked, orderIndex, createdAt) VALUES 
                ('rule-sys-1', 'Decode HTML Entities', 'decode_entities', 'all', NULL, '', '', 1, 1, 1, ?),
                ('rule-sys-2', 'Remove HTML Tags', 'regex', 'all', NULL, '<[^>]*>', ' ', 1, 1, 2, ?),
                ('rule-sys-3', 'Normalize Whitespace', 'regex', 'all', NULL, '\\s+', ' ', 1, 1, 3, ?),
                ('rule-sys-4', 'Buang Awalan Lokasi (Dateline)', 'strip_dateline', 'brief', NULL, '', '', 1, 0, 4, ?)
              `, [now, now, now, now], () => {
                db.run(`
                  CREATE TABLE IF NOT EXISTS adjung_desks (
                    id TEXT PRIMARY KEY,
                    deskName TEXT NOT NULL UNIQUE,
                    description TEXT,
                    displayOrder INTEGER DEFAULT 10,
                    enabled INTEGER DEFAULT 1,
                    locked INTEGER DEFAULT 0,
                    createdAt TEXT
                  )
                `, () => {
                  db.run(`
                    CREATE TABLE IF NOT EXISTS rss_desk_rules (
                      id TEXT PRIMARY KEY,
                      deskId TEXT NOT NULL,
                      keyword TEXT NOT NULL,
                      weight INTEGER DEFAULT 15,
                      isNegative INTEGER DEFAULT 0,
                      enabled INTEGER DEFAULT 1,
                      orderIndex INTEGER DEFAULT 10,
                      createdAt TEXT
                    )
                  `, () => {
                    const seedDesks = [
                      ['desk-dip-1', 'Diplomasi', 'Hal ehwal diplomasi, ASEAN, PBB, & hubungan antarabangsa', 1],
                      ['desk-eko-2', 'Ekonomi', 'Kewangan, inflasi, Bank Negara, pasaran, & pelaburan', 2],
                      ['desk-nas-3', 'Nasional', 'Dasar kerajaan, parlimen, kabinet, & hal ehwal pentadbiran', 3],
                      ['desk-pol-4', 'Politik', 'Pilihan raya, parti politik, & dinamika kepimpinan', 4],
                      ['desk-tek-5', 'Sains & Teknologi', 'Kecerdasan buatan (AI), angkasa, inovasi, & digital', 5],
                      ['desk-kes-6', 'Kesihatan', 'Hospital, KKM, ubat-ubatan, & kesihatan awam', 6],
                      ['desk-pen-7', 'Pendidikan', 'Universiti, sekolah, KPM, KPT, & pembangunan modal insan', 7],
                      ['desk-ala-8', 'Alam Sekitar', 'Perubahan iklim, banjir, isu alam sekitar, & kelestarian', 8],
                      ['desk-bud-9', 'Budaya & Warisan', 'Kesenian, sastera, sejarah, & khazanah warisan', 9],
                      ['desk-mas-10', 'Masyarakat', 'Komuniti, kebajikan, bantuan, & kerja kemasyarakatan', 10],
                      ['desk-suk-11', 'Sukan', 'Bola sepak, kejohanan, atlet negara, & sukan dunia', 11],
                      ['desk-sem-12', 'Semasa', 'Berita am & isu semasa', 12]
                    ];

                    const seedRules = [
                      // Diplomasi
                      ['rule-dip-1', 'desk-dip-1', 'asean', 30, 0, 1],
                      ['rule-dip-2', 'desk-dip-1', 'pbb', 30, 0, 2],
                      ['rule-dip-3', 'desk-dip-1', 'bilateral', 25, 0, 3],
                      ['rule-dip-4', 'desk-dip-1', 'hubungan luar', 25, 0, 4],
                      ['rule-dip-5', 'desk-dip-1', 'duta', 20, 0, 5],
                      ['rule-dip-6', 'desk-dip-1', 'lawatan rasmi', 20, 0, 6],
                      // Ekonomi (Aliasi: BNM, Bursa, KWSP, EPF, LHDN, SST, GST)
                      ['rule-eko-1', 'desk-eko-2', 'bnm', 45, 0, 1],
                      ['rule-eko-2', 'desk-eko-2', 'bursa', 40, 0, 2],
                      ['rule-eko-3', 'desk-eko-2', 'kwsp', 40, 0, 3],
                      ['rule-eko-4', 'desk-eko-2', 'epf', 40, 0, 4],
                      ['rule-eko-5', 'desk-eko-2', 'lhdn', 40, 0, 5],
                      ['rule-eko-6', 'desk-eko-2', 'ringgit', 30, 0, 6],
                      ['rule-eko-7', 'desk-eko-2', 'inflasi', 30, 0, 7],
                      ['rule-eko-8', 'desk-eko-2', 'bank negara', 30, 0, 8],
                      ['rule-eko-9', 'desk-eko-2', 'pelaburan', 25, 0, 9],
                      ['rule-eko-10', 'desk-eko-2', 'kewangan', 20, 0, 10],
                      // Nasional (Aliasi: PDRM, ATM, MKN, JPJ, JPN, KDN)
                      ['rule-nas-1', 'desk-nas-3', 'pdrm', 45, 0, 1],
                      ['rule-nas-2', 'desk-nas-3', 'atm', 40, 0, 2],
                      ['rule-nas-3', 'desk-nas-3', 'mkn', 40, 0, 3],
                      ['rule-nas-4', 'desk-nas-3', 'jpj', 40, 0, 4],
                      ['rule-nas-5', 'desk-nas-3', 'jpn', 40, 0, 5],
                      ['rule-nas-6', 'desk-nas-3', 'kdn', 40, 0, 6],
                      ['rule-nas-7', 'desk-nas-3', 'pasport', 35, 0, 7],
                      ['rule-nas-8', 'desk-nas-3', 'imigresen', 35, 0, 8],
                      ['rule-nas-9', 'desk-nas-3', 'mahkamah', 35, 0, 9],
                      ['rule-nas-10', 'desk-nas-3', 'polis', 30, 0, 10],
                      ['rule-nas-11', 'desk-nas-3', 'tahan', 25, 0, 11],
                      ['rule-nas-12', 'desk-nas-3', 'dakwa', 30, 0, 12],
                      ['rule-nas-13', 'desk-nas-3', 'kerajaan', 20, 0, 13],
                      // Sains & Teknologi (Positif + Negative Exclusion Rules)
                      ['rule-tek-1', 'desk-tek-5', 'ai', 35, 0, 1],
                      ['rule-tek-2', 'desk-tek-5', 'kecerdasan buatan', 35, 0, 2],
                      ['rule-tek-3', 'desk-tek-5', 'angkasa', 30, 0, 3],
                      ['rule-tek-4', 'desk-tek-5', 'satelit', 25, 0, 4],
                      ['rule-tek-5', 'desk-tek-5', 'teknologi', 20, 0, 5],
                      ['rule-tek-6', 'desk-tek-5', 'pasport', 50, 1, 6],
                      ['rule-tek-7', 'desk-tek-5', 'polis', 40, 1, 7],
                      ['rule-tek-8', 'desk-tek-5', 'mahkamah', 40, 1, 8],
                      ['rule-tek-9', 'desk-tek-5', 'imigresen', 40, 1, 9],
                      // Sukan
                      ['rule-suk-1', 'desk-suk-11', 'atlet', 40, 0, 1],
                      ['rule-suk-2', 'desk-suk-11', 'pingat', 35, 0, 2],
                      ['rule-suk-3', 'desk-suk-11', 'kejohanan', 30, 0, 3],
                      ['rule-suk-4', 'desk-suk-11', 'bola sepak', 30, 0, 4],
                      ['rule-suk-5', 'desk-suk-11', 'badminton', 30, 0, 5],
                      // Kesihatan (Aliasi: KKM, MOH)
                      ['rule-kes-1', 'desk-kes-6', 'kkm', 45, 0, 1],
                      ['rule-kes-2', 'desk-kes-6', 'moh', 40, 0, 2],
                      ['rule-kes-3', 'desk-kes-6', 'hospital', 40, 0, 3],
                      ['rule-kes-4', 'desk-kes-6', 'pesakit', 35, 0, 4],
                      ['rule-kes-5', 'desk-kes-6', 'doktor', 35, 0, 5],
                      ['rule-kes-6', 'desk-kes-6', 'klinik', 35, 0, 6],
                      ['rule-kes-7', 'desk-kes-6', 'vaksin', 40, 0, 7],
                      ['rule-kes-8', 'desk-kes-6', 'penyakit', 35, 0, 8],
                      ['rule-kes-9', 'desk-kes-6', 'rawatan', 35, 0, 9],
                      // Pendidikan (Aliasi: KPM, KPT, IPT, IPTA, IPTS, SPM, STPM)
                      ['rule-pen-1', 'desk-pen-7', 'kpm', 40, 0, 1],
                      ['rule-pen-2', 'desk-pen-7', 'kpt', 40, 0, 2],
                      ['rule-pen-3', 'desk-pen-7', 'ipt', 40, 0, 3],
                      ['rule-pen-4', 'desk-pen-7', 'ipta', 40, 0, 4],
                      ['rule-pen-5', 'desk-pen-7', 'ipts', 40, 0, 5],
                      ['rule-pen-6', 'desk-pen-7', 'universiti', 45, 0, 6],
                      ['rule-pen-7', 'desk-pen-7', 'sekolah', 38, 0, 7],
                      ['rule-pen-8', 'desk-pen-7', 'pelajar', 30, 0, 8],
                      ['rule-pen-9', 'desk-pen-7', 'guru', 35, 0, 9],
                      ['rule-pen-10', 'desk-pen-7', 'spm', 40, 0, 10],
                      ['rule-pen-11', 'desk-pen-7', 'stpm', 40, 0, 11],
                      // Alam Sekitar
                      ['rule-sek-1', 'desk-sek-8', 'banjir', 45, 0, 1],
                      ['rule-sek-2', 'desk-sek-8', 'pencemaran', 45, 0, 2],
                      ['rule-sek-3', 'desk-sek-8', 'iklim', 45, 0, 3],
                      ['rule-sek-4', 'desk-sek-8', 'sungai', 40, 0, 4],
                      ['rule-sek-5', 'desk-sek-8', 'hutan', 40, 0, 5],
                      ['rule-sek-6', 'desk-sek-8', 'air', 35, 0, 6],
                      // Masyarakat (Aliasi: JAKIM, MAIK, JAWHAR, MAIWP)
                      ['rule-mas-1', 'desk-mas-10', 'jakim', 40, 0, 1],
                      ['rule-mas-2', 'desk-mas-10', 'maik', 40, 0, 2],
                      ['rule-mas-3', 'desk-mas-10', 'jawhar', 40, 0, 3],
                      ['rule-mas-4', 'desk-mas-10', 'maiwp', 40, 0, 4],
                      ['rule-mas-5', 'desk-mas-10', 'bantuan', 40, 0, 5],
                      ['rule-mas-6', 'desk-mas-10', 'kebajikan', 40, 0, 6],
                      ['rule-mas-7', 'desk-mas-10', 'penduduk', 35, 0, 7],
                      ['rule-mas-8', 'desk-mas-10', 'komuniti', 35, 0, 8],
                      ['rule-mas-9', 'desk-mas-10', 'rakyat', 20, 0, 9]
                    ];

                    const seedGlobalExclusions = [
                      ['gex-1', 'mahkamah', 50, 'Sains & Teknologi,Ekonomi,Pendidikan,Kesihatan,Alam Sekitar'],
                      ['gex-2', 'polis', 45, 'Sains & Teknologi,Ekonomi,Pendidikan,Kesihatan,Alam Sekitar'],
                      ['gex-3', 'dakwa', 45, 'Sains & Teknologi,Ekonomi,Pendidikan,Kesihatan,Alam Sekitar'],
                      ['gex-4', 'tahanan', 45, 'Sains & Teknologi,Ekonomi,Pendidikan,Kesihatan,Alam Sekitar'],
                      ['gex-5', 'siasatan', 40, 'Sains & Teknologi,Ekonomi,Pendidikan,Kesihatan,Alam Sekitar']
                    ];

                    seedGlobalExclusions.forEach(([id, kw, pen, target]) => {
                      db.run(`INSERT OR IGNORE INTO rss_global_exclusion_rules (id, keyword, penaltyWeight, targetDesksExcluded, enabled, createdAt) VALUES (?, ?, ?, ?, 1, ?)`, [id, kw, pen, target, now]);
                    });

                    const seedBlockedCategories = [
                      ['blk-1', 'Hiburan'],
                      ['blk-2', 'Gaya'],
                      ['blk-3', 'Sensasi'],
                      ['blk-4', 'Hiburan & Selebriti'],
                      ['blk-5', 'Gossip']
                    ];

                    seedBlockedCategories.forEach(([id, catName]) => {
                      db.run(`INSERT OR IGNORE INTO rss_blocked_categories (id, categoryName, enabled, createdAt) VALUES (?, ?, 1, ?)`, [id, catName, now]);
                    });

                    const seedTypographyRules = [
                      ['typo-1', 'scammer', 'italic', 'foreign_term', 'word', 'all', 'ms-MY', 0, 50, 'active', 1, null],
                      ['typo-2', 'phishing', 'italic', 'foreign_term', 'word', 'all', 'ms-MY', 0, 50, 'active', 1, null],
                      ['typo-3', 'deepfake', 'italic', 'foreign_term', 'word', 'all', 'ms-MY', 0, 50, 'active', 1, null],
                      ['typo-4', 'cyberbullying', 'italic', 'foreign_term', 'word', 'all', 'ms-MY', 0, 50, 'active', 1, null],
                      ['typo-5', 'startup', 'italic', 'foreign_term', 'word', 'all', 'ms-MY', 0, 50, 'pending', 0, JSON.stringify(["Startup Malaysia"])],
                      ['typo-6', 'freelancer', 'italic', 'foreign_term', 'word', 'all', 'ms-MY', 0, 50, 'pending', 0, null]
                    ];

                    seedTypographyRules.forEach(([id, term, style, category, matchType, scope, lang, cs, prio, status, en, excl]) => {
                      db.run(`
                        INSERT OR IGNORE INTO adjung_typography_rules (
                          id, term, style, category, matchType, scope, language, caseSensitive, priority, status, enabled, excludeTerms, ruleVersion, createdBy, createdAt, updatedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Chief Editor', ?, ?)
                      `, [id, term, style, category, matchType, scope, lang, cs, prio, status, en, excl, now, now]);
                    });

                    seedDesks.forEach(([id, name, desc, order]) => {
                      db.run(`INSERT OR IGNORE INTO adjung_desks (id, deskName, description, displayOrder, enabled, locked, createdAt) VALUES (?, ?, ?, ?, 1, 0, ?)`, [id, name, desc, order, now]);
                    });

                    seedRules.forEach(([id, deskId, kw, weight, neg, order]) => {
                      db.run(`INSERT OR IGNORE INTO rss_desk_rules (id, deskId, keyword, weight, isNegative, enabled, orderIndex, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`, [id, deskId, kw, weight, neg, order, now]);
                    });

                    initEditorialOS(db).then(resolve).catch(reject);
                  });
                });
              });
            });
          }
        });
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
                // Verified against https://ai.google.dev/gemini-api/docs/pricing — the previous
                // 0.075/0.30 values here were Gemini 1.5 Flash's old rate, not this model's real
                // price (1.50/9.00), and silently understated every cost estimate by ~20-30x.
                stmtPricing.run('gemini-1', 'gemini-3.5-flash', 1.50, 9.00, nowStr);
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
            // Seed publisher directory
            await new Promise((resPubs, rejPubs) => {
              db.serialize(() => {
                const stmtPubs = db.prepare(`
                  INSERT OR IGNORE INTO publisher_directory (id, publisherName, domainPattern, isOfficial, authorityScore, defaultGlyphProfile, defaultDesk)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                const seedPublishers = [
                  { id: 'nasa', name: 'NASA', domain: 'nasa.gov', official: 1, authority: 100, glyph: 'archaeology', desk: 'archaeology' },
                  { id: 'astro-awani', name: 'Astro Awani', domain: 'astroawani.com', official: 1, authority: 80, glyph: 'local-news', desk: 'news' },
                  { id: 'bernama', name: 'Bernama', domain: 'bernama.com', official: 1, authority: 90, glyph: 'local-news', desk: 'news' },
                  { id: 'reuters', name: 'Reuters', domain: 'reuters.com', official: 1, authority: 95, glyph: 'world-news', desk: 'world' },
                  { id: 'bbc', name: 'BBC News', domain: 'bbc.co.uk', official: 1, authority: 90, glyph: 'world-news', desk: 'world' },
                  { id: 'nature', name: 'Nature', domain: 'nature.com', official: 1, authority: 100, glyph: 'science', desk: 'science' }
                ];
                for (const p of seedPublishers) {
                  stmtPubs.run(p.id, p.name, p.domain, p.official, p.authority, p.glyph, p.desk);
                }
                stmtPubs.finalize((errPubs) => errPubs ? rejPubs(errPubs) : resPubs());
              });
            });

            // Seed RSS Direct Sources
            await new Promise((resRss, rejRss) => {
              db.serialize(() => {
                const stmtRss = db.prepare(`
                  INSERT OR IGNORE INTO rss_sources_registry (id, sourceName, rssUrl, language, trustScore, edition, categoryMapping, enabled, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
                `);
                const nowStr = new Date().toISOString();
                stmtRss.run('rss-kosmo', 'Kosmo Digital', 'https://www.kosmo.com.my/feed/', 'ms-MY', 90, 'Malaysia', 'BERITA UTAMA', nowStr);
                stmtRss.run('rss-utusan', 'Utusan Malaysia', 'https://www.utusan.com.my/feed/', 'ms-MY', 95, 'Malaysia', 'BERITA UTAMA', nowStr);
                stmtRss.run('rss-metro', 'Harian Metro', 'https://www.hmetro.com.my/mutakhir.xml', 'ms-MY', 90, 'Malaysia', 'MUTAKHIR', nowStr);
                stmtRss.run('rss-bernama', 'Bernama', 'https://www.bernama.com/bm/rss/news.php', 'ms-MY', 95, 'Malaysia', 'TERKINI', nowStr);
                stmtRss.finalize((errRss) => errRss ? rejRss(errRss) : resRss());
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
        'settings-main', 'Adjung Mini Portal', 'Tetapan Portal', '{}', 
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
      masterPrompt: settingsRow.masterPrompt || ''
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
      const modelToUse = provider.model || 'gemini-3.5-flash';
      console.log(`[Gemini API Call via legacy server.js]`);
      console.log(`- Request Reason: ${capability}`);
      console.log(`- Resolved Model Name: ${modelToUse}`);
      if (!provider.model) {
        console.log(`- Fallback Triggered: Model name was not provided. Falling back to default model: gemini-3.5-flash`);
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
      responseText = response.text.trim();
      parsedJson = JSON.parse(responseText);
      
      if (response.usageMetadata) {
        promptTokens = response.usageMetadata.promptTokenCount || 0;
        completionTokens = response.usageMetadata.candidatesTokenCount || 0;
      }
      console.log(`[Gemini API Usage via legacy server.js]`);
      console.log(`- Prompt Tokens: ${promptTokens}`);
      console.log(`- Completion Tokens: ${completionTokens}`);
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
      INSERT INTO ai_usage_logs (runId, providerId, modelName, capability, promptTokens, completionTokens, totalTokens, estimatedCost, currency, latencyMs, status, createdAt, promptText, responseText)
      VALUES (?, ?, ?, ?, ?, 0, ?, 0, 'USD', ?, 'FAILED', ?, ?, ?)
    `, [runId, provider.id, provider.model || 'unknown', capability, promptTokens, promptTokens, latencyMs, new Date().toISOString(), prompt, err.message]).catch(() => {});
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
    INSERT INTO ai_usage_logs (runId, providerId, modelName, capability, promptTokens, completionTokens, totalTokens, estimatedCost, currency, latencyMs, status, createdAt, promptText, responseText)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, 'SUCCESS', ?, ?, ?)
  `, [runId, provider.id, provider.model, capability, promptTokens, completionTokens, totalTokens, estimatedCost, latencyMs, new Date().toISOString(), prompt, responseText]).catch(() => {});

  return parsedJson;
};

const calculateNextRunTime = (slot) => {
  const rate = slot.refreshRate || 'Daily';
  const targetHourStr = slot.refreshHour || '00:00';
  const [hour, minute] = targetHourStr.split(':').map(Number);
  
  const now = new Date();
  let nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute || 0, 0, 0);
  
  if (rate === 'Weekly') {
    const dayNames = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
    const targetDayStr = slot.refreshDay || 'Isnin';
    let targetDayIndex = dayNames.indexOf(targetDayStr);
    if (targetDayIndex === -1) targetDayIndex = 1; // Default to Isnin
    
    let currentDayIndex = now.getDay();
    let daysToAdd = (targetDayIndex - currentDayIndex + 7) % 7;
    
    if (daysToAdd === 0 && nextDate.getTime() <= now.getTime()) {
      daysToAdd = 7;
    }
    
    nextDate.setDate(nextDate.getDate() + daysToAdd);
  } else {
    // Daily
    if (nextDate.getTime() <= now.getTime()) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
  }
  
  return nextDate.getTime();
};

const runEditorialPipeline = async (slotIndex, runId = null, bypassCache = false) => {
  const timestamp = new Date().toISOString();
  const currentRunId = runId || `run-${Date.now()}`;

  const slot = await dbGet("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [slotIndex]);
  if (!slot || slot.contentMode !== 'AI Generated') return null;

  // Rekod masa cubaan berjalan (lastAttemptAt) segera
  await dbRun("UPDATE slots_config SET lastAttemptAt = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [timestamp, slotIndex]);

  try {
    const provider = await dbGet("SELECT * FROM ai_providers WHERE id = ?", [slot.providerId]);
    if (!provider) {
      throw new Error('AI Provider not configured.');
    }

    const globalPrompt = process.env.GLOBAL_PROMPT_PREFIX || 'Anda adalah editor kandungan profesional.';
    const campaignPrompt = process.env.EDITORIAL_CAMPAIGN || 'Fokus kepada kandungan terkini.';

    // Panggil enjin pipeline modular teras
    const result = await EditorialPipeline.runSlotPipeline(
      db,
      slot,
      provider,
      globalPrompt,
      campaignPrompt,
      currentRunId,
      bypassCache
    );

    const nextRun = calculateNextRunTime(slot);

    if (result.status === 'SKIPPED_CACHE') {
      const logMessage = result.message || 'Skipped: Kandungan sumber tidak berubah.';
      await dbRun(`
        UPDATE slots_config 
        SET nextRunAt = ?, lastSuccessfulRunAt = ?, lastRunStatus = 'CACHE_HIT', lastRunMessage = ? 
        WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?
      `, [nextRun, timestamp, logMessage, slotIndex]);

      await dbRun(`
        INSERT INTO pipeline_logs (createdAt, level, promptVersion, layoutTemplateId, slotIndex, message, runId)
        VALUES (?, 'INFO', '1.0', 'frontpage', ?, ?, ?)
      `, [timestamp, slotIndex, logMessage, currentRunId]);

      return { status: 'CACHE_HIT' };
    }

    // Penjanaan Berjaya (Success)
    const logMsg = `Successfully generated Editorial Object ${result.objectId} using ${provider.name}`;
    await dbRun(`
      UPDATE slots_config 
      SET nextRunAt = ?, lastSuccessfulRunAt = ?, lastRunStatus = 'SUCCESS', lastRunMessage = ? 
      WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?
    `, [nextRun, timestamp, logMsg, slotIndex]);

    await dbRun(`
      INSERT INTO pipeline_logs (createdAt, level, promptVersion, layoutTemplateId, slotIndex, message, runId)
      VALUES (?, 'SUCCESS', '1.0', 'frontpage', ?, ?, ?)
    `, [timestamp, slotIndex, logMsg, currentRunId]);

    // Jalankan Terjemahan Automatik jika ada
    const translationConfigs = await dbAll("SELECT * FROM translation_configs WHERE isEnabled = 1");
    for (const tConfig of translationConfigs) {
      const translatorProvider = await dbGet("SELECT * FROM ai_providers WHERE id = ?", [tConfig.providerId]);
      if (translatorProvider) {
        try {
          const transPrompt = `
            Terjemah tajuk dan ringkasan kandungan di bawah dari Bahasa Melayu ke ${tConfig.languageName} (${tConfig.languageCode}).
            
            Tajuk Asal: ${result.title}
            Ringkasan Asal: ${result.summary}
            
            Syarat Terjemahan:
            1. Terjemah secara profesional.
            2. Had saiz tajuk terjemahan mestilah di bawah 115 aksara.
            3. Had saiz ringkasan terjemahan mestilah di bawah 240 aksara.
            4. Hasilkan respons dalam format JSON sahaja dengan struktur:
               { "title": "Tajuk Terjemahan", "summary": "Ringkasan Terjemahan" }
          `;
          
          let translatorInstance;
          const transApiKey = process.env[translatorProvider.secretName] || '';
          if (transApiKey) {
            if (translatorProvider.id.includes('gemini')) {
              const GeminiProvider = (await import('./core/ai/GeminiProvider.js')).default;
              translatorInstance = new GeminiProvider(transApiKey, translatorProvider.model);
            } else if (translatorProvider.id.includes('claude')) {
              const ClaudeProvider = (await import('./core/ai/ClaudeProvider.js')).default;
              translatorInstance = new ClaudeProvider(transApiKey, translatorProvider.model);
            }

            if (translatorInstance) {
              const transResult = await translatorInstance.generate(transPrompt, 'Anda adalah penterjemah profesional.');
              const transTitle = transResult.parsedJson.title || '';
              const transSummary = transResult.parsedJson.summary || '';

              if (transTitle && transSummary) {
                await dbRun(`
                  INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
                  VALUES (?, 1.0, ?, ?, ?, 'approved', ?, ?, ?)
                `, [result.objectId, tConfig.languageCode, transTitle, transSummary, `translator-${tConfig.languageCode}`, timestamp, timestamp]);
              }
            }
          }
        } catch (tErr) {
          console.error(`Translation failed for language ${tConfig.languageCode}:`, tErr);
        }
      }
    }

    return { objectId: result.objectId, status: 'SUCCESS' };

  } catch (error) {
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

// Menjalankan semua slot 'AI Generated' yang layak (nextRunAt sudah lepas, atau force=true).
// Dipanggil oleh endpoint manual /api/system/pipeline/run DAN oleh scheduler dalaman automatik
// (lihat setInterval berhampiran app.listen) supaya "Kadar Segar Semula" (Daily/Weekly + jam)
// yang ditetapkan Izzat di Mini Editorium benar-benar tercetus tanpa perlu klik "Aktifkan Segera".
const runAllScheduledSlots = async (force = false) => {
  const currentRunId = `run-${Date.now()}`;
  const timestamp = new Date().toISOString();

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

    try {
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
    } catch (slotErr) {
      console.error(`Error running pipeline for slot ${slot.slotIndex}:`, slotErr);
      results.push({ slotIndex: slot.slotIndex, error: slotErr.message || 'Unknown error', status: 'FAILED' });
    }
  }

  const statsMessage = `Pipeline completed. Total: ${processedCount}, Scheduler Skip: ${skippedByScheduler}, AI Cache Skip: ${skippedByAiCache}, Actual AI calls: ${actualAiCalls}`;
  await dbRun(`
    INSERT INTO pipeline_logs (createdAt, level, promptVersion, layoutTemplateId, slotIndex, message, runId)
    VALUES (?, 'INFO', '1.0', 'frontpage', -1, ?, ?)
  `, [timestamp, statsMessage, currentRunId]);

  return {
    runId: currentRunId,
    results,
    stats: { processed: processedCount, skippedByScheduler, skippedByAiCache, actualAiCalls }
  };
};

// POST /api/system/pipeline/run
app.post('/api/system/pipeline/run', async (req, res) => {
  const currentRunId = `run-${Date.now()}`;

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
      const { runId, results, stats } = await runAllScheduledSlots(force);
      return res.json({ success: true, runId, results, stats });
    }
  } catch (err) {
    console.error('Run pipeline error:', err);
    res.status(500).json({ error: 'Failed to run editorial pipeline. ' + (err.message || '') });
  }
});

// POST /api/system/pipeline/batch_paste
app.post('/api/system/pipeline/batch_paste', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text content is empty.' });
    }

    let parsedItems = [];

    // 1. Try direct JSON parsing
    try {
      const rawJson = text.trim();
      const data = JSON.parse(rawJson);
      parsedItems = Array.isArray(data) ? data : [data];
    } catch (e) {
      // 2. Try to extract JSON blocks
      const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g;
      let match;
      while ((match = jsonBlockRegex.exec(text)) !== null) {
        try {
          const data = JSON.parse(match[1].trim());
          if (Array.isArray(data)) parsedItems.push(...data);
          else parsedItems.push(data);
        } catch (e2) {}
      }
    }

    // 3. Fallback Regex Parsing (untuk teks biasa berbilang kandungan per slot)
    if (parsedItems.length === 0) {
      const slotBlocks = text.split(/(?:Slot\s*#?\s*|SlotIndex\s*[:=]?\s*)(\d+)/i);
      for (let idx = 1; idx < slotBlocks.length; idx += 2) {
        const slotNum = parseInt(slotBlocks[idx], 10) - 1; // Tukar kepada 0-based
        const blockContent = slotBlocks[idx + 1] || '';

        // Pecahkan mengikut pembahagi --- atau ___ atau lookahead "Tajuk"
        const articleBlocks = blockContent.split(/(?:---|___)+/).flatMap(b => b.split(/(?=Tajuk\s*[:=])/i));
        
        for (const artBlock of articleBlocks) {
          if (!artBlock.trim()) continue;

          const titleMatch = artBlock.match(/(?:Tajuk)\s*[:=]?\s*([^\n]+)/i);
          const summaryMatch = artBlock.match(/(?:Summary|Brief|Ringkasan|Huraian)\s*[:=]?\s*([\s\S]*?)(?:\n\n|\nTajuk|\nKategori|\nPautan|$)/i);
          const categoryMatch = artBlock.match(/(?:Category|Kategori|Desk|Topik)\s*[:=]?\s*([A-Za-z]+)/i);
          const urlMatch = artBlock.match(/(?:Source|URL|Pautan)\s*[:=]?\s*(https?:\/\/[^\s\n]+)/i);

          if (titleMatch && slotNum >= 0 && slotNum < 38) {
            parsedItems.push({
              slotIndex: slotNum,
              title: titleMatch[1].trim(),
              summary: summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ').trim() : '',
              category: categoryMatch ? categoryMatch[1].trim().toUpperCase() : 'UMUM',
              source_url: urlMatch ? urlMatch[1].trim() : '#'
            });
          }
        }
      }
    }

    if (parsedItems.length === 0) {
      return res.status(400).json({ error: 'Failed to parse any valid news slot data from the pasted text.' });
    }

    // Same hard-block as the per-slot manual save: every slot of the same geometry tier is
    // validated by the exact same budget rule (core/editorial/ContentBudget.js). Validate the
    // whole batch before writing anything, so one oversized item doesn't leave a partial paste.
    for (const item of parsedItems) {
      const slotIdx = item.slotIndex !== undefined ? parseInt(item.slotIndex, 10) : -1;
      if (slotIdx < 0 || slotIdx >= 38) continue;
      const budgetCheck = validateContentBudget(slotIdx, item.title, item.summary);
      if (!budgetCheck.isValid) {
        return res.status(400).json({ error: `Slot ${slotIdx + 1} -- "${(item.title || '').slice(0, 40)}...": ${budgetCheck.reason}` });
      }
    }

    const timestamp = new Date().toISOString();
    const results = [];

    for (const item of parsedItems) {
      const slotIdx = item.slotIndex !== undefined ? parseInt(item.slotIndex, 10) : -1;
      if (slotIdx < 0 || slotIdx >= 38) continue;

      const objectId = `object-manual-slot${slotIdx}-${Date.now()}`;
      const finalTitle = item.title ? item.title.trim() : '';
      const finalSummary = item.summary ? item.summary.trim() : '';
      const finalCategory = item.category ? item.category.trim().toUpperCase() : 'UMUM';
      const finalUrl = item.source_url || '#';

      if (!finalTitle) continue;

      try {
        await CategoryRegistry.incrementCategoryUsage(db, finalCategory);
      } catch (e) {
        console.warn("Failed to register category:", e.message);
      }

      await dbRun(`
        INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt)
        VALUES (?, 'Brief', ?, 'Medium', ?, ?, ?)
      `, [objectId, finalCategory, slotIdx, timestamp, timestamp]);

      const revResult = await dbRun(`
        INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
        VALUES (?, 1.0, 'ms', ?, ?, 'approved', 'batch-paste', ?, ?)
      `, [objectId, finalTitle, finalSummary, timestamp, timestamp]);
      const revisionId = revResult.lastID || 1;

      const attributes = [
        { key: 'desk', val: finalCategory },
        { key: 'url', val: finalUrl },
        { key: 'source', val: 'ChatGPT/Gemini Manual Paste' }
      ];

      for (const attr of attributes) {
        await dbRun(`
          INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText)
          VALUES (?, ?, ?, ?)
        `, [objectId, revisionId, attr.key, attr.val]);
      }

      await dbRun("UPDATE slots_config SET activeObjectId = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [objectId, slotIdx]);
      
      results.push({ slotIndex: slotIdx, title: finalTitle });
    }

    res.json({ success: true, count: results.length, items: parsedItems });
  } catch (err) {
    console.error('Batch paste error:', err);
    res.status(500).json({ error: 'Failed to process batch paste data. ' + err.message });
  }
});

// --- EDITORIAL OPERATING SYSTEM (SPEC-XXX) SCHEMA INIT & SEED ---

const initEditorialOS = (dbConn) => {
  return new Promise((resolve, reject) => {
    dbConn.serialize(() => {
      // 0. publisher_directory
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS publisher_directory (
          id TEXT PRIMARY KEY,
          publisherName TEXT,
          domainPattern TEXT,
          isOfficial INTEGER DEFAULT 0,
          authorityScore INTEGER DEFAULT 50,
          defaultGlyphProfile TEXT,
          defaultDesk TEXT
        )
      `);

      // RSS Direct Sources Registry Table
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS rss_sources_registry (
          id TEXT PRIMARY KEY,
          sourceName TEXT NOT NULL,
          rssUrl TEXT NOT NULL,
          language TEXT DEFAULT 'ms-MY',
          trustScore INTEGER DEFAULT 80,
          edition TEXT DEFAULT 'Malaysia',
          categoryMapping TEXT,
          allowedForTicker INTEGER DEFAULT 1,
          allowedForBrief INTEGER DEFAULT 1,
          enabled INTEGER DEFAULT 1,
          createdAt TEXT
        )
      `);

      // RSS Ticker Parsed Items & Review Queue Table
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS rss_ticker_items (
          id TEXT PRIMARY KEY,
          rssGuid TEXT UNIQUE,
          title TEXT NOT NULL,
          formattedBrief TEXT,
          source TEXT NOT NULL,
          originalUrl TEXT NOT NULL,
          category TEXT,
          publishedAt TEXT,
          score INTEGER DEFAULT 0,
          scoreBreakdown TEXT,
          decision TEXT,
          status TEXT DEFAULT 'pending',
          createdAt TEXT
        )
      `);

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
          slotIndex INTEGER,
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
      
      // Indexes for EAV & High-Speed Content Lookup
      dbConn.run("CREATE INDEX IF NOT EXISTS idx_eav_object ON editorial_attribute_values(objectId, revisionId)");
      dbConn.run("CREATE INDEX IF NOT EXISTS idx_eav_attribute ON editorial_attribute_values(attributeId)");
      dbConn.run("CREATE INDEX IF NOT EXISTS idx_editorial_objects_category ON editorial_objects(categoryId, createdAt)");
      dbConn.run("CREATE INDEX IF NOT EXISTS idx_editorial_revisions_lookup ON editorial_revisions(objectId, status, version)");
      dbConn.run("CREATE INDEX IF NOT EXISTS idx_rss_ticker_category ON rss_ticker_items(category, publishedAt)");

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
          searchStrategy TEXT DEFAULT 'Structured Sources Only',
          PRIMARY KEY (layoutTemplateId, slotIndex),
          FOREIGN KEY(providerId) REFERENCES ai_providers(id) ON DELETE SET NULL
        )
      `, () => {
        dbConn.run("ALTER TABLE slots_config ADD COLUMN searchStrategy TEXT DEFAULT 'Structured Sources Only'", () => {});
      });

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
          // maxBriefLong: had aksara "Huraian Panjang" -- ciri baharu untuk spotlight mode (belum
          // dibina), disimpan sekarang supaya kandungannya boleh mula dikumpul lebih awal.
          dbConn.run("ALTER TABLE slots_config ADD COLUMN maxBriefLong INTEGER", () => {});
          // editorial_attribute_values.attributeId has a FOREIGN KEY into editorial_attributes --
          // any new EAV attribute key (briefLong, originalDate) MUST be registered here first, or
          // every syncManualObjectsForSlot() insert using it throws SQLITE_CONSTRAINT and silently
          // aborts (caught + console.warn'd by the caller), dropping that slot's sync entirely.
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('briefLong', 'Huraian Panjang', 'text')", () => {});
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('originalDate', 'Tarikh Asal', 'text')", () => {});
          dbConn.run("ALTER TABLE slots_config ADD COLUMN manualDesk TEXT", () => {
            dbConn.run("ALTER TABLE slots_config ADD COLUMN nextRunAt INTEGER", () => {
              dbConn.run("ALTER TABLE slots_config ADD COLUMN refreshInterval INTEGER", () => {
                dbConn.run("ALTER TABLE slots_config ADD COLUMN lastAttemptAt TEXT", () => {
                  dbConn.run("ALTER TABLE slots_config ADD COLUMN lastSuccessfulRunAt TEXT", () => {
                    dbConn.run("ALTER TABLE slots_config ADD COLUMN lastRunStatus TEXT", () => {
                      dbConn.run("ALTER TABLE slots_config ADD COLUMN lastRunMessage TEXT", () => {
                        dbConn.run("ALTER TABLE editorial_revisions ADD COLUMN language TEXT DEFAULT 'ms'", () => {
                          dbConn.run("ALTER TABLE pipeline_logs ADD COLUMN runId TEXT", () => {
                            dbConn.run("ALTER TABLE system_settings ADD COLUMN masterPrompt TEXT", () => {
                              dbConn.run("ALTER TABLE editorial_objects ADD COLUMN slotIndex INTEGER", () => {
                                dbConn.run("ALTER TABLE slots_config ADD COLUMN carouselInterval INTEGER DEFAULT 10", () => {
                                  dbConn.run("ALTER TABLE slots_config ADD COLUMN carouselDelay INTEGER DEFAULT 0", () => {
                                    dbConn.run("ALTER TABLE slots_config ADD COLUMN generationLimit INTEGER DEFAULT 1", () => {
                                      dbConn.run("ALTER TABLE slots_config ADD COLUMN maxTitle INTEGER", () => {
                                        dbConn.run("ALTER TABLE slots_config ADD COLUMN maxBrief INTEGER", () => {
                                          dbConn.run("ALTER TABLE slots_config ADD COLUMN refreshHour TEXT DEFAULT '00:00'", () => {
                                            dbConn.run("ALTER TABLE slots_config ADD COLUMN refreshDay TEXT DEFAULT 'Isnin'", () => {
                                              dbConn.run("ALTER TABLE slots_config ADD COLUMN eventExpiryFilter TEXT DEFAULT ''", () => {
                                              dbConn.run("ALTER TABLE slots_config ADD COLUMN aiPromptTopic TEXT DEFAULT ''", () => {
                                              dbConn.run("ALTER TABLE slots_config ADD COLUMN aiPromptRecency TEXT DEFAULT ''", () => {
                                              dbConn.run("ALTER TABLE slots_config ADD COLUMN aiPromptLanguage TEXT DEFAULT ''", () => {
                                              dbConn.run("ALTER TABLE slots_config ADD COLUMN aiPromptRegion TEXT DEFAULT ''", () => {
                                              dbConn.run("ALTER TABLE slots_config ADD COLUMN aiPromptSource TEXT DEFAULT ''", () => {
                                                dbConn.run("ALTER TABLE slots_config ADD COLUMN sourceType TEXT DEFAULT 'web'", () => {});
                                                dbConn.run("ALTER TABLE editorial_objects ADD COLUMN sourceType TEXT DEFAULT 'web'", () => {});
                                                dbConn.run("CREATE INDEX IF NOT EXISTS idx_editorial_objects_source_type ON editorial_objects(sourceType)", () => {});
                                                dbConn.run(`
                                                  CREATE TABLE IF NOT EXISTS static_pages (
                                                    key TEXT PRIMARY KEY,
                                                    title TEXT NOT NULL,
                                                    content TEXT NOT NULL,
                                                    updatedAt TEXT NOT NULL
                                                  )
                                                `, () => {
                                                  dbConn.run(`
                                                    CREATE TABLE IF NOT EXISTS CategoryRegistry (
                                                      id TEXT PRIMARY KEY,
                                                      slug TEXT UNIQUE NOT NULL,
                                                      name TEXT NOT NULL,
                                                      color TEXT NOT NULL,
                                                      usageCount INTEGER DEFAULT 0,
                                                      createdAt TEXT NOT NULL,
                                                      updatedAt TEXT NOT NULL
                                                    )
                                                  `, () => {
                                                    dbConn.run("ALTER TABLE ai_usage_logs ADD COLUMN promptText TEXT", () => {
                                                      dbConn.run("ALTER TABLE ai_usage_logs ADD COLUMN responseText TEXT", () => {
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
                                              });
                                            });
                                          });
                                        });
                                      });
                                    });
                                  });
                                });
                              });
                            });
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

// Server-side mirror of FrontpageView.tsx's getLimitsForIndex/GEOMETRY_RATIOS defaults -- these
// ARE the hard ceilings: a card's geometry physically cannot show more than this much text
// without breaking its size/legibility, so no slot may be configured (or publish content) beyond
// its own tier's numbers. Kept in sync manually with the client-side defaults.
const GEOMETRY_TIER_CEILINGS = {
  MENEGAK: { maxTitle: 72, maxBrief: 480, maxBriefLong: 800 },
  STANDARD: { maxTitle: 110, maxBrief: 280, maxBriefLong: 600 },
  SEGI_EMPAT_MEDIUM: { maxTitle: 60, maxBrief: 100, maxBriefLong: 500 },
  SEGI_EMPAT_SMALL: { maxTitle: 40, maxBrief: 65, maxBriefLong: 400 },
  KOMPAK: { maxTitle: 55, maxBrief: 25, maxBriefLong: 400 },
  BAR: { maxTitle: 95, maxBrief: 0, maxBriefLong: 0 },
  HERO: { maxTitle: 115, maxBrief: 350, maxBriefLong: 800 },
  TICKER: { maxTitle: 80, maxBrief: 220, maxBriefLong: 0 },
  DEFAULT: { maxTitle: 70, maxBrief: 100, maxBriefLong: 600 }
};

const getGeometryCeilingForSlot = (slotIndex) => {
  if (slotIndex === -1) return GEOMETRY_TIER_CEILINGS.TICKER;
  if (slotIndex === 0) return GEOMETRY_TIER_CEILINGS.HERO;
  if ([1, 12, 15, 26, 29, 37].includes(slotIndex)) return GEOMETRY_TIER_CEILINGS.MENEGAK;
  if ([2, 6, 19, 20, 33, 34].includes(slotIndex)) return GEOMETRY_TIER_CEILINGS.STANDARD;
  if ([13, 14, 27, 28].includes(slotIndex)) return GEOMETRY_TIER_CEILINGS.SEGI_EMPAT_MEDIUM;
  if ([3, 11, 16, 25, 30, 35, 36].includes(slotIndex)) return GEOMETRY_TIER_CEILINGS.SEGI_EMPAT_SMALL;
  if ([4, 5, 17, 18, 31, 32].includes(slotIndex)) return GEOMETRY_TIER_CEILINGS.KOMPAK;
  if ([7, 8, 9, 10, 21, 22, 23, 24].includes(slotIndex)) return GEOMETRY_TIER_CEILINGS.BAR;
  return GEOMETRY_TIER_CEILINGS.DEFAULT;
};

// Helper function to resolve active layout slots
const parseManualSummaryTemplate = (summaryText, defaultSlot) => {
  if (!summaryText || (!summaryText.includes('Tajuk:') && !summaryText.includes('Event:'))) {
    return [{
      title: defaultSlot.manualTitle || '',
      summary: defaultSlot.manualSummary || '',
      url: defaultSlot.manualUrl || '#',
      desk: defaultSlot.manualDesk || 'general',
      source: defaultSlot.manualSource || '19 Jul 2026',
      publishedAt: defaultSlot.lastAttemptAt || new Date().toISOString()
    }];
  }

  // Robust multi-boundary block splitting: splits on ____, ---, ===, full underscore lines, or new UUID/Tajuk/Event lines
  const blocks = summaryText.split(/(?:\r?\n){2,}(?=UUID:|Tajuk:|Event:)|____+|----+|====+|___+/i);
  const items = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    let uuid = '';
    let title = '';
    let brief = '';
    let briefLong = '';
    let desk = '';
    let date = '';
    let source = '';
    let url = '';
    let sourceType = '';
    let isEventBlock = false;

    let organizer = '';
    let location = '';
    let access = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('UUID:')) {
        uuid = trimmed.replace(/^UUID:\s*/i, '').trim();
      } else if (trimmed.startsWith('Tajuk:')) {
        title = trimmed.replace(/^Tajuk:\s*/i, '').trim();
      } else if (trimmed.startsWith('Event:')) {
        title = trimmed.replace(/^Event:\s*/i, '').trim();
        desk = 'ACARA'; // Default desk untuk event
        isEventBlock = true;
      } else if (trimmed.startsWith('Huraian panjang:')) {
        briefLong = trimmed.replace(/^Huraian panjang:\s*/i, '').trim();
      } else if (trimmed.startsWith('Huraian ringkas:')) {
        brief = trimmed.replace(/^Huraian ringkas:\s*/i, '').trim();
      } else if (trimmed.startsWith('Huraian:')) {
        brief = trimmed.replace(/^Huraian:\s*/i, '').trim();
      } else if (trimmed.startsWith('Kategori:')) {
        desk = trimmed.replace(/^Kategori:\s*/i, '').trim();
      } else if (trimmed.startsWith('Jenis sumber:')) {
        sourceType = trimmed.replace(/^Jenis sumber:\s*/i, '').trim();
      } else if (trimmed.startsWith('Tarikh:')) {
        date = trimmed.replace(/^Tarikh:\s*/i, '').trim();
      } else if (trimmed.startsWith('Penganjur:')) {
        organizer = trimmed.replace(/^Penganjur:\s*/i, '').trim();
      } else if (trimmed.startsWith('Lokasi:')) {
        location = trimmed.replace(/^Lokasi:\s*/i, '').trim();
      } else if (trimmed.startsWith('Akses:')) {
        access = trimmed.replace(/^Akses:\s*/i, '').trim();
      } else if (trimmed.startsWith('Sumber:')) {
        source = trimmed.replace(/^Sumber:\s*/i, '').trim();
      } else if (trimmed.startsWith('URL:')) {
        url = trimmed.replace(/^URL:\s*/i, '').trim();
      }
    }

    // Resolve sourceType from text or fallback to auto-detection
    let finalSourceType = 'web';
    const stLower = sourceType.toLowerCase();
    if (stLower.includes('bercetak') || stLower.includes('buku') || stLower.includes('print')) {
      finalSourceType = 'print';
    } else if (stLower.includes('audio') || stLower.includes('podcast')) {
      finalSourceType = 'audio';
    } else if (stLower.includes('video') || stLower.includes('tonton')) {
      finalSourceType = 'video';
    } else if (stLower.includes('web') || stLower.includes('laman')) {
      finalSourceType = 'web';
    } else {
      finalSourceType = detectSourceType(url, `${title} ${brief}`);
    }

    if (isEventBlock && !source) {
      source = organizer || date; // Utama penganjur, jika tiada baru gunakan tarikh
    }

    // Buang notasi had aksara template seperti (max 70 aksara)
    title = title.replace(/^\([^)]+\)\s*/g, '').trim();
    brief = brief.replace(/^\([^)]+\)\s*/g, '').trim();
    briefLong = briefLong.replace(/^\([^)]+\)\s*/g, '').trim();
    organizer = organizer.replace(/^\([^)]+\)\s*/g, '').trim();

    if (title) {
      items.push({
        title,
        summary: brief,
        briefLong,
        desk: desk || defaultSlot.manualDesk || 'general',
        sourceType: finalSourceType,
        organizer: organizer || source || '',
        location,
        access,
        source: organizer || source || defaultSlot.manualSource || '19 Jul 2026',
        url: url || defaultSlot.manualUrl || '#',
        originalDate: date || '',
        publishedAt: date || ''
      });
    }
  }

  return items.length > 0 ? items : [{
    title: defaultSlot.manualTitle || '',
    summary: defaultSlot.manualSummary || '',
    url: defaultSlot.manualUrl || '#',
    desk: defaultSlot.manualDesk || 'general',
    source: defaultSlot.manualSource || '19 Jul 2026',
    publishedAt: defaultSlot.lastAttemptAt || new Date().toISOString()
  }];
};

// The Ticker (slotIndex -1) never writes to editorial_objects, in either Manual or AI Generated
// mode — it always lives as a single "---"-delimited text blob in system_settings.inTheNewsText
// (see EditorialPipeline.js's slotIndex===-1 branch, and the ticker save path in POST
// /api/system/slots). These mirror the client-side parseInTheNews()/serialization convention
// (Desk:/Title:/Brief:/Source:/Url: fields) so the content-review endpoints can read/write it too.
const parseTickerText = (text) => {
  if (!text) return [];
  const blocks = text.split(/\n?[-_—–―]{3,}\n?/);
  const items = [];
  for (const block of blocks) {
    let desk = '', title = '', brief = '', source = '', url = '';
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (!url) url = trimmed;
        continue;
      }
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx <= 0) continue;
      const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (key === 'desk') desk = val;
      else if (key === 'title') title = val;
      else if (key === 'brief' || key === 'summary') brief = val;
      else if (key === 'source') source = val;
      else if (key === 'url') url = val;
    }
    if (title) items.push({ desk, title, brief, source, url });
  }
  return items;
};

const serializeTickerText = (items) => {
  return items
    .map(i => `Desk: ${i.desk || 'UMUM'}\nTitle: ${i.title}\nBrief: ${i.brief || ''}\nSource: ${i.source || ''}\nUrl: ${i.url || '#'}`)
    .join('\n---\n');
};

// Keeps editorial_objects/editorial_revisions/editorial_attribute_values in sync with a Manual-mode
// and slots_config.manualSummary.
const syncManualObjectsForSlot = async (slotIndex, manualSummary, slotConfig) => {
  const items = parseManualSummaryTemplate(manualSummary || '', slotConfig);

  // Hard-block: content that exceeds its card's shared title+brief space budget must never be
  // published, since it breaks the card's size/legibility. Every slot of the same geometry tier
  // is validated by the exact same rule -- see core/editorial/ContentBudget.js. Validate ALL items
  // before touching the DB, so a rejected save leaves whatever was already there untouched (no
  // DELETE ever runs on failure).
  const ceiling = getGeometryCeilingForSlot(slotIndex);
  const effectiveMaxBriefLong = typeof slotConfig.maxBriefLong === 'number' ? slotConfig.maxBriefLong : ceiling.maxBriefLong;
  for (const item of items) {
    const budgetCheck = validateContentBudget(slotIndex, item.title, item.summary);
    if (!budgetCheck.isValid) {
      const err = new Error(`"${(item.title || '').slice(0, 40)}...": ${budgetCheck.reason} Kandungan tidak disiarkan.`);
      err.isValidationError = true;
      throw err;
    }
    if (effectiveMaxBriefLong && item.briefLong && item.briefLong.length > effectiveMaxBriefLong) {
      const err = new Error(`Huraian panjang bagi "${item.title.slice(0, 40)}..." melebihi had ${effectiveMaxBriefLong} aksara (semasa: ${item.briefLong.length}). Kandungan tidak disiarkan -- pendekkan huraian dahulu.`);
      err.isValidationError = true;
      throw err;
    }
  }

  await dbRun('DELETE FROM editorial_objects WHERE slotIndex = ?', [slotIndex]);
  if (items.length === 0) return;

  const baseTs = Date.now();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const objectId = item.uuid || `object-manual-slot${slotIndex}-${baseTs}-${i}`;
    const createdAt = new Date(baseTs + i).toISOString();
    const finalCategory = (item.desk || 'UMUM').trim().toUpperCase();
    try {
      await CategoryRegistry.incrementCategoryUsage(db, finalCategory);
    } catch (e) {
      console.warn("Failed to register category:", e.message);
    }

    await dbRun(
      `INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, sourceType, createdAt, updatedAt)
       VALUES (?, 'Brief', ?, 'Medium', ?, ?, ?, ?)`,
      [objectId, finalCategory, slotIndex, item.sourceType || 'web', createdAt, createdAt]
    );
    const rev = await dbRun(
      `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
       VALUES (?, 1.0, 'ms', ?, ?, 'approved', 'manual-slot-save', ?, ?)`,
      [objectId, item.title, item.summary, createdAt, createdAt]
    );
    const revisionId = rev.lastID;

    const attrs = [
      { key: 'desk', val: finalCategory },
      { key: 'url', val: item.url || '#' },
      { key: 'source', val: item.source || '' },
      { key: 'sourceType', val: item.sourceType || 'web' },
      { key: 'briefLong', val: item.briefLong || '' },
      { key: 'originalDate', val: item.originalDate || '' },
    ];
    for (const a of attrs) {
      await dbRun(
        `INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText)
         VALUES (?, ?, ?, ?)`,
        [objectId, revisionId, a.key, a.val]
      );
    }
  }
};

const resolveSlotContent = async (slot, lang = 'ms') => {
  if (slot.contentMode === 'Disabled') {
    return null;
  }

  let objectIds = [];
  let isManualParsed = false;
  const subItems = [];

  if (slot.contentMode === 'AI Generated') {
    try {
      const limit = slot.generationLimit || 5;
      // Exclude Manual-origin rows: a slot can be switched between Manual and AI Generated over
      // time, and old rows from the OTHER mode can still share the same slotIndex — without this
      // filter, stale content from a previous mode silently bleeds into the current mode's carousel.
      const dbObjects = await dbAll(`
        SELECT eo.id FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id AND er.status = 'approved'
        WHERE eo.slotIndex = ? AND er.createdBy NOT IN ('manual-slot-save', 'migration-manual-blob', 'content-review')
        ORDER BY eo.createdAt DESC LIMIT ?
      `, [slot.slotIndex, limit]);
      objectIds = dbObjects.map(o => o.id);
    } catch (e) {
      console.error(e);
    }
    const mainId = slot.overrideObjectId || slot.activeObjectId;
    if (mainId && !objectIds.includes(mainId)) {
      objectIds.unshift(mainId);
    }
  } else if (slot.contentMode === 'Manual') {
    // Manual-mode content is being migrated from the raw manualSummary text blob into real
    // editorial_objects rows (same storage as AI Generated), so it can be listed/edited/deleted
    // individually elsewhere in the admin. Prefer real DB rows when they exist; only fall back to
    // parsing the legacy text blob directly for slots that haven't been migrated yet (or freshly
    // created ones with content still sitting only in the blob) — zero behavior change for those.
    try {
      // Only rows actually authored through the Manual pathway — a slot previously in AI Generated
      // mode can leave behind pipeline-authored rows sharing the same slotIndex, which must NOT
      // bleed into this carousel once the slot is switched to Manual.
      const dbObjects = await dbAll(`
        SELECT eo.id FROM editorial_objects eo
        INNER JOIN editorial_revisions er ON er.objectId = eo.id AND er.status = 'approved'
        WHERE eo.slotIndex = ? AND er.createdBy IN ('manual-slot-save', 'migration-manual-blob', 'content-review')
        ORDER BY eo.createdAt ASC
      `, [slot.slotIndex]);
      objectIds = dbObjects.map(o => o.id);
    } catch (e) {
      console.error(e);
    }

    if (objectIds.length === 0) {
      isManualParsed = true;
      const parsedItems = parseManualSummaryTemplate(slot.manualSummary || '', slot);
      for (const parsed of parsedItems) {
        const approvedRevision = {
          title: parsed.title,
          summary: parsed.summary,
          createdAt: parsed.publishedAt
        };
        const editorialObj = { id: 'manual', type: 'Brief', categoryId: 'general' };
        const avs = [
          { attributeId: 'url', valueText: parsed.url },
          { attributeId: 'desk', valueText: parsed.desk },
          { attributeId: 'source', valueText: parsed.source }
        ];

        const renderToken = await PresentationComposer.composeToken(db, slot, editorialObj, approvedRevision, avs);

        subItems.push({
          title: approvedRevision.title,
          brief: approvedRevision.summary,
          publishedAt: approvedRevision.createdAt,
          originalDate: parsed.originalDate || '',
          desk: (renderToken.desk || parsed.desk || 'UMUM').toUpperCase(),
          publisherName: renderToken.publisherName || parsed.source || 'Umum',
          source: renderToken.publisherName || parsed.source || 'Umum',
          url: renderToken.sourceUrl || renderToken.url || parsed.url || '#',
          glyphProfile: renderToken.glyphProfile || null,
          presentationProfile: renderToken.presentationProfile || 'umum',
          publicationType: renderToken.publicationType || 'news',
          isOfficial: renderToken.isOfficial || false,
          aiProvider: null,
          imageUrl: slot.manualImageUrl || ''
        });
      }
    }
  } else {
    const mainId = slot.overrideObjectId || slot.activeObjectId;
    if (mainId) objectIds = [mainId];
  }

  if (!isManualParsed) {
    if (objectIds.length === 0) {
      return null;
    }

    for (const objectId of objectIds) {
      let approvedRevision = { title: '', summary: '', createdAt: new Date().toISOString() };
      let editorialObj = { id: objectId, type: 'Brief', categoryId: 'general' };
      let avs = [];

      const obj = await dbGet("SELECT * FROM editorial_objects WHERE id = ?", [objectId]);
      if (!obj) continue;
      editorialObj = obj;
      let rev = await dbGet("SELECT * FROM editorial_revisions WHERE objectId = ? AND status = 'approved' AND language = ? ORDER BY version DESC LIMIT 1", [objectId, lang]);
      if (!rev && lang !== 'ms') {
        rev = await dbGet("SELECT * FROM editorial_revisions WHERE objectId = ? AND status = 'approved' AND language = 'ms' ORDER BY version DESC LIMIT 1", [objectId]);
      }
      if (!rev) continue;
      approvedRevision = rev;
      avs = await dbAll("SELECT * FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ?", [objectId, rev.id]);

      if (!approvedRevision.title || approvedRevision.title.trim() === '') {
        continue;
      }

      const renderToken = await PresentationComposer.composeToken(db, slot, editorialObj, approvedRevision, avs);
      
      // Dapatkan coverImage
      let imageUrl = slot.manualImageUrl || '';
      const imgAv = avs.find(a => a.attributeId === 'coverImageId' || a.attributeId === 'imageUrl');
      if (imgAv) {
        imageUrl = imgAv.valueText;
      }

      const aiProv = avs.find(a => a.attributeId === 'aiProvider');
      const origDateAv = avs.find(a => a.attributeId === 'originalDate');

      subItems.push({
        title: approvedRevision.title,
        brief: approvedRevision.summary,
        publishedAt: approvedRevision.createdAt,
        originalDate: origDateAv ? origDateAv.valueText : '',
        desk: (renderToken.desk || 'UMUM').toUpperCase(),
        publisherName: renderToken.publisherName || 'Umum',
        source: renderToken.publisherName || 'Umum',
        // PresentationComposer's token names this field sourceUrl, not url -- this fallback
        // chain avoids silently dropping every DB-backed item's click-through link to '#'.
        url: renderToken.sourceUrl || renderToken.url || '#',
        glyphProfile: renderToken.glyphProfile || null,
        presentationProfile: renderToken.presentationProfile || 'umum',
        publicationType: renderToken.publicationType || 'news',
        isOfficial: renderToken.isOfficial || false,
        aiProvider: aiProv ? aiProv.valueText : null,
        imageUrl
      });
    }
  }

  if (subItems.length === 0) {
    return null;
  }

  const first = subItems[0];
  
  return {
    rawIndex: slot.slotIndex + 1,
    bgColor: slot.bgColor || 'transparent',
    borderColor: slot.borderColor || '',
    textColor: slot.textColor || '#1F1F1F',
    imageUrl: first.imageUrl || slot.manualImageUrl || '',
    language: lang,
    offset: 0,
    carouselInterval: slot.carouselInterval || 10,
    carouselDelay: slot.carouselDelay || 0,
    maxTitle: slot.maxTitle,
    maxBrief: slot.maxBrief,
    ...first,
    items: subItems
  };
};

// 1. GET /api/system/layout/active
app.get('/api/system/layout/active', async (req, res) => {
  try {
    const lang = req.query.lang || 'ms';
    const slots = await dbAll("SELECT * FROM slots_config WHERE layoutTemplateId = 'frontpage' ORDER BY slotIndex ASC");
    const categories = await CategoryRegistry.getAllCategories(db);
    const resolvedSlots = [];
    
    for (const slot of slots) {
      const resolved = await resolveSlotContent(slot, lang);
      if (resolved) {
        // Map category colors & public category fallback to items
        if (resolved.items && Array.isArray(resolved.items)) {
          for (const item of resolved.items) {
            if (item.desk === 'BELUM DIKELASKAN') item.desk = 'SEMASA';
            const catSlug = CategoryRegistry.getSlug(item.desk || 'UMUM');
            const matched = categories.find(c => c.slug === catSlug);
            item.categoryColor = matched ? matched.color : '#802334';
          }
        }
        // Also map for the main resolved object properties
        if (resolved.desk === 'BELUM DIKELASKAN') resolved.desk = 'SEMASA';
        const catSlug = CategoryRegistry.getSlug(resolved.desk || 'UMUM');
        const matched = categories.find(c => c.slug === catSlug);
        resolved.categoryColor = matched ? matched.color : '#802334';

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
    const slots = Array.isArray(req.body) ? req.body : [req.body];
    for (const slot of slots) {
      const providerId = slot.providerId && typeof slot.providerId === 'string' && slot.providerId.trim() !== '' && slot.providerId !== 'undefined' && slot.providerId !== 'null' ? slot.providerId : null;
      console.log(`Slot ${slot.slotIndex}: raw providerId = "${slot.providerId}", mapped = ${providerId}`);

      // Hard ceiling: a slot's own had aksara can never exceed what its card geometry can
      // physically show, regardless of what the client sends -- clamp before it ever reaches
      // storage, so an oversized value can't sneak in and later get copied around on re-save.
      const ceiling = getGeometryCeilingForSlot(slot.slotIndex);
      if (typeof slot.maxTitle === 'number' && slot.maxTitle > ceiling.maxTitle) slot.maxTitle = ceiling.maxTitle;
      if (typeof slot.maxBrief === 'number' && slot.maxBrief > ceiling.maxBrief) slot.maxBrief = ceiling.maxBrief;
      if (typeof slot.maxBriefLong === 'number' && slot.maxBriefLong > ceiling.maxBriefLong) slot.maxBriefLong = ceiling.maxBriefLong;
      const resolvedSourceType = slot.sourceType || detectSourceType(slot.manualUrl, `${slot.manualTitle || ''} ${slot.manualSummary || ''}`);

      await dbRun(`
        INSERT OR REPLACE INTO slots_config (
          layoutTemplateId, slotIndex, contentMode, providerId, model, promptText, sourcesList, refreshRate, allowedContentTypes, priority, expiresAt, bgColor, borderColor, textColor,
          manualTitle, manualSummary, manualSource, manualUrl, manualImageUrl, manualDesk, activeObjectId, searchStrategy, carouselInterval, carouselDelay, generationLimit, maxTitle, maxBrief, maxBriefLong, refreshHour, refreshDay, eventExpiryFilter,
          aiPromptTopic, aiPromptRecency, aiPromptLanguage, aiPromptRegion, aiPromptSource, sourceType
        ) VALUES ('frontpage', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        slot.slotIndex, slot.contentMode, providerId, slot.model, slot.promptText, slot.sourcesList, slot.refreshRate, slot.allowedContentTypes, slot.priority, slot.expiresAt, slot.bgColor, slot.borderColor, slot.textColor,
        slot.manualTitle, slot.manualSummary, slot.manualSource, slot.manualUrl, slot.manualImageUrl, slot.manualDesk, slot.activeObjectId, slot.searchStrategy || 'Structured Sources Only', slot.carouselInterval || 10, slot.carouselDelay || 0, slot.generationLimit || 1, slot.maxTitle !== undefined ? slot.maxTitle : null, slot.maxBrief !== undefined ? slot.maxBrief : null, slot.maxBriefLong !== undefined ? slot.maxBriefLong : null, slot.refreshHour || '00:00', slot.refreshDay || 'Isnin', slot.eventExpiryFilter || '',
        slot.aiPromptTopic || '', slot.aiPromptRecency || '', slot.aiPromptLanguage || '', slot.aiPromptRegion || '', slot.aiPromptSource || '', resolvedSourceType
      ]);

      if (slot.manualDesk && slot.manualDesk.trim() !== '') {
        try {
          await CategoryRegistry.incrementCategoryUsage(db, slot.manualDesk);
        } catch (e) {
          console.warn("Failed to register category:", e.message);
        }
      }

      if (slot.contentMode === 'Manual' && slot.slotIndex >= 0) {
        try {
          await syncManualObjectsForSlot(slot.slotIndex, slot.manualSummary, slot);
        } catch (e) {
          if (e.isValidationError) {
            // Hard-block: abort the whole save (not just this slot) so the admin sees exactly
            // why nothing was published, instead of a silent partial save.
            return res.status(400).json({ error: e.message });
          }
          console.warn(`Failed to sync editorial_objects for slot ${slot.slotIndex}:`, e.message);
        }
      }

      if (slot.masterPrompt !== undefined && slot.masterPrompt !== null) {
        await dbRun("UPDATE system_settings SET masterPrompt = ? WHERE id = 'settings-main'", [slot.masterPrompt]);
      }

      if (slot.slotIndex === -1 && slot.contentMode === 'Manual') {
        await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [slot.manualSummary || '']);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Save slots config error:', err);
    res.status(500).json({ error: 'Failed to save slots configuration. ' + (err.message || '') });
  }
});

// --- CONTENT REVIEW (aggregate cross-slot listing/editing over editorial_objects) ---

app.get('/api/system/content/all', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT eo.id as objectId, eo.slotIndex, eo.categoryId, eo.createdAt as objectCreatedAt,
             er.id as revisionId, er.title, er.summary, er.createdAt as revisionCreatedAt, er.updatedAt as revisionUpdatedAt
      FROM editorial_objects eo
      INNER JOIN editorial_revisions er ON er.objectId = eo.id
      INNER JOIN (
        SELECT objectId, MAX(version) as maxVersion FROM editorial_revisions WHERE status = 'approved' GROUP BY objectId
      ) latest ON latest.objectId = er.objectId AND latest.maxVersion = er.version
      ORDER BY eo.slotIndex ASC, eo.createdAt ASC
    `);

    const objectIds = rows.map(r => r.objectId);
    let attrsByObject = {};
    if (objectIds.length > 0) {
      const placeholders = objectIds.map(() => '?').join(',');
      const attrRows = await dbAll(`SELECT * FROM editorial_attribute_values WHERE objectId IN (${placeholders})`, objectIds);
      for (const a of attrRows) {
        if (!attrsByObject[a.objectId]) attrsByObject[a.objectId] = {};
        attrsByObject[a.objectId][a.attributeId] = a.valueText;
      }
    }

    const slotRows = await dbAll("SELECT slotIndex, maxTitle, maxBrief, maxBriefLong, manualDesk FROM slots_config WHERE layoutTemplateId = 'frontpage'");
    const limitsBySlot = {};
    for (const s of slotRows) {
      limitsBySlot[s.slotIndex] = { maxTitle: s.maxTitle, maxBrief: s.maxBrief, maxBriefLong: s.maxBriefLong, slotCategory: s.manualDesk || '' };
    }

    // seriesIndex: 1-based position within its own slot, in the same createdAt-ASC order used to
    // render the carousel — this is what the "#slot-series" numbering in the bulk text view anchors to.
    const seriesCounter = {};
    const items = rows.map(r => {
      const attrs = attrsByObject[r.objectId] || {};
      seriesCounter[r.slotIndex] = (seriesCounter[r.slotIndex] || 0) + 1;
      const limits = limitsBySlot[r.slotIndex] || {};
      return {
        id: r.objectId,
        revisionId: r.revisionId,
        slotIndex: r.slotIndex,
        seriesIndex: seriesCounter[r.slotIndex],
        title: r.title,
        summary: r.summary,
        summaryLong: attrs.briefLong || '',
        originalDate: attrs.originalDate || '',
        desk: attrs.desk || r.categoryId || '',
        source: attrs.source || '',
        url: attrs.url || '#',
        imageUrl: attrs.imageUrl || attrs.coverImageId || '',
        maxTitle: limits.maxTitle !== undefined ? limits.maxTitle : null,
        maxBrief: limits.maxBrief !== undefined ? limits.maxBrief : null,
        maxBriefLong: limits.maxBriefLong !== undefined ? limits.maxBriefLong : null,
        slotCategory: limits.slotCategory || '',
        createdAt: r.revisionCreatedAt,
        updatedAt: r.revisionUpdatedAt
      };
    });

    const tickerSettings = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
    const tickerLimits = limitsBySlot[-1] || {};
    const tickerParsed = parseTickerText(tickerSettings ? tickerSettings.inTheNewsText : '');
    const tickerItems = tickerParsed.map((t, idx) => ({
      id: `ticker-${idx}`,
      revisionId: null,
      slotIndex: -1,
      seriesIndex: idx + 1,
      title: t.title,
      summary: t.brief,
      desk: t.desk,
      source: t.source,
      url: t.url || '#',
      imageUrl: '',
      maxTitle: tickerLimits.maxTitle !== undefined ? tickerLimits.maxTitle : null,
      maxBrief: tickerLimits.maxBrief !== undefined ? tickerLimits.maxBrief : null,
      slotCategory: tickerLimits.slotCategory || '',
      createdAt: null,
      updatedAt: null
    }));

    const allItems = [...tickerItems, ...items];
    res.json({ items: allItems, count: allItems.length });
  } catch (err) {
    console.error('Fetch aggregate content error:', err);
    res.status(500).json({ error: 'Failed to fetch aggregate content. ' + (err.message || '') });
  }
});

app.patch('/api/system/content/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, summary, desk, source, url } = req.body;

    if (id.startsWith('ticker-')) {
      const idx = parseInt(id.slice('ticker-'.length), 10);
      const settingsRow = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
      const tickerItems = parseTickerText(settingsRow ? settingsRow.inTheNewsText : '');
      if (idx < 0 || idx >= tickerItems.length) {
        return res.status(404).json({ error: 'Item ticker tidak dijumpai.' });
      }
      if (title !== undefined) tickerItems[idx].title = title;
      if (summary !== undefined) tickerItems[idx].brief = summary;
      if (desk !== undefined) tickerItems[idx].desk = desk;
      if (source !== undefined) tickerItems[idx].source = source;
      if (url !== undefined) tickerItems[idx].url = url;
      await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [serializeTickerText(tickerItems)]);
      return res.json({ success: true });
    }

    const { imageUrl } = req.body;
    const rev = await dbGet("SELECT * FROM editorial_revisions WHERE objectId = ? AND status = 'approved' ORDER BY version DESC LIMIT 1", [id]);
    if (!rev) {
      return res.status(404).json({ error: 'Item tidak dijumpai.' });
    }

    // Same hard-block as every other content path: an edit can never push a slot's title+brief
    // over its tier's budget, no matter which screen the edit came from.
    const objRow = await dbGet("SELECT slotIndex FROM editorial_objects WHERE id = ?", [id]);
    if (objRow) {
      const nextTitle = title !== undefined ? title : rev.title;
      const nextSummary = summary !== undefined ? summary : rev.summary;
      const budgetCheck = validateContentBudget(objRow.slotIndex, nextTitle, nextSummary);
      if (!budgetCheck.isValid) {
        return res.status(400).json({ error: budgetCheck.reason });
      }
    }

    const setClauses = [];
    const params = [];
    if (title !== undefined) { setClauses.push('title = ?'); params.push(title); }
    if (summary !== undefined) { setClauses.push('summary = ?'); params.push(summary); }
    if (setClauses.length > 0) {
      setClauses.push('updatedAt = ?');
      params.push(new Date().toISOString());
      params.push(rev.id);
      await dbRun(`UPDATE editorial_revisions SET ${setClauses.join(', ')} WHERE id = ?`, params);
    }

    if (desk !== undefined && desk.trim() !== '') {
      try {
        await CategoryRegistry.incrementCategoryUsage(db, desk);
      } catch (e) {
        console.warn("Failed to register category:", e.message);
      }
    }

    const attrCandidates = { desk, source, url, imageUrl };
    for (const [key, val] of Object.entries(attrCandidates)) {
      if (val === undefined) continue;
      const existing = await dbGet(
        "SELECT id FROM editorial_attribute_values WHERE objectId = ? AND revisionId = ? AND attributeId = ?",
        [id, rev.id, key]
      );
      if (existing) {
        await dbRun("UPDATE editorial_attribute_values SET valueText = ? WHERE id = ?", [val, existing.id]);
      } else {
        await dbRun(
          "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
          [id, rev.id, key, val]
        );
      }
    }

    await dbRun("UPDATE editorial_objects SET updatedAt = ? WHERE id = ?", [new Date().toISOString(), id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Patch content item error:', err);
    res.status(500).json({ error: 'Failed to update item. ' + (err.message || '') });
  }
});

app.delete('/api/system/content/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id.startsWith('ticker-')) {
      const idx = parseInt(id.slice('ticker-'.length), 10);
      const settingsRow = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
      const tickerItems = parseTickerText(settingsRow ? settingsRow.inTheNewsText : '');
      if (idx < 0 || idx >= tickerItems.length) {
        return res.status(404).json({ error: 'Item ticker tidak dijumpai.' });
      }
      tickerItems.splice(idx, 1);
      await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [serializeTickerText(tickerItems)]);
      return res.json({ success: true });
    }

    await dbRun("DELETE FROM editorial_attribute_values WHERE objectId = ?", [id]);
    await dbRun("DELETE FROM editorial_revisions WHERE objectId = ?", [id]);
    const result = await dbRun("DELETE FROM editorial_objects WHERE id = ?", [id]);
    if (!result.changes) {
      return res.status(404).json({ error: 'Item tidak dijumpai.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete content item error:', err);
    res.status(500).json({ error: 'Failed to delete item. ' + (err.message || '') });
  }
});

app.post('/api/system/content', async (req, res) => {
  try {
    const { slotIndex, title, summary, desk, source, url, imageUrl } = req.body;
    if (slotIndex === undefined || slotIndex === null) {
      return res.status(400).json({ error: 'Missing slotIndex.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Tajuk diperlukan.' });
    }

    if (slotIndex === -1) {
      const settingsRow = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
      const tickerItems = parseTickerText(settingsRow ? settingsRow.inTheNewsText : '');
      tickerItems.push({
        desk: (desk || 'UMUM').trim().toUpperCase(),
        title: title.trim(),
        brief: (summary || '').trim(),
        source: source || '',
        url: url || '#'
      });
      await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [serializeTickerText(tickerItems)]);
      return res.json({ success: true, id: `ticker-${tickerItems.length - 1}` });
    }

    // Same hard-block as every other content-creation path: this slot's tier's budget rule applies
    // no matter which screen the content came from (core/editorial/ContentBudget.js).
    const budgetCheck = validateContentBudget(slotIndex, title.trim(), (summary || '').trim());
    if (!budgetCheck.isValid) {
      return res.status(400).json({ error: budgetCheck.reason });
    }

    const timestamp = new Date().toISOString();
    const finalCategory = (desk || 'UMUM').trim().toUpperCase();
    try {
      await CategoryRegistry.incrementCategoryUsage(db, finalCategory);
    } catch (e) {
      console.warn("Failed to register category:", e.message);
    }
    const objectId = `object-manual-slot${slotIndex}-${Date.now()}-new`;

    await dbRun(
      `INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt)
       VALUES (?, 'Brief', ?, 'Medium', ?, ?, ?)`,
      [objectId, finalCategory, slotIndex, timestamp, timestamp]
    );
    const rev = await dbRun(
      `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
       VALUES (?, 1.0, 'ms', ?, ?, 'approved', 'content-review', ?, ?)`,
      [objectId, title.trim(), (summary || '').trim(), timestamp, timestamp]
    );
    const revisionId = rev.lastID;

    const attrs = [
      { key: 'desk', val: finalCategory },
      { key: 'url', val: url || '#' },
      { key: 'source', val: source || '' },
    ];
    if (imageUrl) attrs.push({ key: 'imageUrl', val: imageUrl });
    for (const a of attrs) {
      await dbRun(
        "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
        [objectId, revisionId, a.key, a.val]
      );
    }

    res.json({ success: true, id: objectId });
  } catch (err) {
    console.error('Create content item error:', err);
    res.status(500).json({ error: 'Failed to create item. ' + (err.message || '') });
  }
});

app.post('/api/system/slots/run-now', async (req, res) => {
  const { slotIndex } = req.body;
  if (slotIndex === undefined || slotIndex === null) {
    return res.status(400).json({ error: 'Missing slotIndex parameter.' });
  }

  try {
    const currentRunId = `manual-run-${Date.now()}`;
    const result = await runEditorialPipeline(slotIndex, currentRunId, true);
    if (result) {
      if (result.status === 'CACHE_HIT' || result.status === 'SUCCESS') {
        if (result.objectId) {
          await dbRun("UPDATE slots_config SET activeObjectId = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?", [result.objectId, slotIndex]);
        }
        return res.json({ success: true, status: result.status, message: 'Berjaya diaktifkan!' });
      } else {
        return res.status(400).json({ error: result.message || 'Penjanaan gagal.' });
      }
    }
    res.status(400).json({ error: 'Gagal menjalankan pipeline.' });
  } catch (err) {
    console.error('Run slot now error:', err);
    res.status(500).json({ error: err.message || 'Ralat pelayan.' });
  }
});

// Endpoints for static/footer pages
app.get('/api/pages/:key', async (req, res) => {
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

app.post('/api/pages/:key', async (req, res) => {
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

// GET /api/system/clock-holidays
app.get('/api/system/clock-holidays', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    let apiHolidays = [];
    try {
      const response = await fetch(`https://malaysia-holiday.dydxsoft.my/api/v1/holidays?year=${currentYear}`);
      if (response.ok) {
        const jsonResult = await response.json();
        if (jsonResult && Array.isArray(jsonResult.data)) {
          apiHolidays = jsonResult.data.map(h => {
            return {
              name: h.name,
              date: h.date, // "YYYY-MM-DD"
              state_codes: h.state_codes || []
            };
          });
        }
      }
    } catch (apiErr) {
      console.warn('Failed to fetch public holidays from DyDxSoft API:', apiErr.message);
    }

    const schoolHolidays = [
      // Penggal 1
      { start: '2026-05-24', end: '2026-06-01', group: 'A', name: 'Cuti Penggal 1 Sekolah' },
      { start: '2026-05-25', end: '2026-06-02', group: 'B', name: 'Cuti Penggal 1 Sekolah' },
      // Penggal 2
      { start: '2026-09-11', end: '2026-09-19', group: 'A', name: 'Cuti Penggal 2 Sekolah' },
      { start: '2026-09-12', end: '2026-09-20', group: 'B', name: 'Cuti Penggal 2 Sekolah' },
      // Penggal 3
      { start: '2026-12-25', end: '2027-01-02', group: 'A', name: 'Cuti Penggal 3 Sekolah' },
      { start: '2026-12-26', end: '2027-01-03', group: 'B', name: 'Cuti Penggal 3 Sekolah' },
      // Akhir Persekolahan
      { start: '2027-01-22', end: '2027-02-13', group: 'A', name: 'Cuti Akhir Persekolahan' },
      { start: '2027-01-23', end: '2027-02-14', group: 'B', name: 'Cuti Akhir Persekolahan' }
    ];

    res.json({
      publicHolidays: apiHolidays,
      schoolHolidays
    });
  } catch (err) {
    console.error('Failed to resolve holidays:', err);
    res.status(500).json({ error: 'Failed to retrieve holidays list.' });
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
        worldClockHolidaysGoogleDocUrl, researchFindingsText, researchFindingsGoogleDocUrl,
        masterPrompt
      ) VALUES (
        'settings-main', ?, ?, ?, 
        ?, ?, ?, ?, 
        ?, ?, ?, ?, 
        ?, ?, ?, ?, 
        ?, ?, ?, ?
      )
    `, [
      s.frontpageTitle, s.frontpageSubtitle, JSON.stringify(s.rolePermissions || {}),
      s.inTheNewsText, s.inTheNewsGoogleDocUrl, s.featuredScholarId, s.featuredEntryId,
      JSON.stringify(s.editorialSelectionIds || []), s.announcementBanner, s.enableArabicAccent ? 1 : 0, s.layoutDensity,
      JSON.stringify(s.allowedSignatureFonts || []), JSON.stringify(s.featuredEssayIds || []), JSON.stringify(s.featuredNoteIds || []), s.worldClockHolidaysText,
      s.worldClockHolidaysGoogleDocUrl, s.researchFindingsText, s.researchFindingsGoogleDocUrl, s.masterPrompt
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

// GET /api/system/ai/slot_costs
app.get('/api/system/ai/slot_costs', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        COALESCE(p.slotIndex, -1) as slotIndex,
        COUNT(l.id) as aiCalls,
        SUM(l.promptTokens) as promptTokens,
        SUM(l.completionTokens) as completionTokens,
        SUM(l.estimatedCost) as tokenCost
      FROM ai_usage_logs l
      LEFT JOIN pipeline_logs p ON l.runId = p.runId AND p.slotIndex >= 0
      WHERE l.status = 'SUCCESS'
      GROUP BY p.slotIndex
      ORDER BY p.slotIndex ASC
    `);

    const slots = await dbAll("SELECT slotIndex, searchStrategy FROM slots_config WHERE layoutTemplateId = 'frontpage'");
    
    const breakdown = rows.map(r => {
      const slot = slots.find(s => s.slotIndex === r.slotIndex);
      const isGrounding = slot && (slot.searchStrategy === 'Search Only' || slot.searchStrategy === 'Structured Sources -> Search Fallback');
      
      const groundingCalls = isGrounding ? r.aiCalls : 0;
      const groundingCost = groundingCalls * 0.01;
      const totalCostUSD = r.tokenCost + groundingCost;

      return {
        slotIndex: r.slotIndex,
        aiCalls: r.aiCalls,
        groundingCalls,
        tokenCostUSD: r.tokenCost,
        groundingCostUSD: groundingCost,
        totalCostUSD
      };
    });

    res.json(breakdown);
  } catch (err) {
    console.error('Failed to fetch slot costs:', err);
    res.status(500).json({ error: 'Failed to fetch slot costs.' });
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

// Mount Modular Router Endpoints
app.use('/api/ai', createAIRoutes(dbAll, dbRun));
app.use('/api/system', createCategoryRoutes(db));
app.use('/api', createSystemRoutes(dbAll, dbRun, dbGet, safeJsonParse, mockDb));
app.use('/api/system', createSlotRoutes(dbAll, dbRun, dbGet, getGeometryCeilingForSlot, syncManualObjectsForSlot, runEditorialPipeline));

// Start Express Server
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API server running on http://localhost:${PORT}`);

  // Scheduler dalaman: server ni proses Node yang berjalan berterusan (bukan serverless), jadi
  // ini yang benar-benar mencetuskan "Kadar Segar Semula" (Daily/Weekly + jam) yang Izzat tetapkan
  // di Mini Editorium. Semak setiap 5 minit — cukup halus utk jam yang ditetapkan (cth 07:00) tanpa
  // membebankan pangkalan data. Server MESTI kekal berjalan (dev server / PM2 / dsb) utk ini berfungsi.
  const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;
  let lastRssAutoFetchTime = 0;
  const RSS_AUTO_FETCH_INTERVAL_MS = 3 * 60 * 60 * 1000; // Auto-refresh RSS every 3 hours (8x a day / 4 target windows)

  setInterval(() => {
    runAllScheduledSlots(false).catch((err) => {
      console.error('Internal scheduler run failed:', err);
    });

    const now = Date.now();
    if (now - lastRssAutoFetchTime >= RSS_AUTO_FETCH_INTERVAL_MS) {
      lastRssAutoFetchTime = now;
      console.log('[RSS Auto Scheduler] Triggering automated RSS Direct absorption...');
      executeDirectRssFetch(dbAll, dbGet, dbRun)
        .then((res) => console.log(`[RSS Auto Scheduler] Absorbed ${res.autoLiveCount} Auto-Live RSS items.`))
        .catch((err) => console.error('[RSS Auto Scheduler] Error:', err.message));
    }
  }, SCHEDULER_INTERVAL_MS);
  console.log(`Internal AI pipeline & RSS Direct scheduler active (checks every ${SCHEDULER_INTERVAL_MS / 60000} min).`);
});
