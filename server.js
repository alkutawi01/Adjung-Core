import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import EditorialPipeline from './core/editorial/EditorialPipeline.js';
import PresentationComposer from './core/presentation/PresentationComposer.js';
import CategoryRegistry from './core/category/CategoryRegistry.js';
import { validateContentBudget, validateBidangTopik, validateMedanTambahan, validateSourceUrl } from './core/editorial/ContentBudget.js';
import { ceilingForSlot as getGeometryCeilingForSlot, TIER_SLOTS, MAX_PENERANGAN_CHARS, MIN_BRIEF_LONG_CHARS } from './core/editorial/GeometryConfig.js';
import { safeJsonParse } from './core/utils/jsonUtils.js';
import { detectSourceType } from './core/editorial/SourceDetector.js';
import { checkAllSourceLinks } from './core/editorial/LinkChecker.js';
import { createAIRoutes } from './core/routes/aiRoutes.js';
import { createCategoryRoutes } from './core/routes/categoryRoutes.js';
import { createSystemRoutes } from './core/routes/systemRoutes.js';
import { createSlotRoutes, executeDirectRssFetch } from './core/routes/slotRoutes.js';
import { createAiCostRoutes } from './core/routes/aiCostRoutes.js';
import { createTranslationRoutes } from './core/routes/translationRoutes.js';
import { createChangelogRoutes } from './core/routes/changelogRoutes.js';
import { createMediaRoutes } from './core/routes/mediaRoutes.js';
import { createAuthRoutes, hashPassword } from './core/routes/authRoutes.js';
import { daftarStorSesi } from './core/auth/SesiPengguna.js';
import { createDbStateRoutes } from './core/routes/dbStateRoutes.js';
import { createPipelineRoutes } from './core/routes/pipelineRoutes.js';
import { createWorldClockRoutes } from './core/routes/worldClockRoutes.js';
import { createSlotsConfigRoutes } from './core/routes/slotsConfigRoutes.js';
import { createTierSettingsRoutes, loadTierOverrides } from './core/routes/tierSettingsRoutes.js';
import { createSlotEditorRoutes } from './core/routes/slotEditorRoutes.js';
import { createDraftRoutes } from './core/routes/draftRoutes.js';
import { createViewStatsRoutes } from './core/routes/viewStatsRoutes.js';
import { createEditorNotesRoutes } from './core/routes/editorNotesRoutes.js';
import { createGlosariRoutes } from './core/routes/glosariRoutes.js';
import { createEjaanRoutes } from './core/routes/ejaanRoutes.js';
import { createProfileRoutes } from './core/routes/profileRoutes.js';
import { createSlotAmRoutes, loadAmSettings, getAmSettings } from './core/routes/slotAmRoutes.js';
import { createUserAdminRoutes } from './core/routes/userAdminRoutes.js';
import { createAuditLogRoutes } from './core/routes/auditLogRoutes.js';
import { createLayoutRoutes } from './core/routes/layoutRoutes.js';
import { createUiLabelRoutes } from './core/routes/uiLabelRoutes.js';
import { SEMUA_LABEL_LALAI } from './src/config/istilah.ts';
import { createContentRoutes, runSchedulingTick } from './core/routes/contentRoutes.js';
import { createNotificationRoutes } from './core/routes/notificationRoutes.js';
import { createSitemapRoutes } from './core/routes/sitemapRoutes.js';
import { createRssFeedRoutes } from './core/routes/rssFeedRoutes.js';
import { createArticleUrlRoutes, createPublicArticleRoute } from './core/routes/articleUrlRoutes.js';
import { createSearchRoutes } from './core/routes/searchRoutes.js';
import { createSponsorRoutes } from './core/routes/sponsorRoutes.js';
import { semakKonfigSmtpStartup, hantarEmel } from './core/email/MailSender.js';
import { requireAuthForWrites, loadRolePermissions } from './core/middleware/auth.js';
import { logAudit } from './core/audit/AuditLog.js';
import { notify, notifyMany } from './core/notifications/Notify.js';
const mockDb = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Deploy produksi (2026-08-03) letak nginx sebagai reverse proxy — tanpa `trust proxy`,
// express-rate-limit menolak setiap permintaan (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) sebab
// header X-Forwarded-For nginx wujud tapi Express tak dikonfigur untuk percayainya. Nilai `1`
// bermakna percaya SATU proksi terdekat sahaja (nginx tempatan), bukan rantaian tak terhad.
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));

// Sesi sesi editor (2026-08-02, Fasa 1 keselamatan) — sebelum ini sesi hanya wujud sebagai
// blob JSON dalam localStorage pelanggan (boleh diubah sendiri jadi role: 'KETUA_EDITOR').
// SESSION_SECRET mesti ditetapkan di .env untuk deploy sebenar; nilai rawak dijana setiap kali
// server bermula sebagai jaring keselamatan dev SAHAJA — ini bermakna semua sesi terputus setiap
// kali server dimulakan semula tanpa SESSION_SECRET tetap, sengaja, supaya kelalaian tak senyap.
if (!process.env.SESSION_SECRET) {
  console.warn('AMARAN: SESSION_SECRET tiada dalam .env — guna rahsia rawak sementara (sesi akan hilang setiap kali server dimulakan semula). Tetapkan SESSION_SECRET sebelum deploy.');
}
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Storan sesi berterusan (2026-08-06) — dahulu MemoryStore lalai express-session (amaran rasmi:
// "not designed for a production environment, will leak memory"), yang bermakna SEMUA pengguna
// log masuk ter-logout serentak setiap kali proses PM2 di-restart (deploy, crash-recovery, dsb.).
// SQLite dipilih (bukan Redis) sebab stack ni dah guna SQLite untuk semua data lain — tiada infra
// tambahan diperlukan. Fail berasingan daripada adjung.db (bukan jadual dalam DB yang sama) supaya
// backup automatik adjung.db (di atas) tak perlu peduli jadual sesi yang tak relevan padanya.
const SQLiteStore = connectSqlite3(session);
// connect-sqlite3@0.9 jangka `db` sebagai instance sqlite3.Database HIDUP, bukan nama fail —
// versi API lama (dir+db sebagai string) tak dipakai versi ni, ditemui via TypeError
// "this.db.exec is not a function" semasa ujian pertama.
const sessionDb = new sqlite3.Database(path.join(__dirname, 'sessions.db'));
// Stor sesi didaftarkan supaya laluan tukar kata laluan boleh membatalkan sesi lama akaun
// berkenaan (core/auth/SesiPengguna.js).
daftarStorSesi(sessionDb);
app.use(session({
  store: new SQLiteStore({ db: sessionDb }),
  name: 'adjung.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000, // 12 jam
  },
}));

// Had kadar log masuk (2026-08-02) — dahulu tiada had langsung, cubaan kata laluan tanpa had.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak cubaan log masuk. Cuba lagi selepas beberapa minit.' },
});
app.use('/api/auth/login', loginRateLimiter);

// Had kadar lupa-kata-laluan (2026-08-03, Fasa 1) — sama corak had log masuk, elak seseorang
// spam permintaan emel reset untuk sesuatu akaun (atau imbas emel berdaftar melalui masa respons).
const lupaKataLaluanRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Jika emel ini berdaftar, pautan set semula telah dihantar.' },
});
app.use('/api/auth/lupa-kata-laluan', lupaKataLaluanRateLimiter);

// Had kadar aktifkan-akaun (2026-08-06, audit) — laluan tebus token (jemputan editor & set semula
// kata laluan) ialah satu-satunya laluan auth awam yang tertinggal tanpa had. Token 256-bit
// menjadikan tekaan kasar tak praktikal, jadi ini bukan lubang kritikal — tapi tanpa had, laluan
// ni boleh dispam percuma (kos CPU scrypt setiap percubaan). Had lebih longgar daripada log masuk
// sebab editor sah mungkin tersilap beberapa kali semasa menetapkan kata laluan pertama.
const aktifkanAkaunRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak cubaan. Cuba lagi selepas beberapa minit.' },
});
app.use('/api/auth/aktifkan-akaun', aktifkanAkaunRateLimiter);

// ADJUNG_DB_PATH (2026-08-07) — membolehkan pelayan dihidupkan terhadap pangkalan data BUANGAN
// untuk simulasi/ujian, tanpa menyentuh adjung.db sebenar. Lalai kekal betul-betul sama seperti
// dahulu, jadi produksi tak terjejas langsung. Ini yang membolehkan ujian "DB BAHARU" — satu
// kelas pepijat (atribut tak berdaftar, baris yang diandaikan wujud) HANYA menampakkan diri pada
// pangkalan data kosong, bukan pada adjung.db yang sudah mewarisi baris daripada seed lama.
const dbPath = process.env.ADJUNG_DB_PATH
  ? path.resolve(process.env.ADJUNG_DB_PATH)
  : path.join(__dirname, 'adjung.db');
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
  // 2026-08-02 (Fasa 2, pepijat kritikal) — dahulu tiada WAL/busy_timeout langsung. Mod jurnal
  // lalai SQLite (rollback journal) mengunci SELURUH DB semasa satu penulisan; dua editor
  // menyimpan hampir serentak akan buat SATU permintaan terus gagal SQLITE_BUSY dalam SAAT,
  // dan sebab tiada pengendali ralat/log permintaan (dulu), kegagalan tu senyap sepenuhnya.
  // WAL benarkan pembaca+penulis serentak (tak saling sekat), busy_timeout beri writer kedua
  // masa tunggu automatik dahulu sebelum SQLITE_BUSY, bukan gagal serta-merta.
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA busy_timeout = 5000;");
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
          password TEXT NOT NULL,
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

      // 2026-08-02 (Fasa 3, RBAC berbilang peranan) — `users.role` (satu nilai) DAHULU satu-
      // satunya sumber kebenaran, hanya 'KETUA_EDITOR'/'EDITOR'. Izzat kini nak EMPAT peranan
      // (Pentadbir, Ketua Editor, Penolong/Timbalan Ketua Editor, Editor) dan SATU akaun boleh
      // pegang BERBILANG peranan serentak (cth Izzat = Pentadbir + Ketua Editor). `role` lajur
      // asal DIKEKALKAN (peranan "utama" untuk paparan ringkas/troli lama), tapi sumber kebenaran
      // SEBENAR bagi pemeriksaan kebenaran ialah jadual ni — lihat requirePermission() di
      // core/middleware/auth.js. roleId sepadan roleId dalam DEFAULT_RBAC_MATRIX
      // (TetapanConsole.tsx): 'pentadbir' | 'ketua_editor' | 'penolong_ketua_editor' | 'editor'.
      db.run(`
        CREATE TABLE IF NOT EXISTS user_roles (
          userId TEXT NOT NULL,
          roleId TEXT NOT NULL,
          PRIMARY KEY (userId, roleId),
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      // Status keahlian 4-keadaan (Aktif/Cuti/Tidak Aktif/Ditamatkan) untuk Direktori — dahulu
      // cuma `isSuspended` boolean, tak cukup nuansa untuk "Cuti" vs "Ditamatkan". `isSuspended`
      // dikekalkan (log masuk masih semaknya) dan diselaraskan bila `status` berubah.
      db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Aktif';", () => {});
      // Jemputan editor baharu + set semula kata laluan sendiri (2026-08-03, Fasa 1) — token
      // sekali-guna + tamat tempoh, disemak oleh core/auth/TokenLaluan.js's semakStatusToken().
      // Dikongsi oleh DUA aliran (aktifkan akaun jemputan & lupa-kata-laluan) — lihat
      // core/routes/authRoutes.js's POST /aktifkan-akaun.
      db.run("ALTER TABLE users ADD COLUMN resetToken TEXT;", () => {});
      db.run("ALTER TABLE users ADD COLUMN resetTokenExpiresAt TEXT;", () => {});

      // Butiran profil wajib + dasar aktif (2026-08-05, permintaan Izzat) — lima medan onboarding
      // (namaPenuh/kelulusan*/negeriMenetap/nomborTelefon) + `termaDipersetujuiPada` (NULL = belum
      // pernah setuju Syarat & Peraturan, gerbang log masuk pertama — lihat profileRoutes.js +
      // LengkapkanProfilModal.tsx client). `lastPublishedAt`/`amaranTakAktifTahap` menyokong dasar
      // aktif: "aktif" ditakrif Izzat sebagai KANDUNGAN DITERBITKAN (bukan log masuk sahaja) —
      // lastPublishedAt dikemas kini oleh contentRoutes.js setiap kali kandungan bercap nama
      // editor ni bertukar ke status approved BAHARU. amaranTakAktifTahap (0=tiada, 1=amaran
      // hari-7, 2=amaran hari-14, 3=notis hari-21/akaun digantung) elak e-mel sama dihantar
      // berulang, direset ke 0 bila editor terbit semula. Lihat penjadual "Semakan Tak Aktif" di
      // app.listen() untuk logik penuh.
      db.run("ALTER TABLE users ADD COLUMN namaPenuh TEXT;", () => {});
      db.run("ALTER TABLE users ADD COLUMN kelulusanKursus TEXT;", () => {});
      db.run("ALTER TABLE users ADD COLUMN kelulusanUniversiti TEXT;", () => {});
      db.run("ALTER TABLE users ADD COLUMN kelulusanTahun TEXT;", () => {});
      db.run("ALTER TABLE users ADD COLUMN negeriMenetap TEXT;", () => {});
      db.run("ALTER TABLE users ADD COLUMN nomborTelefon TEXT;", () => {});
      db.run("ALTER TABLE users ADD COLUMN termaDipersetujuiPada TEXT;", () => {});
      db.run("ALTER TABLE users ADD COLUMN lastPublishedAt TEXT;", () => {});
      db.run("ALTER TABLE users ADD COLUMN amaranTakAktifTahap INTEGER DEFAULT 0;", () => {});

      // 2026-08-02 (Fasa 4) — Log Audit: dahulu SIFAR jejak, tiada jadual langsung. Rekod
      // tindakan editorial/pentadbiran penting (terbit/tolak/arkib kandungan, urus akaun,
      // Bidang, ambilan RSS, ralat pelayan) — lihat core/audit/AuditLog.js.
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actorId TEXT,
          actorName TEXT,
          action TEXT NOT NULL,
          targetType TEXT,
          targetId TEXT,
          detail TEXT,
          createdAt TEXT
        )
      `);
      db.run("CREATE INDEX IF NOT EXISTS idx_audit_log_createdAt ON audit_log(createdAt DESC)");

      // 2026-08-02 (Fasa 6b, "Peti Makluman → sistem notifikasi sebenar") — dahulu Peti Makluman
      // cuma baca `editor_notes` terus (kiraan GLOBAL, semua editor kongsi satu kiraan tanpa
      // mengira siapa dah baca — lihat Lampiran A, "kiraan global bukan per-editor, tiada resit
      // baca"). Jadual ni PER-EDITOR: satu baris satu notis untuk SATU pengguna, status baca/
      // belum baca sendiri. `editor_notes` KEKAL (satu jenis dalam senarai gabungan di UI), jadual
      // ni tambahan untuk jenis Kandungan (disiar/ditolak/penugasan slot) dan Sistem (RSS/cuaca
      // gagal, kata laluan ditukar, akaun digantung/diaktifkan) — lihat core/notifications/Notify.js.
      db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          detail TEXT,
          targetType TEXT,
          targetId TEXT,
          isRead INTEGER DEFAULT 0,
          createdAt TEXT
        )
      `);
      db.run("CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId, createdAt DESC)");

      // 2026-08-02 (Fasa 14, "Jejak pengunjung & populariti") — jejak dibina sendiri, KEPUTUSAN
      // Ketua Editor sedia ada (lihat "Keputusan sedia dibuat" dalam PELAN_PRA_LAUNCH.md): tiada
      // pihak ketiga, tiada cookie, tiada IP/user-agent. Kiraan HARIAN sahaja, agregat anonim —
      // satu baris per (tarikh, jenis sasaran, id sasaran), dinaikkan setiap kali dilawati. Lihat
      // core/routes/viewStatsRoutes.js.
      db.run(`
        CREATE TABLE IF NOT EXISTS daily_view_counts (
          date TEXT NOT NULL,
          targetType TEXT NOT NULL,
          targetId TEXT NOT NULL,
          viewCount INTEGER DEFAULT 0,
          PRIMARY KEY (date, targetType, targetId)
        )
      `);
      db.run("CREATE INDEX IF NOT EXISTS idx_daily_view_counts_date ON daily_view_counts(date DESC)");

      // 2026-08-02 (Fasa 6, "Editor label & tooltip") — kamus label boleh sunting. Menyimpan
      // GANTIAN sahaja — kunci tanpa baris di sini guna nilai lalai dikodkan keras di
      // src/config/istilah.ts (SEMUA_LABEL_LALAI), jadi lalai kekal satu sumber sahaja. Seeding
      // (di bawah) tulis nilai lalai SEBAGAI gantian permulaan supaya paparan tak berubah
      // sehingga Ketua Editor/Pentadbir benar-benar sunting sesuatu. Lihat core/routes/uiLabelRoutes.js.
      db.run(`
        CREATE TABLE IF NOT EXISTS ui_labels (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          category TEXT,
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
            // briefTruncated (2026-08-02, Fasa 8, "limpahan teks seragam") — formatRssBrief
            // potong huraian panjang senyap sepenuhnya sebelum ni, tiada rekod ia berlaku.
            // Kini ditanda per-item supaya boleh disemak/dipanjangkan semula di Editorium.
            db.run("ALTER TABLE rss_ticker_items ADD COLUMN briefTruncated INTEGER DEFAULT 0;", () => {});
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
            
            // Tetapan Am Slot (2026-07-30) — terpakai pada SEMUA slot bento (bukan Ticker/Bar).
            // Had aksara 0 bermakna "tiada had" supaya tiada apa berubah sehingga Ketua Editor
            // benar-benar menetapkan nombor. Lihat core/routes/slotAmRoutes.js.
            db.run(`
              CREATE TABLE IF NOT EXISTS slot_am_settings (
                id TEXT PRIMARY KEY,
                mulaIkutMasa INTEGER DEFAULT 1,
                hadKandunganSlot INTEGER DEFAULT 0,
                jenisAnimasi TEXT DEFAULT 'colophon',
                arahAnimasi TEXT DEFAULT 'kanan',
                nisbahPenajaTransisi INTEGER DEFAULT 0,
                hadHuraianPanjang INTEGER DEFAULT 0,
                hadSumber INTEGER DEFAULT 0,
                hadTopik INTEGER DEFAULT 0,
                hadNotaEditor INTEGER DEFAULT 0,
                updatedAt TEXT
              )
            `, () => {
              // Togol aktif/nyahaktif + kelajuan animasi (2026-08-07, permintaan Izzat — Tetapan
              // Am Slot kekal HANYA utk enable/disable + kelajuan, bukan pilihan jenis/arah
              // per-slot yang kini di Senarai Slot). ALTER (bukan cuma CREATE TABLE) sebab jadual
              // sedia ada di adjung.db production tak dapat lajur baharu drpd CREATE IF NOT EXISTS.
              db.run('ALTER TABLE slot_am_settings ADD COLUMN animasiAktif INTEGER DEFAULT 1', () => {});
              db.run('ALTER TABLE slot_am_settings ADD COLUMN kelajuanAnimasi REAL DEFAULT 1', () => {});
            });

            // Penugasan editor kepada slot (2026-07-30). Banyak-ke-banyak: satu slot boleh
            // beberapa editor, satu editor boleh beberapa slot. Editor bagi sesuatu Bidang DIKIRA
            // daripada jadual ni (ikut slot milik Bidang tu), tidak disimpan berasingan.
            db.run(`
              CREATE TABLE IF NOT EXISTS slot_editors (
                slotIndex INTEGER NOT NULL,
                editorId TEXT NOT NULL,
                createdAt TEXT,
                PRIMARY KEY (slotIndex, editorId)
              )
            `, () => {});

            // Nota Ketua Editor (2026-08-01, spesifikasi pemilik projek) — notis/nota am/nota khas
            // yang Ketua Editor terbitkan kepada pasukan. `type` ialah SKOP: 'dalaman' (Editorium
            // sahaja), 'catatan_ketua_editor' atau 'pengumuman' (kedua-dua disiarkan di Frontpage,
            // pautan footer sepadan namanya masing-masing — dipecah drpd 'awam' generik 2026-08-05).
            // Pengasingan tu dikuatkuasakan dalam SQL laluan awam, bukan di klien — lihat
            // core/routes/editorNotesRoutes.js.
            db.run(`
              CREATE TABLE IF NOT EXISTS editor_notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'am',
                type TEXT NOT NULL DEFAULT 'dalaman',
                status TEXT NOT NULL DEFAULT 'aktif',
                is_pinned INTEGER DEFAULT 0,
                author_id TEXT,
                author_name TEXT,
                created_at TEXT,
                updated_at TEXT
              )
            `, () => {
              // Migrasi (2026-08-05, permintaan Ketua Editor) — skop 'awam' generik dipecah kepada
              // DUA destinasi konkrit yang sepadan tepat dengan seksyen Frontpage sebenar
              // ("Catatan Ketua Editor" dan "Pengumuman" — lihat core/routes/editorNotesRoutes.js).
              // Rekod lama (jarang, ciri ni baharu) dianggap 'pengumuman' sebagai lalai selamat.
              db.run("UPDATE editor_notes SET type = 'pengumuman' WHERE type = 'awam'", () => {});
            });

            // Penaja (2026-08-05, Fasa 12 — permintaan Izzat) — tajaan BULANAN, boleh berbilang
            // penaja serentak dalam satu bulan. `bulan` format 'YYYY-MM' (input type="month"
            // native, tiada penghuraian tarikh tersendiri diperlukan). Footer papar penaja bulan
            // SEMASA sahaja ("Portal ini disokong oleh:"); /penaja (halaman awam) senaraikan
            // SEMUA penaja aktif — lama dan semasa — disusun bulan terbaru dahulu (bukan ditapis
            // ikut bulan semasa di situ, beza tujuan drpd footer). `status` bukan tapisan
            // bulan/sejarah — ia laluan pembetulan/tarik balik entri tersilap sahaja (arkib, bukan
            // padam terus, sama prinsip seluruh projek ni).
            // `tayangSemasaTransisi` — togol DATA sahaja buat masa ini (keputusan Izzat 2026-08-05:
            // bina tetapan/wiring dulu, overlay transisi carousel sebenar KEMUDIAN — JSX tu rapuh,
            // lihat CLAUDE.md/nota CarouselStableBlock di FrontpageView.tsx). Togol ni BELUM
            // memberi sebarang kesan visual sehingga overlay disambungkan.
            db.run(`
              CREATE TABLE IF NOT EXISTS sponsors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                logoUrl TEXT,
                url TEXT,
                bulan TEXT NOT NULL,
                tayangSemasaTransisi INTEGER DEFAULT 0,
                jumlahBayaran REAL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'aktif',
                createdAt TEXT,
                updatedAt TEXT
              )
            `, () => {
              // jumlahBayaran (2026-08-05, permintaan Izzat — halaman /penaja akan dinaik taraf
              // supaya saiz "kotak" setiap penaja berkadar terus dengan jumlah tajaan, cth RM1000
              // = kotak 10x lebih besar drpd RM100). DATA sahaja pusingan ni (sama corak macam
              // tayangSemasaTransisi) — pengiraan/lukisan kotak sebenar ialah kerja Fasa
              // akan datang, BUKAN dipaparkan di /penaja sekarang (jumlah bayaran ialah maklumat
              // sensitif, tak sepatutnya terus terdedah kepada awam sebelum reka bentuk visualisasi
              // yang betul disahkan). ALTER TABLE selamat diulang — DB sedia ada (jadual dicipta
              // sebelum lajur ni wujud) akan gagal senyap dgn ralat "duplicate column", diabaikan.
              db.run("ALTER TABLE sponsors ADD COLUMN jumlahBayaran REAL DEFAULT 0", () => {});
            });

            // Glosari (2026-08-01, dikemas kini 2026-08-02 Fasa 8) — senarai rujukan istilah +
            // definisi/nota penggunaan untuk editor. RUJUKAN sahaja: tidak pernah menulis-ganti
            // kandungan editorial secara automatik. Lihat core/routes/glosariRoutes.js.
            //
            // Nota sejarah: sehingga 2026-08-02 jadual ni turut memegang lajur `elakkan` (bentuk
            // ejaan dielakkan) — dua tujuan berbeza bergabung dalam satu jadual. Dipisahkan ke
            // jadual `ejaan_piawai` baharu di bawah supaya Glosari (definisi istilah) dan
            // Penyelarasan Ejaan (bentuk betul vs dielakkan) jadi dua konsep berasingan yang jelas.
            // Lajur `elakkan` dikekalkan di sini untuk keserasian data lama sahaja — borang UI baharu
            // tidak lagi mengisinya.
            db.run(`
              CREATE TABLE IF NOT EXISTS glosari_istilah (
                id TEXT PRIMARY KEY,
                istilah TEXT NOT NULL,
                elakkan TEXT,
                maksud TEXT,
                createdAt TEXT
              )
            `, () => {});

            // Penyelarasan Ejaan (2026-08-02, Fasa 8) — dipisahkan daripada glosari_istilah.
            // RUJUKAN pasif sahaja, sama seperti Glosari. Lihat core/routes/ejaanRoutes.js.
            db.run(`
              CREATE TABLE IF NOT EXISTS ejaan_piawai (
                id TEXT PRIMARY KEY,
                betul TEXT NOT NULL,
                elakkan TEXT,
                catatan TEXT,
                createdAt TEXT
              )
            `, () => {
              // Migrasi data lama: mana-mana baris glosari_istilah yang ada nilai `elakkan` bukan
              // kosong disalin (bukan dipindah — glosari_istilah tak diubah) ke ejaan_piawai supaya
              // tiada data hilang. id baharu berasaskan id lama supaya migrasi ni idempoten
              // (INSERT OR IGNORE + id deterministik = selamat jalan berkali-kali).
              db.all(`SELECT id, istilah, elakkan, maksud FROM glosari_istilah WHERE elakkan IS NOT NULL AND TRIM(elakkan) != ''`, [], (err, rows) => {
                if (err || !rows || rows.length === 0) return;
                const now = new Date().toISOString();
                rows.forEach((r) => {
                  db.run(
                    `INSERT OR IGNORE INTO ejaan_piawai (id, betul, elakkan, catatan, createdAt) VALUES (?, ?, ?, ?, ?)`,
                    [`ejn-mig-${r.id}`, r.istilah, r.elakkan, r.maksud || '', now],
                    () => {}
                  );
                });
              });
            });

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
        INSERT INTO users (id, username, email, role, penName, signature, avatarColor, bioSummary, isSuspended, status, password, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [
        'user-chief-editor', 'izzat', 'izzat@adjung.local', 'KETUA_EDITOR',
        'Izzat Anas', '', '#802334', 'Chief Editor, Adjung Brief', 0, 'Aktif',
        hashPassword(defaultUserSeedPassword)
      ], (err) => {
        if (err) { console.error('Failed to seed Chief Editor account:', err.message); reject(err); return; }
        console.log(`Seeded Chief Editor account "izzat" with a random temporary password: ${defaultUserSeedPassword} — change this after first login.`);
        resolve();
      });
    });
    // Izzat pegang DUA peranan serentak (Pentadbir + Ketua Editor, disahkan 2026-08-02) — akaun
    // pertama sistem disemai dengan kedua-duanya, bukan cuma satu.
    await new Promise((resolve) => {
      db.run(`INSERT OR IGNORE INTO user_roles (userId, roleId) VALUES ('user-chief-editor', 'pentadbir')`, () => {
        db.run(`INSERT OR IGNORE INTO user_roles (userId, roleId) VALUES ('user-chief-editor', 'ketua_editor')`, () => resolve());
      });
    });
  } else {
    console.log(`Users table already has ${usersCount} row(s). Skipping user seed.`);
  }

  // Migrasi berbilang peranan (2026-08-02) — akaun SEDIA ADA (dari sebelum user_roles wujud)
  // tak punya baris di jadual baharu tu langsung. Isi SEKALI sahaja daripada lajur `role` lama
  // (KETUA_EDITOR→ketua_editor, selainnya→editor) — hanya untuk userId yang MASIH tiada
  // langsung dalam user_roles, supaya peranan yang Izzat dah tetapkan sendiri melalui UI tak
  // ditimpa setiap kali server dimulakan semula.
  await new Promise((resolve) => {
    db.all(`SELECT id, role FROM users WHERE id NOT IN (SELECT DISTINCT userId FROM user_roles)`, [], (err, rows) => {
      if (err || !rows || rows.length === 0) return resolve();
      let pending = rows.length;
      rows.forEach((u) => {
        const roleId = u.role === 'KETUA_EDITOR' ? 'ketua_editor' : 'editor';
        db.run(`INSERT OR IGNORE INTO user_roles (userId, roleId) VALUES (?, ?)`, [u.id, roleId], () => {
          pending--;
          if (pending === 0) resolve();
        });
      });
    });
  });

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

  // 2026-08-02 (Fasa 6) — semai `ui_labels` daripada nilai lalai istilah.ts, satu baris per
  // kunci. Guna INSERT OR IGNORE (bukan cuma semasa jadual kosong) supaya kunci BAHARU yang
  // ditambah ke SEMUA_LABEL_LALAI pada masa hadapan turut disemai tanpa menimpa gantian yang
  // Ketua Editor dah sunting untuk kunci sedia ada.
  const uiLabelsCount = await countRows('ui_labels');
  await new Promise((resolveLabels) => {
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT OR IGNORE INTO ui_labels (key, value, category, updatedAt) VALUES (?, ?, ?, ?)');
    for (const item of SEMUA_LABEL_LALAI) {
      stmt.run(item.kunci, item.lalai, item.kategori, now);
    }
    stmt.finalize(() => resolveLabels());
  });
  if (uiLabelsCount === 0) {
    console.log(`Seeded ${SEMUA_LABEL_LALAI.length} default ui_labels row(s).`);
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
      // Jadual Terbit / Jadual Luput (2026-08-02) — ISO 8601 dengan offset +08:00 (waktu Malaysia,
      // lihat core/editorial/Scheduling.js). NULL = tiada jadual ditetapkan. dbConn.run ignore
      // ralat "duplicate column" senyap (sama corak setiap ALTER TABLE lain dalam fail ni).
      dbConn.run("ALTER TABLE editorial_revisions ADD COLUMN scheduledPublishAt TEXT", () => {});
      dbConn.run("ALTER TABLE editorial_revisions ADD COLUMN scheduledExpiresAt TEXT", () => {});

      // Logo penaja + warna panel animasi transisi (2026-08-04, Fasa 7 lanjutan) — satu logo
      // GLOBAL (bukan per-slot/rotasi), dipaparkan di tengah panel animasi Colophon/Sapuan
      // Lajur (gantikan adjung-symbol.svg lama yang tak kelihatan sebab sama warna dgn latar,
      // lihat core/routes/slotAmRoutes.js). NULL logoPenaja = tiada logo dipaparkan (kad kosong,
      // bukan ralat). warnaPanelTransisi lalai #802334 (maroon jenama sedia ada) — satu warna
      // tetap merentasi laman (BUKAN ikut Bidang kad, keputusan Izzat 2026-08-04).
      dbConn.run("ALTER TABLE slot_am_settings ADD COLUMN logoPenaja TEXT", () => {});
      dbConn.run("ALTER TABLE slot_am_settings ADD COLUMN warnaPanelTransisi TEXT DEFAULT '#802334'", () => {});

      // Saiz fon Focus View (2026-08-04, permintaan Izzat) — SATU tetapan GLOBAL untuk seluruh
      // Focus View (bukan per-Bidang/tier). Lihat core/routes/slotAmRoutes.js.
      dbConn.run("ALTER TABLE slot_am_settings ADD COLUMN focusViewTitleScale REAL DEFAULT 1", () => {});
      dbConn.run("ALTER TABLE slot_am_settings ADD COLUMN focusViewBodySize INTEGER DEFAULT 15", () => {});

      // Arah animasi transisi Colophon/Sapuan Lajur (2026-08-05, permintaan Izzat) — panel boleh
      // masuk dari kanan/kiri/atas/bawah, satu tetapan GLOBAL (bukan per-jenis animasi). Lalai
      // 'kanan' supaya kelakuan Colophon sedia ada (masuk kanan -> keluar kiri) tak berubah untuk
      // pemasangan sedia ada. Lihat core/routes/slotAmRoutes.js.
      dbConn.run("ALTER TABLE slot_am_settings ADD COLUMN arahAnimasi TEXT DEFAULT 'kanan'", () => {});

      // Nisbah logo Adjung : logo penaja dalam panel transisi (2026-08-05, permintaan Izzat).
      // Lihat core/routes/slotAmRoutes.js. Lalai 0 = logo Adjung sahaja, tak bergantung penaja.
      dbConn.run("ALTER TABLE slot_am_settings ADD COLUMN nisbahPenajaTransisi INTEGER DEFAULT 0", () => {});

      // source_link_checks (2026-08-05, Fasa 8b — semakan pautan mati) — satu rekod PER URL
      // sumber unik (bukan per-kandungan; URL sama dikongsi rentas kandungan disemak sekali,
      // bukan berulang-ulang). Diisi/dikemas kini oleh core/editorial/LinkChecker.js, dibaca oleh
      // GET /api/system/link-checks (DashboardConsole.tsx, jalur "Status sistem").
      dbConn.run(`
        CREATE TABLE IF NOT EXISTS source_link_checks (
          url TEXT PRIMARY KEY,
          ok INTEGER,
          httpStatus INTEGER,
          errorMessage TEXT,
          checkedAt TEXT
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
      // idx_rss_ticker_status (2026-08-07, Tier 1 audit inventori) — jadual ni SATU-SATUNYA
      // kandungan editorial SEBENAR (2,295+ baris, bertambah setiap 3 jam TANPA pemangkasan,
      // tiada had had atas), tapi SETIAP pertanyaan (slotRoutes.js: senarai menunggu, kiraan
      // status, senarai lulus disusun skor, senarai disekat kategori) tapis `status` DAHULU —
      // indeks sedia ada (category, publishedAt) tak sepadan corak tu langsung.
      dbConn.run("CREATE INDEX IF NOT EXISTS idx_rss_ticker_status ON rss_ticker_items(status, score DESC, publishedAt DESC)");

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
          arahOverride TEXT DEFAULT '',
          PRIMARY KEY (layoutTemplateId, slotIndex),
          FOREIGN KEY(providerId) REFERENCES ai_providers(id) ON DELETE SET NULL
        )
      `, () => {
        dbConn.run("ALTER TABLE slots_config ADD COLUMN searchStrategy TEXT DEFAULT 'Structured Sources Only'", () => {});
        // Arah animasi transisi PER-SLOT (2026-08-05, permintaan Izzat: "boleh ke nak pilih arah
        // tertentu utk slot tertentu sahaja?") — '' = guna tetapan am global (arahAnimasi di
        // slot_am_settings), kanan/kiri/atas/bawah = override slot ni sahaja. Lihat
        // core/routes/slotsConfigRoutes.js + arahUntukSlot() di FrontpageView.tsx.
        dbConn.run("ALTER TABLE slots_config ADD COLUMN arahOverride TEXT DEFAULT ''", () => {});
        // Jenis animasi transisi PER-SLOT (2026-08-07, permintaan Izzat: "benarkan ketua editor
        // tetapkan animasi... berlainan utk setiap slot") — '' = guna jenisAnimasi tetapan am
        // global (slot_am_settings), pudar/colophon/sapuan_lajur/gerak_susun = override slot ni
        // sahaja. Lihat core/routes/slotsConfigRoutes.js + jenisAnimasiUntukSlot() di
        // FrontpageView.tsx. Ditetapkan di Senarai Slot → Tetapan Kad (BUKAN Tetapan Am Slot —
        // permintaan eksplisit supaya tetapan per-slot tak bercampur dgn tetapan am).
        dbConn.run("ALTER TABLE slots_config ADD COLUMN jenisAnimasiOverride TEXT DEFAULT ''", () => {});
        // Warna panel / kelajuan / logo transisi PER-SLOT (2026-08-07, Pelan 03 — arahan Izzat:
        // "saya nak frontpage tidak membosankan"). Ketiga-tiganya ikut konvensyen SAMA seperti
        // dua lajur di atas: '' = warisi tetapan am (slot_am_settings), nilai = override slot ni
        // sahaja. Lihat core/routes/slotsConfigRoutes.js + warnaPanelUntukSlot()/
        // kelajuanUntukSlot()/logoModeUntukSlot() di FrontpageView.tsx.
        //   warnaPanelOverride  hex '#RRGGBB'
        //   kelajuanOverride    pendarab tempoh, disimpan TEKS supaya '' bermakna "ikut am"
        //                       (0 ialah nilai sah-kelihatan tapi tak bermakna di sini)
        //   logoTransisiMode    'adjung' | 'penaja' | 'tiada'
        dbConn.run("ALTER TABLE slots_config ADD COLUMN warnaPanelOverride TEXT DEFAULT ''", () => {});
        dbConn.run("ALTER TABLE slots_config ADD COLUMN kelajuanOverride TEXT DEFAULT ''", () => {});
        dbConn.run("ALTER TABLE slots_config ADD COLUMN logoTransisiMode TEXT DEFAULT ''", () => {});
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
          // desk/url/source/imageUrl: EMPAT medan paling asas kandungan (Bidang, pautan sumber,
          // nama sumber, imej) — ditulis oleh HAMPIR SETIAP laluan cipta kandungan
          // (contentRoutes POST /content attrs[], syncManualObjectsForSlot, EditorialPipeline)
          // tapi tidak pernah didaftar di sini (2026-08-06, ditemui semasa audit "kegagalan
          // senyap"). Ia hanya berfungsi setakat ini kerana adjung.db sedia ada mewarisi baris
          // ni daripada seed lama — pada DB BAHARU (deploy pelayan baharu, bina semula DB),
          // PRAGMA foreign_keys = ON (baris 140) menyebabkan setiap INSERT gagal dengan
          // SQLITE_CONSTRAINT yang cuma dicatat console.warn: setiap kandungan baharu kehilangan
          // Bidang, URL, sumber dan imej secara SENYAP. Disahkan dengan ujian FK pada DB kosong.
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('desk', 'Bidang', 'text')", () => {});
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('url', 'Pautan Sumber', 'text')", () => {});
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('source', 'Nama Sumber', 'text')", () => {});
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('imageUrl', 'URL Imej', 'text')", () => {});
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
          // note/image: medan baharu Urus Slot (modal bento bukan-BAR) — nota editor dan lampiran
          // imej Focus View per-kandungan. Sama corak macam briefLong/topik di atas — kena
          // didaftar dulu di sini atau INSERT gagal senyap.
          //
          // JELAS TENTANG `note` (2026-08-07): ia BUKAN nota rahsia dalaman. Komen asal di sini
          // tertulis "tak disiarkan", bercanggah dengan UI ("Nota editor (pilihan) — hanya di
          // Focus View…", SlotManagerModal.tsx) dan dengan FocusView.tsx yang memang MEMAPARKANNYA
          // kepada pembaca, lengkap dengan had aksara boleh tetap (hadNotaEditor, Tetapan Am Slot).
          // Maksud sebenar: tidak dipapar pada KAD, hanya dalam Focus View. Ia memang sampai
          // kepada pembaca — jangan taip maklumat sulit di situ.
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

          // sourcesJson: sumber berbilang (2026-08-05, permintaan Izzat) — senarai PENUH
          // {name,url}[] disimpan JSON, berasingan drpd 'source'/'url' tunggal legasi (yang
          // kekal = entri pertama sahaja, untuk keserasian ke belakang).
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('sourcesJson', 'Sumber Berbilang (JSON)', 'text')", () => {});

          // pernahDitolak: kunci draf ditolak (2026-08-05, permintaan Izzat — "editor degil publish
          // semula tanpa pembetulan"). '1' bila draf ni lahir semula drpd blok "Tolak" (UUID blok
          // berakhir '-reject', lihat syncManualObjectsForSlot & reject-to-draft di
          // contentRoutes.js). PATCH /content/:id sekat status->approved oleh Editor biasa (kunci
          // manageEditorial diperlukan) bila bendera ni '1' — sekali sahaja sehingga Ketua
          // Editor/Penolong sendiri yang luluskan, elak editor terbit semula tanpa semakan.
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('pernahDitolak', 'Pernah Ditolak', 'text')", () => {});

          // sebabMenunggu: DUA jenis Menunggu (2026-08-06, permintaan Izzat — "menunggu sepatutnya
          // ada dua jenis, menunggu semakan dan menunggu untuk disiarkan/aktif"). Nilai 'semakan'
          // (lalai bagi setiap kandungan pending baharu — perlu keputusan MANUSIA, Ketua Editor/
          // Penolong atau Editor berkelayakan self-publish) atau 'slot_penuh' (dah lulus keputusan,
          // cuma tunggu RUANG kosong dalam slot — hadKandunganSlot, Tetapan Am Slot — sebelum boleh
          // jadi 'approved'). Kandungan 'slot_penuh' dinaik taraf AUTOMATIK oleh
          // promosikanMenungguSlotKosong() (contentRoutes.js) sebaik ruang kosong wujud, tiada
          // keputusan manusia kedua diperlukan. Lihat PATCH /content/:id untuk logik penuh.
          dbConn.run("INSERT OR IGNORE INTO editorial_attributes (id, name, valueType) VALUES ('sebabMenunggu', 'Sebab Menunggu', 'text')", () => {});

          // urlKod: kod pendek unik per-kandungan (Fasa 9, 2026-08-05) — skema URL
          // /<bidang-slug>/kandungan/<kod-pendek>. Lihat core/editorial/UrlSlug.js untuk sebab
          // ia kod RAWAK baharu (bukan potongan editorial_objects.id sedia ada). Indeks unik
          // SEPARA (WHERE urlKod IS NOT NULL) — kandungan yang belum pernah diminta URL-nya
          // kekal NULL (jana malas, lihat getOrCreateUrlKod), bukan setiap baris perlu nilai.
          dbConn.run("ALTER TABLE editorial_objects ADD COLUMN urlKod TEXT", () => {});
          dbConn.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_editorial_objects_urlkod ON editorial_objects(urlKod) WHERE urlKod IS NOT NULL", () => {});
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
                            // Glos Selari (2026-08-02, Fasa 6) — dahulu checkbox hiasan ("Belum
                            // Dibina") yang langsung tak kawal apa-apa; ciri anotasi interlinear
                            // (`[kata](gloss:makna)`, utils.tsx parseInlineFormatting) SUDAH aktif
                            // tanpa syarat pada setiap tajuk/huraian kad. Togol ni kini SEBENAR —
                            // FrontpageView.tsx semak nilai ni sebelum membenar sintaks gloss.
                            dbConn.run("ALTER TABLE system_settings ADD COLUMN glosSelariEnabled INTEGER DEFAULT 0", () => {});
                            // schoolHolidaysJson (2026-08-02, Fasa 7) — cuti sekolah sebelum ni
                            // BERKOD KERAS (core/routes/worldClockRoutes.js, senarai tarikh 2026/27
                            // sahaja) — akan basi senyap lepas 2027 (Jam Dunia terus papar tiada cuti
                            // sekolah, tiada amaran). NULL = guna senarai lalai berkod keras (tiada
                            // perubahan kelakuan sehingga Ketua Editor sunting); JSON array
                            // {start,end,group,name} bila disunting. Dibaca di GET /clock-holidays.
                            dbConn.run("ALTER TABLE system_settings ADD COLUMN schoolHolidaysJson TEXT", () => {});
                            // focusViewNotaMaxAksara (2026-08-02, Fasa 7) — had pemotongan "Nota
                            // editor" Focus View, sebelum ni berkod keras `NOTA_MAX = 180` di
                            // FocusView.tsx tanpa sebarang tetapan. Bukan sebahagian bajet ruang
                            // tajuk/huraian (GeometryConfig/ContentBudget) — nota editor medan
                            // berasingan, tiada kaitan sistem tier kad. NULL/undefined = guna
                            // lalai 180 (tiada perubahan kelakuan sehingga Ketua Editor sunting).
                            dbConn.run("ALTER TABLE system_settings ADD COLUMN focusViewNotaMaxAksara INTEGER DEFAULT 180", () => {});
                            // tickerOverlayTitleSize/tickerOverlayBriefSize (2026-08-02) — saiz fon
                            // tajuk/huraian paparan PENUH Ticker (overlay skrin penuh bila marquee
                            // Ticker diklik, `showNewsOverlay` di FrontpageView.tsx — BUKAN Focus
                            // View kad biasa, dua overlay berlainan). Sebelum ni berkod keras
                            // (text-3xl md:text-5xl / text-lg md:text-xl), tiada tetapan langsung.
                            // Nilai ialah KUNCI pratetap ('S'/'M'/'L'/'XL'), bukan kelas Tailwind
                            // mentah — kelas mesti hadir literal dalam source untuk JIT Tailwind
                            // kompil betul, jadi peta kunci->kelas kekal di FrontpageView.tsx.
                            // NULL/undefined = guna lalai 'L'/'M' (padan kelakuan sedia ada tepat).
                            dbConn.run("ALTER TABLE system_settings ADD COLUMN tickerOverlayTitleSize TEXT DEFAULT 'L'", () => {});
                            dbConn.run("ALTER TABLE system_settings ADD COLUMN tickerOverlayBriefSize TEXT DEFAULT 'M'", () => {});
                            // reviewPrompt (2026-08-01, spesifikasi pemilik projek) — templat AI
                            // untuk SEMAKAN (ejaan, tatabahasa, gaya bahasa, format), berasingan
                            // daripada masterPrompt yang mengarah penjanaan KANDUNGAN.
                            dbConn.run("ALTER TABLE system_settings ADD COLUMN reviewPrompt TEXT", () => {});
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
                                                // Kawalan serentak (2026-08-02, Fasa 6) — dahulu dua editor buka slot sama, simpanan
                                                // KEDUA menulis-ganti simpanan PERTAMA tanpa amaran (last-write-wins senyap). `updatedAt`
                                                // sini ialah token versi ringkas: pelanggan hantar semula nilai yang dia BACA semasa
                                                // buka slot; kalau tak sepadan nilai SEMASA di DB, seseorang lain dah simpan dulu —
                                                // POST /api/system/slots (slotsConfigRoutes.js) tolak dengan 409, bukan tulis-ganti.
                                                dbConn.run("ALTER TABLE slots_config ADD COLUMN updatedAt TEXT", () => {});
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
                                                    // originalName (2026-08-01, spesifikasi pemilik projek — "nama asal") — dicap
                                                    // SEKALI semasa Bidang dicipta, tak pernah disentuh oleh rename kemudian.
                                                    // Backfill baris sedia ada dengan nama SEMASA sebagai "asal" — nama asal
                                                    // sebenar sebelum rename pertama tak dapat dipulihkan (tak pernah dicatat),
                                                    // jadi ini titik mula paling jujur, bukan reka nilai.
                                                    dbConn.run("ALTER TABLE CategoryRegistry ADD COLUMN originalName TEXT", () => {
                                                      dbConn.run("UPDATE CategoryRegistry SET originalName = name WHERE originalName IS NULL", () => {});
                                                    });
                                                    dbConn.run("ALTER TABLE CategoryRegistry ADD COLUMN icon TEXT", () => {
                                                    // iconSvg: markup SVG custom admin muat naik sendiri (disanitize di
                                                    // POST /categories/set-icon-svg sebelum simpan) — bila diisi, menang
                                                    // atas ikon lucide di `icon` (lihat BidangIcon di TetapanConsole.tsx).
                                                    dbConn.run("ALTER TABLE CategoryRegistry ADD COLUMN iconSvg TEXT", () => {
                                                    // illustrationSvg: LAJUR WARISAN, TIDAK DIGUNAKAN LAGI. Ciri "Plat
                                                    // Ilustrasi Bidang" dibuang sepenuhnya pada 2026-08-07 (Focus View
                                                    // kini dua kolum, kolum kanan tak pernah kosong lagi). Migrasi ini
                                                    // sengaja DIKEKALKAN — menggugurkan lajur memusnahkan data sedia ada.
                                                    // Tiada kod hidup yang membaca atau menulis lajur ini.
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
    // Sumber berbilang (2026-08-05, permintaan Izzat) — sama corak macam ManualBlockFormat.js
    // (salinan client) — SETIAP baris "Sumber:" tolak entri baharu, dipasangkan dengan "URL:"
    // berikutnya. `source`/`url` tunggal kekal = entri PERTAMA (keserasian ke belakang).
    let sources = [];
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
    // Penulis blok draf — lihat nota penuh di ManualBlockFormat.js. Mesti dihurai DAN ditulis
    // semula (serializeDraftBlock di bawah), kalau tidak setiap simpan seterusnya akan memadam
    // cap nama tu secara senyap dan draf jadi yatim dalam "Draf Saya".
    let penulis = '';

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
      } else if (trimmed.startsWith('Penulis:')) {
        penulis = trimmed.replace(/^Penulis:\s*/i, '').trim();
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
        const nama = trimmed.replace(/^Sumber:\s*/i, '').trim();
        if (sources.length === 0) source = nama;
        sources.push({ name: nama, url: '' });
      } else if (trimmed.startsWith('URL:')) {
        const u = trimmed.replace(/^URL:\s*/i, '').trim();
        if (sources.length === 0) {
          sources.push({ name: '', url: u });
        } else {
          sources[sources.length - 1].url = u;
        }
        if (sources.length === 1) url = u;
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
        penulis,
        source: organizer || source || defaultSlot.manualSource || '',
        sources,
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

  // 2026-08-02 (ditemui semasa bina BarSlotManagerModal.tsx) — DAHULU jatuh balik ke phantom
  // item guna defaultSlot.manualSummary (iaitu TEKS MENTAH yang baru dihurai di atas) bila blok
  // parsing pulangkan sifar item. Ini betul untuk kes "hantaran benar-benar kosong" (dua gerbang
  // di atas — undefined/null, trim kosong — sudah tangani itu dengan betul), tapi salah untuk kes
  // "hantaran ADA kandungan (markah Tajuk:/Event: wujud) tapi setiap blok kebetulan kosong
  // Tajuk/Event-nya" (cth editor kosongkan hanya baris Tajuk untuk tinggalkan draf, medan lain
  // kekal terisi) — phantom item itu jadikan SELURUH teks mentah bertingkat sebagai `summary`,
  // yang gagal validateContentBudget dengan mesej mengelirukan dan menyekat simpanan terus,
  // walhal niat editor (giliran kosong/ditinggalkan) patut disimpan tanpa ralat. Pulangkan array
  // KOSONG di sini sahaja — jangan sintesis kandungan daripada teks yang gagal dihurai.
  return items;
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
  // Jenis sumber (Fasa 8b, 2026-08-05) — sepadan pembetulan ManualBlockFormat.js's
  // serializeManualBentoItem (baris ni hilang senyap di sana sebelum ni juga).
  `Jenis sumber: ${item.sourceType || ''}`,
  `Tarikh sumber: ${item.originalDate || ''}`,
  `Imej: ${item.image || ''}`,
  `Nota: ${item.note || ''}`,
  `Penulis: ${item.penulis || ''}`,
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
    // Had MINIMUM huraian panjang (2026-08-07, permintaan Izzat — "nak tetapkan had minimum
    // kependekan supaya tidak ada lagi huraian panjang yg terlalu pendek"). Medan ni OPSYENAL
    // (ramai kandungan tiada langsung, itu sah) — had minimum cuma terpakai bila editor BENAR-
    // BENAR isi sesuatu. Data sebenar sebelum had ni wujud: 294 aksara tersimpan sebagai "huraian
    // panjang", praktikalnya cuma huraian ringkas dipanjangkan sikit, bukan bacaan Focus View
    // dua-lajur yang medan ni dimaksudkan.
    if (item.briefLong && item.briefLong.trim() && item.briefLong.length < MIN_BRIEF_LONG_CHARS) {
      const err = new Error(`Huraian panjang bagi "${(item.title || '').slice(0, 40)}..." terlalu pendek (${item.briefLong.length} aksara, minimum ${MIN_BRIEF_LONG_CHARS}). Kandungan tidak disiarkan — panjangkan huraian atau kosongkan terus medan ni.`);
      err.isValidationError = true;
      throw err;
    }
    // Had aksara medan bukan-kad (Tetapan Am Slot) — huraian panjang, sumber, topik, nota.
    // Berasingan daripada had per-slot maxBriefLong di bawah: yang mana lebih ketat, itu yang
    // menahan dahulu.
    const medanCheck = validateMedanTambahan({
      summaryLong: item.briefLong, source: item.source, topik: item.topik, note: item.note,
    });
    if (!medanCheck.isValid) {
      const err = new Error(`"${(item.title || '').slice(0, 40)}...": ${medanCheck.reason}`);
      err.isValidationError = true;
      throw err;
    }
    // Format sumber (Fasa 8b) — URL sumber mesti sekurang-kurangnya rupa URL sah kalau diisi.
    const urlCheck = validateSourceUrl(item.url);
    if (!urlCheck.isValid) {
      const err = new Error(`"${(item.title || '').slice(0, 40)}...": ${urlCheck.reason}`);
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
  const existingIdSet = new Set(existingRows.map((r) => r.id));
  const removedIds = isBarLikeRemoval ? existingRows.map((r) => r.id).filter((id) => !submittedIds.has(id)) : [];

  // 2026-08-02 (Fasa 2, pepijat kritikal) — laluan Bar DAHULU memadam SEMUA baris
  // editorial_objects setiap kali disimpan (DELETE ... WHERE id NOT IN removedIds — iaitu
  // memadam item yang DIKEKALKAN, bukan yang dibuang!) lalu mencipta semula baris + revisi
  // BAHARU untuk setiap item, walaupun item itu sekadar diedit sikit. Sebab
  // editorial_revisions.objectId ada ON DELETE CASCADE, ini memusnahkan sejarah revisi secara
  // KEKAL setiap kali — "terbitan tak boleh padam" dipintas oleh butang simpan biasa.
  //
  // Betul sekarang: item yang WUJUD sedia ada (uuid sepadan baris editorial_objects semasa)
  // di-UPDATE di tempat (objek + revisi + atribut disegarkan, id KEKAL) — tiada DELETE
  // langsung pada baris tu. Item yang dibuang editor daripada penghantaran (removedIds)
  // diarkibkan (status revisi='archived'), baris editorial_objects-nya turut KEKAL, bukan
  // dipadam — selaras peraturan padam/arkib projek. Item baharu (tiada uuid sepadan) dicipta
  // segar seperti biasa.
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
    }

    // Bukan Bar: objectId SENTIASA baharu (bukan item.uuid, yang cuma identiti sementara dalam
    // teks draf) — draf tak pernah punya baris editorial_objects sedia ada untuk "dikemas kini",
    // setiap "Terbitkan" ialah rekod Indeks BAHARU.
    const baseTs = Date.now();
    for (let i = 0; i < publishItems.length; i++) {
      const item = publishItems[i];
      const finalCategory = (item.desk || 'UMUM').trim().toUpperCase();
      const isBarUpdate = isBar && item.uuid && existingIdSet.has(item.uuid);

      if (isBarUpdate) {
        // Item Bar SEDIA ADA — kemas kini di tempat, objectId & sejarah revisi KEKAL.
        const objectId = item.uuid;
        const updatedAt = new Date(baseTs + i).toISOString();
        try {
          await CategoryRegistry.incrementCategoryUsage(db, finalCategory);
        } catch (e) {
          console.warn("Failed to register category:", e.message);
        }
        await dbRun(
          `UPDATE editorial_objects SET categoryId = ?, sourceType = ?, updatedAt = ? WHERE id = ?`,
          [finalCategory, item.sourceType || 'web', updatedAt, objectId]
        );
        // Sejarah versi sebenar (Fasa 6): jangan UPDATE teks revisi sedia ada di tempat —
        // itu memusnahkan teks lama secara senyap. Cari nombor versi tertinggi semasa,
        // masukkan baris revisi BAHARU (versi + 1) dengan teks terkini; baris lama KEKAL
        // tak disentuh sebagai sejarah. Laluan baca (ORDER BY version DESC LIMIT 1) automatik
        // ambil versi terbaharu ni.
        const maxVersionRow = await dbGet('SELECT MAX(version) AS maxVersion FROM editorial_revisions WHERE objectId = ?', [objectId]);
        const nextVersion = (maxVersionRow && maxVersionRow.maxVersion ? maxVersionRow.maxVersion : 0) + 1;
        const newRev = await dbRun(
          `INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
           VALUES (?, ?, 'ms', ?, ?, ?, 'manual-slot-save', ?, ?)`,
          [objectId, nextVersion, item.title, item.summary, item.status || 'approved', updatedAt, updatedAt]
        );
        const currentRevId = newRev.lastID;
        const attrs = [
          { key: 'desk', val: finalCategory },
          { key: 'url', val: item.url || '#' },
          { key: 'source', val: item.source || '' },
          { key: 'sourceType', val: item.sourceType || 'web' },
          { key: 'briefLong', val: item.briefLong || '' },
          { key: 'originalDate', val: item.originalDate || '' },
          { key: 'topik', val: item.topik || '' },
          { key: 'editorName', val: slotConfig.editorName || '' },
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
            [objectId, currentRevId, a.key, a.val]
          );
        }
        continue;
      }


      const objectId = isBar ? (item.uuid || `object-manual-slot${slotIndex}-${baseTs}-${i}`) : `object-manual-slot${slotIndex}-${baseTs}-${i}`;
      const createdAt = new Date(baseTs + i).toISOString();
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
        // Sumber berbilang (2026-08-05, permintaan Izzat) — senarai PENUH {name,url}[] disimpan
        // sebagai JSON dalam SATU attribute (bukan berbilang baris EAV attributeId='source' —
        // lebih ringkas baca semula). `source`/`url` di atas KEKAL entri pertama sahaja
        // (keserasian ke belakang, label kad tunggal). Dibaca semula di resolveSlotContent().
        { key: 'sourcesJson', val: JSON.stringify(Array.isArray(item.sources) ? item.sources : []) },
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
        // Kunci draf ditolak (2026-08-05) — item.uuid ialah UUID blok DRAF asal (bukan
        // objectId, yang sentiasa baharu untuk tier bukan-Bar di atas). Blok yang lahir drpd
        // "Tolak" (reject-to-draft, contentRoutes.js) diberi UUID berakhir '-reject' — kalau
        // sepadan, kandungan ni pernah ditolak sekali, tandakan supaya PATCH /content/:id
        // sekat Editor biasa self-approve semula tanpa kelulusan Ketua Editor/Penolong.
        { key: 'pernahDitolak', val: (item.uuid && String(item.uuid).endsWith('-reject')) ? '1' : '' },
        // Dua jenis Menunggu (2026-08-06) — kandungan yang baru Terbitkan (finalStatus='pending')
        // sentiasa mula sebagai 'semakan' (perlu keputusan manusia — self-publish ATAU Ketua
        // Editor/Penolong, ikut dasar semasa). Ia cuma bertukar 'slot_penuh' kalau/bila seseorang
        // cuba luluskannya tapi slot penuh — lihat PATCH /content/:id (contentRoutes.js).
        { key: 'sebabMenunggu', val: finalStatus === 'pending' ? 'semakan' : '' },
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
      // HANYA TERBIT YANG AWAM (2026-08-07, ditemui oleh simulasi portal awam & matriks status) —
      // laluan sandaran ni menghurai teks manualSummary MENTAH, yang mengandungi blok draf DAN
      // blok menunggu semakan bersama blok yang benar-benar diterbitkan. Sebelum ni ia mendorong
      // SETIAP blok ke frontpage AWAM tanpa melihat status langsung: slot legasi (tiada baris
      // editorial_objects) menyiarkan tulisan belum siap kepada pembaca. Disahkan hidup dua kali —
      // mula-mula tajuk "Status: draf", kemudian "Status: pending" — jadi senarai putih digunakan
      // di sini, BUKAN senarai hitam: apa-apa status baharu pada masa depan tersembunyi secara
      // lalai, bukan terdedah secara lalai.
      //
      // Blok tanpa baris "Status:" langsung dihurai sebagai 'approved' oleh
      // parseManualSummaryTemplate (sengaja — kandungan lama sebelum medan Status wujud), jadi ia
      // tetap lulus penapis ni dan kekal terpapar seperti dahulu.
      const parsedItems = parseManualSummaryTemplate(slot.manualSummary || '', slot)
        .filter((p) => p.status === 'approved');
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
          // Sumber berbilang (2026-08-05) — senarai PENUH untuk Focus View; label kad ("source"
          // atas) diselaraskan ke "Editorial Adjung" di FrontpageView.tsx bila panjang > 1.
          sources: Array.isArray(parsed.sources) ? parsed.sources : [],
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
      // Sumber berbilang (2026-08-05) — parse selamat (JSON rosak/lama tiada medan ni langsung
      // = senarai kosong, bukan ranap laluan baca kandungan).
      const sourcesJsonAv = avs.find(a => a.attributeId === 'sourcesJson');
      let sources = [];
      if (sourcesJsonAv && sourcesJsonAv.valueText) {
        try {
          const parsedSources = JSON.parse(sourcesJsonAv.valueText);
          if (Array.isArray(parsedSources)) sources = parsedSources;
        } catch (e) { /* JSON rosak — kekal senarai kosong, jangan ranap. */ }
      }

      subItems.push({
        // objectId (2026-08-05, Fasa 11 — perkongsian sosial) — dibawa terus ke klien supaya
        // Focus View boleh minta kod URL pendek sebenar (GET .../url-kod) untuk butang kongsi/
        // pautan kanonikal, bukan window.location.href generik. Draf tak-diterbitkan (blok
        // manual di atas, editorialObj.id = 'manual') sengaja TIADA medan ni — belum ada rekod
        // editorial_objects sebenar untuk dijana kod.
        objectId,
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
        sources,
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
//
// Gerbang sesi (2026-08-02, Fasa 1) — SEBELUM ini SIFAR laluan dilindungi. Gerbang HANYA
// diletak di sini (peringkat app.use) untuk TIGA awalan yang benar-benar EKSKLUSIF (tiada
// router lain berkongsi '/api/ai', '/api/media', '/api/translation') — Express menyemak
// setiap app.use ikut awalan laluan (prefix match) dalam turutan didaftar, BUKAN ikut router
// mana yang "sepatutnya" mengendalikannya. Meletakkan gerbang pada awalan yang DIKONGSI
// (bare '/api' atau '/api/system' — hampir SEMUA laluan di bawah kongsi salah satu ini) akan
// menyekat SETIAP laluan lain yang berkongsi awalan sama, termasuk /api/auth/login itu
// sendiri — pepijat sebenar yang berlaku semasa versi pertama pelaksanaan ni (2026-08-02,
// disahkan: log masuk pulangkan 401 sebab mount '/api' createSystemRoutes menyekat dahulu).
// Untuk semua laluan yang berkongsi awalan, gerbang diletak DI DALAM fail router itu sendiri,
// pada setiap laluan (`router.post('/x', requireAuth, ...)`), bukan `router.use(...)` —
// sebab yang sama: `.use()` tanpa laluan khusus turut menyekat laluan router lain yang
// singgah melaluinya semasa Express menyemak susunan mount.
app.use('/api/ai', requireAuthForWrites, createAIRoutes(dbAll, dbRun, dbGet));
app.use('/api/system', createCategoryRoutes(db));
app.use('/api', createSystemRoutes(dbAll, dbRun, dbGet, safeJsonParse, mockDb));
app.use('/api/system', createSlotRoutes(dbAll, dbRun, dbGet));
app.use('/api/system/ai', createAiCostRoutes(dbAll, dbGet, dbRun));
app.use('/api/translation', requireAuthForWrites, createTranslationRoutes(dbAll, dbRun));
app.use('/api/system', createChangelogRoutes(__dirname));
app.use('/api/media', requireAuthForWrites, createMediaRoutes(__dirname));
app.use('/api/auth', createAuthRoutes(dbGet, dbRun, dbAll));
app.use('/api', createDbStateRoutes(dbAll, dbGet));
app.use('/api/system', createPipelineRoutes(db, dbGet, dbRun, runEditorialPipeline, runAllScheduledSlots));
app.use('/api/system', createSlotsConfigRoutes(db, dbAll, dbRun, syncManualObjectsForSlot, parseManualSummaryTemplate));
app.use('/api/system', createLayoutRoutes(db, dbAll, resolveSlotContent));
app.use('/api/system', createContentRoutes(db, dbAll, dbGet, dbRun));
app.use('/api/system', createWorldClockRoutes(dbGet));
app.use('/api/system', createTierSettingsRoutes(dbAll, dbRun));
app.use('/api/system', createSlotEditorRoutes(dbAll, dbRun, dbGet));
app.use('/api/system', createDraftRoutes(dbAll));
app.use('/api/system', createViewStatsRoutes(dbAll, dbRun));
// Dilekap pada /api (bukan /api/system) sebab modul ni ada DUA laluan berlainan skop:
// /api/system/editor-notes (Editorium) dan /api/public/editor-notes (portal awam). Gerbang
// peranan diletak DALAM editorNotesRoutes.js sendiri, pada setiap laluan.
app.use('/api', createEditorNotesRoutes(dbAll, dbRun, dbGet));
app.use('/api/system', createGlosariRoutes(dbAll, dbRun, dbGet));
app.use('/api/system', createEjaanRoutes(dbAll, dbRun, dbGet));
app.use('/api/system', createProfileRoutes(dbGet, dbRun));
app.use('/api/system', createSlotAmRoutes(dbGet, dbRun));
app.use('/api/system', createUserAdminRoutes(dbAll, dbRun, dbGet));
app.use('/api', createNotificationRoutes(dbAll, dbRun, dbGet));
app.use('/api/system', createAuditLogRoutes(dbAll));
app.use('/api/system', createUiLabelRoutes(dbAll, dbRun));
app.use('/api', createArticleUrlRoutes(dbAll, dbGet, dbRun));
app.use('/api', createSearchRoutes(dbAll));
app.use('/api', createSponsorRoutes(dbAll, dbRun, dbGet));
// Bukan di bawah /api sengaja — sitemap.xml mesti wujud di root laman ikut konvensyen crawler
// (robots.txt di public/robots.txt rujuk /sitemap.xml). Vite dev proxy hanya hantar laluan /api
// ke server ni (lihat vite.config.ts); sehingga Fasa 15 sambungkan express.static untuk hidangkan
// dist/, laluan ni boleh dicapai terus di port Express (cth curl http://localhost:5000/sitemap.xml).
app.use(createSitemapRoutes(dbAll, dbGet, dbRun));

// Sama sebab macam sitemap.xml di atas — rss.xml mesti wujud di root laman ikut konvensyen
// pembaca suapan (bukan /api). Fasa 10 — Suapan RSS keluar (bukan ingest, lihat
// core/sources/RssDirectEngine.js untuk ingest suapan luar).
app.use(createRssFeedRoutes(dbAll, dbGet, dbRun));

// Laluan awam /:bidangSlug/kandungan/:kodPendek (Fasa 9, 2026-08-05) — MESTI didaftar sebelum
// fallback SPA statik di bawah supaya bot dapat HTML pra-terap, bukan index.html kosong. `next()`
// (kod tak dijumpai / bukan bot / ralat) jatuh terus ke fallback SPA di bawah — react-router-dom
// klien uruskan laluan yang sama untuk pengguna manusia. Lihat core/routes/articleUrlRoutes.js.
app.use(createPublicArticleRoute(dbAll, dbGet));

// Laluan serve produksi (2026-08-02, Fasa 15 — "prestasi & kesediaan produksi"). Dahulu Express
// TAK PERNAH hidangkan frontend terbina — dev sentiasa lalui proksi Vite (lihat vite.config.ts,
// server.proxy '/api' → port Express). Untuk deploy sebenar (skrip `npm start`, bukan `npm run
// dev`) Express sendiri kena hidangkan `dist/` (output `vite build`) dan folder muat naik media.
// `/uploads` sepatutnya sudah sedia dihidang secara statik oleh mediaRoutes.js sendiri — lihat
// di situ; baris ni tambahan keselamatan sekiranya laluan tu tak dimuatkan pada mount tertentu.
const distDir = path.join(__dirname, 'dist');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir));
}
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // Fallback SPA: sebarang GET bukan-API yang tak sepadan fail statik (cth navigasi terus ke
  // `/editorium` atau `/soalan-lazim`) kena hidangkan `index.html` supaya react-router-dom
  // (client-side routing) yang uruskan laluan tu, bukan Express pulangkan 404. Diletak SELEPAS
  // semua app.use('/api', ...) dan sitemap.xml/rss.xml di atas supaya laluan tu tak tertangkap.
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`Menghidang binaan produksi dari ${distDir}`);
} else {
  console.log('Tiada dist/ ditemui — jalankan `npm run build` untuk laluan serve produksi (dev guna proksi Vite berasingan).');
}

// Pindaan had aksara tier dimuatkan SEKALI semasa boot, kemudian dimuat semula setiap kali
// disimpan (lihat tierSettingsRoutes.js) — validateContentBudget() sync, jadi ia baca cache
// dalam-memori ni, bukan pangkalan data pada setiap pengesahan.
loadAmSettings(dbGet);

loadTierOverrides(dbAll).then(map => {
  const bil = Object.keys(map).length;
  if (bil) console.log(`Pindaan had aksara tier dimuatkan: ${bil} tier.`);
});

// Matriks kebenaran RBAC (2026-08-02, Fasa 3) dimuatkan SEKALI semasa boot, disegarkan semula
// setiap kali disimpan (lihat systemRoutes.js POST /system/settings) — requirePermission() baca
// cache dalam-memori ni segerak, sama corak seperti loadAmSettings/loadTierOverrides di atas.
loadRolePermissions(dbGet).then(() => {
  console.log('Matriks kebenaran peranan (Kawalan Akses) dimuatkan.');
});

// Pengendali ralat global Express (2026-08-02, Fasa 1) — dahulu SIFAR: sebarang throw segerak
// yang tak ditangkap dalam satu handler pulangkan stack trace HTML lalai Express terus kepada
// pelanggan. MESTI diletak SELEPAS semua app.use/mount di atas (Express hanya panggil handler
// 4-argumen ini bila diletak paling akhir).
// Peti Makluman — ralat pelayan (2026-08-05, permintaan pemilik projek: "setiap ralat/perkara
// penting patut sampai Peti Makluman"). Kunci minit sejuk (10 minit) elak banjir notis sama bila
// SATU laluan rosak kena hentam berulang-ulang dalam masa singkat — Pentadbir/Ketua Editor perlu
// tahu ADA masalah, bukan dibanjiri puluhan notis serupa untuk satu insiden yang sama.
let ralatPelayanTerakhirDinotis = 0;
const RALAT_PELAYAN_SEJUK_MS = 10 * 60 * 1000;

app.use((err, req, res, next) => {
  // Ralat KLIEN dikenal pasti dahulu (2026-08-07, ditemui oleh simulasi input-jahat) — badan JSON
  // rosak atau melebihi had saiz dahulunya jatuh ke pengendali umum di bawah dan dilaporkan
  // sebagai 500 "Ralat pelayan dalaman", lalu turut mencetuskan notifikasi "ralat pelayan" kepada
  // Pentadbir/Ketua Editor. Kedua-duanya salah: pelayan berfungsi dengan betul, permintaan yang
  // cacat. Balas 400/413 dan JANGAN kejutkan sesiapa.
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({ error: 'Badan permintaan bukan JSON yang sah.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Permintaan terlalu besar.' });
  }

  console.error('Ralat tidak dijangka pada', req.method, req.originalUrl, ':', err);
  // Log Audit (Fasa 4) — catat ralat pelayan yang tak ditangkap supaya boleh disemak dari Log
  // Sistem, bukan cuma konsol proses (yang hilang bila server dimulakan semula/PM2 pusing log).
  logAudit(dbRun, {
    actorId: req.session?.user?.id,
    actorName: req.session?.user?.penName || req.session?.user?.username,
    action: 'ralat-pelayan',
    targetType: 'server',
    detail: `${req.method} ${req.originalUrl}: ${err.message || err}`,
  }).catch(() => {});
  const sekarang = Date.now();
  if (sekarang - ralatPelayanTerakhirDinotis >= RALAT_PELAYAN_SEJUK_MS) {
    ralatPelayanTerakhirDinotis = sekarang;
    dbAll("SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')")
      .then((rows) => notifyMany(dbRun, (rows || []).map((r) => r.userId), {
        type: 'sistem_ralat_pelayan',
        title: 'Ralat pelayan tak dijangka berlaku',
        detail: `${req.method} ${req.originalUrl}: ${(err.message || String(err)).slice(0, 150)}`,
        targetType: 'sistem',
      }))
      .catch(() => {});
  }
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Ralat pelayan dalaman.' });
});

// Kegagalan proses yang tak ditangkap (2026-08-02) — dahulu tiada langsung; crash senyap tanpa
// jejak. Log dahulu supaya sebab kegagalan dapat disemak, kemudian keluar (proses pengurus
// seperti PM2 patut mulakan semula) — meneruskan proses selepas keadaan tak diketahui lebih
// berbahaya daripada gagal bersih.
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});

// Penutupan bersih (2026-08-02) — pastikan pemegang SQLite ditutup dengan kemas supaya jurnal
// panas tidak tertinggal bila proses dihentikan (cth semasa deploy semula).
const gracefulShutdown = (signal) => {
  console.log(`${signal} diterima — menutup pelayan...`);
  db.close((err) => {
    if (err) console.error('Ralat menutup pangkalan data:', err);
    process.exit(err ? 1 : 0);
  });
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Dasar aktif editorial (2026-08-05, permintaan Izzat) — "editor wajib aktif dalam had tempoh
// yg ditetapkan, kalau tak akan digantung dan dipecat... supaya semua editor main peranan dan
// aktif." "Aktif" ditakrif KANDUNGAN DITERBITKAN (bukan log masuk sahaja, keputusan Izzat) —
// asas pengiraan ialah `lastPublishedAt` (dikemas kini contentRoutes.js setiap kali kandungan
// bercap nama editor tu bertukar ke status approved BAHARU), jatuh balik ke `createdAt` untuk
// akaun yang belum pernah terbit apa-apa (tempoh bertenang, bukan terus dikira tak aktif dari
// hari pertama). Tiga tahap (nombor tepat daripada Izzat): hari ke-7 amaran pertama, hari ke-14
// amaran kedua, hari ke-21 notis penamatan + akaun DIGANTUNG automatik (status='Tidak Aktif').
// "Ditamatkan" (rekod pemecatan rasmi) KEKAL keputusan Pentadbir — sistem TIDAK menamatkan
// terus, cuma menggantung (lihat DirektoriConsole.tsx, butang "Ditamatkan" sedia ada).
// `amaranTakAktifTahap` (0-3) elak e-mel sama dihantar berulang setiap kali tik berjalan,
// direset ke 0 automatik bila editor terbit semula (lihat contentRoutes.js).
const HARI_MS = 24 * 60 * 60 * 1000;
const AMBANG_TAK_AKTIF = { amaranPertama: 7 * HARI_MS, amaranKedua: 14 * HARI_MS, notisPenamatan: 21 * HARI_MS };
const PERANAN_TERPAKAI_DASAR_AKTIF = ['editor', 'ketua_editor', 'penolong_ketua_editor'];

const emelAmaranTakAktif = (namaPena, hariTakAktif, tahap) => {
  const tajuk = tahap === 3
    ? 'Notis Penamatan — Akaun Adjung Brief Anda Digantung'
    : `Amaran Tidak Aktif (Hari ke-${hariTakAktif >= 14 ? 14 : 7}) — Adjung Brief`;
  const mesejUtama = tahap === 3
    ? `Akaun anda kini <strong>digantung automatik</strong> (status "Tidak Aktif") kerana tiada kandungan diterbitkan sejak ${hariTakAktif} hari. Log masuk telah disekat. Sidang Pentadbir/Ketua Editor akan menyemak akaun ini untuk keputusan seterusnya (aktifkan semula atau tamatkan rasmi).`
    : `Kami perhatikan akaun anda tiada kandungan diterbitkan sejak <strong>${hariTakAktif} hari</strong>. Sila terbitkan kandungan baharu tidak lama lagi untuk mengekalkan status akaun anda.`;
  const amaranSeterusnya = tahap === 1
    ? '<p>Jika tiada kandungan diterbitkan sehingga hari ke-14, satu lagi amaran akan dihantar. Tiada kandungan sehingga hari ke-21, akaun akan digantung automatik.</p>'
    : tahap === 2
      ? '<p>Jika tiada kandungan diterbitkan sehingga hari ke-21, akaun akan digantung automatik.</p>'
      : '';
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #802334;">Adjung Brief</h2>
      <p>Salam ${namaPena || 'Editor'},</p>
      <p>${mesejUtama}</p>
      ${amaranSeterusnya}
      <p style="color: #78716c; font-size: 12px; margin-top: 24px;">E-mel automatik daripada sistem Adjung Brief — dasar aktif editorial.</p>
    </div>
  `;
  return { tajuk, html };
};

const runSemakanTakAktif = async (dbAll, dbRun) => {
  const now = Date.now();
  const placeholders = PERANAN_TERPAKAI_DASAR_AKTIF.map(() => '?').join(',');
  // Akaun berperanan `pentadbir` DIKECUALIKAN (2026-08-06, pembetulan audit) — dasar aktif ni
  // mengukur KANDUNGAN DITERBITKAN, tapi Pentadbir sendiri ada `publish: false` dalam matriks
  // RBAC: dia secara struktur TAK BOLEH terbitkan kandungan, jadi mengukurnya dengan neraca tu
  // pasti gagal tak kira berapa rajin dia. Tanpa pengecualian ni, akaun pemilik projek (yang
  // pegang ketua_editor + pentadbir serentak) tergolong dalam dasar dan akan menggantung DIRINYA
  // SENDIRI pada hari ke-21 — tiada Pentadbir lain wujud untuk memulihkannya, jadi ia terkunci
  // keluar daripada sistem sendiri sepenuhnya (disahkan semasa audit: akaun sebenar sudah berada
  // di tahap amaran 1). Dasar ni memang direka untuk EDITOR, bukan penyelenggara sistem.
  const rows = await dbAll(`
    SELECT DISTINCT u.id, u.penName, u.email, u.createdAt, u.lastPublishedAt, u.amaranTakAktifTahap
    FROM users u
    INNER JOIN user_roles ur ON ur.userId = u.id AND ur.roleId IN (${placeholders})
    WHERE u.status = 'Aktif'
      AND NOT EXISTS (SELECT 1 FROM user_roles pa WHERE pa.userId = u.id AND pa.roleId = 'pentadbir')
  `, PERANAN_TERPAKAI_DASAR_AKTIF);

  for (const u of rows || []) {
    const basis = u.lastPublishedAt ? new Date(u.lastPublishedAt).getTime() : new Date(u.createdAt).getTime();
    if (!basis || Number.isNaN(basis)) continue;
    const takAktifMs = now - basis;
    const tahapSemasa = u.amaranTakAktifTahap || 0;
    let tahapBaharu = null;
    if (takAktifMs >= AMBANG_TAK_AKTIF.notisPenamatan && tahapSemasa < 3) tahapBaharu = 3;
    else if (takAktifMs >= AMBANG_TAK_AKTIF.amaranKedua && tahapSemasa < 2) tahapBaharu = 2;
    else if (takAktifMs >= AMBANG_TAK_AKTIF.amaranPertama && tahapSemasa < 1) tahapBaharu = 1;
    if (tahapBaharu === null) continue;

    const hariTakAktif = Math.floor(takAktifMs / HARI_MS);
    const { tajuk, html } = emelAmaranTakAktif(u.penName, hariTakAktif, tahapBaharu);
    if (u.email) {
      await hantarEmel({ to: u.email, subject: tajuk, html }).catch((e) => console.error('[Semakan Tak Aktif] Gagal hantar emel:', e.message));
    } else {
      // Editor tanpa emel berdaftar (2026-08-06, pembetulan audit) — dahulu eskalasi (termasuk
      // gantung automatik tahap 3) terus jalan senyap tanpa SEBARANG cara memberitahu editor tu
      // (notifikasi dalam-apl pun tak berguna kalau dia dah tak log masuk — itu puncanya jadi tak
      // aktif). Beritahu Pentadbir/Ketua Editor SETIAP peringkat (bukan tunggu tahap 3 gantung),
      // supaya seseorang boleh campur tangan secara manual (hubungi editor tu di luar sistem)
      // sebelum gantungan berlaku, bukan lepas fakta.
      const penerimaTiadaEmel = await dbAll("SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')");
      await notifyMany(dbRun, (penerimaTiadaEmel || []).map((r) => r.userId), {
        type: 'sistem_amaran_tak_aktif',
        title: `${u.penName || u.id}: tiada emel berdaftar — amaran tak aktif tahap ${tahapBaharu} tak dapat dihantar`,
        detail: `Tak aktif ${hariTakAktif} hari. Editor ni tiada emel dalam sistem — sila hubungi secara manual di luar sistem sebelum ${tahapBaharu === 3 ? 'gantungan berlaku' : 'eskalasi seterusnya'}.`,
        targetType: 'akaun', targetId: u.id,
      });
    }

    if (tahapBaharu === 3) {
      await dbRun("UPDATE users SET status = 'Tidak Aktif', isSuspended = 1, amaranTakAktifTahap = 3, updatedAt = ? WHERE id = ?", [new Date().toISOString(), u.id]);
      await logAudit(dbRun, {
        actorId: null, actorName: 'Sistem (Dasar Aktif)',
        action: 'akaun-digantung-tak-aktif', targetType: 'akaun', targetId: u.id,
        detail: `${u.penName || u.id}: tiada kandungan diterbitkan sejak ${hariTakAktif} hari — digantung automatik.`,
      });
      await notify(dbRun, {
        userId: u.id, type: 'sistem_akaun_digantung',
        title: 'Akaun anda digantung automatik (tidak aktif)',
        detail: `Tiada kandungan diterbitkan sejak ${hariTakAktif} hari.`,
        targetType: 'akaun', targetId: u.id,
      });
      const pentadbirRows = await dbAll("SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')");
      await notifyMany(dbRun, (pentadbirRows || []).map((r) => r.userId), {
        type: 'sistem_akaun_digantung',
        title: `${u.penName || u.id}: akaun digantung automatik (tak aktif ${hariTakAktif} hari)`,
        detail: 'Semak Direktori untuk keputusan seterusnya (aktifkan semula atau Ditamatkan).',
        targetType: 'akaun', targetId: u.id,
      });
    } else {
      await dbRun("UPDATE users SET amaranTakAktifTahap = ? WHERE id = ?", [tahapBaharu, u.id]);
      await notify(dbRun, {
        userId: u.id, type: 'sistem_amaran_tak_aktif',
        title: tajuk,
        detail: `Tiada kandungan diterbitkan sejak ${hariTakAktif} hari.`,
        targetType: 'akaun', targetId: u.id,
      });
    }
  }
};

// Start Express Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API server running on http://localhost:${PORT}`);
  semakKonfigSmtpStartup();

  // Scheduler dalaman: server ni proses Node yang berjalan berterusan (bukan serverless).
  //
  // 2026-08-02 — Izzat putuskan tak nak guna saluran penjanaan AI automatik lagi (saluran
  // kandungan sah kini: Manual, API luar bukan-AI, RSS; AI hanya sebagai alat bantu manual
  // dalam chatbox editor, bukan pipeline automatik). `runAllScheduledSlots` (jana AI ikut
  // "Kadar Segar Semula" yang ditetapkan di Mini Editorium) DIMATIKAN di sini SENGAJA —
  // fungsi & laluan pipeline (`runEditorialPipeline`, `POST /api/system/slots/run-now`)
  // kekal wujud dalam kod, cuma tak dipanggil automatik lagi. Jangan aktifkan semula tanpa
  // arahan eksplisit.
  const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;
  let lastRssAutoFetchTime = 0;
  const RSS_AUTO_FETCH_INTERVAL_MS = 3 * 60 * 60 * 1000; // Auto-refresh RSS every 3 hours (8x a day / 4 target windows)

  setInterval(() => {
    const now = Date.now();
    if (now - lastRssAutoFetchTime >= RSS_AUTO_FETCH_INTERVAL_MS) {
      lastRssAutoFetchTime = now;
      console.log('[RSS Auto Scheduler] Triggering automated RSS Direct absorption...');
      executeDirectRssFetch(dbAll, dbGet, dbRun)
        .then((res) => console.log(`[RSS Auto Scheduler] Absorbed ${res.autoLiveCount} Auto-Live RSS items.`))
        .catch((err) => console.error('[RSS Auto Scheduler] Error:', err.message));
    }
  }, SCHEDULER_INTERVAL_MS);
  console.log(`Internal RSS Direct scheduler active (checks every ${SCHEDULER_INTERVAL_MS / 60000} min). Scheduler penjanaan AI automatik DIMATIKAN sengaja.`);

  // Semakan pautan mati (2026-08-05, Fasa 8b) — sama corak macam penjadual lain di sini: setInterval
  // dalam callback app.listen, dibalut cuba/tangkap PENUH supaya kegagalan semakan (atau pelayan
  // luar yang perlahan/mati) TIDAK sekali-kali rebahkan server. 12 jam cukup kerap untuk kandungan
  // kad bento yang boleh kekal bulanan, tanpa terlalu kerap hantar permintaan ke pelayan luar.
  const LINK_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
  setInterval(() => {
    checkAllSourceLinks(dbAll, dbRun)
      .then((res) => console.log(`[Semakan Pautan] Diperiksa ${res.diperiksa} URL, ${res.mati} mati.`))
      .catch((err) => console.error('[Semakan Pautan] Ralat:', err.message));
  }, LINK_CHECK_INTERVAL_MS);
  console.log(`Semakan pautan mati aktif (setiap ${LINK_CHECK_INTERVAL_MS / 3600000} jam).`);

  // Jadual Terbit / Jadual Luput (2026-08-02) — semak berkala sama corak seperti RSS Auto
  // Scheduler di atas: setInterval dalam callback app.listen, dibalut cuba/tangkap penuh supaya
  // kegagalan tik TIDAK sekali-kali rebahkan server. 90 saat cukup responsif untuk portal berita
  // bahasa Melayu ni tanpa terlalu kerap tinjau DB (lihat core/routes/contentRoutes.js
  // runSchedulingTick untuk logik penuh).
  const JADUAL_TICK_INTERVAL_MS = 90 * 1000;
  setInterval(() => {
    runSchedulingTick(dbAll, dbGet, dbRun).catch((err) => console.error('[Jadual Terbit/Luput] Ralat tik:', err.message));
  }, JADUAL_TICK_INTERVAL_MS);
  console.log(`Penjadual Terbit/Luput aktif (semak setiap ${JADUAL_TICK_INTERVAL_MS / 1000} saat).`);

  // Backup automatik adjung.db (2026-08-02, Fasa 15) — dahulu SEMATA-MATA manual (`cp adjung.db
  // adjung.db.backup-<ts>` diikuti sendiri setiap kali sebelum operasi destruktif, lihat
  // CLAUDE.md #4). Tiada jaring keselamatan automatik bermakna crash/operasi tersasar antara dua
  // backup manual tersendiri boleh musnahkan kandungan editorial sebenar TANPA cara pulih —
  // `adjung.db` gitignored dan tiada salinan lain langsung. Salinan fail SQLite saiz sebegini
  // (~beberapa MB) hampir seketika, tapi tetap dibalut cuba/tangkap penuh — backup gagal MESTI
  // tak sekali-kali rebahkan server.
  const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // sekali sehari
  const BACKUP_RETENTION_COUNT = 7; // simpan 7 salinan terkini, buang yang lebih lama
  const runScheduledBackup = () => {
    try {
      if (!fs.existsSync(dbPath)) return;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(__dirname, `adjung.db.backup-auto-${ts}`);
      fs.copyFileSync(dbPath, backupPath);
      console.log(`[Backup Automatik] Salinan dicipta: ${backupPath}`);

      // Kuatkuasakan dasar pengekalan — buang salinan AUTOMATIK lama sahaja (awalan
      // `adjung.db.backup-auto-`), jangan sentuh backup MANUAL sedia ada (pelbagai corak nama,
      // dicipta sendiri sebelum operasi destruktif — lihat CLAUDE.md #4) supaya tak padam
      // sejarah pemulihan yang mungkin masih diperlukan.
      const files = fs.readdirSync(__dirname)
        .filter(f => f.startsWith('adjung.db.backup-auto-'))
        .sort(); // nama ISO-timestamp menaik secara leksikal = menaik ikut masa
      const excess = files.length - BACKUP_RETENTION_COUNT;
      if (excess > 0) {
        files.slice(0, excess).forEach(f => {
          try {
            fs.unlinkSync(path.join(__dirname, f));
            console.log(`[Backup Automatik] Buang salinan lapuk: ${f}`);
          } catch (unlinkErr) {
            console.error(`[Backup Automatik] Gagal buang ${f}:`, unlinkErr.message);
          }
        });
      }
    } catch (err) {
      console.error('[Backup Automatik] Gagal cipta backup:', err.message);
    }
  };
  setInterval(runScheduledBackup, BACKUP_INTERVAL_MS);
  console.log(`Backup automatik adjung.db aktif (sekali setiap ${BACKUP_INTERVAL_MS / 3600000} jam, simpan ${BACKUP_RETENTION_COUNT} salinan terkini).`);

  // Dasar aktif editorial — Semakan Tak Aktif (2026-08-05, permintaan Izzat). Sama corak macam
  // penjadual lain di sini: setInterval dibalut cuba/tangkap penuh, kegagalan TIDAK sekali-kali
  // rebahkan server. Sekali sehari cukup — ambang dikira dalam HARI, bukan jam/minit.
  const SEMAKAN_TAK_AKTIF_INTERVAL_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    runSemakanTakAktif(dbAll, dbRun).catch((err) => console.error('[Semakan Tak Aktif] Ralat:', err.message));
  }, SEMAKAN_TAK_AKTIF_INTERVAL_MS);
  console.log(`Semakan tak aktif editorial aktif (sekali setiap ${SEMAKAN_TAK_AKTIF_INTERVAL_MS / 3600000} jam — amaran hari-7/hari-14, gantung automatik hari-21).`);

  // Pembersihan sesi luput (2026-08-07, Tier 1 audit inventori) — sebelum ni TIADA pembersihan
  // berkala langsung; jadual `sessions` (sessions.db, connect-sqlite3) membesar SELAMANYA. Ini
  // turut bermakna SesiPengguna.js (batal sesi lain selepas tukar kata laluan) — yang mengimbas
  // PENUH jadual + hurai JSON setiap baris — makin lambat setiap hari tanpa pembersihan ni.
  // connect-sqlite3 simpan `expired` sebagai UNIX epoch MILISAAT (bukan saat) — disahkan lajur
  // tu di core/auth/SesiPengguna.js. Sekali sehari cukup, sama corak jadual lain di sini.
  const PEMBERSIHAN_SESI_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const bersihkanSesiLuput = () => {
    sessionDb.run('DELETE FROM sessions WHERE expired < ?', [Date.now()], function (err) {
      if (err) { console.error('[Pembersihan Sesi] Ralat:', err.message); return; }
      if (this.changes > 0) console.log(`[Pembersihan Sesi] ${this.changes} sesi luput dibuang.`);
    });
  };
  bersihkanSesiLuput();
  setInterval(bersihkanSesiLuput, PEMBERSIHAN_SESI_INTERVAL_MS);
  console.log(`Pembersihan sesi luput aktif (sekali setiap ${PEMBERSIHAN_SESI_INTERVAL_MS / 3600000} jam).`);
});
