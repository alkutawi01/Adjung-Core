import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeHtmlEntities,
  stripLocationDateline,
  getApplicableRules,
  processTextWithTrace,
  normalizeEditorialText
} from '../core/sources/EditorialTextNormalizer.js';

test('EditorialTextNormalizer - decodeHtmlEntities handles decimal & hex numeric entities', () => {
  const input = "&#039;Anak guam saya &#039;tak sihat&#039;&#039; &amp; &#8211; Peguam";
  const output = decodeHtmlEntities(input);
  assert.equal(output, "'Anak guam saya 'tak sihat'' & – Peguam");
});

test('EditorialTextNormalizer - stripLocationDateline removes Malaysian city datelines', () => {
  const input1 = "PETALING JAYA – Seorang wanita hamil terpaksa berdiri lama";
  const input2 = "KUALA LUMPUR, 22 Julai – Kedudukan fiskal negara kekal";
  
  assert.equal(stripLocationDateline(input1), "Seorang wanita hamil terpaksa berdiri lama");
  assert.equal(stripLocationDateline(input2), "Kedudukan fiskal negara kekal");
});

test('EditorialTextNormalizer - getApplicableRules respects scope and sourceId filtering', () => {
  const rules = [
    { id: 'r1', ruleName: 'Rule 1', enabled: 1, scope: 'brief', sourceId: null, orderIndex: 1 },
    { id: 'r2', ruleName: 'Rule 2', enabled: 1, scope: 'title', sourceId: null, orderIndex: 2 },
    { id: 'r3', ruleName: 'Rule 3', enabled: 1, scope: 'all', sourceId: 'src_bernama_01', orderIndex: 3 },
    { id: 'r4', ruleName: 'Rule 4', enabled: 0, scope: 'brief', sourceId: null, orderIndex: 4 } // disabled
  ];

  const applicableForBriefGlobal = getApplicableRules(rules, 'brief', 'src_other_02');
  assert.equal(applicableForBriefGlobal.length, 1);
  assert.equal(applicableForBriefGlobal[0].id, 'r1');

  const applicableForBernama = getApplicableRules(rules, 'brief', 'src_bernama_01');
  assert.equal(applicableForBernama.length, 2); // r1 & r3
  assert.equal(applicableForBernama[0].id, 'r1');
  assert.equal(applicableForBernama[1].id, 'r3');
});

test('EditorialTextNormalizer - processTextWithTrace records step-by-step transformation trace', () => {
  const rules = [
    { id: 'r1', ruleName: 'Decode HTML Entities', ruleType: 'decode_entities', scope: 'all', enabled: 1, orderIndex: 1 },
    { id: 'r2', ruleName: 'Strip Dateline', ruleType: 'strip_dateline', scope: 'brief', enabled: 1, orderIndex: 2 },
    { id: 'r3', ruleName: 'Custom Substitute', ruleType: 'substitute', pattern: 'wanita', replacement: 'pengguna', scope: 'brief', enabled: 1, orderIndex: 3 }
  ];

  const rawInput = "PETALING JAYA &#8211; Seorang wanita hamil terpaksa berdiri lama";
  const result = processTextWithTrace(rawInput, 'brief', null, rules);

  assert.equal(result.cleanedText, "Seorang pengguna hamil terpaksa berdiri lama");
  assert.equal(result.trace.length, 3);
  assert.equal(result.trace[0].ruleName, 'Decode HTML Entities');
  assert.equal(result.trace[1].ruleName, 'Strip Dateline');
  assert.equal(result.trace[2].ruleName, 'Custom Substitute');
});
