// sim47 — sahkan pembetulan fallbackProviderId di EditorialPipeline.js (2026-09-09 bug-hunt).
// Sebelum ni failover AI tulis providerId literal 'claude'/'gemini' terus ke ai_usage_logs,
// padahal FOREIGN KEY providerId REFERENCES ai_providers(id) dan baris disemai guna id
// 'claude-1'/'gemini-1' (server.js seed asal). PRAGMA foreign_keys=ON aktif di server sebenar.
// Sim ni bina skema sub-set SEBENAR (sama definisi macam server.js) dalam DB buangan, uji
// tingkah laku LAMA (literal) vs BAHARU (carian dinamik ai_providers) bagi INSERT sebenar.
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'scratch-sim47.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new sqlite3.Database(dbPath);
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));

async function main() {
  await dbRun("PRAGMA foreign_keys = ON;");

  await dbRun(`CREATE TABLE ai_providers (
    id TEXT PRIMARY KEY, name TEXT, secretName TEXT, model TEXT,
    monthlyBudget REAL, dailyBudget REAL, status TEXT, lastTest TEXT, enabled INTEGER
  )`);
  await dbRun(`CREATE TABLE ai_model_pricing (
    providerId TEXT, modelName TEXT, inputCostPerMillion REAL, outputCostPerMillion REAL,
    currency TEXT, updatedAt TEXT, PRIMARY KEY(providerId, modelName)
  )`);
  await dbRun(`CREATE TABLE ai_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, runId TEXT, providerId TEXT NOT NULL, modelName TEXT NOT NULL,
    capability TEXT, promptTokens INTEGER DEFAULT 0, completionTokens INTEGER DEFAULT 0,
    totalTokens INTEGER DEFAULT 0, estimatedCost REAL DEFAULT 0, currency TEXT DEFAULT 'USD',
    latencyMs INTEGER, status TEXT, createdAt TEXT NOT NULL,
    FOREIGN KEY(providerId) REFERENCES ai_providers(id)
  )`);

  // Seed SAMA PERSIS server.js: id 'gemini-1'/'claude-1', bukan 'gemini'/'claude'.
  const now = new Date().toISOString();
  await dbRun("INSERT INTO ai_providers (id, name, secretName, model, monthlyBudget, dailyBudget, status, lastTest, enabled) VALUES (?,?,?,?,?,?,?,?,?)",
    ['gemini-1', 'Google Gemini', 'GEMINI_API_KEY', 'gemini-2.5-flash', 100, 10, 'Active', now, 1]);
  await dbRun("INSERT INTO ai_providers (id, name, secretName, model, monthlyBudget, dailyBudget, status, lastTest, enabled) VALUES (?,?,?,?,?,?,?,?,?)",
    ['claude-1', 'Claude (Anthropic)', 'CLAUDE_API_KEY', 'claude-3-5-sonnet-latest', 100, 10, 'Active', now, 1]);
  await dbRun("INSERT INTO ai_model_pricing (providerId, modelName, inputCostPerMillion, outputCostPerMillion, currency, updatedAt) VALUES (?,?,?,?,?,?)",
    ['claude-1', 'claude-3-5-sonnet-latest', 3.00, 15.00, 'USD', now]);

  // ---- Tingkah laku LAMA (literal 'claude') ----
  let ralatLama = null;
  try {
    await dbRun(
      "INSERT INTO ai_usage_logs (runId, providerId, modelName, capability, promptTokens, completionTokens, totalTokens, estimatedCost, currency, latencyMs, status, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      ['run1', 'claude', 'claude-3-5-sonnet-latest', 'Editorial Generation', 100, 50, 150, 0, 'USD', 0, 'SUCCESS', now]
    );
  } catch (e) {
    ralatLama = e.message;
  }
  console.log('[LAMA] INSERT dgn providerId literal "claude":', ralatLama ? `GAGAL (${ralatLama})` : 'BERJAYA (tak sepatutnya, FK longgar?)');

  // ---- Tingkah laku BAHARU (carian dinamik, seperti kod dibaiki) ----
  const carianProviderFallback = async (corak) => {
    const baris = await dbGet("SELECT id FROM ai_providers WHERE id LIKE ? ORDER BY id LIMIT 1", [corak]);
    return baris?.id || null;
  };
  const fallbackProviderIdBaharu = (await carianProviderFallback('claude%')) || 'claude';
  console.log('[BAHARU] fallbackProviderId diselesaikan kepada:', fallbackProviderIdBaharu);

  let ralatBaharu = null;
  try {
    await dbRun(
      "INSERT INTO ai_usage_logs (runId, providerId, modelName, capability, promptTokens, completionTokens, totalTokens, estimatedCost, currency, latencyMs, status, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      ['run2', fallbackProviderIdBaharu, 'claude-3-5-sonnet-latest', 'Editorial Generation', 100, 50, 150, 0, 'USD', 0, 'SUCCESS', now]
    );
  } catch (e) {
    ralatBaharu = e.message;
  }
  console.log('[BAHARU] INSERT dgn providerId diselesaikan:', ralatBaharu ? `GAGAL (${ralatBaharu})` : 'BERJAYA');

  const pricingRow = await dbGet("SELECT * FROM ai_model_pricing WHERE providerId = ? AND modelName = ?", [fallbackProviderIdBaharu, 'claude-3-5-sonnet-latest']);
  console.log('[BAHARU] Pricing dijumpai untuk providerId diselesaikan:', pricingRow ? `YA (input=$${pricingRow.inputCostPerMillion}/M)` : 'TIDAK');
  const pricingRowLama = await dbGet("SELECT * FROM ai_model_pricing WHERE providerId = ? AND modelName = ?", ['claude', 'claude-3-5-sonnet-latest']);
  console.log('[LAMA] Pricing dijumpai untuk providerId literal "claude":', pricingRowLama ? 'YA' : 'TIDAK (kos jatuh ke $0)');

  const lulus = ralatLama && !ralatBaharu && fallbackProviderIdBaharu === 'claude-1' && pricingRow && !pricingRowLama;
  console.log('\n=== KEPUTUSAN:', lulus ? 'LULUS -- pembetulan sahkan menutup jurang FK + kos $0' : 'GAGAL', '===');
  process.exit(lulus ? 0 : 1);
}

main().catch((e) => { console.error('Ralat sim:', e); process.exit(1); });
