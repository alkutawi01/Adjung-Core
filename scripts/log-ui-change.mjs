// Appends one entry to core/data/ui_ux_changelog.json the instant a UI/UX-affecting change is
// made -- per Perlembagaan peraturan: every UI/UX change must be logged live, with no delay, and
// with a precise time (not just a date). Run right after the edit lands, before moving on:
//   node scripts/log-ui-change.mjs "Ringkasan perubahan" "file1.tsx,file2.tsx"
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(__dirname, '..', 'core', 'data', 'ui_ux_changelog.json');

const [, , summary, filesArg] = process.argv;
if (!summary) {
  console.error('Guna: node scripts/log-ui-change.mjs "Ringkasan perubahan" "file1.tsx,file2.tsx"');
  process.exit(1);
}

const entries = existsSync(LOG_PATH) ? JSON.parse(readFileSync(LOG_PATH, 'utf-8')) : [];
entries.unshift({
  time: new Date().toISOString(),
  summary,
  files: filesArg ? filesArg.split(',').map(f => f.trim()).filter(Boolean) : [],
});
writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2) + '\n');
console.log(`Log dicatat: ${summary}`);
