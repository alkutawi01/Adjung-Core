import test from 'node:test';
import assert from 'node:assert/strict';

test('RSS Category Filter - blocks items whose XML category matches dynamic blocked categories list', () => {
  const blockedCategories = [
    { id: 'b1', categoryName: 'Hiburan', enabled: 1 },
    { id: 'b2', categoryName: 'Gaya', enabled: 1 },
    { id: 'b3', categoryName: 'Sensasi', enabled: 1 }
  ];

  const testItems = [
    { title: 'Konsert artis berlangsung meriah', category: 'Hiburan' },
    { title: 'Fesyen musim panas 2026', category: 'Gaya' },
    { title: 'PM Anwar bincang isu Laut China Selatan', category: 'BERITA UTAMA' }
  ];

  const filteredItems = testItems.filter(item => {
    const rawCategory = (item.category || '').trim();
    const isBlocked = blockedCategories.some(b => {
      const bName = (b.categoryName || '').toLowerCase().trim();
      return bName && rawCategory.toLowerCase().includes(bName);
    });
    return !isBlocked;
  });

  assert.equal(filteredItems.length, 1);
  assert.equal(filteredItems[0].title, 'PM Anwar bincang isu Laut China Selatan');
  assert.equal(filteredItems[0].category, 'BERITA UTAMA');
});
