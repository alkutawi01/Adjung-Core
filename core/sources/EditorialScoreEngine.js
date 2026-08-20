// EditorialScoreEngine.js - Evaluates RSS news items dynamically using Editor-configured settings.
// All thresholds, keyword lists, bonuses, penalties, and trust scores are 100% dynamic.

// tentukanKeputusanSkor() (2026-08-20, susulan laporan Izzat "GAGAL" — tetapan Editorial
// dinaikkan/diturunkan di Editorium tapi backlog RSS sedia ada tak berubah langsung) — pokok
// keputusan (skor -> AUTO_LIVE/EDITOR_REVIEW/REJECT, + penurunan had aksara tajuk) diasingkan
// daripada calculateEditorialScore() supaya boleh dipanggil semula pada BARIS SEDIA ADA dalam
// rss_ticker_items (yang skornya sudah dikira & tersimpan), bukan hanya pada item RSS baharu.
// Jangan tulis semula pokok keputusan ni di tempat lain — import terus fungsi ni (corak sama
// GeometryConfig.js/ContentBudget.js, CLAUDE.md).
export function tentukanKeputusanSkor(totalScore, containsSensational, titleLength, editorialSettings = {}) {
  const autoLiveThreshold = Number(editorialSettings.autoLiveThreshold) || 80;
  const reviewThreshold = Number(editorialSettings.reviewThreshold) || 60;
  const tickerTitleMinChars = Number(editorialSettings.tickerTitleMinChars) || 0;

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
  if (decision === 'AUTO_LIVE' && tickerTitleMinChars > 0 && titleLength < tickerTitleMinChars) {
    decision = 'TITLE_TOO_SHORT';
    status = 'pending';
  }

  return { decision, status, autoLiveThreshold, reviewThreshold };
}

export function calculateEditorialScore(item, sourceConfig = {}, editorialSettings = {}) {
  const sourceTrust = typeof sourceConfig.trustScore === 'number' ? sourceConfig.trustScore : 90;
  const priorityBonus = Number(editorialSettings.priorityBonus) || 15;
  // `blockedPenalty` SENGAJA tidak dibaca di sini (2026-08-20, dapatan audit) — ia dahulu
  // dibaca ke dalam pemboleh ubah tempatan yang tidak pernah digunakan walau sekali, memberi
  // gambaran palsu bahawa ia mengawal sesuatu. Sekatan kata kunci ialah sekatan MUTLAK
  // (`totalScore` dipaksa 0 di bawah), bukan tolakan mata; ruang tetapannya di Editorium sudah
  // digantikan penjelasan dasar. Lajur DB dikekalkan supaya tetapan lama tidak gagal dimuat.

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

  // Dynamic Decision Tree configured by Editor — lihat tentukanKeputusanSkor() di atas fail ni.
  const { decision, status, autoLiveThreshold, reviewThreshold } = tentukanKeputusanSkor(
    totalScore, containsSensational, title.length, editorialSettings
  );

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
