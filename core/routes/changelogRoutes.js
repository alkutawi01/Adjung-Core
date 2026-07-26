import express from 'express';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function createChangelogRoutes(rootDir) {
  const router = express.Router();

  // GET /api/system/rules-changelog — git commit history for core/editorial/ and server.js, so the
  // Perlembagaan reference page can show which real commit changed a geometry/budget rule, and the
  // chief editor has a real commit hash they can ask to have reverted. Read-only, never mutates the
  // repo. If git isn't available in this environment (e.g. a deploy without a .git directory), fails
  // soft with an empty list rather than breaking the page that renders it.
  router.get('/rules-changelog', async (req, res) => {
    try {
      const { stdout } = await execFileAsync('git', [
        'log',
        '--pretty=format:%H%x1f%ad%x1f%s',
        '--date=format:%d %b %Y',
        '-n', '40',
        '--',
        'core/editorial/',
        'server.js'
      ], { cwd: rootDir });

      const commits = stdout.split('\n').filter(Boolean).map(line => {
        const [hash, date, message] = line.split('\x1f');
        return { hash: (hash || '').slice(0, 7), fullHash: hash || '', date: date || '', message: message || '' };
      });
      res.json({ commits });
    } catch (err) {
      console.warn('Failed to read git changelog:', err.message);
      res.json({ commits: [], unavailable: true });
    }
  });

  // GET /api/system/ui-ux-changelog — live, millisecond-timestamped log of UI/UX-affecting changes,
  // written by scripts/log-ui-change.mjs the instant each change lands (not batched at commit time
  // like /rules-changelog above, which only carries git's per-second commit timestamp and only
  // updates when a commit happens). Read-only here; fails soft with an empty list if the log file
  // doesn't exist yet.
  router.get('/ui-ux-changelog', (req, res) => {
    try {
      const logPath = path.join(rootDir, 'core', 'data', 'ui_ux_changelog.json');
      if (!fs.existsSync(logPath)) return res.json({ entries: [] });
      const entries = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      res.json({ entries });
    } catch (err) {
      console.warn('Failed to read UI/UX changelog:', err.message);
      res.json({ entries: [], unavailable: true });
    }
  });

  return router;
}
