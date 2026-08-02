import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRssXml, filterByLanguage, deduplicateRssItems, formatRssBrief, formatRssBriefWithMeta } from '../core/sources/RssDirectEngine.js';
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
  assert.match(items[0].formattedBrief, /^Langkah mengurangkan kerugian/);
  assert.equal(items[0].formattedBrief.includes('KUALA LUMPUR -'), false);
});

test('RssDirectEngine - formatRssBrief removes datelines, extracts 1 sentence, enforces bounds, no ellipsis', () => {
  const rawText = 'PUTRAJAYA: Kerajaan meluluskan pelan bantuan kewangan baharu untuk sektor pendidikan negara. Bantuan ini diagihkan mulai bulan hadapan kepada sekolah terpilih...';
  const formatted = formatRssBrief(rawText);

  assert.equal(formatted.startsWith('PUTRAJAYA:'), false);
  assert.equal(formatted.includes('...'), false);
  assert.ok(formatted.length >= 80 && formatted.length <= 240);
});

test('RssDirectEngine - formatRssBriefWithMeta reports truncated:true only when text actually exceeds 220 chars (Fasa 8, limpahan teks)', () => {
  const shortText = 'Kerajaan negeri sasar tarik 2 juta pelawat menjelang 2028.';
  const shortResult = formatRssBriefWithMeta(shortText);
  assert.equal(shortResult.truncated, false);
  assert.equal(shortResult.text, shortText);

  const longText = 'Kerajaan negeri sasar tarik 2 juta pelawat menjelang 2028 menerusi laluan warisan Islam merangkumi Kota Bharu, Pasir Mas dan Tumpat. Kerajaan negeri turut merancang pelbagai inisiatif tambahan bagi memastikan pelancongan mampan dan mesra alam sekitar demi generasi akan datang.';
  const longResult = formatRssBriefWithMeta(longText);
  assert.equal(longResult.truncated, true);
  assert.ok(longResult.text.endsWith('...'));
  assert.ok(longResult.text.length <= 224);

  // formatRssBrief() (bungkusan lama, string sahaja) mesti pulangkan teks SAMA seperti .text
  assert.equal(formatRssBrief(longText), longResult.text);
});

test('RssDirectEngine - parseRssXml stamps briefTruncated per item (Fasa 8)', () => {
  const longDescription = 'Kerajaan negeri sasar tarik 2 juta pelawat menjelang 2028 menerusi laluan warisan Islam merangkumi Kota Bharu, Pasir Mas dan Tumpat. Kerajaan negeri turut merancang pelbagai inisiatif tambahan bagi memastikan pelancongan mampan dan mesra alam sekitar demi generasi akan datang.';
  const xml = `
    <rss version="2.0">
      <channel>
        <item>
          <title>Kelantan lancar pelan pelancongan</title>
          <description>${longDescription}</description>
          <link>https://example.com/berita/1</link>
        </item>
      </channel>
    </rss>
  `;
  const items = parseRssXml(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].briefTruncated, true);
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
  // 2026-08-02 (Fasa 2) — EditorialScoreEngine sengaja pulangkan decision khusus
  // 'BLOCKED_KEYWORD' (bukan 'REJECT' generik) apabila kata kunci disekat ditemui, supaya
  // sebab penolakan boleh dibezakan daripada skor rendah biasa. Ujian ni ketinggalan zaman
  // (nama decision bertukar, tingkah laku sebenar betul) — lihat EditorialScoreEngine.js.
  assert.equal(evalResult.decision, 'BLOCKED_KEYWORD');
  assert.equal(evalResult.status, 'rejected');
});
