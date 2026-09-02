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

// Had minimum bajet KESELURUHAN (tajuk + huraian bersama) — nisbah minimum jumlah ruang kad yang
// MESTI diguna (2026-08-08, keputusan Izzat, gantikan pendekatan huraian-sahaja 50% sebelum ni).
// 0.8 = tajuk+huraian bersama mesti isi sekurang-kurangnya 80% jumlah bajet kongsi kad, elak kad
// nampak kosong tanpa mengira nisbah tajuk:huraian sendiri.
const MIN_TOTAL_USAGE_FRACTION = 0.8;

// NOTA MESEJ RALAT (2026-08-16, pepijat Izzat) — `reason` di sini menyatakan FAKTA sahaja (apa
// yang melebihi had, berapa banyak), TAK PERNAH menyatakan AKIBAT ("Kandungan tidak disiarkan").
// Modul ni dipanggil dari laluan yang akibatnya BERBEZA sama sekali:
//   - Terbitkan kali pertama (server.js syncManualObjectsForSlot) — ya, kandungan tak disiarkan.
//   - Sunting kandungan yang SUDAH terbit (PATCH contentRoutes.js, guna Semakan Kandungan) —
//     kandungan LAMA tetap kekal disiarkan, cuma SUNTINGAN yang ditolak.
// Izzat tangkap mesej lama silap: "saya siarkan kandungan ni ... saya cuba sunting, saya save,
// tak dapat tp kandungan (sebelum disunting) masih disiarkan" — mesej kata "tidak disiarkan"
// sedangkan kandungan tu JELAS masih hidup di halaman awam. Setiap pemanggil tambah ayat akibat
// yang BETUL bagi laluannya sendiri.
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
          isValid: false, bolehSalinAI: true,
          reason: `Kad ${tier} tidak menyokong huraian ringkas. Sila kosongkan huraian.`,
        };
      }
      if (maxTitleAlone && titleLen > maxTitleAlone) {
        return {
          isValid: false, bolehSalinAI: true,
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
          isValid: false, bolehSalinAI: true,
          reason: `Tajuk (${titleLen} aksara) melebihi ruang kad ${tier} (had tajuk: ${maxTitleAlone} aksara).`,
        };
      }
      // Report the ACTUAL remaining huraian budget this specific title length leaves behind, not
      // the two static solo-max numbers side by side — those are only the ceiling when the OTHER
      // field is empty, and stating them unqualified reads as "huraian limit is always 78" when a
      // near-max-length title can shrink that to single digits. Editors need the real number for
      // THIS content, not the tier's theoretical maximum.
      const remainingBrief = Math.max(0, Math.round((1 - titleLen / maxTitleAlone) * maxBriefAlone));
      return {
        isValid: false, bolehSalinAI: true,
        reason: `Huraian (${briefLen} aksara) melebihi had yang dibenarkan untuk tajuk sepanjang ${titleLen} aksara ini (had huraian maksimum: ${remainingBrief} aksara, kad ${tier}).`,
      };
    }

    // Had MINIMUM bajet KESELURUHAN (2026-08-08, keputusan Izzat — "had bajet mesti 80% ke atas,
    // merangkumi tajuk DAN huraian", gantikan pendekatan huraian-sahaja 50% sebelum ni). Jumlah
    // nisbah tajuk+huraian (usedFraction, dikira di atas) mesti sekurang-kurangnya 80% daripada
    // bajet kongsi kad — elak kad nampak kosong tanpa kira nisbah tajuk:huraian sendiri.
    if (usedFraction < MIN_TOTAL_USAGE_FRACTION) {
      return {
        isValid: false, bolehSalinAI: true,
        reason: `Kandungan (${Math.round(usedFraction * 100)}% bajet kad ${tier}) terlalu ringkas. Sekurang-kurangnya ${Math.round(MIN_TOTAL_USAGE_FRACTION * 100)}% jumlah bajet tajuk+huraian mesti diguna, elak kad nampak kosong. Panjangkan tajuk dan/atau huraian.`,
      };
    }
    return { isValid: true };
  }

  const ceiling = FALLBACK_CEILINGS[tier] || FALLBACK_CEILINGS.DEFAULT;
  if (ceiling.maxTitle && titleLen > ceiling.maxTitle) {
    return { isValid: false, bolehSalinAI: true, reason: `Tajuk melebihi had ${ceiling.maxTitle} aksara (semasa: ${titleLen}).` };
  }
  if (ceiling.maxBrief && briefLen > ceiling.maxBrief) {
    return { isValid: false, bolehSalinAI: true, reason: `Huraian melebihi had ${ceiling.maxBrief} aksara (semasa: ${briefLen}).` };
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

// Huraian Panjang WAJIB apabila had minimum ditetapkan (2026-08-28, keputusan Izzat) — sebelum
// ni had minimum (effectiveMinBriefLong()/hadHuraianPanjangMin) HANYA terpakai bila editor
// BENAR-BENAR isi sesuatu; medan kosong terus sentiasa lulus. Izzat tangkap kandungan sebenar
// (Slot 7, "Asal Ibadah Tidak Disyariatkan Sehingga Ada Dalil") terbit dengan Huraian Panjang
// kosong sepenuhnya walau had minimum 1200 aksara sudah ditetapkan — niat had minimum ialah
// "kalau nak isi, isi betul-betul", bukan "boleh terus tak isi". Fungsi ni sengaja BERASINGAN
// daripada validateMedanTambahan (yang KEKAL tak berubah untuk Sumber/Topik/Nota Editor — medan
// itu kekal opsyenal, cuma Huraian Panjang yang jadi wajib). Pemanggil (server.js penciptaan,
// contentRoutes.js suntingan) uruskan pengecualian kandungan sedia ada sendiri, sama corak
// seperti had lain di fail ni — fungsi ni cuma nyatakan FAKTA status semasa.
const validateHuraianPanjangWajib = (summaryLong, min) => {
  if (!min) return { isValid: true };
  const trimmed = (summaryLong || '').trim();
  if (!trimmed) {
    return {
      isValid: false, bolehSalinAI: true,
      reason: `Huraian panjang wajib diisi (minimum ${min} aksara ditetapkan di Tetapan Am Slot).`,
    };
  }
  if (trimmed.length < min) {
    return {
      isValid: false, bolehSalinAI: true,
      reason: `Huraian panjang (${trimmed.length} aksara) terlalu pendek. Minimum ${min} aksara.`,
    };
  }
  return { isValid: true };
};

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
        isValid: false, bolehSalinAI: true,
        reason: `${nama} (${nilai.length} aksara) melebihi had ${had} aksara yang ditetapkan di Tetapan Am Slot. Kandungan tidak disiarkan.`,
      };
    }
    // Had minimum HANYA terpakai bila editor BENAR-BENAR isi sesuatu — medan ni semua opsyenal,
    // ramai kandungan tiada langsung dan itu sah. Kosong terus tak pernah ditolak sebab minimum.
    if (min && nilai.trim() && nilai.length < min) {
      return {
        isValid: false, bolehSalinAI: true,
        reason: `${nama} (${nilai.length} aksara) terlalu pendek. Minimum ${min} aksara yang ditetapkan di Tetapan Am Slot (atau kosongkan terus medan ini). Kandungan tidak disiarkan.`,
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
      isValid: false, bolehSalinAI: true,
      reason: `URL sumber ("${trimmed}") bukan URL yang sah. Sertakan skema penuh (cth https://...).`,
    };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false, bolehSalinAI: true,
      reason: `URL sumber mesti bermula dengan http:// atau https:// (dapat "${parsed.protocol}//").`,
    };
  }
  return { isValid: true };
};

// Nama sumber placeholder tertinggal (2026-08-19, pepijat sebenar Izzat — kandungan terbit dgn
// "Sumber: (nama sebenar sumber anda)", nilai CONTOH literal dalam Arahan AI (buildAiPrompt(),
// SlotManagerModal.tsx baris ~373) yang sepatutnya AI ganti dgn kandungan sebenar tapi tersalin
// verbatim dan lepas tanpa disedari editor — tiada semakan wujud sebelum ni langsung utk medan
// nama sumber). Heuristik AM (bukan senarai literal string tertentu, supaya placeholder templat
// LAIN yang serupa bentuknya turut tertangkap, bukan cuma contoh ni sahaja) — mana-mana nilai
// SATU-BARIS yang selepas dipangkas DIBUNGKUS SEPENUHNYA dalam SATU pasang kurungan hampir pasti
// arahan placeholder yang tak sempat diganti; tiada sumber berita sebenar ditulis "(Reuters)"
// dengan kurungan merangkumi keseluruhan nilai macam tu.
const validateSumberNama = (nama) => {
  if (typeof nama !== 'string') return { isValid: true };
  const trimmed = nama.trim();
  if (!trimmed) return { isValid: true };
  if (/^\(.+\)$/.test(trimmed)) {
    return {
      isValid: false, bolehSalinAI: true,
      reason: `Nama sumber ("${trimmed}") kelihatan seperti placeholder templat Arahan AI yang belum digantikan dengan nama sumber sebenar.`,
    };
  }
  return { isValid: true };
};

// Format Tarikh sumber (2026-08-19, pepijat sebenar Izzat — kandungan terbit dgn "Tarikh sumber:
// YYYY-MM-DD" literal, contoh format dalam Arahan AI yang sepatutnya diganti tarikh sebenar).
// Medan ni sebelum ni TIADA semakan format langsung — apa-apa rentetan diterima terus. WAJIB ISO
// YYYY-MM-DD (4 digit tahun, 2 digit bulan/hari) kalau diisi; medan kosong kekal dibenarkan (tak
// semua kandungan ada tarikh sumber diketahui).
const validateTarikhSumber = (tarikh) => {
  if (typeof tarikh !== 'string') return { isValid: true };
  const trimmed = tarikh.trim();
  if (!trimmed) return { isValid: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return {
      isValid: false, bolehSalinAI: true,
      reason: `Tarikh sumber ("${trimmed}") bukan format tarikh yang sah. Guna format YYYY-MM-DD sebenar (cth 2026-08-17), bukan templat.`,
    };
  }
  return { isValid: true };
};

// Had panjang gloss interlinear (2026-08-12, keputusan Izzat + audit ChatGPT) — sintaks
// `[label](gloss:makna)` (src/utils.tsx tokenize()) papar `makna` sebagai anotasi kecil di atas
// `label`. Gloss terlalu panjang buat kad/Focus View nampak berselerak (bukti: simulasi UX #8,
// screenshot produksi Izzat 2026-08-12). Ni GUARD DATA (halang gloss terlalu panjang drpd
// disimpan terus), BUKAN penyelesaian CSS/reka bentuk render (kerja berasingan — lihat
// src/index.css .interlinear-gloss/.interlinear-word, Pendekatan B).
//
// Kontrak TEPAT (2026-08-12, pembetulan Izzat lepas nisbah 1.5:1 sahaja didapati tak cukup ketat
// utk cegah overflow sebenar) — gloss mesti patuhi KETIGA-TIGA had serentak (paling ketat yang
// menahan dahulu):
//   1. Maksimum 2 PERKATAAN dlm gloss (bukan ayat/frasa panjang);
//   2. Maksimum 30 AKSARA mutlak, tak kira apa panjang label;
//   3. Maksimum 1.5x panjang LABEL (label pendek -> gloss kena lagi pendek drpd 30 aksara).
// Cth: label "ini adalah" (10 aksara) -> had nisbah bagi 15 aksara, jadi 15 yg terpakai (lagi
// ketat drpd 30), BUKAN 30.
//
// Pengesanan pasangan [label](gloss:makna) guna padanan kurungan SEIMBANG yang SAMA dgn
// tokenize() client (src/utils.tsx) — bukan indexOf ')' naif, elak salah kesan bila makna sendiri
// ada '(...)' wajar (cth "(rujuk...)"). GLOSS_LOOKAHEAD_MAX sama nilai/sebab spt versi client.
const GLOSS_LOOKAHEAD_MAX = 300;
const GLOSS_MAX_RATIO = 1.5;
const GLOSS_MAX_CHARS_ABSOLUTE = 30;
const GLOSS_MAX_WORDS = 2;

// Gloss authoring KIV (2026-08-12, keputusan Izzat + audit ChatGPT) — bukan ciri gagal secara
// teknikal (had panjang + tipografi B2/nowrap dah selesai betul, lihat sejarah git di atas), tapi
// ia jadi "confounding variable" yang asyik ganggu round simulasi UX 50 pusingan yang sedang
// berjalan. Izzat minta gloss dimatikan buat editor SEHINGGA ia benar² stabil digunakan, TANPA
// padam sintaks/parser/kandungan sedia ada:
//   - Gloss SEDIA ADA (kandungan lama) TERUS dirender macam biasa (src/utils.tsx tokenize() TAK
//     disentuh — ini penggera SIMPAN, bukan PAPAR, jadi regression corpus kekal utuh).
//   - Cubaan SIMPAN (cipta baharu ATAU edit) kandungan yg ada sintaks [label](gloss:...) DITOLAK
//     dgn mesej jelas, tak kira gloss tu baru ditaip atau kandungan lama yg kebetulan disimpan
//     semula (edit medan lain dlm item yg dah ada gloss pun turut disekat — trade-off SENGAJA
//     demi kesederhanaan drpd logik diff lama-vs-baharu yg jauh lebih kompleks merentasi 3 laluan
//     simpan; item ujian gloss sedia ada (Slot 1-3) memang tak dijangka disunting sehingga
//     pusingan simulasi #50 selesai — lihat nota Perlembagaan).
//   - Tukar GLOSS_AUTHORING_ENABLED ke true bila ciri ni sedia dibuka semula.
const GLOSS_AUTHORING_ENABLED = false;

// Paparan gloss (2026-08-12, keputusan Izzat susulan) — mematikan PENULISAN sahaja masih
// meninggalkan gloss LAMA terpapar, dan Izzat sahkan drpd telefon+desktop bahawa unit interlinear
// itu merosakkan jarak baris perenggan walaupun ciri sudah "dimatikan". Jadi ada DUA suis
// berasingan, sengaja:
//   - GLOSS_AUTHORING_ENABLED: bolehkah gloss BAHARU disimpan?
//   - GLOSS_RENDERING_ENABLED: adakah gloss sedia ada DIPAPARKAN?
// Bila paparan dimatikan, perkataan rujukan tetap dipapar sebagai teks biasa (aliran perenggan
// kembali normal sepenuhnya) manakala sintaks [label](gloss:...) KEKAL dalam pangkalan data —
// tiada kandungan dipadam, tiada migrasi, dan cukup tukar suis ni ke true untuk hidupkan semula.
// Diletak bersebelahan suis penulisan supaya "kill switch" gloss ada di SATU tempat dan dua
// keadaan itu tidak boleh terpesong sesama sendiri.
const GLOSS_RENDERING_ENABLED = false;

const extractGlossPairs = (text) => {
  if (typeof text !== 'string' || !text) return [];
  const pairs = [];
  const len = text.length;
  let i = 0;
  while (i < len) {
    if (text[i] === '[') {
      const closeBracket = text.indexOf('](', i);
      if (closeBracket === -1) { i += 1; continue; }
      let depth = 1;
      let j = closeBracket + 2;
      let closeParen = -1;
      const scanLimit = Math.min(len, closeBracket + 2 + GLOSS_LOOKAHEAD_MAX);
      while (j < scanLimit) {
        if (text[j] === '(') depth++;
        else if (text[j] === ')') { depth--; if (depth === 0) { closeParen = j; break; } }
        j++;
      }
      if (closeParen !== -1) {
        const label = text.substring(i + 1, closeBracket);
        const url = text.substring(closeBracket + 2, closeParen);
        if (url.startsWith('gloss:')) {
          pairs.push({ label, gloss: url.substring(6) });
        }
        i = closeParen + 1;
        continue;
      }
      // Sintaks rosak (tiada penutup seimbang) — sama spt client, bukan tanggungjawab pengesahan
      // ni; tokenize() client dah handle fallback selamat pada paparan. Langkau, jangan tolak simpan
      // atas sintaks tak lengkap yang bukan gloss langsung.
      i = closeBracket + 2;
      continue;
    }
    i += 1;
  }
  return pairs;
};

/**
 * Semak SETIAP pasangan [label](gloss:makna) dalam medan yang dihantar terhadap KETIGA-TIGA had
 * serentak (lihat nota kontrak di atas GLOSS_MAX_RATIO) — perkataan, aksara mutlak, DAN nisbah;
 * paling ketat yang menahan dahulu. `fields` ialah { 'Nama Medan': teks }; medan bukan-rentetan/
 * kosong dilangkau (selaras falsafah validateMedanTambahan — kemas kini separa tak ditolak sebab
 * medan yang tak disentuh).
 */
const validateGlossLength = (fields) => {
  for (const [namaMedan, teks] of Object.entries(fields || {})) {
    if (typeof teks !== 'string' || !teks) continue;
    const pasangan = extractGlossPairs(teks);
    if (!GLOSS_AUTHORING_ENABLED && pasangan.length > 0) {
      return {
        isValid: false, bolehSalinAI: true,
        reason: `Gloss interlinear (${namaMedan}) dimatikan buat sementara (KIV) sehingga ciri ini stabil sepenuhnya. Kandungan gloss sedia ada terus dipaparkan seperti biasa — sekatan ini cuma pada simpanan baharu. Buang sintaks [label](gloss:...) daripada medan ini untuk simpan.`,
      };
    }
    for (const { label, gloss } of pasangan) {
      const bilPerkataanGloss = gloss.trim() ? gloss.trim().split(/\s+/).length : 0;
      if (bilPerkataanGloss > GLOSS_MAX_WORDS) {
        return {
          isValid: false, bolehSalinAI: true,
          reason: `Gloss untuk "${label}" (${namaMedan}) ada ${bilPerkataanGloss} perkataan. Maksimum ${GLOSS_MAX_WORDS} perkataan sahaja.`,
        };
      }
      const hadNisbah = Math.floor(label.length * GLOSS_MAX_RATIO);
      const hadTerpakai = Math.min(GLOSS_MAX_CHARS_ABSOLUTE, hadNisbah);
      if (gloss.length > hadTerpakai) {
        const sebab = hadTerpakai === hadNisbah
          ? `1.5x panjang perkataan "${label}"`
          : `had mutlak ${GLOSS_MAX_CHARS_ABSOLUTE} aksara`;
        return {
          isValid: false, bolehSalinAI: true,
          reason: `Gloss untuk "${label}" (${namaMedan}) terlalu panjang (${gloss.length} aksara). Maksimum ${hadTerpakai} aksara (${sebab}).`,
        };
      }
    }
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
  validateContentBudget, validateBidangTopik, validateSourceUrl, validateSumberNama, validateTarikhSumber,
  setMedanLimits, getMedanLimits, validateMedanTambahan, validateHuraianPanjangWajib, validateGlossLength,
  GLOSS_RENDERING_ENABLED,
};
