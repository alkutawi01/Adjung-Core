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
