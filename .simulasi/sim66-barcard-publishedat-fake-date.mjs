// sim66 — BarCard.tsx eventDate fallback chain falls through to item.publishedAt (Adjung's OWN
// creation/approval timestamp, resolveSlotContent() -> approvedRevision.createdAt) when neither
// originalDate/date nor dateEnd exist. This affects AI-generated BAR content specifically: the
// pipeline (EditorialPipeline.js) never writes 'date'/'dateEnd' attributes for BAR-tier AI output,
// and only sets 'originalDate' when a content-pool source with a real publishedAt was matched
// (isSingleSourceMode strategies). For "Bebas"/search-only Bar generation with no matched pool
// item, originalDate stays '' too — so eventDate falls to item.publishedAt, a raw ISO timestamp
// string ("2026-09-08T14:23:11.456Z"), merely .toUpperCase()'d (not run through
// formatEventDateRange/formatSatuTarikh at all) and displayed VERBATIM in the card's "Tarikh
// acara" badge. Same anti-pattern already fixed server-side for this exact card twice before
// (2026-07-25 fake "19 Jul 2026" fallback, 2026-09-09 EditorialPipeline.js comment) — this is the
// client-side sibling that was never updated to match.
import { formatEventDateRange } from '../core/editorial/EventDateValidator.js';

const lapor = (ok, msg) => console.log(`[${ok ? 'LULUS' : 'GAGAL'}] ${msg}`);

// Reproduces BarCard.tsx's exact eventDate/dateOrDeskLabel computation (lines 28-32).
function kiraLabelSebelum(item) {
  const eventDate = formatEventDateRange(item.originalDate || item.date, item.dateEnd)
    || (item.publishedAt || '').toString().trim().toUpperCase();
  return eventDate || (item.desk || 'ADJUNG EDITORIAL').toString().toUpperCase();
}

// Reproduces the FIXED version: publishedAt (Adjung's own creation timestamp) is never a valid
// stand-in for "Tarikh acara" (event date) — drop it from the eventDate chain entirely, fall
// straight to desk/ADJUNG EDITORIAL like the "no info at all" case already does.
function kiraLabelSelepas(item) {
  const eventDate = formatEventDateRange(item.originalDate || item.date, item.dateEnd);
  return eventDate || (item.desk || 'ADJUNG EDITORIAL').toString().toUpperCase();
}

// Kes sebenar: kandungan BAR dijana AI (mod Bebas/carian, tiada Content Pool item sepadan),
// jadi originalDate/date/dateEnd kosong, tapi publishedAt (createdAt revisi diluluskan) wujud.
const itemAiTanpaTarikhSumber = {
  title: 'Program Minda Sejahtera 2026',
  desk: 'ILMU',
  originalDate: '',
  date: undefined,
  dateEnd: undefined,
  publishedAt: '2026-09-08T14:23:11.456Z',
};

const labelSebelum = kiraLabelSebelum(itemAiTanpaTarikhSumber);
const labelSelepas = kiraLabelSelepas(itemAiTanpaTarikhSumber);
console.log('  Label SEBELUM (pepijat):', JSON.stringify(labelSebelum));
console.log('  Label SELEPAS (dibaiki):', JSON.stringify(labelSelepas));

lapor(labelSebelum === '2026-09-08T14:23:11.456Z',
  'Sebelum dibaiki: raw ISO timestamp (createdAt Adjung) papar mentah sebagai "Tarikh Acara"');
lapor(labelSelepas === 'ILMU',
  'Selepas dibaiki: jatuh balik terus ke label Desk (bukan tarikh palsu)');

// Kawalan: kandungan manual/AI dgn originalDate SAH kekal papar tarikh diformat betul (fix ni
// tak jejaskan kes sedia ada yang berfungsi).
const itemDenganTarikhSah = { desk: 'ACARA', originalDate: '2026-08-21', publishedAt: '2026-09-01T00:00:00.000Z' };
const labelSah = kiraLabelSelepas(itemDenganTarikhSah);
lapor(labelSah === '21 OGOS 2026', 'Kandungan dgn originalDate sah masih papar tarikh diformat betul selepas fix');

// Kawalan: kandungan tanpa originalDate/date DAN tanpa publishedAt pun kekal jatuh balik desk
// (bukan regresi — laluan ni sudah wujud sebelum ni untuk kandungan yang benar2 kosong).
const itemKosongPenuh = { desk: 'SEJARAH' };
lapor(kiraLabelSelepas(itemKosongPenuh) === 'SEJARAH', 'Kandungan kosong penuh kekal jatuh balik ke Desk (tiada regresi)');
