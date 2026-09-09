// sim65 — SEBAB_MENUNGGU_LABEL (status.pending.semakan / status.pending.slot_penuh,
// src/config/istilah.ts) tertinggal daripada SEMUA_LABEL_LALAI sejak ditambah 2026-09-04.
// server.js seedDatabase() gelung SEMUA_LABEL_LALAI sahaja untuk isi jadual `ui_labels` semasa
// boot, jadi dua kunci ni tak pernah wujud sebagai baris — Tetapan → Label Sistem (TetapanConsole,
// sumber SAMA SEMUA_LABEL_LALAI) tak pernah papar/benarkan sunting label ni walau labelSebabMenunggu()
// (istilah.ts) sudah lengkap sokong gantian(). Skrip ni sahkan kunci tu kini WUJUD (disemai) selepas
// pembetulan.
import { bootServer, bukaDb, dbGet, REPO } from './sim-lib.mjs';
import path from 'node:path';

const PORT = 5965;
const DB_FILE = path.join(REPO, '.simulasi', 'scratch-sim65.db');
const lapor = (ok, msg) => console.log(`[${ok ? 'LULUS' : 'GAGAL'}] ${msg}`);

async function utama() {
  const { proc } = await bootServer({ port: PORT, dbFile: DB_FILE, freshDb: true });
  try {
    const db = bukaDb(DB_FILE);
    const a = await dbGet(db, 'SELECT key, value FROM ui_labels WHERE key = ?', ['status.pending.semakan']);
    const b = await dbGet(db, 'SELECT key, value FROM ui_labels WHERE key = ?', ['status.pending.slot_penuh']);
    console.log('  status.pending.semakan row:', JSON.stringify(a));
    console.log('  status.pending.slot_penuh row:', JSON.stringify(b));
    lapor(!!a && a.value === 'Menunggu Semakan', 'status.pending.semakan disemai dgn nilai lalai betul');
    lapor(!!b && b.value === 'Menunggu Slot Kosong', 'status.pending.slot_penuh disemai dgn nilai lalai betul');
  } finally {
    proc.kill();
  }
}

utama().catch((e) => { console.error(e); process.exit(1); });
