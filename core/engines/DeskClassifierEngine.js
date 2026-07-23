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

  // 2. Domain Signal Resolution
  const hasLegalSecuritySignal = /\b(pasport|polis|mahkamah|imigresen|jenayah|tahan|dakwa|saman|penjara|seksyen|warant|siasatan|serbuan|tangkapan|pdrm|kdn)\b/.test(text);
  const hasTechHardwareSignal = /\b(ai|robot|satelit|angkasa|perisian|cip|biometrik|kecerdasan buatan)\b/.test(text);
  const hasSportsSignal = /\b(atlet|pingat|kejohanan|perlawanan|piala|gol|sukan|badminton|bola sepak|olimpik|sukansea)\b/.test(text);

  let resolverTag = 'STANDARD_WEIGHTED_MATCH';
  let conflictNote = null;

  const topDesk = sortedDesks[0];

  if (topDesk && (topDesk.deskName === 'Sains & Teknologi' || topDesk.deskName === 'Teknologi')) {
    if (hasLegalSecuritySignal && !hasTechHardwareSignal) {
      resolverTag = 'LEGAL_SECURITY_OVER_TECH';
      conflictNote = 'Isu imigresen/keselamatan/perundangan dikesan tanpa konteks khusus AI/biometrik. Konflik diselesaikan -> NASIONAL';

      topDesk.score -= 60;
      topDesk.negativeMatches.push('konflik: domain perundangan/keselamatan (-60)');

      const nasionalDesk = sortedDesks.find(d => d.deskName === 'Nasional') || sortedDesks.find(d => d.deskName === 'Semasa');
      if (nasionalDesk) {
        nasionalDesk.score += 45;
        nasionalDesk.matchedKeywords.push('resolusi_konflik: domain perundangan/keselamatan (+45)');
      }
    } else if (hasLegalSecuritySignal && hasTechHardwareSignal) {
      resolverTag = 'TECH_BIOMETRIC_VALIDATED';
      conflictNote = 'Isu biometrik/AI pasport dikesan. Sah sebagai Sains & Teknologi.';
    }
  }

  if (topDesk && topDesk.deskName === 'Ekonomi') {
    if (hasSportsSignal && !/\b(saham|ringgit|inflasi|bank|cukai|pelaburan|bnm|kwsp|lhdn)\b/.test(text)) {
      resolverTag = 'SPORTS_OVER_ECONOMY';
      conflictNote = 'Konteks kejohanan/atlet dikesan. Konflik diselesaikan -> SUKAN';

      topDesk.score -= 30;
      const sukanDesk = sortedDesks.find(d => d.deskName === 'Sukan');
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

  const deskMap = {};
  const activeDesks = desks.filter(d => d.enabled !== 0);
  activeDesks.forEach(d => {
    deskMap[d.id] = {
      id: d.id,
      deskName: d.deskName,
      score: 0,
      matchedKeywords: [],
      negativeMatches: []
    };
  });

  const activeRules = rules.filter(r => r.enabled !== 0);

  for (const rule of activeRules) {
    const targetDesk = deskMap[rule.deskId] || Object.values(deskMap).find(d => d.deskName.toLowerCase() === rule.deskId.toLowerCase());
    if (!targetDesk) continue;

    const kw = (rule.keyword || '').toLowerCase().trim();
    if (!kw) continue;

    const weight = Number(rule.weight) || 15;
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
  const { resolvedDesks, resolverTag, conflictNote } = resolveDeskConflict(initialSorted, normalizedText, globalExclusions);

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
      reason: topScorer ? `Skor tertinggi (${topScorer.deskName}: ${topScore}) di bawah ambang minima 20.` : 'Tiada desk melepasi markah minimum.',
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
