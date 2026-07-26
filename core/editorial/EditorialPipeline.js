import SourceDiscovery from '../sources/SourceDiscovery.js';
import SourceFetcher from '../sources/SourceFetcher.js';
import SourceNormalizer from '../sources/SourceNormalizer.js';
import SourceCache from '../sources/SourceCache.js';
import registry from '../sources/ProviderRegistry.js';
import GeminiProvider from '../ai/GeminiProvider.js';
import ClaudeProvider from '../ai/ClaudeProvider.js';
import EditorialValidator from './EditorialValidator.js';
import CategoryRegistry from '../category/CategoryRegistry.js';
import { validateContentBudget, validateBidangTopik } from './ContentBudget.js';
import { TIER_SLOTS } from './GeometryConfig.js';

const CONTENT_POOL_MAX_ITEMS = 30; // Bound prompt token cost regardless of how many sources are configured.
const CONTENT_POOL_MAX_CONTENT_CHARS = 400; // Per-item content cap — enough for editorial judgment, not full article reprint.
const RECENCY_WINDOW_HOURS = 24;

// Fetch + parse + normalize every URL in a slot's sourcesList into a bounded, deduplicated
// Content Pool (real fetched text, not AI-guessed). This replaces handing Gemini raw URLs and
// trusting its own web search/browsing to "figure it out" — the AI never crawls, it only judges
// pre-fetched material. Items with a parseable publishedAt older than 24h are dropped; items with
// no parseable date are kept (many feeds/pages don't expose one reliably) but still count toward
// the item cap. Returns both the trimmed pool and a stable hash for cache-skip change detection.
async function buildContentPool(sourcesListRaw) {
  if (!sourcesListRaw || !sourcesListRaw.trim()) {
    return { pool: [], sourceHash: '' };
  }

  const urls = sourcesListRaw.split(/[\s,;\n\r]+/).map(u => u.trim()).filter(Boolean);
  const allRecords = [];

  for (const url of urls) {
    try {
      const { rawContent, responseHeaders, status } = await SourceFetcher.fetchRaw(url);
      if (status !== 200 || !rawContent) continue;
      const transformer = registry.resolve(url, rawContent, responseHeaders);
      const records = transformer.parse(rawContent);
      // StaticHtmlTransformer (and any other single-page transformer) doesn't know its own source
      // URL — parse() only receives raw content — so it can't set a real id/url per record. Backfill
      // both from the URL we actually fetched, otherwise every homepage-style source collapses to
      // the same generic id ('html-static') and gets deduplicated down to just one surviving source.
      for (const r of records) {
        if (!r.url) r.url = url;
        if (!r.id || r.id === 'html-static') r.id = url;
      }
      allRecords.push(...records);
    } catch (e) {
      console.warn(`Content pool fetch failed for ${url}:`, e.message);
    }
  }

  const normalized = SourceNormalizer.normalize(allRecords);

  const now = Date.now();
  const seenUrls = new Set();
  const recent = [];
  for (const record of normalized) {
    const dedupeKey = record.url || record.id;
    if (dedupeKey && seenUrls.has(dedupeKey)) continue;
    if (dedupeKey) seenUrls.add(dedupeKey);

    if (record.publishedAt) {
      const parsed = Date.parse(record.publishedAt);
      if (!isNaN(parsed) && (now - parsed) > RECENCY_WINDOW_HOURS * 60 * 60 * 1000) {
        continue; // Older than the recency window and we CAN verify it — drop.
      }
    }
    recent.push(record);
    if (recent.length >= CONTENT_POOL_MAX_ITEMS) break;
  }

  const pool = recent.map(r => ({ ...r, content: r.content.slice(0, CONTENT_POOL_MAX_CONTENT_CHARS) }));
  const sourceHash = SourceCache.calculateHash(pool);

  return { pool, sourceHash };
}

// Safety net against dead/hallucinated links for ANY provider (not just Gemini): confirm the
// candidate URL actually resolves before publishing it. Doesn't catch "real URL, wrong content" —
// only "URL doesn't exist at all" — but costs nothing when combined with real grounding citations.
async function verifyUrlReachable(url) {
  if (!url || url === '#' || !url.startsWith('http')) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (res.status === 405 || res.status === 403) {
      // Some sites reject HEAD requests specifically; retry with GET before giving up.
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }
    return res.ok;
  } catch (e) {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

class EditorialPipeline {
  static async runSlotPipeline(db, slot, provider, globalPrompt, campaignPrompt, currentRunId = null, bypassCache = false) {
    const timestamp = new Date().toISOString();
    const slotIndex = slot.slotIndex;
    const outputType = (slot.allowedContentTypes || 'Brief').split(',')[0].trim();
    const strategy = slot.searchStrategy || 'Structured Sources Only';
    const slotPrompt = slot.promptText || '';

    const aiSourceUrl = slot.sourcesList ? slot.sourcesList.split(/[\s,;\n\r]+/)[0] : '#';

    const dbGet = (query, params) => new Promise((res, rej) => db.get(query, params, (err, row) => err ? rej(err) : res(row)));
    const dbRun = (query, params) => new Promise((res, rej) => db.run(query, params, function(err) { err ? rej(err) : res(this); }));

    // 0. Content Pool: fetch + parse + normalize real source material BEFORE calling any AI, for
    // strategies that use structured sources. This is what makes Gemini an editor, not a crawler —
    // and it's also the main cost saver: if the fetched pool is byte-identical to last run's pool
    // (same hash), skip the AI call entirely rather than pay for a regeneration of unchanged news.
    let contentPool = [];
    let sourceHash = '';
    const usesStructuredSources = strategy === 'Structured Sources Only' || strategy === 'Structured Sources -> Search Fallback';
    if (usesStructuredSources && slot.sourcesList && slot.sourcesList.trim() !== '') {
      const built = await buildContentPool(slot.sourcesList);
      contentPool = built.pool;
      sourceHash = built.sourceHash;
      console.log(`[Content Pool] Slot ${slotIndex}: ${contentPool.length} item(s) fetched, ${contentPool.filter(i => i.url).length} with a URL, hash ${sourceHash ? sourceHash.slice(0, 8) : '(empty)'}`);

      if (!bypassCache && sourceHash && await SourceCache.isHashUnchanged(dbGet, slotIndex, sourceHash)) {
        return {
          status: 'SKIPPED_CACHE',
          message: `Skipped: source pool unchanged since last run (${contentPool.length} item(s), hash ${sourceHash.slice(0, 8)}) — no AI call made.`
        };
      }
    }

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
      } else if (TIER_SLOTS.MENEGAK.includes(slotIndex)) {
        // Was literally [1, 12, 14, 25, 36] — 14/25/36 aren't MENEGAK slots at all (they're
        // SEGI_EMPAT_MEDIUM/SMALL, with a much smaller real budget), and the real MENEGAK slots
        // 15/26/29/37 were missing from the array entirely, so they never got this target.
        minSummaryLen = 300;
        maxSummaryLen = 370;
        limitDesc = 'mestilah di antara 300 hingga 370 aksara (tulis panjang dan penuh, sekurang-kurangnya 4-5 baris) untuk mengisi ruang kad menegak bento secara padat.';
      } else if (TIER_SLOTS.KOMPAK.includes(slotIndex)) {
        minSummaryLen = 18;
        maxSummaryLen = 25;
        limitDesc = 'mestilah di antara 18 hingga 25 aksara sahaja (satu ayat pendek) untuk kad bento kompak.';
      }
    }

    let maxTitleLen = 115;
    if (slot.maxTitle !== null && slot.maxTitle !== undefined) {
      maxTitleLen = slot.maxTitle;
    } else {
      if (TIER_SLOTS.BAR.includes(slotIndex)) {
        maxTitleLen = 40;
      } else if (TIER_SLOTS.KOMPAK.includes(slotIndex)) {
        maxTitleLen = 55;
      }
    }

    const isBarSlot = TIER_SLOTS.BAR.includes(slotIndex);

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

    if (contentPool.length > 0) {
      const poolText = contentPool.map((item, i) =>
        `[${i + 1}] Title: ${item.title}\nURL: ${item.url}\nPublished: ${item.publishedAt || 'unknown'}\nContent: ${item.content}`
      ).join('\n---\n');
      userPrompt += `
Kandungan Sumber Rujukan Faktual (fetched terus dari sumber, BUKAN carian anda — gunakan HANYA
maklumat ini untuk fakta dan URL rujukan, jangan cari/reka fakta lain):
${poolText}
`;
    } else if (slot.sourcesList && slot.sourcesList.trim() !== '' && !usesStructuredSources) {
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
Arahan Bidang: Kandungan yang ditulis MESTILAH berkaitan dengan bidang: "${slot.manualDesk.trim().toUpperCase()}".
`;
      // Topik (sub-fokus dalam Bidang di atas) hanya terpakai untuk kad "Standard" (bukan Ticker,
      // bukan BAR — dua-dua dikecualikan ciri Bidang/Topik). Diminta di sini, di bawah Bidang yang
      // sudah diwajibkan, supaya Topik yang dijana kekal koheren dengan Bidang tersebut.
      if (slotIndex !== -1 && !isBarSlot) {
        userPrompt += `
Arahan Topik: Sertakan juga 'topik' — fokus khusus kandungan ni DALAM bidang "${slot.manualDesk.trim().toUpperCase()}" yang diwajibkan di atas (cth: dalam bidang Ekonomi — Kewangan, Perbankan).
`;
      }
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

    // When a Content Pool exists, NEVER ask the AI to transcribe a URL as free text — that step is
    // exactly where it silently drops/skips links (observed: only ~1 in 10 items correctly copied
    // through in testing). Instead ask for "sourceIndex", the [N] number of the pool item it based
    // the item on — a single integer is far less likely to be dropped than a full URL string — and
    // let the CODE below deterministically look up the real, already-fetched URL from that index.
    // AI-transcribed "url"/"source_url" stays as a fallback field only for when there's no pool
    // (e.g. Search Only strategy) and grounding/self-report is genuinely the only option.
    const sourceIndexInstruction = contentPool.length > 0
      ? `\n      "sourceIndex": <WAJIB — nombor [N] rujukan sumber di atas yang paling berkaitan dengan item ini (integer, cth 3)>`
      : '';

    if (slotIndex === -1) {
      userPrompt += `
Tulis tepat ${slot.generationLimit || 5} baris kandungan terkini bertipe Ticker untuk dipaparkan di segmen "Terkini di Malaysia".

Output MESTILAH dihasilkan dalam format JSON sahaja dengan struktur objek:
{
  "items": [
    {
      "desk": "KATEGORI_KANDUNGAN (Satu perkataan sahaja, cth: EKONOMI, KESIHATAN, SUKAN)",
      "title": "Tajuk kandungan terkini Malaysia di bawah ${maxTitleLen} aksara",
      "brief": "Huraian pendek tepat satu ayat di bawah ${maxSummaryLen} aksara.",
      "source": "Nama Sumber",
      "url": "Pautan URL artikel khusus dan spesifik yang lengkap dan sah (citation link) — HANYA jika tiada sourceIndex"${sourceIndexInstruction}
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
  "category": "Kategori/Topik kandungan yang paling relevan (Satu perkataan sahaja, cth: ACARA, ILMU, SEJARAH, PORTAL)",
  "source_url": "Pautan URL rujukan spesifik yang aktif — HANYA jika tiada sourceIndex",
  "summary": ""${sourceIndexInstruction}
}
Nothing more.`;
    } else {
      userPrompt += `
Output MESTILAH dihasilkan dalam format JSON sahaja dengan struktur objek:
{
  "title": "Tajuk kandungan (Tidak melebihi ${maxTitleLen} aksara)",
  "summary": "Ringkasan kandungan (${limitDesc})",
  "category": "Kategori kandungan (Satu perkataan sahaja, cth: SUKAN, POLITIK, EKONOMI, TEKNOLOGI, KESIHATAN, DUNIA)",
  "topik": "WAJIB — subbidang/fokus khusus kandungan ni (bebas teks, cth: Kewangan, Perbankan)",
  "source_url": "Pautan URL rujukan spesifik yang aktif — HANYA jika tiada sourceIndex"${sourceIndexInstruction}
}
Nothing more.`;
    }

    // 5. Native Search Grounding Tools — ONLY when the slot actually wants AI to search live.
    // "Structured Sources Only" must NEVER trigger a live search: that's the whole point of the
    // strategy (bounded, predictable, cheap — no grounding token overhead). Grounding roughly
    // doubles-to-quintuples prompt token usage (observed ~600 tokens ungrounded vs ~3500-4000
    // grounded for the same prompt), so skipping it whenever real fetched content already exists
    // is the single biggest cost lever here, on top of the cache-skip above.
    const needsLiveSearch = strategy === 'Search Only' ||
      (strategy === 'Structured Sources -> Search Fallback' && contentPool.length === 0);
    const searchTools = needsLiveSearch ? SourceDiscovery.getNativeSearchTools(provider.id) : [];

    if (strategy === 'Structured Sources -> Search Fallback' && contentPool.length === 0 && slot.sourcesList) {
      // Pool fetch yielded nothing (dead feed, unreachable, etc.) — fall back to giving the AI the
      // raw source URLs as a hint for its live search, same as a "Search Only" slot would get.
      userPrompt += `
Sources to read/consult (structured fetch failed, cari secara langsung):
${slot.sourcesList.trim()}
`;
    }

    // 6. Call AI Provider (with Fallback Failover)
    let aiResult;
    try {
      aiResult = await aiInstance.generate(userPrompt, staticSystemPrompt, searchTools);
    } catch (primaryErr) {
      console.warn(`[AI Failover] Primary provider (${provider.name}) failed for Slot ${slotIndex}: ${primaryErr.message}. Attempting failover...`);

      let fallbackInstance = null;
      const claudeKey = process.env.CLAUDE_API_KEY || '';
      const geminiKey = process.env.GEMINI_API_KEY || '';

      if (!provider.id.includes('claude') && claudeKey) {
        fallbackInstance = new ClaudeProvider(claudeKey, 'claude-3-5-sonnet-latest');
      } else if (!provider.id.includes('gemini') && geminiKey) {
        fallbackInstance = new GeminiProvider(geminiKey, 'gemini-3.5-flash');
      }

      if (fallbackInstance) {
        try {
          console.log(`[AI Failover] Executing fallback AI provider for Slot ${slotIndex}...`);
          aiResult = await fallbackInstance.generate(userPrompt, staticSystemPrompt, searchTools);
        } catch (fallbackErr) {
          throw new Error(`Primary provider (${provider.name}: ${primaryErr.message}) and fallback provider (${fallbackErr.message}) both failed.`);
        }
      } else {
        throw primaryErr;
      }
    }
    const { parsedJson, promptTokens, completionTokens, groundingUrls = [] } = aiResult;

    // 7. Validate output
    if (slotIndex === -1) {
      const items = parsedJson.items || [];
      const textItems = (await Promise.all(items.map(async (item, idx) => {
        const desk = (item.desk || 'UMUM').trim().toUpperCase();
        const title = (item.title || '').trim();
        const brief = (item.brief || '').trim();

        // Same hard-block as every other tier — Ticker is not an exception. Previously this
        // silently `.slice()`d oversized text to fit instead of enforcing the budget, which meant
        // an AI-generated ticker item could never actually fail validation the way every other
        // tier's content can. Here we skip (not truncate) an item that doesn't fit, so the ticker
        // never carries mangled/cut-off text.
        const budgetCheck = validateContentBudget(-1, title, brief);
        if (!budgetCheck.isValid) {
          console.warn(`[Ticker] Skipped AI-generated item (budget violation): ${budgetCheck.reason}`);
          return null;
        }

        // 1st choice: deterministic lookup via sourceIndex — the AI only had to pick a NUMBER,
        // not transcribe a URL string, so this is far more reliable (code does the URL lookup,
        // not the model). 2nd choice: cycle real grounding URLs (Search Only, no pool). 3rd: the
        // model's own free-text claim, verified reachable before use. Never publish an unverified
        // AI-written URL.
        const poolItem = contentPool[(item.sourceIndex | 0) - 1];
        let url, source;
        if (poolItem) {
          url = poolItem.url || '#';
          source = (item.source || provider.name).trim();
        } else {
          source = (item.source || provider.name).trim();
          const claimedUrl = (groundingUrls.length > 0 ? groundingUrls[idx % groundingUrls.length] : (item.url || '#')).trim();
          url = (await verifyUrlReachable(claimedUrl)) ? claimedUrl : '#';
        }
        try {
          await CategoryRegistry.incrementCategoryUsage(db, desk);
        } catch (e) {
          console.warn("Failed to register ticker category:", e.message);
        }
        return `Desk: ${desk}\nTitle: ${title}\nBrief: ${brief}\nSource: ${source}\nUrl: ${url}\nMode: AI Generated`;
      }))).filter(Boolean);
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

    // BAR-tier content has no brief by design (GEOMETRY_RATIOS.BAR.maxBriefAlone === 0), so
    // EditorialValidator.validate — which requires a non-empty summary — doesn't apply to it.
    let validation = { isValid: true, cleanTitle: (parsedJson.title || '').trim(), cleanSummary: (parsedJson.summary || '').trim() };
    if (!isBarSlot) {
      validation = EditorialValidator.validate(parsedJson.title, parsedJson.summary);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.reason}`);
      }
    }
    // Same budget rule as every other content path: every slot of this tier — BAR included — is
    // held to the exact same title+brief space budget (core/editorial/ContentBudget.js), regardless
    // of how the content was produced.
    const budgetCheck = validateContentBudget(slotIndex, validation.cleanTitle, validation.cleanSummary);
    if (!budgetCheck.isValid) {
      throw new Error(`Validation failed: ${budgetCheck.reason}`);
    }

    const finalTitle = validation.cleanTitle;
    const finalSummary = validation.cleanSummary;
    const finalCategory = (slot.manualDesk && slot.manualDesk.trim() !== '')
      ? slot.manualDesk.trim().toUpperCase()
      : (parsedJson.category ? parsedJson.category.trim().toUpperCase() : 'UMUM');
    const finalTopik = parsedJson.topik ? parsedJson.topik.trim() : '';

    // Bidang terkunci per-slot (finalCategory already reflects the manualDesk override above),
    // Topik wajib — kecuali slot BAR (dikecualikan ciri Bidang/Topik sepenuhnya). If the AI failed
    // to include a topik, treat the generation as failed, same as a budget-check failure above --
    // don't silently save content missing the now-mandatory field.
    if (!isBarSlot) {
      const bidangTopikCheck = validateBidangTopik({
        slotBidang: slot.manualDesk,
        itemBidang: finalCategory,
        topik: finalTopik,
        requireTopik: true,
      });
      if (!bidangTopikCheck.isValid) {
        throw new Error(`Validation failed: ${bidangTopikCheck.reason}`);
      }
    }
    // 1st choice: deterministic sourceIndex lookup into the already-fetched Content Pool — the
    // model only had to pick a number, so this can't be dropped/mistranscribed like a URL string
    // can. 2nd: real grounding citation. 3rd: the model's own free-text claim, verified reachable.
    const poolItemForUrl = contentPool[(parsedJson.sourceIndex | 0) - 1];
    let finalSourceUrl;
    if (poolItemForUrl) {
      finalSourceUrl = poolItemForUrl.url || '#';
    } else {
      const claimedUrl = groundingUrls[0] || parsedJson.source_url || aiSourceUrl || '#';
      finalSourceUrl = await verifyUrlReachable(claimedUrl) ? claimedUrl : '#';
    }
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
      { key: 'aiProvider', val: provider.name },
      // Topik: kosong untuk slot BAR (tak terpakai di sana).
      { key: 'topik', val: finalTopik }
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
