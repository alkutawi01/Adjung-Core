// EditorialScoreEngine.js - Evaluates RSS news items dynamically using Editor-configured settings.
// All thresholds, keyword lists, bonuses, penalties, and trust scores are 100% dynamic.

export function calculateEditorialScore(item, sourceConfig = {}, editorialSettings = {}) {
  const sourceTrust = typeof sourceConfig.trustScore === 'number' ? sourceConfig.trustScore : 90;
  const autoLiveThreshold = Number(editorialSettings.autoLiveThreshold) || 80;
  const reviewThreshold = Number(editorialSettings.reviewThreshold) || 60;
  const priorityBonus = Number(editorialSettings.priorityBonus) || 15;
  const blockedPenalty = Number(editorialSettings.blockedPenalty) || 40;

  const priorityKwList = (editorialSettings.priorityKeywords || '')
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);

  const blockedKwList = (editorialSettings.blockedKeywords || '')
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);

  const title = (item.title || '').trim();
  const textLower = `${title} ${item.description || ''}`.toLowerCase();

  let languageMatch = 10;
  let categoryMatch = 0;

  if (sourceConfig.categoryMapping && item.category) {
    if (item.category.toLowerCase().includes(sourceConfig.categoryMapping.toLowerCase())) {
      categoryMatch = 10;
    }
  }

  let keywordImpact = 0;
  let containsSensational = false;

  // Apply Editor-configured blocked keywords (HARD-BLOCK)
  for (const kw of blockedKwList) {
    if (textLower.includes(kw)) {
      containsSensational = true;
      keywordImpact = -100;
      break;
    }
  }

  // Apply Editor-configured priority keywords if no blocked keywords matched
  if (!containsSensational) {
    for (const kw of priorityKwList) {
      if (textLower.includes(kw)) {
        keywordImpact += priorityBonus;
        break;
      }
    }
  }

  const duplicatePenalty = 0;
  let totalScore = containsSensational ? 0 : (sourceTrust + languageMatch + categoryMatch + keywordImpact + duplicatePenalty);
  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

  // Dynamic Decision Tree configured by Editor
  let decision = 'AUTO_LIVE';
  let status = 'approved';

  if (containsSensational || totalScore === 0) {
    decision = 'BLOCKED_KEYWORD';
    status = 'rejected';
  } else if (totalScore >= autoLiveThreshold) {
    decision = 'AUTO_LIVE';
    status = 'approved';
  } else if (totalScore >= reviewThreshold) {
    decision = 'EDITOR_REVIEW';
    status = 'pending';
  } else {
    decision = 'REJECT';
    status = 'rejected';
  }

  // tickerTitleMinChars (2026-08-16, permintaan Izzat — "ticker ada yg terlalu pendek sampai
  // taktau konteks"). Ticker papar TAJUK sahaja (bukan huraian) semasa bergulir — turunkan
  // item yg tajuknya terlalu ringkas drpd AUTO_LIVE ke EDITOR_REVIEW (bukan REJECT terus: tajuk
  // pendek tak semestinya kandungan buruk, Ketua Editor/Penolong yg patut nilai, bukan sistem
  // buang senyap). Cuma terpakai bila item SEPATUTNYA lulus auto-live — item yg dah gagal
  // ambang skor terus (REJECT/BLOCKED) tak diubah, tiada sebab "naikkan" status kandungan yg
  // dah gagal atas sebab lain.
  const tickerTitleMinChars = Number(editorialSettings.tickerTitleMinChars) || 0;
  if (decision === 'AUTO_LIVE' && tickerTitleMinChars > 0 && title.length < tickerTitleMinChars) {
    decision = 'TITLE_TOO_SHORT';
    status = 'pending';
  }

  const scoreBreakdown = {
    sourceTrust,
    languageMatch,
    categoryMatch,
    keywordImpact,
    duplicatePenalty,
    totalScore,
    autoLiveThreshold,
    reviewThreshold
  };

  return {
    score: totalScore,
    scoreBreakdown,
    decision,
    status,
    containsSensational
  };
}
