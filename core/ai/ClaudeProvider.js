import AIProvider from './AIProvider.js';
import { parseAiJsonResponse } from './jsonExtract.js';

class ClaudeProvider extends AIProvider {
  async generate(promptText, systemInstructions = '', searchTools = null) {
    if (!this.apiKey) {
      throw new Error('Claude API key is not set.');
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.modelName || 'claude-3-5-sonnet-latest',
        // Naik drpd 1000 -> 8192 (2026-09-09, dapatan bug-hunt #151, susulan #150). Editor boleh
        // tetapkan [Jumlah kandungan] > 1 (SlotManagerModal.tsx, tiada had maksimum) — satu
        // panggilan generate() kena hasilkan BEBERAPA kandungan penuh (title+brief+briefLong
        // sehingga 600 aksara setiap satu, MAX_BRIEF_LONG_CHARS di GeometryConfig.js) serentak
        // dalam SATU respons JSON. 1000 token cukup untuk SATU kandungan sahaja — GeminiProvider.js
        // (baris setanding) TIADA had output token langsung (SDK guna had model, ~8192+), jadi
        // slot [Jumlah kandungan] yg sama bendera Gemini boleh siap penuh tapi Claude terpotong
        // separuh JSON (parseAiJsonResponse gagal senyap ke rentetan mentah) — bukan had API
        // Claude sendiri (model ni sokong sehingga 8192 output token), cuma nombor sembarang
        // ditinggalkan sejak awal. Diselaraskan supaya kedua-dua penyedia sama keupayaan untuk
        // input yang SAMA, bukan sekadar naikkan sewenang-wenangnya.
        max_tokens: 8192,
        system: systemInstructions || undefined,
        messages: [{ role: 'user', content: promptText + '\nSila jawab dalam format JSON sahaja.' }]
      })
    });

    if (!res.ok) {
      throw new Error(`Claude API returned status ${res.status}`);
    }

    const data = await res.json();
    const text = data.content[0].text.trim();
    // Bersih/pulih sebelum parse (2026-09-09, dapatan bug-hunt) — dahulu terus `JSON.parse(text)`
    // MENTAH, sedangkan Claude kerap balut jawapan dlm pagar markdown ```json walau arahan sistem
    // eksplisit larang. Lihat nota penuh jsonExtract.js — laluan sama yg sudah dipakai Gemini.
    const parsedJson = parseAiJsonResponse(text);

    const promptTokens = data.usage?.input_tokens || 0;
    const completionTokens = data.usage?.output_tokens || 0;

    return {
      text,
      parsedJson,
      promptTokens,
      completionTokens,
      // Claude has no live web-search/grounding tool wired up here, so it has no way to verify
      // any URL it writes — every source_url from Claude is generated from training data alone.
      groundingUrls: []
    };
  }
}

export default ClaudeProvider;
