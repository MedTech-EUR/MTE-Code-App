// Run when adding records or importing an edition. Resolve missing published identities
// before assigning new ones: an import that dropped IDs must never retarget an embed.
import { execFileSync } from 'node:child_process';
import { suggestLiveIds } from './lib/reconcile-code-ids.mjs';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadSplitCodeData } from './lib/code-content.mjs';
import { liveRecords, validateLiveIds } from './lib/code-live-ids.mjs';
import { canonicalChapter, toJsonText } from '../public/admin/lib/cms-format.js';

const registryFile = 'src/data/code-live-ids.json';
const registry = JSON.parse(readFileSync(registryFile, 'utf8'));
const { chapters } = loadSplitCodeData('.');
// With --suggest-from, report exact matches for the maintainer to review before
// carrying IDs into a replacement dataset. Nothing from the previous text is published.
const args = process.argv.slice(2);
if (args.length) {
  if (args.length !== 2 || args[0] !== '--suggest-from') throw new Error('Usage: npm run assign:code-ids -- --suggest-from <git-ref>');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const sha = git('rev-parse', '--verify', '--end-of-options', args[1] + '^{commit}');
  const paths = git('ls-tree', '-r', '--name-only', sha, 'src/data/code/').split('\n').filter(path => path.endsWith('.json'));
  const previous = paths.map(path => JSON.parse(git('show', sha + ':' + path)));
  const matches = suggestLiveIds(previous, chapters);
  for (const { id, chapter, record } of matches) console.log(id, '→', chapter.id, record.title || record.q || '(untitled section)');
  console.log(matches.length + ' unique wording matches. Review before applying. Unmatched items need editorial mapping.');
  process.exit(0);
}
const changed = new Set();
for (const { record, chapter, kind } of liveRecords(chapters)) {
  if (record.liveId) continue;
  record.liveId = kind + '-' + randomUUID();
  registry.active.push(record.liveId);
  changed.add(chapter);
}
validateLiveIds(chapters, registry);
for (const chapter of changed) {
  writeFileSync('src/data/code/' + chapter.id + '.json', toJsonText(canonicalChapter(chapter)));
}
if (changed.size) {
  registry.active.sort();
  writeFileSync(registryFile, toJsonText(registry));
}
console.log('Verified permanent references. Updated ' + changed.size + ' chapter files.');
