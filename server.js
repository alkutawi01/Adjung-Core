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
import { validateContentBudget, validateBidangTopik } from './core/editorial/ContentBudget.js';
import { ceilingForSlot as getGeometryCeilingForSlot, TIER_SLOTS, MAX_PENERANGAN_CHARS } from './core/editorial/GeometryConfig.js';
import { safeJsonParse } from './core/utils/jsonUtils.js';
import { detectSourceType } from './core/editorial/SourceDetector.js';
import { createAIRoutes } from './core/routes/aiRoutes.js';
import { createCategoryRoutes } from './core/routes/categoryRoutes.js';
import { createSystemRoutes } from './core/routes/systemRoutes.js';
import { createSlotRoutes, executeDirectRssFetch } from './core/routes/slotRoutes.js';
import { createAiCostRoutes } from './core/routes/aiCostRoutes.js';
import { createTranslationRoutes } from './core/routes/translationRoutes.js';
import { createChangelogRoutes } from './core/routes/changelogRoutes.js';
import { createMediaRoutes } from './core/routes/mediaRoutes.js';
import { createAuthRoutes, hashPassword } from './core/routes/authRoutes.js';
import { createDbStateRoutes } from './core/routes/dbStateRoutes.js';
import { createPipelineRoutes } from './core/routes/pipelineRoutes.js';
import { createWorldClockRoutes } from './core/routes/worldClockRoutes.js';
import { createSlotsConfigRoutes } from './core/routes/slotsConfigRoutes.js';
import { createTierSettingsRoutes, loadTierOverrides } from './core/routes/tierSettingsRoutes.js';
import { createLayoutRoutes } from './core/routes/layoutRoutes.js';
import { createContentRoutes } from './core/routes/contentRoutes.js';
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
            
            // Pindaan had aksara per-tier (2026-07-30). Menyimpan PINDAAN sahaja — tier tanpa
            // baris di sini guna nilai lalai GeometryConfig.js. Lihat core/routes/tierSettingsRoutes.js.
            db.run(`
              CREATE TABLE IF NOT EXISTS tier_settings (
                tierKey TEXT PRIMARY KEY,
                maxTitleAlone INTEGER,
                maxBriefAlone INTEGER,
                updatedAt TEXT
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

  // Each table's seed is gated on ITS OWN row count, independently — not on the users table as
  // a proxy for "is the whole database empty". A database can legitimately have zero users (e.g.
  // right after clearing test/mock accounts) while still holding real settings/content, and
  // treating that as "fresh database" would try to re-insert a settings-main row that already
  // exists and crash the process on a UNIQUE constraint violation (this happened in practice).
  const countRows = (table) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count FROM ${table}`, [], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  };

  const usersCount = await countRows('users');
  const settingsCount = await countRows('system_settings');

  if (usersCount === 0) {
    // Note: hashPassword() is defined further down this file (search "Password hashing"), but
    // function declarations aren't hoisted here since it's a const — this runs from
    // initializeSchema().then(() => seedDatabase()) at module load time, after the whole file
    // (including that const) has already been evaluated, so it's safe to reference here.
    const defaultUserSeedPassword = 'adjung-brief-' + crypto.randomBytes(4).toString('hex');
    // A single Chief Editor account (no multi-editor sign-in system yet; see .agents/AGENTS.md).
    // Previously called the undefined mockDb.getUsers(), which threw and crashed the whole
    // process on first run against any empty/fresh database file.
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users (id, username, email, role, penName, signature, avatarColor, bioSummary, isSuspended, password, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        'user-chief-editor', 'izzat', 'izzat@adjung.local', 'KETUA_EDITOR',
        'Izzat Anas', '', '#802334', 'Chief Editor, Adjung Brief', 0,
        hashPassword(defaultUserSeedPassword)
      ], (err) => {
        if (err) { console.error('Failed to seed Chief Editor account:', err.message); reject(err); return; }
        console.log(`Seeded Chief Editor account "izzat" with a random temporary password: ${defaultUserSeedPassword} — change this after first login.`);
        resolve();
      });
    });
  } else {
    console.log(`Users table already has ${usersCount} row(s). Skipping user seed.`);
  }

  if (settingsCount === 0) {
    await new Promise((resolve, reject) => {
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
      `, (err) => {
        if (err) { console.error('Failed to seed system_settings:', err.message); reject(err); return; }
        console.log('Seeded default system_settings row.');
        resolve();
      });
    });
  } else {
    console.log(`system_settings already has ${settingsCount} row(s). Skipping settings seed.`);
  }
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

// --- REST API ROUTES ---

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

    const globalPrompt = process.env.GLOBAL_PROMPT_PREFIX || 'Anda ialah editor kandungan profesional.';
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
              const transResult = await translatorInstance.generate(transPrompt, 'Anda ialah penterjemah profesional.');
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

// POST /api/system/pipeline/batch_paste
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
          // maxBriefLong: had aksara "Huraian Panjang" — ciri baharu untuk spotlight mode (belum
          // dibina), disimpan sekarang supaya kandungannya boleh mula dikumpul lebih awal.
          dbConn.run("ALTER TABLE slots_config ADD COLUMN maxBriefLong INTEGER", () => {});
          // editorial_attribute_values.attributeId has a FOREIGN KEY into editorial_attributes --
          // any new EAV attribute key (briefLong, originalDate) MUST be registered here first, or
          // every syncManualObjectsForSlot() insert using it throws SQLITE_CONSTRAINT and silently
          // aborts (caught + console.warn'd by the caller), dropping that slot's sync entirely.
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('briefLong', 'Huraian Panjang', 'text')", () => {});
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('originalDate', 'Tarikh Asal', 'text')", () => {});
          // sourceType: turut disimpan oleh syncManualObjectsForSlot() (attrs array) tapi sebelum ni
          // tak pernah didaftar di sini — setiap simpan slot manual gagal senyap dgn
          // SQLITE_CONSTRAINT (FK), DELETE+INSERT sebelumnya rolled back, kandungan slot kekal kosong.
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('sourceType', 'Jenis Sumber', 'text')", () => {});
          // topik: subbidang bebas-had per-kandungan (Bidang — 'desk' — terkunci per-slot; Topik
          // boleh berbeza antara item dalam slot yang sama). Sama corak macam sourceType di atas --
          // kena didaftar dulu di sini atau INSERT gagal senyap dgn FK constraint.
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('topik', 'Topik', 'text')", () => {});
          // Slot BAR sahaja: Penganjur/Lokasi/Akses (lihat Perlembagaan seksyen "Peraturan Khas
          // Slot Bar"). Sama corak macam briefLong/originalDate di atas — kena didaftar dulu di sini
          // sebelum syncManualObjectsForSlot() boleh simpannya, atau INSERT gagal senyap.
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('organizer', 'Penganjur', 'text')", () => {});
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('location', 'Lokasi', 'text')", () => {});
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('access', 'Akses', 'text')", () => {});
          // Penerangan: huraian tambahan slot Bar, belum dipaparkan di mana-mana (disediakan untuk
          // ciri akordion akan datang) — tiada had aksara dikuatkuasakan setakat ini sebab tiada
          // panel sebenar untuk diukur, sama macam briefLong sebelum ciri spotlight dibina.
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('penerangan', 'Penerangan', 'text')", () => {});
          // note/image: medan baharu Urus Slot (modal bento bukan-BAR) — nota dalaman (tak
          // disiarkan) dan lampiran imej Focus View per-kandungan. Sama corak macam
          // briefLong/topik di atas — kena didaftar dulu di sini atau INSERT gagal senyap.
          // "Tarikh sumber" (borang Urus Slot) memetakan kepada attributeId 'originalDate' sedia
          // ada (didaftar di atas sebagai 'Tarikh Asal') — bukan attribute baharu, sebab ia
          // konsep yang sama (tarikh bahan ASAL, bukan tarikh disiarkan Adjung).
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('note', 'Nota', 'text')", () => {});
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('image', 'Imej', 'text')", () => {});
          // editorName: nama editor SEBENAR yang log masuk semasa Terbit (2026-07-29, permintaan
          // pemilik projek) — berasingan daripada createdBy (token laluan-kod cth "manual-slot-save",
          // jawab *macam mana* dicipta, bukan *siapa*). Kandungan sedia ada sebelum ciri ni wujud
          // kekal kosong (papar "Tidak diketahui" di UI, bukan reka nama) — sama corak macam
          // sourceType/topik di atas, kena didaftar dulu di sini atau INSERT gagal senyap.
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('editorName', 'Nama Editor', 'text')", () => {});
          dbConn.run("ALTER TABLE slots_config ADD COLUMN manualDesk TEXT", () => {
            dbConn.run("ALTER TABLE slots_config ADD COLUMN nextRunAt INTEGER", () => {
              dbConn.run("ALTER TABLE slots_config ADD COLUMN refreshInterval INTEGER", () => {
                dbConn.run("ALTER TABLE slots_config ADD COLUMN lastAttemptAt TEXT", () => {
                  dbConn.run("ALTER TABLE slots_config ADD COLUMN lastSuccessfulRunAt TEXT", () => {
                    dbConn.run("ALTER TABLE slots_config ADD COLUMN lastRunStatus TEXT", () => {
                      dbConn.run("ALTER TABLE slots_config ADD COLUMN lastRunMessage TEXT", () => {
                        dbConn.run("ALTER TABLE editorial_revisions ADD COLUMN language TEXT DEFAULT 'ms'", () => {
                          dbConn.run("ALTER TABLE pipeline_logs ADD COLUMN runId TEXT", () => {
                            dbConn.run("ALTER TABLE system_settings ADD COLUMN worldClockIntervalSec INTEGER DEFAULT 60", () => {});
                            dbConn.run("ALTER TABLE system_settings ADD COLUMN worldClockBgClickEnabled INTEGER DEFAULT 1", () => {});
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
                                                // genMode: tab "Arahan AI" (Urus Slot) — 'bebas' atau 'dengan_rujukan', memberitahu
                                                // AI luaran sama ada jana bebas atau berdasarkan sumber rujukan. arahanKhas guna
                                                // semula lajur promptText sedia ada (bukan lajur baharu — sudah wujud & bermaksud sama).
                                                dbConn.run("ALTER TABLE slots_config ADD COLUMN genMode TEXT DEFAULT 'bebas'", () => {});
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
                                                    // isActive: Bidang kini senarai tertutup kurasi Ketua Editor (bukan lagi
                                                    // auto-daftar bebas) — 93 baris sedia ada kekal isActive=0 (tak dipadam,
                                                    // cuma tak boleh dipilih/dipapar lagi). GET /categories (sumber warna kad
                                                    // awam) terus baca SEMUA baris tanpa tapisan isActive — tak disentuh.
                                                    dbConn.run("ALTER TABLE CategoryRegistry ADD COLUMN isActive INTEGER NOT NULL DEFAULT 0", () => {
                                                    dbConn.run("ALTER TABLE CategoryRegistry ADD COLUMN icon TEXT", () => {
                                                    // iconSvg: markup SVG custom admin muat naik sendiri (disanitize di
                                                    // POST /categories/set-icon-svg sebelum simpan) — bila diisi, menang
                                                    // atas ikon lucide di `icon` (lihat BidangIcon di TetapanConsole.tsx).
                                                    dbConn.run("ALTER TABLE CategoryRegistry ADD COLUMN iconSvg TEXT", () => {
                                                    // illustrationSvg: plat ilustrasi BESAR bagi Bidang, dipapar dalam kolum
                                                    // kanan Focus View apabila kolum itu benar-benar kosong. SENGAJA medan
                                                    // berasingan daripada iconSvg: glif masthead 13px perlu bentuk ringkas
                                                    // dan tebal, plat bacaan ~240px perlu garis halus yang bernafas. Satu
                                                    // medan untuk dua tugas jadi kompromi yang salah pada kedua-dua saiz.
                                                    // Ditapis di POST /categories/set-illustration-svg (spec 256x256).
                                                    dbConn.run("ALTER TABLE CategoryRegistry ADD COLUMN illustrationSvg TEXT", () => {
                                                      // Ikon lalai (nama komponen lucide-react, kes Pascal) — rujukan visual di
                                                      // Taksonomi sahaja buat masa ini. Bidang baharu ditambah via "+ Tambah
                                                      // Bidang" tiada ikon lagi (null, fallback ke ikon generik di UI) sehingga
                                                      // ciri pilih/muat-naik ikon dibina.
                                                      const BIDANG_TERKURASI = [
                                                        ['Utama', 'Star'], ['Malaysiana', 'Flag'], ['Geopolitik', 'Globe2'],
                                                        ['Ekonomi', 'TrendingUp'], ['Bisnes', 'Briefcase'], ['Teknologi', 'Cpu'],
                                                        ['Sains', 'FlaskConical'], ['Perubatan', 'Stethoscope'], ['Pendidikan', 'GraduationCap'],
                                                        ['Perundangan', 'Scale'], ['Al-Quran dan Sunnah', 'MoonStar'], ['Syariah', 'BookMarked'],
                                                        ['Falsafah', 'Lightbulb'], ['Psikologi', 'Brain'], ['Bahasa', 'Languages'],
                                                        ['Sastera', 'Feather'], ['Sejarah', 'ScrollText'], ['Geografi', 'Map'],
                                                        ['Alam Sekitar', 'Leaf'], ['Angkasa', 'Rocket'], ['Seni Reka Bentuk', 'Palette'],
                                                        ['Budaya', 'Drama'], ['Sukan', 'Trophy'], ['Matematik', 'Sigma']
                                                      ];
                                                      // Seed idempotent (activateCategory cari-atau-cipta ikut slug, paksa nama
                                                      // & isActive=1) — selamat jalan setiap kali server start, tak cipta
                                                      // baris pendua, dan betulkan casing lama (cth "EKONOMI" -> "Ekonomi").
                                                      (async () => {
                                                        for (const [name, icon] of BIDANG_TERKURASI) {
                                                          try {
                                                            await CategoryRegistry.activateCategory(dbConn, name, null, icon);
                                                          } catch (e) {
                                                            console.warn(`Gagal seed Bidang "${name}":`, e.message);
                                                          }
                                                        }
                                                      })();
                                                    });
                                                    });
                                                    });
                                                    });
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

// Helper function to resolve active layout slots
const parseManualSummaryTemplate = (summaryText, defaultSlot) => {
  // Rentetan kosong ('') bermaksud pengedit (SlotManagerModal, giliran berasaskan `items`) sengaja
  // mengosongkan SEMUA kandungan — mesti dilayan sebagai kosong sebenar (0 item), bukan jatuh
  // balik ke format lama guna manualTitle/manualSummary usang slot (nilai yang mungkin dah lapuk
  // sejak borang dibuka, menyebabkan kandungan "dipadam" muncul semula pada simpan). Fallback
  // format-lama hanya sah bila medan tu langsung tiada (undefined/null) — cth laluan lama yang
  // tak pernah hantar manualSummary sama sekali.
  if (summaryText === undefined || summaryText === null) {
    return [{
      title: defaultSlot.manualTitle || '',
      summary: defaultSlot.manualSummary || '',
      url: defaultSlot.manualUrl || '#',
      desk: defaultSlot.manualDesk || 'general',
      source: defaultSlot.manualSource || '',
      publishedAt: defaultSlot.lastAttemptAt || new Date().toISOString()
    }];
  }
  if (!summaryText.trim()) {
    return [];
  }
  if (!summaryText.includes('Tajuk:') && !summaryText.includes('Event:')) {
    return [{
      title: defaultSlot.manualTitle || '',
      summary: defaultSlot.manualSummary || '',
      url: defaultSlot.manualUrl || '#',
      desk: defaultSlot.manualDesk || 'general',
      source: defaultSlot.manualSource || '',
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
    let topik = '';
    let date = '';
    let source = '';
    let url = '';
    let sourceType = '';
    let isEventBlock = false;
    // LALAI 'approved' (BUKAN 'draft') bila tiada baris "Status:" — blok lama yang disimpan
    // sebelum ciri Draf/Terbit wujud memang live, tiada satu pun ada label ni. Lihat nota sama
    // di ManualBlockFormat.js parseManualBlockFields — DUA salinan penghurai (server.js ni +
    // ManualBlockFormat.js untuk client) mesti kekal selari, sengaja tak disatukan sesi ni
    // (risiko lebih tinggi daripada faedah dalam skop kerja semasa).
    let status = 'approved';

    let organizer = '';
    let location = '';
    let access = '';
    let penerangan = '';
    let note = '';
    let image = '';

    // Blok kandungan manual membawa petunjuk had aksara dalam teksnya sendiri, cth
    // "Tajuk: (had 168 aksara) ..." — ditulis dan dikemas kini oleh updateLimitsInText() di
    // FrontpageView.tsx. Petunjuk itu alat bantu penyunting, BUKAN kandungan editorial.
    //
    // Penghurai dahulu cuma membuang label di hadapan (^Tajuk:\s*), jadi petunjuk itu terus masuk
    // ke dalam nilai. Editor yang menaip selepas petunjuk mendapat tajuk berbunyi
    // "(had 168 aksara) Percubaan Sahaja"; yang menaip sebelumnya mendapat
    // "Percubaan (had 23 aksara)". Kedua-duanya tersimpan dan tersiar sebagai teks sebenar.
    //
    // Dibuang di mana-mana dalam baris, bukan di hadapan sahaja, kerana penyunting menaip pada
    // kedua-dua belah petunjuk itu.
    const buangPetunjukHad = (s) => s
      .replace(/\(\s*had\s*\d+\s*aksara\s*\)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('UUID:')) {
        uuid = trimmed.replace(/^UUID:\s*/i, '').trim();
      } else if (trimmed.startsWith('Status:')) {
        const raw = trimmed.replace(/^Status:\s*/i, '').trim().toLowerCase();
        if (raw === 'draf' || raw === 'draft') status = 'draft';
        else if (raw === 'pending' || raw === 'menunggu') status = 'pending';
        else status = 'approved';
      } else if (trimmed.startsWith('Tajuk:')) {
        title = buangPetunjukHad(trimmed.replace(/^Tajuk:\s*/i, ''));
      } else if (trimmed.startsWith('Event:')) {
        title = trimmed.replace(/^Event:\s*/i, '').trim();
        desk = 'ACARA'; // Default desk untuk event
        isEventBlock = true;
      } else if (trimmed.startsWith('Huraian panjang:')) {
        briefLong = buangPetunjukHad(trimmed.replace(/^Huraian panjang:\s*/i, ''));
      } else if (trimmed.startsWith('Huraian ringkas:')) {
        brief = buangPetunjukHad(trimmed.replace(/^Huraian ringkas:\s*/i, ''));
      } else if (trimmed.startsWith('Huraian:')) {
        brief = buangPetunjukHad(trimmed.replace(/^Huraian:\s*/i, ''));
      } else if (trimmed.startsWith('Bidang:')) {
        desk = trimmed.replace(/^Bidang:\s*/i, '').trim();
      } else if (trimmed.startsWith('Kategori:')) {
        desk = trimmed.replace(/^Kategori:\s*/i, '').trim();
      } else if (trimmed.startsWith('Topik:')) {
        topik = buangPetunjukHad(trimmed.replace(/^Topik:\s*/i, ''));
      } else if (trimmed.startsWith('Jenis sumber:')) {
        sourceType = trimmed.replace(/^Jenis sumber:\s*/i, '').trim();
      } else if (trimmed.startsWith('Tarikh sumber:')) {
        date = trimmed.replace(/^Tarikh sumber:\s*/i, '').trim();
      } else if (trimmed.startsWith('Tarikh:')) {
        date = trimmed.replace(/^Tarikh:\s*/i, '').trim();
      } else if (trimmed.startsWith('Nota:')) {
        note = trimmed.replace(/^Nota:\s*/i, '').trim();
      } else if (trimmed.startsWith('Imej:')) {
        image = trimmed.replace(/^Imej:\s*/i, '').trim();
      } else if (trimmed.startsWith('Penganjur:')) {
        organizer = trimmed.replace(/^Penganjur:\s*/i, '').trim();
      } else if (trimmed.startsWith('Lokasi:')) {
        location = trimmed.replace(/^Lokasi:\s*/i, '').trim();
      } else if (trimmed.startsWith('Akses:')) {
        access = trimmed.replace(/^Akses:\s*/i, '').trim();
      } else if (trimmed.startsWith('Penerangan:')) {
        penerangan = trimmed.replace(/^Penerangan:\s*/i, '').trim();
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
        uuid,
        status,
        title,
        summary: brief,
        briefLong,
        desk: desk || defaultSlot.manualDesk || 'general',
        topik: topik.replace(/^\([^)]+\)\s*/g, '').trim(),
        sourceType: finalSourceType,
        organizer: organizer || source || '',
        location,
        access,
        penerangan,
        note,
        image,
        source: organizer || source || defaultSlot.manualSource || '',
        // TIADA fallback ke defaultSlot.manualUrl/'#' di sini lagi (2026-07-29) — defaultSlot.manualUrl
        // ialah medan LEGASI peringkat SLOT yang useSlotEditor.ts set lalai '#' setiap kali modal
        // dibuka, jadi fallback ke situ mencemari URL kosong SETIAP kandungan (termasuk draf yang
        // tak pernah disentuh) dengan "#" secara senyap, kekal dalam DB walaupun sebelum Terbit.
        // Pengguna hiliran (attrs Indeks di baris ~1992, renderToken di baris ~2128) sudah ada
        // fallback '#' sendiri untuk paparan/pautan kad — cukup, tak perlu diulang di sini.
        url: url || '',
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
    source: defaultSlot.manualSource || '',
    publishedAt: defaultSlot.lastAttemptAt || new Date().toISOString()
  }];
};

// Serializes ONE draft item back into the Label: value block format — mirrors
// ManualBlockFormat.js's serializeManualBentoItem (client copy), kept in sync manually (same
// existing duplication pattern as parseManualSummaryTemplate above). Only used for items staying
// in slots_config.manualSummary as drafts; published items never round-trip through this.
const serializeDraftBlock = (item) => [
  `UUID: ${item.uuid || ''}`,
  `Status: draf`,
  `Tajuk: ${item.title || ''}`,
  `Topik: ${item.topik || ''}`,
  `Huraian ringkas: ${item.summary || ''}`,
  `Huraian panjang: ${item.briefLong || ''}`,
  `Sumber: ${item.source || ''}`,
  `URL: ${item.url || ''}`,
  `Tarikh sumber: ${item.originalDate || ''}`,
  `Imej: ${item.image || ''}`,
  `Nota: ${item.note || ''}`,
].join('\n');
const DRAFT_BLOCK_SEPARATOR = '\n\n________________________________________\n\n';

// Keeps editorial_objects/editorial_revisions/editorial_attribute_values in sync with a Manual-mode
// slot's manualSummary, AND returns the manualSummary text that should actually be PERSISTED back
// to slots_config (the caller, POST /api/system/slots, must use this return value instead of the
// raw submitted text — see nota di situ).
//
// Alur kerja Draf/Terbit (2026-07-29, permintaan pemilik projek) — manualSummary kini ruang DRAF
// PERIBADI SAHAJA, bukan tempat kandungan live/pending "tersangkut" selama-lamanya:
//   - status='draft': TIADA baris editorial_objects/editorial_revisions dicipta langsung — kekal
//     hidup HANYA sebagai teks dalam manualSummary (draf peribadi, tak pernah muncul di Indeks).
//   - status lain (Terbitkan diklik, 'pending'/'approved'): disahkan penuh macam sebelum ni,
//     dicipta/dikemas kini sebagai baris rasmi editorial_objects/editorial_revisions, dan
//     DIKELUARKAN daripada manualSummary — ia sekarang rekod Indeks rasmi, bukan draf lagi.
//   - Slot Bar dikecualikan (belum disokong ciri ni — kekal 100% tingkah laku lama).
const syncManualObjectsForSlot = async (slotIndex, manualSummary, slotConfig) => {
  const items = parseManualSummaryTemplate(manualSummary || '', slotConfig);
  const isBar = TIER_SLOTS.BAR.includes(slotIndex);

  // Hard-block: content that exceeds its card's shared title+brief space budget must never be
  // published, since it breaks the card's size/legibility. Every slot of the same geometry tier
  // is validated by the exact same rule — see core/editorial/ContentBudget.js. Validate ALL items
  // before touching the DB, so a rejected save leaves whatever was already there untouched (no
  // DELETE ever runs on failure).
  const ceiling = getGeometryCeilingForSlot(slotIndex);
  const effectiveMaxBriefLong = typeof slotConfig.maxBriefLong === 'number' ? slotConfig.maxBriefLong : ceiling.maxBriefLong;
  const isDraft = (item) => !isBar && item.status === 'draft';
  for (const item of items) {
    // Draf sengaja TIDAK disahkan — kerja belum siap, tak sesekali live, jadi tiada sebab sekat
    // simpan draf tak lengkap.
    if (isDraft(item)) continue;
    const budgetCheck = validateContentBudget(slotIndex, item.title, item.summary);
    if (!budgetCheck.isValid) {
      const err = new Error(`"${(item.title || '').slice(0, 40)}...": ${budgetCheck.reason} Kandungan tidak disiarkan.`);
      err.isValidationError = true;
      throw err;
    }
    if (effectiveMaxBriefLong && item.briefLong && item.briefLong.length > effectiveMaxBriefLong) {
      const err = new Error(`Huraian panjang bagi "${item.title.slice(0, 40)}..." melebihi had ${effectiveMaxBriefLong} aksara (semasa: ${item.briefLong.length}). Kandungan tidak disiarkan — pendekkan huraian dahulu.`);
      err.isValidationError = true;
      throw err;
    }
    // Peraturan Khas Slot Bar — Penerangan diisi ke panel akordion (BarCardExpandedPanel.tsx),
    // jadi perlu had ruang sebenar sama macam Huraian Panjang di atas.
    if (isBar && item.penerangan && item.penerangan.length > MAX_PENERANGAN_CHARS) {
      const err = new Error(`Penerangan bagi "${(item.title || '').slice(0, 40)}..." melebihi had ${MAX_PENERANGAN_CHARS} aksara (semasa: ${item.penerangan.length}). Kandungan tidak disiarkan — pendekkan penerangan dahulu.`);
      err.isValidationError = true;
      throw err;
    }
    // Bidang (kategori) terkunci per-slot, Topik wajib untuk kandungan baharu/diedit — kecuali
    // slot BAR (Perlembagaan: Bidang/Topik tak terpakai untuk tier ni).
    if (!isBar) {
      const bidangTopikCheck = validateBidangTopik({
        slotBidang: slotConfig.manualDesk,
        itemBidang: item.desk,
        topik: item.topik,
        requireTopik: true,
        slotIndex,
      });
      if (!bidangTopikCheck.isValid) {
        const err = new Error(`"${(item.title || '').slice(0, 40)}...": ${bidangTopikCheck.reason}`);
        err.isValidationError = true;
        throw err;
      }
    }
  }

  // Slot Bar: tingkah laku LAMA tidak disentuh langsung (semua item, DELETE-semua-INSERT-semula
  // macam sebelum ni, tiada pemisahan draf/terbit). Draf/Terbit belum disokong untuk tier ni.
  const publishItems = isBar ? items : items.filter((it) => !isDraft(it));
  const draftItems = isBar ? [] : items.filter(isDraft);

  // Bukan Bar: publishItems ialah draf yang BARU SAHAJA diterbitkan sesi simpan ni — SETIAP
  // satu MESTI jadi baris editorial_objects BAHARU, tak boleh sentuh/arkib rekod SEDIA ADA
  // dalam slot (kandungan live/pending lain diurus sepenuhnya oleh Indeks, bukan modal Tulis
  // Kandungan — manualSummary/modal ni cuma pernah nampak DRAF, jadi ketiadaan sesuatu item
  // rasmi dalam giliran draf TAK PERNAH bermaksud "dibuang editor", ia cuma tak pernah tergolong
  // draf pun. Pepijat sebenar ditemui semasa ujian 2026-07-29: "arkib item dibuang" (logik lama,
  // sah untuk Bar) tersalah guna di sini, terus mengarkibkan SEMUA kandungan live sedia ada
  // dalam slot setiap kali SATU draf baharu diterbitkan.
  const isBarLikeRemoval = isBar;
  const submittedIds = new Set(items.filter((it) => it.uuid).map((it) => it.uuid));
  const existingRows = isBarLikeRemoval ? await dbAll('SELECT id FROM editorial_objects WHERE slotIndex = ?', [slotIndex]) : [];
  const removedIds = isBarLikeRemoval ? existingRows.map((r) => r.id).filter((id) => !submittedIds.has(id)) : [];

  // Wrap the DELETE + multi-item multi-table INSERT sequence in a real transaction so a failure
  // partway through (e.g. one item's INSERT throws) rolls back everything already written in this
  // call — including the DELETE — instead of leaving the slot with orphaned/partial rows.
  await dbRun('BEGIN TRANSACTION');
  try {
    const nowIso = new Date().toISOString();
    if (isBarLikeRemoval) {
      for (const id of removedIds) {
        await dbRun(
          `UPDATE editorial_revisions SET status = 'archived', updatedAt = ? WHERE objectId = ? AND status IN ('approved', 'pending')`,
          [nowIso, id]
        );
      }
      if (removedIds.length > 0) {
        const placeholders = removedIds.map(() => '?').join(',');
        await dbRun(`DELETE FROM editorial_objects WHERE slotIndex = ? AND id NOT IN (${placeholders})`, [slotIndex, ...removedIds]);
      } else {
        await dbRun('DELETE FROM editorial_objects WHERE slotIndex = ?', [slotIndex]);
      }
    }

    // Bukan Bar: objectId SENTIASA baharu (bukan item.uuid, yang cuma identiti sementara dalam
    // teks draf) — draf tak pernah punya baris editorial_objects sedia ada untuk "dikemas kini",
    // setiap "Terbitkan" ialah rekod Indeks BAHARU.
    const baseTs = Date.now();
    for (let i = 0; i < publishItems.length; i++) {
      const item = publishItems[i];
      const objectId = isBar ? (item.uuid || `object-manual-slot${slotIndex}-${baseTs}-${i}`) : `object-manual-slot${slotIndex}-${baseTs}-${i}`;
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
      // Bukan Bar: tiada lagi 'approved' terus daripada laluan ni — "Terbitkan" sentiasa
      // mendarat sebagai 'pending', menunggu kelulusan Ketua Editor di Indeks (atau auto-terbit,
      // sistem tu belum wujud). Slot Bar kekal guna status yang dihurai terus (lama).
      const finalStatus = isBar ? (item.status || 'approved') : 'pending';
      const rev = await dbRun(
        `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
         VALUES (?, 1.0, 'ms', ?, ?, ?, 'manual-slot-save', ?, ?)`,
        [objectId, item.title, item.summary, finalStatus, createdAt, createdAt]
      );
      const revisionId = rev.lastID;

      const attrs = [
        { key: 'desk', val: finalCategory },
        { key: 'url', val: item.url || '#' },
        { key: 'source', val: item.source || '' },
        { key: 'sourceType', val: item.sourceType || 'web' },
        { key: 'briefLong', val: item.briefLong || '' },
        { key: 'originalDate', val: item.originalDate || '' },
        // Topik: kosong untuk slot BAR (tak terpakai di sana), diabaikan macam Penerangan berikut.
        { key: 'topik', val: item.topik || '' },
        // Nama editor SEBENAR yang log masuk semasa Terbit (2026-07-29) — dihantar dari klien
        // sebagai slotConfig.editorName (lihat useSlotEditor.ts handleSaveSlot), BUKAN per-item
        // (satu sesi Simpan/Terbit = satu editor log masuk sahaja).
        { key: 'editorName', val: slotConfig.editorName || '' },
        // Slot BAR sahaja (Peraturan Khas Slot Bar) — diabaikan (string kosong) untuk tier lain.
        { key: 'organizer', val: item.organizer || '' },
        { key: 'location', val: item.location || '' },
        { key: 'access', val: item.access || '' },
        { key: 'penerangan', val: item.penerangan || '' },
        { key: 'note', val: item.note || '' },
        { key: 'image', val: item.image || '' },
      ];
      for (const a of attrs) {
        await dbRun(
          `INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText)
           VALUES (?, ?, ?, ?)`,
          [objectId, revisionId, a.key, a.val]
        );
      }
    }
    await dbRun('COMMIT');
  } catch (e) {
    try {
      await dbRun('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed after syncManualObjectsForSlot error:', rollbackErr.message);
    }
    throw e;
  }

  // Slot Bar: manualSummary kekal sama macam dihantar (tiada pemisahan draf). Bukan Bar:
  // manualSummary yang PATUT disimpan balik ke slots_config ialah draf SAHAJA — item publishItems
  // dah jadi rekod Indeks rasmi, tak patut tersangkut dalam teks giliran modal lagi.
  return isBar ? (manualSummary || '') : draftItems.map(serializeDraftBlock).join(DRAFT_BLOCK_SEPARATOR);
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

    // Only fall back to parsing the legacy manualSummary blob if this slot has genuinely never
    // been migrated to real DB rows. If migrated rows exist but happen to all be currently
    // pending/rejected/archived (e.g. via Indeks' Reject/Arkib action), that's a deliberate
    // editorial decision — falling back to the blob would silently resurrect stale duplicate
    // content the chief editor just pulled, defeating the whole point of the status action.
    let slotHasMigratedRows = objectIds.length > 0;
    if (!slotHasMigratedRows) {
      try {
        const anyRow = await dbGet(`
          SELECT eo.id FROM editorial_objects eo
          INNER JOIN editorial_revisions er ON er.objectId = eo.id
          WHERE eo.slotIndex = ? AND er.createdBy IN ('manual-slot-save', 'migration-manual-blob', 'content-review')
          LIMIT 1
        `, [slot.slotIndex]);
        slotHasMigratedRows = !!anyRow;
      } catch (e) {
        console.error(e);
      }
    }

    if (objectIds.length === 0 && !slotHasMigratedRows) {
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
          topik: parsed.topik || '',
          publisherName: renderToken.publisherName || parsed.source || 'Umum',
          source: renderToken.publisherName || parsed.source || 'Umum',
          url: renderToken.sourceUrl || renderToken.url || parsed.url || '#',
          glyphProfile: renderToken.glyphProfile || null,
          presentationProfile: renderToken.presentationProfile || 'umum',
          publicationType: renderToken.publicationType || 'news',
          isOfficial: renderToken.isOfficial || false,
          aiProvider: null,
          imageUrl: slot.manualImageUrl || '',
          // Peraturan Khas Slot Bar — kosong ('') untuk tier lain, tiada kesan pada paparan mereka.
          organizer: parsed.organizer || '',
          location: parsed.location || '',
          access: parsed.access || '',
          penerangan: parsed.penerangan || ''
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
      const topikAv = avs.find(a => a.attributeId === 'topik');
      // briefLong: dihurai daripada blok manual, disahkan terhadap had tier, dan disimpan ke
      // editorial_attribute_values — DIBACA SEMULA di sini sejak commit "pulangkan briefLong
      // dalam layout/active" (lihat git log). Focus View membaca focusItem.briefLong betul-betul
      // daripada nilai yang dipulangkan di bawah.
      const briefLongAv = avs.find(a => a.attributeId === 'briefLong');
      const organizerAv = avs.find(a => a.attributeId === 'organizer');
      const locationAv = avs.find(a => a.attributeId === 'location');
      const accessAv = avs.find(a => a.attributeId === 'access');
      const peneranganAv = avs.find(a => a.attributeId === 'penerangan');
      const noteAv = avs.find(a => a.attributeId === 'note');
      const imageAv = avs.find(a => a.attributeId === 'image');

      subItems.push({
        title: approvedRevision.title,
        brief: approvedRevision.summary,
        publishedAt: approvedRevision.createdAt,
        originalDate: origDateAv ? origDateAv.valueText : '',
        briefLong: briefLongAv ? briefLongAv.valueText : '',
        desk: (renderToken.desk || 'UMUM').toUpperCase(),
        topik: topikAv ? topikAv.valueText : '',
        publisherName: renderToken.publisherName || 'Umum',
        source: renderToken.publisherName || 'Umum',
        // PresentationComposer's token names this field sourceUrl, not url — this fallback
        // chain avoids silently dropping every DB-backed item's click-through link to '#'.
        url: renderToken.sourceUrl || renderToken.url || '#',
        glyphProfile: renderToken.glyphProfile || null,
        presentationProfile: renderToken.presentationProfile || 'umum',
        publicationType: renderToken.publicationType || 'news',
        isOfficial: renderToken.isOfficial || false,
        aiProvider: aiProv ? aiProv.valueText : null,
        imageUrl,
        // Peraturan Khas Slot Bar — kosong ('') untuk tier lain, tiada kesan pada paparan mereka.
        organizer: organizerAv ? organizerAv.valueText : '',
        location: locationAv ? locationAv.valueText : '',
        access: accessAv ? accessAv.valueText : '',
        penerangan: peneranganAv ? peneranganAv.valueText : '',
        note: noteAv ? noteAv.valueText : '',
        image: imageAv ? imageAv.valueText : ''
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
// --- CONTENT REVIEW (aggregate cross-slot listing/editing over editorial_objects) ---

// Mount Modular Router Endpoints
app.use('/api/ai', createAIRoutes(dbAll, dbRun, dbGet));
app.use('/api/system', createCategoryRoutes(db));
app.use('/api', createSystemRoutes(dbAll, dbRun, dbGet, safeJsonParse, mockDb));
app.use('/api/system', createSlotRoutes(dbAll, dbRun, dbGet));
app.use('/api/system/ai', createAiCostRoutes(dbAll, dbGet, dbRun));
app.use('/api/translation', createTranslationRoutes(dbAll, dbRun));
app.use('/api/system', createChangelogRoutes(__dirname));
app.use('/api/media', createMediaRoutes(__dirname));
app.use('/api/auth', createAuthRoutes(dbGet, dbRun));
app.use('/api', createDbStateRoutes(dbAll, dbGet));
app.use('/api/system', createPipelineRoutes(db, dbGet, dbRun, runEditorialPipeline, runAllScheduledSlots));
app.use('/api/system', createSlotsConfigRoutes(db, dbAll, dbRun, syncManualObjectsForSlot));
app.use('/api/system', createLayoutRoutes(db, dbAll, resolveSlotContent));
app.use('/api/system', createContentRoutes(db, dbAll, dbGet, dbRun));
app.use('/api/system', createWorldClockRoutes());
app.use('/api/system', createTierSettingsRoutes(dbAll, dbRun));

// Pindaan had aksara tier dimuatkan SEKALI semasa boot, kemudian dimuat semula setiap kali
// disimpan (lihat tierSettingsRoutes.js) — validateContentBudget() sync, jadi ia baca cache
// dalam-memori ni, bukan pangkalan data pada setiap pengesahan.
loadTierOverrides(dbAll).then(map => {
  const bil = Object.keys(map).length;
  if (bil) console.log(`Pindaan had aksara tier dimuatkan: ${bil} tier.`);
});

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
