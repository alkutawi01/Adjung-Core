// Buang sintaks markdown (2026-09-08, dapatan bug-hunt) — Ctrl/Cmd+I (SlotManagerModal.tsx)
// benarkan editor tanda *condong*/glosari `[label](gloss:id)` terus dalam medan Tajuk/Huraian,
// dan parser pembaca sebenar (safeParseInline, src/utils.tsx) tukar sintaks tu jadi <em>/pautan
// untuk paparan skrin SAHAJA. Mana-mana laluan LAIN yang hantar teks ni keluar (bukan render
// skrin — RSS, meta SEO, HTML pra-terap bot) mesti buang sintaks ni dahulu, jika tidak sintaks
// mentah (asterisk, `[label](gloss:...)`) bocor terus kepada pembaca/crawler luar.
//
// Salinan ringkas stripMarkdown() (src/utils.tsx) — fail-fail Node ESM tulen (rssFeedRoutes.js,
// articleUrlRoutes.js) tak boleh import terus modul TSX tu (bawa React/JSX sebagai kebergantungan
// transitif). Diekstrak ke SINI (2026-09-08) selepas bug SAMA ditemui KALI KEDUA (RSS feed
// dahulu, kini binaHtmlBot() bot-facing HTML di articleUrlRoutes.js) — satu salinan kongsi
// mengelak salinan KETIGA yang boleh menyimpang pada masa depan.
export const stripMarkdownEsm = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/(\*\*\*|___)(.*?)\1/g, '$2')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\+\+(.*?)\+\+/g, '$1')
    .replace(/<u>(.*?)<\/u>/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
};
