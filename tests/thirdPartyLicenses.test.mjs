import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectBundledPackages,
  packageNameFromPath,
  renderLicenseFile,
} from '../scripts/lib/third-party-licenses.mjs';

const NODE_MODULES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules');

test('finds the package behind a bundled module or file', () => {
  assert.equal(packageNameFromPath('/app/node_modules/react/cjs/react.production.js'), 'react');
  assert.equal(packageNameFromPath('/app/node_modules/@fontsource-variable/inter/files/inter-latin.woff2'), '@fontsource-variable/inter');
  assert.equal(packageNameFromPath('/app/node_modules/mammoth/node_modules/underscore/underscore.js'), 'underscore');
  assert.equal(packageNameFromPath('\0/app/node_modules/jszip/dist/jszip.min.js?commonjs-proxy'), 'jszip');
  assert.equal(packageNameFromPath('C:\\app\\node_modules\\dompurify\\dist\\purify.es.mjs'), 'dompurify');
  assert.equal(packageNameFromPath('/app/src/App.jsx'), null);
  assert.equal(packageNameFromPath('\0vite/preload-helper.js'), null);
});

test('collects packages from code chunks and from emitted files such as fonts', () => {
  const names = collectBundledPackages({
    'index.js': { type: 'chunk', modules: {
      '/app/src/main.jsx': {},
      '/app/node_modules/react-dom/client.js': {},
    } },
    'inter.woff2': { type: 'asset', originalFileNames: ['/app/node_modules/@fontsource-variable/inter/files/a.woff2'] },
    'logo.png': { type: 'asset', originalFileNames: ['/app/public/logo.png'] },
  });
  assert.deepEqual([...names].sort(), ['@fontsource-variable/inter', 'react-dom']);
});

test('writes each licence in full, including licence files named LICENSE.markdown', () => {
  const text = renderLicenseFile(new Set(['react', 'jszip', 'not-installed']), NODE_MODULES);

  assert.match(text, /^Third-party software in The Code App\n/);
  assert.match(text, /\nreact \d+\.\d+\.\d+ — MIT\n/);
  assert.match(text, /Permission is hereby granted, free of charge/);
  assert.match(text, /\njszip \d+\.\d+\.\d+ — \(MIT OR GPL-3\.0-or-later\)\n/);
  assert.doesNotMatch(text, /jszip[^\n]*\n[^\n]*\n=+\n\nLicensed under/, 'jszip ships LICENSE.markdown');
  assert.doesNotMatch(text, /not-installed/);
});
