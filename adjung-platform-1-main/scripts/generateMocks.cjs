const fs = require('fs');
const path = require('path');

const authors = ['user-tariq-malik', 'user-zayd-ghazali', 'user-amina-masri', 'user-sarah-henderson'];

function getRandomAuthor() {
  return authors[Math.floor(Math.random() * authors.length)];
}

const mockEntries = [];

// Generate 5 Notes
for (let i = 1; i <= 5; i++) {
  const authorId = authors[0]; // Ensure Tariq gets at least 1 note
  const date = new Date(2026, 4, i).toISOString();
  mockEntries.push(`
    {
      id: 'entry-mock-note-${i}',
      authorId: '${i === 1 ? 'user-tariq-malik' : getRandomAuthor()}',
      contentType: 'Note',
      status: 'Published',
      visibility: 'Public',
      createdDate: '${date}',
      updatedDate: '${date}',
      publishedDate: '${date}',
      title: 'Note ${i} - Brief Observation',
      slug: 'mock-note-${i}',
      tags: ['Observation', 'Thoughts'],
      canonicalUrl: 'https://${i === 1 ? 'tariq' : 'author'}.Adjung.com/note/mock-note-${i}',
      content: \`This is a brief thought recorded in the margins of daily research. Often, the most profound insights are not found in the center of the page, but in the scattered notes and marginalia that encircle the main text. Note index: ${i}.\`
    }`);
}

// Generate 5 Essays
for (let i = 1; i <= 5; i++) {
  const date = new Date(2026, 5, i).toISOString();
  mockEntries.push(`
    {
      id: 'entry-mock-essay-${i}',
      authorId: '${i === 1 ? 'user-tariq-malik' : getRandomAuthor()}',
      contentType: 'Essay',
      status: 'Published',
      visibility: 'Public',
      createdDate: '${date}',
      updatedDate: '${date}',
      publishedDate: '${date}',
      title: 'Essay ${i}: On the Nature of Typography and Meaning',
      slug: 'mock-essay-${i}',
      tags: ['Typography', 'Meaning', 'Design'],
      canonicalUrl: 'https://${i === 1 ? 'tariq' : 'author'}.Adjung.com/essay/mock-essay-${i}',
      content: \`The exploration of typography is essentially the exploration of voice. How does a letterform speak? In this essay, we delve into the intricate relationship between the visual shape of words and their semantic weight. 

It is argued that the modernist approach stripped away the historical resonances that once anchored texts in their cultural contexts. When we restore these subtleties, the text breathes again. This essay ${i} serves as a testament to the enduring power of classical typographic grids.\`
    }`);
}

// Generate 5 Articles
for (let i = 1; i <= 5; i++) {
  const date = new Date(2026, 6, i).toISOString();
  mockEntries.push(`
    {
      id: 'entry-mock-article-${i}',
      authorId: '${i === 1 ? 'user-tariq-malik' : getRandomAuthor()}',
      contentType: 'Article',
      status: 'Published',
      visibility: 'Public',
      createdDate: '${date}',
      updatedDate: '${date}',
      publishedDate: '${date}',
      title: 'Comprehensive Review ${i}: The Archival Systems of Antiquity',
      slug: 'mock-article-${i}',
      tags: ['Archive', 'History', 'Systems'],
      canonicalUrl: 'https://${i === 1 ? 'tariq' : 'author'}.Adjung.com/article/mock-article-${i}',
      content: \`Archives are not merely repositories of the past; they are the active mechanisms by which the future is structured. In reviewing the ancient libraries of Alexandria and Cordoba, we see a deliberate system of cataloging that mirrors the cosmic order perceived by their curators.

This article ${i} examines the architectural and epistemological frameworks that supported these vast collections. We find that the classification of knowledge dictates the boundaries of thought itself. The physical layout of the scrolls influenced the intellectual pathways of the scholars who walked those halls.

As we build digital archives today, we must ask ourselves: what intellectual pathways are our databases encouraging, and which are they obscuring?\`,
      footnotes: [
        'Refer to the foundational texts on archival theory for further reading.',
        'The classification systems of antiquity often prioritized theological or philosophical hierarchies over alphabetical ordering.'
      ]
    }`);
}

const dbPath = path.join(__dirname, 'src', 'db', 'mockDb.ts');
let content = fs.readFileSync(dbPath, 'utf8');

// Reliable insertion using regex replacement
content = content.replace(/(\n\s*\];\s*\n*export const INITIAL_SYSTEM_SETTINGS)/, ',' + mockEntries.join(',') + '$1');

fs.writeFileSync(dbPath, content, 'utf8');
console.log('Successfully injected 15 mock entries into mockDb.ts');
