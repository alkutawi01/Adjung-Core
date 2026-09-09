import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRssXml, escapeXml, toRfc822 } from '../core/routes/rssFeedRoutes.js';

test('buildRssXml - produces a valid RSS 2.0 channel with items', () => {
  const xml = buildRssXml([
    { id: 'obj-1', slotIndex: 0, title: 'Tajuk Ujian', summary: 'Huraian ujian', createdAt: '2026-08-01T10:00:00.000Z' }
  ], { siteUrl: 'https://example.com' });

  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(xml, /<rss version="2.0">/);
  assert.match(xml, /<channel>/);
  assert.match(xml, /<title>Tajuk Ujian<\/title>/);
  assert.match(xml, /<description>Huraian ujian<\/description>/);
  assert.match(xml, /<link>https:\/\/example\.com\/\?slot=0&amp;item=obj-1<\/link>/);
  assert.match(xml, /<guid isPermaLink="false">adjung-obj-1<\/guid>/);
  assert.match(xml, /<pubDate>/);
});

test('buildRssXml - handles empty item list', () => {
  const xml = buildRssXml([], { siteUrl: 'https://example.com' });
  assert.match(xml, /<channel>[\s\S]*<\/channel>/);
  assert.doesNotMatch(xml, /<item>/);
});

test('buildRssXml - escapes special characters in real editorial content', () => {
  const xml = buildRssXml([
    { id: 'obj-2', slotIndex: 1, title: 'Untung & Rugi <Analisis>', summary: 'Dia kata "hebat" & \'ringkas\'', createdAt: '2026-08-01T10:00:00.000Z' }
  ], { siteUrl: 'https://example.com' });

  assert.match(xml, /<title>Untung &amp; Rugi &lt;Analisis&gt;<\/title>/);
  assert.match(xml, /<description>Dia kata &quot;hebat&quot; &amp; &apos;ringkas&apos;<\/description>/);
  // No raw unescaped angle brackets should leak into text nodes.
  assert.doesNotMatch(xml, /<title>[^<]*<Analisis>/);
});

test('buildRssXml - strips markdown syntax from title/summary before publishing', () => {
  const xml = buildRssXml([
    {
      id: 'obj-3',
      slotIndex: 2,
      title: 'Instagram perkenal *logo* baharu',
      summary: 'Instagram memperkenalkan *wordmark* baharu. [Lihat](gloss:123) juga contoh **penuh**.',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  ], { siteUrl: 'https://example.com' });

  assert.match(xml, /<title>Instagram perkenal logo baharu<\/title>/);
  assert.match(xml, /<description>Instagram memperkenalkan wordmark baharu\. Lihat juga contoh penuh\.<\/description>/);
  assert.doesNotMatch(xml, /\*/);
  assert.doesNotMatch(xml, /gloss:/);
});

test('escapeXml - escapes XML special characters', () => {
  assert.equal(escapeXml('a & b < c > d "e" \'f\''), 'a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;');
});

test('escapeXml - handles undefined/null gracefully', () => {
  assert.equal(escapeXml(undefined), '');
  assert.equal(escapeXml(null), '');
});

test('escapeXml - strips illegal XML control characters (bukan cuma escape entiti)', () => {
  // XML 1.0 (production Char) HANYA benarkan tab/LF/CR di bawah 0x20 — aksara kawalan lain
  // (cth vertical tab \x0B, sering terbawa masuk semasa salin-tampal daripada PDF/Word) TAK SAH
  // walau selepas escape &/</>/"/'. Dahulu escapeXml() tak buang aksara ni, jadi satu kandungan
  // approved dgn aksara kawalan rosakkan SELURUH suapan /rss.xml (bukan cuma satu item) untuk
  // pembaca RSS/agregator ketat.
  assert.equal(escapeXml('a\x0Bb\x00c\x1Fd'), 'abcd');
  // Tab/LF/CR (aksara kawalan SAH dlm XML) mesti KEKAL, bukan turut terbuang.
  assert.equal(escapeXml('a\tb\nc\rd'), 'a\tb\nc\rd');
});

test('buildRssXml - kandungan dgn aksara kawalan tak sah tidak merosakkan SELURUH suapan XML', () => {
  const xml = buildRssXml([
    { id: 'obj-4', slotIndex: 0, title: 'Tajuk ada aksara\x0Brosak', summary: 'Huraian biasa', createdAt: '2026-08-01T10:00:00.000Z' },
  ], { siteUrl: 'https://example.com' });
  assert.doesNotMatch(xml, /[\x00-\x08\x0B\x0C\x0E-\x1F]/);
});

test('toRfc822 - produces a valid RFC 822 date string', () => {
  const s = toRfc822('2026-08-01T10:00:00.000Z');
  assert.ok(!Number.isNaN(new Date(s).getTime()));
});

test('toRfc822 - falls back to current time for invalid input', () => {
  const s = toRfc822('not-a-date');
  assert.ok(!Number.isNaN(new Date(s).getTime()));
});
