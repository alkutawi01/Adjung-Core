const path = require('path');
module.paths.push('c:/Users/alkut/Downloads/Adjung Mini/node_modules');
const sqlite3 = require('sqlite3');

const dbPath = path.resolve('c:/Users/alkut/Downloads/Adjung Mini/adjung.db');
const db = new sqlite3.Database(dbPath);

const testStateMachine = async () => {
  let originalContentMode = 'Manual';
  let originalProviderId = null;
  let originalPromptText = '';

  try {
    console.log('1. Checking slot 2 configuration before running...');
    const slotBefore = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM slots_config WHERE slotIndex = 2", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    originalContentMode = slotBefore.contentMode;
    originalProviderId = slotBefore.providerId;
    originalPromptText = slotBefore.promptText;

    console.log('- Slot contentMode:', originalContentMode);
    console.log('- lastAttemptAt (before):', slotBefore.lastAttemptAt);
    console.log('- lastRunStatus (before):', slotBefore.lastRunStatus);

    console.log('\nSetting slot 2 to AI Generated temporarily...');
    await new Promise((resolve, reject) => {
      db.run("UPDATE slots_config SET contentMode = 'AI Generated', providerId = 'gemini-1', promptText = 'Test prompt' WHERE slotIndex = 2", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('\n2. Triggering pipeline execution for slot 2 via backend API...');
    const res = await fetch('http://localhost:5000/api/system/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotIndex: 2 })
    });
    const result = await res.json();
    console.log('API Result:', result);

    console.log('\n3. Checking slot 2 configuration after running...');
    const slotAfter = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM slots_config WHERE slotIndex = 2", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    console.log('- lastAttemptAt (after):', slotAfter.lastAttemptAt);
    console.log('- lastRunStatus (after):', slotAfter.lastRunStatus);
    console.log('- lastRunMessage (after):', slotAfter.lastRunMessage);

    console.log('\nRestoring original slot 2 configuration...');
    await new Promise((resolve, reject) => {
      db.run("UPDATE slots_config SET contentMode = ?, providerId = ?, promptText = ? WHERE slotIndex = 2", [originalContentMode, originalProviderId, originalPromptText], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  } catch (err) {
    console.error('State machine test failed:', err);
  } finally {
    db.close();
  }
};

testStateMachine();
