const fs = require('fs');
const path = require('path');

const mockInstitutionalEntries = [
  `{
    id: 'entry-mock-notice-1',
    authorId: 'user-tariq-malik', // Chief Editor
    contentType: 'Notice',
    status: 'Published',
    visibility: 'Public',
    createdDate: new Date(2026, 6, 1).toISOString(),
    updatedDate: new Date(2026, 6, 1).toISOString(),
    publishedDate: new Date(2026, 6, 1).toISOString(),
    title: 'Scheduled Platform Maintenance',
    slug: 'scheduled-platform-maintenance-july',
    tags: ['Announcement', 'Maintenance'],
    canonicalUrl: 'https://Adjung.com/notice/scheduled-platform-maintenance-july',
    content: \`Please be advised that the Adjung scholarly archive will undergo scheduled platform maintenance on **July 15, 2026**. During this time, the editorium and reading interfaces may be temporarily unavailable.

We anticipate the downtime to last no longer than two hours. We thank you for your patience as we upgrade our core archival infrastructure.\`,
    isInstitutional: true,
    isPinned: true,
    priority: 'High'
  }`,
  `{
    id: 'entry-mock-editorial-1',
    authorId: 'user-tariq-malik', // Chief Editor
    contentType: 'Editor\\'s Note',
    status: 'Published',
    visibility: 'Public',
    createdDate: new Date(2026, 0, 1).toISOString(),
    updatedDate: new Date(2026, 0, 1).toISOString(),
    publishedDate: new Date(2026, 0, 1).toISOString(),
    title: 'On the Future of Adjung',
    slug: 'on-the-future-of-adjung',
    tags: ['Philosophy', 'Direction', 'Editorial'],
    canonicalUrl: 'https://Adjung.com/editorial/on-the-future-of-adjung',
    content: \`As we move into a new era of digital scholarship, the Adjung Editorial Board reflects on our founding principles. The digital age promised democratization of knowledge, yet often delivered fragmentation. 

In this note, we reaffirm our commitment to structured, deliberate, and deeply integrated academic publishing. The future of Adjung is not merely about hosting texts; it is about preserving the relationships between texts—the citations, the margins, the silent dialogues that bridge centuries of thought.

We invite our writers to continue pushing the boundaries of what a digital manuscript can be.\`,
    excerpt: 'As we move into a new era of digital scholarship, the Adjung Editorial Board reflects on our founding principles. The digital age promised democratization of knowledge, yet often delivered fragmentation.',
    isInstitutional: true,
    isPinned: true,
    editorialCategory: 'Philosophy'
  }`
];

const dbPath = path.join(__dirname, 'src', 'db', 'mockDb.ts');
let content = fs.readFileSync(dbPath, 'utf8');

// Insert the new entries into INITIAL_ENTRIES
content = content.replace(/(\n\s*\];\s*\n*export const INITIAL_SYSTEM_SETTINGS)/, ',' + mockInstitutionalEntries.join(',') + '$1');

// Update loadedEntries condition to force reload if < 17 entries
content = content.replace(
  'if (loadedEntries.length < 15)',
  'if (loadedEntries.length < 17)'
);

fs.writeFileSync(dbPath, content, 'utf8');
console.log('Successfully injected Institutional mock entries.');
