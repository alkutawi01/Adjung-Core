// Sumber tunggal untuk bersihkan + parse respons JSON drpd model AI (2026-09-09, dapatan
// bug-hunt) — dahulu logik ni HANYA wujud dalam GeminiProvider.js (strip pagar markdown
// ```json, footnote sitasi carian [1]/[1.1], koma berlebihan sebelum penutup, dan pemulihan
// sokongan-berimbang kalau ada sampah selepas struktur JSON sah). ClaudeProvider.js terus
// `JSON.parse(text)` MENTAH tanpa langkah ni langsung — model Claude kerap membalut jawapan
// JSON dalam pagar ```json walau arahan sistem eksplisit "Do not output explanations" /
// "Produce valid JSON only" (EditorialPipeline.js staticSystemPrompt), jadi setiap kali ia
// buat tu, generation GAGAL sepenuhnya (dilontar ke failover/ralat) sedangkan Gemini terus
// jalan lancar bagi tingkah laku SAMA. Dua provider dalam SATU pipeline patut dilayan sama
// rata (falsafah "kad sejenis dilayan sama rata" CLAUDE.md, terpakai jua pada provider AI) —
// diekstrak ke modul kongsi supaya kedua-dua provider guna laluan pembersihan+pemulihan yang
// SAMA PERSIS, bukan Gemini sahaja yang tahan pagar markdown/sampah lepas JSON.

// Gemini/Claude kadangkala tambah sampah selepas struktur JSON sah (observed: pendua penutup
// "]}" tercalit lepas struktur sebenar dah tutup). Imbas dari { atau [ pertama, jejak
// kedalaman kurungan untuk cari tepat di mana struktur PERTAMA seimbang balik ke sifar, dan
// parse hanya substring tu — abaikan apa sahaja sampah lepas tu.
export function extractBalancedJson(text) {
  const start = text.search(/[{[]/);
  if (start === -1) return null;

  const openChar = text[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

// Bersih + parse teks respons mentah drpd mana-mana provider AI jadi JSON. Melontar ralat
// bermaklumat (teks bersih + teks asal) kalau kedua-dua percubaan (terus, dan ekstrak
// sokongan-berimbang) gagal — corak sama seperti ralat asal GeminiProvider.js supaya mesej
// log/ralat pemanggil (EditorialPipeline.js) kekal konsisten tak kira provider mana gagal.
export function parseAiJsonResponse(rawText) {
  const text = rawText.trim();
  let cleanText = text;

  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.substring(7);
  }
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.slice(0, -3);
  }
  cleanText = cleanText.trim();

  // Buang footnote sitasi carian macam [1], [1.1], [1.1.2], dll.
  cleanText = cleanText.replace(/\[\d+(?:\.\d+)*\]/g, '');

  // Buang koma berlebihan sebelum kurungan/kurungan-siku penutup.
  cleanText = cleanText.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(cleanText);
  } catch (firstErr) {
    const balanced = extractBalancedJson(cleanText);
    if (!balanced) {
      throw new Error(`Failed to parse AI response as JSON: ${cleanText} (Original: ${text})`);
    }
    try {
      const parsed = JSON.parse(balanced);
      console.warn('[AI JSON] Response had trailing garbage after valid JSON — recovered via balanced-bracket extraction.');
      return parsed;
    } catch (secondErr) {
      throw new Error(`Failed to parse AI response as JSON: ${cleanText} (Original: ${text})`);
    }
  }
}
