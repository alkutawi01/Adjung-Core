import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSitemapXml, escapeXml } from '../core/routes/sitemapRoutes.js';

test('buildSitemapXml - produces valid urlset with a single homepage entry', () => {
  const xml = buildSitemapXml([{ loc: 'https://example.com/', changefreq: 'hourly', priority: '1.0' }]);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(xml, /<changefreq>hourly<\/changefreq>/);
  assert.match(xml, /<priority>1\.0<\/priority>/);
});

test('buildSitemapXml - handles empty list', () => {
  const xml = buildSitemapXml([]);
  assert.match(xml, /<urlset[^>]*>\s*<\/urlset>/);
});

test('buildSitemapXml - omits optional fields when absent', () => {
  const xml = buildSitemapXml([{ loc: 'https://example.com/' }]);
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.doesNotMatch(xml, /<changefreq>/);
  assert.doesNotMatch(xml, /<priority>/);
});

test('escapeXml - escapes XML special characters', () => {
  assert.equal(escapeXml('a & b < c > d "e" \'f\''), 'a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;');
});

test('escapeXml - handles undefined/null gracefully', () => {
  assert.equal(escapeXml(undefined), '');
  assert.equal(escapeXml(null), '');
});
