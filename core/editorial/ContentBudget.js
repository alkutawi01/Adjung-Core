// Single source of truth for "does this title+brief fit the card" for every code path that can
// create or edit editorial content (manual paste, AI pipeline generation, content-review edits).
// Mirrors GEOMETRY_RATIOS in src/components/portal/FrontpageView.tsx — keep both in sync if the
// underlying card geometry ever changes (measured empirically per tier, see that file's comments).
//
// Title and brief share one fixed space budget per card, not two independent caps: a card can fit
// a long title with a short brief, or a short title with a long brief, but not both maxed out at
// once. maxTitleAlone/maxBriefAlone are each field's length limit when the OTHER field is empty;
// the fraction of that solo budget a field actually uses (length / soloMax) must sum to <= 1.
import {
  GEOMETRY_RATIOS, FALLBACK_CEILINGS, TIER_SLOTS, tierForSlot, ratiosForTier,
  MAX_EYEBROW_CHARS_BY_TIER, eyebrowLabel, eyebrowCeilingForSlot, topikCeilingForSlot,
} from './GeometryConfig.js';

// Every slot of the same tier gets the exact same rule — there is no per-slot special-casing.
const validateContentBudget = (slotIndex, title, summary) => {
  const tier = tierForSlot(slotIndex);
  const titleLen = (title || '').length;
  const briefLen = (summary || '').length;
  // ratiosForTier(), bukan GEOMETRY_RATIOS[tier] — supaya pindaan had aksara yang dibuat Ketua
  // Editor di Editorium → Slot → Tier Kad benar-benar berkuat kuasa semasa pengesahan simpan.
  const ratioDef = tier ? ratiosForTier(tier) : null;

  if (ratioDef) {
    const { maxTitleAlone, maxBriefAlone } = ratioDef;

    // Tiers with no brief field at all (e.g. BAR, maxBriefAlone === 0): title gets the full solo
    // budget, brief must stay empty — there's no trade-off to compute against zero.
    if (maxBriefAlone === 0) {
      if (briefLen > 0) {
        return {
          isValid: false,
          reason: `Kad ${tier} tidak menyokong huraian ringkas. Sila kosongkan huraian.`,
        };
      }
      if (maxTitleAlone && titleLen > maxTitleAlone) {
        return {
          isValid: false,
          reason: `Tajuk (${titleLen} aksara) melebihi had maksimum ruang kad ${tier} (${maxTitleAlone} aksara).`,
        };
      }
      return { isValid: true };
    }

    // Title and brief share ONE fixed space budget, not two independent caps: the fraction of
    // each field's SOLO maximum actually used must sum to <= 1 (Peraturan #2, Perlembagaan). A
    // short title frees up room for a longer brief, and vice versa. Previously this checked title
    // and brief as two flat independent caps — silently contradicting the documented formula
    // (and this file's own header comment) and rejecting legitimate short-title/long-brief content.
    const usedFraction = (maxTitleAlone ? titleLen / maxTitleAlone : 0) + (maxBriefAlone ? briefLen / maxBriefAlone : 0);
    if (usedFraction > 1) {
      // Huraian kosong tapi masih gagal = tajuk sendiri yang melebihi ruang kad. Mesej "Huraian
      // (0 aksara) melebihi had" dalam keadaan tu mengarahkan editor memendekkan medan yang
      // memang sudah kosong.
      if (briefLen === 0) {
        return {
          isValid: false,
          reason: `Tajuk (${titleLen} aksara) melebihi ruang kad ${tier} (had tajuk: ${maxTitleAlone} aksara). Kandungan tidak disiarkan.`,
        };
      }
      // Report the ACTUAL remaining huraian budget this specific title length leaves behind, not
      // the two static solo-max numbers side by side — those are only the ceiling when the OTHER
      // field is empty, and stating them unqualified reads as "huraian limit is always 78" when a
      // near-max-length title can shrink that to single digits. Editors need the real number for
      // THIS content, not the tier's theoretical maximum.
      const remainingBrief = Math.max(0, Math.round((1 - titleLen / maxTitleAlone) * maxBriefAlone));
      return {
        isValid: false,
        reason: `Huraian (${briefLen} aksara) melebihi had yang dibenarkan untuk tajuk sepanjang ${titleLen} aksara ini (had huraian maksimum: ${remainingBrief} aksara, kad ${tier}). Kandungan tidak disiarkan.`,
      };
    }
    return { isValid: true };
  }

  const ceiling = FALLBACK_CEILINGS[tier] || FALLBACK_CEILINGS.DEFAULT;
  if (ceiling.maxTitle && titleLen > ceiling.maxTitle) {
    return { isValid: false, reason: `Tajuk melebihi had ${ceiling.maxTitle} aksara (semasa: ${titleLen}).` };
  }
  if (ceiling.maxBrief && briefLen > ceiling.maxBrief) {
    return { isValid: false, reason: `Huraian melebihi had ${ceiling.maxBrief} aksara (semasa: ${briefLen}).` };
  }
  return { isValid: true };
};

// ---------------------------------------------------------------------------------------------
// HAD AKSARA MEDAN TAMBAHAN (2026-07-30, permintaan pemilik projek)
//
// Tajuk dan huraian ringkas dikawal oleh bajet ruang kad di atas (ikut tier). Medan ni pula tidak
// dipaparkan pada muka kad, jadi hadnya bukan soal geometri — ia dasar editorial, satu nombor
// untuk semua slot, ditetapkan di Editorium → Slot → Tetapan Am.
//
// 0 = TIADA HAD. Nilai dimuatkan ke cache dalam-memori oleh server semasa boot dan setiap kali
// disimpan (core/routes/slotAmRoutes.js) kerana pengesahan ni sync.
let MEDAN_LIMITS = { hadHuraianPanjang: 0, hadSumber: 0, hadTopik: 0, hadNotaEditor: 0 };

const setMedanLimits = (nilai) => {
  MEDAN_LIMITS = {
    hadHuraianPanjang: Number(nilai?.hadHuraianPanjang) || 0,
    hadSumber: Number(nilai?.hadSumber) || 0,
    hadTopik: Number(nilai?.hadTopik) || 0,
    hadNotaEditor: Number(nilai?.hadNotaEditor) || 0,
  };
};

const getMedanLimits = () => ({ ...MEDAN_LIMITS });

/**
 * Semak had aksara bagi medan yang tiada kaitan dengan saiz kad. Medan yang tak dihantar
 * (undefined) tidak disemak — supaya kemas kini separa tidak menolak medan yang tak disentuh.
 */
const validateMedanTambahan = ({ summaryLong, source, topik, note } = {}) => {
  const semakan = [
    ['Huraian panjang', summaryLong, MEDAN_LIMITS.hadHuraianPanjang],
    ['Sumber', source, MEDAN_LIMITS.hadSumber],
    ['Topik', topik, MEDAN_LIMITS.hadTopik],
    ['Nota editor', note, MEDAN_LIMITS.hadNotaEditor],
  ];
  for (const [nama, nilai, had] of semakan) {
    if (!had) continue; // 0 = tiada had
    if (typeof nilai !== 'string') continue;
    if (nilai.length > had) {
      return {
        isValid: false,
        reason: `${nama} (${nilai.length} aksara) melebihi had ${had} aksara yang ditetapkan di Tetapan Am Slot. Kandungan tidak disiarkan.`,
      };
    }
  }
  return { isValid: true };
};

// Bidang (kategori/desk) is locked per-slot: every item saved into a slot must share that slot's
// Bidang. Topik is a free-text per-item field, mandatory only for new/edited content (not for
// status-only actions on legacy content that predates this rule — pass requireTopik accordingly).
export const validateBidangTopik = (arg1, arg2, arg3, arg4, arg5) => {
  let slotBidang, itemBidang, topik, requireTopik, slotIndex;
  if (typeof arg1 === 'object' && arg1 !== null) {
    ({ slotBidang, itemBidang, topik, requireTopik, slotIndex } = arg1);
  } else {
    slotBidang = arg1;
    itemBidang = arg2;
    topik = arg3;
    requireTopik = arg4;
    slotIndex = arg5;
  }
  if (slotBidang && itemBidang && slotBidang.trim().toUpperCase() !== itemBidang.trim().toUpperCase()) {
    return {
      isValid: false,
      reason: `Bidang kandungan ("${itemBidang}") tidak sepadan dengan bidang slot ini ("${slotBidang}"). Kandungan tidak disiarkan.`,
    };
  }
  if (requireTopik && !(topik && topik.trim())) {
    return { isValid: false, reason: 'Topik diperlukan untuk kandungan baharu/diedit. Kandungan tidak disiarkan.' };
  }

  // Had ruang eyebrow: label "Bidang | Topik" mesti muat SATU baris pada kad. Kalau ia
  // membalut, ia menolak tajuk+huraian ke bawah tanpa kad membesar — kerosakan senyap
  // yang tak ditangkap oleh bajet tajuk+huraian. Lihat MAX_EYEBROW_CHARS_BY_TIER.
  if (slotIndex !== undefined && slotIndex !== null) {
    const label = eyebrowLabel(itemBidang, topik);
    const ceiling = eyebrowCeilingForSlot(slotIndex);
    if (label.length > ceiling) {
      const bidangLen = (itemBidang || '').trim().length;
      const bakiTopik = Math.max(0, ceiling - bidangLen - 3); // 3 = ' | '
      return {
        isValid: false,
        reason: `Label "Bidang | Topik" (${label.length} aksara) melebihi ruang eyebrow kad ini (${ceiling} aksara). Dengan Bidang "${(itemBidang || '').trim()}", Topik boleh sehingga ${bakiTopik} aksara. Kandungan tidak disiarkan.`,
      };
    }
  }

  return { isValid: true };
};

export {
  GEOMETRY_RATIOS, FALLBACK_CEILINGS, TIER_SLOTS, tierForSlot, ratiosForTier,
  MAX_EYEBROW_CHARS_BY_TIER, eyebrowLabel, eyebrowCeilingForSlot, topikCeilingForSlot,
  validateContentBudget,
  setMedanLimits, getMedanLimits, validateMedanTambahan,
};
