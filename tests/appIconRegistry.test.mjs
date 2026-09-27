import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, '..');
const componentsDirectory = resolve(projectRoot, 'src/components');
// Registries such as the Home Hub's sections name icons too.
const configDirectory = resolve(projectRoot, 'src/config');
const iconSource = readFileSync(
  resolve(componentsDirectory, 'AppIcons.jsx'),
  'utf8',
);

function getComponentFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) return getComponentFiles(absolutePath);
    return ['.js', '.jsx', '.ts', '.tsx'].includes(extname(entry.name))
      ? [absolutePath]
      : [];
  });
}

function getRegisteredIconNames(source) {
  const names = new Set();

  for (const mapName of ['customIconMap', 'lucideIconMap']) {
    const mapMatch = source.match(
      new RegExp(`const ${mapName} = \\{([\\s\\S]*?)\\};`),
    );
    if (!mapMatch) continue;

    for (const identifier of mapMatch[1].match(/[A-Z][A-Za-z0-9]*/g) || []) {
      names.add(identifier);
    }
  }

  return names;
}

function getRequestedIconNames(source) {
  const names = new Set();

  for (const match of source.matchAll(
    /<AppIcon\b[^>]*\bname=["']([A-Z][A-Za-z0-9]*)["'][^>]*\/?>/g,
  )) {
    names.add(match[1]);
  }

  for (const match of source.matchAll(
    /<AppIcon\b[^>]*\bname=\{([^}]*)\}[^>]*\/?>/g,
  )) {
    for (const quotedName of match[1].matchAll(
      /["']([A-Z][A-Za-z0-9]*)["']/g,
    )) {
      names.add(quotedName[1]);
    }
  }

  for (const match of source.matchAll(
    /\bicon\s*:\s*["']([A-Z][A-Za-z0-9]*)["']/g,
  )) {
    names.add(match[1]);
  }

  for (const match of source.matchAll(
    /\bicon\s*=\s*["']([A-Z][A-Za-z0-9]*)["']/g,
  )) {
    names.add(match[1]);
  }

  return names;
}

test('all component AppIcon names are registered', () => {
  const registeredNames = getRegisteredIconNames(iconSource);
  const requestedNames = new Set();

  for (const componentPath of [
    ...getComponentFiles(componentsDirectory),
    ...getComponentFiles(configDirectory),
  ]) {
    const componentSource = readFileSync(componentPath, 'utf8');
    for (const name of getRequestedIconNames(componentSource)) {
      requestedNames.add(name);
    }
  }

  const missingNames = [...requestedNames]
    .filter((name) => !registeredNames.has(name))
    .sort();

  assert.deepEqual(missingNames, []);
});
