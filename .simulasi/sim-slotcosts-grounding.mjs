// Sim: /api/system/ai/slot_costs kini kira groundingCalls ikut usedGrounding SEBENAR per-panggilan,
// bukan anggapan ikut searchStrategy slot (dapatan bug-hunt 2026-09-11).
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { bootServer, ciptaPentadbir, login, buatKlien, dbRun, bukaDb, REPO, pelapor } from './sim-lib.mjs';

const dbFile = path.join(REPO, '.simulasi', 'scratch-slotcosts-grounding.db');
const PORT = 34710;
const lapor = pelapor('slotcosts-grounding');

const { proc, base } = await bootServer({ port: PORT, dbFile });
try {
  const { username, pass } = await ciptaPentadbir(dbFile);
  const cookie = await login(base, username, pass);
  const klien = buatKlien(base, cookie);

  const db = bukaDb(dbFile);
  const now = new Date().toISOString();

  // Slot 5: strategi "Structured Sources -> Search Fallback", TAPI 3 panggilan sebenar TIDAK
  // guna carian langsung (pool berjaya diambil, usedGrounding=0) dan 1 panggilan sebenar guna
  // carian langsung (pool kosong, usedGrounding=1). Kod LAMA akan anggap KESEMUA 4 panggilan ni
  // grounding (sebab strategi slot ialah fallback), kod BAHARU patut kira cuma 1.
  for (let i = 0; i < 4; i++) {
    await dbRun(db, `INSERT INTO ai_usage_logs
      (runId, providerId, modelName, capability, promptTokens, completionTokens, totalTokens, estimatedCost, currency, latencyMs, status, createdAt, slotIndex, usedGrounding)
      VALUES (?, 'gemini-1', 'gemini-2.5-flash', 'Editorial Generation', 100, 50, 150, 0.001, 'USD', 500, 'SUCCESS', ?, 5, ?)`,
      [`run-${i}`, now, i === 0 ? 1 : 0]);
  }

  await new Promise(r => db.close(r));

  const r = await klien('GET', '/api/system/ai/slot_costs');
  const slot5 = (r.json || []).find(s => s.slotIndex === 5);

  if (!slot5) {
    lapor.gagal('Slot 5 muncul dalam /slot_costs', 'Tiada baris slotIndex=5 dalam respons: ' + JSON.stringify(r.json));
  } else if (slot5.aiCalls !== 4) {
    lapor.gagal('aiCalls slot 5 = 4', 'Sebenar: ' + slot5.aiCalls);
  } else if (slot5.groundingCalls !== 1) {
    lapor.gagal('groundingCalls slot 5 = 1 (hanya panggilan yang BENAR-BENAR guna carian langsung)', 'Sebenar: ' + slot5.groundingCalls + ' (pepijat lama akan pulangkan 4)');
  } else if (Math.abs(slot5.groundingCostUSD - 0.01) > 1e-9) {
    lapor.gagal('groundingCostUSD slot 5 = 0.01 (1 panggilan x $0.01)', 'Sebenar: ' + slot5.groundingCostUSD);
  } else {
    lapor.lulus('groundingCalls dikira ikut usedGrounding SEBENAR per-panggilan (1/4), bukan anggapan ikut strategi slot (yang akan salah anggap 4/4)');
  }
} finally {
  proc.kill();
  lapor.ringkasan();
}
