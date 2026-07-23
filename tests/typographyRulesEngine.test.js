import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTypographyTokens } from '../core/sources/TypographyRulesEngine.js';

test('TypographyRulesEngine - formats "40 scammer kena serbu" with scammer as italic', () => {
  const rules = [
    { id: 't1', term: 'scammer', style: 'italic', priority: 50, enabled: 1, status: 'active' }
  ];

  const text = 'Banglo tiga tingkat jadi markas 40 scammer kena serbu';
  const tokens = parseTypographyTokens(text, rules, 'all', 'ms-MY');

  assert.equal(tokens.length, 3);
  assert.equal(tokens[0].text, 'Banglo tiga tingkat jadi markas 40 ');
  assert.equal(tokens[0].style, 'normal');
  assert.equal(tokens[1].text, 'scammer');
  assert.equal(tokens[1].style, 'italic');
  assert.equal(tokens[2].text, ' kena serbu');
  assert.equal(tokens[2].style, 'normal');
});

test('TypographyRulesEngine - does not italicize common Malay words like "digital"', () => {
  const rules = [
    { id: 't1', term: 'scammer', style: 'italic', priority: 50, enabled: 1, status: 'active' }
  ];

  const text = 'Sistem digital baharu';
  const tokens = parseTypographyTokens(text, rules, 'all', 'ms-MY');

  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].text, 'Sistem digital baharu');
  assert.equal(tokens[0].style, 'normal');
});

test('TypographyRulesEngine - handles repeated terms without double-wrapping', () => {
  const rules = [
    { id: 't1', term: 'scammer', style: 'italic', priority: 50, enabled: 1, status: 'active' }
  ];

  const text = 'Scammer scammer ditangkap';
  const tokens = parseTypographyTokens(text, rules, 'all', 'ms-MY');

  const italicTokens = tokens.filter(t => t.style === 'italic');
  assert.equal(italicTokens.length, 2);
  assert.equal(italicTokens[0].text.toLowerCase(), 'scammer');
  assert.equal(italicTokens[1].text.toLowerCase(), 'scammer');
});

test('TypographyRulesEngine - prioritizes higher priority and longer phrase matches', () => {
  const rules = [
    { id: 't1', term: 'startup', style: 'italic', priority: 50, enabled: 1, status: 'active' },
    { id: 't2', term: 'Startup Malaysia', style: 'small_caps', priority: 100, enabled: 1, status: 'active' }
  ];

  const text = 'Inisiatif Startup Malaysia menyokong sektor startup tempatan';
  const tokens = parseTypographyTokens(text, rules, 'all', 'ms-MY');

  assert.equal(tokens[1].text, 'Startup Malaysia');
  assert.equal(tokens[1].style, 'small_caps');
  assert.equal(tokens[3].text, 'startup');
  assert.equal(tokens[3].style, 'italic');
});

test('TypographyRulesEngine - ignores rules with status = "pending" or enabled = 0', () => {
  const rules = [
    { id: 't1', term: 'freelancer', style: 'italic', priority: 50, enabled: 0, status: 'pending' }
  ];

  const text = 'Kerjaya freelancer semakin popular';
  const tokens = parseTypographyTokens(text, rules, 'all', 'ms-MY');

  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].style, 'normal');
});

test('TypographyRulesEngine - respects excludeTerms', () => {
  const rules = [
    { id: 't1', term: 'startup', style: 'italic', priority: 50, enabled: 1, status: 'active', excludeTerms: JSON.stringify(['Startup Studio']) }
  ];

  const text = 'Syarikat Startup Studio menganjurkan bengkel';
  const tokens = parseTypographyTokens(text, rules, 'all', 'ms-MY');

  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].style, 'normal');
});
