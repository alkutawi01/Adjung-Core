import SourceDiscovery from '../sources/SourceDiscovery.js';
import GeminiProvider from '../ai/GeminiProvider.js';
import ClaudeProvider from '../ai/ClaudeProvider.js';
import EditorialValidator from './EditorialValidator.js';
import CategoryRegistry from '../category/CategoryRegistry.js';

class EditorialPipeline {
  static async runSlotPipeline(db, slot, provider, globalPrompt, campaignPrompt, currentRunId = null, bypassCache = false) {
    const timestamp = new Date().toISOString();
    const slotIndex = slot.slotIndex;
    const outputType = (slot.allowedContentTypes || 'Brief').split(',')[0].trim();
    const strategy = slot.searchStrategy || 'Structured Sources Only';
    const slotPrompt = slot.promptText || '';

    const sourceHash = '';
    const aiSourceUrl = slot.sourcesList ? slot.sourcesList.split(/[\s,;\n\r]+/)[0] : '#';

    const dbGet = (query, params) => new Promise((res, rej) => db.get(query, params, (err, row) => err ? rej(err) : res(row)));
    const dbRun = (query, params) => new Promise((res, rej) => db.run(query, params, function(err) { err ? rej(err) : res(this); }));

    // 1. Resolve AI Provider instance
    const apiKey = process.env[provider.secretName] || '';
    if (!apiKey) {
      throw new Error(`API key for ${provider.name} (${provider.secretName}) was not found.`);
    }

    const modelToUse = slot.model || provider.model;
    let aiInstance;
    if (provider.id.includes('gemini')) {
      aiInstance = new GeminiProvider(apiKey, modelToUse);
    } else if (provider.id.includes('claude')) {
      aiInstance = new ClaudeProvider(apiKey, modelToUse);
    } else {
      aiInstance = new GeminiProvider(apiKey, modelToUse || 'gemini-3.5-flash');
    }

    // Fetch masterPrompt from system_settings
    let masterPrompt = '';
    try {
      const settingsRow = await dbGet("SELECT masterPrompt FROM system_settings LIMIT 1");
      if (settingsRow && settingsRow.masterPrompt) {
        masterPrompt = settingsRow.masterPrompt;
      }
    } catch (settingsErr) {
      console.warn("Failed to read masterPrompt settings:", settingsErr.message);
    }

    // 2. Determine output limits
    let minSummaryLen = 130;
    let maxSummaryLen = 180;
    let limitDesc = 'mestilah di antara 130 hingga 180 aksara untuk pengisian visual yang kemas.';
    
    if (slot.maxBrief !== null && slot.maxBrief !== undefined) {
      maxSummaryLen = slot.maxBrief;
      minSummaryLen = Math.floor(maxSummaryLen * 0.75);
      limitDesc = `mestilah di antara ${minSummaryLen} hingga ${maxSummaryLen} aksara mengikut tetapan slot.`;
    } else {
      if (slotIndex === 0) {
        minSummaryLen = 220;
        maxSummaryLen = 250;
        limitDesc = 'mestilah di antara 220 hingga 250 aksara untuk kad Hero utama.';
      } else if ([1, 12, 14, 25, 36].includes(slotIndex)) {
        minSummaryLen = 300;
        maxSummaryLen = 370;
        limitDesc = 'mestilah di antara 300 hingga 370 aksara (tulis panjang dan penuh, sekurang-kurangnya 4-5 baris) untuk mengisi ruang kad menegak bento secara padat.';
      } else if ([4, 5, 31, 32].includes(slotIndex)) {
        minSummaryLen = 60;
        maxSummaryLen = 80;
        limitDesc = 'mestilah di antara 60 hingga 80 aksara untuk kad bento kompak.';
      }
    }

    let maxTitleLen = 115;
    if (slot.maxTitle !== null && slot.maxTitle !== undefined) {
      maxTitleLen = slot.maxTitle;
    } else {
      if ([7, 8, 9, 10, 21, 22, 23, 24].includes(slotIndex)) {
        maxTitleLen = 40;
      }
    }

    const isBarSlot = [7, 8, 9, 10, 21, 22, 23, 24].includes(slotIndex);

    // 3. Static System Prompt (Identity)
    const staticSystemPrompt = `You are Adjung AI.
You are the editorial generation engine of the Adjung publishing platform.

Your responsibilities:
- Follow editorial instructions
- Follow output schema
- Produce valid JSON only
- Never fabricate facts
- Never copy copyrighted articles verbatim
- Rewrite information professionally
- If the selected provider supports web search or grounding, use it when necessary
- Do not output explanations`;

    // 4. UI-configured User Prompt (Editorial Configuration & Instructions)
    let userPrompt = `Editorial Rules

Language:
Malay

Writing Style:
Professional Journalism

Search Strategy:
${strategy}
`;

    if (slot.sourcesList && slot.sourcesList.trim() !== '') {
      userPrompt += `
Sources to read/consult:
${slot.sourcesList.trim()}
`;
    }

    userPrompt += `
Global System Context:
${globalPrompt}

Current Campaign Focus:
${campaignPrompt}
`;

    if (masterPrompt) {
      userPrompt += `
Master Editorial Guidelines:
${masterPrompt}
`;
    }

    if (slot.manualDesk && slot.manualDesk.trim() !== '') {
      userPrompt += `
Arahan Bidang/Kategori: Kandungan yang ditulis MESTILAH berkaitan dengan bidang/kategori: "${slot.manualDesk.trim().toUpperCase()}".
`;
    }

    if (slot.eventExpiryFilter && slot.eventExpiryFilter !== '') {
      const todayStr = new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
      userPrompt += `
Arahan Had Tempoh Masa Acara: Acara yang dijana MESTILAH berlangsung atau tamat dalam tempoh ${slot.eventExpiryFilter.toLowerCase()} dari tarikh hari ini (${todayStr}) dan belum lagi tamat.
`;
    }

    userPrompt += `
Task:
${slotPrompt}
`;

    if (slotIndex === -1) {
      userPrompt += `
Tulis tepat ${slot.generationLimit || 5} baris kandungan berita terkini bertipe Ticker untuk dipaparkan di segmen "Terkini di Malaysia".

Output MESTILAH dihasilkan dalam format JSON sahaja dengan struktur objek:
{
  "items": [
    {
      "desk": "KATEGORI_BERITA (Satu perkataan sahaja, cth: EKONOMI, KESIHATAN, SUKAN)",
      "title": "Tajuk berita terkini Malaysia di bawah ${maxTitleLen} aksara",
      "brief": "Huraian pendek tepat satu ayat di bawah ${maxSummaryLen} aksara.",
      "source": "Nama Sumber Berita",
      "url": "Pautan URL artikel khusus dan spesifik yang lengkap dan sah (citation link)"
    }
  ]
}
Nothing more.`;
    } else if (isBarSlot) {
      userPrompt += `
Output MESTILAH dihasilkan dalam format JSON sahaja dengan struktur objek:
{ 
  "title": "Nama Acara (Tidak melebihi ${maxTitleLen} aksara)", 
  "source": "Tarikh/Tempoh Acara secara ringkas dan padat",
  "category": "Kategori/Topik berita yang paling relevan (Satu perkataan sahaja, cth: ACARA, ILMU, SEJARAH, PORTAL)",
  "source_url": "Pautan URL rujukan spesifik yang aktif",
  "summary": ""
}
Nothing more.`;
    } else {
      userPrompt += `
Output MESTILAH dihasilkan dalam format JSON sahaja dengan struktur objek:
{ 
  "title": "Tajuk berita (Tidak melebihi ${maxTitleLen} aksara)", 
  "summary": "Ringkasan berita (${limitDesc})",
  "category": "Kategori berita (Satu perkataan sahaja, cth: SUKAN, POLITIK, EKONOMI, TEKNOLOGI, KESIHATAN, DUNIA)",
  "source_url": "Pautan URL rujukan spesifik yang aktif"
}
Nothing more.`;
    }

    // 5. Native Search Grounding Tools (AI Provider will discover reality natively)
    const searchTools = SourceDiscovery.getNativeSearchTools(provider.id);

    // 6. Call AI Provider
    const aiResult = await aiInstance.generate(userPrompt, staticSystemPrompt, searchTools);
    const { parsedJson, promptTokens, completionTokens } = aiResult;

    // 7. Validate output
    if (slotIndex === -1) {
      const items = parsedJson.items || [];
      const textItems = items.map(item => {
        const desk = (item.desk || 'UMUM').trim().toUpperCase();
        const title = (item.title || '').trim().slice(0, maxTitleLen);
        const brief = (item.brief || '').trim().slice(0, maxSummaryLen);
        const source = (item.source || provider.name).trim();
        const url = (item.url || '#').trim();
        return `Desk: ${desk}\nTitle: ${title}\nBrief: ${brief}\nSource: ${source}\nUrl: ${url}`;
      });
      const formattedText = textItems.join('\n---\n');

      await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [formattedText]);

      // Track AI Usage Logs for Ticker
      const pricing = await dbGet("SELECT * FROM ai_model_pricing WHERE providerId = ? AND modelName = ?", [provider.id, modelToUse]);
      let estimatedCost = 0;
      if (pricing) {
        estimatedCost = ((promptTokens / 1000000) * pricing.inputCostPerMillion) + ((completionTokens / 1000000) * pricing.outputCostPerMillion);
      }

      await dbRun(`
        INSERT INTO ai_usage_logs (runId, providerId, modelName, capability, promptTokens, completionTokens, totalTokens, estimatedCost, currency, latencyMs, status, createdAt, promptText, responseText)
        VALUES (?, ?, ?, 'Editorial Generation', ?, ?, ?, ?, 'USD', 0, 'SUCCESS', ?, ?, ?)
      `, [currentRunId, provider.id, modelToUse, promptTokens, completionTokens, promptTokens + completionTokens, estimatedCost, timestamp, userPrompt, aiResult.text]);

      return {
        status: 'SUCCESS',
        objectId: 'ticker-updated',
        title: 'Terkini di Malaysia',
        summary: 'Updated successfully via AI'
      };
    }

    let validation = { isValid: true, cleanTitle: parsedJson.title || '', cleanSummary: parsedJson.summary || '' };
    if (!isBarSlot) {
      validation = EditorialValidator.validate(parsedJson.title, parsedJson.summary, maxSummaryLen);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.reason}`);
      }
    }

    const finalTitle = validation.cleanTitle;
    const finalSummary = validation.cleanSummary;
    const finalCategory = (slot.manualDesk && slot.manualDesk.trim() !== '') 
      ? slot.manualDesk.trim().toUpperCase() 
      : (parsedJson.category ? parsedJson.category.trim().toUpperCase() : 'UMUM');
    const finalSourceUrl = parsedJson.source_url || aiSourceUrl || '#';
    const finalSource = isBarSlot ? (parsedJson.source || parsedJson.date || '19 Jul 2026') : provider.name;

    // 8. Save Editorial Object and attributes to Database
    const objectId = `object-${outputType.toLowerCase()}-slot${slotIndex}-${Date.now()}`;
    try {
      await CategoryRegistry.incrementCategoryUsage(db, finalCategory);
    } catch (e) {
      console.warn("Failed to register category:", e.message);
    }
    await dbRun(`
      INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [objectId, outputType, finalCategory, slot.priority || 'Medium', slotIndex, timestamp, timestamp]);

    const revisionResult = await dbRun(`
      INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
      VALUES (?, 1.0, 'ms', ?, ?, 'approved', ?, ?, ?)
    `, [objectId, finalTitle, finalSummary, `pipeline-slot-${slotIndex}`, timestamp, timestamp]);
    const revisionId = revisionResult.lastID || 1;

    // Save attributes (desk, source, url, provider information)
    const attributesToSave = [
      { key: 'sourceHash', val: sourceHash },
      { key: 'desk', val: finalCategory },
      { key: 'source', val: finalSource },
      { key: 'url', val: finalSourceUrl },
      { key: 'aiProvider', val: provider.name }
    ];

    for (const attr of attributesToSave) {
      await dbRun(`
        INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText)
        VALUES (?, ?, ?, ?)
      `, [objectId, revisionId, attr.key, attr.val]);
    }

    // 9. Track AI Usage Logs
    const pricing = await dbGet("SELECT * FROM ai_model_pricing WHERE providerId = ? AND modelName = ?", [provider.id, modelToUse]);
    let estimatedCost = 0;
    if (pricing) {
      estimatedCost = ((promptTokens / 1000000) * pricing.inputCostPerMillion) + ((completionTokens / 1000000) * pricing.outputCostPerMillion);
    }

    await dbRun(`
      INSERT INTO ai_usage_logs (runId, providerId, modelName, capability, promptTokens, completionTokens, totalTokens, estimatedCost, currency, latencyMs, status, createdAt, promptText, responseText)
      VALUES (?, ?, ?, 'Editorial Generation', ?, ?, ?, ?, 'USD', 0, 'SUCCESS', ?, ?, ?)
    `, [currentRunId, provider.id, modelToUse, promptTokens, completionTokens, promptTokens + completionTokens, estimatedCost, timestamp, userPrompt, aiResult.text]);

    return {
      status: 'SUCCESS',
      objectId,
      title: finalTitle,
      summary: finalSummary
    };
  }
}

export default EditorialPipeline;
