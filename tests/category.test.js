import test from 'node:test';
import assert from 'node:assert/strict';
import CategoryRegistry from '../core/category/CategoryRegistry.js';

test('CategoryRegistry - getSlug normalizes category names correctly', () => {
  assert.equal(CategoryRegistry.getSlug('Sukan'), 'sukan');
  assert.equal(CategoryRegistry.getSlug('  DASAR PERBANDARAN  '), 'dasar-perbandaran');
  assert.equal(CategoryRegistry.getSlug('Neurolinguistik & Sains!'), 'neurolinguistik-sains');
  assert.equal(CategoryRegistry.getSlug(''), 'umum');
  assert.equal(CategoryRegistry.getSlug(null), 'umum');
});

test('CategoryRegistry - hslToHex generates valid hex color strings', () => {
  const hex = CategoryRegistry.hslToHex(210, 65, 42);
  assert.match(hex, /^#[0-9A-F]{6}$/);
});

test('CategoryRegistry - generateColorBeyondPalette returns golden angle color', () => {
  const color1 = CategoryRegistry.generateColorBeyondPalette(0);
  const color2 = CategoryRegistry.generateColorBeyondPalette(1);
  assert.notEqual(color1, color2);
  assert.match(color1, /^#[0-9A-F]{6}$/);
  assert.match(color2, /^#[0-9A-F]{6}$/);
});
