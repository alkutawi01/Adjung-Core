const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'adjung.db');
const db = new sqlite3.Database(dbPath);

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

function parseInTheNews(text) {
  const items = [];
  if (!text) return items;
  const sections = text.split(/^[ \t]*(?:[-_—–―]{3,}|⸻+)[ \t]*$/gm);
  
  sections.forEach((section, index) => {
    const lines = section.split('\n');
    let desk = '', title = '', brief = '', source = '', url = '';
    let deskB = '', titleB = '', briefB = '', sourceB = '', urlB = '';
    let offset = 0, aiProvider = '', bgColor = '', borderColor = '', textColor = '';
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
        if (!url) url = trimmed;
        else if (!urlB) urlB = trimmed;
        return;
      }
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex <= 0) return;
      const key = trimmed.substring(0, colonIndex).trim().toLowerCase();
      const val = trimmed.substring(colonIndex + 1).trim();
      
      if (key === 'desk' || key === 'deska') desk = val;
      else if (key === 'deskb') deskB = val;
      else if (key === 'title' || key === 'titlea') title = val;
      else if (key === 'titleb') titleB = val;
      else if (key === 'brief' || key === 'summary' || key === 'briefa' || key === 'summarya') brief = val;
      else if (key === 'briefb' || key === 'summaryb') briefB = val;
      else if (key === 'source' || key === 'sourcea') source = val;
      else if (key === 'sourceb') sourceB = val;
      else if (key === 'url' || key === 'urla') url = val;
      else if (key === 'urlb') urlB = val;
      else if (key === 'offset' || key === 'switchoffset') offset = parseInt(val, 10) || 0;
      else if (key === 'aiprovider') aiProvider = val;
      else if (key === 'bgcolor') bgColor = val;
      else if (key === 'bordercolor') borderColor = val;
      else if (key === 'textcolor') textColor = val;
    });
    
    if (desk || title || brief || source || url || deskB || titleB || briefB || sourceB || urlB) {
      items.push({
        desk, title, brief, source, url,
        deskB, titleB, briefB, sourceB, urlB,
        offset, aiProvider, bgColor, borderColor, textColor,
        rawIndex: index + 1
      });
    }
  });
  return items;
}

const migrate = async () => {
  console.log('Starting migration to Editorial Operating System...');
  
  db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON;");
  });

  // Create tables
  await runQuery(`
    CREATE TABLE IF NOT EXISTS ai_providers (
      id TEXT PRIMARY KEY,
      name TEXT,
      secretName TEXT,
      model TEXT,
      monthlyBudget REAL,
      dailyBudget REAL,
      status TEXT,
      lastTest TEXT,
      enabled INTEGER DEFAULT 1
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT,
      templateText TEXT,
      version TEXT,
      updatedAt TEXT
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS editorial_strategies (
      id TEXT PRIMARY KEY,
      name TEXT,
      providerId TEXT,
      promptId TEXT,
      sourceId TEXT,
      outputType TEXT,
      refreshRate TEXT,
      enabled INTEGER DEFAULT 1
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS editorial_objects (
      id TEXT PRIMARY KEY,
      type TEXT,
      categoryId TEXT,
      priority TEXT,
      createdAt TEXT
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS editorial_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objectId TEXT,
      version REAL,
      title TEXT,
      summary TEXT,
      status TEXT,
      createdBy TEXT,
      createdAt TEXT
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS media_library (
      id TEXT PRIMARY KEY,
      type TEXT,
      alt TEXT,
      copyright TEXT,
      credit TEXT,
      width INTEGER,
      height INTEGER,
      storagePath TEXT,
      createdAt TEXT
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS editorial_attributes (
      id TEXT PRIMARY KEY,
      name TEXT,
      valueType TEXT
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS editorial_attribute_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objectId TEXT,
      revisionId INTEGER,
      attributeId TEXT,
      valueText TEXT
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS layout_templates (
      id TEXT PRIMARY KEY,
      name TEXT,
      slotCount INTEGER,
      slotDefinitions TEXT
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS slots_config (
      layoutTemplateId TEXT,
      slotIndex INTEGER,
      contentMode TEXT,
      strategyId TEXT,
      bgColor TEXT,
      borderColor TEXT,
      textColor TEXT,
      manualTitle TEXT,
      manualSummary TEXT,
      manualSource TEXT,
      manualUrl TEXT,
      overrideObjectId TEXT,
      PRIMARY KEY (layoutTemplateId, slotIndex)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS pipeline_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      level TEXT,
      promptVersion TEXT,
      strategyId TEXT,
      message TEXT
    )
  `);

  console.log('Tables created successfully.');

  // Seed default attributes
  const attributes = [
    { id: 'desk', name: 'Desk A', valueType: 'String' },
    { id: 'source', name: 'Source A', valueType: 'String' },
    { id: 'url', name: 'URL A', valueType: 'String' },
    { id: 'deskB', name: 'Desk B', valueType: 'String' },
    { id: 'titleB', name: 'Title B', valueType: 'String' },
    { id: 'briefB', name: 'Summary B', valueType: 'String' },
    { id: 'sourceB', name: 'Source B', valueType: 'String' },
    { id: 'urlB', name: 'URL B', valueType: 'String' },
    { id: 'offset', name: 'Offset Seconds', valueType: 'Number' },
    { id: 'aiProvider', name: 'AI Provider', valueType: 'String' },
    { id: 'isbn', name: 'ISBN', valueType: 'String' },
    { id: 'publisher', name: 'Publisher', valueType: 'String' },
    { id: 'coverImageId', name: 'Cover Image ID', valueType: 'ImageId' },
    { id: 'logoImageId', name: 'Logo Image ID', valueType: 'ImageId' },
    { id: 'websiteUrl', name: 'Website URL', valueType: 'String' },
    { id: 'eventDate', name: 'Event Date', valueType: 'Date' },
    { id: 'location', name: 'Event Location', valueType: 'String' }
  ];

  for (const attr of attributes) {
    await runQuery(`
      INSERT OR IGNORE INTO editorial_attributes (id, name, valueType)
      VALUES (?, ?, ?)
    `, [attr.id, attr.name, attr.valueType]);
  }
  console.log('Attributes seeded.');

  // Seed default AI Providers
  const providers = [
    { id: 'gemini', name: 'Google Gemini', secretName: 'GEMINI_API_KEY', model: 'gemini-2.5-flash' },
    { id: 'openai', name: 'OpenAI ChatGPT', secretName: 'OPENAI_API_KEY', model: 'gpt-4o' },
    { id: 'claude', name: 'Anthropic Claude', secretName: 'CLAUDE_API_KEY', model: 'claude-3-5-sonnet' },
    { id: 'grok', name: 'xAI Grok', secretName: 'GROK_API_KEY', model: 'grok-beta' },
    { id: 'deepseek', name: 'DeepSeek Chat', secretName: 'DEEPSEEK_API_KEY', model: 'deepseek-chat' },
    { id: 'llama', name: 'Meta Llama 3', secretName: 'LLAMA_API_KEY', model: 'llama3-8b-8192' },
    { id: 'cohere', name: 'Cohere Command', secretName: 'COHERE_API_KEY', model: 'command-r-plus' }
  ];

  for (const prov of providers) {
    await runQuery(`
      INSERT OR IGNORE INTO ai_providers (id, name, secretName, model, monthlyBudget, dailyBudget, status, enabled)
      VALUES (?, ?, ?, ?, 100.0, 10.0, 'active', 1)
    `, [prov.id, prov.name, prov.secretName, prov.model]);
  }
  console.log('AI Providers seeded.');

  // Seed default prompt templates
  await runQuery(`
    INSERT OR IGNORE INTO prompt_templates (id, name, templateText, version, updatedAt)
    VALUES ('daily_brief', 'Daily Brief Summary', 'Analyze the source text and write a clear title under 80 characters, and a summary under 250 characters matching the style of scholarly journal.', 'v1.0', ?)
  `, [new Date().toISOString()]);
  console.log('Prompt Templates seeded.');

  // Seed Layout Template for frontpage
  const slotCount = 38;
  const slotDefinitions = [];
  
  const getSlotType = (idx) => {
    if (idx === 0) return 'LEBAR PENUH';
    if ([1, 12, 15, 26, 29, 37].includes(idx)) return 'MENEGAK';
    if ([2, 6, 19, 20, 33, 34].includes(idx)) return 'MELINTANG';
    if ([3, 11, 16, 25, 30, 35, 36].includes(idx)) return 'SEGI EMPAT';
    if ([4, 5, 17, 18, 31, 32].includes(idx)) return 'KOMPAK';
    if ([7, 8, 9, 10, 21, 22, 23, 24].includes(idx)) return 'BAR';
    return 'SEPARUH';
  };

  const getAllowedTypes = (type) => {
    if (type === 'BAR') return ['Brief'];
    if (type === 'KOMPAK' || type === 'SEPARUH') return ['Brief', 'Book'];
    if (type === 'SEGI EMPAT') return ['Brief', 'Book', 'Event', 'Sponsor'];
    return ['Brief', 'Book', 'Event'];
  };

  for (let i = 0; i < slotCount; i++) {
    const type = getSlotType(i);
    slotDefinitions.push({
      slotIndex: i,
      type: type,
      allowedContentTypes: getAllowedTypes(type)
    });
  }

  await runQuery(`
    INSERT OR REPLACE INTO layout_templates (id, name, slotCount, slotDefinitions)
    VALUES ('frontpage', 'Frontpage Bento Layout', ?, ?)
  `, [slotCount, JSON.stringify(slotDefinitions)]);
  console.log('Layout Template (frontpage) seeded.');

  // Migrate existing system_settings.inTheNewsText to EAV objects
  const settingsRow = await getQuery("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
  if (settingsRow && settingsRow.inTheNewsText) {
    console.log('Found existing inTheNewsText. Migrating to Editorial Objects...');
    const parsedItems = parseInTheNews(settingsRow.inTheNewsText);
    
    for (let i = 0; i < 38; i++) {
      const parsed = parsedItems[i];
      const objectId = `object-frontpage-${i}`;
      
      const title = parsed ? parsed.title : `Slot ${i} Title Placeholder`;
      const summary = parsed ? parsed.brief : `Slot ${i} Summary Placeholder`;
      const category = parsed ? parsed.desk : `Kategori ${i}`;
      
      // Create Object
      await runQuery(`
        INSERT OR REPLACE INTO editorial_objects (id, type, categoryId, priority, createdAt)
        VALUES (?, 'Brief', ?, 'Medium', ?)
      `, [objectId, category, new Date().toISOString()]);

      // Create Revision 1.0
      await runQuery(`
        INSERT OR REPLACE INTO editorial_revisions (id, objectId, version, title, summary, status, createdBy, createdAt)
        VALUES (?, ?, 1.0, ?, ?, 'approved', 'migration', ?)
      `, [i + 1, objectId, title, summary, new Date().toISOString()]);

      // Save Attributes to editorial_attribute_values
      const attrVals = [
        { key: 'desk', val: category },
        { key: 'source', val: parsed ? parsed.source : 'Nature' },
        { key: 'url', val: parsed ? parsed.url : '#' }
      ];

      if (parsed) {
        if (parsed.deskB) attrVals.push({ key: 'deskB', val: parsed.deskB });
        if (parsed.titleB) attrVals.push({ key: 'titleB', val: parsed.titleB });
        if (parsed.briefB) attrVals.push({ key: 'briefB', val: parsed.briefB });
        if (parsed.sourceB) attrVals.push({ key: 'sourceB', val: parsed.sourceB });
        if (parsed.urlB) attrVals.push({ key: 'urlB', val: parsed.urlB });
        if (parsed.offset) attrVals.push({ key: 'offset', val: String(parsed.offset) });
        if (parsed.aiProvider) attrVals.push({ key: 'aiProvider', val: parsed.aiProvider });
      }

      for (const av of attrVals) {
        await runQuery(`
          INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText)
          VALUES (?, ?, ?, ?)
        `, [objectId, i + 1, av.key, av.val]);
      }

      // Create Slot Config linked to this Object
      await runQuery(`
        INSERT OR REPLACE INTO slots_config (
          layoutTemplateId, slotIndex, contentMode, strategyId, bgColor, borderColor, textColor, overrideObjectId
        ) VALUES ('frontpage', ?, 'Manual', '', ?, ?, ?, ?)
      `, [
        i, 
        parsed ? parsed.bgColor : 'transparent', 
        parsed ? parsed.borderColor : '', 
        parsed ? parsed.textColor : '#1F1F1F',
        objectId
      ]);
    }
    console.log('Migration of inTheNewsText to EAV objects complete!');
  } else {
    // No inTheNewsText found, just create blank Slot configs
    for (let i = 0; i < 38; i++) {
      await runQuery(`
        INSERT OR REPLACE INTO slots_config (
          layoutTemplateId, slotIndex, contentMode, strategyId, bgColor, borderColor, textColor
        ) VALUES ('frontpage', ?, 'Manual', '', 'transparent', '', '#1F1F1F')
      `, [i]);
    }
    console.log('Seeded blank Slots config.');
  }

  db.close();
  console.log('Editorial Operating System Migration Completed Successfully!');
};

migrate().catch(console.error);
