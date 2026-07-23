import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('adjung.db');

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

async function testResolution() {
  console.log("=== JAMINAN UJIAN RESOLUSI MODEL DINAMIK ===");
  
  // 1. Simpan model asal slot -1 (Ticker)
  const originalSlot = await dbGet("SELECT model FROM slots_config WHERE slotIndex = -1");
  const originalModel = originalSlot ? originalSlot.model : 'gemini-3.1-flash-lite';
  console.log(`Model Asal di Pangkalan Data: ${originalModel}`);

  // Test Case A: Ubah model slot kepada gemini-1.5-pro
  console.log("\nSimulasi Test Case A: Menukar model kepada 'gemini-1.5-pro' di UI...");
  await dbRun("UPDATE slots_config SET model = 'gemini-1.5-pro' WHERE slotIndex = -1");
  
  // Baca semula slot & provider seolah-olah pipeline berjalan
  let slot = await dbGet("SELECT * FROM slots_config WHERE slotIndex = -1");
  let provider = await dbGet("SELECT * FROM ai_providers WHERE id = ?", [slot.providerId]);
  let modelToUse = slot.model || provider.model;
  console.log(`-> Hasil Resolusi Model ke API: ${modelToUse} (Jangkaan: gemini-1.5-pro)`);

  // Test Case B: Ubah model slot kepada gemini-2.5-flash
  console.log("\nSimulasi Test Case B: Menukar model kepada 'gemini-2.5-flash' di UI...");
  await dbRun("UPDATE slots_config SET model = 'gemini-2.5-flash' WHERE slotIndex = -1");
  
  slot = await dbGet("SELECT * FROM slots_config WHERE slotIndex = -1");
  provider = await dbGet("SELECT * FROM ai_providers WHERE id = ?", [slot.providerId]);
  modelToUse = slot.model || provider.model;
  console.log(`-> Hasil Resolusi Model ke API: ${modelToUse} (Jangkaan: gemini-2.5-flash)`);

  // Test Case C: Jika slot.model diturunkan kepada null (Fallback)
  console.log("\nSimulasi Test Case C: Mengosongkan model slot (Fallback ke Default Provider)...");
  await dbRun("UPDATE slots_config SET model = NULL WHERE slotIndex = -1");
  
  slot = await dbGet("SELECT * FROM slots_config WHERE slotIndex = -1");
  provider = await dbGet("SELECT * FROM ai_providers WHERE id = ?", [slot.providerId]);
  modelToUse = slot.model || provider.model;
  console.log(`-> Hasil Resolusi Model ke API: ${modelToUse} (Jangkaan: ${provider.model})`);

  // 2. Kembalikan model asal
  await dbRun("UPDATE slots_config SET model = ? WHERE slotIndex = -1", [originalModel]);
  console.log(`\nModel asal '${originalModel}' telah dipulihkan.`);
  
  db.close();
}

testResolution().catch(console.error);
