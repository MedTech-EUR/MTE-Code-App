#!/usr/bin/env node
/**
 * Puts the files the content editor writes (the Code chapters and the decision trees) in the
 * editor's JSON layout (public/admin/lib/cms-format.js), so a save in the editor changes only
 * the lines that were edited. Values are never changed, except that the trees spell out what the
 * editor writes anyway (lists for related chapters and sections, empty optional fields).
 *
 *   npm run format:data            rewrite files that are not in the layout
 *   npm run format:data -- --check list them and fail instead (also part of validate:data)
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatEditorFile, TREES_PATH } from '../public/admin/lib/cms-format.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Repository paths of the files the content editor writes. */
export function editorFilePaths(root = ROOT) {
  const chapters = readdirSync(resolve(root, 'src/data/code'))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => `src/data/code/${name}`);
  return [...chapters, TREES_PATH];
}

/** The editor files whose text differs from the editor's layout: [{ path, text, formatted }]. */
export function findUnformatted(root = ROOT) {
  return editorFilePaths(root)
    .map((path) => {
      const text = readFileSync(resolve(root, path), 'utf8');
      return { path, text, formatted: formatEditorFile(path, JSON.parse(text)) };
    })
    .filter(({ text, formatted }) => text !== formatted);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const check = process.argv.includes('--check');
  const unformatted = findUnformatted();
  if (check) {
    unformatted.forEach(({ path }) => console.error(`${path} is not in the content editor's layout.`));
    if (unformatted.length) console.error('Run `npm run format:data` to fix.');
    process.exitCode = unformatted.length ? 1 : 0;
  } else {
    unformatted.forEach(({ path, formatted }) => {
      writeFileSync(resolve(ROOT, path), formatted);
      console.log(`Formatted ${path}`);
    });
    console.log(unformatted.length ? `${unformatted.length} file(s) formatted.` : 'All content editor files are already in its layout.');
  }
}
