import SourceFetcher from '../sources/SourceFetcher.js';
import registry from '../sources/ProviderRegistry.js';
import SourceNormalizer from '../sources/SourceNormalizer.js';
import SourceCache from '../sources/SourceCache.js';
import SourceDiscovery from '../sources/SourceDiscovery.js';
import GeminiProvider from '../ai/GeminiProvider.js';
import ClaudeProvider from '../ai/ClaudeProvider.js';
import EditorialValidator from './EditorialValidator.js';

class EditorialPipeline {
  static async runSlotPipeline(db, slot, provider, globalPrompt, campaignPrompt, currentRunId = null) {
    const timestamp = new Date().toISOString();
    const slotIndex = slot.slotIndex;
    const outputType = (slot.allowedContentTypes || 'Brief').split(',')[0].trim();
    const strategy = slot.searchStrategy || 'Structured Sources Only';
    const slotPrompt = slot.promptText || '';

    let rawSourceText = '';
    let fetchedSuccessfully = false;
    let fromCache = false;
    let sourceHash = '';
    let aiSourceUrl = '';

    const dbGet = (query, params) => new Promise((res, rej) => db.get(query, params, (err, row) => err ? rej(err) : res(row)));
    const dbRun = (query, params) => new Promise((res, rej) => db.run(query, params, function(err) { err ? rej(err) : res(this); }));

    // 1. Resolve structured source fetching (RSS/Atom/JSON/API/HTML)
    if (strategy === 'Structured Sources Only' || strategy === 'Structured Sources -> Search Fallback') {
      if (slot.sourcesList && slot.sourcesList.trim() !== '') {
        const urls = slot.sourcesList.split(/[\s,;\n\r]+/).map(u => u.trim()).filter(u => u.startsWith('http://') || u.startsWith('https://'));
        
        let allNormalizedRecords = [];
        let combinedHashes = [];
        let firstActiveUrl = '';

        for (const url of urls) {
          try {
            const fetchResult = await SourceFetcher.fetchRaw(url);
            if (fetchResult.status === 200) {
              const transformer = registry.resolve(url, fetchResult.rawContent, fetchResult.responseHeaders);
              const records = transformer.parse(fetchResult.rawContent);
              const normalized = SourceNormalizer.normalize(records);
              if (normalized && normalized.length > 0) {
                if (!firstActiveUrl) {
                  firstActiveUrl = normalized[0].url || url;
                }
                allNormalizedRecords.push(...normalized);
                combinedHashes.push(SourceCache.calculateHash(normalized));
              }
            }
          } catch (error) {
            console.error(`Structured source fetch failed for url "${url}" in slot ${slotIndex}:`, error);
          }
        }

        if (allNormalizedRecords.length > 0) {
          sourceHash = combinedHashes.join('-');
          const isUnchanged = await SourceCache.isHashUnchanged(dbGet, slotIndex, sourceHash);

          if (isUnchanged) {
            return {
              status: 'SKIPPED_CACHE',
              message: `Skipped: Source content is unchanged (stable hash match: ${sourceHash.substring(0, 8)}).`
            };
          }

          // Serialize normalized factual records for the AI prompt
          rawSourceText = allNormalizedRecords.map(r => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}\n---`).join('\n');
          aiSourceUrl = firstActiveUrl || slot.sourcesList.split(/[\s,;\n\r]+/)[0] || '#';
          fetchedSuccessfully = true;
        } else if (strategy === 'Structured Sources Only') {
          throw new Error('Failed to fetch structured sources or no content records resolved.');
        }
      }
    }

    // 2. Resolve AI Provider instance
    const apiKey = process.env[provider.secretName] || '';
    if (!apiKey) {
      throw new Error(`API key for ${provider.name} (${provider.secretName}) was not found.`);
    }

    let aiInstance;
    if (provider.id.includes('gemini')) {
      aiInstance = new GeminiProvider(apiKey, provider.model);
    } else if (provider.id.includes('claude')) {
      aiInstance = new ClaudeProvider(apiKey, provider.model);
    } else {
      // General fallback to Gemini
      aiInstance = new GeminiProvider(apiKey, 'gemini-3.5-flash');
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

    // 3. Compile prompt based on search strategy
    let compiledPrompt = `
      Global System Context: ${globalPrompt}
      Current Campaign Focus: ${campaignPrompt}
      Master Editorial Guidelines: ${masterPrompt}
      Slot Specific Instructions: ${slotPrompt}
    `;

    let searchTools = null;
    if (strategy === 'Search Only' || (!fetchedSuccessfully && strategy === 'Structured Sources -> Search Fallback')) {
      searchTools = SourceDiscovery.getNativeSearchTools(provider.id);
      compiledPrompt += `\nLakukan carian di internet menggunakan enjin carian sekiranya perlu untuk mendapatkan fakta berita terbaharu.`;
    } else if (rawSourceText) {
      compiledPrompt += `\n\nKandungan Sumber Rujukan Faktual (Rujuk teks ini untuk menulis berita):\n${rawSourceText}`;
    }

    // Tentukan had panjang ringkasan secara dinamik berasaskan susun atur slot bento
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

    if (slot.manualDesk && slot.manualDesk.trim() !== '') {
      compiledPrompt += `\nArahan Bidang/Kategori: Kandungan yang ditulis MESTILAH berkaitan dengan bidang/kategori: "${slot.manualDesk.trim().toUpperCase()}".\n`;
    }

    const isBarSlot = [7, 8, 9, 10, 21, 22, 23, 24].includes(slotIndex);

    if (isBarSlot) {
      if (slot.eventExpiryFilter && slot.eventExpiryFilter !== '') {
        const todayStr = new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
        compiledPrompt += `\nArahan Had Tempoh Masa Acara: Acara yang dijana MESTILAH berlangsung atau tamat dalam tempoh ${slot.eventExpiryFilter.toLowerCase()} dari tarikh hari ini (${todayStr}) dan belum lagi tamat.\n`;
      }
      compiledPrompt += `
        Tulis nama acara/event ("title") dan tarikh/tempoh berlangsung ("source") berdasarkan fakta di atas.
        
        SYARAT PENTING (MANDATORY):
        1. Nama Acara ("title") mestilah ringkas, padat dan TIDAK MELEBIHI ${maxTitleLen} aksara. Cth: "Pesta Buku Selangor".
        2. Tarikh/Tempoh Acara ("source") mestilah ringkas, padat dan mewakili tarikh acara secara tepat. Cth: "19-26 Julai 26" atau "20 Jun 27".
        3. Ringkasan berita ("summary") tidak diperlukan, kosongkan sahaja ("").
        4. Gunakan bahasa Melayu yang profesional.
        5. Tentukan kategori/topik berita yang paling relevan (cth: ACARA, ILMU, SEJARAH, PORTAL) dalam satu perkataan sahaja untuk harta "category".
        6. Hasilkan respons dalam format JSON sahaja dengan struktur:
            { 
              "title": "Nama Acara", 
              "source": "Tarikh Acara",
              "category": "ACARA",
              "source_url": "https://url-sumber",
              "summary": ""
            }
      `;
    } else {
      compiledPrompt += `
        Tulis tajuk dan ringkasan kandungan bertipe "${outputType}" berdasarkan arahan dan fakta di atas.
        
        SYARAT PENTING (MANDATORY):
        1. Tajuk berita ("title") mestilah ringkas, padat dan TIDAK MELEBIHI ${maxTitleLen} aksara.
        2. Ringkasan berita ("summary") ${limitDesc}
        3. Gunakan bahasa Melayu yang profesional dan bergaya editorial.
        4. Sertakan pautan URL rujukan spesifik yang aktif untuk harta "source_url". Jika anda merujuk sumber teks di atas, gunakan URL daripada teks tersebut. Jika tiada, gunakan "#". Jangan sesekali reka pautan palsu.
        5. Tentukan kategori/topik berita yang paling relevan (cth: SUKAN, POLITIK, EKONOMI, TEKNOLOGI, KESIHATAN, DUNIA) dalam satu perkataan sahaja untuk harta "category".
        6. Hasilkan respons dalam format JSON sahaja dengan struktur:
            { 
              "title": "Tajuk", 
              "summary": "Ringkasan",
              "category": "KATEGORI_BERITA",
              "source_url": "https://url-sumber"
            }
      `;
    }

    // 4. Call AI Provider
    const aiResult = await aiInstance.generate(compiledPrompt, 'Anda adalah editor berita profesional.', searchTools);
    const { parsedJson, promptTokens, completionTokens } = aiResult;

    // 5. Validate output
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

    // 6. Save Editorial Object and attributes to Database
    const objectId = `object-${outputType.toLowerCase()}-slot${slotIndex}-${Date.now()}`;
    await dbRun(`
      INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [objectId, outputType, finalCategory, slot.priority || 'Medium', slotIndex, timestamp, timestamp]);

    const revisionResult = await dbRun(`
      INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt)
      VALUES (?, 1.0, 'ms', ?, ?, 'approved', ?, ?, ?)
    `, [objectId, finalTitle, finalSummary, `pipeline-slot-${slotIndex}`, timestamp, timestamp]);
    const revisionId = revisionResult.lastID || 1;

    // Save attributes (Cache key, source hash, category, provider information)
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

    // 7. Track AI Usage Logs
    const pricing = await dbGet("SELECT * FROM ai_model_pricing WHERE providerId = ? AND modelName = ?", [provider.id, provider.model]);
    let estimatedCost = 0;
    if (pricing) {
      estimatedCost = ((promptTokens / 1000000) * pricing.inputCostPerMillion) + ((completionTokens / 1000000) * pricing.outputCostPerMillion);
    }

    await dbRun(`
      INSERT INTO ai_usage_logs (runId, providerId, modelName, capability, promptTokens, completionTokens, totalTokens, estimatedCost, currency, latencyMs, status, createdAt)
      VALUES (?, ?, ?, 'Editorial Generation', ?, ?, ?, ?, 'USD', 0, 'SUCCESS', ?)
    `, [currentRunId, provider.id, provider.model, promptTokens, completionTokens, promptTokens + completionTokens, estimatedCost, timestamp]);

    return {
      status: 'SUCCESS',
      objectId,
      title: finalTitle,
      summary: finalSummary
    };
  }
}

export default EditorialPipeline;
