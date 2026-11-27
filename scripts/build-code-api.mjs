// After `vite build`: writes the Code API's answers (scripts/lib/code-api.mjs) to
// dist/api/code/v1/, which the Worker serves at their addresses (code-api.js). Runs after the
// service worker is generated, so these files are not precached. See docs/code-api.md.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CODE_API_PATH } from '../code-api.js';
import { buildCodeApiFiles } from './lib/code-api.mjs';
import { loadSplitCodeData } from './lib/code-content.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDirectory = resolve(projectRoot, 'dist', CODE_API_PATH.slice(1));

const files = buildCodeApiFiles(loadSplitCodeData(projectRoot).chapters);

rmSync(apiDirectory, { recursive: true, force: true });
for (const { file, data, body } of files) {
  const target = resolve(apiDirectory, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body ?? `${JSON.stringify(data)}\n`);
}

console.log(`Wrote ${files.length} Code API files to dist${CODE_API_PATH}/.`);
