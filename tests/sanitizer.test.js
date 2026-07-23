import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHtmlText, truncateWords } from '../core/sources/SourceSanitizer.js';

test('SourceSanitizer - sanitizeHtmlText removes HTML tags and decodes entities', () => {
  const raw = '<p>Berita <strong>utama</strong> &amp; laporan khas &nbsp; hari ini.</p>';
  const clean = sanitizeHtmlText(raw);
  assert.equal(clean, 'Berita utama & laporan khas hari ini.');
});

test('SourceSanitizer - sanitizeHtmlText handles null and empty input', () => {
  assert.equal(sanitizeHtmlText(null), '');
  assert.equal(sanitizeHtmlText(undefined), '');
  assert.equal(sanitizeHtmlText('   '), '');
});

test('SourceSanitizer - truncateWords truncates text correctly', () => {
  const longText = 'satu dua tiga empat lima enam tujuh delapan sembilan sepuluh';
  const truncated = truncateWords(longText, 5);
  assert.equal(truncated, 'satu dua tiga empat lima...');
});
