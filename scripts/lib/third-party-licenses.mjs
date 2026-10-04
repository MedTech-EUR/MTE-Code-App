// Writes /third-party-licenses.txt at build time: the licence of every package whose code or
// files end up in the app. The Legal Notice links to it.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const LICENSE_FILE_NAME = 'third-party-licenses.txt';

// Shipped without being in the app's module graph: Workbox bundles the service worker after the
// app build, and Tailwind generates the stylesheet's base styles.
export const EXTRA_PACKAGES = Object.freeze([
  'tailwindcss',
  'workbox-core',
  'workbox-precaching',
  'workbox-routing',
  'workbox-strategies',
]);

const LICENSE_FILE = /^(licen[cs]e|copying)(\.(md|markdown|txt))?$/i;
const NOTICE_FILE = /^notice(\.(md|markdown|txt))?$/i;

// "…/node_modules/@scope/name/…" → "@scope/name". The last node_modules wins, for nested copies.
export function packageNameFromPath(file) {
  const normalized = String(file).replace(/^\0/, '').split('?')[0].replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/node_modules/');
  if (index < 0) return null;
  const [first, second] = normalized.slice(index + '/node_modules/'.length).split('/');
  if (!first) return null;
  return first.startsWith('@') ? (second ? `${first}/${second}` : null) : first;
}

// Packages behind every module in the JavaScript chunks and every emitted file (fonts, workers).
export function collectBundledPackages(bundle) {
  const names = new Set();
  for (const output of Object.values(bundle)) {
    const files = output.type === 'chunk'
      ? Object.keys(output.modules || {})
      : [...(output.originalFileNames || [])];
    for (const file of files) {
      const name = packageNameFromPath(file);
      if (name) names.add(name);
    }
  }
  return names;
}

function readPackage(nodeModules, name) {
  const directory = path.join(nodeModules, ...name.split('/'));
  const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const files = readdirSync(directory);
  const licenseFile = files.find((file) => LICENSE_FILE.test(file));
  const noticeFile = files.find((file) => NOTICE_FILE.test(file));
  const repository = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
  return {
    name,
    version: manifest.version,
    license: typeof manifest.license === 'string' ? manifest.license : manifest.license?.type || 'see the package',
    homepage: manifest.homepage || repository?.replace(/^git\+/, '').replace(/\.git$/, '') || '',
    text: licenseFile ? readFileSync(path.join(directory, licenseFile), 'utf8').trim() : null,
    notice: noticeFile ? readFileSync(path.join(directory, noticeFile), 'utf8').trim() : null,
  };
}

export function renderLicenseFile(names, nodeModules) {
  const rule = '='.repeat(80);
  const parts = [
    'Third-party software in The Code App',
    '',
    'The Code App, published by MedTech Europe, includes the open-source software listed',
    'below. Each package is used under the licence shown with it.',
  ];
  for (const name of [...names].sort()) {
    if (!existsSync(path.join(nodeModules, ...name.split('/'), 'package.json'))) continue;
    const pkg = readPackage(nodeModules, name);
    parts.push('', rule, `${pkg.name} ${pkg.version} — ${pkg.license}`);
    if (pkg.homepage) parts.push(pkg.homepage);
    parts.push(rule, '', pkg.text || `Licensed under ${pkg.license}; the package ships no separate licence file.`);
    if (pkg.notice) parts.push('', pkg.notice);
  }
  return `${parts.join('\n')}\n`;
}

/** @returns {import('vite').Plugin} */
export function thirdPartyLicensesPlugin({ nodeModules = path.resolve('node_modules') } = {}) {
  return {
    name: 'third-party-licenses',
    apply: 'build',
    generateBundle(_options, bundle) {
      const names = collectBundledPackages(bundle);
      for (const name of EXTRA_PACKAGES) names.add(name);
      this.emitFile({ type: 'asset', fileName: LICENSE_FILE_NAME, source: renderLicenseFile(names, nodeModules) });
    },
  };
}
