const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('adjung.db');

async function test() {
    const res = await fetch('http://localhost:5000/api/system/slots');
    const slots = await res.json();
    const slot = slots[0];
    console.log(slot);
    
    db.run(`INSERT OR REPLACE INTO slots_config (
        layoutTemplateId, slotIndex, contentMode, providerId, model, promptText, sourcesList, refreshRate, allowedContentTypes, priority, expiresAt, bgColor, borderColor, textColor, manualTitle, manualSummary, manualSource, manualUrl, manualImageUrl, activeObjectId
    ) VALUES ('frontpage', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [slot.slotIndex, slot.contentMode, slot.providerId, slot.model, slot.promptText, slot.sourcesList, slot.refreshRate, slot.allowedContentTypes, slot.priority, slot.expiresAt, slot.bgColor, slot.borderColor, slot.textColor, slot.manualTitle, slot.manualSummary, slot.manualSource, slot.manualUrl, slot.manualImageUrl, slot.activeObjectId], 
    (err) => {
        if(err) console.log('DB ERROR:', err.message);
        else console.log('Success');
    });
}
test();
