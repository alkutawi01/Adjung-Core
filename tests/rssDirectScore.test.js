import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRssXml, filterByLanguage, deduplicateRssItems, formatRssBrief } from '../core/sources/RssDirectEngine.js';
import { calculateEditorialScore } from '../core/sources/EditorialScoreEngine.js';

test('RssDirectEngine - parseRssXml extracts items and links from XML feed', () => {
  const sampleXml = `
    <rss version="2.0">
      <channel>
        <title>Berita Malaysia</title>
        <item>
          <title>Pos Malaysia laksana pelan transformasi baharu</title>
          <description>KUALA LUMPUR - Langkah mengurangkan kerugian syarikat logistik tempatan melalui pelan strategi komprehensif tahun ini.</description>
          <link>https://www.bernama.com/bm/news.php?id=21001</link>
          <guid>https://www.bernama.com/bm/news.php?id=21001</guid>
          <category>EKONOMI</category>
          <pubDate>Wed, 22 Jul 2026 10:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>
  `;

  const items = parseRssXml(sampleXml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Pos Malaysia laksana pelan transformasi baharu');
  assert.equal(items[0].link, 'https://www.bernama.com/bm/news.php?id=21001');
  assert.equal(items[0].category, 'EKONOMI');
  assert.ok(items[0].formattedBrief.includes('Langkah mengurangkan kerugian'));
  assert.equal(items[0].formattedBrief.includes('KUALA LUMPUR -'), false);
});

test('RssDirectEngine - formatRssBrief removes datelines, extracts 1 sentence, enforces bounds, no ellipsis', () => {
  const rawText = 'PUTRAJAYA: Kerajaan meluluskan pelan bantuan kewangan baharu untuk sektor pendidikan negara. Bantuan ini diagihkan mulai bulan hadapan kepada sekolah terpilih...';
  const formatted = formatRssBrief(rawText);

  assert.equal(formatted.startsWith('PUTRAJAYA:'), false);
  assert.equal(formatted.includes('...'), false);
  assert.ok(formatted.length >= 80 && formatted.length <= 240);
});

test('RssDirectEngine - deduplicateRssItems eliminates duplicate guids', () => {
  const rawItems = [
    { title: 'Berita A', rssGuid: 'guid-1', link: 'http://a.com' },
    { title: 'Berita A Duplicate', rssGuid: 'guid-1', link: 'http://a.com' },
    { title: 'Berita B', rssGuid: 'guid-2', link: 'http://b.com' }
  ];

  const clean = deduplicateRssItems(rawItems);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].rssGuid, 'guid-1');
  assert.equal(clean[1].rssGuid, 'guid-2');
});

test('RssDirectEngine - filterByLanguage checks ms-MY language suitability', () => {
  const malayItem = { title: 'Kerajaan mengumumkan bantuan persekolahan untuk murid', description: 'Bantuan ini diagihkan di sekolah.' };
  assert.equal(filterByLanguage(malayItem, 'ms-MY'), true);
});

test('EditorialScoreEngine - calculates AUTO_LIVE decision and scoreBreakdown for high trust sources (Score >= 90)', () => {
  const highTrustSource = { sourceName: 'Bernama', trustScore: 95, categoryMapping: 'EKONOMI', language: 'ms-MY' };
  const item = { title: 'Pos Malaysia laksana pelan transformasi baharu bagi kewangan', category: 'EKONOMI' };
  const settings = { autoLiveThreshold: 80, reviewThreshold: 60, priorityKeywords: 'transformasi, dasar', blockedKeywords: 'gempar, viral' };

  const evalResult = calculateEditorialScore(item, highTrustSource, settings);
  assert.ok(evalResult.score >= 80);
  assert.equal(evalResult.decision, 'AUTO_LIVE');
  assert.equal(evalResult.status, 'approved');
  assert.ok(evalResult.scoreBreakdown.sourceTrust > 0);
  assert.equal(typeof evalResult.scoreBreakdown.keywordImpact, 'number');
});

test('EditorialScoreEngine - calculates EDITOR_REVIEW decision for medium trust sources (Score 60-79)', () => {
  const mediumTrustSource = { sourceName: 'Portal Tempatan', trustScore: 65 };
  const item = { title: 'Persidangan kebudayaan akan berlangsung di Kota Bharu' };
  const settings = { autoLiveThreshold: 80, reviewThreshold: 60, priorityKeywords: 'dasar', blockedKeywords: 'gempar' };

  const evalResult = calculateEditorialScore(item, mediumTrustSource, settings);
  assert.ok(evalResult.score >= 60 && evalResult.score < 80);
  assert.equal(evalResult.decision, 'EDITOR_REVIEW');
  assert.equal(evalResult.status, 'pending');
});

test('EditorialScoreEngine - rejects sensational clickbait content (Score < 60)', () => {
  const source = { sourceName: 'Portal Rumor', trustScore: 75 };
  const sensationalItem = { title: 'GEMPAR! Tak sangka perkara ini berlaku di majlis!' };
  const settings = { autoLiveThreshold: 80, reviewThreshold: 60, priorityKeywords: 'dasar', blockedKeywords: 'gempar, viral', blockedPenalty: 40 };

  const evalResult = calculateEditorialScore(sensationalItem, source, settings);
  assert.ok(evalResult.score < 60);
  assert.equal(evalResult.decision, 'BLOCKED_KEYWORD');
  assert.equal(evalResult.status, 'rejected');
});
