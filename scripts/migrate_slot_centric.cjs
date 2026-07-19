const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../adjung.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database at:', dbPath);
});

const runDb = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const allDb = (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

async function migrate() {
  try {
    console.log('Starting Slot-Centric Database Migration...');

    // 1. Drop editorial_strategies table
    console.log('Dropping editorial_strategies table...');
    await runDb(`DROP TABLE IF EXISTS editorial_strategies`);

    // 2. Backup existing slots_config data
    console.log('Backing up existing slots_config data...');
    let existingSlots = [];
    try {
        existingSlots = await allDb(`SELECT * FROM slots_config`);
    } catch (e) {
        console.log('No existing slots_config found or error reading it:', e.message);
    }

    // 3. Drop existing slots_config table
    console.log('Recreating slots_config table...');
    await runDb(`DROP TABLE IF EXISTS slots_config`);

    // 4. Create new slots_config table with new schema
    await runDb(`
      CREATE TABLE slots_config (
        layoutTemplateId TEXT,
        slotIndex INTEGER,
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
        PRIMARY KEY (layoutTemplateId, slotIndex)
      )
    `);

    // 5. Restore data into new schema
    console.log('Restoring slots_config data...');
    for (const slot of existingSlots) {
      await runDb(`
        INSERT INTO slots_config (
          layoutTemplateId, slotIndex, contentMode, bgColor, borderColor, textColor, 
          manualTitle, manualSummary, manualSource, manualUrl, manualImageUrl, activeObjectId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        slot.layoutTemplateId,
        slot.slotIndex,
        slot.contentMode,
        slot.bgColor,
        slot.borderColor,
        slot.textColor,
        slot.manualTitle,
        slot.manualSummary,
        slot.manualSource,
        slot.manualUrl,
        slot.manualImageUrl,
        slot.overrideObjectId // Migrate overrideObjectId to activeObjectId
      ]);
    }

    console.log('Slot-Centric Database Migration completed successfully.');
    db.close();
  } catch (error) {
    console.error('Migration failed:', error);
    db.close();
    process.exit(1);
  }
}

migrate();
