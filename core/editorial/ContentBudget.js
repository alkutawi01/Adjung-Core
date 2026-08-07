// Single source of truth for "does this title+brief fit the card" for every code path that can
// create or edit editorial content (manual paste, AI pipeline generation, content-review edits).
// Geometry numbers (GEOMETRY_RATIOS etc.) come from GeometryConfig.js below, the single shared
// module for every consumer (FrontpageView.tsx, server.js, this file) — see that module's own
// comments for how the numbers were measured empirically per tier.
//
// Title and brief share one fixed space budget per card, not two independent caps: a card can fit
// a long title with a short brief, or a short title with a long brief, but not both maxed out at
// once. maxTitleAlone/maxBriefAlone are each field's length limit when the OTHER field is empty;
// the fraction of that solo budget a field actually uses (length / soloMax) must sum to <= 1.
import {
  GEOMETRY_RATIOS, FALLBACK_CEILINGS, TIER_SLOTS, tierForSlot, ratiosForTier,
  MAX_EYEBROW_CHARS_BY_TIER, eyebrowLabel, eyebrowCeilingForSlot, topikCeilingForSlot,
  FOCUS_VIEW_EYEBROW_MAX_CHARS,
} from './GeometryConfig.js';

// Had minimum Huraian ringkas — nisbah minimum baki bajet huraian yang MESTI diisi (2026-08-08,
// permintaan Izzat). 0.5 = huraian mesti guna sekurang-kurangnya separuh ruang yang tersedia
// untuk tajuk semasa — cukup longgar untuk tajuk yang sengaja ringkas, cukup ketat untuk elak
// huraian sekadar frasa pendek dalam kad yang boleh muat jauh lebih banyak.
const MIN_BRIEF_USAGE_FRACTION = 0.5;

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

    // Had MINIMUM Huraian ringkas (2026-08-08, permintaan Izzat — "huraian pendek tidak terlalu
    // pendek sehingga nampak kosong"). Ditemui semasa ujian sebenar: kad tier ketat (cth KOMPAK,
    // had huraian 41 aksara) boleh diisi cuma 20 aksara ("Karya klasik Melayu.") — teknikal sah
    // (dalam bajet), tapi tinggalkan ruang kosong ketara pada kad kerana saiz fizikal kad tetap
    // tak kira berapa pendek kandungan diisi. Had dikira NISBAH terhadap baki bajet SEBENAR
    // tajuk ini (bukan nombor tegar), sebab baki huraian berubah ikut panjang tajuk — tajuk
    // panjang secara sah tinggalkan sedikit ruang huraian, itu bukan "terlalu pendek".
    if (briefLen > 0 && maxBriefAlone > 0) {
      const remainingBriefUntukTajukIni = Math.max(0, (1 - titleLen / maxTitleAlone) * maxBriefAlone);
      const hadMinimumHuraian = Math.floor(remainingBriefUntukTajukIni * MIN_BRIEF_USAGE_FRACTION);
      if (remainingBriefUntukTajukIni >= 10 && briefLen < hadMinimumHuraian) {
        return {
          isValid: false,
          reason: `Huraian (${briefLen} aksara) terlalu pendek untuk ruang kad ${tier} — sekurang-kurangnya ${hadMinimumHuraian} aksara untuk tajuk sepanjang ${titleLen} aksara ini (elak kad nampak kosong). Panjangkan huraian, atau panjangkan tajuk untuk kurangkan baki ruang huraian.`,
        };
      }
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
let MEDAN_LIMITS = {
  hadHuraianPanjang: 0, hadSumber: 0, hadTopik: 0, hadNotaEditor: 0,
  // Had MINIMUM (2026-08-07, permintaan Izzat — "sepatutnya ada juga had minimum... takkan
  // huraian panjang boleh tulis 1 aksara sahaja") — sebelum ni HANYA had maksimum wujud untuk
  // keempat-empat medan ni; Sumber/Topik/Nota Editor langsung tiada had minimum, dan had minimum
  // Huraian Panjang (400 aksara) dikuatkuasakan berasingan (hardcoded, lihat MIN_BRIEF_LONG_CHARS
  // di server.js/contentRoutes.js) — bukan boleh laras di sini. Ni tambahan, bukan gantian: "yang
  // mana lebih ketat, itu yang menahan dahulu" (sama falsafah macam nota sedia ada di server.js).
  hadHuraianPanjangMin: 0, hadSumberMin: 0, hadTopikMin: 0, hadNotaEditorMin: 0,
};

const setMedanLimits = (nilai) => {
  MEDAN_LIMITS = {
    hadHuraianPanjang: Number(nilai?.hadHuraianPanjang) || 0,
    hadSumber: Number(nilai?.hadSumber) || 0,
    hadTopik: Number(nilai?.hadTopik) || 0,
    hadNotaEditor: Number(nilai?.hadNotaEditor) || 0,
    hadHuraianPanjangMin: Number(nilai?.hadHuraianPanjangMin) || 0,
    hadSumberMin: Number(nilai?.hadSumberMin) || 0,
    hadTopikMin: Number(nilai?.hadTopikMin) || 0,
    hadNotaEditorMin: Number(nilai?.hadNotaEditorMin) || 0,
  };
};

const getMedanLimits = () => ({ ...MEDAN_LIMITS });

/**
 * Semak had aksara bagi medan yang tiada kaitan dengan saiz kad. Medan yang tak dihantar
 * (undefined) tidak disemak — supaya kemas kini separa tidak menolak medan yang tak disentuh.
 */
const validateMedanTambahan = ({ summaryLong, source, topik, note } = {}) => {
  const semakan = [
    ['Huraian panjang', summaryLong, MEDAN_LIMITS.hadHuraianPanjang, MEDAN_LIMITS.hadHuraianPanjangMin],
    ['Sumber', source, MEDAN_LIMITS.hadSumber, MEDAN_LIMITS.hadSumberMin],
    ['Topik', topik, MEDAN_LIMITS.hadTopik, MEDAN_LIMITS.hadTopikMin],
    ['Nota editor', note, MEDAN_LIMITS.hadNotaEditor, MEDAN_LIMITS.hadNotaEditorMin],
  ];
  for (const [nama, nilai, had, min] of semakan) {
    if (typeof nilai !== 'string') continue;
    if (had && nilai.length > had) {
      return {
        isValid: false,
        reason: `${nama} (${nilai.length} aksara) melebihi had ${had} aksara yang ditetapkan di Tetapan Am Slot. Kandungan tidak disiarkan.`,
      };
    }
    // Had minimum HANYA terpakai bila editor BENAR-BENAR isi sesuatu — medan ni semua opsyenal,
    // ramai kandungan tiada langsung dan itu sah. Kosong terus tak pernah ditolak sebab minimum.
    if (min && nilai.trim() && nilai.length < min) {
      return {
        isValid: false,
        reason: `${nama} (${nilai.length} aksara) terlalu pendek — minimum ${min} aksara yang ditetapkan di Tetapan Am Slot (atau kosongkan terus medan ni). Kandungan tidak disiarkan.`,
      };
    }
  }
  return { isValid: true };
};

// Format sumber — validasi URL (2026-08-05, Fasa 8b). URL sumber bebas-had aksara (`hadSumber`
// atas cuma kawal medan NAMA sumber, bukan pautan) tapi mesti sekurang-kurangnya rupa URL sah
// (http/https + skema penuh) — sebelum ni medan bebas sepenuhnya, boleh simpan teks sampah dan
// pembaca klik "Pautan Sumber" ke mana-mana. Medan kosong DIBENARKAN (bukan setiap kandungan ada
// pautan sumber luar).
const validateSourceUrl = (url) => {
  if (url === undefined || url === null) return { isValid: true };
  if (typeof url !== 'string') return { isValid: true };
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#') return { isValid: true };
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      reason: `URL sumber ("${trimmed}") bukan URL yang sah. Sertakan skema penuh (cth https://...).`,
    };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      reason: `URL sumber mesti bermula dengan http:// atau https:// (dapat "${parsed.protocol}//").`,
    };
  }
  return { isValid: true };
};

// Bidang (kategori/desk) is locked per-slot: every item saved into a slot must share that slot's
// Bidang. Topik is a free-text per-item field, mandatory only for new/edited content (not for
// status-only actions on legacy content that predates this rule — pass requireTopik accordingly).
const validateBidangTopik = ({ slotBidang, itemBidang, topik, requireTopik, slotIndex }) => {
  if (slotBidang && itemBidang && slotBidang.trim().toUpperCase() !== itemBidang.trim().toUpperCase()) {
    return {
      isValid: false,
      reason: `Bidang kandungan ("${itemBidang}") tidak sepadan dengan bidang slot ini ("${slotBidang}"). Kandungan tidak disiarkan.`,
    };
  }
  if (requireTopik && !(topik && topik.trim())) {
    return { isValid: false, reason: 'Topik diperlukan untuk kandungan baharu/diedit. Kandungan tidak disiarkan.' };
  }

  // Had ruang eyebrow: kandungan yang dipapar pada kad mesti muat SATU baris. Kalau ia membalut,
  // ia menolak tajuk+huraian ke bawah tanpa kad membesar — kerosakan senyap yang tak ditangkap
  // oleh bajet tajuk+huraian.
  //
  // DUA laluan render berbeza (EyebrowKad, FrontpageView.tsx), DUA pengesahan berbeza — pengesahan
  // MESTI ikut apa yang benar-benar dipapar (Peraturan Perlembagaan), bukan satu formula sejagat:
  //   - Topik wujud (laluan biasa untuk kandungan baharu/diedit): kad papar IKON Bidang + Topik,
  //     BUKAN nama Bidang sebagai teks. Sahkan Topik SAHAJA terhadap had yang sudah kira lebar
  //     ikon+jarak (MAX_EYEBROW_TOPIK_CHARS_BY_TIER) — panjang nama Bidang tak lagi relevan.
  //   - Topik kosong (kandungan lama, requireTopik=false): tiada ikon tanpa Topik — kad jatuh
  //     balik papar nama Bidang SAHAJA sebagai teks. Sahkan panjang nama Bidang itu terhadap had
  //     teks penuh (MAX_EYEBROW_CHARS_BY_TIER), sama seperti sebelum ni.
  if (slotIndex !== undefined && slotIndex !== null) {
    const topikTrimmed = (topik || '').trim();
    if (topikTrimmed) {
      const ceiling = topikCeilingForSlot(slotIndex);
      if (topikTrimmed.length > ceiling) {
        return {
          isValid: false,
          reason: `Topik (${topikTrimmed.length} aksara) melebihi ruang eyebrow kad ini (${ceiling} aksara). Kandungan tidak disiarkan.`,
        };
      }
    } else {
      const bidangLen = (itemBidang || '').trim().length;
      const ceiling = eyebrowCeilingForSlot(slotIndex);
      if (bidangLen > ceiling) {
        return {
          isValid: false,
          reason: `Nama Bidang ("${(itemBidang || '').trim()}", ${bidangLen} aksara) melebihi ruang eyebrow kad ini (${ceiling} aksara). Kandungan tidak disiarkan.`,
        };
      }
    }

    // Focus View SENTIASA papar label PENUH "Bidang | Topik" (tiada ikon di situ — lihat
    // FocusView.tsx), tak kira tier asal kandungan atau laluan mana yang lulus di atas. Lajur
    // "helaian" Focus View lebar TETAP (min(64vw,900px)) tak kira tier — jadi ini SATU had
    // sejagat berasingan daripada had kad di atas, bukan pengganti. Tanpa semakan ni, Topik yang
    // lulus had kad (cth 90 aksara HERO) boleh melimpah keluar bingkai Focus View pada viewport
    // sempit (~49 aksara ruang sebenar, diukur pada 768px — lihat FOCUS_VIEW_EYEBROW_MAX_CHARS).
    const labelPenuh = eyebrowLabel(itemBidang, topik);
    if (labelPenuh.length > FOCUS_VIEW_EYEBROW_MAX_CHARS) {
      return {
        isValid: false,
        reason: `Label "Bidang | Topik" (${labelPenuh.length} aksara) melebihi ruang eyebrow Focus View (${FOCUS_VIEW_EYEBROW_MAX_CHARS} aksara pada viewport sempit). Kandungan tidak disiarkan.`,
      };
    }
  }

  return { isValid: true };
};

export {
  GEOMETRY_RATIOS, FALLBACK_CEILINGS, TIER_SLOTS, tierForSlot, ratiosForTier,
  MAX_EYEBROW_CHARS_BY_TIER, eyebrowLabel, eyebrowCeilingForSlot, topikCeilingForSlot,
  validateContentBudget, validateBidangTopik, validateSourceUrl,
  setMedanLimits, getMedanLimits, validateMedanTambahan,
};
