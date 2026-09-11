/**
 * Adjung Desk Classification Rules Engine v3.1 (core/engines/DeskClassifierEngine.js)
 * 
 * Performs weighted keyword matching across news title, brief, and raw RSS category,
 * supporting individual Domain Anchors, Global Exclusion Rules, Primary & Secondary Desk detection,
 * and Public vs Internal Desk Separation (SEMASA for public frontpage).
 */

export function resolveDeskConflict(sortedDesks, normalizedText, globalExclusions = []) {
  if (!sortedDesks || sortedDesks.length === 0) {
    return { resolvedDesks: sortedDesks, resolverTag: 'NO_DESKS', conflictNote: null };
  }

  const text = normalizedText.toLowerCase();

  // 1. Apply Global Conflict Rules from DB if provided
  if (globalExclusions.length > 0) {
    for (const gex of globalExclusions) {
      if (gex.enabled === 0) continue;
      const kw = (gex.keyword || '').toLowerCase().trim();
      if (!kw) continue;

      const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const kwRegex = new RegExp(`\\b${escapedKw}\\b`, 'i');

      if (kwRegex.test(text)) {
        const penalty = Number(gex.penaltyWeight) || 45;
        const targetExcludedNames = (gex.targetDesksExcluded || '').split(',').map(s => s.trim());

        for (const deskObj of sortedDesks) {
          if (targetExcludedNames.includes(deskObj.deskName)) {
            deskObj.score -= penalty;
            deskObj.negativeMatches.push(`global_exclusion: ${kw} (-${penalty})`);
          }
        }
      }
    }
  }

  // PEMBETULAN (2026-09-09, dapatan bug-hunt): gelung Peraturan Konflik Global di atas
  // mengurangkan `deskObj.score` desk tertentu SECARA MENDALAM (in-place, sehingga -45+),
  // tapi susunan `sortedDesks` yang diterima daripada pemanggil kekal tak berubah (ia
  // susunan skor SEBELUM penalti pengecualian tu terpakai). `topDesk = sortedDesks[0]`
  // di bawah ni dahulu dibaca terus daripada susunan STALE tu — jika penalti pengecualian
  // menjatuhkan desk yang ASALNYA tertinggi ke bawah desk lain (cth Sains & Teknologi kena
  // -45 sebab kata kunci pengecualian, manakala Ekonomi tanpa penalti kekal skor asal lebih
  // tinggi), resolusi konflik domain (2) di bawah tetap terpakai pada desk LAMA yang bukan
  // lagi juara sebenar — konflik sukan-vs-ekonomi/perundangan-vs-teknologi terlepas terus
  // untuk kandungan tu. Disahkan: skor akhir (reSorted di penghujung fungsi) memang betul,
  // tapi keputusan resolverTag/conflictNote (dikira SEBELUM reSorted) silap desk sasaran.
  // Pembetulan: susun semula ikut skor SEBELUM tentukan topDesk untuk resolusi domain.
  sortedDesks.sort((a, b) => b.score - a.score);

  // 2. Domain Signal Resolution
  const hasLegalSecuritySignal = /\b(pasport|polis|mahkamah|imigresen|jenayah|tahan|dakwa|saman|penjara|seksyen|warant|siasatan|serbuan|tangkapan|pdrm|kdn)\b/.test(text);
  const hasTechHardwareSignal = /\b(ai|robot|satelit|angkasa|perisian|cip|biometrik|kecerdasan buatan)\b/.test(text);
  const hasSportsSignal = /\b(atlet|pingat|kejohanan|perlawanan|piala|gol|sukan|badminton|bola sepak|olimpik|sukansea)\b/.test(text);

  let resolverTag = 'STANDARD_WEIGHTED_MATCH';
  let conflictNote = null;

  const topDesk = sortedDesks[0];

  // PEMBETULAN (2026-09-08, dapatan bug-hunt, corak SAMA renameActiveCategory/manualDesk/
  // targetDesksExcluded) — resolusi konflik domain di bawah ni dahulu memadan
  // `topDesk.deskName`/`d.deskName` terhadap NAMA desk yang dihardcode terus dalam kod
  // ('Sains & Teknologi', 'Ekonomi', 'Nasional', 'Semasa', 'Sukan'). `deskName` ialah lajur
  // BOLEH DIUBAH (adjung_desks, PUT /api/system/adjung-desks/:id) — apabila Ketua Editor
  // namakan-semula desk (cth "Ekonomi" -> "Ekonomi & Kewangan"), padanan string ni senyap
  // BERHENTI terpakai (tiada ralat), resolusi konflik domain (imigresen/keselamatan vs Sains
  // & Teknologi, sukan vs Ekonomi) terus tak aktif untuk kandungan seterusnya. Disahkan
  // reproduce: simulasi rename atas salinan DB scratch tunjuk resolverTag jatuh drpd
  // SPORTS_OVER_ECONOMY -> STANDARD_WEIGHTED_MATCH selepas nama sahaja ditukar, id kekal sama.
  // TIDAK macam manualDesk/targetDesksExcluded (lajur DATA, boleh dikemas kini via cascade),
  // ni ID dihardcode dalam KOD sumber itu sendiri, jadi pembetulan ialah padan `d.id` (lajur
  // adjung_desks yang TIDAK PERNAH berubah walau nama ditukar — cuma PUT deskName sahaja,
  // lihat slotRoutes.js) bukan `d.deskName`. ID sebenar (`desk-eko-2` dsb.) disahkan terus
  // drpd `adjung_desks` semasa siasatan ni.
  const ID_DESK_TEKNOLOGI = 'desk-tek-5'; // Sains & Teknologi
  const ID_DESK_NASIONAL = 'desk-nas-3';
  const ID_DESK_SEMASA = 'desk-sem-12';
  const ID_DESK_EKONOMI = 'desk-eko-2';
  const ID_DESK_SUKAN = 'desk-suk-11';

  if (topDesk && topDesk.id === ID_DESK_TEKNOLOGI) {
    if (hasLegalSecuritySignal && !hasTechHardwareSignal) {
      resolverTag = 'LEGAL_SECURITY_OVER_TECH';
      conflictNote = 'Isu imigresen/keselamatan/perundangan dikesan tanpa konteks khusus AI/biometrik. Konflik diselesaikan -> NASIONAL';

      topDesk.score -= 60;
      topDesk.negativeMatches.push('konflik: domain perundangan/keselamatan (-60)');

      const nasionalDesk = sortedDesks.find(d => d.id === ID_DESK_NASIONAL) || sortedDesks.find(d => d.id === ID_DESK_SEMASA);
      if (nasionalDesk) {
        nasionalDesk.score += 45;
        nasionalDesk.matchedKeywords.push('resolusi_konflik: domain perundangan/keselamatan (+45)');
      }
    } else if (hasLegalSecuritySignal && hasTechHardwareSignal) {
      resolverTag = 'TECH_BIOMETRIC_VALIDATED';
      conflictNote = 'Isu biometrik/AI pasport dikesan. Sah sebagai Sains & Teknologi.';
    }
  }

  // PEMBETULAN (2026-09-09, dapatan bug-hunt, sambungan corak #170) — blok konflik
  // teknologi-vs-perundangan di atas (85-102) memutasikan skor SECARA MENDALAM
  // (topDesk.score -= 60, nasionalDesk.score += 45) tetapi pemeriksaan blok kedua ni
  // dahulu terus baca `topDesk` (pembolehubah const yang ditetapkan SEKALI di baris 62,
  // SEBELUM mutasi blok pertama berlaku) tanpa disusun/diambil semula. Kesan: kalau desk
  // ASAL tertinggi ialah Sains & Teknologi (kena -60 sebab konflik perundangan/keselamatan),
  // dan penurunan tu menjadikan Ekonomi (yang tak pernah disentuh blok pertama) juara
  // SEBENAR yang baharu, blok Sukan-vs-Ekonomi di bawah ni tetap terlepas terus — ia masih
  // banding `topDesk.id` (rujukan STALE, masih Sains & Teknologi) === ID_DESK_EKONOMI, yang
  // sentiasa palsu. Konflik sukan-vs-ekonomi sebenar (kandungan ttg kejohanan SUKAN yang
  // skor Ekonomi-nya kini tertinggi selepas penalti tech) tak pernah diselesaikan walaupun
  // Ekonomi memang juara akhir. Disahkan reproduce: skrip simulasi (tech=70 kena -60 -> 10,
  // ekonomi=65 kekal, sukan=10 tanpa penalti) tunjuk resolverTag tersasar kekal
  // LEGAL_SECURITY_OVER_TECH walau juara skor akhir ialah Ekonomi dgn isyarat sukan wujud.
  // Pembetulan: ambil semula juara SEBENAR (susun ikut skor terkini) sebelum semak konflik
  // domain kedua, bukan guna rujukan `topDesk` yang ditetapkan sebelum mutasi blok pertama.
  sortedDesks.sort((a, b) => b.score - a.score);
  const topDeskSelepasKonflikPertama = sortedDesks[0];

  if (topDeskSelepasKonflikPertama && topDeskSelepasKonflikPertama.id === ID_DESK_EKONOMI) {
    const topDesk = topDeskSelepasKonflikPertama;
    if (hasSportsSignal && !/\b(saham|ringgit|inflasi|bank|cukai|pelaburan|bnm|kwsp|lhdn)\b/.test(text)) {
      resolverTag = 'SPORTS_OVER_ECONOMY';
      conflictNote = 'Konteks kejohanan/atlet dikesan. Konflik diselesaikan -> SUKAN';

      topDesk.score -= 30;
      const sukanDesk = sortedDesks.find(d => d.id === ID_DESK_SUKAN);
      if (sukanDesk) {
        sukanDesk.score += 40;
        sukanDesk.matchedKeywords.push('resolusi_konflik: sukan (+40)');
      }
    }
  }

  const reSorted = [...sortedDesks].sort((a, b) => b.score - a.score);

  return {
    resolvedDesks: reSorted,
    resolverTag,
    conflictNote
  };
}

export function calculateDeskScores(text, category, rules = [], desks = [], globalExclusions = []) {
  if (!text && !category) {
    return {
      winningDesk: 'BELUM DIKELASKAN',
      publicCategory: 'SEMASA',
      primaryDesk: 'BELUM DIKELASKAN',
      secondaryDesk: null,
      secondaryScore: 0,
      topScore: 0,
      runnerUpScore: 0,
      margin: 0,
      confidence: 'LOW',
      reason: 'Tiada teks kandungan untuk dianalisis.',
      resolver: 'NO_CONTENT',
      scores: [],
      explanation: 'Tiada teks kandungan untuk dianalisis.'
    };
  }

  const normalizedText = (text || '').toLowerCase();
  const normalizedCategory = (category || '').toLowerCase();

  // Pemanggil kadangkala hantar undefined/null (cth. tetapan pengelas belum dimuatkan lagi) —
  // tanpa pengawal ni, .filter() membaling TypeError dan mematikan seluruh laluan pengelasan.
  const safeRules = Array.isArray(rules) ? rules : [];
  const safeDesks = Array.isArray(desks) ? desks : [];
  const safeExclusions = Array.isArray(globalExclusions) ? globalExclusions : [];

  const deskMap = {};
  const activeDesks = safeDesks.filter(d => d.enabled !== 0);
  activeDesks.forEach(d => {
    deskMap[d.id] = {
      id: d.id,
      deskName: d.deskName,
      score: 0,
      matchedKeywords: [],
      negativeMatches: []
    };
  });

  const activeRules = safeRules.filter(r => r.enabled !== 0);

  for (const rule of activeRules) {
    // Pengawal deskId null/kosong (2026-09-12, dapatan bug-hunt, defence-in-depth di samping
    // gerbang PUT /api/system/rss-desk-rules/:id di slotRoutes.js) — `rule.deskId` boleh jadi
    // `null` pada baris rosak sedia ada (disimpan SEBELUM gerbang tu wujud). Tanpa semakan ni,
    // `rule.deskId.toLowerCase()` di bawah lontar TypeError tak ditangkap, menghentikan SELURUH
    // gelung pengelasan (calculateDeskScores dipanggil sekali per-item RSS) buat SEMUA item
    // seterusnya dalam larian yang sama — satu baris peraturan rosak lumpuhkan pengelasan Bidang
    // sepenuhnya secara senyap. Langkau peraturan tanpa deskId sah, teruskan yang lain.
    const deskIdBersih = (rule.deskId || '').toLowerCase();
    if (!deskIdBersih) continue;
    const targetDesk = deskMap[rule.deskId] || Object.values(deskMap).find(d => d.deskName.toLowerCase() === deskIdBersih);
    if (!targetDesk) continue;

    const kw = (rule.keyword || '').toLowerCase().trim();
    if (!kw) continue;

    // PEMBETULAN (2026-09-11, bug-hunt susulan) — `|| 15` gugurkan weight=0 tersimpan (nilai
    // SAH: peraturan padan kata kunci tapi sengaja sifar sumbangan skor) balik jadi 15 setiap
    // kali skor dikira, sama pepijat falsy-zero yang dibaiki di laluan CIPTA peraturan
    // (slotRoutes.js POST /rss-desk-rules). Guna semakan NaN eksplisit supaya 0 sah dikekalkan,
    // cuma nilai hilang/rosak (null/undefined/bukan nombor) jatuh balik ke lalai 15.
    const parsedWeight = Number(rule.weight);
    const weight = Number.isFinite(parsedWeight) ? parsedWeight : 15;
    const isNegative = rule.isNegative === 1;

    const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kwRegex = new RegExp(`\\b${escapedKw}\\b`, 'i');

    let textMatches = kwRegex.test(normalizedText) ? 1 : 0;
    let categoryMatches = kwRegex.test(normalizedCategory) ? 1 : 0;

    if (textMatches > 0 || categoryMatches > 0) {
      if (isNegative) {
        targetDesk.score -= 50;
        targetDesk.negativeMatches.push(`${kw} (-50)`);
      } else {
        const addedScore = Math.round((textMatches * weight * 1.5) + (categoryMatches * weight * 0.8));
        targetDesk.score += addedScore;
        targetDesk.matchedKeywords.push(`${kw} (+${addedScore})`);
      }
    }
  }

  const initialSorted = Object.values(deskMap).sort((a, b) => b.score - a.score);

  // Apply Global Conflict Rules & Context Resolver
  const { resolvedDesks, resolverTag, conflictNote } = resolveDeskConflict(initialSorted, normalizedText, safeExclusions);

  // Check minimum score threshold
  if (resolvedDesks.length === 0 || resolvedDesks[0].score < 20) {
    const topScorer = resolvedDesks[0];
    const topScore = topScorer ? Math.max(0, topScorer.score) : 0;
    return {
      winningDesk: 'BELUM DIKELASKAN',
      publicCategory: 'SEMASA', // Public presentation fallback
      primaryDesk: 'BELUM DIKELASKAN',
      secondaryDesk: null,
      secondaryScore: 0,
      topScore,
      runnerUpScore: resolvedDesks[1] ? Math.max(0, resolvedDesks[1].score) : 0,
      margin: 0,
      confidence: 'LOW',
      reason: topScorer ? `Skor tertinggi (${topScorer.deskName}: ${topScore}) di bawah ambang minimum 20.` : 'Tiada desk melepasi markah minimum.',
      resolver: resolverTag,
      scores: resolvedDesks.map(d => ({
        desk: d.deskName,
        score: Math.max(0, d.score),
        matches: d.matchedKeywords,
        penalties: d.negativeMatches
      })),
      explanation: `Dikelaskan sebagai BELUM DIKELASKAN (Paparan Awam: SEMASA, Skor: ${topScore}/100)`
    };
  }

  const topDesk = resolvedDesks[0];
  const secondDesk = resolvedDesks[1];
  const topScore = Math.max(0, topDesk.score);
  const runnerUpScore = secondDesk ? Math.max(0, secondDesk.score) : 0;
  const margin = topScore - runnerUpScore;

  // Secondary Desk Storage if runner-up passes threshold 35
  const secondaryDesk = (secondDesk && runnerUpScore >= 35) ? secondDesk.deskName : null;
  const secondaryScore = (secondDesk && runnerUpScore >= 35) ? runnerUpScore : 0;

  let confidence = 'LOW';
  if (topScore >= 60 && margin >= 20) {
    confidence = 'HIGH';
  } else if (topScore >= 35 && margin >= 10) {
    confidence = 'MEDIUM';
  }

  const positiveStr = topDesk.matchedKeywords.length > 0 ? `+Padanan: ${topDesk.matchedKeywords.join(', ')}` : 'Tiada padanan positif terus';
  const negativeStr = topDesk.negativeMatches.length > 0 ? ` | Penalti: ${topDesk.negativeMatches.join(', ')}` : '';
  const conflictStr = conflictNote ? ` | Resolusi Konflik: ${conflictNote}` : '';
  const runnerUpStr = secondaryDesk ? ` (Desk Kedua: ${secondaryDesk} - ${secondaryScore})` : '';

  const explanation = `${topDesk.deskName} (Skor: ${topScore}, Margin: +${margin}, Keyakinan: ${confidence})${runnerUpStr}. ${positiveStr}${negativeStr}${conflictStr}`;

  return {
    winningDesk: topDesk.deskName,
    publicCategory: topDesk.deskName, // For public frontpage ticker
    primaryDesk: topDesk.deskName,
    secondaryDesk,
    secondaryScore,
    topScore,
    runnerUpScore,
    margin,
    confidence,
    reason: explanation,
    resolver: resolverTag,
    scores: resolvedDesks.map(d => ({
      desk: d.deskName,
      score: Math.max(0, d.score),
      matches: d.matchedKeywords,
      penalties: d.negativeMatches
    })),
    explanation
  };
}

export function classifyDesk(item, rules = [], desks = [], globalExclusions = []) {
  const combinedText = `${item.title || ''} ${item.formattedBrief || item.description || ''}`;
  const rawCategory = item.category || '';
  return calculateDeskScores(combinedText, rawCategory, rules, desks, globalExclusions);
}
