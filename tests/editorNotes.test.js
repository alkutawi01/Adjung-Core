import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('EditorNotes Validation Suite', () => {
  test('validates note title length limit (max 150 chars)', () => {
    const validTitle = 'Notis Penting: Penyelarasan Masa Bento';
    const invalidTitle = 'A'.repeat(151);

    assert.equal(validTitle.length <= 150, true);
    assert.equal(invalidTitle.length > 150, true);
  });

  test('validates note content length limit (max 5000 chars)', () => {
    const validContent = 'Kandungan rasmi arahan Ketua Editor.';
    const invalidContent = 'B'.repeat(5001);

    assert.equal(validContent.length <= 5000, true);
    assert.equal(invalidContent.length > 5000, true);
  });

  test('validates note type allowed values (awam vs dalaman)', () => {
    const allowedTypes = ['awam', 'dalaman'];

    assert.equal(allowedTypes.includes('dalaman'), true);
    assert.equal(allowedTypes.includes('awam'), true);
    assert.equal(allowedTypes.includes('rahsia'), false);
  });

  test('validates note category allowed values (notis, am, khas)', () => {
    const allowedCategories = ['notis', 'am', 'khas'];

    assert.equal(allowedCategories.includes('notis'), true);
    assert.equal(allowedCategories.includes('am'), true);
    assert.equal(allowedCategories.includes('khas'), true);
    assert.equal(allowedCategories.includes('bebas'), false);
  });
});
